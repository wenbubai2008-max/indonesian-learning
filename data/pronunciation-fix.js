(function(){
  let activeAudio=null;
  let activeUtterance=null;
  const statusId='ttsStatusBox';

  function status(msg, bad){
    let el=document.getElementById(statusId);
    if(!el){
      el=document.createElement('div');
      el.id=statusId;
      el.style.cssText='position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:99999;padding:10px 14px;border-radius:12px;background:#172033;color:#fff;font-size:14px;box-shadow:0 8px 30px rgba(0,0,0,.18);max-width:88vw;text-align:center;';
      document.body.appendChild(el);
    }
    el.textContent=msg;
    el.style.background=bad?'#b42318':'#172033';
    clearTimeout(el._timer);
    el._timer=setTimeout(()=>{el.remove()},2600);
  }

  function stopAll(){
    try{ if(window.speechSynthesis) speechSynthesis.cancel(); }catch(e){}
    try{ if(activeAudio){ activeAudio.pause(); activeAudio.src=''; } }catch(e){}
    activeAudio=null; activeUtterance=null;
  }

  function onlineTTS(text){
    return new Promise((resolve,reject)=>{
      try{
        const url='https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=id&q='+encodeURIComponent(text);
        const a=new Audio();
        activeAudio=a;
        a.preload='auto';
        a.src=url;
        a.onplay=()=>{ status('🔊 正在播放：'+text); resolve(true); };
        a.onerror=()=>reject(new Error('online audio failed'));
        const p=a.play();
        if(p&&p.catch)p.catch(reject);
      }catch(e){reject(e)}
    });
  }

  function localTTS(text){
    return new Promise((resolve,reject)=>{
      if(!('speechSynthesis' in window)||typeof SpeechSynthesisUtterance==='undefined') return reject(new Error('no speech synthesis'));
      try{
        const voices=speechSynthesis.getVoices()||[];
        const v=voices.find(x=>/^id[-_]/i.test(x.lang||'')) || voices.find(x=>(x.lang||'').toLowerCase().includes('id'));
        if(!v) return reject(new Error('no Indonesian voice'));
        const u=new SpeechSynthesisUtterance(text);
        activeUtterance=u;
        u.lang='id-ID'; u.voice=v; u.rate=.88; u.pitch=1;
        let started=false;
        const timer=setTimeout(()=>{ if(!started){ try{speechSynthesis.cancel()}catch(e){}; reject(new Error('local tts timeout')); } },1200);
        u.onstart=()=>{started=true;clearTimeout(timer);status('🔊 正在播放：'+text);resolve(true)};
        u.onerror=()=>{clearTimeout(timer);reject(new Error('local tts error'))};
        speechSynthesis.cancel();
        speechSynthesis.resume();
        speechSynthesis.speak(u);
      }catch(e){reject(e)}
    });
  }

  async function reliableSpeak(text){
    text=String(text||'').trim();
    if(!text)return;
    stopAll();
    status('准备发音：'+text);
    try{
      await localTTS(text);
      return;
    }catch(e){}
    try{
      await onlineTTS(text);
      return;
    }catch(e){
      status('发音失败：请检查浏览器是否允许网页播放声音',true);
    }
  }

  window.speak=reliableSpeak;
  try{ speak=reliableSpeak; }catch(e){}
  document.addEventListener('click',function(ev){
    const btn=ev.target.closest&&ev.target.closest('.sound');
    if(!btn)return;
  },true);
})();
