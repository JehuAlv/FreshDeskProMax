function toggleKey(){const i=document.getElementById('inp-key');i.type=i.type==='password'?'text':'password'}

var _q=[],_qPri=[],_qRun=0,_qPriRun=0,_qMax=6,_qNormMax=4;
function _qFlush(){
    while(_qPri.length&&_qRun<_qMax){_qRun++;_qPriRun++;var pj=_qPri.shift();pj()}
    while(_q.length&&_qRun<_qMax&&(_qRun-_qPriRun)<_qNormMax){_qRun++;var nj=_q.shift();nj()}
}
function api(p,opts){
    opts=opts||{};
    var isPri=!!opts.priority;
    return new Promise(function(resolve,reject){
        var fn=function(){
            var retries=0;
            function attempt(){
                var init={headers:{'X-FD-Key':D.key,'X-FD-Domain':D.dom}};
                if(opts.method){init.method=opts.method;init.headers['Content-Type']='application/json'}
                if(opts.body)init.body=opts.body;
                fetch('/fd/'+p,init).then(function(r){
                    if(r.status===429&&retries<3){
                        retries++;
                        var ra=r.headers.get('Retry-After');
                        var wait=ra?parseInt(ra)*1000:Math.pow(2,retries)*1000;
                        setTimeout(attempt,wait);return;
                    }
                    _qRun--;if(isPri)_qPriRun--;_qFlush();
                    if(!r.ok){reject(new Error('API '+r.status));return}
                    resolve(r);
                }).catch(function(e){_qRun--;if(isPri)_qPriRun--;_qFlush();reject(e)});
            }
            attempt();
        };
        if(isPri){_qPri.push(fn)}else{_q.push(fn)}
        _qFlush();
    });
}
async function get(p,opts){return(await api(p,opts)).json()}

async function connect(){
    D.key=document.getElementById('inp-key').value.trim();
    D.dom=document.getElementById('inp-domain').value.trim();
    if(!D.key||!D.dom)return st('Enter key & domain');
    st('Connecting...');
    try{
        const me=await get('agents/me');D.aid=me.id;D.anm=me.contact?me.contact.name:'Agent';D.sig=me.signature||'';
        localStorage.setItem('fd_apikey',D.key);st(D.anm,1);
        D._cacheNew=JSON.parse(localStorage.getItem('fd_cache_new')||'{}');
        if(Object.keys(D._cacheNew).length)D._earlyNewIds=new Set(Object.keys(D._cacheNew).map(Number));
        await Promise.all([loadNewTickets(),load()]);
        loadStats();
        AIPipeline.loadIndex();
        if(!D._newPoll)D._newPoll=setInterval(()=>{refresh()},300000);
    }catch(e){
        if(e.message.includes('404')){try{await get('tickets?per_page=1');localStorage.setItem('fd_apikey',D.key);st('Connected',1);load()}catch(e2){st('Failed')}}
        else st('Failed: '+e.message);
    }
}
