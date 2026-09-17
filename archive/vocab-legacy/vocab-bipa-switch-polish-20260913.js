(function(){
  if(window.__BIPA_SWITCH_POLISH_V12__)return;
  window.__BIPA_SWITCH_POLISH_V12__=true;
  const $=id=>document.getElementById(id);
  function level(){const s=$('librarySelect'),t=s&&s.selectedIndex>=0?String(s.options[s.selectedIndex]?.textContent||''):'';const m=t.match(/BIPA\s*[（(]?\s*(A1|A2|B1|B2)/i);return m?m[1].toUpperCase():''}
  function isBipa(){return !!level()}
  function addStyle(){
    if($('bipaSwitchPolishStyle'))return;
    const st=document.createElement('style');st.id='bipaSwitchPolishStyle';st.textContent=`
      #vocab.bipaSwitching #vocabBox{opacity:0!important;visibility:hidden!important;}
      #vocab #vocabBox{transition:opacity .08s ease;}
    `;document.head.appendChild(st);
  }
  let switchToken=0;
  function beginSwitch(){
    const sec=$('vocab');if(!sec)return;
    switchToken++;const token=switchToken;
    sec.classList.add('bipaSwitching');
    try{if(window.speechSynthesis)window.speechSynthesis.cancel()}catch(e){}
    const started=Date.now();
    function check(){
      if(token!==switchToken)return;
      const box=$('vocabBox');
      const ready=!isBipa() || !!(box&&box.querySelector('.bipaV7Card,.bipaStableCard'));
      const badgeCount=box?box.querySelectorAll('.bipaV7Badge,.bipaV8Badge,.bipaSab,.cleanSab').length:0;
      if((ready&&badgeCount<=1&&Date.now()-started>140)||Date.now()-started>1200){
        requestAnimationFrame(()=>requestAnimationFrame(()=>{if(token===switchToken)sec.classList.remove('bipaSwitching')}));
        return;
      }
      setTimeout(check,40);
    }
    setTimeout(check,80);
  }
  addStyle();
  const lib=$('librarySelect');
  if(lib)lib.addEventListener('change',beginSwitch,true);
})();
