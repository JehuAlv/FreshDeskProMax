function cleanEmailBody(text){
    if(!text)return '';
    return text
        .replace(/--+\s*\n[\s\S]*$/,'')
        .replace(/_{3,}[\s\S]*$/,'')
        .replace(/^(De|From|Sent|Enviado|Date|Fecha|Para|To|Cc|Subject|Asunto):.*$/gm,'')
        .replace(/(Best regards|Kind regards|Regards|Saludos|Saludos cordiales|Atentamente|Cordialmente)[\s\S]*$/im,'')
        .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g,'')
        .replace(/(?:tel|phone|fax|cell|móvil|ext)[\s.:]*[\d\s\-+().]+/gi,'')
        .replace(/\s{2,}/g,' ')
        .trim();
}

function stripSignature(text){
    if(!text)return '';
    var t=text;
    t=t.replace(/(?:^|\n)\s*DISCLAIMER:[\s\S]*$/i,'');
    t=t.replace(/(?:^|\n)\s*The information contained in this message[\s\S]*$/i,'');
    t=t.replace(/(?:^|\n)\s*Legal Disclaimer[\s\S]*$/i,'');
    t=t.replace(/(?:^|\n)\s*Confidentiality Notice[\s\S]*$/i,'');
    t=t.replace(/(?:^|\n)\s*(?:Koh Young (?:America|Technology)|1950 Evergreen|Plaza Concentro)[\s\S]*$/i,'');
    t=t.replace(/(?:^|\n)\s*(?:Applications? (?:Leader|Engineer|Manager)|MES (?:Developer|Leader|Engineer)|Global MES|Software Developer|Support Engineer|Field Service)[\s\S]*$/im,'');
    t=t.replace(/(?:^|\n)\s*(?:Mobile|Phone|Cell|Tel|Support|Website)\s*:[\s\S]*$/im,'');
    t=t.replace(/(?:^|\n)\s*www\.koh[\s\S]*$/i,'');
    return t.trim();
}

var _esWordRe=/\b(gracias|por favor|adjunto|problema|máquina|equipo|archivo|enviamos|le comparto|comentar|necesito|tenemos|podría|podemos|favor de|muchas gracias|de antemano|solicitud|actualización|instalación|calibración|verificar|configuración|revisamos|pendiente|sesión|remota|disponibilidad|horario|versión|compartir|funciona|sirve|errores|pregunta|requiere|soporte|también|correo|información|sistema|estamos|programa|proceso|datos|cambios|nuevo|nueva|buenos|buenas|quiero|cuando|donde|como|aquí|esto|puede|favor|cuál|alguna|todas|nuestro|nuestra|estoy|tengo|hemos|mediante|durante|obtener|acudimos|evaluar|logramos|detectado|disponible|requerimientos|múltiples|actualmente|encontramos|trabajando|integración)\b/gi;
var _enWordRe=/\b(thank you|thanks|please|attached|issue|machine|review|kindly|appreciate|follow up|looking forward|availability|schedule|screenshot|resolve|investigate|working|update|install|check|would|could|should|configuration|export|regarding|requested|assistance|forwarding|unfortunately|currently|however|actually|already)\b/gi;

