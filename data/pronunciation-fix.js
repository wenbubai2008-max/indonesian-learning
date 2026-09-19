(function(){
  let activeAudio=null;
  let activeUtterance=null;
  let playToken=0;
  let preferredVoice=null;
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
    el._timer=setTimeout(()=>{if(el&&el.remove)el.remove()},2400);
  }

  function isIndonesianVoice(v){
    if(!v)return false;
    const lang=String(v.lang||'');
    const label=((v.name||'')+' '+lang).toLowerCase();
    return /^id(?:[-_]|$)/i.test(lang)||/indones/.test(label);
  }

  function pickVoice(voices){
    return (voices||[]).find(x=>/^id(?:[-_]|$)/i.test(x.lang||''))||
      (voices||[]).find(isIndonesianVoice)||null;
  }

  function refreshVoices(){
    try{
      if(!window.speechSynthesis)return null;
      const voices=speechSynthesis.getVoices()||[];
      preferredVoice=pickVoice(voices);
      return preferredVoice;
    }catch(e){preferredVoice=null;return null;}
  }

  function prewarmVoices(){
    refreshVoices();
    [120,450,1200,2500].forEach(ms=>setTimeout(refreshVoices,ms));
    try{
      if(window.speechSynthesis&&speechSynthesis.addEventListener)speechSynthesis.addEventListener('voiceschanged',refreshVoices);
      else if(window.speechSynthesis)speechSynthesis.onvoiceschanged=refreshVoices;
    }catch(e){}
  }

  function stopAll(){
    playToken++;
    try{
      const s=window.speechSynthesis;
      if(s&&(s.speaking||s.pending||activeUtterance))s.cancel();
    }catch(e){}
    try{if(activeAudio){activeAudio.pause();activeAudio.src=''}}catch(e){}
    activeAudio=null;activeUtterance=null;
  }

  function splitText(text,maxLen){
    text=String(text||'').replace(/\s+/g,' ').trim();
    if(!text)return [];
    maxLen=maxLen||145;
    const sentences=text.match(/[^.!?]+[.!?]?/g)||[text],out=[];
    sentences.forEach(function(s){
      s=s.trim();if(!s)return;
      if(s.length<=maxLen){out.push(s);return;}
      const words=s.split(/\s+/);let cur='';
      words.forEach(function(w){const next=cur?(cur+' '+w):w;if(next.length>maxLen&&cur){out.push(cur);cur=w;}else cur=next;});
      if(cur)out.push(cur);
    });
    return out;
  }

  function localTTS(text,waitEnd){
    return new Promise((resolve,reject)=>{
      if(!('speechSynthesis' in window)||typeof SpeechSynthesisUtterance==='undefined')return reject(new Error('no speech synthesis'));
      try{
        const voice=(preferredVoice&&isIndonesianVoice(preferredVoice))?preferredVoice:refreshVoices();
        if(!voice)return reject(new Error('no Indonesian voice'));
        const u=new SpeechSynthesisUtterance(text);
        activeUtterance=u;u.lang='id-ID';u.voice=voice;
        u.rate=.88;u.pitch=1;u.volume=1;
        let settled=false,started=false;
        const startLimit=String(text||'').length<=40?1800:2800;
        const finish=function(ok,err){if(settled)return;settled=true;clearTimeout(startTimer);clearTimeout(endTimer);if(activeUtterance===u)activeUtterance=null;ok?resolve(true):reject(err||new Error('local error'));};
        const startTimer=setTimeout(()=>{if(!started){try{speechSynthesis.cancel()}catch(e){};finish(false,new Error('local start timeout'));}},startLimit);
        const endTimer=setTimeout(()=>{if(waitEnd){try{speechSynthesis.cancel()}catch(e){};finish(false,new Error('local end timeout'));}},22000);
        u.onstart=()=>{started=true;clearTimeout(startTimer);if(!waitEnd)finish(true);};
        u.onend=()=>finish(true);
        u.onerror=()=>finish(false,new Error('local error'));
        try{speechSynthesis.resume();}catch(e){}
        setTimeout(()=>{try{speechSynthesis.speak(u);}catch(e){finish(false,e);}},0);
      }catch(e){reject(e);}
    });
  }

  function onlineTTS(text,waitEnd){
    return new Promise((resolve,reject)=>{
      try{
        const candidates=[
          'https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=id&q='+encodeURIComponent(text),
          'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=id&q='+encodeURIComponent(text),
          'https://translate.googleusercontent.com/translate_tts?ie=UTF-8&client=tw-ob&tl=id&q='+encodeURIComponent(text)
        ];
        let i=0,settled=false,startTimer=null,endTimer=null;
        const clearTimers=()=>{clearTimeout(startTimer);clearTimeout(endTimer);};
        const done=function(ok,err){if(settled)return;settled=true;clearTimers();ok?resolve(true):reject(err||new Error('online failed'));};
        const tryNext=()=>{
          if(settled)return;clearTimeout(startTimer);
          if(i>=candidates.length)return done(false,new Error('online failed'));
          const a=new Audio();activeAudio=a;a.preload='auto';a.src=candidates[i++];
          let started=false;
          startTimer=setTimeout(()=>{if(!started){try{a.pause();}catch(e){}tryNext();}},3500);
          a.onplaying=()=>{started=true;clearTimeout(startTimer);if(!waitEnd)done(true);else endTimer=setTimeout(()=>done(false,new Error('online end timeout')),26000);};
          a.onended=()=>done(true);
          a.onerror=()=>{if(!started)tryNext();else done(false,new Error('online interrupted'));};
          const p=a.play();if(p&&p.catch)p.catch(()=>{if(!started)tryNext();else done(false,new Error('play blocked'));});
        };
        tryNext();
      }catch(e){reject(e);}
    });
  }

  async function speakLong(text){
    const chunks=splitText(text,135);if(!chunks.length)return;
    stopAll();const token=playToken;status('🔊 开始朗读全文 · '+chunks.length+' 段');
    for(let i=0;i<chunks.length;i++){
      if(token!==playToken)return;
      let ok=false;try{await localTTS(chunks[i],true);ok=true;}catch(e){}
      if(!ok){try{await onlineTTS(chunks[i],true);ok=true;}catch(e){}}
      if(!ok){status('全文朗读中断：第 '+(i+1)+' 段播放失败',true);return;}
    }
    if(token===playToken)status('✓ 全文朗读完成');
  }

  async function reliableSpeak(text){
    text=String(text||'').trim();if(!text)return;
    if(text.length>180)return speakLong(text);
    stopAll();refreshVoices();status('准备发音：'+(text.length>50?text.slice(0,50)+'…':text));
    try{await localTTS(text,false);return;}catch(e){}
    try{await onlineTTS(text,false);return;}catch(e){}
    status('发音失败：浏览器未提供可用语音，在线音频也被拦截',true);
  }

  function textFromButton(btn){
    if(!btn)return '';
    const direct=btn.getAttribute('data-tts-text');if(direct)return direct;
    const raw=btn.getAttribute('onclick')||'',m=raw.match(/speak\((.+)\)/);
    if(m){try{return JSON.parse(m[1]);}catch(e){const q=m[1].match(/^['\"](.*)['\"]$/);if(q)return q[1];}}
    const sec=btn.closest('.dailyFixSec');if(sec){const reading=sec.querySelector('.dailyFixReading');if(reading)return (reading.textContent||'').trim();}
    const article=btn.closest('.rl-article');if(article){const reading=article.querySelector('.rl-text');if(reading)return (reading.textContent||'').trim();}
    const word=btn.closest('.word,.hv-word,.vocabRow,.item');
    if(word){const clone=word.cloneNode(true);clone.querySelectorAll('button').forEach(x=>x.remove());return (clone.textContent||'').trim().split(/\s+/)[0];}
    return '';
  }

  window.speak=reliableSpeak;
  window.speakLongIndonesian=speakLong;
  window.stopIndonesianSpeech=stopAll;
  window.prewarmIndonesianVoice=refreshVoices;
  prewarmVoices();

  document.addEventListener('click',function(ev){
    const btn=ev.target.closest&&ev.target.closest('.sound,button[onclick*="speak("],button[data-tts-text]');
    if(!btn)return;
    const text=textFromButton(btn);if(!text)return;
    ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();
    reliableSpeak(text);
  },true);
})();