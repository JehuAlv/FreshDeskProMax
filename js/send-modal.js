/* =============== SEND REPLY MODAL =============== */
function cleanSignature(html){
    if(!html)return '';
    html=html.replace(/&nbsp;/gi,' ');
    html=html.replace(/\{\{[^}]*\}\}/g,'');
    html=html.replace(/(hola\s+hello|hello\s+hola|hola|hello|hi|hey|dear|buenos\s+d[ií]as|buenas\s+tardes|buen\s+d[ií]a|estimado)[,.\s]*/i,'');
    html=html.replace(/(saludos\s+cordiales\s*[\/,.\s]*best\s+regards|best\s+regards\s*[\/,.\s]*saludos\s+cordiales|saludos\s+cordiales|best\s+regards|kind\s+regards|sincerely|cordialmente|atentamente)\s*[,.]*/i,'');
    for(var i=0;i<3;i++)html=html.replace(/<(div|p|span)[^>]*>(\s|<br\s*\/?>)*<\/\1>/gi,'');
    html=html.replace(/(<br\s*\/?\s*>\s*){3,}/gi,'<br><br>');
    html=html.replace(/^(\s*(<br\s*\/?>)\s*)*/gi,'');
    return html;
}

function _buildCcList(){
    if(!D.cur)return[];
    const s=new Set();
    (D.cur.cc_emails||[]).forEach(function(e){s.add(e)});
    (D.cur.reply_cc_emails||[]).forEach(function(e){s.add(e)});
    (D.cur.ticket_cc_emails||[]).forEach(function(e){s.add(e)});
    return Array.from(s).filter(function(e){return e&&e.indexOf('@')>0});
}

function openCloseTicket(){
    const rc=window._replyCtx;
    const esL=rc&&rc.lang==='es';
    const msg=esL
        ?'De momento procederemos a cerrar este ticket. Si necesitan soporte en el futuro, no duden en contactarnos nuevamente a nuestro correo oficial de soporte kya_support@kohyoung.com.'
        :'We will proceed to close this ticket now. If you ever require support in the future, feel free to reach out by sending a new email to our official support mail at kya_support@kohyoung.com.';
    const hi=rc?rc.hi:(esL?'Hola':'Hello');
    const bye=rc?rc.bye:(esL?'Saludos cordiales':'Best regards');
    openSendModal(hi+',\n\n'+msg+'\n\n'+bye,true);
}

