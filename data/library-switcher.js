(function(){
  function normWord(w){return String(w||'').trim().toLowerCase()}
  function uniqueByWord(arr){
    const seen=new Set();
    return (arr||[]).filter(x=>x&&x.word&&!seen.has(normWord(x.word))&&seen.add(normWord(x.word)));
  }
  function missingMeaning(v){
    const s=String(v||'').trim();
    return !s||s==='暂无释义'||s==='暂未查到释义'||s==='查询中文释义…'||s==='查询中文释义...';
  }
  function localUnknownMap(){
    try{return JSON.parse(localStorage.getItem('indo_unknown_words')||'{}')}catch(e){return {}}
  }
  function localUnknownWords(){
    const m=localUnknownMap();
    return Object.values(m).map(x=>({
      word:x.word,display:x.display||x.word,cn:x.cn||'',en:x.en||'',root:x.root||'',
      scene:(x.contexts&&x.contexts.length)?x.contexts[x.contexts.length-1]:'',
      note:'遇到 '+(x.times_seen||1)+' 次'+(x.source_date?' · '+x.source_date:'')+(x.session?' · '+x.session:''),
      contexts:x.contexts||[],times_seen:x.times_seen||1,source:'电脑新增'
    }));
  }
  function sharedUnknownWords(){
    return Array.isArray(window.UNFAMILIAR_VOCAB_DB)?window.UNFAMILIAR_VOCAB_DB:[];
  }
  function unknownWords(){
    const merged=new Map();
    sharedUnknownWords().forEach(x=>{if(x&&x.word)merged.set(normWord(x.word),Object.assign({},x,{source:x.source||'共享陌生词'}))});
    localUnknownWords().forEach(x=>{
      if(!x||!x.word)return;
      const k=normWord(x.word),old=merged.get(k)||{};
      const cn=!missingMeaning(x.cn)?x.cn:(!missingMeaning(old.cn)?old.cn:(x.cn||old.cn||''));
      merged.set(k,Object.assign({},old,x,{cn:cn,contexts:[...(old.contexts||[]),...(x.contexts||[])].filter((v,i,a)=>v&&a.indexOf(v)===i),times_seen:Math.max(Number(old.times_seen||0),Number(x.times_seen||0),1)}));
    });
    let mem={};try{mem=memory()}catch(e){}
    return [...merged.values()].filter(x=>mem[x.word]!=='know');
  }

  const meaningAttempts=new Set();
  async function translateZh(word){
    const w=String(word||'').trim();if(!w)return '';
    try{
      const url='https://translate.googleapis.com/translate_a/single?client=gtx&sl=id&tl=zh-CN&dt=t&q='+encodeURIComponent(w);
      const r=await fetch(url,{method:'GET',mode:'cors',cache:'no-store'});
      if(!r.ok)return '';
      const data=await r.json();
      return Array.isArray(data?.[0])?data[0].map(x=>Array.isArray(x)?x[0]:'').join('').trim():'';
    }catch(e){return ''}
  }
  async function fillMissingMeanings(){
    const map=localUnknownMap();
    let changed=false;
    for(const [key,item] of Object.entries(map)){
      if(!item||!item.word||!missingMeaning(item.cn))continue;
      const shared=sharedUnknownWords().find(x=>normWord(x.word)===normWord(item.word));
      if(shared&&!missingMeaning(shared.cn)){
        item.cn=shared.cn;map[key]=item;changed=true;continue;
      }
      const attemptKey=normWord(item.word);
      if(meaningAttempts.has(attemptKey))continue;
      meaningAttempts.add(attemptKey);
      const zh=await translateZh(item.word);
      if(zh){item.cn=zh;map[key]=item;changed=true;}
    }
    if(changed){
      localStorage.setItem('indo_unknown_words',JSON.stringify(map));
      if(document.getElementById('librarySelect')?.value==='unknown'){
        DB=sourceFor('unknown');FILTER=DB.slice();idx=restoreIndex('unknown',FILTER);rebuildCategories();renderVocab();
        document.getElementById('vocabCount').textContent=DB.length;
        document.getElementById('vocabTag').textContent='陌生词汇 '+DB.length+' 词';
        document.getElementById('dbStatus').textContent='陌生词汇 · '+DB.length+' 词';
      }
    }
  }

  function sourceFor(key){
    if(key==='daily') return uniqueByWord(window.DAILY_VOCAB_DB||[]);
    if(key==='unknown') return uniqueByWord(unknownWords());
    return uniqueByWord(window.EMBEDDED_DB||[]);
  }
  function labelFor(key){return key==='daily'?'每日学习词汇':key==='unknown'?'陌生词汇':'Top1000'}
  function progressKey(key){return 'vocab_progress_'+key}
  function saveProgress(key,word){if(key&&word)localStorage.setItem(progressKey(key),normWord(word));}
  function restoreIndex(key,arr){
    const saved=normWord(localStorage.getItem(progressKey(key))||'');
    if(!saved||!arr.length)return 0;
    const found=arr.findIndex(x=>normWord(x.word)===saved);
    return found>=0?found:0;
  }
  function activeLibrary(){return document.getElementById('librarySelect')?.value||localStorage.getItem('selected_vocab_library')||'top1000'}
  function saveCurrentProgress(){const x=typeof current==='function'?current():null;if(x&&x.word)saveProgress(activeLibrary(),x.word);}
  function rebuildCategories(){
    const cat=document.getElementById('cat');if(!cat)return;
    const cats=[...new Set((DB||[]).flatMap(x=>x.categories||[]))].sort();
    cat.innerHTML='<option value="">全部分类</option>'+cats.map(c=>'<option>'+esc(c)+'</option>').join('');
  }
  function refreshOptions(){
    const select=document.getElementById('librarySelect');if(!select)return;
    const cur=select.value||localStorage.getItem('selected_vocab_library')||'top1000';
    const topCount=(window.EMBEDDED_DB||[]).length;
    const dailyCount=(window.DAILY_VOCAB_DB||[]).length;
    const unknownCount=unknownWords().length;
    select.innerHTML='<option value="top1000">Top1000（'+topCount+'）</option><option value="daily">每日学习词汇（'+dailyCount+'）</option><option value="unknown">陌生词汇（'+unknownCount+'）</option>';
    select.value=['top1000','daily','unknown'].includes(cur)?cur:'top1000';
  }
  function setLibrary(key){
    const select=document.getElementById('librarySelect');if(select&&select.value!==key)select.value=key;
    DB=sourceFor(key);FILTER=DB.slice();idx=restoreIndex(key,FILTER);rebuildCategories();
    const search=document.getElementById('search');if(search)search.value='';
    document.getElementById('vocabCount').textContent=DB.length;
    document.getElementById('vocabTag').textContent=labelFor(key)+' '+DB.length+' 词';
    document.getElementById('dbStatus').textContent=labelFor(key)+' · '+DB.length+' 词';
    if(DB.length){renderVocab();saveCurrentProgress();}else{document.getElementById('vocabBox').innerHTML='<div class="empty">这个词库目前还没有词。</div>';}
    updateStats();localStorage.setItem('selected_vocab_library',key);
    if(key==='unknown')setTimeout(fillMissingMeanings,0);
  }
  function removeLocalUnknown(word){
    let m=localUnknownMap();
    const k=normWord(word);
    Object.keys(m).forEach(key=>{if(key===k||normWord(m[key]?.word)===k)delete m[key]});
    localStorage.setItem('indo_unknown_words',JSON.stringify(m));
    window.dispatchEvent(new CustomEvent('unknown-vocab-changed'));
  }

  let activeAudio=null;
  function stopSpeech(){if(activeAudio){try{activeAudio.pause();}catch(e){}activeAudio=null;}}
  function remoteTTS(text){try{stopSpeech();const url='https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=id&q='+encodeURIComponent(text);activeAudio=new Audio();activeAudio.preload='auto';activeAudio.src=url;activeAudio.volume=1;const p=activeAudio.play();if(p&&p.catch)p.catch(function(){});}catch(e){}}
  function robustSpeak(text){if(!text)return;text=String(text).trim();if(text)remoteTTS(text);}

  function install(){
    const toolbar=document.querySelector('#vocab .toolbar');if(!toolbar)return;
    let select=document.getElementById('librarySelect');
    if(!select){select=document.createElement('select');select.id='librarySelect';select.onchange=function(){saveCurrentProgress();setLibrary(this.value)};toolbar.insertBefore(select,toolbar.firstChild);}
    refreshOptions();
    loadDB=function(){setLibrary(document.getElementById('librarySelect')?.value||'top1000')};window.loadDB=loadDB;
    window.speak=robustSpeak;speak=robustSpeak;

    const originalNextWord=window.nextWord;
    const progressNextWord=function(){originalNextWord();saveCurrentProgress();};
    window.nextWord=progressNextWord;nextWord=progressNextWord;

    const originalMark=window.mark;
    const unknownAwareMark=function(v){
      const lib=document.getElementById('librarySelect')?.value;
      if(lib!=='unknown')return originalMark(v);
      const x=current();if(!x)return;
      let m=memory();m[x.word]=v;localStorage.setItem('indo_mem',JSON.stringify(m));
      if(v==='know')removeLocalUnknown(x.word);
      updateStats();renderReview();refreshOptions();setLibrary('unknown');
    };
    window.mark=unknownAwareMark;mark=unknownAwareMark;

    setLibrary(localStorage.getItem('selected_vocab_library')||'top1000');
  }
  window.switchVocabLibrary=setLibrary;
  window.getUnfamiliarVocabulary=unknownWords;
  window.refreshUnknownLibrary=function(){refreshOptions();if(document.getElementById('librarySelect')?.value==='unknown')setLibrary('unknown')};
  window.addEventListener('unknown-vocab-changed',function(){window.refreshUnknownLibrary&&window.refreshUnknownLibrary()});
  window.addEventListener('beforeunload',saveCurrentProgress);
  window.addEventListener('load',function(){setTimeout(install,0)});
})();
