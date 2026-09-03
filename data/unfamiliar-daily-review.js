(function(){
  // 陌生词只作为“今日词汇”的来源，不再单独插入复习区块。
  function cleanup(){const old=document.getElementById('unfamiliarDailyReview');if(old)old.remove();}
  cleanup();const body=document.getElementById('dailyBody');if(body)new MutationObserver(cleanup).observe(body,{childList:true,subtree:true});

  // 首页学习模块升级加载器：泛读数据 -> 首页新模块。
  if(window.__homeLearningUpgradeLoading)return;window.__homeLearningUpgradeLoading=true;
  function load(src,done){const s=document.createElement('script');s.src=src;s.onload=()=>done&&done();s.onerror=()=>{window.__homeLearningUpgradeLoading=false};document.body.appendChild(s);}
  load('data/extensive-reading-data.js?v=20260903-1',()=>load('data/home-learning-upgrade.js?v=20260903-1'));
})();