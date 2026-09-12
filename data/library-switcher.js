(function(){
  const MASTER_SCRIPTS=['data/master-vocab-data.js?v=20260912-core1','data/master-vocab-data-2.js?v=20260912-core1','data/master-vocab-data-3.js?v=20260912-core1'];
  function normWord(w){return String(w||'').trim().toLowerCase()}
  function uniqueByWord(arr){const seen=new Set();return (arr||[]).filter(x=>x&&x.word&&!seen.has(normWord(x.word))&&seen.add(normWord(x.word)));}
  function missingMeaning(v){const s=String(v||'').trim();return !s||s==='暂无释义'||s==='暂未查到释义'||s==='查询中文释义…'||s==='查询中文释义...';}
  function localUnknownMap(){try{return JSON.parse(localStorage.getItem('indo_unknown_words')||'{}')}catch(e){return {}}}
  function localUnknownWords(){const m=localUnknownMap();return Object.values(m).map(x=>({word:x.word,display:x.display||x.word,cn:x.cn||'',en:x.en||'',root:x.root||'',scene:(x.contexts&&x.contexts.length)?x.contexts[x.contexts.length-1]:'',note:'遇到 '+(x.times_seen||1)+' 次'+(x.source_date?' · '+x.source_date:'')+(x.session?' · '+x.session:''),contexts:x.contexts||[],times_seen:x.times_seen||1,source:'电脑新增'}));}
  function sharedUnknownWords(){return Array.isArray(window.UNFAMILIAR_VOCAB_DB)?window.UNFAMILIAR_VOCAB_DB:[];}
  function mem(){try{return JSON.parse(localStorage.getItem('indo_mem')||'{}')}catch(e){return {}}}
  function statusOf(m,w){const k=normWord(w);return m[w]||m[k]||'';}
  function unknownWords(){
    const merged=new Map();
    sharedUnknownWords().forEach(x=>{if(x&&x.word)merged.set(normWord(x.word),Object.assign({},x,{source:x.source||'共享陌生词'}))});
    localUnknownWords().forEach(x=>{if(!x||!x.word)return;const k=normWord(x.word),old=merged.get(k)||{};const cn=!missingMeaning(x.cn)?x.cn:(!missingMeaning(old.cn)?old.cn:(x.cn||old.cn||''));merged.set(k,Object.assign({},old,x,{cn:cn,contexts:[...(old.contexts||[]),...(x.contexts||[])].filter((v,i,a)=>v&&a.indexOf(v)===i),times_seen:Math.max(Number(old.times_seen||0),Number(x.times_seen||0),1)}));});
    const m=mem();return [...merged.values()].filter(x=>statusOf(m,x.word)!=='know');
  }

  function masterObjects(){
    const seen=new Set(),out=[];
    (window.MASTER_VOCAB_DB||[]).forEach(raw=>{
      let x;if(Array.isArray(raw))x={word:String(raw[0]||'').trim(),cn:String(raw[1]||'').trim(),en:'',root:'',root_cn:'',scene:'',note:'',categories:['主学习词库']};
      else if(raw&&typeof raw==='object'){x=Object.assign({},raw);x.categories=Array.isArray(x.categories)?x.categories.slice():[];if(!x.categories.includes('主学习词库'))x.categories.push('主学习词库');}
      else return;
      const k=normWord(x.word);if(!k||seen.has(k))return;seen.add(k);out.push(x);
    });
    return out;
  }
  function loadScript(src){return new Promise(resolve=>{const s=document.createElement('script');s.src=src;s.onload=()=>resolve(true);s.onerror=()=>resolve(false);document.head.appendChild(s);});}
  async function ensureMasterData(){
    if(masterObjects().length>=800)return;
    window.MASTER_VOCAB_DB=[];
    for(const src of MASTER_SCRIPTS)await loadScript(src);
    window.MASTER_VOCAB_OBJECTS=masterObjects();
  }

  const meaningAttempts=new Set();
  async function translateZh(word){const w=String(word||'').trim();if(!w)return '';try{const url='https://translate.googleapis.com/translate_a/single?client=gtx&sl=id&tl=zh-CN&dt=t&q='+encodeURIComponent(w);const r=await fetch(url,{method:'GET',mode:'cors',cache:'no-store'});if(!r.ok)return '';const data=await r.json();return Array.isArray(data?.[0])?data[0].map(x=>Array.isArray(x)?x[0]:'').join('').trim():'';}catch(e){return ''}}
  async function fillMissingMeanings(){const map=localUnknownMap();let changed=false;for(const [key,item] of Object.entries(map)){if(!item||!item.word||!missingMeaning(item.cn))continue;const shared=sharedUnknownWords().find(x=>normWord(x.word)===normWord(item.word));if(shared&&!missingMeaning(shared.cn)){item.cn=shared.cn;map[key]=item;changed=true;continue;}const attemptKey=normWord(item.word);if(meaningAttempts.has(attemptKey))continue;meaningAttempts.add(attemptKey);const zh=await translateZh(item.word);if(zh){item.cn=zh;map[key]=item;changed=true;}}if(changed){localStorage.setItem('indo_unknown_words',JSON.stringify(map));if(document.getElementById('librarySelect')?.value==='unknown')setLibrary('unknown');}}

  function sourceFor(key){if(key==='master')return uniqueByWord(window.MASTER_VOCAB_OBJECTS||masterObjects());if(key==='daily')return uniqueByWord(window.DAILY_VOCAB_DB||[]);if(key==='unknown')return uniqueByWord(unknownWords());return uniqueByWord(window.EMBEDDED_DB||[]);}
  function labelFor(key){return key==='master'?'主学习词库':key==='daily'?'每日学习词汇':key==='unknown'?'陌生词汇':'Top1000'}
  function progressKey(key){return 'vocab_progress_'+key}
  function saveProgress(key,word){if(key&&word)localStorage.setItem(progressKey(key),normWord(word));}
  function activeLibrary(){return document.getElementById('librarySelect')?.value||localStorage.getItem('selected_vocab_library')||'top1000'}
  function saveCurrentProgress(){const x=typeof current==='function'?current():null;if(x&&x.word)saveProgress(activeLibrary(),x.word);}
  function unjudgedOnly(arr){const m=mem();return (arr||[]).filter(x=>{const s=statusOf(m,x.word);return s!=='know'&&s!=='fuzzy'&&s!=='dont';});}
  function restoreIndex(key,arr){const saved=normWord(localStorage.getItem(progressKey(key))||'');if(!saved||!arr.length)return 0;const found=arr.findIndex(x=>normWord(x.word)===saved);return found>=0?found:0;}
  function rebuildCategories(){const cat=document.getElementById('cat');if(!cat)return;const cats=[...new Set((DB||[]).flatMap(x=>x.categories||[]).filter(c=>!['每日学习','08:00','19:00','原始课程','历史记录不完整'].includes(c)))].sort();cat.innerHTML='<option value="">全部分类</option>'+cats.map(c=>'<option>'+esc(c)+'</option>').join('');}
  function refreshOptions(){
    const select=document.getElementById('librarySelect');if(!select)return;
    const cur=select.value||localStorage.getItem('selected_vocab_library')||'top1000';
    const masterCount=sourceFor('master').length,topCount=(window.EMBEDDED_DB||[]).length,dailyCount=(window.DAILY_VOCAB_DB||[]).length,unknownCount=unknownWords().length;
    select.innerHTML='<option value="top1000">Top1000（'+topCount+'）</option><option value="master">主学习词库（'+masterCount+'）</option><option value="daily">每日学习词汇（'+dailyCount+'）</option><option value="unknown">陌生词汇（'+unknownCount+'）</option>';
    select.value=['top1000','master','daily','unknown'].includes(cur)?cur:'top1000';
  }
  function updateScopedStats(key,arr){
    const m=mem();let known=0,review=0;
    arr.forEach(x=>{const s=statusOf(m,x.word);if(s==='know')known++;else if(s==='fuzzy'||s==='dont')review++;});
    const unchecked=Math.max(0,arr.length-known-review);
    const vc=document.getElementById('vocabCount'),kc=document.getElementById('knownCount'),rc=document.getElementById('reviewCount');
    if(vc)vc.textContent=arr.length;if(kc)kc.textContent=known;if(rc)rc.textContent=review;
    const st=document.getElementById('dbStatus');if(st)st.textContent=labelFor(key)+' · '+unchecked+' 未判断 · '+review+' 不会 · '+known+' 已掌握 · '+arr.length+' 总词';
    return {total:arr.length,known:known,review:review,unchecked:unchecked};
  }

  function addPrevButton(){const box=document.getElementById('vocabBox');if(!box)return;const actions=box.querySelector('.actions');if(!actions||actions.querySelector('[data-prev-word]'))return;const btn=document.createElement('button');btn.type='button';btn.className='secondary';btn.dataset.prevWord='1';btn.textContent='上一个';btn.addEventListener('click',function(){if(!FILTER||!FILTER.length)return;idx=(idx-1+FILTER.length)%FILTER.length;renderVocab();decorateCard();saveCurrentProgress();});actions.insertBefore(btn,actions.firstChild);}
  function decorateCard(){addPrevButton();const lib=activeLibrary();if(lib!=='daily')return;const x=typeof current==='function'?current():null,flash=document.getElementById('flash');if(!x||!flash)return;const firstMuted=flash.querySelector(':scope > .muted');if(firstMuted)firstMuted.remove();let meaning=flash.querySelector('.meaning');if(!meaning)return;const oldScene=meaning.querySelector('[data-daily-example]');if(oldScene)oldScene.remove();const ex=String(x.example||x.scene||'').trim(),exCn=String(x.example_cn||x.scene_cn||'').trim();if(ex){const box=document.createElement('div');box.dataset.dailyExample='1';box.style.marginTop='16px';box.style.lineHeight='1.65';box.innerHTML='<div style="font-size:17px">'+esc(ex)+'</div>'+(exCn?'<div class="muted" style="margin-top:4px">'+esc(exCn)+'</div>':'');meaning.appendChild(box);}}

  function setLibrary(key){
    if(!['top1000','master','daily','unknown'].includes(key))key='top1000';
    const select=document.getElementById('librarySelect');if(select&&select.value!==key)select.value=key;
    const source=sourceFor(key);DB=source;FILTER=unjudgedOnly(source);idx=restoreIndex(key,FILTER);rebuildCategories();
    const search=document.getElementById('search');if(search)search.value='';
    document.getElementById('vocabTag').textContent=labelFor(key)+' '+source.length+' 词';
    updateScopedStats(key,source);
    if(FILTER.length){renderVocab();decorateCard();saveCurrentProgress();}else{document.getElementById('vocabBox').innerHTML='<div class="empty">当前词库没有未判断词 ✓</div>';}
    localStorage.setItem('selected_vocab_library',key);localStorage.removeItem('vocab_view_mode');if(key==='unknown')setTimeout(fillMissingMeanings,0);
  }
  function showKnownCurrent(){
    const key=activeLibrary(),source=sourceFor(key),m=mem();
    DB=source;FILTER=source.filter(x=>statusOf(m,x.word)==='know');idx=0;rebuildCategories();
    localStorage.setItem('vocab_view_mode','known');
    const search=document.getElementById('search');if(search)search.value='';const cat=document.getElementById('cat');if(cat)cat.value='';
    updateScopedStats(key,source);const st=document.getElementById('dbStatus');if(st)st.textContent=labelFor(key)+' · 已掌握 '+FILTER.length+' 词（查看中）';
    if(FILTER.length){renderVocab();decorateCard();}else{const box=document.getElementById('vocabBox');if(box)box.innerHTML='<div class="empty">当前词库还没有标记“会了”的词。</div>';}
  }
  function showReviewCurrent(){
    const key=activeLibrary(),source=sourceFor(key),m=mem();
    DB=source;FILTER=source.filter(x=>{const s=statusOf(m,x.word);return s==='fuzzy'||s==='dont';});idx=0;rebuildCategories();
    localStorage.setItem('vocab_view_mode','review');
    const search=document.getElementById('search');if(search)search.value='';const cat=document.getElementById('cat');if(cat)cat.value='';
    updateScopedStats(key,source);const st=document.getElementById('dbStatus');if(st)st.textContent=labelFor(key)+' · 不会 '+FILTER.length+' 词（查看中）';
    if(FILTER.length){renderVocab();decorateCard();}else{const box=document.getElementById('vocabBox');if(box)box.innerHTML='<div class="empty">当前词库没有“模糊 / 不会”的词。</div>';}
  }
  function removeLocalUnknown(word){let m=localUnknownMap();const k=normWord(word);Object.keys(m).forEach(key=>{if(key===k||normWord(m[key]?.word)===k)delete m[key]});localStorage.setItem('indo_unknown_words',JSON.stringify(m));window.dispatchEvent(new CustomEvent('unknown-vocab-changed'));}
  function syncWeakness(item,v){const p=window.WeaknessPool;if(!p||!item||!item.word)return;if(v==='know'){if(typeof p.markMastered==='function')p.markMastered(item.word,'vocab_known');else if(typeof p.markKnown==='function')p.markKnown(item.word,'vocab_known');}else if(v==='fuzzy'&&typeof p.markWeak==='function')p.markWeak(item.word,item,'memory_fuzzy');else if(v==='dont'&&typeof p.markWeak==='function')p.markWeak(item.word,item,'memory_dont');}

  let activeAudio=null;function stopSpeech(){if(activeAudio){try{activeAudio.pause();}catch(e){}activeAudio=null;}}
  function remoteTTS(text){try{stopSpeech();const url='https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=id&q='+encodeURIComponent(text);activeAudio=new Audio();activeAudio.preload='auto';activeAudio.src=url;activeAudio.volume=1;const p=activeAudio.play();if(p&&p.catch)p.catch(function(){});}catch(e){}}
  function robustSpeak(text){if(!text)return;text=String(text).trim();if(text)remoteTTS(text);}

  async function install(){
    await ensureMasterData();window.MASTER_VOCAB_OBJECTS=masterObjects();
    const toolbar=document.querySelector('#vocab .toolbar');if(!toolbar)return;
    let select=document.getElementById('librarySelect');if(!select){select=document.createElement('select');select.id='librarySelect';toolbar.insertBefore(select,toolbar.firstChild);}
    select.onchange=function(){saveCurrentProgress();setLibrary(this.value)};
    refreshOptions();
    loadDB=function(){setLibrary(document.getElementById('librarySelect')?.value||'top1000')};window.loadDB=loadDB;window.speak=robustSpeak;speak=robustSpeak;
    const originalRender=window.renderVocab;const decoratedRender=function(){originalRender();decorateCard();};window.renderVocab=decoratedRender;renderVocab=decoratedRender;
    const originalNextWord=window.nextWord;const progressNextWord=function(){originalNextWord();saveCurrentProgress();decorateCard();};window.nextWord=progressNextWord;nextWord=progressNextWord;
    const controlledMark=function(v){
      const lib=activeLibrary(),x=typeof current==='function'?current():null;if(!x)return;
      const m=mem();m[x.word]=v;m[normWord(x.word)]=v;localStorage.setItem('indo_mem',JSON.stringify(m));syncWeakness(x,v);
      const mode=localStorage.getItem('vocab_view_mode')||'';
      if(mode==='known')showKnownCurrent();else if(mode==='review')showReviewCurrent();else setLibrary(lib);
    };window.mark=controlledMark;mark=controlledMark;
    const scopedUpdate=function(){return updateScopedStats(activeLibrary(),sourceFor(activeLibrary()));};window.updateStats=scopedUpdate;try{updateStats=scopedUpdate}catch(e){}
    window.showKnownWords=showKnownCurrent;try{showKnownWords=showKnownCurrent}catch(e){}
    window.showReviewWords=showReviewCurrent;
    const knownCard=document.getElementById('knownCount')?.closest('button');if(knownCard){knownCard.onclick=function(e){e&&e.preventDefault();showKnownCurrent();};knownCard.title='查看当前词库已掌握词汇';knownCard.style.cursor='pointer';}
    const reviewCard=document.getElementById('reviewCount')?.closest('button');if(reviewCard){reviewCard.onclick=function(e){e&&e.preventDefault();showReviewCurrent();};reviewCard.title='查看当前词库“模糊 / 不会”的词汇';reviewCard.style.cursor='pointer';}
    window.switchVocabLibrary=setLibrary;window.openMasterVocabulary=()=>setLibrary('master');window.refreshMasterVocabulary=()=>setLibrary('master');
    window.getUnfamiliarVocabulary=unknownWords;window.refreshUnknownLibrary=function(){refreshOptions();if(activeLibrary()==='unknown')setLibrary('unknown')};
    window.addEventListener('unknown-vocab-changed',function(){window.refreshUnknownLibrary&&window.refreshUnknownLibrary()});
    window.addEventListener('beforeunload',saveCurrentProgress);
    setLibrary(localStorage.getItem('selected_vocab_library')||'top1000');
    window.dispatchEvent(new CustomEvent('vocab-library-ready'));
  }
  if(document.readyState==='complete')setTimeout(install,0);else window.addEventListener('load',()=>setTimeout(install,0),{once:true});
})();