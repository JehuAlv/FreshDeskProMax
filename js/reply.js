function buildIntentReply(intent,ctx,issueLow,kbHits,hi,bye,lang,l,firstName){
    const topic=ctx.mainIssue||'';
    const topicLabel=topic||(lang==='es'?'su solicitud':'your request');

    const replies={
        request_delivery:{
            es:{nm:'Envío de '+topicLabel,
                why:'Cliente solicita que le envíen: "'+topicLabel+'"',
                body:hi+',\n\n'+'Revisaré cuál es la última versión disponible de '+topicLabel+' y te la compartiré por este medio en cuanto la tenga lista.'+'\n\n'+bye},
            en:{nm:'Deliver '+topicLabel,
                why:'Customer requests delivery of: "'+topicLabel+'"',
                body:hi+',\n\n'+'I will check the latest version available for '+topicLabel+' and share it with you through this channel as soon as it is ready.'+'\n\n'+bye}
        },
        request_update:{
            es:{nm:'Actualización de '+topicLabel,
                why:'Cliente solicita actualización: "'+topicLabel+'"',
                body:hi+',\n\n'+'Revisaré cuál es la última versión disponible y realizaremos la actualización. En cuanto el nuevo software esté listo lo compartiremos por aquí.\n\n¿Me podrías confirmar la versión actual que están corriendo?'+'\n\n'+bye},
            en:{nm:'Update '+topicLabel,
                why:'Customer requests update for: "'+topicLabel+'"',
                body:hi+',\n\n'+'I will check which is the latest version available and perform the upgrade. As soon as the new software is ready we will share it here.\n\nCould you confirm the current version you are running?'+'\n\n'+bye}
        },
        request_quote:{
            es:{nm:'Cotización',
                why:'Cliente solicita cotización',
                body:hi+',\n\n'+l.prepareQuote+'\n\n'+bye},
            en:{nm:'Quotation',
                why:'Customer requests quotation',
                body:hi+',\n\n'+l.prepareQuote+'\n\n'+bye}
        },
        request_schedule:{
            es:{nm:'Agendar sesión',
                why:'Cliente quiere agendar sesión/reunión',
                body:hi+',\n\n'+'Claro, agendemos la sesión. ¿Me podrías compartir tu disponibilidad de horario y las credenciales de TeamViewer?'+'\n\n'+bye},
            en:{nm:'Schedule session',
                why:'Customer wants to schedule session/meeting',
                body:hi+',\n\n'+'Sure, let us schedule the session. Could you share your availability and the TeamViewer credentials?'+'\n\n'+bye}
        },
        report_urgent:{
            es:{nm:'Urgente — sesión remota',
                why:'Línea detenida / problema crítico reportado',
                body:hi+',\n\n'+KB.find(k=>k.id==='remoteUrgent').es+'\n\n'+bye},
            en:{nm:'Urgent — remote session',
                why:'Line down / critical issue reported',
                body:hi+',\n\n'+KB.find(k=>k.id==='remoteUrgent').en+'\n\n'+bye}
        },
        report_error:{
            es:{nm:'Diagnóstico de error',
                why:'Cliente reporta error/problema con '+topicLabel,
                body:hi+',\n\n'+
                    (kbHits.length?kbHits[0].es:
                    'Para comprender mejor el problema'+(topic?' con '+topic:'')+', ¿nos podrías compartir los registros de BRM siguiendo las instrucciones del manual adjunto?\n\nSi es posible, también incluye capturas de pantalla del error.')+
                    '\n\n'+bye},
            en:{nm:'Error diagnosis',
                why:'Customer reports error/issue with '+topicLabel,
                body:hi+',\n\n'+
                    (kbHits.length?kbHits[0].en:
                    'To better understand the issue'+(topic?' with '+topic:'')+', could you please share the BRM logs following the instructions in the attached manual?\n\nIf possible, please also include screenshots of the error.')+
                    '\n\n'+bye}
        },
        ask_question:{
            es:{nm:'Responder consulta',
                why:'Cliente hace pregunta sobre '+topicLabel,
                body:hi+',\n\n'+(kbHits.length?kbHits[0].es:'Respecto a tu consulta'+(topic?' sobre '+topic:'')+', [tu respuesta aquí].')+'\n\n'+bye},
            en:{nm:'Answer question',
                why:'Customer asks about '+topicLabel,
                body:hi+',\n\n'+(kbHits.length?kbHits[0].en:'Regarding your question'+(topic?' about '+topic:'')+', [your answer here].')+'\n\n'+bye}
        },
        confirm_done:{
            es:{nm:'Confirmar instalación',
                why:'Cliente confirma que completó acción',
                body:hi+',\n\n'+'Gracias por confirmar. ¿Todo quedó funcionando correctamente? Si notas algún problema, avísanos.'+'\n\n'+bye},
            en:{nm:'Confirm completion',
                why:'Customer confirms completed action',
                body:hi+',\n\n'+'Thank you for confirming. Is everything working correctly? If you notice any issues, let us know.'+'\n\n'+bye}
        },
        confirm_resolved:{
            es:{nm:'Cerrar ticket',
                why:'Cliente confirma que se resolvió',
                body:hi+',\n\n'+'Me da gusto saber que todo está funcionando. Procederé a cerrar este ticket. Si necesitas asistencia adicional, no dudes en contactarnos.'+'\n\n'+bye},
            en:{nm:'Close ticket',
                why:'Customer confirms resolution',
                body:hi+',\n\n'+'Great to hear everything is working. I will proceed to close this ticket. If you need further assistance, do not hesitate to reach out.'+'\n\n'+bye}
        }
    };

    const r=replies[intent];
    if(!r)return null;
    return r[lang]||r.en;
}


