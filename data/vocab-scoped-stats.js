(function(){
  if(window.__vocabScopedStatsLoaded)return;
  window.__vocabScopedStatsLoaded=true;

  function norm(s){return String(s||'').trim().toLowerCase();}
  function mem(){try{return JSON.parse(localStorage.getItem('indo_mem')||'{}')}catch(e){return {}}}
  function stateOf(m,word){const k=norm(word);return m[word]||m[k]||'';}
  function uniqueWords(arr){const seen=new Set();return (arr||[]).filter(x=>{const k=norm(x&&x.word);if(!k||seen.has(k))return false;seen.add(k);return true;});}
  function isMasterSelected(){const sel=document.getElementById('librarySelect');return !!sel&&sel.value==='master';}
  function currentDb(){
    try{
      if(isMasterSelected()&&Array.isArray(window.MASTER_VOCAB_DB)&&window.MASTER_VOCAB_DB.length)return uniqueWords(window.MASTER_VOCAB_DB);
      return uniqueWords(Array.isArray(DB)?DB:[]);
    }catch(e){return []}
  }
  function counts(){
    const db=currentDb(),m=mem();let known=0,review=0;
    db.forEach(x=>{const st=stateOf(m,x.word);if(st==='know')known++;else if(st==='fuzzy'||st==='dont')review++;});
    return {total:db.length,known:known,review:review,unchecked:Math.max(0,db.length-known-review)};
  }
  function setText(id,text){const el=document.getElementById(id);if(el&&String(el.textContent)!==String(text))el.textContent=text;}
  function renderScopedStats(){
    const c=counts();
    setText('vocabCount',c.total);
    setText('knownCount',c.known);
    setText('reviewCount',c.review);
    setText('reviewTag',c.review+' 个');
    const st=document.getElementById('dbStatus');
    if(st&&isMasterSelected()){
      const text='主学习词库 · '+c.unchecked+' 未核对 · '+c.review+' 待复习 · '+c.known+' 已掌握 · '+c.total+' 总词';
      if(st.textContent!==text)st.textContent=text;
    }
    const sc=document.getElementById('sessionCount');
    if(sc&&typeof TODAY!=='undefined')sc.textContent=(Number(localStorage.getItem('done_'+TODAY+'_am')==='1')+Number(localStorage.getItem('done_'+TODAY+'_pm')==='1'))+' / 2';
    return c;
  }
  window.renderScopedStats=renderScopedStats;

  const original=window.updateStats;
  window.updateStats=function(){
    try{return renderScopedStats();}catch(e){if(typeof original==='function')return original();}
  };
  try{updateStats=window.updateStats}catch(e){}

  let queued=false;
  function schedule(){
    if(queued)return;queued=true;
    setTimeout(function(){queued=false;renderScopedStats();},0);
    setTimeout(renderScopedStats,80);
    setTimeout(renderScopedStats,350);
  }
  document.addEventListener('change',function(e){if(e.target&&e.target.id==='librarySelect')schedule();},true);
  document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('#vocabBox .memory'))setTimeout(schedule,240);},true);
  window.addEventListener('weak-pool-changed',schedule);
  window.addEventListener('unknown-vocab-changed',schedule);
  window.addEventListener('storage',function(e){if(e.key==='indo_mem')schedule();});

  function bootObserver(){
    ['dbStatus','knownCount','reviewCount','vocabCount'].forEach(function(id){
      const el=document.getElementById(id);if(el)new MutationObserver(function(){if(isMasterSelected())schedule();}).observe(el,{childList:true,subtree:true,characterData:true});
    });
    [0,100,300,700,1500].forEach(function(ms){setTimeout(renderScopedStats,ms);});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootObserver,{once:true});else bootObserver();
  window.addEventListener('load',function(){[0,150,500].forEach(function(ms){setTimeout(renderScopedStats,ms);});},{once:true});
})();