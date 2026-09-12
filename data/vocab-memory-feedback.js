(function(){
  const MEM_KEY='indo_mem';
  let installed=false, syncing=false;
  function norm(w){return String(w||'').trim().toLowerCase()}
  function mem(){try{return JSON.parse(localStorage.getItem(MEM_KEY)||'{}')}catch(e){return {}}}
  function statusOf(m,w){const k=norm(w);return m[w]||m[k]||''}
  function unique(arr){const seen=new Set();return (arr||[]).filter(x=>x&&x.word&&!seen.has(norm(x.word))&&seen.add(norm(x.word)))}
  function currentKey(){return document.getElementById('librarySelect')?.value||localStorage.getItem('selected_vocab_library')||'top1000'}
  function sourceFor(key){
    if(key==='master')return unique(typeof window.getEffectiveMasterVocabulary==='function'?window.getEffectiveMasterVocabulary():(window.MASTER_VOCAB_OBJECTS||[]));
    if(key==='daily')return unique(window.DAILY_VOCAB_DB||[]);
    if(key==='unknown')return unique(typeof window.getUnfamiliarVocabulary==='function'?window.getUnfamiliarVocabulary():[]);
    return unique(window.EMBEDDED_DB||[]);
  }
  function labelFor(key){return key==='master'?'主学习词库':key==='daily'?'每日学习词汇':key==='unknown'?'陌生词汇':'Top1000'}
  function stats(){
    const key=currentKey(),src=sourceFor(key),m=mem();let known=0,review=0;
    src.forEach(x=>{const s=statusOf(m,x.word);if(s==='know')known++;else if(s==='fuzzy'||s==='dont')review++;});
    return {key,src,total:src.length,known,review,unchecked:Math.max(0,src.length-known-review)};
  }
  function setText(id,value){const el=document.getElementById(id);if(el&&el.textContent!==String(value))el.textContent=String(value)}
  function setLabel(){const rc=document.getElementById('reviewCount');const card=rc?.closest('button');const span=card?.querySelector('span');if(span&&span.textContent!=='不会')span.textContent='不会';if(card)card.title='查看当前词库“模糊 / 不会”的词汇'}
  function clearActive(){document.querySelectorAll('#statsBar .statAction').forEach(x=>x.classList.remove('vocabStatActive'))}
  function applyActive(){
    clearActive();const mode=localStorage.getItem('vocab_view_mode')||'';
    if(mode==='known')document.getElementById('knownCount')?.closest('button')?.classList.add('vocabStatActive');
    if(mode==='review')document.getElementById('reviewCount')?.closest('button')?.classList.add('vocabStatActive');
  }
  function sync(){
    if(syncing)return;syncing=true;
    try{
      const s=stats();setText('vocabCount',s.total);setText('knownCount',s.known);setText('reviewCount',s.review);setLabel();
      const st=document.getElementById('dbStatus'),mode=localStorage.getItem('vocab_view_mode')||'';
      if(st){
        let text='';
        if(mode==='known')text=labelFor(s.key)+' · 已掌握 '+s.known+' 词（查看中）';
        else if(mode==='review')text=labelFor(s.key)+' · 不会 '+s.review+' 词（查看中）';
        else text=labelFor(s.key)+' · '+s.unchecked+' 未判断 · '+s.review+' 不会 · '+s.known+' 已掌握 · '+s.total+' 总词';
        if(st.textContent!==text)st.textContent=text;
      }
      applyActive();
    }finally{syncing=false;}
  }
  function addStyle(){
    if(document.getElementById('vocabViewStateStyle'))return;
    const s=document.createElement('style');s.id='vocabViewStateStyle';s.textContent=`#statsBar .statAction.vocabStatActive{border-color:#3157d5!important;background:#eef3ff!important;box-shadow:0 0 0 2px rgba(49,87,213,.10) inset!important}#statsBar .statAction.vocabStatActive span,#statsBar .statAction.vocabStatActive b{color:#2445b7!important}`;document.head.appendChild(s);
  }
  function install(){
    if(installed)return;installed=true;addStyle();
    const known=document.getElementById('knownCount')?.closest('button'),review=document.getElementById('reviewCount')?.closest('button');
    if(known)known.addEventListener('click',()=>setTimeout(sync,0),true);
    if(review)review.addEventListener('click',()=>setTimeout(sync,0),true);
    document.getElementById('librarySelect')?.addEventListener('change',()=>setTimeout(sync,0));
    document.querySelector('#vocab .toolbar')?.addEventListener('click',e=>{if(e.target?.tagName==='BUTTON'&&(e.target.textContent||'').includes('重新加载'))setTimeout(sync,30)});
    const statsBar=document.getElementById('statsBar');if(statsBar)new MutationObserver(()=>{if(!syncing)requestAnimationFrame(sync)}).observe(statsBar,{subtree:true,childList:true,characterData:true});
    const dbStatus=document.getElementById('dbStatus');if(dbStatus)new MutationObserver(()=>{if(!syncing)requestAnimationFrame(sync)}).observe(dbStatus,{subtree:true,childList:true,characterData:true});
    window.addEventListener('storage',e=>{if(e.key===MEM_KEY)setTimeout(sync,0)});
    window.addEventListener('vocab-library-ready',()=>setTimeout(sync,0));
    window.addEventListener('master-top1000-weak-merged',()=>setTimeout(sync,0));
    setTimeout(sync,150);
  }
  if(document.readyState==='complete')setTimeout(install,120);else window.addEventListener('load',()=>setTimeout(install,120),{once:true});
})();
(function(){
  if(document.querySelector('script[data-master-top1000-weak-merge]'))return;
  const s=document.createElement('script');
  s.src='data/master-top1000-weak-merge.js?v=20260913-1';
  s.dataset.masterTop1000WeakMerge='1';
  document.head.appendChild(s);
})();