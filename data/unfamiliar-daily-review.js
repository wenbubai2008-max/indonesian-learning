(function(){
  // 陌生词现在只作为“今日词汇”的来源，不再单独插入“陌生词复习”区块。
  function cleanup(){
    const old=document.getElementById('unfamiliarDailyReview');
    if(old) old.remove();
  }
  cleanup();
  const body=document.getElementById('dailyBody');
  if(body) new MutationObserver(cleanup).observe(body,{childList:true,subtree:true});
})();
