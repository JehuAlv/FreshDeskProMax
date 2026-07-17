async function fetchByStatus(st){
    try{
        let q='"agent_id:'+D.aid+' AND status:'+st+'"';
        let all=[],pg=1;
        while(true){
            const d=await get('search/tickets?query='+encodeURIComponent(q)+'&page='+pg);
            const res=d.results||[];
            all=all.concat(res);
            if(res.length<30||pg>=10)break;
            pg++;
        }
        return all;
    }catch(e){return[]}
}

async function checkLastReply(tid){
    var batch=await get('tickets/'+tid+'/conversations?per_page=100');
    if(!batch||!batch.length)return true;
    if(batch.length>=100){
        var page=2;
        while(true){
            var more=await get('tickets/'+tid+'/conversations?per_page=100&page='+page);
            if(!more||!more.length)break;
            batch=batch.concat(more);
            if(more.length<100)break;
            page++;
        }
    }
    for(var i=batch.length-1;i>=0;i--){if(!batch[i].private)return batch[i].incoming!==false}
    return true;
}

var _progBar,_progFill;
function showProg(done,total){
    if(!_progBar){_progBar=document.getElementById('prog');_progFill=document.getElementById('prog-fill')}
    if(total>0){_progBar.style.display='block';_progFill.style.width=Math.round(done/total*100)+'%'}
    else if(_progBar.style.display!=='none'){_progFill.style.width='100%';setTimeout(function(){_progBar.style.display='none';_progFill.style.width='0'},350)}
}
async function loadAll(){
    document.getElementById('list').innerHTML='<div class="loading-msg">Loading tickets</div>';
    showProg(0,1);
    const lists=await Promise.all([2,3,8].map(st=>fetchByStatus(st)));
    const seen=new Set();
    D.allOpen=[].concat(...lists).filter(t=>{if(seen.has(t.id))return false;seen.add(t.id);return true});
    D.lr={};
    var craw=JSON.parse(localStorage.getItem('fd_cache4')||'{}');
    const cache=craw._v===6?craw:{_v:6};
    let done=0;const total=D.allOpen.length;
    var _loadThrottle=0;function tick(){done++;showProg(done,total);if(!_loadThrottle){_loadThrottle=setTimeout(function(){_loadThrottle=0;applyFilter()},2000)}}
    D.allOpen.forEach(function(t){
        var c=cache[t.id];
        if(c&&c.u===t.updated_at&&c.rn&&c.rn!=='Unknown'){D.lr[t.id]=!!c.lr;t._reqName=c.rn;t._company=c.co;tick()}
    });
    applyFilter();
    await Promise.all(D.allOpen.filter(function(t){return !cache[t.id]||cache[t.id].u!==t.updated_at}).map(function(t){
        var lr=checkLastReply(t.id).catch(function(){return true});
        var det=get('tickets/'+t.id+'?include=requester,company').catch(function(){return null});
        return Promise.all([lr,det]).then(function(r){
            D.lr[t.id]=!!r[0];
            t._reqName=r[1]&&r[1].requester?r[1].requester.name:'Unknown';
            t._company=r[1]?coName(r[1]):'';
            if(r[1])cache[t.id]={u:t.updated_at,lr:r[0],rn:t._reqName,co:t._company};
            else cache[t.id]={u:null,lr:r[0],rn:t._reqName,co:t._company};
            tick();
        });
    }));
    applyFilter();showProg(0,0);
    try{localStorage.setItem('fd_cache4',JSON.stringify(cache))}catch(e){}
}