function detectLang(m,subject){
    const custRaw=m.filter(x=>x.f==='Customer').map(x=>stripSignature(cleanEmailBody(x.t)));
    const agentRaw=m.filter(x=>x.f==='Agent').map(x=>cleanEmailBody(x.t));
    const lastCust=custRaw.length?custRaw[custRaw.length-1]:'';
    const trimmed=lastCust.trim();
    if(/^(hola|buenos?\s*d[ií]as?|buen d[ií]a|estimad|que tal|saludos)/i.test(trimmed))return 'es';
    if(/^(hi\b|hello|good\s*(morning|afternoon|evening)|dear|hey\b)/i.test(trimmed))return 'en';

    const lastAgent=agentRaw.length?agentRaw[agentRaw.length-1]:'';
    if(lastAgent){
        const aLow=lastAgent.toLowerCase();
        if(/^(hola|que tal|buen)/i.test(aLow.trim())||/saludos cordiales/i.test(aLow))return 'es';
        if(/^(hi\b|hello|hey\b)/i.test(aLow.trim())||/best regards/i.test(aLow))return 'en';
    }

    const custAll=custRaw.join(' ').toLowerCase();
    const all=trimmed.length>20?trimmed.toLowerCase():(custAll||((subject||'')).toLowerCase());
    const esWords=(all.match(_esWordRe)||[]).length;
    const enWords=(all.match(_enWordRe)||[]).length;

    if(esWords===0&&enWords===0){
        const esChars=(all.match(/[áéíóúüñ¿¡]/g)||[]).length;
        if(esChars>=1)return 'es';

        if(custAll.length<30&&subject){
            const subLow=subject.toLowerCase();
            const subEs=(subLow.match(/[áéíóúüñ¿¡]|solicitud|problema|falla|configuración|instalación|máquina|equipo/g)||[]).length;
            if(subEs>=1)return 'es';
        }
    }
    return esWords>enWords?'es':'en';
}

function analyzeAgentStyle(m){
    const agentMsgs=m.filter(x=>x.f==='Agent');
    if(!agentMsgs.length)return{greeting:'',signoff:'',usesName:false,formal:true,phrases:[]};

    const texts=agentMsgs.map(x=>x.t);
    const all=texts.join('\n');

    let greeting='';
    const greetPatterns=[
        /^(Hola\s+[\w]+)/m,/^(Buenos?\s+(?:días?|tardes?|noches?)[\s,]*[\w]*)/mi,
        /^(Estimado\/a?\s+[\w]+)/mi,/^(Buen día[\s,]*[\w]*)/mi,
        /^(Hi\s+[\w]+)/m,/^(Hello\s+[\w]+)/m,/^(Dear\s+[\w]+)/m
    ];
    for(const rx of greetPatterns){
        const match=all.match(rx);
        if(match){greeting=match[1];break}
    }

    let signoff='';
    const signPatterns=[
        /(Saludos\.?)\s*$/mi,/(Quedo al pendiente\.?)\s*$/mi,/(Quedamos al pendiente\.?)\s*$/mi,
        /(Saludos cordiales\.?)\s*$/mi,/(Quedo atento\.?)\s*$/mi,
        /(Best regards\.?)\s*$/mi,/(Kind regards\.?)\s*$/mi,/(Regards\.?)\s*$/mi
    ];
    for(const rx of signPatterns){
        const match=all.match(rx);
        if(match){signoff=match[1].replace(/\.$/,'');break}
    }

    const phrases=[];
    const phraseRx=[
        /quedo al pendiente/gi,/quedo atento/gi,/quedamos al pendiente/gi,
        /le comparto/gi,/le comento/gi,/me permito/gi,/por este medio/gi,
        /de antemano/gi,/buen día/gi,/favor de/gi,
        /let me know/gi,/looking forward/gi,/please find attached/gi,
        /I will review/gi,/I will get back/gi
    ];
    phraseRx.forEach(rx=>{
        const matches=all.match(rx);
        if(matches&&matches.length>=1)phrases.push(matches[0]);
    });

    const usesName=!!all.match(/^(Hola|Hi|Hello|Dear|Estimad)\s+[A-Z]/m);
    const formal=!!all.match(/(estimad|cordial|atento|de antemano|kindly|dear)/i);

    return{greeting,signoff,usesName,formal,phrases};
}

