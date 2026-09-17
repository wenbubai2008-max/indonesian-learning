(function(){
  function load(src){return new Promise(function(resolve,reject){var s=document.createElement('script');s.src=src;s.onload=function(){resolve(s)};s.onerror=function(){reject(new Error('加载失败：'+src))};document.head.appendChild(s);});}
  async function boot(){
    try{
      window.VOCAB_UPGRADE_GZ='';
      await load('data/vocab-upgrade-gz-01.js?v=20260917-finalcard3');
      await load('data/vocab-upgrade-gz-02.js?v=20260917-finalcard3');
      if(!window.VOCAB_UPGRADE_GZ)throw new Error('词汇页面升级数据为空');
      if(typeof DecompressionStream==='undefined')throw new Error('当前浏览器版本过旧，请升级 Chrome 或 Safari 后使用新版词汇页面');
      var bin=atob(window.VOCAB_UPGRADE_GZ),bytes=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
      var stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      var code=await new Response(stream).text();window.VOCAB_UPGRADE_GZ='';
      var url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
      await load(url);

      /* BIPA 最终卡片：小圆圈 S/A/B + 单词；翻卡只显示中文/英文/词根。 */
      await load('data/vocab-bipa-final-20260913.js?v=20260917-finalcard3');
      /* 桌面端筛选工具栏缩小并固定一排。 */
      await load('data/vocab-bipa-toolbar-compact-20260917.js?v=20260917-finalcard3');
      /* 恢复 9/13 已确认的最终翻卡布局：圆圈+单词整体上移，释义固定在下方不重叠。 */
      await load('data/vocab-bipa-flip-layout-fix-20260913.js?v=20260917-finalcard3');

      setTimeout(function(){URL.revokeObjectURL(url)},1000);
    }catch(e){console.error('[vocab upgrade]',e);var st=document.getElementById('dbStatus');if(st)st.textContent='词汇页面升级加载失败，请刷新页面重试';}
  }
  if(document.readyState==='complete')setTimeout(boot,80);else window.addEventListener('load',function(){setTimeout(boot,80)},{once:true});
})();
(function(){
  if(window.__masterTop1000WeakMergeLoaded||window.lockMasterToCore||document.querySelector('script[data-master-core-guard],script[data-master-top1000-weak-merge]'))return;
  var s=document.createElement('script');s.src='data/master-top1000-weak-merge.js?v=20260915-core-only2';s.dataset.masterTop1000WeakMerge='1';document.head.appendChild(s);
})();