(function(){
  function ensureVocabTag(){
    var tag=document.getElementById('vocabTag');
    if(tag)return tag;
    var vocabModule=document.querySelector('#home .module[onclick*="vocab"]');
    if(vocabModule){
      tag=document.createElement('span');
      tag.id='vocabTag';
      tag.className='tag';
      var n=(window.DAILY_VOCAB_DB||[]).length||(window.EMBEDDED_DB||[]).length||0;
      tag.textContent=n?n+' 个词':'加载中...';
      vocabModule.appendChild(tag);
      return tag;
    }
    return null;
  }

  function patch(){
    ensureVocabTag();
    if(typeof window.loadDB==='function'&&!window.loadDB.__domCompat){
      var original=window.loadDB;
      var wrapped=async function(){
        ensureVocabTag();
        return original.apply(this,arguments);
      };
      wrapped.__domCompat=true;
      window.loadDB=wrapped;
    }
  }

  patch();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patch,{once:true});
  else patch();
})();
