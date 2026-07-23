var _selCache={};
var _prefetching={};
function prefetch(id){
    if(_selCache[id]||_prefetching[id])return;
    _prefetching[id]=true;
    Promise.all([
        get('tickets/'+id+'?include=requester,company').catch(function(){return null}),
        get('tickets/'+id+'/conversations?per_page=100').catch(function(){return[]})
    ]).then(function(r){
        var t=r[0],cvs=r[1]||[];
        if(!t){delete _prefetching[id];return}
        t._company=coName(t);
        _selCache[id]={t:t,cvs:cvs,ts:Date.now()};
        delete _prefetching[id];
    }).catch(function(){delete _prefetching[id]});
}
async function sel(id){
    _memoKey='';_memoMsgs=null;_memoAna=null;_replyCache={};_summaryCache={};
    var cached=_selCache[id];
    if(cached&&Date.now()-cached.ts<900000){
        D.cur=cached.t;D.cvs=cached.cvs;window._langOverride=null;rlActive(id);renderRight();
        return;
    }
    var stub=D.allOpen.find(function(t){return t.id===id})||D.newTks.find(function(t){return t.id===id});
    if(stub){
        document.getElementById('hdr').innerHTML='<div class="hdr-box"><h1>#'+id+' — '+esc(stub.subject||'')+'</h1><div class="chips">'
            +'<span class="chip '+(SCLS[stub.status]||'')+'">'+(SN[stub.status]||stub.status)+'</span>'
            +'<span class="chip '+(PCLS[stub.priority]||'')+'">'+(PN[stub.priority]||'?')+'</span>'
            +'<span class="chip chip-meta">'+esc(stub._reqName||(stub.requester?stub.requester.name:''))+'</span>'
            +'</div></div>';
        document.getElementById('tab-bar').innerHTML='';
    }else{
        document.getElementById('hdr').innerHTML='';
        document.getElementById('tab-bar').innerHTML='';
    }
    document.getElementById('content').innerHTML='<div class="loading-msg">Loading</div>';
    try{
        var r=await Promise.all([
            get('tickets/'+id+'?include=requester,company',{priority:1}),
            get('tickets/'+id+'/conversations?per_page=100',{priority:1}).catch(function(){return[]})
        ]);
        var t=r[0],firstPage=r[1]||[];
        if(!t.requester&&t.requester_id){try{t.requester=await get('contacts/'+t.requester_id,{priority:1})}catch(e){}}
        t._company=coName(t);
        var allConvs=firstPage.slice();
        if(firstPage.length>=100){
            var pg=2;
            while(true){
                var page=await get('tickets/'+id+'/conversations?per_page=100&page='+pg,{priority:1});
                if(!page||!page.length)break;
                allConvs=allConvs.concat(page);
                if(page.length<100)break;
                pg++;
            }
        }
        _selCache[id]={t:t,cvs:allConvs,ts:Date.now()};
        D.cur=t;D.cvs=allConvs;window._langOverride=null;rlActive(id);renderRight();
    }catch(e){document.getElementById('content').innerHTML='<div class="empty-msg">'+esc(e.message)+'</div>'}
}

