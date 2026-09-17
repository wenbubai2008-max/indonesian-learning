(function(){
  function load(src){return new Promise(function(resolve,reject){var s=document.createElement('script');s.src=src;s.onload=function(){resolve(s)};s.onerror=function(){reject(new Error('加载失败：'+src))};document.head.appendChild(s);});}
  async function boot(){
    try{
      /*
       * 性能原则：BIPA 数据只在真正进入/切换到对应级别时加载。
       * A1/A2/B1/B2 各自独立压缩；进入 B2 只请求和解压 B2，不加载其他三个级别。
       * 第二主词库已经固化到 GitHub，不在页面刷新时重新扫描或生成。
       */
      await load('data/bipa-json-loader-20260917.js?v=20260917-level1');
      await load('data/vocab-controller-20260917.js?v=20260917-level1');
      await load('data/vocab-unified-renderer-20260917.js?v=20260917-level1');
      await load('data/vocab-bipa-toolbar-compact-20260917.js?v=20260917-level1');
      await load('data/vocab-unified-ui-guard-20260917.js?v=20260917-level1');
      await load('data/vocab-flip-content-fix-20260917.js?v=20260917-level1');
      await load('data/weakness-sync-client.js?v=20260917-level1');
      if(window.VocabController&&typeof window.VocabController.init==='function')await window.VocabController.init();
    }catch(e){console.error('[vocab controller boot]',e);var st=document.getElementById('dbStatus');if(st)st.textContent='词汇页面加载失败，请刷新页面重试';}
  }
  if(document.readyState==='complete')setTimeout(boot,40);else window.addEventListener('load',function(){setTimeout(boot,40)},{once:true});
})();
(function(){
  if(window.__masterTop1000WeakMergeLoaded||window.lockMasterToCore||document.querySelector('script[data-master-core-guard]'))return;
  var s=document.createElement('script');s.src='data/master-top1000-weak-merge.js?v=20260917-level1';s.dataset.masterCoreGuard='1';document.head.appendChild(s);
})();
