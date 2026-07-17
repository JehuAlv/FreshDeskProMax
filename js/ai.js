async function tryOllama(sys,usr,analysis){
    var model=window._ollamaModel||'qwen3.5:9b';
    const ta=document.getElementById('custom-reply');
    const resp=await fetch('/ollama',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({model:model,messages:[{role:'system',content:sys},{role:'user',content:usr}],stream:true,think:false,keep_alive:-1,options:{temperature:0.3,num_predict:200,num_ctx:4096,top_p:0.8,repeat_penalty:1.1}})
    });
    if(!resp.ok)throw new Error('Ollama '+resp.status);
    const reader=resp.body.getReader();
    const dec=new TextDecoder();
    let reply='',buf='';
    while(true){
        const{done,value}=await reader.read();
        if(done)break;
        buf+=dec.decode(value,{stream:true});
        const lines=buf.split('\n');
        buf=lines.pop();
        for(const ln of lines){
            if(!ln.trim())continue;
            try{
                const chunk=JSON.parse(ln);
                if(chunk.message&&chunk.message.content){
                    reply+=chunk.message.content;
                    if(ta){ta.value=reply;ta.style.height='auto';ta.style.height=ta.scrollHeight+'px';}
                }
            }catch(e){}
        }
    }
    if(buf.trim()){try{const chunk=JSON.parse(buf);if(chunk.message&&chunk.message.content)reply+=chunk.message.content}catch(e){}}
    var rc=window._replyCtx;
    if(rc&&analysis){
        var validated=AIPipeline.validate(reply,analysis,rc);
        reply=validated.text;
    }
    return{reply,provider:'Ollama ('+model+')'};
}

async function ensureSPFolder(){
    const t=D.cur;if(!t)return null;
    let link=getSPLink(t.id);
    if(link)return link;
    try{
        const emails=extractTicketEmails();
        const resp=await fetch('/sharepoint',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({ticketId:t.id,emails:emails})
        });
        const data=await resp.json();
        if(data.link){
            saveSPLink(t.id,data.link);
            return data.link;
        }
    }catch(e){}
    return null;
}

async function generateAI(provider,extraCtx){
    const rc=window._replyCtx;if(!rc)return;
    const out=document.getElementById('ai-out');
    const ta=document.getElementById('custom-reply');
    const sendBtn=document.getElementById('custom-send');
    const btns=document.querySelectorAll('.compose-ai');
    btns.forEach(b=>{b.disabled=true});
    const esL=rc.lang==='es';

    out.innerHTML='<div class="loading-msg">'+(esL?'Generando respuesta':'Generating reply')+'</div>';
    if(ta){ta.disabled=false;ta.value='';ta.placeholder=esL?'Generando...':'Generating...';}

    let spLink=getSPLink(D.cur.id);
    const initialSpLink=spLink;
    if(!extraCtx){const el=document.getElementById('ai-extra');if(el)extraCtx=el.value.trim()}
    var aiResult=AIPipeline.generate(rc,extraCtx||'',spLink);
    const{sys,usr}=aiResult;
    let result=null;
    try{result=await tryOllama(sys,usr,aiResult.analysis)}catch(e){
        out.innerHTML='<div class="ctx-box">'+(esL?'Ollama no disponible. Asegúrate de que esté corriendo.':'Ollama not available. Make sure it is running.')+'</div>';
        if(ta){ta.disabled=false;ta.placeholder=esL?'Escribe tu respuesta aquí...':'Write your reply here...';}
        btns.forEach(b=>{b.disabled=false});return;
    }

    if(result){
        let reply=result.reply;
        const replyNeedsLink=/issue.?report|sharepoint|subir.*archivo|upload.*file|sube.*los.*archivo|upload.*to/i.test(reply);
        if(replyNeedsLink&&!spLink){
            out.innerHTML='<div class="loading-msg">'+(esL?'Creando carpeta SharePoint...':'Creating SharePoint folder...')+'</div>';
            spLink=await ensureSPFolder();
            if(spLink){
                const spLine=esL
                    ?'\n\nPor favor sube los archivos al siguiente folder de SharePoint:\n'+spLink
                    :'\n\nPlease upload the files to the following SharePoint folder:\n'+spLink;
                const byeRx=new RegExp('(\\n\\n)('+rc.bye.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','i');
                if(byeRx.test(reply))reply=reply.replace(byeRx,spLine+'$1$2');
                else reply=reply.trimEnd()+spLine;
            }
        }
        window._aiReply=reply;
        window._aiOriginal=reply;
        if(ta){ta.value=reply;ta.disabled=false;ta.placeholder=esL?'Escribe tu respuesta aquí...':'Write your reply here...';ta.style.height='auto';ta.style.height=ta.scrollHeight+'px';}
        if(sendBtn)sendBtn.disabled=false;
        out.innerHTML='<div class="ai-info">'
            +'<div class="ai-info-label"><svg width="12" height="12" viewBox="0 0 24 24" fill="#8b5cf6"><path d="M9.5 2l1.5 3.5L14.5 7l-3.5 1.5L9.5 12l-1.5-3.5L4.5 7l3.5-1.5zM19 11l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5L15 14.5l2.5-1zM9.5 17l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/></svg>'+esc(result.provider)+'</div>'
            +'<div class="ai-regen-bar">'
            +'<input id="ai-extra" type="text" placeholder="'+(esL?'Ej: dile que le vamos a mandar la versión por correo':'E.g. tell them we will send the version by email')+'">'
            +'<button class="ai-regen-btn" onclick="generateAI(\'ollama\',document.getElementById(\'ai-extra\').value.trim())"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>'+(esL?'Regenerar':'Regenerate')+'</button>'
            +'</div></div>';
    }
    if(spLink&&!initialSpLink)updateSPButton(D.cur.id,spLink);
    btns.forEach(b=>{b.disabled=false});
}
