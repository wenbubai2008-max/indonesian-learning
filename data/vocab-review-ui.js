(function(){
  /*
   * Legacy review UI retired on 2026-09-17.
   * The old implementation is archived under archive/vocab-legacy/ and must not render cards.
   * Current 已掌握 / 待掌握 views are owned by vocab-unified-renderer-20260917.js.
   *
   * One non-renderer behavior from the retired file is still part of the approved vocabulary UI:
   * the old “今日完成 0/2” stat is not shown in the vocabulary page. Keep only that contract here
   * until index.html is fully simplified. Do not add any card renderer back to this file.
   */
  window.__VOCAB_REVIEW_UI_RETIRED_20260917__=true;

  function enforceStatsContract(){
    const bar=document.getElementById('statsBar');
    if(!bar)return;
    bar.style.gridTemplateColumns='repeat(3,minmax(0,1fr))';
    const session=document.getElementById('sessionCount');
    const card=session&&session.closest('.stat');
    if(card){
      card.hidden=true;
      card.style.display='none';
      card.setAttribute('aria-hidden','true');
      card.dataset.retiredVocabStat='today-session';
    }
  }

  enforceStatsContract();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enforceStatsContract,{once:true});
  window.addEventListener('load',enforceStatsContract,{once:true});
})();
