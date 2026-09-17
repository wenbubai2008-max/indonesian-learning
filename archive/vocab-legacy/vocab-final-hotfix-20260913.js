(function(){
  if(window.__VOCAB_FINAL_HOTFIX_20260913__)return;
  window.__VOCAB_FINAL_HOTFIX_20260913__=true;
  const norm=s=>String(s||'').trim();
  let audio=null,seq=0;
  function stop(){seq++;if(audio){try{audio.pause();audio.src=''}catch(e){}audio=null}try{window.speechSynthesis&&window.speechSynthesis.cancel()}catch(e){}}
  function browser(text){
    try{
      const syn=window.speechSynthesis;if(!syn||typeof SpeechSynthesisUtterance==='undefined')return;
      syn.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='id-ID';u.rate=.88;
      const vs=syn.getVoices? syn.getVoices():[];const v=vs.find(v=>/^id(?:-|_)/i.test(v.lang||''))||vs.find(v=>/indones/i.test(v.name||''));if(v)u.voice=v;
      syn.speak(u);
    }catch(e){}
  }
  function play(text,btn){
    text=norm(text);if(!text)return;stop();const my=++seq;if(btn)btn.classList.add('finalSoundBusy');
    const urls=['https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=id&q=','https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=id&q='];
    let n=0;
    function next(){
      if(my!==seq)return;
      if(n>=urls.length){browser(text);btn&&btn.classList.remove('finalSoundBusy');return}
      try{
        const a=new Audio(urls[n++]+encodeURIComponent(text));audio=a;a.preload='auto';a.volume=1;
        let done=false;const fail=()=>{if(done||my!==seq)return;done=true;try{a.pause()}catch(e){}next()};
        a.onerror=fail;a.onended=()=>{btn&&btn.classList.remove('finalSoundBusy')};
        const p=a.play();if(p&&p.catch)p.catch(fail);
        setTimeout(()=>{if(my===seq&&a.paused&&!a.ended)fail()},2200);
      }catch(e){next()}
    }
    next();
  }
  window.vocabHotfixSpeak=play;window.speak=function(t){play(t,null)};try{speak=window.speak}catch(e){}
  document.addEventListener('click',function(e){
    const b=e.target.closest&&e.target.closest('#vocab [data-final-speak]');if(!b)return;
    e.preventDefault();e.stopImmediatePropagation();play(b.getAttribute('data-final-speak')||'',b);
  },true);

  const old=window.renderVocab;
  if(typeof old==='function'){
    const wrapped=function(){const r=old.apply(this,arguments);const b=document.querySelector('#vocabBox .actions button:first-child');if(b&&/上一个/.test(b.textContent||''))b.dataset.prevWord='1';return r};
    window.renderVocab=wrapped;try{renderVocab=wrapped}catch(e){}
  }
  setTimeout(()=>{try{window.renderVocab&&window.renderVocab()}catch(e){}},30);
})();