function openSendModal(text,resolveOnSend){
    window._resolveOnSend=!!resolveOnSend;
    if(!D.cur)return;
    const rc=window._replyCtx;
    const esL=rc&&rc.lang==='es';

    const toEmail=D.cur.requester?D.cur.requester.email:'';
    const ccList=_buildCcList();

    var recipientsHtml='<label style="margin-top:0">'+(esL?'Para':'To')+'</label>'
        +'<div style="font:12px var(--f);color:var(--g600);padding:4px 0">'+(toEmail?esc(toEmail):'—')+'</div>';
    if(ccList.length){
        recipientsHtml+='<label style="margin-top:8px">CC ('+ccList.length+')</label>'
            +'<div style="font:12px var(--f);color:var(--g600);padding:4px 0;max-height:80px;overflow-y:auto">'
            +ccList.map(function(e){return esc(e)}).join('<br>')+'</div>';
    }

    const overlay=document.createElement('div');
    overlay.className='send-modal-overlay';
    overlay.id='send-modal-overlay';
    overlay.onclick=function(e){if(e.target===overlay)closeSendModal()};
    overlay.innerHTML=
        '<div class="send-modal">'
        +'<div class="send-modal-hdr"><h2>'+(window._resolveOnSend?(esL?'Cerrar Ticket':'Close Ticket'):(esL?'Enviar Respuesta':'Send Reply'))+' - #'+D.cur.id+'</h2><button class="close-btn" onclick="closeSendModal()">&times;</button></div>'
        +'<div class="send-modal-body">'
        +recipientsHtml
        +'<label style="margin-top:12px">'+(esL?'Respuesta (editable)':'Reply (editable)')+'</label>'
        +'<textarea id="send-modal-text">'+esc(text)+'</textarea>'
        +(window._attachments&&window._attachments.length?'<label style="margin-top:12px">'+(esL?'Adjuntos':'Attachments')+' ('+window._attachments.length+')</label><div id="modal-attach-list" class="attach-list"></div>':'')
        +'<label style="margin-top:14px">'+(esL?'Firma del agente':'Agent signature')+'</label>'
        +'<div class="send-modal-sig"><a href="https://'+D.dom+'/a/tickets/'+D.cur.id+'">Ticket #'+D.cur.id+'</a>'
        +(D.sig?'<br><br>'+cleanSignature(D.sig):'')+'</div>'
        +'</div>'
        +'<span class="send-modal-status" id="send-modal-status"></span>'
        +'<div class="send-modal-footer">'
        +'<button class="sm-btn sm-cancel" onclick="closeSendModal()">'+(esL?'Cancelar':'Cancel')+'</button>'
        +'<button class="sm-btn sm-send" id="send-modal-confirm" style="'+(window._resolveOnSend?'background:linear-gradient(135deg,#ef4444,#dc2626)':'')+'" onclick="confirmSendReply()">'+(window._resolveOnSend?(esL?'Enviar y Cerrar':'Send & Close'):(esL?'Enviar':'Send'))+'</button>'
        +'</div></div>';
    document.body.appendChild(overlay);
    if(window._attachments&&window._attachments.length)renderAttachList('modal-attach-list');
    setTimeout(()=>{document.getElementById('send-modal-text').focus()},100);
}

function closeSendModal(){
    window._resolveOnSend=false;
    var o=document.getElementById('send-modal-overlay');
    if(!o)return;
    o.style.animation='fadeIn .15s ease reverse forwards';
    var m=o.querySelector('.send-modal');
    if(m)m.style.animation='modalIn .15s ease reverse forwards';
    setTimeout(function(){o.remove()},160);
}

