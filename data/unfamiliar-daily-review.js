(function(){
  // 陌生词只作为“今日词汇”的来源，不再单独插入复习区块。
  function cleanup(){const old=document.getElementById('unfamiliarDailyReview');if(old)old.remove();}
  cleanup();const body=document.getElementById('dailyBody');if(body)new MutationObserver(cleanup).observe(body,{childList:true,subtree:true});

  // 词汇页顶部统计始终只统计当前选中的词库。
  if(!window.__vocabScopedStatsRequested){window.__vocabScopedStatsRequested=true;const ss=document.createElement('script');ss.src='data/vocab-scoped-stats.js?v=20260912-5';document.body.appendChild(ss);}

  // 主学习词库：800 词固定读取；进入词汇页或重新选择时强制按主词库重新渲染，避免被其他词库脚本覆盖。
  if(!window.__masterVocabIntegrationRequested){window.__masterVocabIntegrationRequested=true;const m=document.createElement('script');m.src='data/master-vocab-integration.js?v=20260912-11';document.body.appendChild(m);}

  // 主学习词库点击采用单次渲染，避免“模糊 / 不会”后新词出现时发生二次跳动。
  if(!window.__masterVocabClickStabilityRequested){window.__masterVocabClickStabilityRequested=true;const c=document.createElement('script');c.src='data/master-vocab-click-stability.js?v=20260912-2';document.body.appendChild(c);}

  // 统一弱项池：阅读陌生词、快速练习错题、模糊/不会、专项强化共用同一状态。
  if(window.__homeLearningUpgradeLoading)return;window.__homeLearningUpgradeLoading=true;
  function load(src,done){const s=document.createElement('script');s.src=src;s.onload=()=>done&&done();s.onerror=()=>{window.__homeLearningUpgradeLoading=false};document.body.appendChild(s);}
  function loadStability(){load('data/home-modules-stability.js?v=20260912-1');}
  function loadHome(){load('data/extensive-reading-data.js?v=20260903-1',()=>load('data/home-learning-upgrade.js?v=20260911-1',loadStability));}
  function loadWeakControls(){if(window.dismissWeaknessWord)loadHome();else load('data/weakness-dismiss.js?v=20260911-2',loadHome);}
  function loadSync(){if(window.WeaknessSync)loadWeakControls();else load('data/weakness-sync-client.js?v=20260911-1',loadWeakControls);}
  if(window.WeaknessPool)loadSync();else load('data/weakness-pool.js?v=20260912-4',loadSync);
})();