function toggleCtxMsg(idx){
    var data=window._ctxMsgs&&window._ctxMsgs[idx];
    if(!data)return;
    var el=document.getElementById('ctx-msg-'+idx);
    var hint=document.getElementById('ctx-hint-'+idx);
    if(!el)return;
    data.expanded=!data.expanded;
    el.textContent=data.expanded?data.full:data.short;
    if(hint)hint.textContent=data.expanded?'click to collapse':'click to expand';
}

function replyHTML(t,c){
    const m=memoMsgs(t,c),a=memoAna(t,c);
    const nm=t.requester?t.requester.name:'Customer';
    const reqFirst=(nm.split(' ')[0]||nm);
    const allCust=m.filter(x=>x.f==='Customer');
    const allAgent=m.filter(x=>x.f==='Agent');
    const lastWho=allCust.length?allCust[allCust.length-1].who:null;
    const firstName=(lastWho&&lastWho!==nm)?lastWho.split(' ')[0]:reqFirst;
    const subj=t.subject||'your request';
    const lastCust=allCust.length?allCust[allCust.length-1]:null;
    const lastAgent=allAgent.length?allAgent[allAgent.length-1]:null;
    const firstCust=allCust.length?allCust[0]:null;
    const cleanCust=allCust.map(x=>cleanEmailBody(x.t)).join(' ');
    const allText=m.map(x=>x.t).join(' ');
    const allTextLow=(allText+' '+(t.subject||'')).toLowerCase();
    const cleanTextLow=((t.subject||'')+' '+cleanCust).toLowerCase();

    const lang=window._langOverride||detectLang(m,t.subject);
    const sty=analyzeAgentStyle(m);
    const ctx=extractContext(cleanTextLow,m,lastCust,lastAgent);

    const hi=sty.greeting?sty.greeting.replace(/[\w]+$/,firstName):
        (lang==='es'?'Hola '+firstName:'Hello '+firstName);
    const bye=sty.signoff?sty.signoff:
        (lang==='es'?'Saludos cordiales':'Best regards');

    const spLink=getSPLink(t.id);
    const spEs=spLink?'\n\nPor favor sube los archivos al siguiente folder de SharePoint:\n'+spLink:'';
    const spEn=spLink?'\n\nPlease upload the files to the following SharePoint folder:\n'+spLink:'';
    const L={
        es:{
            thankReach:'',
            reviewed:'',
            toInvestigate:'Para poder investigar el problema, ¿nos podrías compartir la siguiente información?\n1. Issue report de BRM (menú Help > Issue Report)\n2. Versión de KBR y BRM que están corriendo\n3. Capturas de pantalla del error (si aplica)'+spEs,
            screenshots:'Capturas de pantalla del error',
            logFiles:'Archivos de log de BRM',
            swVersion:'Versión de KBR que están corriendo',
            stepsRepro:'Pasos para reproducir el problema',
            helpIdRoot:'',
            scheduleSession:'¿Me puedes compartir las credenciales para la sesión remota por favor?',
            prepareQuote:'Prepararé la cotización y se la enviaré a la brevedad.',
            willLookInto:'Revisaré el tema y te daré seguimiento.',
            remoteWouldHelp:'Para comprender mejor el problema, una sesión remota vía TeamViewer sería lo más eficiente. ¿Me podrías compartir las credenciales para conectarnos?',
            pleaseTV:'Por favor:\n1. Tener TeamViewer instalado y listo\n2. Compartir el ID y contraseña',
            gladResolved:'Me da gusto saber que'+(ctx.mainIssue?' el tema con '+ctx.mainIssue:' todo está funcionando')+'. Gracias por confirmar.',
            afterRemote:'Después de nuestra sesión remota y los cambios realizados, por favor ',
            letUsKnow:'avísenos si presenta algún problema adicional. Procederé a cerrar este ticket.',
            thankConfirm:'Gracias por confirmar. Agendemos la sesión remota',
            shareDateTime:' — por favor comparta su fecha y hora preferida',
            beforeConnect:'Antes de conectarnos, por favor:\n1. Tener TeamViewer instalado y corriendo\n2. Compartir el ID y contraseña de TeamViewer\n3. '+(ctx.isError?'De ser posible, mantener el error visible en pantalla':'Tener BRM abierto y listo'),
            thankSharing:'Gracias por compartir ',
            theScreenshots:'las capturas',
            theLogFiles:'los logs',
            theInfo:'la información',
            willReview:'Revisaré ',
            them:'lo enviado',
            this_:'esto',
            getBackFindings:' y te daré seguimiento.',
            ifNoticeMore:'Si notas algún detalle adicional sobre cuándo ocurre el problema, compártelo también.',
            regQuestion:'Respecto a su consulta'+(ctx.mainIssue?' sobre '+ctx.mainIssue:'')+', estos son los pasos:',
            step:'Paso',
            backupFirst:'Por favor asegúrese de respaldar su KBR/configuración actual antes de hacer cambios.',
            questionsProcess:'Avíseme si tiene alguna duda durante el proceso.',
            persisting:' que el problema persiste',
            additionalIssue:' sobre este problema adicional',
            understandFrustrating:'Una disculpa por las molestias, revisaré esto a detalle.',
            importantRightAway:'Lo revisaré de inmediato.',
            anotherRemote:'¿Estarías disponible para otra sesión remota y revisamos esto directamente?',
            shareNewErrors:'¿Me podrías compartir capturas o los logs de BRM? Una sesión remota también nos ayudaría.',
            willReviewDetails:'Revisaré los detalles y te doy seguimiento.',
            thankMessage:'',
            thankConfirming:'Gracias por confirmar. ',
            regYourQuestion:'Respecto a tu pregunta — [tu respuesta aquí].',
            investigating:'Estoy revisando el tema de '+ctx.mainIssue+' y ',
            willReviewShared:'revisaré lo que compartiste y ',
            getBackShortly:'te doy seguimiento a la brevedad.',
            asDiscussed:'Como comentamos, ',
            followUp:'Quería dar seguimiento a '+subj+'. ',
            noResponseClose:'Como no hemos recibido respuesta, procederé a cerrar este caso en los próximos días. Si aún necesitas asistencia, responde y lo reabrimos.',
            chanceReview:'¿Tuviste oportunidad de revisar mi último mensaje? Te preguntaba sobre ',
            letMeKnowContinue:'Avísame para poder continuar ayudándote.',
            chanceInstall:'¿Tuviste oportunidad de instalar/revisar los archivos enviados? Avísame si tuviste algún problema.',
            stillAvailRemote:'¿Sigues disponible para la sesión remota? Compárteme tu fecha y hora preferida.',
            furtherAssistance:'Avísame si necesitas asistencia adicional o si el problema se resolvió.',
            postSessionSummary:'Después de nuestra sesión remota respecto a '+subj+', este es el resumen:',
            actionsTaken:'Acciones realizadas:',
            describeActions:'[Describir lo realizado]',
            brmChanges:'[Cambios de BRM/KBR realizados]',
            pendingItems:'Pendientes:',
            ifAny:'[Si los hay]',
            monitorSystem:'Por favor monitoree '+(ctx.isInspection?'los resultados de inspección':'el sistema')+' y avísenos si todo funciona correctamente.',
            deliverKBR:'Adjunto encontrará el KBR actualizado para '+subj+'.',
            addressesIssue:'Esta actualización atiende el tema de '+ctx.mainIssue+' que comentamos.',
            toInstall:'Para instalar:\n1. Abrir BRM\n2. File > Load KBR\n3. Seleccionar el archivo .kbr adjunto\n4. Verificar la configuración',
            needRemoteHelp:'Avíseme si necesita asistencia remota durante la instalación.',
            quoteFor:'Adjunto encontrará la cotización para '+subj+':',
            quoteDetails:'[Detalles de cotización]',
            validDays:'Esta cotización tiene vigencia de 30 días. Avíseme si desea proceder.',
            gladConfirm:'Me da gusto confirmar que '+(ctx.mainIssue?'el tema de '+ctx.mainIssue:'el problema reportado en este ticket')+' ha sido resuelto.',
            thankRemoteTime:'Gracias por su tiempo durante nuestra sesión remota.',
            willClose:'Procederé a cerrar este ticket. Si necesita asistencia adicional, no dude en contactarnos.',
            suggestRemote:'Después de revisar la conversación sobre '+subj+', considero que una sesión remota vía TeamViewer nos ayudaría a resolver esto de forma más eficiente'+(ctx.isError?' y poder ver el error directamente':'')+'.',
            availableSession:'¿Estaría disponible para una sesión? Por favor comparta sus horarios preferidos.',
            firstResponse:'Primera Respuesta',
            schedRemote:'Agendar Sesión Remota',
            confirmResolution:'Confirmar Resolución',
            confirmRemote:'Confirmar Sesión Remota',
            ackInfo:'Información Recibida',
            provideInstructions:'Dar Instrucciones',
            ackNewIssue:'Problema Nuevo/Recurrente',
            replyCustomer:'Responder al Cliente',
            suggestRemoteNm:'Sugerir Sesión Remota',
            followUpNm:'Seguimiento',
            finalFollowUp:'Seguimiento Final',
            postSession:'Resumen Post-Sesión',
            deliverKBRNm:'Entregar KBR',
            sendQuote:'Enviar Cotización',
            closeTicket:'Resuelto — Cerrar Ticket'
        },
        en:{
            thankReach:'Thank you for reaching out regarding '+subj+'.',
            reviewed:'I have reviewed your message',
            toInvestigate:'To investigate this issue, could you please provide the following?\n1. BRM Issue Report (menu Help > Issue Report)\n2. Current KBR and BRM version\n3. Screenshots of the error (if applicable)'+spEn,
            screenshots:'Screenshots of the error',
            logFiles:'Relevant log files',
            swVersion:'Current software/BRM version',
            stepsRepro:'Steps to reproduce the issue',
            helpIdRoot:'This will help me identify the root cause faster.',
            scheduleSession:'I would be happy to schedule a session to address this. Could you please share your availability for the coming days?',
            prepareQuote:'I will prepare the quotation and send it to you shortly.',
            willLookInto:'I have reviewed your message and will look into this right away. I will get back to you with an update soon.',
            remoteWouldHelp:'After reviewing your report about '+subj+', I believe a remote session via TeamViewer would be the most efficient approach to '+(ctx.isError?'diagnose and resolve this error':'address this issue')+'.',
            pleaseTV:'Could you please:\n1. Share your availability for the coming days\n2. Have TeamViewer installed and ready\n3. Share the ID and password when we connect',
            gladResolved:'Great to hear that'+(ctx.mainIssue?' the issue with '+ctx.mainIssue:' things are working')+'. Thank you for confirming.',
            afterRemote:'Following our remote session and the changes we made, please ',
            letUsKnow:'let us know if you experience any further issues. I will proceed to close this ticket.',
            thankConfirm:'Thank you for confirming. Let us schedule the remote session',
            shareDateTime:' — please share your preferred date and time',
            beforeConnect:'Before we connect, please:\n1. Have TeamViewer installed and running\n2. Share the TeamViewer ID and password\n3. '+(ctx.isError?'Keep the error/issue visible on screen if possible':'Have BRM open and ready'),
            thankSharing:'Thank you for sharing ',
            theScreenshots:'the screenshots',
            theLogFiles:'the log files',
            theInfo:'the information',
            willReview:'I will review ',
            them:'them',
            this_:'this',
            getBackFindings:' and get back to you with my findings.',
            ifNoticeMore:'If you notice any additional details about when or how the issue occurs, please let me know as well.',
            regQuestion:'Regarding your question'+(ctx.mainIssue?' about '+ctx.mainIssue:'')+', here are the steps:',
            step:'Step',
            backupFirst:'Please make sure to backup your current KBR/configuration before making changes.',
            questionsProcess:'Let me know if you have any questions during the process.',
            persisting:' that the issue is persisting',
            additionalIssue:' about this additional issue',
            understandFrustrating:'I understand this is frustrating — let me investigate further.',
            importantRightAway:'This is important and I will look into it right away.',
            anotherRemote:'Since we already had a remote session, would you be available for another one to investigate this further?',
            shareNewErrors:'Could you please share any new error messages or screenshots? A remote session may also help us resolve this faster.',
            willReviewDetails:'I will review the details and get back to you with an update.',
            thankMessage:'Thank you for your message. ',
            thankConfirming:'Thank you for confirming. ',
            regYourQuestion:'Regarding your question — [your answer here].',
            investigating:'I am investigating the '+ctx.mainIssue+' issue and ',
            willReviewShared:'review what you shared and ',
            getBackShortly:'will get back to you shortly.',
            asDiscussed:'As discussed, ',
            followUp:'I wanted to follow up on '+subj+'. ',
            noResponseClose:'As we have not heard back in a while, I will proceed to close this case in the next few days. If you still need assistance, please reply and I will reopen it.',
            chanceReview:'Have you had a chance to review my last message? I was asking about ',
            letMeKnowContinue:'Please let me know so I can continue helping you.',
            chanceInstall:'Have you had a chance to install/review the files I sent? Please let me know if you ran into any issues or need help with the process.',
            stillAvailRemote:'Are you still available for the remote session? Please share your preferred date and time, and I will make sure to accommodate.',
            furtherAssistance:'Please let me know if you need any further assistance or if the issue has been resolved.',
            postSessionSummary:'Following our remote session regarding '+subj+', here is a summary:',
            actionsTaken:'Actions taken:',
            describeActions:'[Describe what was done]',
            brmChanges:'[BRM/KBR changes made]',
            pendingItems:'Pending items:',
            ifAny:'[If any]',
            monitorSystem:'Please monitor '+(ctx.isInspection?'the inspection results':'the system')+' and let us know if everything is working as expected.',
            deliverKBR:'Please find attached the updated KBR for '+subj+'.',
            addressesIssue:'This update addresses the '+ctx.mainIssue+' issue we discussed.',
            toInstall:'To install:\n1. Open BRM\n2. File > Load KBR\n3. Select the attached .kbr file\n4. Verify the configuration',
            needRemoteHelp:'Let me know if you need remote assistance during the installation.',
            quoteFor:'Please find below the quotation for '+subj+':',
            quoteDetails:'[Quotation details]',
            validDays:'This quotation is valid for 30 days. Please let me know if you would like to proceed.',
            gladConfirm:'I am glad to confirm that '+(ctx.mainIssue?'the '+ctx.mainIssue+' issue':'the issue reported in this ticket')+' has been resolved.',
            thankRemoteTime:'Thank you for your time during our remote session.',
            willClose:'I will proceed to close this ticket. If you need further assistance, do not hesitate to reach out.',
            suggestRemote:'After reviewing the conversation about '+subj+', I think a remote session via TeamViewer would help us resolve this more efficiently'+(ctx.isError?' and let me see the error firsthand':'')+'.',
            availableSession:'Would you be available for a session? Please share your preferred times.',
            firstResponse:'First Response',
            schedRemote:'Schedule Remote Session',
            confirmResolution:'Confirm Resolution',
            confirmRemote:'Confirm Remote Session',
            ackInfo:'Acknowledge Info',
            provideInstructions:'Provide Instructions',
            ackNewIssue:'New/Recurring Issue',
            replyCustomer:'Reply to Customer',
            suggestRemoteNm:'Suggest Remote Session',
            followUpNm:'Follow-up',
            finalFollowUp:'Final Follow-up',
            postSession:'Post-Session Summary',
            deliverKBRNm:'Deliver KBR',
            sendQuote:'Send Quotation',
            closeTicket:'Resolved — Close Ticket'
        }
    };
    const l=L[lang];
    const gRec=lang==='es'?'Recomendado':'Recommended Now';
    const gAlt=lang==='es'?'Alternativa':'Alternative';
    const gAfter=lang==='es'?'Post-Sesión':'After Session';
    const gDeliv=lang==='es'?'Entregable':'Deliverable';
    const gClose=lang==='es'?'Cerrar':'Close';

    const R=[];

    const issueText=(t.subject||'')+'  '+(firstCust?cleanEmailBody(firstCust.t):'');
    const issueLow=issueText.toLowerCase();
    const intent=detectIntent(issueLow);

    if(a.sit==='new'){
        const kbHits=matchKB(issueText,new Set());
        const intentBody=buildIntentReply(intent,ctx,issueLow,kbHits,hi,bye,lang,l,firstName);

        if(intentBody){
            R.push({g:gRec,nm:intentBody.nm,
                why:intentBody.why,
                body:intentBody.body});
        }

        if(kbHits.length&&!intentBody){
            kbHits.slice(0,2).forEach(kb=>{
                let kbBody=kb[lang];
                if(kbBody.includes('{SP_LINK}')){
                    if(spLink)kbBody=kbBody.replace(/\{SP_LINK\}/g,spLink);
                    else kbBody=kbBody.replace(/\n?\{SP_LINK\}\n?/g,'');
                }
                R.push({g:gRec,nm:l.firstResponse,
                    why:(lang==='es'?'Detectado: ':'Detected: ')+kb.id+' → "'+ trunc(issueText,100)+'"',
                    body:hi+',\n\n'+kbBody+'\n\n'+bye});
            });
        }

        if(!intentBody&&!kbHits.length){
            const needsInfo=!ctx.hasScreenshot&&!ctx.hasLogs&&(ctx.isError||ctx.isTechnical);
            R.push({g:gRec,nm:l.firstResponse,
                why:(lang==='es'?'Cliente reportó: "':'Customer reported: "')+trunc(issueText,120)+'"',
                body:hi+',\n\n'+
                (ctx.isUrgent?KB.find(k=>k.id==='remoteUrgent')[lang]:
                needsInfo?l.toInvestigate:
                ctx.isScheduling?l.scheduleSession:
                ctx.isQuote?l.prepareQuote:
                l.willLookInto)+
                '\n\n'+bye});
        }

        if(ctx.isTechnical)
            R.push({g:gAlt,nm:l.schedRemote,
                why:(lang==='es'?'Tema técnico sobre ':'Technical issue about ')+ctx.mainIssue+(lang==='es'?' — remoto es más rápido':' — remote is faster'),
                body:hi+',\n\n'+l.remoteWouldHelp+'\n\n'+l.pleaseTV+'\n\n'+bye});
    }

    if(a.sit==='respond'){
        const custText=lastCust?lastCust.t:'';
        const custLow=custText.toLowerCase();
        const hasQ=custText.match(/\?/);
        const saysYes=custLow.match(/\b(yes|ok|sure|agree|confirm|available|can do|sounds good|go ahead|sí|si|claro|de acuerdo|confirmo|disponible|adelante|listo|perfecto)\b/i);
        const asksHow=custLow.match(/\b(how to|how do|how can|steps|instructions|procedure|cómo|como|pasos|instrucciones|procedimiento)\b/i);
        const reportsNew=custLow.match(/\b(now|another|also|still|again|new issue|different|happening again|ahora|otro|también|sigue|de nuevo|nuevo problema|diferente|otra vez|persiste)\b/i);
        const sendsInfo=custLow.match(/\b(attached|screenshot|log|here is|please find|sharing|sending|adjunto|captura|le comparto|aquí está|le envío|enviando)\b/i);
        const mentionsTV=custLow.match(/teamviewer|remote|tv\s*id|anydesk|remota|sesión remota/i);
        const mentionsDone=custLow.match(/\b(done|completed|installed|working|fixed|resolved|looks good|thank|listo|completado|instalado|funcionando|resuelto|se arregló|gracias|todo bien)\b/i);

        const kbHits=matchKB(custText,ctx.triedSolutions);
        const kbAll=matchKB(allText,ctx.triedSolutions);

        if(mentionsDone){
            R.push({g:gRec,nm:l.confirmResolution,
                why:(lang==='es'?'Cliente indica que se resolvió: "':'Customer indicates resolved: "')+trunc(custText,100)+'"',
                body:hi+',\n\n'+l.gladResolved+'\n\n'+(ctx.hadRemoteSession?l.afterRemote:'')+l.letUsKnow+'\n\n'+bye});
        }

        if(ctx.customerProvided==='remote_credentials'||mentionsTV){
            R.push({g:gRec,nm:l.confirmRemote,
                why:(lang==='es'?'Cliente compartió credenciales/mencionó remota: "':'Customer shared credentials/mentioned remote: "')+trunc(custText,100)+'"',
                body:hi+',\n\n'+l.thankConfirm+l.shareDateTime+'.\n\n'+l.beforeConnect+'\n\n'+bye});
        }else if(saysYes&&ctx.wasScheduling){
            R.push({g:gRec,nm:l.confirmRemote,
                why:(lang==='es'?'Cliente aceptó sesión remota':'Customer agreed to remote session'),
                body:hi+',\n\n'+l.thankConfirm+l.shareDateTime+'.\n\n'+l.beforeConnect+'\n\n'+bye});
        }

        if(ctx.customerProvided==='logs'||ctx.customerProvided==='screenshots'||ctx.customerProvided==='files'){
            const what=ctx.customerProvided==='screenshots'?l.theScreenshots:(ctx.customerProvided==='logs'?l.theLogFiles:l.theInfo);
            const nextAction=kbHits.length?kbHits[0][lang]:l.willReview+(ctx.customerProvided==='logs'||ctx.customerProvided==='screenshots'?l.them:l.this_)+l.getBackFindings;
            R.push({g:gRec,nm:l.ackInfo,
                why:(lang==='es'?'Cliente envió '+ctx.customerProvided+': "':'Customer sent '+ctx.customerProvided+': "')+trunc(custText,100)+'"',
                body:hi+',\n\n'+l.thankSharing+what+'.\n\n'+nextAction+'\n\n'+bye});
        }

        if(ctx.customerProvided==='installed'){
            R.push({g:gRec,nm:lang==='es'?'Verificar Instalación':'Verify Installation',
                why:(lang==='es'?'Cliente indica que instaló: "':'Customer indicates installed: "')+trunc(custText,100)+'"',
                body:hi+',\n\n'+(lang==='es'?
                    'Gracias por confirmar la instalación. ¿Podrías verificar que todo funcione correctamente y compartir los resultados?':
                    'Thank you for confirming the installation. Could you verify that everything is working correctly and share the results?')+'\n\n'+bye});
        }

        if(kbHits.length&&!mentionsDone&&!ctx.customerProvided){
            kbHits.slice(0,2).forEach(kb=>{
                let kbBody=kb[lang];
                if(kbBody.includes('{SP_LINK}')){
                    if(spLink)kbBody=kbBody.replace(/\{SP_LINK\}/g,spLink);
                    else kbBody=kbBody.replace(/\n?\{SP_LINK\}\n?/g,'');
                }
                const alreadyAdded=R.some(r=>r.body.includes(kbBody));
                if(!alreadyAdded){
                    R.push({g:gRec,nm:(lang==='es'?'Respuesta: ':'Response: ')+kb.id,
                        why:(lang==='es'?'Detectado en mensaje: ':'Detected in message: ')+kb.id+' → "'+trunc(custText,80)+'"',
                        body:hi+',\n\n'+kbBody+'\n\n'+bye});
                }
            });
        }

        if(hasQ&&asksHow){
            const kbInstr=kbAll.find(k=>['kbrInstall','fileExport','barcodeIssue','guiSetting'].includes(k.id));
            R.push({g:gRec,nm:l.provideInstructions,
                why:(lang==='es'?'Cliente pregunta cómo: "':'Customer asking how to: "')+trunc(custText,100)+'"',
                body:hi+',\n\n'+(kbInstr?kbInstr[lang]:l.regQuestion+'\n\n1. ['+l.step+' 1]\n2. ['+l.step+' 2]\n3. ['+l.step+' 3]')+'\n\n'+(ctx.isBRM?l.backupFirst+'\n\n':'')+l.questionsProcess+'\n\n'+bye});
        }

        if(reportsNew&&!mentionsDone){
            const isPersist=custLow.match(/again|still|persist|sigue|otra vez|persiste/i);
            const kbFix=kbHits.length?'\n\n'+kbHits[0][lang]:'';
            R.push({g:gRec,nm:l.ackNewIssue,
                why:(lang==='es'?'Cliente reporta problema persiste/nuevo: "':'Customer reports issue persists/new: "')+trunc(custText,100)+'"',
                body:hi+',\n\n'+(lang==='es'?'Gracias por informarnos':'Thank you for letting me know')+(isPersist?l.persisting:l.additionalIssue)+'. '+(isPersist?l.understandFrustrating:l.importantRightAway)+kbFix+'\n\n'+
                (ctx.hadRemoteSession?l.anotherRemote:ctx.isTechnical&&!kbFix?l.shareNewErrors:(!kbFix?l.willReviewDetails:''))+'\n\n'+bye});
        }

        if(!R.length){
            const fallbackKB=kbAll.length?kbAll[0][lang]:'';
            R.push({g:gRec,nm:l.replyCustomer,
                why:(lang==='es'?'Último mensaje: "':'Last message: "')+trunc(custText,120)+'"',
                body:hi+',\n\n'+(saysYes?l.thankConfirming:'')+(hasQ?(lang==='es'?'Respecto a tu pregunta — ':'Regarding your question — ')+(fallbackKB||'['+( lang==='es'?'tu respuesta aquí':'your answer here')+']')+'\n\n':
                (fallbackKB?fallbackKB+'\n\n':(ctx.isError?l.investigating:'')+l.getBackShortly+'\n\n'))+
                (ctx.pendingAction?l.asDiscussed+ctx.pendingAction+'.\n\n':'')+bye});
        }

        if(!mentionsTV&&ctx.isTechnical&&!ctx.hadRemoteSession)
            R.push({g:gAlt,nm:l.suggestRemoteNm,
                why:lang==='es'?'Sin sesión remota aún para este tema técnico':'No remote session yet for this technical issue',
                body:hi+',\n\n'+l.suggestRemote+'\n\n'+l.availableSession+'\n\n'+bye});

        if(ctx.triedSolutions.size>0){
            const triedList=Array.from(ctx.triedSolutions).join(', ');
            R.forEach(r=>{r.why+=' | '+(lang==='es'?'Ya intentado: ':'Already tried: ')+triedList});
        }
    }

    if(a.sit==='waiting'||a.sit==='followup'){
        const agentSaid=lastAgent?lastAgent.t:'';
        const agentAsked=agentSaid.match(/\?/);
        const agentSentFile=agentSaid.toLowerCase().match(/attach|kbr|file|sent|please find|adjunto|envío|le comparto/i);
        const agentScheduled=agentSaid.toLowerCase().match(/schedul|teamviewer|remote|session|availab|sesión|remota|disponib/i);

        R.push({g:gRec,nm:a.stale>=14?l.finalFollowUp:l.followUpNm,
            why:a.stale+'d '+(lang==='es'?'desde que ':'since you ')+
                (agentAsked?(lang==='es'?'preguntaste: "':'asked: "')+trunc(agentSaid,80)+'"':
                agentSentFile?(lang==='es'?'enviaste archivos/KBR':'sent files/KBR'):
                agentScheduled?(lang==='es'?'propusiste sesión remota':'proposed a remote session'):
                (lang==='es'?'respondiste':'last replied'))+(lang==='es'?' — sin respuesta aún':' — no response yet'),
            body:hi+',\n\n'+l.followUp+
            (a.stale>=14?l.noResponseClose:
            agentAsked?l.chanceReview+trunc(agentSaid.split('?')[0],80)+'.\n\n'+l.letMeKnowContinue:
            agentSentFile?l.chanceInstall:
            agentScheduled?l.stillAvailRemote:
            l.furtherAssistance)+
            '\n\n'+bye});
    }

    if(ctx.hadRemoteSession)
        R.push({g:gAfter,nm:l.postSession,why:lang==='es'?'Se realizó/discutió sesión remota en este ticket':'Remote session discussed/held in this ticket',
            body:hi+',\n\n'+l.postSessionSummary+'\n\n'+l.actionsTaken+'\n- '+l.describeActions+'\n'+(ctx.isBRM?'- '+l.brmChanges+'\n':'')+'\n'+l.pendingItems+'\n- '+l.ifAny+'\n\n'+l.monitorSystem+'\n\n'+bye});

    if(ctx.isBRM)
        R.push({g:gDeliv,nm:l.deliverKBRNm,why:lang==='es'?'BRM/KBR discutido en la conversación':'BRM/KBR discussed in conversation',
            body:hi+',\n\n'+l.deliverKBR+'\n\n'+(ctx.mainIssue?l.addressesIssue+'\n\n':'')+l.toInstall+'\n\n'+l.needRemoteHelp+'\n\n'+bye});

    if(ctx.isQuote)
        R.push({g:gDeliv,nm:l.sendQuote,why:lang==='es'?'Cotización discutida en la conversación':'Quotation discussed in conversation',
            body:hi+',\n\n'+l.quoteFor+'\n\n'+l.quoteDetails+'\n\n'+l.validDays+'\n\n'+bye});

    R.push({g:gClose,nm:l.closeTicket,why:(lang==='es'?'Usar cuando ':'Use when ')+subj+(lang==='es'?' esté completamente resuelto':' is fully resolved'),
        body:hi+',\n\n'+l.gladConfirm+(ctx.hadRemoteSession?'\n\n'+l.thankRemoteTime:'')+'\n\n'+l.willClose+'\n\n'+bye});

    const threadWords=allTextLow.replace(/[^a-záéíóúüñ\s]/gi,'').split(/\s+/).filter(w=>w.length>3);
    R.forEach(r=>{
        const bLow=r.body.toLowerCase();
        let score=0;
        for(const w of threadWords){if(bLow.includes(w))score++}
        if(r.g===gRec)score+=20;
        else if(r.g===gAlt)score+=5;
        r._score=score;
    });
    R.sort((a,b)=>b._score-a._score);
    if(R.length>3)R.length=3;
    window._R=R;
    window._replyCtx={t,m,lang,hi,bye,firstName,subj,ctx,issueText,suggestions:R};
    let h='<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">'
        +'<div class="lang-badge" style="margin-bottom:0">'+(lang==='es'?'Español detectado':'English detected')+'</div>'
        +'<button onclick="toggleLang()" style="background:none;border:1px solid var(--g200);border-radius:980px;padding:3px 10px;font:600 10px/1 var(--f);color:var(--g500);cursor:pointer;display:flex;align-items:center;gap:4px" title="'+(lang==='es'?'Switch to English':'Cambiar a Español')+'">'
        +'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M12.5 18l3.5-7 3.5 7M15.91 16h4.18"/></svg>'
        +(lang==='es'?'EN':'ES')
        +'</button></div>';
    const pubMsgs=m.filter(x=>x.f!=='Note');
    const recentMsgs=pubMsgs.slice(-4);
    if(recentMsgs.length){
        window._ctxMsgs=[];
        h+='<div style="margin-bottom:14px;display:flex;flex-direction:column;gap:8px">';
        recentMsgs.forEach(function(msg,mi){
            const isC=msg.f==='Customer';
            const lbl=isC?(msg.who||firstName):'Agent';
            const clr=isC?'var(--orange)':'var(--blue)';
            const bg=isC?'var(--orange-bg)':'var(--blue-bg)';
            const cleanTxt=cleanEmailBody(msg.t);
            const needsTrunc=cleanTxt.length>400;
            const preview=needsTrunc?cleanTxt.substring(0,400)+'…':cleanTxt;
            if(needsTrunc)window._ctxMsgs[mi]={short:preview,full:cleanTxt,expanded:false};
            h+='<div style="padding:10px 12px;border-radius:10px;background:'+bg+';border-left:3px solid '+clr+';cursor:'+(needsTrunc?'pointer':'default')+';animation:fadeSlideIn .2s ease '+(mi*60)+'ms both;transition:all .15s" '
                +(needsTrunc?'onclick="toggleCtxMsg('+mi+')"':'')+'>'
                +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'
                +'<span style="font:600 11px/1 var(--f);color:'+clr+';text-transform:uppercase">'+esc(lbl)+'</span>'
                +'<span style="font:11px var(--f);color:var(--g400)">'+ago(new Date(msg.d))+' ago'+(needsTrunc?' · <span id="ctx-hint-'+mi+'" style="color:var(--g400);font-style:italic">click to expand</span>':'')+'</span></div>'
                +'<div id="ctx-msg-'+mi+'" style="font:13px/1.5 var(--f);color:var(--g700);white-space:pre-wrap">'+esc(preview)+'</div></div>';
        });
        h+='</div>';
    }

    window._attachments=[];
    h+='<div class="reply-compose" ondragover="event.preventDefault();this.classList.add(\'drag-over\')" ondragleave="this.classList.remove(\'drag-over\')" ondrop="event.preventDefault();this.classList.remove(\'drag-over\');handleDrop(event)">'
        +'<textarea id="custom-reply" rows="4" placeholder="'+(lang==='es'?'Escribe tu respuesta o arrastra archivos aquí...':'Write your reply or drag files here...')+'"'
        +' oninput="updateSendBtn();if(window._aiReply)window._aiReply=this.value" onpaste="handlePaste(event)"></textarea>'
        +'<div id="attach-list" class="attach-list"></div>'
        +'<div class="reply-compose-bar">'
        +'<button id="custom-send" class="compose-send" disabled onclick="openSendModal(document.getElementById(\'custom-reply\').value)">'
        +'<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>'
        +(lang==='es'?'Enviar':'Send')+'</button>'
        +'<button class="compose-attach" onclick="document.getElementById(\'attach-input\').click()" title="'+(lang==='es'?'Adjuntar archivo':'Attach file')+'">'
        +'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg></button>'
        +'<input type="file" id="attach-input" multiple style="display:none" onchange="handleFileInput(this)">'
        +'<button class="compose-ai" onclick="generateAI(\'ollama\')">'
        +'<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9.5 2l1.5 3.5L14.5 7l-3.5 1.5L9.5 12l-1.5-3.5L4.5 7l3.5-1.5zM19 11l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5L15 14.5l2.5-1zM9.5 17l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/></svg>'
        +(lang==='es'?'IA':'AI')+'</button>'
        +'<button class="compose-close" onclick="openCloseTicket()">'
        +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>'
        +(lang==='es'?'Cerrar':'Close')+'</button>'
        +'</div></div>'
        +'<div id="ai-out"></div>';
    return h;
}

