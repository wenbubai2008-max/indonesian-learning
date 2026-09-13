(function(){
  if(window.__BIPA_PROGRESS_FIX_20260913__)return;
  window.__BIPA_PROGRESS_FIX_20260913__=true;

  const $=id=>document.getElementById(id);
  const norm=s=>String(s||'').trim().toLowerCase();
  const oldMark=window.mark;
  const oldShowKnown=window.showKnownWords;

  function libText(){
    const s=$('librarySelect');
    return s&&s.options&&s.selectedIndex>=0?String(s.options[s.selectedIndex].textContent||''):'';
  }
  function level(){
    const m=libText().match(/BIPA\s*[（(]?\s*(A1|A2|B1|B2)/i);
    return m?m[1].toUpperCase():'';
  }
  function isBipa(){return !!level()}
  function memoryKey(){return 'indo_bipa_mem_'+level()}
  function getMem(){
    if(!isBipa())return {};
    try{return JSON.parse(localStorage.getItem(memoryKey())||'{}')}catch(e){return {}}
  }
  function saveMem(m){if(isBipa())localStorage.setItem(memoryKey(),JSON.stringify(m||{}))}
  function statusOf(m,w){return m[norm(w)]||''}
  function raw(word){
    const lv=level(),rows=(window.BIPA_VOCAB_RAW&&window.BIPA_VOCAB_RAW[lv])||[];
    const r=rows.find(x=>Array.isArray(x)&&norm(x[0])===norm(word));
    if(!r)return null;
    return {word:r[0]||'',cn:r[1]||'',en:r[2]||'',root:r[3]||'',theme:r[5]||'',sab:String(r[8]||'').toUpperCase()};
  }
  function source(){try{return (DB||[]).slice()}catch(e){return []}}
  function currentItem(){
    try{
      const a=FILTER||[];if(!a.length)return null;
      const i=((Number(idx||0)%a.length)+a.length)%a.length;
      return a[i]||null;
    }catch(e){return null}
  }
  function updateStats(){
    if(!isBipa())return;
    const src=source(),m=getMem();let known=0,review=0;
    src.forEach(x=>{const s=statusOf(m,x.word);if(s==='know')known++;else if(s==='fuzzy'||s==='dont')review++});
    const unchecked=Math.max(0,src.length-known-review);
    if($('vocabCount'))$('vocabCount').textContent=src.length;
    if($('knownCount'))$('knownCount').textContent=known;
    if($('reviewCount'))$('reviewCount').textContent=review;
    if($('dbStatus'))$('dbStatus').textContent='BIPA（'+level()+'） · '+unchecked+' 未判断 · '+review+' 待复习 · '+known+' 已掌握 · '+src.length+' 总词';
    if($('vocabTag'))$('vocabTag').textContent='BIPA（'+level()+'） '+src.length+' 词';
  }
  function rebuild(resetIndex){
    if(!isBipa())return false;
    const q=String($('search')?.value||'').trim().toLowerCase();
    const c=$('cat')?.value||'';
    const sab=$('sabFilterStable')?.value||'';
    const mode=localStorage.getItem('vocab_view_mode')||'';
    const m=getMem();
    let src=source().filter(x=>{
      const st=statusOf(m,x.word);
      if(mode==='known'){if(st!=='know')return false}
      else if(mode==='review'){if(st!=='fuzzy'&&st!=='dont')return false}
      else if(st==='know'||st==='fuzzy'||st==='dont')return false;
      if(c&&!(x.categories||[]).includes(c))return false;
      const r=raw(x.word);
      if(sab&&(!r||r.sab!==sab))return false;
      if(q){
        const hay=[x.word,x.cn,x.en,x.root,r&&r.theme].join(' ').toLowerCase();
        if(!hay.includes(q))return false;
      }
      return !(x.categories||[]).includes('粗口/俚语');
    });
    try{
      const oldWord=!resetIndex&&currentItem()?.word;
      FILTER=src;
      if(resetIndex)idx=0;
      else if(src.length){
        const found=oldWord?src.findIndex(x=>norm(x.word)===norm(oldWord)):-1;
        if(found>=0)idx=found;else idx=Math.min(Number(idx||0),src.length-1);
      }else idx=0;
    }catch(e){}
    updateStats();
    try{window.renderVocab&&window.renderVocab()}catch(e){}
    return true;
  }

  function markBipa(v){
    if(!isBipa()){
      if(typeof oldMark==='function')return oldMark(v);
      return;
    }
    const x=currentItem();if(!x||!x.word)return;
    const m=getMem();m[norm(x.word)]=v;saveMem(m);
    // 标记后留在 BIPA 新版渲染链路，不再调用旧 setLibrary()/旧 render。
    rebuild(false);
  }
  window.mark=markBipa;try{mark=markBipa}catch(e){}

  const oldApply=window.applyFilter;
  function applyPatched(){
    if(isBipa())return rebuild(true);
    if(typeof oldApply==='function')return oldApply();
  }
  window.applyFilter=applyPatched;try{applyFilter=applyPatched}catch(e){}

  window.showKnownWords=function(){
    if(!isBipa())return typeof oldShowKnown==='function'?oldShowKnown():undefined;
    localStorage.setItem('vocab_view_mode','known');
    rebuild(true);
  };
  try{showKnownWords=window.showKnownWords}catch(e){}

  function enterBipa(){
    if(!isBipa())return;
    // BIPA 使用独立进度；旧词库 indo_mem 中同名词的历史状态不再继承。
    localStorage.removeItem('vocab_view_mode');
    setTimeout(()=>rebuild(true),40);
  }

  const lib=$('librarySelect');
  if(lib)lib.addEventListener('change',()=>setTimeout(()=>{if(isBipa())enterBipa()},220));
  const sab=$('sabFilterStable');if(sab)sab.addEventListener('change',()=>setTimeout(()=>rebuild(true),0));
  $('search')?.addEventListener('input',()=>{if(isBipa())setTimeout(()=>rebuild(true),0)});
  $('cat')?.addEventListener('change',()=>{if(isBipa())setTimeout(()=>rebuild(true),0)});
  window.addEventListener('vocab-library-ready',()=>setTimeout(()=>{if(isBipa())enterBipa()},260));
  setTimeout(()=>{if(isBipa())enterBipa()},320);
})();
