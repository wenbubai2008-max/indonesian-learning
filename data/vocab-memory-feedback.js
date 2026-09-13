(function(){
  function load(src){return new Promise(function(resolve,reject){var s=document.createElement('script');s.src=src;s.onload=function(){resolve(s)};s.onerror=function(){reject(new Error('加载失败：'+src))};document.head.appendChild(s);});}
  async function boot(){
    try{
      window.VOCAB_UPGRADE_GZ='';
      await load('data/vocab-upgrade-gz-01.js?v=20260913-stable4');
      await load('data/vocab-upgrade-gz-02.js?v=20260913-stable4');
      if(!window.VOCAB_UPGRADE_GZ)throw new Error('词汇页面升级数据为空');
      if(typeof DecompressionStream==='undefined')throw new Error('当前浏览器版本过旧，请升级 Chrome 或 Safari 后使用新版词汇页面');
      var bin=atob(window.VOCAB_UPGRADE_GZ),bytes=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
      var stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      var code=await new Response(stream).text();window.VOCAB_UPGRADE_GZ='';
      var url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
      await load(url);
      await load('data/vocab-bipa-stable-20260913.js?v=20260913-stable4');
      setTimeout(function(){URL.revokeObjectURL(url)},1000);
    }catch(e){console.error('[vocab upgrade]',e);var st=document.getElementById('dbStatus');if(st)st.textContent='词汇页面升级加载失败，请刷新页面重试';}
  }
  if(document.readyState==='complete')setTimeout(boot,80);else window.addEventListener('load',function(){setTimeout(boot,80)},{once:true});
})();
(function(){
  if(document.querySelector('script[data-master-top1000-weak-merge]'))return;
  var s=document.createElement('script');s.src='data/master-top1000-weak-merge.js?v=20260913-stable4';s.dataset.masterTop1000WeakMerge='1';document.head.appendChild(s);
})();