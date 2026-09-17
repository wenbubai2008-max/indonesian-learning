(function(){
  if(window.__VOCAB_UNIFIED_UI_GUARD_20260917__)return;
  window.__VOCAB_UNIFIED_UI_GUARD_20260917__=true;

  const unifiedRender=window.renderVocab;
  if(typeof unifiedRender!=='function')return;
  let busy=false;

  function hasWords(){try{return Array.isArray(FILTER)&&FILTER.length>0}catch(e){return false}}
  function flashMode(){const m=document.getElementById('mode');return !m||m.value!=='quiz'}
  function box(){return document.getElementById('vocabBox')}
  function isBipa(){
    const s=document.getElementById('librarySelect');
    const t=s&&s.selectedIndex>=0?String(s.options[s.selectedIndex]?.textContent||''):'';
    return /BIPA\s*[（(]?\s*(A1|A2|B1|B2)/i.test(t);
  }
  function syncSection(){
    const sec=document.getElementById('vocab');if(!sec)return;
    sec.classList.remove('bipaStable','bipaSwitching');
    sec.classList.toggle('bipaFinalV7',isBipa());
  }

  function restore(){
    if(busy)return;
    syncSection();
    const b=box();if(!b)return;
    window.renderVocab=unifiedRender;try{renderVocab=unifiedRender}catch(e){}
    if(!flashMode()||!hasWords())return;
    if(b.querySelector(':scope > .vocabUnifiedCard'))return;
    busy=true;
    try{unifiedRender()}finally{queueMicrotask(function(){busy=false})}
  }

  const b=box();
  if(b)new MutationObserver(restore).observe(b,{childList:true,subtree:false});

  document.addEventListener('click',function(e){
    if(!e.target.closest('#vocab'))return;
    setTimeout(restore,0);
  },true);
  document.addEventListener('change',function(e){
    if(!e.target.closest('#vocab'))return;
    setTimeout(restore,0);
  },true);
  document.addEventListener('input',function(e){
    if(!e.target.closest('#vocab'))return;
    setTimeout(restore,0);
  },true);
  window.addEventListener('vocab-library-ready',function(){setTimeout(restore,0)});
  [0,100,300,800,1800,3500].forEach(function(ms){setTimeout(restore,ms)});
})();