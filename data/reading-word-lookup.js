(function(){
  let popup=null;

  function ensureStyle(){
    if(document.getElementById('readingWordLookupStyle'))return;
    const st=document.createElement('style');
    st.id='readingWordLookupStyle';
    st.textContent=`
      .rw-popup{position:fixed;z-index:99999;min-width:150px;max-width:280px;background:#172033;color:#fff;border-radius:12px;padding:10px 13px;box-shadow:0 8px 28px rgba(0,0,0,.22);font-size:14px;line-height:1.45;pointer-events:none}
      .rw-word{font-weight:850;font-size:15px;margin-bottom:3px}.rw-cn{color:#f4f6fb}.rw-empty{color:#cbd2df}
      .rw-popup:after{content:"";position:absolute;left:18px;bottom:-6px;border-width:6px 6px 0;border-style:solid;border-color:#172033 transparent transparent}
    `;
    document.head.appendChild(st);
  }

  function hide(){
    if(popup){popup.remove();popup=null;}
  }

  function norm(s){
    return String(s||'')
      .trim()
      .toLowerCase()
      .replace(/^[^a-zA-ZÀ-ÿ]+|[^a-zA-ZÀ-ÿ-]+$/g,'');
  }

  function allWords(){
    const a=Array.isArray(window.EMBEDDED_DB)?window.EMBEDDED_DB:[];
    const b=Array.isArray(window.DAILY_VOCAB_DB)?window.DAILY_VOCAB_DB:[];
    return a.concat(b);
  }

  function lookup(raw){
    const w=norm(raw);
    if(!w)return null;
    const variants=[w];
    if(/-(ku|mu|nya)$/.test(w)) variants.push(w.replace(/-(ku|mu|nya)$/,''));
    if(/(ku|mu|nya)$/.test(w) && w.length>5) variants.push(w.replace(/(ku|mu|nya)$/,''));
    const words=allWords();
    for(const v of variants){
      const hit=words.find(x=>norm(x.word)===v || norm(x.display)===v || norm(x.audio_text)===v);
      if(hit) return {word:raw.trim(),cn:String(hit.cn||hit.zh||'').trim()};
    }
    return {word:raw.trim(),cn:''};
  }

  function show(raw,rect){
    const hit=lookup(raw);
    if(!hit)return;
    hide();ensureStyle();
    popup=document.createElement('div');
    popup.className='rw-popup';
    popup.innerHTML=`<div class="rw-word">${escapeHtml(hit.word)}</div><div class="${hit.cn?'rw-cn':'rw-empty'}">${escapeHtml(hit.cn||'暂无释义')}</div>`;
    document.body.appendChild(popup);
    const pw=popup.offsetWidth, ph=popup.offsetHeight;
    let left=Math.max(8,Math.min(window.innerWidth-pw-8,rect.left));
    let top=rect.top-ph-10;
    if(top<8) top=Math.min(window.innerHeight-ph-8,rect.bottom+10);
    popup.style.left=left+'px';popup.style.top=top+'px';
  }

  function escapeHtml(s){
    return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function handleSelection(){
    const sel=window.getSelection&&window.getSelection();
    if(!sel || sel.rangeCount===0 || sel.isCollapsed){hide();return;}
    const txt=sel.toString().trim();
    if(!txt || txt.length>40 || /\s/.test(txt)){hide();return;}
    const range=sel.getRangeAt(0);
    const node=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer.parentElement;
    if(!node || !node.closest || !node.closest('.rl-text')){hide();return;}
    const rect=range.getBoundingClientRect();
    if(!rect || (!rect.width&&!rect.height)){hide();return;}
    show(txt,rect);
  }

  document.addEventListener('mouseup',()=>setTimeout(handleSelection,0));
  document.addEventListener('touchend',()=>setTimeout(handleSelection,80));
  document.addEventListener('mousedown',e=>{if(!e.target.closest('.rw-popup'))hide();});
  document.addEventListener('scroll',hide,true);
})();
