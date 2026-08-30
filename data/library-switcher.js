(function(){
  function uniqueByWord(arr){
    const seen=new Set();
    return (arr||[]).filter(x=>x&&x.word&&!seen.has(String(x.word).toLowerCase())&&seen.add(String(x.word).toLowerCase()));
  }
  function sourceFor(key){
    if(key==='daily') return uniqueByWord(window.DAILY_VOCAB_DB||[]);
    return uniqueByWord(window.EMBEDDED_DB||[]);
  }
  function rebuildCategories(){
    const cat=document.getElementById('cat');
    if(!cat)return;
    const cats=[...new Set((DB||[]).flatMap(x=>x.categories||[]))].sort();
    cat.innerHTML='<option value="">全部分类</option>'+cats.map(c=>'<option>'+esc(c)+'</option>').join('');
  }
  function setLibrary(key){
    const select=document.getElementById('librarySelect');
    if(select&&select.value!==key)select.value=key;
    DB=sourceFor(key);
    FILTER=DB.slice();
    idx=0;
    rebuildCategories();
    document.getElementById('search').value='';
    document.getElementById('vocabCount').textContent=DB.length;
    document.getElementById('vocabTag').textContent=(key==='daily'?'每日学习词汇 ':'Top1000 ')+DB.length+' 词';
    document.getElementById('dbStatus').textContent=(key==='daily'?'每日学习词汇':'Top1000')+' · '+DB.length+' 词';
    if(DB.length){renderVocab();}else{document.getElementById('vocabBox').innerHTML='<div class="empty">这个词库目前还没有词。每日学习生成后会自动累计到这里。</div>';}
    updateStats();
    localStorage.setItem('selected_vocab_library',key);
  }

  let activeAudio=null;
  let activeUtterance=null;
  let speechTimer=null;

  function getIndonesianVoice(){
    if(!window.speechSynthesis)return null;
    const voices=speechSynthesis.getVoices()||[];
    return voices.find(v=>/^id(-|$)/i.test(v.lang))||voices.find(v=>/indones/i.test(v.name))||null;
  }

  function stopSpeech(){
    if(speechTimer){clearTimeout(speechTimer);speechTimer=null;}
    if(activeAudio){try{activeAudio.pause();}catch(e){} activeAudio=null;}
    if(window.speechSynthesis){try{speechSynthesis.cancel();speechSynthesis.resume();}catch(e){}}
    activeUtterance=null;
  }

  function remoteTTS(text){
    try{
      if(activeAudio){activeAudio.pause();activeAudio=null;}
      const url='https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=id&q='+encodeURIComponent(text);
      activeAudio=new Audio();
      activeAudio.preload='auto';
      activeAudio.src=url;
      activeAudio.volume=1;
      const p=activeAudio.play();
      if(p&&p.catch)p.catch(function(){});
    }catch(e){}
  }

  function robustSpeak(text){
    if(!text)return;
    text=String(text).trim();
    if(!text)return;
    stopSpeech();

    if(!window.speechSynthesis || typeof SpeechSynthesisUtterance==='undefined'){
      remoteTTS(text);
      return;
    }

    const start=function(){
      try{
        speechSynthesis.cancel();
        speechSynthesis.resume();
        activeUtterance=new SpeechSynthesisUtterance(text);
        activeUtterance.lang='id-ID';
        const voice=getIndonesianVoice();
        if(voice)activeUtterance.voice=voice;
        activeUtterance.rate=.88;
        activeUtterance.pitch=1;
        activeUtterance.volume=1;
        let started=false;
        activeUtterance.onstart=function(){started=true;};
        activeUtterance.onend=function(){activeUtterance=null;};
        activeUtterance.onerror=function(){
          activeUtterance=null;
          remoteTTS(text);
        };
        speechSynthesis.speak(activeUtterance);
        speechSynthesis.resume();
        speechTimer=setTimeout(function(){
          if(!started && !speechSynthesis.speaking){
            try{speechSynthesis.cancel();}catch(e){}
            activeUtterance=null;
            remoteTTS(text);
          }
        },1800);
      }catch(e){
        activeUtterance=null;
        remoteTTS(text);
      }
    };

    const voices=speechSynthesis.getVoices();
    if(voices&&voices.length){
      start();
    }else{
      let fired=false;
      const ready=function(){
        if(fired)return;
        fired=true;
        if(speechSynthesis.removeEventListener)speechSynthesis.removeEventListener('voiceschanged',ready);
        start();
      };
      if(speechSynthesis.addEventListener)speechSynthesis.addEventListener('voiceschanged',ready);
      setTimeout(ready,700);
    }
  }

  function install(){
    const toolbar=document.querySelector('#vocab .toolbar');
    if(!toolbar||document.getElementById('librarySelect'))return;
    const select=document.createElement('select');
    select.id='librarySelect';
    const topCount=(window.EMBEDDED_DB||[]).length;
    const dailyCount=(window.DAILY_VOCAB_DB||[]).length;
    select.innerHTML='<option value="top1000">Top1000（'+topCount+'）</option><option value="daily">每日学习词汇（'+dailyCount+'）</option>';
    select.onchange=function(){setLibrary(this.value)};
    toolbar.insertBefore(select,toolbar.firstChild);
    loadDB=function(){setLibrary(document.getElementById('librarySelect')?.value||'top1000')};
    window.loadDB=loadDB;
    window.speak=robustSpeak;
    speak=robustSpeak;
    setLibrary(localStorage.getItem('selected_vocab_library')||'top1000');
  }
  window.switchVocabLibrary=setLibrary;
  window.addEventListener('load',function(){setTimeout(install,0)});
})();
