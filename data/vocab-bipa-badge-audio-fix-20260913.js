(function(){
  if(window.__BIPA_BADGE_AUDIO_FIX_V8__)return;
  window.__BIPA_BADGE_AUDIO_FIX_V8__=true;
  const $=id=>document.getElementById(id);
  const norm=s=>String(s||'').trim().toLowerCase();
  function level(){const s=$('librarySelect'),t=s&&s.selectedIndex>=0?String(s.options[s.selectedIndex]?.textContent||''):'';const m=t.match(/BIPA\s*[（(]?\s*(A1|A2|B1|B2)/i);return m?m[1].toUpperCase():''}
  function isBipa(){return !!level()}
  function raw(word){const rows=(window.BIPA_VOCAB_RAW&&window.BIPA_VOCAB_RAW[level()])||[];return rows.find(r=>Array.isArray(r)&&norm(r[0])===norm(word))||null}
  function currentWord(){
    const el=document.querySelector('#vocabBox .bipaV7Word,#vocabBox .bipaWord,#vocabBox .cleanWord,#vocabBox .word');
    if(el)return String(el.textContent||'').replace('🔊','').trim();
    try{const a=FILTER||[];if(a.length){const i=((Number(idx||0)%a.length)+a.length)%a.length;return String(a[i]?.word||'')}}catch(e){}
    return '';
  }
  function ensureBadge(){
    if(!isBipa())return;
    const word=currentWord();if(!word)return;
    const r=raw(word);const sab=String((r&&r[8])||'').toUpperCase();if(!['S','A','B'].includes(sab))return;
    if(document.querySelector('#vocabBox .bipaV7Badge,#vocabBox .bipaSab,#vocabBox .cleanSab'))return;
    const core=document.querySelector('#vocabBox .bipaV7Core,#vocabBox .bipaCore');
    if(core){
      const d=document.createElement('div');d.className='bipaV8Badge '+sab;d.textContent=sab;core.insertBefore(d,core.firstChild);return;
    }
    const wordEl=document.querySelector('#vocabBox .word');if(wordEl){
      const d=document.createElement('div');d.className='bipaV8Badge '+sab;d.textContent=sab;wordEl.parentNode.insertBefore(d,wordEl);
    }
  }
  function addStyle(){if($('bipaV8BadgeStyle'))return;const st=document.createElement('style');st.id='bipaV8BadgeStyle';st.textContent=`
    #vocabBox .bipaV8Badge{width:58px;height:58px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;font-size:21px;font-weight:900;border:1px solid transparent;box-shadow:0 5px 16px rgba(23,32,51,.09)}
    #vocabBox .bipaV8Badge.S{background:#e8f7ed;color:#17743a;border-color:#bfe8cb}#vocabBox .bipaV8Badge.A{background:#fff5dd;color:#9a6500;border-color:#f4dda1}#vocabBox .bipaV8Badge.B{background:#eef1f6;color:#647084;border-color:#dfe4ec}
  `;document.head.appendChild(st)}

  let audio=null;
  function fallback(text){
    try{if(audio){audio.pause();audio=null}}catch(e){}
    try{const a=new Audio('https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=id&q='+encodeURIComponent(text));audio=a;a.preload='auto';a.volume=1;a.play().catch(()=>{})}catch(e){}
  }
  window.bipaSpeakV8=function(text){
    text=String(text||'').trim();if(!text)return;
    try{if(audio){audio.pause();audio=null}}catch(e){}
    try{speechSynthesis.cancel()}catch(e){}
    if(!('speechSynthesis' in window)||typeof SpeechSynthesisUtterance==='undefined'){fallback(text);return}
    try{
      const u=new SpeechSynthesisUtterance(text);u.lang='id-ID';u.rate=.88;u.pitch=1;u.volume=1;
      const voices=speechSynthesis.getVoices()||[];
      const v=voices.find(v=>/^id[-_]/i.test(v.lang||''))||voices.find(v=>/indones/i.test((v.name||'')+' '+(v.lang||'')));
      if(v)u.voice=v;
      let started=false;
      u.onstart=()=>{started=true};
      u.onerror=()=>{if(!started)fallback(text)};
      speechSynthesis.resume();speechSynthesis.speak(u);
      setTimeout(()=>{if(!started&&!speechSynthesis.speaking&&!speechSynthesis.pending)fallback(text)},900);
    }catch(e){fallback(text)}
  };

  document.addEventListener('click',function(e){
    if(!isBipa())return;
    const btn=e.target.closest&&e.target.closest('#vocabBox .bipaV7Sound,#vocabBox .bipaSound,#vocabBox .cleanSound');
    if(!btn)return;
    e.preventDefault();e.stopPropagation();
    const word=currentWord();if(word)window.bipaSpeakV8(word);
  },true);

  addStyle();
  const box=$('vocabBox');if(box){new MutationObserver(()=>setTimeout(ensureBadge,0)).observe(box,{childList:true,subtree:true});}
  window.addEventListener('vocab-library-ready',()=>setTimeout(ensureBadge,400));
  setInterval(()=>{if(isBipa())ensureBadge()},1200);
  setTimeout(ensureBadge,500);
})();