function detectIntent(text){
    const t=text.toLowerCase();
    if(/(?:compartir|enviar|mandar|proporcionar|facilitar|share|send|provide|deliver)\s*(?:la |el |los |las |the |a |an )?(?:versión|version|software|kbr|archivo|file|licen|update|actualiz)/i.test(t))
        return 'request_delivery';
    if(/(?:necesit|requie|ocupo|need|require|want|looking for)\s/i.test(t)&&/(?:versión|version|software|kbr|archivo|file|licen|update|actualiz|nueva?o?|new|latest)/i.test(t))
        return 'request_delivery';
    if(/(?:actualizar|upgrade|update|instalar nueva|install new|migrar|migrate)/i.test(t))
        return 'request_update';
    if(/(?:cotiza|quot|precio|price|cost|purchase|compra|adquirir|buy)/i.test(t))
        return 'request_quote';
    if(/(?:agendar|schedul|programar|coordinar|disponib|availab|sesión|session|reunión|meeting|call)/i.test(t))
        return 'request_schedule';
    if(/(?:error|crash|exception|fail|broken|not.work|falla|no funciona|no sirve|se cayó|problema|issue|problem|bug)/i.test(t))
        return 'report_error';
    if(/(?:línea|line|producción|production).*(down|stop|parad|detenid|caíd|halt|urgent|crítico|critical)/i.test(t))
        return 'report_urgent';
    if(/(?:cómo|how|dónde|where|qué es|what is|cuál|which|puedo|can i|se puede|is it possible)/i.test(t))
        return 'ask_question';
    if(/(?:confirmo|confirm|listo|ready|done|ya (?:quedó|está|instalé|cargué)|installed|completed)/i.test(t))
        return 'confirm_done';
    if(/(?:gracia|thank|resolved|resuelto|funciona|works|solucion)/i.test(t))
        return 'confirm_resolved';
    return 'general';
}

