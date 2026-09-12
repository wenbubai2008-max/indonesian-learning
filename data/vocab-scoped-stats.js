(function(){
  if(window.__vocabScopedStatsLoaded)return;
  window.__vocabScopedStatsLoaded=true;

  function norm(s){return String(s||'').trim().toLowerCase();}
  function mem(){try{return JSON.parse(localStorage.getItem('indo_mem')||'{}')}catch(e){return {}}}
  function stateOf(m,word){const k=norm(word);return m[word]||m[k]||'';}
  function currentDb(){try{return Array.isArray(DB)?DB:[]}catch(e){return []}}
  function uniqueWords(arr){const seen=new Set();return (arr||[]).filter(x=>{const k=norm(x&&x.word);if(!k||seen.has(k))return false;seen.add(k);return true;});}
  function renderScopedStats(){
    const db=uniqueWords(currentDb()),m=mem();
    let known=0,review=0;
    db.forEach(x=>{const st=stateOf(m,x.word);if(st==='know')known++;else if(st==='fuzzy'||st==='dont')review++;});
    const kc=document.getElementById('knownCount');if(kc)kc.textContent=known;
    const rc=document.getElementById('reviewCount');if(rc)rc.textContent=review;
    const rt=document.getElementById('reviewTag');if(rt)rt.textContent=review+' 个';
    const sc=document.getElementById('sessionCount');
    if(sc&&typeof TODAY!=='undefined')sc.textContent=(Number(localStorage.getItem('done_'+TODAY+'_am')==='1')+Number(localStorage.getItem('done_'+TODAY+'_pm')==='1'))+' / 2';
  }

  const original=window.updateStats;
  window.updateStats=function(){
    try{renderScopedStats();}catch(e){if(typeof original==='function')original();}
  };
  try{updateStats=window.updateStats}catch(e){}

  function schedule(){setTimeout(renderScopedStats,0);setTimeout(renderScopedStats,80);}
  document.addEventListener('change',function(e){if(e.target&&e.target.id==='librarySelect')schedule();},true);
  window.addEventListener('weak-pool-changed',schedule);
  window.addEventListener('unknown-vocab-changed',schedule);
  window.addEventListener('storage',function(e){if(e.key==='indo_mem')schedule();});

  function bootObserver(){
    const st=document.getElementById('dbStatus');
    if(st)new MutationObserver(schedule).observe(st,{childList:true,subtree:true,characterData:true});
    schedule();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootObserver,{once:true});else bootObserver();
})();
