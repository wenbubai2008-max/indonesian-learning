(function(){
  function load(src){return new Promise(function(resolve,reject){var s=document.createElement('script');s.src=src;s.onload=function(){resolve(s)};s.onerror=function(){reject(new Error('加载失败：'+src))};document.head.appendChild(s);});}
  async function boot(){
    try{
      /*
       * 2026-09-17 起：词汇页不再执行 vocab-upgrade-gz-* 或旧 library-switcher 控制层。
       * 正式运行链只有：single controller -> unified renderer -> toolbar -> UI guard -> flip layout。
       * BIPA gzip 文件只作为数据载荷，由 controller 自己解压，不拥有 DB/FILTER/render 权限。
       */
      await load('data/vocab-controller-20260917.js?v=20260917-controller1');
      await load('data/vocab-unified-renderer-20260917.js?v=20260917-controller1');
      await load('data/vocab-bipa-toolbar-compact-20260917.js?v=20260917-controller1');
      await load('data/vocab-unified-ui-guard-20260917.js?v=20260917-controller1');
      await load('data/vocab-flip-content-fix-20260917.js?v=20260917-controller1');
      if(window.VocabController&&typeof window.VocabController.init==='function')await window.VocabController.init();
      if(window.VocabController&&typeof window.VocabController.refresh==='function')window.VocabController.refresh(false);
    }catch(e){console.error('[vocab controller boot]',e);var st=document.getElementById('dbStatus');if(st)st.textContent='词汇页面加载失败，请刷新页面重试';}
  }
  if(document.readyState==='complete')setTimeout(boot,40);else window.addEventListener('load',function(){setTimeout(boot,40)},{once:true});
})();
(function(){
  if(window.__masterTop1000WeakMergeLoaded||window.lockMasterToCore||document.querySelector('script[data-master-core-guard]'))return;
  var s=document.createElement('script');s.src='data/master-top1000-weak-merge.js?v=20260917-controller1';s.dataset.masterCoreGuard='1';document.head.appendChild(s);
})();
