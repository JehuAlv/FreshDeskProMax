/* =============== SHAREPOINT =============== */
var _spLinksCache;
function getSPLink(ticketId){
    try{if(!_spLinksCache)_spLinksCache=JSON.parse(localStorage.getItem('fd_sp_links')||'{}');return _spLinksCache[ticketId]||null}catch(e){return null}
}
function openLatestSoftware(){
    const t=D.cur;
    if(!t||!t._company){alert('No company found for this ticket');return}
    const name=encodeURIComponent(t._company);
    const url='https://kohyoung-my.sharepoint.com/shared?id=%2Fpersonal%2Fky_mes_kohyoung_com%2FDocuments%2F%5BTEAM%5D%20MES%20Engineer%2F3%2E%20Accounts%2F'+name+'%2FSoftware&listurl=%2Fpersonal%2Fky_mes_kohyoung_com%2FDocuments';
    window.open(url,'_blank');
}
function saveSPLink(ticketId,link){
    try{if(!_spLinksCache)_spLinksCache=JSON.parse(localStorage.getItem('fd_sp_links')||'{}');_spLinksCache[ticketId]=link;localStorage.setItem('fd_sp_links',JSON.stringify(_spLinksCache))}catch(e){}
}
function copySPLink(ticketId){
    const link=getSPLink(ticketId);if(!link)return;
    try{navigator.clipboard.writeText(link)}catch(e){
        const ta=document.createElement('textarea');ta.value=link;ta.style.cssText='position:fixed;left:-9999px';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
    }
    const btn=document.querySelector('[onclick*="copySPLink('+ticketId+')"]');if(btn){btn.textContent='Copied!';setTimeout(()=>{btn.textContent='Copy link'},1500);}
}
function extractTicketEmails(){
    const exclude=new Set(['kya_support@kohyoung.com','kohyoungcomkya_support@kyexpert.freshdesk.com']);
    const emails=new Set();
    const t=D.cur;if(!t)return[];
    ['cc_emails','fwd_emails','reply_cc_emails','to_emails'].forEach(f=>{(t[f]||[]).forEach(e=>emails.add(e))});
    if(t.requester&&t.requester.email)emails.add(t.requester.email);
    (D.cvs||[]).forEach(c=>{
        if(c.from_email)emails.add(c.from_email);
        ['to_emails','cc_emails','bcc_emails'].forEach(f=>{(c[f]||[]).forEach(e=>emails.add(e))});
    });
    const parsed=new Set();
    emails.forEach(raw=>{const m=raw.match(/[\w.+\-]+@[\w.\-]+\.\w+/);if(m)parsed.add(m[0].toLowerCase())});
    return[...parsed].filter(e=>!exclude.has(e)&&!e.endsWith('.freshdesk.com'));
}

async function createSPFolder(ticketId){
    const btn=document.getElementById('sp-btn-'+ticketId);
    const lbl=document.getElementById('sp-status-'+ticketId);
    if(!btn)return;
    btn.disabled=true;
    btn.style.opacity='0.5';
    if(lbl)lbl.textContent='Creating...';
    try{
        const emails=extractTicketEmails();
        const resp=await fetch('/sharepoint',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({ticketId:ticketId,emails:emails})
        });
        const data=await resp.json();
        if(!resp.ok)throw new Error(data.error||'Server error '+resp.status);
        if(data.link){
            saveSPLink(ticketId,data.link);
            try{await navigator.clipboard.writeText(data.link)}catch(ce){
                const ta=document.createElement('textarea');ta.value=data.link;ta.style.cssText='position:fixed;left:-9999px';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
            }
            renderRight();
        }else{
            if(lbl)lbl.textContent=data.created?'Created (no link)':'Done';
        }
        const shared=data.shared||[];
        const failed=data.failed||[];
        if(shared.length||failed.length){
            let msg='Shared with: '+shared.join(', ');
            if(failed.length)msg+='\nFailed: '+failed.map(f=>f.email+' ('+f.error+')').join(', ');
            console.log('[SharePoint]',msg);
        }
        if(failed.length){
            const details=failed.map(f=>f.email+': '+f.error).join('\n');
            alert('SharePoint folder created, but sharing failed for:\n\n'+details+'\n\nThey may need to be added manually.');
        }
    }catch(e){
        if(lbl)lbl.textContent='Error: '+e.message;
        btn.style.opacity='1';
        btn.disabled=false;
        btn.style.color='#dc2626';btn.style.borderColor='#dc2626';
    }
}

function updateSPButton(ticketId,link){
    const old=document.getElementById('sp-btn-'+ticketId);
    if(!old)return;
    const g=document.createElement('span');
    g.className='btn-group';
    g.innerHTML='<a class="btn-fd btn-sp btn-gl" href="'+esc(link)+'" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>Open SharePoint Folder</a>'
        +'<button class="btn-fd btn-sp btn-gr" onclick="copySPLink('+ticketId+')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copy link</button>';
    old.replaceWith(g);
}
