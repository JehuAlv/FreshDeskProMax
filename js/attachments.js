/* ===== ATTACHMENT HELPERS ===== */
window._attachments=[];

function addAttachment(file){
    if(file.size>20971520){alert('Max 20 MB per file');return}
    var entry={file:file,preview:null,resized:null,sizeLabel:'M'};
    if(file.type&&file.type.startsWith('image/')){
        entry.preview=URL.createObjectURL(file);
        resizeImage(window._attachments.length,800,entry);
    }
    window._attachments.push(entry);
    renderAttachList('attach-list');
    updateSendBtn();
}

function removeAttachment(idx){
    var a=window._attachments[idx];
    if(a&&a.preview)URL.revokeObjectURL(a.preview);
    window._attachments.splice(idx,1);
    renderAttachList('attach-list');
    renderAttachList('modal-attach-list');
    updateSendBtn();
}

function resizeImage(idx,maxW,entry){
    var a=entry||window._attachments[idx];
    if(!a||!a.file.type.startsWith('image/'))return;
    var img=new Image();
    img.onload=function(){
        if(maxW>=img.width){a.resized=null;a.sizeLabel=maxW<=400?'S':maxW<=800?'M':'O';renderAttachList('attach-list');renderAttachList('modal-attach-list');return}
        var ratio=maxW/img.width;
        var cv=document.createElement('canvas');
        cv.width=maxW;cv.height=Math.round(img.height*ratio);
        cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
        cv.toBlob(function(blob){
            if(blob){
                a.resized=new File([blob],a.file.name,{type:a.file.type});
                a.sizeLabel=maxW<=400?'S':maxW<=800?'M':'O';
                renderAttachList('attach-list');
                renderAttachList('modal-attach-list');
            }
        },a.file.type,0.85);
    };
    img.src=a.preview||URL.createObjectURL(a.file);
}

function renderAttachList(containerId){
    var el=document.getElementById(containerId);
    if(!el)return;
    if(!window._attachments.length){el.innerHTML='';return}
    var h='';
    window._attachments.forEach(function(a,i){
        var sz=formatFileSize(a.resized?a.resized.size:a.file.size);
        var isImg=a.file.type&&a.file.type.startsWith('image/');
        h+='<div class="attach-chip">';
        if(isImg&&a.preview)h+='<img class="attach-thumb" src="'+a.preview+'">';
        h+='<div class="attach-info"><span class="attach-name">'+a.file.name.replace(/</g,'&lt;')+'</span>';
        h+='<span class="attach-size">'+sz+'</span>';
        if(isImg){
            h+='<div class="attach-resize">';
            h+='<button class="'+(a.sizeLabel==='S'?'active':'')+'" onclick="event.stopPropagation();resizeImage('+i+',400)">S</button>';
            h+='<button class="'+(a.sizeLabel==='M'?'active':'')+'" onclick="event.stopPropagation();resizeImage('+i+',800)">M</button>';
            h+='<button class="'+(a.sizeLabel==='O'?'active':'')+'" onclick="event.stopPropagation();resizeImage('+i+',99999)">Original</button>';
            h+='</div>';
        }
        h+='</div><button class="attach-rm" onclick="removeAttachment('+i+')">&times;</button></div>';
    });
    el.innerHTML=h;
}

function updateSendBtn(){
    var btn=document.getElementById('custom-send');
    var ta=document.getElementById('custom-reply');
    if(btn&&ta)btn.disabled=!ta.value.trim()&&!window._attachments.length;
}

function handleDrop(e){
    var files=e.dataTransfer.files;
    for(var i=0;i<files.length;i++)addAttachment(files[i]);
}

function handlePaste(e){
    var items=e.clipboardData&&e.clipboardData.items;
    if(!items)return;
    for(var i=0;i<items.length;i++){
        if(items[i].type.indexOf('image/')===0){
            var file=items[i].getAsFile();
            if(file){
                e.preventDefault();
                addAttachment(file);
                return;
            }
        }
    }
}

function handleFileInput(input){
    if(!input.files)return;
    for(var i=0;i<input.files.length;i++)addAttachment(input.files[i]);
    input.value='';
}
