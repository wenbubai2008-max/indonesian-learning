(function(){
  let activeAudio=null;
  let activeUtterance=null;
  const statusId='ttsStatusBox';

  function status(msg,bad){
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
    el._timer=setTimeout(()=>{if(el&&el.remove)el.remove()},2800);
  }

  function stopAll(){
    try{if(window.speechSynthesis)speechSynthesis.cancel()}catch(e){}
    try{if(activeAudio){activeAudio.pause();activeAudio.src=''}}catch(e){}
    activeAudio=null;activeUtterance=null;
  }

  function localTTS(text){
    return new Promise((resolve,reject)=>{
      if(!('speechSynthesis' in window)||typeof SpeechSynthesisUtterance==='undefined')return reject(new Error('no speech synthesis'));
      try{
        const voices=speechSynthesis.getVoices()||[];
        const idVoice=voices.find(x=>/^id[-_]/i.test(x.lang||''))||voices.find(x=>(x.lang||'').toLowerCase().includes('indones'));
        const fallback=voices.find(x=>/^ms[-_]/i.test(x.lang||''))||voices.find(x=>/^en[-_]/i.test(x.lang||''))||voices[0]||null;
        const u=new SpeechSynthesisUtterance(text);
        activeUtterance=u;
        u.lang='id-ID';
        if(idVoice)u.voice=idVoice;else if(fallback)u.voice=fallback;
        u.rate=.86;u.pitch=1;u.volume=1;
        let settled=false;
        const timer=setTimeout(()=>{if(!settled){try{speechSynthesis.cancel()}catch(e){};reject(new Error('local timeout'))}},1800);
        u.onstart=()=>{settled=true;clearTimeout(timer);status('🔊 正在播放：'+text);resolve(true)};
        u.onerror=()=>{clearTimeout(timer);reject(new Error('local error'))};
        speechSynthesis.cancel();
        speechSynthesis.resume();
        setTimeout(()=>speechSynthesis.speak(u),30);
      }catch(e){reject(e)}
    });
  }

  function onlineTTS(text){
    return new Promise((resolve,reject)=>{
      try{
        const candidates=[
          'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=id&q='+encodeURIComponent(text),
          'https://translate.googleusercontent.com/translate_tts?ie=UTF-8&client=tw-ob&tl=id&q='+encodeURIComponent(text)
        ];
        let i=0;
        const tryNext=()=>{
          if(i>=candidates.length)return reject(new Error('online failed'));
          const a=new Audio();activeAudio=a;a.preload='auto';a.src=candidates[i++];
          a.onplaying=()=>{status('🔊 在线发音：'+text);resolve(true)};
          a.onerror=tryNext;
          const p=a.play();if(p&&p.catch)p.catch(tryNext);
        };
        tryNext();
      }catch(e){reject(e)}
    });
  }

  async function reliableSpeak(text){
    text=String(text||'').trim();if(!text)return;
    stopAll();status('准备发音：'+text);
    try{await localTTS(text);return}catch(e){}
    try{await onlineTTS(text);return}catch(e){}
    status('发音失败：浏览器未提供可用语音，在线音频也被拦截',true);
  }

  function textFromButton(btn){
    const raw=btn.getAttribute('onclick')||'';
    const m=raw.match(/speak\((.+)\)/);
    if(m){
      try{return JSON.parse(m[1])}catch(e){
        const q=m[1].match(/^['\"](.*)['\"]$/);if(q)return q[1];
      }
    }
    const word=btn.closest('.word,.hv-word,.vocabRow,.item');
    if(word){
      const clone=word.cloneNode(true);clone.querySelectorAll('button').forEach(x=>x.remove());
      return (clone.textContent||'').trim().split(/\s+/)[0];
    }
    return '';
  }

  window.speak=reliableSpeak;
  try{window.speechSynthesis&&speechSynthesis.getVoices()}catch(e){}
  document.addEventListener('click',function(ev){
    const btn=ev.target.closest&&ev.target.closest('.sound');
    if(!btn)return;
    const text=textFromButton(btn);
    if(!text)return;
    ev.preventDefault();
    ev.stopPropagation();
    if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();
    reliableSpeak(text);
  },true);
})();
