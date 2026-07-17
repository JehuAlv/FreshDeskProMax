function st(m,ok){const e=document.getElementById('conn-status');e.textContent=m;e.className='conn-status'+(ok?' on':'')}
function coName(t){return (t.company&&t.company.name)?t.company.name:(t.custom_fields&&t.custom_fields.cf_rand61013?t.custom_fields.cf_rand61013:'')}
var _escMap={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
function esc(s){return s==null?'':String(s).replace(/[&<>"']/g,function(c){return _escMap[c]})}
function strip(h){return h?String(h).replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' '):''}
function trunc(s,n){return s&&s.length>n?s.substring(0,n)+'…':s||''}
function ago(d){const s=Math.floor((Date.now()-d)/1000);if(s<60)return'now';if(s<3600)return Math.floor(s/60)+'m';if(s<86400)return Math.floor(s/3600)+'h';return Math.floor(s/86400)+'d'}
function safe(h){const d=document.createElement('div');d.innerHTML=h;d.querySelectorAll('script,style,iframe,object,embed,form,input').forEach(e=>e.remove());d.querySelectorAll('*').forEach(e=>{for(const a of[...e.attributes])if(a.name.startsWith('on'))e.removeAttribute(a.name)});return d.innerHTML}

function nameFromEmail(fe){
    if(!fe)return null;
    var nameMatch=fe.match(/^"?([^"<]+)"?\s*</);
    if(nameMatch){var n=nameMatch[1].trim();if(n&&n.indexOf('@')<0)return n.split(' ')[0]}
    var plain=fe.replace(/[<>]/g,'').trim();
    if(plain.indexOf('@')>=0){var local=plain.split('@')[0];var parts=local.split(/[._-]/);if(parts.length>=1){var name=parts[0].charAt(0).toUpperCase()+parts[0].slice(1);if(name.length>1)return name}}
    return null;
}

function formatFileSize(b){
    if(b<1024)return b+' B';
    if(b<1048576)return (b/1024).toFixed(1)+' KB';
    return (b/1048576).toFixed(1)+' MB';
}