function extractContext(allLow,m,lastCust,lastAgent){
    const isError=!!allLow.match(/error|crash|exception|fail|broken|not.work|issue|problem|falla|no funciona|no sirve|se cayó|problema/i);
    const isTechnical=!!allLow.match(/error|crash|config|install|brm|kbr|socket|database|inspect|calibrat|export|barcode|defect|spi|aoi|instalación|configuración|calibración|máquina/i);
    const isBRM=!!allLow.match(/brm|kbr|business.rule|script|customer.?property/i);
    const isInspection=!!allLow.match(/inspect|defect|barcode|pcb|spi|aoi|result|inspección|defecto|resultado/i);
    const isQuote=!!allLow.match(/quote|quotat|price|cost|purchase|po\b|cotizac|precio|costo|compra|part.?number|número de parte|spare.?part|refacción|refacciones/i);
    const isScheduling=!!allLow.match(/schedul|meeting|call|appointment|availab|agendar|reunión|cita|disponibilidad|horario|junta/i);
    const hadRemoteSession=!!allLow.match(/teamviewer|remote.session|anydesk|tv.id|connected.remote|during.*(session|remote)|sesión remota|nos conectamos|conecté remotamente/i);
    const hasScreenshot=!!allLow.match(/screenshot|screen.?shot|image|picture|attached.*png|attached.*jpg|captura|imagen|adjunt.*png|adjunt.*jpg/i);
    const customerSentImages=!!(allLow.match(/\[cid:image|\[cid:.*\.png|\[cid:.*\.jpg|<img|\.png|\.jpg|\.jpeg|\.gif|screenshot|captura|imagen adjunt|attached.*image|adjunto.*imagen|here.*screenshot|adjunto.*captura/i));
    const hasLogs=!!allLow.match(/log.file|logs|attached.*log|error.log|archivo.*log|logs adjunt/i);
    const hasVersion=!!allLow.match(/version|v\d+\.\d+|brm.\d|versión/i);
    const hasSteps=!!allLow.match(/step|reproduce|when.i|happens.when|to.reproduce|paso|reproducir|cuando.hago|ocurre.cuando/i);

    let mainIssue='';
    const issuePatterns=[
        [/error.{0,30}([\w\s]{5,40})/i,'error'],
        [/issue.{0,10}with.{0,5}([\w\s]{5,40})/i,'issue with'],
        [/problem.{0,10}with.{0,5}([\w\s]{5,40})/i,'problem with'],
        [/([\w\s]{3,20})\s*(not working|is broken|crashed|fails)/i,'failure'],
        [/([\w\s]{3,20})\s*error/i,'error'],
        [/problema.{0,10}con.{0,5}([\w\sáéíóúñ]{5,40})/i,'problema con'],
        [/falla.{0,10}en.{0,5}([\w\sáéíóúñ]{5,40})/i,'falla en'],
        [/([\w\sáéíóúñ]{3,20})\s*(no funciona|no sirve|se cayó|falla)/i,'falla']
    ];
    for(const[rx]of issuePatterns){
        const match=allLow.match(rx);
        if(match){mainIssue=match[1].trim().replace(/\s+/g,' ').substring(0,40);break}
    }
    if(!mainIssue&&isBRM)mainIssue='BRM configuration';
    if(!mainIssue&&isInspection)mainIssue='inspection results';

    let wasScheduling=false;
    if(lastAgent){
        const at=lastAgent.t.toLowerCase();
        wasScheduling=!!at.match(/schedul|teamviewer|remote|availab|session|agendar|sesión|remota|disponib/i);
    }

    let pendingAction='';
    if(lastAgent){
        const at=lastAgent.t.toLowerCase();
        if(at.match(/i will|we will|going to|plan to|voy a|vamos a|estaré|revisaré|le enviaré|procederé/)){
            const pm=lastAgent.t.match(/[Ii] will ([^.!?\n]{10,60})/)||lastAgent.t.match(/[Ww]e will ([^.!?\n]{10,60})/)||
                lastAgent.t.match(/[Vv]oy a ([^.!?\n]{10,60})/)||lastAgent.t.match(/[Rr]evisaré ([^.!?\n]{10,60})/)||
                lastAgent.t.match(/[Ll]e enviaré ([^.!?\n]{10,60})/);
            if(pm)pendingAction=pm[1].trim();
        }
    }

    const isUrgent=!!allLow.match(/urgent|asap|critical|line.*(down|stop)|producti.*(stop|down|halt)|urgente|crítico|línea.*(parada|detenida|caída)|producción.*(parada|detenida)/i);

    const triedSolutions=findTriedSolutions(m);

    let agentAskedFor='';
    if(lastAgent){
        const at=lastAgent.t.toLowerCase();
        if(at.match(/log|registr/i))agentAskedFor='logs';
        else if(at.match(/screenshot|captura|imagen/i))agentAskedFor='screenshots';
        else if(at.match(/teamviewer|remote|remota|credencial/i))agentAskedFor='remote';
        else if(at.match(/version|versión/i))agentAskedFor='version';
        else if(at.match(/instalar|install|load.*kbr|cargar.*kbr/i))agentAskedFor='install';
    }

    let customerProvided='';
    if(lastCust){
        const ct=lastCust.t.toLowerCase();
        if(ct.match(/attach|adjunto|here.*(is|are)|aquí.*está|te.*(comparto|envío|mando)/i)){
            if(ct.match(/log|registr/i))customerProvided='logs';
            else if(ct.match(/screenshot|captura|imagen/i))customerProvided='screenshots';
            else customerProvided='files';
        }
        if(ct.match(/teamviewer|tv.*id|anydesk|\d{3,}.*\d{3,}/i))customerProvided='remote_credentials';
        if(ct.match(/(done|install|complet|listo|instalado|ya.*cargué|loaded)/i))customerProvided='installed';
    }

    return{isError,isTechnical,isBRM,isInspection,isQuote,isScheduling,hadRemoteSession,
        hasScreenshot,hasLogs,hasVersion,hasSteps,mainIssue,wasScheduling,pendingAction,
        isUrgent,triedSolutions,agentAskedFor,customerProvided,customerSentImages};
}
