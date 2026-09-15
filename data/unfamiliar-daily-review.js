(function(){
  // 陌生词只作为“今日词汇”的来源，不再单独插入复习区块。
  function cleanup(){const old=document.getElementById('unfamiliarDailyReview');if(old)old.remove();}
  cleanup();
  const body=document.getElementById('dailyBody');
  if(body&&!body.__unfamiliarCleanupObserver){
    body.__unfamiliarCleanupObserver=true;
    new MutationObserver(cleanup).observe(body,{childList:true,subtree:true});
  }

  // 主学习词库固定为人工筛选后的静态核心词库。
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

  window.__masterVocabIntegrationRequested=true;
  window.__masterVocabClickStabilityRequested=true;
  window.__vocabScopedStatsRequested=true;

  // 重要：弱项运行时现在全部由 index.html 单一路径加载。
  // 这里不再动态加载 weakness-dismiss / weakness-paging-roots / weakness-pool，
  // 避免旧控制器先抢占 openWeaknessV2，导致“会了”按钮存在但词根行消失。
  function loadOnce(src,attr){
    if(document.querySelector('script['+attr+']'))return;
    const s=document.createElement('script');s.src=src;s.setAttribute(attr,'1');document.body.appendChild(s);
  }

  // 保留单独、无冲突的释义修正和首页模块稳定脚本。
  loadOnce('data/weakness-meaning-fix.js?v=20260915-2','data-weakness-meaning-fix');
  loadOnce('data/home-modules-stability.js?v=20260915-2','data-home-modules-stability');
})();