function toggleLang(){
    const rc=window._replyCtx;if(!rc)return;
    _replyCache={};_summaryCache={};
    const newLang=rc.lang==='es'?'en':'es';
    window._langOverride=newLang;
    showPane(0);
}


function openFd(){if(D.dom&&D.cur&&D.cur.id)window.open('https://'+D.dom+'/a/tickets/'+D.cur.id,'_blank')}
function cpText(txt,b){openFd();var orig=b.innerHTML;navigator.clipboard.writeText(txt).then(()=>{b.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>Copied!';b.classList.add('did');setTimeout(()=>{b.innerHTML=orig;b.classList.remove('did')},1500)})}

/* =============== ANALYSIS ENGINE =============== */
var _memoMsgs=null,_memoAna=null,_memoKey='';
function _mKey(){return D.cur?D.cur.id+':'+D.cvs.length:''}
function memoMsgs(t,c){var k=_mKey();if(k===_memoKey&&_memoMsgs)return _memoMsgs;_memoKey=k;_memoMsgs=msgs(t,c);_memoAna=null;return _memoMsgs}
function memoAna(t,c){if(_memoAna)return _memoAna;var m=memoMsgs(t,c);_memoAna=ana(t,m);return _memoAna}
function msgs(t,c){
    const r=[];
    const desc=t.description_text||strip(t.description||'');
    const reqName=t.requester?t.requester.name:'Customer';
    if(desc)r.push({f:'Customer',t:desc,d:t.created_at,who:reqName});
    c.forEach(x=>{
        const f=x.private?'Note':(x.incoming?'Customer':'Agent');
        const who=x.incoming?nameFromEmail(x.from_email)||reqName:(x.from_email||'Agent');
        r.push({f:f,t:x.body_text||strip(x.body||''),d:x.created_at,who:who});
    });
    return r;
}

function ana(t,m){
    const age=Math.floor((Date.now()-new Date(t.created_at))/864e5);
    const stale=Math.floor((Date.now()-new Date(t.updated_at))/864e5);
    const pub=m.filter(x=>x.f!=='Note'),last=pub[pub.length-1];
    const nc=m.filter(x=>x.f==='Customer').length,na=m.filter(x=>x.f==='Agent').length;
    const txt=m.map(x=>x.t.toLowerCase()).join(' ');

    let sit,lbl,ico;
    if(nc>0&&na===0){sit='new';lbl='New ticket — needs your first response';ico='⚡'}
    else if(last&&last.f==='Customer'){sit='respond';lbl='Customer replied — your turn to respond';ico='✉️'}
    else{sit='waiting';lbl='Waiting for customer response';ico='⏳'}
    if(stale>=7&&sit==='waiting'){sit='followup';lbl='No response in '+stale+' days — time to follow up';ico='🔔'}

    return{sit,lbl,ico,age,stale,nc,na,tot:m.length,topics:findTopics(txt),steps:nextSteps(sit,findTopics(txt),stale)};
}

function findTopics(t){
    const M={'Remote Session':/teamviewer|remote.*(session|support|access)|anydesk/i,'Installation':/install|setup|deploy|upgrade|migration/i,'Error':/error|crash|exception|fail|broken|not.work/i,'Config':/config|setting|parameter|property/i,'BRM/KBR':/brm|kbr|business.rule|script/i,'License':/license|activation|serial/i,'Database':/database|db|sql|connection.string/i,'Network':/socket|network|tcp|port|firewall/i,'Export':/export|xslt|csv|xml|output/i,'Inspection':/inspect|defect|result|barcode|pcb|spi|aoi/i,'Quote':/quote|quotat|price|cost|purchase|po\b/i,'Calibration':/calibrat|alignment|offset/i,'Update':/update|patch|version|release|firmware/i};
    return Object.entries(M).filter(([,r])=>r.test(t)).map(([k])=>k);
}

function nextSteps(sit,top,stale){
    const s=[];
    if(sit==='new'){s.push('Send first response acknowledging the issue');if(top.includes('Error'))s.push('Ask for screenshots, logs, and software version');if(top.includes('Remote Session'))s.push('Schedule TeamViewer session');if(top.includes('Quote'))s.push('Prepare quotation')}
    else if(sit==='respond'){s.push("Read customer's latest reply and respond");if(top.some(x=>['Remote Session','Error','Inspection'].includes(x)))s.push('Consider scheduling a remote session')}
    else if(sit==='waiting'){s.push('No action needed yet');if(stale>=3)s.push('Send a follow-up in a few days')}
    else if(sit==='followup'){s.push('Send follow-up message ('+stale+'d without response)');if(stale>=14)s.push('Consider closing if no reply after follow-up')}
    return s;
}