async function loadNewTickets(){
    try{
        if(!D._teamIds){
            let allAgents=[],apg=1;
            while(true){
                const a=await get('agents?per_page=100&page='+apg);
                allAgents=allAgents.concat(a);
                if(a.length<100)break;
                apg++;
            }
            D._agentMap={};
            allAgents.forEach(a=>{D._agentMap[a.id]=a.contact?a.contact.name:'Agent #'+a.id});
            D._teamIds=allAgents.filter(a=>{
                const n=a.contact?a.contact.name:'';
                return /alexis|ramiro/i.test(n);
            }).map(a=>a.id);
        }
        if(!D._teamIds.length){D.newTks=[];updateNewBadge();return}

        var searchOne=async function(aid){
            let q='"agent_id:'+aid+' AND status:2"',r=[],pg=1;
            while(true){const d=await get('search/tickets?query='+encodeURIComponent(q)+'&page='+pg);const res=d.results||[];r=r.concat(res);if(res.length<30||pg>=10)break;pg++}
            return r;
        };
        var all=[].concat(...await Promise.all(D._teamIds.map(searchOne)));
        D._earlyNewIds=new Set(all.map(function(t){return t.id}));

        var noReply=[];
        var cache=D._cacheNew||(D._cacheNew={});
        await Promise.all(all.map(function(t){
            var c=cache[t.id];
            if(c&&c.u===t.updated_at&&c.ar!==undefined){
                t._reqName=c.rn;t._company=c.co;if(!c.ar)noReply.push(t);return Promise.resolve();
            }
            return get('tickets/'+t.id+'?include=stats,requester,company').then(function(d){
                var replied=!!(d.stats&&d.stats.agent_responded_at);
                t._reqName=d.requester?d.requester.name:'Unknown';
                t._company=coName(d);
                cache[t.id]={u:t.updated_at,rn:t._reqName,co:t._company,ar:d.stats?d.stats.agent_responded_at:null};
                if(!replied)noReply.push(t);
            }).catch(function(){noReply.push(t)});
        }));
        try{localStorage.setItem('fd_cache_new',JSON.stringify(cache))}catch(e){}
        D.newTks=noReply.sort(function(a,b){return a.created_at<b.created_at?-1:a.created_at>b.created_at?1:0});
        D._earlyNewIds=null;
        updateNewBadge();
    }catch(e){D.newTks=[];updateNewBadge()}
}

function updateNewBadge(){
    const c=D.newTks.length;
    const badge=document.getElementById('new-badge');
    if(c>0){badge.textContent=c;badge.style.display='inline-flex'}
    else{badge.style.display='none'}
}

function applyFilter(){
    var newIds=D._earlyNewIds||new Set(D.newTks.map(function(t){return t.id}));
    _newIdSet=newIds;
    if(D.fl==='new'){
        D.tks=D.newTks.slice();
    }
    else if(D.fl===2)D.tks=D.allOpen.filter(t=>D.lr[t.id]===true&&!D.pending.has(t.id)&&!newIds.has(t.id)).sort(function(a,b){return a.updated_at<b.updated_at?-1:a.updated_at>b.updated_at?1:0});
    else if(D.fl===4)D.tks=D.allOpen.filter(t=>D.pending.has(t.id)).sort(function(a,b){return b.updated_at<a.updated_at?-1:b.updated_at>a.updated_at?1:0});
    else if(D.fl===3)D.tks=D.allOpen.filter(t=>D.lr[t.id]===false&&!D.pending.has(t.id)&&!newIds.has(t.id)).sort(function(a,b){return b.updated_at<a.updated_at?-1:b.updated_at>a.updated_at?1:0});
    else D.tks=D.allOpen.slice().sort(function(a,b){return b.created_at<a.created_at?-1:b.created_at>a.created_at?1:0});
    D.pgs=1;
    rl();up();
    function setBadge(id,c){var b=document.getElementById(id);if(c>0){var changed=b.textContent!==String(c);b.textContent=c;b.style.display='inline-flex';if(changed){b.style.animation='none';b.offsetHeight;b.style.animation='countPulse .3s ease'}}else{b.style.display='none'}}
    var turnC=0,pendC=0,waitC=0;
    D.allOpen.forEach(function(t){if(D.pending.has(t.id))pendC++;else if(newIds.has(t.id)){}else if(D.lr[t.id]===true)turnC++;else if(D.lr[t.id]===false)waitC++});
    setBadge('turn-badge',turnC);
    setBadge('pend-badge',pendC);
    setBadge('wait-badge',waitC);
    setBadge('all-badge',D.allOpen.length);
}