async function confirmSendReply(){
    const textarea=document.getElementById('send-modal-text');
    const statusEl=document.getElementById('send-modal-status');
    const sendBtn=document.getElementById('send-modal-confirm');
    if(!textarea||!D.cur)return;

    const text=textarea.value.trim();
    if(!text){statusEl.className='send-modal-status err';statusEl.textContent='Reply cannot be empty';return}

    sendBtn.disabled=true;
    statusEl.className='send-modal-status';
    const rc=window._replyCtx;
    const esL=rc&&rc.lang==='es';
    statusEl.textContent=esL?'Enviando...':'Sending...';

    try{
        let bodyHtml=text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
        var ticketUrl='https://'+D.dom+'/a/tickets/'+D.cur.id;
        bodyHtml+='<br><br><a href="'+ticketUrl+'">Ticket #'+D.cur.id+'</a>';
        if(D.sig)bodyHtml+='<br><br>'+cleanSignature(D.sig);

        const ccArr=_buildCcList();
        var resp;
        if(window._attachments&&window._attachments.length){
            var fd=new FormData();
            fd.append('body',bodyHtml);
            ccArr.forEach(function(cc){fd.append('cc_emails[]',cc)});
            window._attachments.forEach(function(a){fd.append('attachments[]',a.resized||a.file,a.file.name)});
            resp=await fetch('/fd/tickets/'+D.cur.id+'/reply',{
                method:'POST',
                headers:{'X-FD-Key':D.key,'X-FD-Domain':D.dom},
                body:fd
            });
        }else{
            var payload={body:bodyHtml};
            if(ccArr.length)payload.cc_emails=ccArr;
            resp=await fetch('/fd/tickets/'+D.cur.id+'/reply',{
                method:'POST',
                headers:{'X-FD-Key':D.key,'X-FD-Domain':D.dom,'Content-Type':'application/json'},
                body:JSON.stringify(payload)
            });
        }

        if(!resp.ok){
            const err=await resp.json().catch(()=>({}));
            throw new Error(err.description||err.message||'Error '+resp.status);
        }

        if(window._resolveOnSend){
            await fetch('/fd/tickets/'+D.cur.id,{
                method:'PUT',
                headers:{'X-FD-Key':D.key,'X-FD-Domain':D.dom,'Content-Type':'application/json'},
                body:JSON.stringify({status:4})
            }).catch(function(){});
            D.cur.status=4;
        }else if(D.cur.status===2&&D.aid){
            await fetch('/fd/tickets/'+D.cur.id,{
                method:'PUT',
                headers:{'X-FD-Key':D.key,'X-FD-Domain':D.dom,'Content-Type':'application/json'},
                body:JSON.stringify({status:3,responder_id:Number(D.aid)})
            }).catch(function(){});
        }

        window._attachments=[];
        statusEl.className='send-modal-status ok';
        statusEl.textContent=window._resolveOnSend
            ?(esL?'Enviado y ticket cerrado':'Reply sent & ticket resolved')
            :(esL?'Enviado correctamente':'Reply sent successfully');
        sendBtn.style.display='none';

        if(rc){
            var sent=text;
            if(window._aiOriginal&&window._aiOriginal!==sent){
                var w1=window._aiOriginal.toLowerCase().split(/\s+/);
                var w2=sent.toLowerCase().split(/\s+/);
                var cm=w1.filter(function(w){return w2.indexOf(w)>=0}).length;
                var sim=cm/Math.max(w1.length,w2.length,1);
                if(sim<0.85){
                    AIPipeline.saveCorrection(window._aiOriginal,sent,rc.lang);
                    statusEl.textContent+=(esL?' (corrección guardada)':' (correction saved)');
                }
            }
            window._aiOriginal=null;
        }

        try{var r6=JSON.parse(localStorage.getItem('fd_resp6')||'{}');r6[D.cur.id]=true;localStorage.setItem('fd_resp6',JSON.stringify(r6));_statsNoResp.delete(D.cur.id);if(_statsCache.resp6)_statsCache.resp6[D.cur.id]=true}catch(e){}

        if(window._resolveOnSend){
            D.allOpen=D.allOpen.filter(t=>t.id!==D.cur.id);
            delete D.lr[D.cur.id];
            D.pending.delete(D.cur.id);
            savePending();
            applyFilter();
            setTimeout(()=>{closeSendModal();D.cur=null;document.getElementById('content').innerHTML=''},1200);
        }else{
            D.lr[D.cur.id]=false;
            try{var c4=JSON.parse(localStorage.getItem('fd_cache4')||'{}');if(c4[D.cur.id]){c4[D.cur.id].lr=false;c4[D.cur.id].u=null;localStorage.setItem('fd_cache4',JSON.stringify(c4))}}catch(e){}
            var wasNew=D.newTks.some(t=>t.id===D.cur.id);
            if(wasNew){
                var tk=D.newTks.find(t=>t.id===D.cur.id);
                D.newTks=D.newTks.filter(t=>t.id!==D.cur.id);
                updateNewBadge();
                if(tk&&!D.allOpen.some(t=>t.id===tk.id))D.allOpen.push(tk);
                try{if(D._cacheNew)delete D._cacheNew[D.cur.id];localStorage.setItem('fd_cache_new',JSON.stringify(D._cacheNew||{}))}catch(e){}
            }
            applyFilter();
            setTimeout(()=>{closeSendModal();delete _selCache[D.cur.id];sel(D.cur.id)},1200);
        }
    }catch(e){
        statusEl.className='send-modal-status err';
        statusEl.textContent=(esL?'Error: ':'Error: ')+e.message;
        sendBtn.disabled=false;
    }
}
