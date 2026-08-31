(function(){
  let activeUtterance=null;
  let activeAudio=null;
  let fallbackTimer=null;
  let toastTimer=null;

  function toast(msg, bad){
    let el=document.getElementById('pronunciationToast');
    if(!el){
      el=document.createElement('div');
      el.id='pronunciationToast';
      el.style.cssText='position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:99999;padding:10px 15px;border-radius:999px;font:700 13px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.14);transition:.2s;pointer-events:none';
      document.body.appendChild(el);
    }
    el.textContent=msg;
    el.style.background=bad?'#fff0ee':'#172033';
    el.style.color=bad?'#b42318':'#fff';
    el.style.opacity='1';
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>{el.style.opacity='0'},1800);
  }

  function stopAll(){
    clearTimeout(fallbackTimer);
    try{window.speechSynthesis&&window.speechSynthesis.cancel()}catch(e){}
    if(activeAudio){try{activeAudio.pause();activeAudio.src=''}catch(e){} activeAudio=null;}
    activeUtterance=null;
  }

  function pickIndonesianVoice(){
    if(!window.speechSynthesis)return null;
    const vs=window.speechSynthesis.getVoices()||[];
    return vs.find(v=>/^id[-_]/i.test(v.lang)) ||
           vs.find(v=>/indones/i.test((v.name||'')+' '+(v.lang||''))) || null;
  }

  function onlineTTS(text){
    try{
      if(activeAudio){activeAudio.pause();activeAudio=null;}
      const url='https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=id&q='+encodeURIComponent(text);
      const a=new Audio();
      activeAudio=a;
      a.preload='auto';
      a.src=url;
      a.onplaying=()=>toast('🔊 正在播放：'+text);
      a.onended=()=>{activeAudio=null};
      a.onerror=()=>{activeAudio=null;toast('发音失败，请再点一次',true)};
      const p=a.play();
      if(p&&p.catch)p.catch(()=>toast('浏览器阻止了音频，请再点一次',true));
    }catch(e){toast('发音失败，请再点一次',true)}
  }

  function robustSpeak(text){
    text=String(text||'').trim();
    if(!text)return;
    stopAll();
    toast('🔊 准备发音：'+text);

    if(!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)){
      onlineTTS(text);return;
    }

    try{
      const synth=window.speechSynthesis;
      const u=new SpeechSynthesisUtterance(text);
      activeUtterance=u;
      u.lang='id-ID';
      u.rate=0.88;
      u.pitch=1;
      const v=pickIndonesianVoice();
      if(v)u.voice=v;
      let started=false;
      u.onstart=()=>{started=true;clearTimeout(fallbackTimer);toast('🔊 正在播放：'+text)};
      u.onend=()=>{clearTimeout(fallbackTimer);activeUtterance=null};
      u.onerror=()=>{clearTimeout(fallbackTimer);activeUtterance=null;onlineTTS(text)};
      synth.cancel();
      synth.resume();
      synth.speak(u);
      fallbackTimer=setTimeout(()=>{if(!started){try{synth.cancel()}catch(e){};onlineTTS(text)}},1200);
    }catch(e){onlineTTS(text)}
  }

  window.robustIndonesianSpeak=robustSpeak;
  window.speak=robustSpeak;
  try{speak=robustSpeak}catch(e){}

  if(window.speechSynthesis){
    try{window.speechSynthesis.getVoices()}catch(e){}
    window.speechSynthesis.addEventListener&&window.speechSynthesis.addEventListener('voiceschanged',()=>{try{window.speechSynthesis.getVoices()}catch(e){}});
  }
})();