async function load(){
    document.getElementById('list').innerHTML='<div class="loading-msg">Loading</div>';
    try{
        if(D.aid){
            if(D.fl==='new'){if(D.newTks.length===0)await loadNewTickets();applyFilter()}
            else if(D.allOpen.length===0){await loadAll()}
            else{applyFilter()}
        }else{
            D.tks=await get('tickets?per_page=100&page='+D.pg+'&order_by=updated_at&order_type=desc&include=requester');
            rl();up();
        }
    }catch(e){document.getElementById('list').innerHTML='<div class="empty-msg">'+esc(e.message)+'</div>'}
}

var _newIdSet=new Set();
function rl(){
    var el=document.getElementById('list');
    if(!D.tks.length){el.innerHTML='<div class="empty-msg">No tickets</div>';return}
    var curId=D.cur?D.cur.id:0,now=Date.now(),h='';
    for(var j=0;j<D.tks.length;j++){
        var t=D.tks[j];
        var ac=t.id===curId?' active':'';
        var rq=t._reqName||(t.requester?t.requester.name:'Unknown');
        var co=t._company||'';
        var sub=co?(esc(rq)+' &middot; '+esc(co)):esc(rq);
        var ind='',ic='';
        if(_newIdSet.has(t.id)){ind='new';ic='NEW'}
        else if(D.pending.has(t.id)){ind='pend';ic='PENDING'}
        else if(D.lr[t.id]===true){ind='yours';ic='YOUR TURN'}
        else if(D.lr[t.id]===false){ind='wait';ic='WAITING'}
        h+='<div class="tkt'+ac+'" onclick="sel('+t.id+')" onmouseenter="prefetch('+t.id+')" oncontextmenu="return tkCtx(event,'+t.id+')"><div class="pri" style="background:'+(PC[t.priority]||'var(--g300)')+'"></div><div class="col"><div class="ttl">#'+t.id+' '+esc(t.subject||'')+'</div><div class="sub">'+sub+'</div></div><div class="right"><div class="time">'+ago(new Date(t.updated_at))+'</div>'+(ind?'<div class="indicator '+ind+'">'+ic+'</div>':'')+'</div></div>';
    }
    el.innerHTML=h;
}
function rlActive(id){
    var prev=document.querySelector('.tkt.active');
    if(prev)prev.classList.remove('active');
    var all=document.getElementById('list').children;
    for(var i=0;i<all.length;i++){if(all[i].getAttribute('onclick')==='sel('+id+')')all[i].classList.add('active')}
}

function tkCtx(e,id){
    e.preventDefault();
    var old=document.getElementById('tk-ctx');if(old)old.remove();
    var isPend=D.pending.has(id);
    var isYours=D.lr[id]===true&&!isPend;
    var isWait=D.lr[id]===false&&!isPend;
    if(!isYours&&!isWait&&!isPend)return false;
    var m=document.createElement('div');m.id='tk-ctx';m.className='ctx-menu';
    m.style.left=e.clientX+'px';m.style.top=e.clientY+'px';
    if(isYours){
        var opt=document.createElement('div');opt.textContent='Move to Pending';
        opt.onclick=function(){m.remove();markPending(id)};m.appendChild(opt);
    }else if(isWait){
        var opt=document.createElement('div');opt.textContent='Move to Pending';
        opt.onclick=function(){m.remove();D.pending.add(id);savePending();applyFilter()};m.appendChild(opt);
    }else{
        var back=D.lr[id]===false?'Move back to Waiting':'Move back to My Turn';
        var opt=document.createElement('div');opt.textContent=back;
        opt.onclick=function(){m.remove();unmarkPending(id)};m.appendChild(opt);
    }
    document.body.appendChild(m);
    var close=function(){if(m.parentNode)m.remove();document.removeEventListener('click',close)};
    setTimeout(function(){document.addEventListener('click',close,{once:true})},0);
    return false;
}
function savePending(){localStorage.setItem('fd_pending',JSON.stringify([...D.pending]))}
async function markPending(id){
    D.pending.add(id);savePending();
    try{await fetch('/fd/tickets/'+id,{method:'PUT',headers:{'X-FD-Key':D.key,'X-FD-Domain':D.dom,'Content-Type':'application/json'},body:JSON.stringify({status:3})})}catch(e){}
    applyFilter();
}
async function unmarkPending(id){
    D.pending.delete(id);savePending();
    if(D.lr[id]===true){
        try{await fetch('/fd/tickets/'+id,{method:'PUT',headers:{'X-FD-Key':D.key,'X-FD-Domain':D.dom,'Content-Type':'application/json'},body:JSON.stringify({status:8})})}catch(e){}
    }
    applyFilter();
}

