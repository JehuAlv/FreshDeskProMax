var AIPipeline = (function() {
    'use strict';

    var _index = null;
    var _ready = false;
    var _corrections = JSON.parse(localStorage.getItem('fd_ai_corrections') || '[]');

    var STOPWORDS = new Set('the a an is are was were be been to of in for on with at by that this it and or but not no from as do did has have had will can could would should i you we they he she me my your our el la los las un una de del en por para con que es son no se lo al como su nos le te mi tu ya si más muy'.split(' '));

    function tokenize(text) {
        return text.toLowerCase().replace(/[^a-záéíóúñüa-z0-9\s]/g, ' ').split(/\s+/).filter(function(w) {
            return w.length > 2 && !STOPWORDS.has(w);
        });
    }

    // ═══════════════════════════════════════════
    // BM25 SEARCH ENGINE
    // ═══════════════════════════════════════════

    function bm25Score(queryTokens, doc, k1, b) {
        if (!_index) return 0;
        k1 = k1 || 1.5;
        b = b || 0.75;
        var score = 0;
        var termToId = _index._termToId;
        var idf = _index.idf;
        var avgDl = _index.avgDl;
        var dl = doc.dl;

        for (var qi = 0; qi < queryTokens.length; qi++) {
            var tid = termToId[queryTokens[qi]];
            if (tid === undefined) continue;
            var idx = binarySearch(doc.t, tid);
            if (idx < 0) continue;
            var tf = doc.f[idx];
            var idfVal = idf[tid] || 0;
            score += idfVal * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl / avgDl));
        }
        return score;
    }

    function binarySearch(arr, val) {
        var lo = 0, hi = arr.length - 1;
        while (lo <= hi) {
            var mid = (lo + hi) >> 1;
            if (arr[mid] === val) return mid;
            if (arr[mid] < val) lo = mid + 1;
            else hi = mid - 1;
        }
        return -1;
    }

    function search(queryText, opts) {
        if (!_index) return [];
        opts = opts || {};
        var lang = opts.lang || null;
        var n = opts.n || 5;
        var minQuality = opts.minQuality || 0;
        var category = opts.category || null;

        var queryTokens = tokenize(queryText);
        if (!queryTokens.length) return [];

        var docs = _index.docs;
        var scored = [];

        for (var i = 0; i < docs.length; i++) {
            var doc = docs[i];
            if (lang && doc.lang !== lang) continue;
            if (minQuality > 0 && doc.q < minQuality) continue;

            var score = bm25Score(queryTokens, doc);
            if (score > 0) {
                if (category && doc.cat === category) score *= 1.3;
                scored.push({ idx: i, score: score });
            }
        }

        scored.sort(function(a, b) { return b.score - a.score; });

        var results = [];
        var seenReplies = new Set();
        for (var j = 0; j < scored.length && results.length < n; j++) {
            var d = docs[scored[j].idx];
            var replyKey = d.reply.substring(0, 80);
            if (seenReplies.has(replyKey)) continue;
            seenReplies.add(replyKey);
            results.push({
                score: scored[j].score,
                category: d.cat,
                lang: d.lang,
                reply: d.reply,
                customer: d.cust,
                agent: d.a || '?',
                quality: d.q,
                isFirst: !!d.first,
            });
        }
        return results;
    }

    // ═══════════════════════════════════════════
    // TICKET ANALYZER
    // ═══════════════════════════════════════════

    function analyzeTicket(messages, subject, ticketStatus) {
        var lastCustMsgs = messages.filter(function(m) { return m.f === 'Customer'; });
        var lastAgentMsgs = messages.filter(function(m) { return m.f === 'Agent'; });
        var lastCust = lastCustMsgs.length ? lastCustMsgs[lastCustMsgs.length - 1] : null;
        var lastAgent = lastAgentMsgs.length ? lastAgentMsgs[lastAgentMsgs.length - 1] : null;
        var custText = lastCust ? lastCust.t : '';
        var custLower = custText.toLowerCase();
        var isFirst = !lastAgent;
        var isWaiting = ticketStatus === 3;

        var entities = extractEntities(custText, subject);
        var intent = classifyIntent(custLower, isFirst, entities);
        var missing = detectMissing(messages, intent, entities);
        var lang = detectLang(custText);
        var conversationPhase = getConversationPhase(messages);

        return {
            intent: intent,
            entities: entities,
            missing: missing,
            lang: lang,
            isFirst: isFirst,
            isWaiting: isWaiting,
            lastCustText: custText,
            lastAgentText: lastAgent ? lastAgent.t : '',
            conversationPhase: conversationPhase,
            hasImages: /\[cid:|image|screenshot|captura|\.png|\.jpg|\.jpeg/i.test(custText),
            subject: subject || '',
        };
    }

    function extractEntities(text, subject) {
        var combined = (text + ' ' + (subject || '')).replace(/\r\n|\n/g, ' ');
        var serials = [];
        var m = combined.match(/[A-Z]{2,4}-[A-Z]{2,4}-\d{4,}/g);
        if (m) serials = Array.from(new Set(m));

        var errorCodes = [];
        m = combined.match(/error\s*(?:code\s*)?:?\s*(\d{3,}|0x[0-9a-f]+)/gi);
        if (m) errorCodes = m.map(function(e) { return e.trim(); });

        var versions = [];
        m = combined.match(/(?:v|version|ver\.?)\s*(\d+\.\d+[\.\d]*)/gi);
        if (m) versions = m.map(function(v) { return v.trim(); });

        var tvCredentials = null;
        var tvMatch = combined.match(/(?:id|ID)\s*[:=]?\s*(\d{3,}\s*\d{3,}\s*\d{3,}|\d{9,})/);
        var tvPass = combined.match(/(?:pass|password|contraseña|pw)\s*[:=]?\s*(\S+)/i);
        if (tvMatch || /teamviewer|anydesk/i.test(combined)) {
            tvCredentials = {
                id: tvMatch ? tvMatch[1].replace(/\s/g, '') : null,
                password: tvPass ? tvPass[1] : null,
            };
        }

        var machineType = null;
        if (/\bAOI\b/i.test(combined)) machineType = 'AOI';
        else if (/\bSPI\b/i.test(combined)) machineType = 'SPI';
        else if (/\breview\b/i.test(combined)) machineType = 'Review';

        var ipAddresses = [];
        m = combined.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g);
        if (m) ipAddresses = Array.from(new Set(m));

        return {
            serials: serials,
            errorCodes: errorCodes,
            versions: versions,
            tvCredentials: tvCredentials,
            machineType: machineType,
            ipAddresses: ipAddresses,
            mentionsKBR: /\bkbr\b/i.test(combined),
            mentionsBRM: /\bbrm\b/i.test(combined),
            mentionsLogs: /\blog|issue\s*report/i.test(combined),
            mentionsRemote: /remote|teamviewer|anydesk|tv\s*id/i.test(combined),
        };
    }

    function classifyIntent(custLower, isFirst, entities) {
        var t = custLower;
        var wc = t.split(/\s+/).length;

        if (/urgent|line.*down|stop|halt|blocked|parada|detenida|urgente/.test(t)) return 'urgent';

        if (/gracias|thanks|resolved|solved|ya.*funciona|it works|fixed|working now|todo.*bien|sin novedad/.test(t)
            && !/pendiente|soporte|help|need|please|por favor|falta|also|también|could you|can you|podrías|update|status/.test(t)
            && wc < 40) return 'resolved';

        if (entities.tvCredentials && (entities.tvCredentials.id || entities.tvCredentials.password)) return 'tv_creds';

        if (/quot|cotizaci|price|precio|cost|costo|presupuesto|budget/.test(t)) return 'quote';

        if (/error|issue|problem|fail|broken|not work|crash|exception|falla|problema/.test(t) && isFirst) return 'error_first';

        if (/still|sigue|todavía|again|otra vez|persiste|same|mismo|continues|continúa/.test(t)
            && !/not occurred|hasn.t happened|no.*ocurri|not happened|not recurring/.test(t)) return 'persists';

        if (/could we schedule|can we schedule|schedule.*time|when.*available|agendar|programar|cuándo podemos|sesión remota/.test(t)) return 'scheduling';

        if (/sin problema|works for me|disponible|confirmado|sounds good|me funciona|that works|perfect/.test(t)
            && /\d|time|hora|am\b|pm\b|session|sesión|meeting|mañana|tomorrow/.test(t)) return 'confirm_time';

        if (/adjunto|attach|here.*is|te.*(comparto|envío)|sharing|sent.*you|envié|log|report|archivo/.test(t)) return 'files_shared';

        if (/i will|voy a|let me|going to|haré|verificaré|get back|te confirmo|te aviso|will.*check|haven.t had/.test(t)) return 'will_check';

        if (/done|listo|installed|instalé|applied|apliqué|loaded|ya lo hice|already did/.test(t)) return 'completed_action';

        if (/status|update|avance|estado|progress|novedad|how.*going|cómo va/.test(t)) return 'status_request';

        if (/question|pregunta|how do|cómo|how can|can you|could you|es posible|is it possible|\?|¿/.test(t)) return 'question';

        if (/send.*invite|meeting invite|calendar|teams.*link/.test(t)) return 'meeting_invite';

        if (/ya.*reuni[oó]n|ready.*connect|in the meeting|listo para conect|estoy.*sesión|waiting.*you|esperando/.test(t)) return 'waiting_session';

        return 'general';
    }

    function detectMissing(messages, intent, entities) {
        var missing = [];
        var allText = messages.map(function(m) { return m.t; }).join(' ').toLowerCase();

        if (intent === 'error_first' || intent === 'persists') {
            if (!entities.mentionsLogs && !/issue report|log|registro/.test(allText)) {
                missing.push('issue_report');
            }
            if (!entities.serials.length && !/serial|sn\b|número de serie/.test(allText)) {
                missing.push('serial_number');
            }
            if (!entities.mentionsRemote) {
                missing.push('remote_access');
            }
        }

        if (intent === 'scheduling' || intent === 'confirm_time') {
            if (!entities.mentionsRemote && !/credenciales|credentials/.test(allText)) {
                missing.push('remote_credentials');
            }
        }

        if (intent === 'completed_action') {
            missing.push('confirmation_working');
        }

        return missing;
    }

    function detectLang(text) {
        var es = (text.match(/\b(hola|gracias|por|favor|buenas|buenos|problema|error|revisar|enviar|adjunto|compartir|necesito|equipo|verificar|confirmar|sesión|remota|información|también|cómo|configuración|actualmente|cliente|resultado|archivo|desarrollo|implementación)\b/gi) || []).length;
        var en = (text.match(/\b(hello|thanks|please|could|would|should|issue|report|review|check|share|send|attach|session|remote|available|schedule|know|update|forward|looking|need|question|working|error|problem|help|want|time|file|customer|result|development)\b/gi) || []).length;
        return es > en ? 'es' : 'en';
    }

    function getConversationPhase(messages) {
        var agentCount = messages.filter(function(m) { return m.f === 'Agent'; }).length;
        var custCount = messages.filter(function(m) { return m.f === 'Customer'; }).length;
        if (agentCount === 0) return 'first_response';
        if (agentCount <= 2) return 'early_investigation';
        return 'ongoing';
    }

    // ═══════════════════════════════════════════
    // PROMPT BUILDER
    // ═══════════════════════════════════════════

    function buildPrompt(analysis, replyContext, opts) {
        opts = opts || {};
        var extraCtx = opts.extraCtx || '';
        var spLink = opts.spLink || '';

        var rc = replyContext;
        var esL = analysis.lang === 'es';
        var hi = rc.hi || (esL ? 'Hola' : 'Hello');
        var bye = rc.bye || (esL ? 'Saludos cordiales' : 'Best regards');

        var similar = search(analysis.lastCustText, {
            lang: analysis.lang,
            n: 8,
            minQuality: 1.0,
            category: analysis.intent,
        });

        var action = buildAction(analysis, rc);

        var correctionHints = getCorrectionHints(analysis.lang, 3);

        var sys = buildSystemPrompt(esL, hi, bye, analysis.hasImages, correctionHints);

        var usr = buildUserMessage(analysis, action, similar, rc, {
            extraCtx: extraCtx,
            spLink: spLink,
            hi: hi,
            bye: bye,
            esL: esL,
        });

        return { sys: sys, usr: usr };
    }

    function buildSystemPrompt(esL, hi, bye, hasImages, correctionHints) {
        var imgRule = hasImages ? (esL
            ? '\n- El cliente envió imágenes que NO puedes ver. NUNCA finjas verlas. Reconoce que las recibiste.'
            : '\n- Customer sent images you CANNOT see. NEVER pretend you can see them. Acknowledge receipt.')
            : '';

        if (esL) {
            return 'Ingeniero de soporte MES, Koh Young (BRM para AOI/SPI).\n'
                + 'Tuteo. Profesional pero casual. Conciso. 2-5 oraciones.\n'
                + 'Formato: ' + hi + ', → cuerpo → ' + bye + '\n'
                + 'NADA después de "' + bye + '". Sin firma, sin nombre.\n\n'
                + 'NO HACER:\n'
                + '- No repetir textualmente lo que dijo el cliente\n'
                + '- No repetir datos del cliente (seriales, fechas, horas)\n'
                + '- No inventar part numbers, versiones, costos ni tiempos\n'
                + '- No mencionar cerrar/mantener ticket\n'
                + '- No usar: "Estimado/a", "Le informo", "Buen día", "Espero que te encuentres bien", "No dudes en contactarnos", "cualquier duda", "Si necesitas más apoyo"'
                + imgRule
                + correctionHints;
        } else {
            return 'MES support engineer, Koh Young (BRM for AOI/SPI).\n'
                + 'Professional but casual. Concise. 2-5 sentences.\n'
                + 'Format: ' + hi + ', → body → ' + bye + '\n'
                + 'NOTHING after "' + bye + '". No signature, no name.\n\n'
                + 'DO NOT:\n'
                + '- Do NOT repeat customer\'s words verbatim\n'
                + '- Do NOT repeat customer data (serials, dates, times)\n'
                + '- Do NOT invent part numbers, versions, costs, or timelines\n'
                + '- Do NOT mention closing/keeping ticket\n'
                + '- Do NOT use: "Dear", "I hope this email finds you well", "Please do not hesitate", "Thank you for reaching out", "any questions"'
                + imgRule
                + correctionHints;
        }
    }

    function buildAction(analysis, rc) {
        var intent = analysis.intent;
        var missing = analysis.missing;
        var entities = analysis.entities;
        var isWaiting = analysis.isWaiting;
        var isFirst = analysis.isFirst;
        var lastAgentText = analysis.lastAgentText.toLowerCase();
        var custLower = analysis.lastCustText.toLowerCase();

        if (isWaiting && analysis.lastAgentText) {
            if (/teamviewer|remote|session|sesión|conectar/.test(lastAgentText))
                return 'Follow up: ask if they are available for the remote session. Be brief.';
            if (/issue.*report|log|registro|reporte/.test(lastAgentText))
                return 'Follow up: ask if they gathered the logs/issue report. Keep it short.';
            if (/kbr|apply|install|aplicar|instalar/.test(lastAgentText))
                return 'Follow up: ask if they applied the KBR and if everything works.';
            return 'Follow up briefly: ask if they still need assistance.';
        }

        switch (intent) {
            case 'urgent':
                return 'URGENT. Ask for remote access credentials immediately.';
            case 'resolved':
                return 'Customer says issue is resolved. Respond warmly. Offer continued support. Do NOT mention closing ticket.';
            case 'tv_creds':
                if (/\?|how|what|why|can you|could you|también|also|but|pero|cómo|qué/.test(custLower))
                    return 'Customer shared TV credentials AND asked a question. First confirm you will connect, then briefly address their question.';
                return 'Customer shared TV credentials. Reply in ONE sentence: confirm you are connecting.';
            case 'quote':
                return 'Quote request. Acknowledge receipt. Say you will review the requirements. Do NOT list what they asked for.';
            case 'error_first':
                if (analysis.hasImages)
                    return 'Customer reported error with images you cannot see. Acknowledge. Ask for Issue Report and serial number. Offer remote session.';
                var askFor = [];
                if (missing.indexOf('issue_report') >= 0) askFor.push('Issue Report (BRM > Help > Issue Report)');
                if (missing.indexOf('serial_number') >= 0) askFor.push('machine serial number');
                if (missing.indexOf('remote_access') >= 0) askFor.push('remote access credentials');
                return 'Customer reported an error.' + (askFor.length ? ' Ask for: ' + askFor.join(', ') + '.' : ' Offer to investigate remotely.');
            case 'persists':
                return 'Problem persists. Ask for remote session to investigate directly.';
            case 'scheduling':
                return 'Customer is proposing a schedule/time. Confirm availability or propose alternative. Do NOT repeat their dates/times.';
            case 'confirm_time':
                return 'Customer confirmed a time. Confirm briefly. Ask for remote credentials if not provided.';
            case 'files_shared':
                if (/error|issue|problem|fail|exception/.test(custLower))
                    return 'Customer shared files about an error. Acknowledge the specific error. Say you will review.';
                return 'Customer shared info/files. Acknowledge and say you will review.';
            case 'will_check':
                return 'Customer says they will check/test later. Acknowledge briefly: you will wait for their update. Do NOT ask questions.';
            case 'completed_action':
                return 'Customer completed a requested action. Ask if everything is working properly now.';
            case 'status_request':
                return 'Status request. Be honest and direct about current state.';
            case 'question':
                if (/es posible|is it possible|can we|podemos|se puede/.test(custLower))
                    return 'Technical question. If unsure, say you will check and confirm. Do NOT invent steps.';
                return 'Customer asked a question. Answer directly. If unsure, say you will check.';
            case 'waiting_session':
                return 'Customer is WAITING in meeting/session. Reply in ONE sentence: you are connecting now.';
            case 'meeting_invite':
                return 'Customer asks for meeting invite. Confirm you will send it.';
            default:
                if (isFirst && /adjunto|attach|especificaci|specification|requerimiento|requirement|propuest|proposal/.test(custLower))
                    return 'Customer shared requirements/specs. Acknowledge receipt. Confirm you will review with the team. Do NOT invent details.';
                if (isFirst && analysis.hasImages)
                    return 'Customer sent images you cannot see. Acknowledge. Ask what the images show or offer remote session.';
                return 'Read the customer message carefully and respond to their specific request. If unclear, ask ONE specific question.';
        }
    }

    function buildUserMessage(analysis, action, similar, rc, opts) {
        var parts = [];
        var hi = opts.hi;
        var bye = opts.bye;
        var esL = opts.esL;
        var extraCtx = opts.extraCtx;
        var spLink = opts.spLink;

        var lastCustText = cleanEmailBody(analysis.lastCustText);

        var currentDraft = '';
        if (typeof document !== 'undefined') {
            var el = document.getElementById('custom-reply');
            currentDraft = el ? el.value.trim() : '';
        }

        if (extraCtx && extraCtx.length > 0) {
            if (currentDraft || (typeof window !== 'undefined' && window._aiReply)) {
                var draft = currentDraft || window._aiReply;
                parts.push('Edit my draft email. Apply the change described below.');
                parts.push('Output ONLY plain text. No markdown. No ">" blockquotes.');
                parts.push('End with "' + bye + '". Nothing after it.');
                parts.push('\n[DRAFT]\n' + draft + '\n[/DRAFT]');
                parts.push('\nChange: ' + extraCtx);
            } else {
                parts.push('INSTRUCTION: ' + extraCtx);
                parts.push('\nCUSTOMER MESSAGE:\n' + lastCustText);
            }
        } else {
            parts.push('ACTION: ' + action);
            if (analysis.isWaiting && analysis.lastAgentText) {
                parts.push('\nYOUR LAST MESSAGE:\n' + cleanEmailBody(analysis.lastAgentText));
            }
            parts.push('\nCUSTOMER MESSAGE (respond to THIS):\n' + lastCustText);
        }

        if (!extraCtx || !(currentDraft || (typeof window !== 'undefined' && window._aiReply))) {
            if (analysis.entities.serials.length) {
                parts.push('\nDetected serials: ' + analysis.entities.serials.join(', ') + ' — do NOT repeat these in your reply.');
            }

            parts.push('\nTICKET: #' + (rc.t ? rc.t.id : '') + ' ' + analysis.subject);
            parts.push('Customer: ' + (rc.firstName || 'Customer'));

            var recent = (rc.m || []).slice(-6);
            if (recent.length > 1) {
                parts.push('\nTHREAD (context only):');
                for (var i = 0; i < recent.length; i++) {
                    parts.push(recent[i].f + ': ' + cleanEmailBody(recent[i].t).substring(0, 300));
                }
            }

            if (spLink) {
                parts.push('\nSHAREPOINT: ' + spLink + ' — include this link when asking customer to upload files.');
            }

            if (rc.kbHits && rc.kbHits.length) {
                parts.push('\nVERIFIED SOLUTIONS:');
                for (var k = 0; k < rc.kbHits.length; k++) {
                    parts.push('- ' + rc.kbHits[k]);
                }
            }

            if (similar.length > 0) {
                parts.push('\n=== REAL TEAM REPLIES TO SIMILAR TICKETS (match this style exactly) ===');
                var shown = 0;
                for (var s = 0; s < similar.length && shown < 5; s++) {
                    var ex = similar[s];
                    if (ex.quality < 1.0) continue;
                    parts.push('\nCustomer: ' + ex.customer);
                    parts.push(ex.agent + ' replied: ' + ex.reply);
                    shown++;
                }
            }
        }

        parts.push('\nWrite ONLY the email. Start with "' + hi + '," end with "' + bye + '". Nothing else.');

        return parts.join('\n');
    }

    function cleanEmailBody(text) {
        if (typeof window !== 'undefined' && typeof window.cleanEmailBody === 'function') {
            return window.cleanEmailBody(text);
        }
        if (!text) return '';
        var t = text;
        t = t.replace(/<br\s*\/?>/gi, '\n');
        t = t.replace(/<\/(div|p|li|tr)>/gi, '\n');
        t = t.replace(/<[^>]+>/g, '');
        t = t.replace(/&nbsp;/g, ' ');
        t = t.replace(/&amp;/g, '&');
        t = t.replace(/&lt;/g, '<');
        t = t.replace(/&gt;/g, '>');
        t = t.replace(/&quot;/g, '"');
        t = t.replace(/\n{3,}/g, '\n\n');
        return t.trim();
    }

    function getCorrectionHints(lang, n) {
        var recent = _corrections.filter(function(x) { return x.l === lang; }).slice(-n);
        if (!recent.length) return '';
        var hints = recent.map(function(c) {
            return '\n- YOU wrote: "' + c.ai.substring(0, 120) + '..."'
                + '\n  USER changed to: "' + c.user.substring(0, 120) + '..."';
        });
        return (lang === 'es'
            ? '\n\nCORRECCIONES (el usuario editó tus respuestas — aprende):'
            : '\n\nCORRECTIONS (user edited your replies — learn):') + hints.join('');
    }

    // ═══════════════════════════════════════════
    // REPLY VALIDATOR
    // ═══════════════════════════════════════════

    function validateReply(text, analysis, rc) {
        var t = text;
        var issues = [];
        var hi = rc.hi || 'Hi';
        var bye = rc.bye || 'Best regards';
        var esL = analysis.lang === 'es';

        t = t.replace(/^>+\s?/gm, '');
        t = t.replace(/Hol[gáà][aá]?\b/g, 'Hola');
        t = t.replace(/([a-záéíóúñü])([A-Z])/g, '$1 $2');
        t = t.replace(/([a-z])([A-Z][a-z])/g, '$1 $2');
        t = t.replace(/\bHello([a-z])/gi, function(m, c) { return 'Hello ' + c; });
        t = t.replace(/\bBest([a-z])/gi, function(m, c) { return 'Best ' + c; });

        t = t.replace(/[一-鿿　-〿＀-￯぀-ゟ゠-ヿ]+[^\n]*/g, '');
        t = t.replace(/```[\s\S]*?```/g, '');
        t = t.replace(/\[(?:tiene DRM|DRM|archivo adjunto|adjunto|ver adjunto|see attached|attachment|file attached|image)[^\]]*\]/gi, '');
        t = t.replace(/\n{3,}/g, '\n\n').trim();

        if (bye === 'Saludos cordiales') {
            var slines = t.split('\n');
            for (var si = slines.length - 1; si >= 0; si--) {
                if (/sal[a-z]*\s*c?or?d?[ia]?[a-z]*l[a-z]*|salutation|un saludo|esperando\s+(?:tu|su)\s+respuesta/i.test(slines[si]) && slines[si].trim().length < 30) {
                    slines[si] = bye;
                    slines = slines.slice(0, si + 1);
                    break;
                }
            }
            t = slines.join('\n');
        }
        if (bye === 'Best regards') {
            var blines = t.split('\n');
            for (var bi = blines.length - 1; bi >= 0; bi--) {
                if (/best\s*regard[a-zςσ]*|regard[a-zςσ]*\s*$/i.test(blines[bi]) && blines[bi].trim().length < 25) {
                    blines[bi] = bye;
                    blines = blines.slice(0, bi + 1);
                    break;
                }
            }
            t = blines.join('\n');
        }

        var byeNorm = bye.replace(/\s+/g, '').toLowerCase();
        var lines = t.split('\n');
        for (var li = lines.length - 1; li >= 0; li--) {
            if (lines[li].replace(/\s+/g, '').toLowerCase().indexOf(byeNorm) !== -1) {
                lines[li] = bye;
                break;
            }
        }
        t = lines.join('\n');

        var hiIdx = t.indexOf(hi + ',');
        if (hiIdx < 0) {
            var hiIdx2 = t.indexOf(hi);
            if (hiIdx2 > 0) t = t.substring(hiIdx2);
        } else if (hiIdx > 0) {
            t = t.substring(hiIdx);
        }
        var byeIdx = t.lastIndexOf(bye);
        if (byeIdx > 0) t = t.substring(0, byeIdx + bye.length);

        t = t.replace(/\*\*/g, '').replace(/^#{1,3}\s+.*$/gm, '');
        t = t.replace(/\[Your Name.*?\]/gi, '').replace(/\[Team Name.*?\]/gi, '');
        t = t.replace(/_/g, '');

        var firstName = rc.firstName || '';
        if (firstName && t.indexOf(hi) < 0) { t = hi + ',\n\n' + t; }

        var greetWord = hi.split(' ')[0];
        var greetRx = new RegExp('^' + greetWord + '\\s+\\w+[,.]?\\s*$', 'gmi');
        var greetMatches = t.match(greetRx);
        if (greetMatches && greetMatches.length > 1) {
            for (var gi = 0; gi < greetMatches.length; gi++) {
                if (greetMatches[gi].trim() === hi + ',' || greetMatches[gi].trim() === hi + '.') continue;
                t = t.replace(greetMatches[gi], '');
            }
            greetMatches = t.match(greetRx);
            if (greetMatches && greetMatches.length > 1) {
                for (var gi2 = 1; gi2 < greetMatches.length; gi2++) { t = t.replace(greetMatches[gi2], ''); }
            }
        }
        if (t.indexOf(hi) < 0) {
            var wrongGreet = t.match(new RegExp('^' + greetWord + '\\s+\\w+[,.]', 'mi'));
            if (wrongGreet) { t = t.replace(wrongGreet[0], hi + ','); }
        }

        t = t.trim();

        if (esL) {
            t = t.replace(/\n\s*(?:Recibido|Lo verifico|Cualquier cosa)[^\n]*/g, function(m) {
                return m;
            });
        }

        t = t.replace(/\n{3,}/g, '\n\n').trim();

        var bodyCheck = t.replace(hi + ',', '').replace(bye, '').replace(/\s+/g, '');
        if (bodyCheck.length < 5) {
            t = hi + ',\n\n' + (esL ? 'Recibido, lo verifico y te confirmo.' : 'Received, let me check and confirm.') + '\n\n' + bye;
            issues.push('empty_body');
        }

        var lastCustText = analysis.lastCustText || '';
        var body = t.replace(hi + ',', '').replace(bye, '').toLowerCase().trim();
        var cw = lastCustText.toLowerCase().replace(/[^a-záéíóúñü\s]/g, '').split(/\s+/).filter(function(w) { return w.length > 4; });
        if (cw.length > 0) {
            var hits = cw.filter(function(w) { return body.indexOf(w) !== -1; }).length;
            if (hits / cw.length > 0.6) {
                t = hi + ',\n\n' + (esL ? 'Recibido, lo verifico y te confirmo.' : 'Received, let me check and confirm.') + '\n\n' + bye;
                issues.push('parrot');
            }
        }

        var serials = lastCustText.match(/[A-Z]{2,4}-[A-Z]{2,4}-\d{4,}/g);
        if (serials) {
            for (var si2 = 0; si2 < serials.length; si2++) {
                t = t.split(serials[si2]).join('');
            }
        }
        var times = lastCustText.match(/\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.)\s*(?:EST|CST|PST|ET|CT|PT|Mexico City time)?|\d{1,2}(?::\d{2})?(?:am|pm|AM|PM)/gi);
        if (times) {
            for (var ti2 = 0; ti2 < times.length; ti2++) {
                t = t.split(times[ti2]).join('');
            }
        }
        var dates = lastCustText.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?/gi);
        if (dates) {
            for (var di2 = 0; di2 < dates.length; di2++) {
                t = t.split(dates[di2]).join('');
            }
        }

        t = t.replace(/\b(?:close|keep|closing)\s+this\s+ticket\b[^.\n]*/gi, '');
        t = t.replace(/\bno dudes en\b[^.\n]*/gi, '');
        t = t.replace(/\b(?:do not|don'?t)\s+hesitate\b[^.\n]*/gi, '');
        t = t.replace(/\bif you need (?:further|any)\s+(?:assistance|help)\b[^.\n]*/gi, '');
        t = t.replace(/\bthank you for reaching out\b[^.\n]*/gi, '');
        t = t.replace(/\bcualquier duda\b[^.\n]*/gi, '');
        t = t.replace(/\bsi necesitas más apoyo\b[^.\n]*/gi, '');
        t = t.replace(/\bI hope this (?:email|message) finds\b[^.\n]*/gi, '');
        t = t.replace(/---[\s\S]*/g, '');

        t = t.replace(/\n{3,}/g, '\n\n').trim();

        var hiC = hi + ',';
        var hiPos = t.indexOf(hiC);
        if (hiPos >= 0) {
            var afterHi = hiPos + hiC.length;
            var rest = t.substring(afterHi);
            if (rest.length > 0 && rest.charAt(0) !== '\n') {
                t = t.substring(0, afterHi) + '\n\n' + rest.trimStart();
            } else if (rest.length > 1 && rest.charAt(0) === '\n' && rest.charAt(1) !== '\n') {
                t = t.substring(0, afterHi) + '\n\n' + rest.substring(1).trimStart();
            }
        }
        var byePos2 = t.lastIndexOf(bye);
        if (byePos2 > 0) {
            var before = t.substring(0, byePos2);
            if (before.length > 0 && before.charAt(before.length - 1) !== '\n') {
                t = before.trimEnd() + '\n\n' + bye;
            } else if (before.length > 1 && before.charAt(before.length - 1) === '\n' && before.charAt(before.length - 2) !== '\n') {
                t = before.substring(0, before.length - 1).trimEnd() + '\n\n' + bye;
            }
        }

        t = t.replace(/\n{3,}/g, '\n\n').trim();

        return { text: t, issues: issues };
    }

    // ═══════════════════════════════════════════
    // CORRECTION TRACKING
    // ═══════════════════════════════════════════

    function saveCorrection(aiDraft, userEdit, lang) {
        if (!aiDraft || !userEdit || aiDraft === userEdit) return;
        _corrections.push({ ai: aiDraft.substring(0, 400), user: userEdit.substring(0, 400), l: lang, d: Date.now() });
        if (_corrections.length > 50) _corrections = _corrections.slice(-50);
        try { localStorage.setItem('fd_ai_corrections', JSON.stringify(_corrections)); } catch (e) { }
    }

    // ═══════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════

    return {
        loadIndex: function() {
            return fetch('/ai_search_index.json')
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    data._termToId = {};
                    for (var i = 0; i < data.terms.length; i++) {
                        data._termToId[data.terms[i]] = i;
                    }
                    _index = data;
                    _ready = true;
                    console.log('[ai] Search index loaded: ' + data.docs.length + ' docs, ' + data.terms.length + ' terms');
                    return data;
                })
                .catch(function(err) {
                    console.warn('[ai] Failed to load search index:', err);
                    _ready = false;
                });
        },

        isReady: function() { return _ready; },

        analyze: analyzeTicket,

        search: search,

        buildPrompt: buildPrompt,

        validate: validateReply,

        saveCorrection: saveCorrection,

        generate: function(replyContext, extraCtx, spLink) {
            var rc = replyContext;
            var messages = rc.m || [];
            var analysis = analyzeTicket(messages, rc.t ? rc.t.subject : '', rc.fl || (typeof D !== 'undefined' ? D.fl : 0));
            analysis.lang = rc.lang || analysis.lang;
            if (rc.ctx && rc.ctx.isUrgent) analysis.intent = 'urgent';
            if (rc.ctx && rc.ctx.customerSentImages) analysis.hasImages = true;

            var kbHits = [];
            if (typeof matchKB === 'function' && rc.issueText) {
                var kb = matchKB(rc.issueText, (rc.ctx && rc.ctx.triedSolutions) || new Set());
                kbHits = kb.map(function(k) {
                    var txt = k[rc.lang] || k.es || k.en || '';
                    if (txt.indexOf('{SP_LINK}') >= 0) {
                        if (spLink) txt = txt.replace(/\{SP_LINK\}/g, spLink);
                        else txt = txt.replace(/\n?\{SP_LINK\}\n?/g, '');
                    }
                    return k.id + ': ' + txt;
                });
            }
            rc.kbHits = kbHits;

            var prompt = buildPrompt(analysis, rc, {
                extraCtx: extraCtx,
                spLink: spLink,
            });

            return {
                sys: prompt.sys,
                usr: prompt.usr,
                analysis: analysis,
            };
        },
    };
})();
