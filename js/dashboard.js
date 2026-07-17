var _statsRun=0,_statsCache={ts:0,allT:null,myT:null,resp6:null},_statsMerged=new Set(),_statsNoResp=new Set();
async function loadStats(){
    var run=++_statsRun;
    try{
        var yr=new Date().getFullYear(),now=new Date();
        var tags=["branchkya","KYA Internal"];
        var mes="cf_rand412401:'MES'";
        var el=document.getElementById('ticket-stats');
        var CK='fd_resp6';
        var cache=JSON.parse(localStorage.getItem(CK)||'{}');
        var merged=new Set();
        var noResp=new Set();
        Object.keys(cache).forEach(function(k){
            if(cache[k]==='merged')merged.add(Number(k));
            else if(!cache[k])noResp.add(Number(k));
        });
        _statsMerged=merged;_statsNoResp=noResp;

        function render(allT,myT){
            if(_statsRun!==run)return;
            var total=0,totalClosed=0,closed=0;
            allT.forEach(function(t){if(!merged.has(t.id)){total++;if(t.status===4||t.status===5){totalClosed++;if(t.responder_id===D.aid)closed++}}});
            var mine=0;
            myT.forEach(function(t){if(!noResp.has(t.id)&&!merged.has(t.id))mine++});
            var closedPct=totalClosed>0?Math.round(closed/totalClosed*100):0;
            var pct=total>0?Math.round(mine/total*100):0;
            var clr=pct>=30?'green':pct>=20?'amber':'red';
            var clrC=closedPct>=30?'green':closedPct>=20?'amber':'red';
            el.innerHTML='<span class="stat-group"><span class="stat-label">Assigned</span>'+mine+' / '+total+' <span class="pct '+clr+'">'+pct+'%</span></span><span class="stat-group"><span class="stat-label">Resolved</span>'+closed+' / '+totalClosed+' <span class="pct '+clrC+'">'+closedPct+'%</span></span>';
            el.title=D.anm+' '+yr+': Assigned '+mine+' de '+total+' ('+pct+'%) · Resolved '+closed+' de '+totalClosed+' ('+closedPct+'%)';
            el.style.display='';
        }

        var allT,myT;
        if(_statsCache.allT&&Date.now()-_statsCache.ts<900000){
            allT=_statsCache.allT;myT=_statsCache.myT;
        }else{
            async function pages(q){
                var out=[],pg=1;
                while(pg<=10){
                    try{
                        var d=await get('search/tickets?query='+encodeURIComponent(q)+'&page='+pg);
                        var r=d.results||[];out=out.concat(r);if(r.length<30)break;pg++;
                    }catch(e){break}
                }
                return out;
            }
            var qtr=[['-01-01','-04-01'],['-04-01','-07-01'],['-07-01','-10-01'],['-10-01','-01-01']];
            var queries=[];
            for(var i=0;i<4;i++){
                var ds=yr+qtr[i][0];
                if(new Date(ds)>now)break;
                var prev=new Date(ds);prev.setDate(prev.getDate()-1);
                var ps=prev.getFullYear()+'-'+String(prev.getMonth()+1).padStart(2,'0')+'-'+String(prev.getDate()).padStart(2,'0');
                var de=i<3?(yr+qtr[i][1]):((yr+1)+'-01-01');
                var df="created_at:>'"+ps+"' AND created_at:<'"+de+"'";
                for(var ti=0;ti<tags.length;ti++){
                    queries.push('"'+"tag:'"+tags[ti]+"' AND "+mes+' AND '+df+'"');
                }
            }
            if(_statsRun!==run)return;
            var results=await Promise.all(queries.map(function(q){return pages(q)}));

            var seen=new Set();allT=[];myT=[];
            var yrs=String(yr);
            for(var i=0;i<results.length;i++)results[i].forEach(function(t){
                if(!seen.has(t.id)&&t.created_at&&t.created_at.slice(0,4)===yrs){
                    seen.add(t.id);allT.push(t);
                    if(t.responder_id===D.aid)myT.push(t);
                }
            });
            _statsCache={ts:Date.now(),allT:allT,myT:myT,resp6:cache};
        }

        render(allT,myT);

        var myIds=new Set(myT.map(function(t){return t.id}));
        var unchecked=allT.filter(function(t){return !(t.id in cache)||cache[t.id]===false});
        if(unchecked.length>0){
            for(var b=0;b<unchecked.length;b+=5){
                if(_statsRun!==run)return;
                var batch=unchecked.slice(b,b+5);
                await Promise.all(batch.map(function(t){
                    return get('tickets/'+t.id+'/conversations?per_page=100').then(function(convs){
                        var cl=convs||[];
                        var last=cl.length?cl[cl.length-1]:null;
                        var isMerged=last&&last.private&&last.body_text&&last.body_text.indexOf('merged into ticket')!==-1;
                        if(isMerged){cache[t.id]='merged';merged.add(t.id);}
                        else{
                            var has=cl.some(function(c){return c.incoming===false&&!c.private});
                            cache[t.id]=has;
                            if(!has)noResp.add(t.id);
                        }
                    }).catch(function(){});
                }));
                render(allT,myT);
                if(b%25===0){try{localStorage.setItem(CK,JSON.stringify(cache))}catch(e){}}
                await new Promise(function(r){setTimeout(r,1500)});
            }
            try{localStorage.setItem(CK,JSON.stringify(cache))}catch(e){}
        }
    }catch(e){console.warn('loadStats',e)}
}