/* =============== SEARCH / FILTERS / PAGER =============== */
async function doSearch(){
    const q=document.getElementById('inp-search').value.trim();
    if(!q){load();return}if(!D.key)return st('Connect first');
    document.getElementById('list').innerHTML='<div class="loading-msg">Searching</div>';
    document.querySelectorAll('.tabs button').forEach(b=>b.classList.remove('on'));
    try{
        if(/^\d+$/.test(q)){
            const t=await get('tickets/'+q+'?include=requester,company');
            t._reqName=t.requester?t.requester.name:'Unknown';
            t._company=coName(t);
            D.tks=[t];D.pg=1;D.pgs=1;
            rl();up();
            sel(t.id);
        }else{
            var ql=q.toLowerCase();
            var local=D.allOpen.concat(D.newTks||[]).filter(function(t){
                if(t.subject&&t.subject.toLowerCase().indexOf(ql)!==-1)return true;
                var rn=t._reqName||(t.requester?t.requester.name:'');
                if(rn&&rn.toLowerCase().indexOf(ql)!==-1)return true;
                var co=t._company||'';
                if(co&&co.toLowerCase().indexOf(ql)!==-1)return true;
                if(t.tags&&t.tags.some(function(tg){return tg.toLowerCase().indexOf(ql)!==-1}))return true;
                return false;
            });
            var seen={};
            D.tks=local.filter(function(t){if(seen[t.id])return false;seen[t.id]=true;return true});
            if(!D.tks.length){
                try{
                    var escaped=q.replace(/'/g,"\\'");
                    var qr2='"tag:\''+escaped+'\'"';
                    var d2=await get('search/tickets?query='+encodeURIComponent(qr2));
                    D.tks=(d2.results||[]);
                }catch(e){}
            }
            if(!D.tks.length){
                try{
                    var contacts=await get('contacts/autocomplete?term='+encodeURIComponent(q));
                    if(contacts&&contacts.length){
                        for(var ci=0;ci<Math.min(contacts.length,3);ci++){
                            try{
                                var cQ='"requester_id:'+contacts[ci].id+'"';
                                var cD=await get('search/tickets?query='+encodeURIComponent(cQ));
                                D.tks=D.tks.concat(cD.results||[]);
                            }catch(e){}
                        }
                    }
                }catch(e){}
            }
            D.tks.forEach(function(t){t._reqName=t.requester?t.requester.name:'Unknown';t._company=coName(t)});
            D.pg=1;D.pgs=Math.ceil(D.tks.length/30)||1;
            rl();up();
        }
    }catch(e){document.getElementById('list').innerHTML='<div class="empty-msg">'+esc(e.message)+'</div>'}
}
function filt(b,f){document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('on'));b.classList.add('on');D.fl=f;D.pg=1;document.getElementById('inp-search').value='';if(f==='new'){if(D.newTks.length>0){applyFilter()}else{load()}}else if(D.allOpen.length>0){applyFilter()}else{load()}}
async function refresh(){showProg(0,1);D.allOpen=[];D.lr={};D.newTks=[];D._earlyNewIds=null;_statsCache={ts:0,allT:null,myT:null};var cn=D._cacheNew||{};if(Object.keys(cn).length)D._earlyNewIds=new Set(Object.keys(cn).map(Number));D._cacheNew={};localStorage.removeItem('fd_cache_new');await Promise.all([loadNewTickets(),loadAll()]);applyFilter();setTimeout(loadStats,3000)}
function pg(d){D.pg+=d;if(D.pg<1)D.pg=1;load()}
function up(){document.getElementById('pgr').style.display='flex';document.getElementById('pb').disabled=D.pg<=1;document.getElementById('pn').disabled=D.pg>=D.pgs;document.getElementById('pi').textContent='Page '+D.pg}
