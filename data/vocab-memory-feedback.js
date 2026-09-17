(function(){
  function load(src){return new Promise(function(resolve,reject){var s=document.createElement('script');s.src=src;s.onload=function(){resolve(s)};s.onerror=function(){reject(new Error('加载失败：'+src))};document.head.appendChild(s);});}
  async function boot(){
    try{
      window.VOCAB_UPGRADE_GZ='';
      await load('data/vocab-upgrade-gz-01.js?v=20260917-finalcard1');
      await load('data/vocab-upgrade-gz-02.js?v=20260917-finalcard1');
      if(!window.VOCAB_UPGRADE_GZ)throw new Error('词汇页面升级数据为空');
      if(typeof DecompressionStream==='undefined')throw new Error('当前浏览器版本过旧，请升级 Chrome 或 Safari 后使用新版词汇页面');
      var bin=atob(window.VOCAB_UPGRADE_GZ),bytes=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
      var stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      var code=await new Response(stream).text();window.VOCAB_UPGRADE_GZ='';
      var url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
      await load(url);

      /*
       * BIPA 最终界面只由这一套 renderer 接管：
       * - 单词上方保留 S/A/B 小圆圈
       * - 主题只在卡片右上角出现一次
       * - 翻卡后只显示中文、英文、词根（有才显示）
       * - 不显示“词库 / 单元 / 构词 / 来源”等旧信息块
       * - S/A/B 分级只筛词，不切换成另一套卡片界面
       * 其它历史 BIPA stable/progress/badge/flip/switch 补丁不再加载。
       */
      await load('data/vocab-bipa-final-20260913.js?v=20260917-finalcard1');

      setTimeout(function(){URL.revokeObjectURL(url)},1000);
    }catch(e){console.error('[vocab upgrade]',e);var st=document.getElementById('dbStatus');if(st)st.textContent='词汇页面升级加载失败，请刷新页面重试';}
  }
  if(document.readyState==='complete')setTimeout(boot,80);else window.addEventListener('load',function(){setTimeout(boot,80)},{once:true});
})();
(function(){
  if(window.__masterTop1000WeakMergeLoaded||window.lockMasterToCore||document.querySelector('script[data-master-core-guard],script[data-master-top1000-weak-merge]'))return;
  var s=document.createElement('script');s.src='data/master-top1000-weak-merge.js?v=20260915-core-only2';s.dataset.masterTop1000WeakMerge='1';document.head.appendChild(s);
})();