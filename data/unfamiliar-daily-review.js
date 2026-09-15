(function(){
  // 陌生词只作为“今日词汇”的来源，不再单独插入复习区块。
  function cleanup(){const old=document.getElementById('unfamiliarDailyReview');if(old)old.remove();}
  cleanup();const body=document.getElementById('dailyBody');if(body)new MutationObserver(cleanup).observe(body,{childList:true,subtree:true});

  // 主学习词库固定为人工筛选后的静态核心词库。
  // 显式加载 core guard，彻底取消旧的“Top1000 模糊/不会永久并入 master”逻辑。
  // Top1000 弱项继续通过 WeaknessPool / weakness-sync.json 复习，不计入 master 总数。
  function ensureMasterCoreGuard(){
    if(window.lockMasterToCore){window.lockMasterToCore();return;}
    if(document.querySelector('script[data-master-core-guard]'))return;
    const s=document.createElement('script');
    s.src='data/master-top1000-weak-merge.js?v=20260913-core-only1';
    s.dataset.masterCoreGuard='1';
    s.onload=function(){if(window.lockMasterToCore)window.lockMasterToCore();};
    document.body.appendChild(s);
  }
  ensureMasterCoreGuard();
  window.addEventListener('master-vocab-ready',ensureMasterCoreGuard);
  window.addEventListener('vocab-library-ready',ensureMasterCoreGuard);

  // 主学习词库、当前词库统计和切换现在统一由 library-switcher.js 管理。
  // 这里不再重复加载 master-vocab-integration / click-stability / scoped-stats，避免多个脚本争抢同一个下拉菜单。
  window.__masterVocabIntegrationRequested=true;
  window.__masterVocabClickStabilityRequested=true;
  window.__vocabScopedStatsRequested=true;

  // 统一弱项池：阅读陌生词、快速练习错题、模糊/不会、专项强化共用同一状态。
  // 首页学习功能由 index.html 直接加载的 home-learning-upgrade-v2.js 统一负责；
  // 不再动态加载旧版 home-learning-upgrade.js，避免两个控制器同时改写首页和练习逻辑。
  if(window.__homeLearningUpgradeLoading)return;window.__homeLearningUpgradeLoading=true;
  function load(src,done){const s=document.createElement('script');s.src=src;s.onload=()=>done&&done();s.onerror=()=>{window.__homeLearningUpgradeLoading=false};document.body.appendChild(s);}
  function loadStability(){load('data/home-modules-stability.js?v=20260912-1');}
  function loadHome(){load('data/extensive-reading-data.js?v=20260903-1',loadStability);}
  function loadPagingRoots(){load('data/weakness-paging-roots.js?v=20260915-3',loadHome);}
  function loadMeaningFix(){load('data/weakness-meaning-fix.js?v=20260915-1',loadPagingRoots);}
  function loadWeakControls(){if(window.dismissWeaknessWord)loadMeaningFix();else load('data/weakness-dismiss.js?v=20260911-2',loadMeaningFix);}
  function loadSync(){if(window.WeaknessSync)loadWeakControls();else load('data/weakness-sync-client.js?v=20260911-1',loadWeakControls);}
  if(window.WeaknessPool)loadSync();else load('data/weakness-pool.js?v=20260912-4',loadSync);
})();