function renderRight(){
    const t=D.cur,c=D.cvs;if(!t)return;
    const rq=t.requester?t.requester.name:'Unknown';
    const age=Math.floor((Date.now()-new Date(t.created_at))/864e5);
    const stale=Math.floor((Date.now()-new Date(t.updated_at))/864e5);

    const spLink=getSPLink(t.id);
    const spActions=spLink
        ?'<span class="btn-group"><a class="btn-fd btn-sp btn-gl" href="'+esc(spLink)+'" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>Open SharePoint Folder</a>'
         +'<button class="btn-fd btn-sp btn-gr" onclick="copySPLink('+t.id+')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copy link</button></span>'
        :'<button id="sp-btn-'+t.id+'" class="btn-fd" onclick="createSPFolder('+t.id+')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg><span id="sp-status-'+t.id+'">Generate SharePoint Folder</span></button>';

    const swBtn='<button class="btn-fd btn-sw" onclick="openLatestSoftware()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Latest Software</button>';
    const kbrBtn='<a class="btn-fd btn-kbr" href="https://kohyoung-my.sharepoint.com/:f:/p/ky_mes/IgClPNaRNuuIQZk9yj6eovIWAez_iOUYVRT4HdUkygUatfs?e=MZr0PS" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Upload KBR</a>';

    document.getElementById('hdr').innerHTML=
        '<div class="hdr-box"><h1>#'+t.id+' — '+esc(t.subject||'')+'</h1>'+
        '<div class="chips">'+
        '<span class="chip '+(SCLS[t.status]||'')+'">'+(SN[t.status]||t.status)+'</span>'+
        '<span class="chip '+(PCLS[t.priority]||'')+'">'+(PN[t.priority]||'?')+'</span>'+
        '<span class="chip chip-meta">'+esc(rq)+'</span>'+
        '<span class="chip chip-meta">'+age+'d old</span>'+
        '<span class="chip chip-meta">Updated '+(stale===0?'today':stale+'d ago')+'</span>'+
        '</div>'+
        '<div class="hdr-actions">'+spActions+swBtn+kbrBtn+'<a class="btn-fd" href="https://help.kohyoung.com/a/tickets/'+t.id+'" target="_blank" rel="noopener"><svg viewBox="0 0 16 16"><path d="M9 2h5v5l-2-2-4 4-1.5-1.5L10.5 4 9 2zM3 3h4v1.5H3.5v8h8V9H13v4.5A1.5 1.5 0 0111.5 15h-8A1.5 1.5 0 012 13.5v-8A1.5 1.5 0 013.5 4H3V3z"/></svg>Open in Freshdesk</a></div>'+
        '</div>';

    document.getElementById('tab-bar').innerHTML=
        '<div class="tab-row">'+
        '<button class="on" onclick="tab(this,0)">Quick Reply</button>'+
        '<button onclick="tab(this,1)">Thread <span class="bdg">'+c.length+'</span></button>'+
        '</div>';

    showPane(0);
}

function tab(b,i){b.parentElement.querySelectorAll('button').forEach(x=>x.classList.remove('on'));b.classList.add('on');showPane(i)}

var _replyCache={};
function showPane(i){
    const t=D.cur,c=D.cvs;
    const el=document.getElementById('content');
    el.scrollTop=0;
    if(i===0){
        var k=t.id;
        if(!_replyCache[k])_replyCache[k]=replyHTML(t,c);
        el.innerHTML='<div class="reply-layout"><div class="reply-main">'+_replyCache[k]+'</div><div class="reply-sidebar">'+sidebarSummaryHTML(t,c)+'</div></div>';
    }
    else el.innerHTML='<div class="rpad">'+threadHTML(t,c)+'</div>';
    document.getElementById('scroll-area').scrollTop=0;
}

var _summaryCache={};

function sidebarSummaryHTML(t,c){
    const m=memoMsgs(t,c),a=memoAna(t,c);
    let h='';

    h+='<div class="sb-section"><div class="sb-sit act-'+a.sit+'"><span class="emoji">'+a.ico+'</span><span>'+a.lbl+'</span></div>'
      +'<div class="sb-stats">'
      +'<div class="sb-stat"><div class="n">'+a.tot+'</div><div class="l">Messages</div></div>'
      +'<div class="sb-stat"><div class="n">'+a.age+'d</div><div class="l">Age</div></div>'
      +'<div class="sb-stat"><div class="n">'+a.nc+'</div><div class="l">Customer</div></div>'
      +'<div class="sb-stat"><div class="n">'+a.na+'</div><div class="l">Agent</div></div>'
      +'</div></div>';

    if(a.topics.length){
        h+='<div class="sb-section"><div class="sb-title">Topics</div>'
          +'<div class="sb-topics">'+a.topics.map(function(x){return esc(x)}).join(' · ')+'</div></div>';
    }

    h+='<div class="sb-section"><div class="sb-title"><svg width="12" height="12" viewBox="0 0 24 24" fill="#8b5cf6"><path d="M9.5 2l1.5 3.5L14.5 7l-3.5 1.5L9.5 12l-1.5-3.5L4.5 7l3.5-1.5zM19 11l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5L15 14.5l2.5-1zM9.5 17l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/></svg>AI Summary</div>'
      +'<div id="ai-summary" class="sb-original">';
    if(_summaryCache[t.id]){
        h+=esc(_summaryCache[t.id]);
    }else{
        h+='<span class="loading-msg" style="padding:8px;font-size:11px">Generating</span>';
    }
    h+='</div></div>';

    if(!_summaryCache[t.id]){
        setTimeout(function(){generateSummary(t,c)},50);
    }

    return h;
}