function animateNumbers(){
    document.querySelectorAll('[data-count]').forEach(function(el){
        var target=parseInt(el.getAttribute('data-count'),10);
        if(isNaN(target)||target===0){el.textContent='0';return}
        var duration=600,startTime=null;
        function step(ts){
            if(!startTime)startTime=ts;
            var p=Math.min((ts-startTime)/duration,1);
            var ease=1-Math.pow(1-p,3);
            el.textContent=Math.round(ease*target);
            if(p<1)requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    });
}

function animateBars(){
    requestAnimationFrame(function(){
        document.querySelectorAll('[data-width]').forEach(function(el){
            el.style.width=el.getAttribute('data-width');
        });
    });
}

function renderDashboard(){
    var allT=_statsCache.allT;
    if(!allT||!allT.length){document.getElementById('content').innerHTML='<div class="dash" style="text-align:center;padding-top:120px"><div class="dash-title">Loading Dashboard</div><p style="color:var(--g500);margin:16px 0 24px">Fetching ticket data...</p><div style="width:200px;height:4px;background:var(--g100);border-radius:2px;margin:0 auto;overflow:hidden"><div style="width:40%;height:100%;background:var(--blue);border-radius:2px;animation:barPulse 1.5s ease infinite"></div></div><style>@keyframes barPulse{0%{width:20%;margin-left:0}50%{width:50%;margin-left:25%}100%{width:20%;margin-left:80%}}</style></div>';document.getElementById('hdr').innerHTML='<div class="hdr-box"><h1>Dashboard</h1></div>';document.getElementById('tab-bar').innerHTML='';if(!D._dashWait){D._dashWait=setInterval(function(){if(_statsCache.allT&&_statsCache.allT.length){clearInterval(D._dashWait);D._dashWait=null;renderDashboard()}},500)}return}
    var merged=_statsMerged,noResp=_statsNoResp;
    var yr=new Date().getFullYear();
    var aMap=D._agentMap||{};
    var SRC={1:'Email',2:'Portal',3:'Phone',5:'Feedback Widget',7:'Chat',8:'Mobihelp',9:'Feedback Widget',10:'Outbound Email'};

    var totalRaw=allT.length;
    var mergedCount=0,noRespCount=0,tagBranch=0,tagInternal=0,tagBoth=0;
    var statusCounts={},agentData={},quarterCounts={},monthlyCounts={};
    var priorityCounts={},sourceCounts={},typeCounts={},companyCounts={},tagDetail={};
    var totalResolved=0,totalOpen=0;
    var mergedByAgent={},noRespByAgent={};

    allT.forEach(function(t){
        var isMerged=merged.has(t.id);
        var isNoResp=noResp.has(t.id)&&!isMerged;
        if(isMerged){mergedCount++;var mrid=t.responder_id||0;mergedByAgent[mrid]=(mergedByAgent[mrid]||0)+1;return}
        if(isNoResp){noRespCount++;var nrid=t.responder_id||0;noRespByAgent[nrid]=(noRespByAgent[nrid]||0)+1}

        var tags=(t.tags||[]).map(function(x){return x.toLowerCase()});
        var hasBranch=tags.indexOf('branchkya')!==-1;
        var hasInternal=tags.indexOf('kya internal')!==-1;
        if(hasBranch)tagBranch++;
        if(hasInternal)tagInternal++;
        if(hasBranch&&hasInternal)tagBoth++;
        tags.forEach(function(tg){
            if(tg==='branchkya'||tg==='kya internal')return;
            tagDetail[tg]=(tagDetail[tg]||0)+1;
        });

        var sn=SN[t.status]||('Status '+t.status);
        statusCounts[sn]=(statusCounts[sn]||0)+1;
        if(t.status===2||t.status===8)totalOpen++;

        var pn=PN[t.priority]||('P'+t.priority);
        priorityCounts[pn]=(priorityCounts[pn]||0)+1;

        var src=SRC[t.source]||('Source '+t.source);
        sourceCounts[src]=(sourceCounts[src]||0)+1;

        var tp=t.type||'(none)';
        typeCounts[tp]=(typeCounts[tp]||0)+1;

        var co=(t.custom_fields&&t.custom_fields.cf_rand61013)?t.custom_fields.cf_rand61013:'(unknown)';
        companyCounts[co]=(companyCounts[co]||0)+1;

        var rid=t.responder_id||0;
        if(!agentData[rid])agentData[rid]={name:aMap[rid]||(rid===0?'Unassigned':'Agent #'+rid),assigned:0,responded:0,resolved:0,closed:0,open:0,pending:0};
        agentData[rid].assigned++;
        if(!isNoResp)agentData[rid].responded++;
        if(t.status===4||t.status===5){agentData[rid].resolved++;totalResolved++;if(t.status===5)agentData[rid].closed++}
        if(t.status===2||t.status===8)agentData[rid].open++;
        if(t.status===3)agentData[rid].pending++;

        if(t.created_at){
            var m=parseInt(t.created_at.slice(5,7));
            var qk=m<=3?'Q1':m<=6?'Q2':m<=9?'Q3':'Q4';
            quarterCounts[qk]=(quarterCounts[qk]||0)+1;
            var mk=t.created_at.slice(0,7);
            monthlyCounts[mk]=(monthlyCounts[mk]||0)+1;
        }
    });

    var real=totalRaw-mergedCount;
    var agents=Object.keys(agentData).map(function(k){var o=agentData[k];o._rid=Number(k);return o}).sort(function(a,b){return b.assigned-a.assigned});
    var cache=_statsCache.resp6||JSON.parse(localStorage.getItem('fd_resp6')||'{}');
    var cacheKeys=Object.keys(cache);

    _ddFilters={};_ddNext=0;
    var kAll=_ddReg(function(){return true});
    var kReal=_ddReg(function(t){return !merged.has(t.id)});
    var kMerged=_ddReg(function(t){return merged.has(t.id)});
    var kNoResp=_ddReg(function(t){return noResp.has(t.id)&&!merged.has(t.id)});
    var kOpen=_ddReg(function(t){return !merged.has(t.id)&&(t.status===2||t.status===8)});
    var kResolved=_ddReg(function(t){return !merged.has(t.id)&&(t.status===4||t.status===5)});
    var kTagB=_ddReg(function(t){return (t.tags||[]).some(function(x){return x.toLowerCase()==='branchkya'})});
    var kTagI=_ddReg(function(t){return (t.tags||[]).some(function(x){return x.toLowerCase()==='kya internal'})});
    var kBoth=_ddReg(function(t){var tg=(t.tags||[]).map(function(x){return x.toLowerCase()});return tg.indexOf('branchkya')!==-1&&tg.indexOf('kya internal')!==-1});
    var kPending=_ddReg(function(t){return !merged.has(t.id)&&t.status===3});
    function dd(k,l){return "dashDrill('"+k+"','"+l.replace(/'/g,"\\'")+"')"}

    var totPend=agents.reduce(function(s,a){return s+a.pending},0);
    var SNR={};Object.keys(SN).forEach(function(k){SNR[SN[k]]=Number(k)});
    var PNR={};Object.keys(PN).forEach(function(k){PNR[PN[k]]=Number(k)});
    var SRCR={};Object.keys(SRC).forEach(function(k){SRCR[SRC[k]]=Number(k)});
    var months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    var h='<div class="dash">';
    h+='<div class="dash-title">MES Dashboard <span>'+yr+'</span></div>';

    h+='<div class="dash-heroes">';
    h+='<div class="dash-hero" onclick="'+dd(kAll,'All Tickets from API')+'">';
    h+='<div class="dh-num" data-count="'+totalRaw+'">0</div>';
    h+='<div class="dh-label">Total Tickets from API</div>';
    h+='<div class="dh-sub">';
    h+='<span class="dh-pill green" onclick="event.stopPropagation();'+dd(kReal,'Real Tickets (non-merged)')+'"><span data-count="'+real+'">0</span> real</span>';
    h+='<span class="dh-pill red" onclick="event.stopPropagation();'+dd(kMerged,'Merged Tickets')+'"><span data-count="'+mergedCount+'">0</span> merged</span>';
    h+='<span class="dh-pill orange" onclick="event.stopPropagation();'+dd(kNoResp,'No Agent Response')+'"><span data-count="'+noRespCount+'">0</span> no response</span>';
    h+='</div></div>';

    h+='<div class="dash-hero" onclick="'+dd(kResolved,'Resolved / Closed')+'">';
    h+='<div class="dh-num" data-count="'+totalResolved+'">0</div>';
    h+='<div class="dh-label">Resolved + Closed</div>';
    h+='<div class="dh-sub">';
    h+='<span class="dh-pill purple" onclick="event.stopPropagation();'+dd(kOpen,'Open Tickets')+'"><span data-count="'+totalOpen+'">0</span> open</span>';
    h+='<span class="dh-pill teal" onclick="event.stopPropagation();'+dd(kPending,'Pending Tickets')+'"><span data-count="'+totPend+'">0</span> pending</span>';
    h+='</div></div>';
    h+='</div>';

    h+='<div class="dash-pills">';
    h+='<span class="dp" onclick="'+dd(kTagB,'Tag: branchkya')+'"><strong>'+tagBranch+'</strong> branchkya</span>';
    h+='<span class="dp" onclick="'+dd(kTagI,'Tag: KYA Internal')+'"><strong>'+tagInternal+'</strong> KYA Internal</span>';
    h+='<span class="dp" onclick="'+dd(kBoth,'Both Tags')+'"><strong>'+tagBoth+'</strong> Both Tags</span>';
    h+='<span class="dp"><strong>'+cacheKeys.length+'/'+totalRaw+'</strong> cached</span>';
    h+='</div>';

    h+='<div class="dash-section">Agents</div>';
    h+='<div class="dash-agents">';
    agents.forEach(function(a,ai){
        var rid=a._rid;
        var aPct=real>0?Math.round(a.assigned/real*100):0;
        var nrCount=noRespByAgent[rid]||0;
        var mrCount=mergedByAgent[rid]||0;
        var kAsg=_ddReg(function(t){return !merged.has(t.id)&&(t.responder_id||0)===rid});
        var kRsp=_ddReg(function(t){return !merged.has(t.id)&&!noResp.has(t.id)&&(t.responder_id||0)===rid});
        var kNr=_ddReg(function(t){return !merged.has(t.id)&&noResp.has(t.id)&&(t.responder_id||0)===rid});
        var kMr=_ddReg(function(t){return merged.has(t.id)&&(t.responder_id||0)===rid});
        var kOp=_ddReg(function(t){return !merged.has(t.id)&&(t.status===2||t.status===8)&&(t.responder_id||0)===rid});
        var kPe=_ddReg(function(t){return !merged.has(t.id)&&t.status===3&&(t.responder_id||0)===rid});
        var kRe=_ddReg(function(t){return !merged.has(t.id)&&(t.status===4||t.status===5)&&(t.responder_id||0)===rid});
        var kCl=_ddReg(function(t){return !merged.has(t.id)&&t.status===5&&(t.responder_id||0)===rid});
        var nm=a.name;
        h+='<div class="dash-agent" style="animation-delay:'+(ai*60)+'ms">';
        h+='<div class="da-name" onclick="'+dd(kAsg,nm+' — Assigned')+'">'+esc(nm)+'</div>';
        h+='<div class="da-stats">';
        h+='<span class="da-chip assigned" onclick="'+dd(kAsg,nm+' — Assigned')+'">'+a.assigned+' assigned</span>';
        h+='<span class="da-chip responded" onclick="'+dd(kRsp,nm+' — Responded')+'">'+a.responded+' responded</span>';
        if(nrCount)h+='<span class="da-chip noresp" onclick="'+dd(kNr,nm+' — No Response')+'">'+nrCount+' no resp</span>';
        if(mrCount)h+='<span class="da-chip merged" onclick="'+dd(kMr,nm+' — Merged')+'">'+mrCount+' merged</span>';
        if(a.open)h+='<span class="da-chip open" onclick="'+dd(kOp,nm+' — Open')+'">'+a.open+' open</span>';
        if(a.pending)h+='<span class="da-chip pending" onclick="'+dd(kPe,nm+' — Pending')+'">'+a.pending+' pending</span>';
        h+='<span class="da-chip resolved" onclick="'+dd(kRe,nm+' — Resolved')+'">'+a.resolved+' resolved</span>';
        if(a.closed)h+='<span class="da-chip closed" onclick="'+dd(kCl,nm+' — Closed')+'">'+a.closed+' closed</span>';
        h+='</div>';
        h+='<div class="da-bar-wrap"><div class="da-bar-bg"><div class="da-bar-fill" data-width="'+aPct+'%" style="width:0"></div></div><div class="da-pct">'+aPct+'%</div></div>';
        h+='</div>';
    });
    h+='</div>';

    h+='<div class="dash-grid3">';

    h+='<div class="dash-mini"><div class="dm-title">Status</div>';
    var statusOrder=['Open','Pending','Resolved','Closed','ReOpen','On-hold','Waiting for local engineer'];
    function statusMini(s){
        var c=statusCounts[s]||0;if(!c)return;
        var sId=SNR[s];
        var k=_ddReg(function(t){return !merged.has(t.id)&&t.status===sId});
        h+='<div class="dm-row" onclick="'+dd(k,'Status: '+s)+'"><span class="dm-label">'+s+'</span><span class="dm-val">'+c+' <small style="color:var(--g400);font-weight:400">'+Math.round(c/real*100)+'%</small></span></div>';
    }
    statusOrder.forEach(statusMini);
    Object.keys(statusCounts).forEach(function(s){if(statusOrder.indexOf(s)===-1)statusMini(s)});
    h+='</div>';

    h+='<div class="dash-mini"><div class="dm-title">Priority</div>';
    ['Low','Medium','High','Urgent'].forEach(function(p){
        var c=priorityCounts[p]||0;if(!c)return;
        var pId=PNR[p];
        var k=_ddReg(function(t){return !merged.has(t.id)&&t.priority===pId});
        h+='<div class="dm-row" onclick="'+dd(k,'Priority: '+p)+'"><span class="dm-label">'+p+'</span><span class="dm-val">'+c+' <small style="color:var(--g400);font-weight:400">'+Math.round(c/real*100)+'%</small></span></div>';
    });
    h+='</div>';

    h+='<div class="dash-mini"><div class="dm-title">Source</div>';
    Object.keys(sourceCounts).sort(function(a,b){return sourceCounts[b]-sourceCounts[a]}).forEach(function(s){
        var c=sourceCounts[s];var sId=SRCR[s];
        var k=_ddReg(function(t){return !merged.has(t.id)&&t.source===sId});
        h+='<div class="dm-row" onclick="'+dd(k,'Source: '+s)+'"><span class="dm-label">'+s+'</span><span class="dm-val">'+c+' <small style="color:var(--g400);font-weight:400">'+Math.round(c/real*100)+'%</small></span></div>';
    });
    h+='</div>';

    h+='</div>';

    h+='<div class="dash-section">Tickets by Month</div>';
    var monthData=Object.keys(monthlyCounts).sort().map(function(mk){
        var mi=parseInt(mk.slice(5,7))-1;
        var k=_ddReg(function(t){return !merged.has(t.id)&&t.created_at&&t.created_at.slice(0,7)===mk});
        return{l:months[mi],v:monthlyCounts[mk],c:'var(--blue)',oc:dd(k,months[mi]+' '+yr)};
    });
    h+=barChart(monthData,'var(--blue)');

    h+='<div class="dash-section">Agent Comparison</div>';
    var agentBars=[];
    agents.forEach(function(a){
        if(a.name==='Unassigned')return;
        var rid=a._rid;
        var kA=_ddReg(function(t){return !merged.has(t.id)&&(t.responder_id||0)===rid});
        var kR=_ddReg(function(t){return !merged.has(t.id)&&(t.status===4||t.status===5)&&(t.responder_id||0)===rid});
        agentBars.push({l:a.name.split(' ')[0],v:a.assigned,c:'var(--blue)',oc:dd(kA,a.name+' — Assigned')});
        agentBars.push({l:'',v:a.resolved,c:'var(--green)',oc:dd(kR,a.name+' — Resolved')});
    });
    h+=barChart(agentBars);

    h+='<div class="dash-grid3">';

    h+='<div class="dash-mini"><div class="dm-title">By Quarter</div>';
    var qRanges={'Q1':[1,3],'Q2':[4,6],'Q3':[7,9],'Q4':[10,12]};
    ['Q1','Q2','Q3','Q4'].forEach(function(q){
        var c=quarterCounts[q]||0;if(!c)return;
        var r=qRanges[q];
        var k=_ddReg(function(t){if(merged.has(t.id)||!t.created_at)return false;var m=parseInt(t.created_at.slice(5,7));return m>=r[0]&&m<=r[1]});
        h+='<div class="dm-row" onclick="'+dd(k,q+' '+yr)+'"><span class="dm-label">'+q+'</span><span class="dm-val">'+c+' <small style="color:var(--g400);font-weight:400">'+Math.round(c/real*100)+'%</small></span></div>';
    });
    h+='</div>';

    h+='<div class="dash-mini"><div class="dm-title">By Month</div>';
    Object.keys(monthlyCounts).sort().forEach(function(mk){
        var c=monthlyCounts[mk];var mi=parseInt(mk.slice(5,7))-1;
        var k=_ddReg(function(t){return !merged.has(t.id)&&t.created_at&&t.created_at.slice(0,7)===mk});
        h+='<div class="dm-row" onclick="'+dd(k,months[mi]+' '+yr)+'"><span class="dm-label">'+months[mi]+'</span><span class="dm-val">'+c+' <small style="color:var(--g400);font-weight:400">'+Math.round(c/real*100)+'%</small></span></div>';
    });
    h+='</div>';

    h+='<div class="dash-mini"><div class="dm-title">Type</div>';
    Object.keys(typeCounts).sort(function(a,b){return typeCounts[b]-typeCounts[a]}).forEach(function(s){
        var c=typeCounts[s];
        var k=_ddReg(function(t){return !merged.has(t.id)&&(t.type||'(none)')===s});
        h+='<div class="dm-row" onclick="'+dd(k,'Type: '+s)+'"><span class="dm-label">'+s+'</span><span class="dm-val">'+c+' <small style="color:var(--g400);font-weight:400">'+Math.round(c/real*100)+'%</small></span></div>';
    });
    h+='</div>';

    h+='</div>';

    h+='<div class="dash-section">Top Companies</div>';
    var topCo=Object.keys(companyCounts).sort(function(a,b){return companyCounts[b]-companyCounts[a]}).slice(0,15);
    h+=barChart(topCo.map(function(co){
        var k=_ddReg(function(t){return !merged.has(t.id)&&(t.custom_fields&&t.custom_fields.cf_rand61013||'(unknown)')===co});
        return{l:co,v:companyCounts[co],c:'var(--purple)',oc:dd(k,co)};
    }));

    h+='<div class="dash-section">MES Tags</div>';
    var topTags=Object.keys(tagDetail).sort(function(a,b){return tagDetail[b]-tagDetail[a]});
    h+='<div class="dash-tags">';
    topTags.forEach(function(tg){
        var c=tagDetail[tg];
        var k=_ddReg(function(t){return !merged.has(t.id)&&(t.tags||[]).some(function(x){return x.toLowerCase()===tg})});
        h+='<span class="dash-tag" onclick="'+dd(k,'Tag: '+tg)+'"><strong>'+c+'</strong> '+esc(tg)+'</span>';
    });
    h+='</div>';

    var unchecked=allT.filter(function(t){return !(String(t.id) in cache)}).length;
    h+='<div class="dash-footer">Data: _statsCache ('+allT.length+' tickets) · Cache: fd_resp6 ('+cacheKeys.length+' entries, '+unchecked+' pending) · Age: '+Math.round((Date.now()-_statsCache.ts)/60000)+' min</div>';
    h+='</div>';

    document.getElementById('content').innerHTML=h;
    document.getElementById('hdr').innerHTML='<div class="hdr-box"><h1>Dashboard</h1><div class="chips"><span class="chip chip-open">'+yr+' MES Ticket Analytics</span></div></div>';
    document.getElementById('tab-bar').innerHTML='';
    animateNumbers();
    animateBars();
}

function barChart(data,color){
    var max=Math.max.apply(null,data.map(function(d){return d.v}))||1;
    var h='<div class="dash-chart">';
    data.forEach(function(d){
        var w=Math.round(d.v/max*100);
        var oc=d.oc?' onclick="'+d.oc+'"':'';
        h+='<div class="dash-chart-row"'+oc+'><span class="dash-chart-label" title="'+esc(d.l)+'">'+esc(d.l)+'</span><div class="dash-chart-bar-bg"><div class="dash-chart-bar-fill" data-width="'+w+'%" style="width:0;background:'+(d.c||color||'var(--blue)')+'"></div></div><span class="dash-chart-val">'+d.v+'</span></div>';
    });
    h+='</div>';
    return h;
}

var _ddFilters={};var _ddNext=0;
function _ddReg(fn){var k='_dd'+(++_ddNext);_ddFilters[k]=fn;return k}
function dashDrill(key,label){
    var fn=_ddFilters[key];if(!fn)return;
    var allT=_statsCache.allT;if(!allT)return;
    var tks=allT.filter(fn);
    var aMap=D._agentMap||{};
    var h='<div class="dash">';
    h+='<button class="dd-back" onclick="renderDashboard()">&larr; Back to Dashboard</button>';
    h+='<div class="dd-count">'+esc(label)+' &mdash; '+tks.length+' ticket'+(tks.length!==1?'s':'')+'</div>';
    tks.sort(function(a,b){return b.created_at<a.created_at?-1:b.created_at>a.created_at?1:0});
    var fdDomain=document.getElementById('inp-domain').value||'kyexpert.freshdesk.com';
    tks.forEach(function(t){
        var agent=aMap[t.responder_id]||'Unassigned';
        var co=(t.custom_fields&&t.custom_fields.cf_rand61013)||'';
        var tags=(t.tags||[]).join(', ');
        var sub=esc(agent)+(co?' &middot; '+esc(co):'');
        if(tags)sub+=' &middot; <span style="color:var(--g400)">'+esc(tags)+'</span>';
        h+='<div class="dd-tkt" onclick="window.open(\'https://'+fdDomain+'/a/tickets/'+t.id+'\',\'_blank\')">';
        h+='<div class="pri" style="background:'+(PC[t.priority]||'var(--g300)')+'"></div>';
        h+='<div class="col"><div class="ttl">#'+t.id+' '+esc(t.subject||'')+'</div><div class="sub">'+sub+'</div></div>';
        h+='<div class="right"><div class="time">'+ago(new Date(t.created_at))+'</div><span class="chip '+(SCLS[t.status]||'')+'" style="font-size:9px;padding:2px 8px">'+(SN[t.status]||t.status)+'</span></div>';
        h+='</div>';
    });
    if(!tks.length)h+='<div class="empty-msg">No tickets match this filter</div>';
    h+='</div>';
    document.getElementById('content').innerHTML=h;
    document.getElementById('hdr').innerHTML='<div class="hdr-box"><h1>'+esc(label)+'</h1><div class="chips"><span class="chip chip-open">'+tks.length+' tickets</span></div></div>';
    document.getElementById('tab-bar').innerHTML='';
}
