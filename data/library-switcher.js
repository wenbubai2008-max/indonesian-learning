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
  function getIndonesianVoice(){
    if(!window.speechSynthesis)return null;
    const voices=speechSynthesis.getVoices()||[];
    return voices.find(v=>/^id(-|$)/i.test(v.lang))||voices.find(v=>/indones/i.test(v.name))||null;
  }
  function remoteTTS(text){
    try{
      if(activeAudio){activeAudio.pause();activeAudio=null;}
      const url='https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=id&q='+encodeURIComponent(text);
      activeAudio=new Audio(url);
      activeAudio.play().catch(function(){
        alert('当前浏览器没有可用的印尼语发音，请检查浏览器是否允许网页播放声音。');
      });
    }catch(e){
      alert('发音播放失败，请检查浏览器声音权限。');
    }
  }
  function robustSpeak(text){
    if(!text)return;
    text=String(text).trim();
    if(!text)return;
    if(activeAudio){activeAudio.pause();activeAudio=null;}
    if(!window.speechSynthesis){remoteTTS(text);return;}
    const playLocal=function(){
      const voice=getIndonesianVoice();
      if(!voice){remoteTTS(text);return;}
      try{
        speechSynthesis.cancel();
        const u=new SpeechSynthesisUtterance(text);
        u.lang='id-ID';
        u.voice=voice;
        u.rate=.88;
        u.pitch=1;
        u.volume=1;
        let started=false;
        u.onstart=function(){started=true;};
        u.onerror=function(){remoteTTS(text);};
        speechSynthesis.speak(u);
        setTimeout(function(){if(!started&&!speechSynthesis.speaking)remoteTTS(text);},700);
      }catch(e){remoteTTS(text);}
    };
    if(speechSynthesis.getVoices().length){
      playLocal();
    }else{
      let done=false;
      const ready=function(){
        if(done)return;
        done=true;
        if(speechSynthesis.removeEventListener)speechSynthesis.removeEventListener('voiceschanged',ready);
        playLocal();
      };
      if(speechSynthesis.addEventListener)speechSynthesis.addEventListener('voiceschanged',ready);
      setTimeout(ready,500);
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
