(function(){
  function load(src){return new Promise(function(resolve,reject){var s=document.createElement('script');s.src=src;s.onload=function(){resolve(s)};s.onerror=function(){reject(new Error('加载失败：'+src))};document.head.appendChild(s);});}
  async function boot(){
    try{
      /*
       * 2026-09-17 起：词汇页不再执行 vocab-upgrade-gz-* 或旧 library-switcher 控制层。
       * BIPA gzip 文件是纯 JSON 数据，不是 JS；必须先按 JSON 解压，再启动唯一 controller。
       * 正式运行链：BIPA data -> single controller -> unified renderer -> toolbar -> UI guard -> flip layout。
       */
      await load('data/bipa-json-loader-20260917.js?v=20260917-handoff1');
      if(window.BipaDataLoader&&typeof window.BipaDataLoader.load==='function')await window.BipaDataLoader.load();
      await load('data/vocab-controller-20260917.js?v=20260917-handoff1');
      await load('data/vocab-unified-renderer-20260917.js?v=20260917-handoff1');
      await load('data/vocab-bipa-toolbar-compact-20260917.js?v=20260917-handoff1');
      await load('data/vocab-unified-ui-guard-20260917.js?v=20260917-handoff1');
      await load('data/vocab-flip-content-fix-20260917.js?v=20260917-handoff1');
      await load('data/weakness-sync-client.js?v=20260917-handoff1');
      if(window.VocabController&&typeof window.VocabController.init==='function')await window.VocabController.init();
      await load('data/bipa-secondary-seed-20260917.js?v=20260917-handoff1');
      if(window.VocabController&&typeof window.VocabController.refresh==='function')window.VocabController.refresh(false);
    }catch(e){console.error('[vocab controller boot]',e);var st=document.getElementById('dbStatus');if(st)st.textContent='词汇页面加载失败，请刷新页面重试';}
  }
  if(document.readyState==='complete')setTimeout(boot,40);else window.addEventListener('load',function(){setTimeout(boot,40)},{once:true});
})();
(function(){
  if(window.__masterTop1000WeakMergeLoaded||window.lockMasterToCore||document.querySelector('script[data-master-core-guard]'))return;
  var s=document.createElement('script');s.src='data/master-top1000-weak-merge.js?v=20260917-handoff1';s.dataset.masterCoreGuard='1';document.head.appendChild(s);
})();