async function generateSummary(t,c){
    const el=document.getElementById('ai-summary');
    if(!el)return;
    if(_summaryCache[t.id]){el.textContent=_summaryCache[t.id];return;}

    const m=memoMsgs(t,c);
    const lang=window._langOverride||detectLang(m,t.subject);
    const thread=m.map(function(x){
        return x.f+' ('+new Date(x.d).toLocaleDateString()+'): '+trunc(cleanEmailBody(x.t),300);
    }).join('\n\n');

    const sys=lang==='es'
        ?'Resume hilos de soporte en 2-3 oraciones cortas. Solo el resumen, sin encabezados ni viñetas.'
        :'Summarize support threads in 2-3 short sentences. Only the summary, no headers or bullets.';

    const usr=lang==='es'
        ?'Resume brevemente: problema, qué se hizo, estado actual.\n\nTicket #'+t.id+' — '+t.subject+'\n\n'+thread
        :'Briefly summarize: issue, what was done, current status.\n\nTicket #'+t.id+' — '+t.subject+'\n\n'+thread;

    var model=window._ollamaModel||'qwen3.5:9b';
    try{
        const resp=await fetch('/ollama',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({model:model,messages:[{role:'system',content:sys},{role:'user',content:usr}],stream:true,think:false,keep_alive:-1,options:{temperature:0.3,num_predict:120,num_ctx:4096,top_p:0.8,repeat_penalty:1.3}})
        });
        if(!resp.ok)throw new Error('Ollama '+resp.status);
        const reader=resp.body.getReader();
        const dec=new TextDecoder();
        let summary='',buf='';
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
                        summary+=chunk.message.content;
                        const cur=document.getElementById('ai-summary');
                        if(cur)cur.textContent=summary;
                    }
                }catch(e){}
            }
        }
        if(buf.trim()){try{const chunk=JSON.parse(buf);if(chunk.message&&chunk.message.content)summary+=chunk.message.content}catch(e){}}
        _summaryCache[t.id]=summary;
    }catch(e){
        const cur=document.getElementById('ai-summary');
        if(cur)cur.innerHTML='<span style="color:var(--g400);font-style:italic">'+(lang==='es'?'Ollama no disponible':'Ollama not available')+'</span>';
    }
}

/* =============== THREAD =============== */
function threadHTML(t,c){
    let h='';
    const total=c.length+(t.description?1:0);
    if(total>10)h+='<div style="text-align:center"><button class="jump-btn" onclick="jumpToLatest()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>Jump to latest ('+total+' messages)</button></div>';
    if(t.description)h+='<div class="bubble customer"><div class="bh"><span class="nm">'+esc(t.requester?t.requester.name:'Customer')+' (Original)</span><span class="dt">'+new Date(t.created_at).toLocaleString()+'</span></div><div class="bb">'+safe(t.description)+'</div></div>';
    c.forEach((x,i)=>{
        const tp=x.private?'note':(x.incoming?'customer':'agent');
        const lb=x.private?'Private Note':(x.incoming?'Customer':'Agent');
        const last=i===c.length-1?' id="last-msg"':'';
        h+='<div class="bubble '+tp+'"'+last+'><div class="bh"><span class="nm">'+esc(x.from_email||lb)+' ('+lb+')</span><span class="dt">'+new Date(x.created_at).toLocaleString()+'</span></div><div class="bb">'+safe(x.body||'')+'</div></div>';
    });
    return h||'<div class="empty-msg">No conversations</div>';
}
function jumpToLatest(){const el=document.getElementById('last-msg');if(el)el.scrollIntoView({behavior:'smooth',block:'center'})}
