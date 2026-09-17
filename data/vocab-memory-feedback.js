(function(){
  function load(src){return new Promise(function(resolve,reject){var s=document.createElement('script');s.src=src;s.onload=function(){resolve(s)};s.onerror=function(){reject(new Error('加载失败：'+src))};document.head.appendChild(s);});}
  async function boot(){
    try{
      window.VOCAB_UPGRADE_GZ='';
      await load('data/vocab-upgrade-gz-01.js?v=20260917-unified1');
      await load('data/vocab-upgrade-gz-02.js?v=20260917-unified1');
      if(!window.VOCAB_UPGRADE_GZ)throw new Error('词汇页面升级数据为空');
      if(typeof DecompressionStream==='undefined')throw new Error('当前浏览器版本过旧，请升级 Chrome 或 Safari 后使用新版词汇页面');
      var bin=atob(window.VOCAB_UPGRADE_GZ),bytes=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
      var stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      var code=await new Response(stream).text();window.VOCAB_UPGRADE_GZ='';
      var url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
      await load(url);
      /*
       * 2026-09-17: BIPA 只保留压缩升级包中的统一渲染器。
       * 旧的 stable/progress/final/badge/flip/switch-polish 会重复接管
       * renderVocab/applyFilter，尤其在选择 S/A/B 分级时把卡片切回旧界面。
       * 不再加载这些历史补丁，分级只负责筛选，不再更换界面。
       */
      ['bipaStableStyle','bipaFinalV7Style','bipaV8BadgeStyle','bipaFlipLayoutFix20260913','bipaSwitchPolishStyle'].forEach(function(id){var el=document.getElementById(id);if(el)el.remove();});
      var sec=document.getElementById('vocab');if(sec){sec.classList.remove('bipaStable','bipaFinalV7','bipaSwitching');}
      setTimeout(function(){URL.revokeObjectURL(url)},1000);
    }catch(e){console.error('[vocab upgrade]',e);var st=document.getElementById('dbStatus');if(st)st.textContent='词汇页面升级加载失败，请刷新页面重试';}
  }
  if(document.readyState==='complete')setTimeout(boot,80);else window.addEventListener('load',function(){setTimeout(boot,80)},{once:true});
})();
(function(){
  if(window.__masterTop1000WeakMergeLoaded||window.lockMasterToCore||document.querySelector('script[data-master-core-guard],script[data-master-top1000-weak-merge]'))return;
  var s=document.createElement('script');s.src='data/master-top1000-weak-merge.js?v=20260915-core-only2';s.dataset.masterTop1000WeakMerge='1';document.head.appendChild(s);
})();