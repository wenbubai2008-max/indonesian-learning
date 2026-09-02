(function(){
  function removeSpeaking(){
    const box=document.getElementById('dailySpeakingBox');
    if(box) box.remove();
  }
  removeSpeaking();
  const body=document.getElementById('dailyBody');
  if(body){
    new MutationObserver(removeSpeaking).observe(body,{childList:true,subtree:false});
  }
  window.addEventListener('load',removeSpeaking);
})();
