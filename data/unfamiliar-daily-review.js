(function(){
  // 陌生词只作为“今日词汇”的来源，不再单独插入复习区块。
  function cleanup(){const old=document.getElementById('unfamiliarDailyReview');if(old)old.remove();}
  cleanup();const body=document.getElementById('dailyBody');if(body)new MutationObserver(cleanup).observe(body,{childList:true,subtree:true});

  // 词汇页顶部统计始终只统计当前选中的词库。
  if(!window.__vocabScopedStatsRequested){window.__vocabScopedStatsRequested=true;const ss=document.createElement('script');ss.src='data/vocab-scoped-stats.js?v=20260912-1';document.body.appendChild(ss);}

  // 主学习词库独立加载：用于人工核对“会了 / 模糊 / 不会”，并把“会了”反馈给后续每日出词。
  if(!window.__masterVocabIntegrationRequested){window.__masterVocabIntegrationRequested=true;const m=document.createElement('script');m.src='data/master-vocab-integration.js?v=20260912-4';document.body.appendChild(m);}

  // 统一弱项池：阅读陌生词、快速练习错题、模糊/不会、专项强化共用同一状态。
  // 同步采用事件触发：本地立即保存，停止操作约10秒后后台发送；没有变化时不会轮询，也不会刷新页面。
  if(window.__homeLearningUpgradeLoading)return;window.__homeLearningUpgradeLoading=true;
  function load(src,done){const s=document.createElement('script');s.src=src;s.onload=()=>done&&done();s.onerror=()=>{window.__homeLearningUpgradeLoading=false};document.body.appendChild(s);}
  function loadStability(){load('data/home-modules-stability.js?v=20260912-1');}
  function loadHome(){load('data/extensive-reading-data.js?v=20260903-1',()=>load('data/home-learning-upgrade.js?v=20260911-1',loadStability));}
  function loadWeakControls(){if(window.dismissWeaknessWord)loadHome();else load('data/weakness-dismiss.js?v=20260911-2',loadHome);}
  function loadSync(){if(window.WeaknessSync)loadWeakControls();else load('data/weakness-sync-client.js?v=20260911-1',loadWeakControls);}
  if(window.WeaknessPool)loadSync();
  else load('data/weakness-pool.js?v=20260912-4',loadSync);
})();
