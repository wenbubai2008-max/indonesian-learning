(function(){
  const MEM_KEY='indo_mem';
  let installed=false,pending=false;
  function mem(){try{return JSON.parse(localStorage.getItem(MEM_KEY)||'{}')}catch(e){return {}}}
  function statusOf(x){if(!x||!x.word)return '';const m=mem(),k=String(x.word||'').trim().toLowerCase();return m[x.word]||m[k]||'';}
  function isKnown(x){return statusOf(x)==='know';}
  function isMaster(){return document.getElementById('librarySelect')?.value==='master';}
  function currentItem(){try{return (typeof FILTER!=='undefined'&&Array.isArray(FILTER)&&FILTER.length)?FILTER[Math.max(0,Math.min(typeof idx==='number'?idx:0,FILTER.length-1))]:null;}catch(e){return null;}}
  function syncWeakness(item,v){if(!item||!item.word||!window.WeaknessPool)return;if(v==='know'){if(typeof window.WeaknessPool.markMastered==='function')window.WeaknessPool.markMastered(item.word,'vocab_known');else if(typeof window.WeaknessPool.markKnown==='function')window.WeaknessPool.markKnown(item.word,'vocab_known');}else if(v==='fuzzy'&&typeof window.WeaknessPool.markWeak==='function')window.WeaknessPool.markWeak(item.word,item,'memory_fuzzy');else if(v==='dont'&&typeof window.WeaknessPool.markWeak==='function')window.WeaknessPool.markWeak(item.word,item,'memory_dont');}
  function addStyle(){if(document.getElementById('vocabMemoryFeedbackStyle'))return;const s=document.createElement('style');s.id='vocabMemoryFeedbackStyle';s.textContent=`@keyframes memFlashKnow{0%{background:#fff}45%{background:#dff6e7;border-color:#63b879;color:#166534}100%{background:#fff}}@keyframes memFlashFuzzy{0%{background:#fff}45%{background:#fff2cc;border-color:#d6a63d;color:#8a5a00}100%{background:#fff}}@keyframes memFlashDont{0%{background:#fff}45%{background:#ffe1de;border-color:#d87870;color:#a52b22}100%{background:#fff}}.memory button.mem-flash-know{animation:memFlashKnow .18s ease}.memory button.mem-flash-fuzzy{animation:memFlashFuzzy .18s ease}.memory button.mem-flash-dont{animation:memFlashDont .18s ease}#vocab>#statsBar{margin:0 0 16px!important}#knownCount.closest{cursor:pointer}`;document.head.appendChild(s);}
  function moveStatsIntoVocab(){const stats=document.getElementById('statsBar'),page=document.getElementById('vocab');if(!stats||!page)return;if(stats.parentElement!==page){const card=page.querySelector(':scope > .card');if(card)page.insertBefore(stats,card);else page.appendChild(stats);}if(page.classList.contains('active'))stats.style.display='grid';const known=document.getElementById('knownCount')?.closest('button');if(known){known.style.cursor='pointer';known.title='查看当前词库已掌握词汇';}}
  function feedbackButton(v){const buttons=[...document.querySelectorAll('#vocabBox .memory button')],label=v==='know'?'会了':v==='fuzzy'?'模糊':'不会',btn=buttons.find(b=>(b.textContent||'').trim().includes(label));if(!btn)return;const cls=v==='know'?'mem-flash-know':v==='fuzzy'?'mem-flash-fuzzy':'mem-flash-dont';btn.classList.remove('mem-flash-know','mem-flash-fuzzy','mem-flash-dont');void btn.offsetWidth;btn.classList.add(cls);}
  function pruneKnown(){try{if(window.__vocabKnownView)return;if(isMaster()){if(typeof window.refreshMasterVocabulary==='function')window.refreshMasterVocabulary();return;}if(typeof FILTER==='undefined'||typeof DB==='undefined'||!Array.isArray(DB))return;FILTER=(DB||[]).filter(x=>!isKnown(x));if(typeof idx!=='undefined')idx=Math.max(0,Math.min(idx||0,Math.max(0,FILTER.length-1)));if(typeof renderVocab==='function')renderVocab();}catch(e){console.warn('pruneKnown failed',e)}}
  function markMasterDirect(v,item){const m=mem();m[item.word]=v;m[String(item.word||'').trim().toLowerCase()]=v;localStorage.setItem(MEM_KEY,JSON.stringify(m));syncWeakness(item,v);if(window.__vocabKnownView){try{FILTER=(DB||[]).filter(x=>isKnown(x));idx=Math.max(0,Math.min(idx||0,Math.max(0,FILTER.length-1)));if(typeof renderVocab==='function')renderVocab();}catch(e){}return;}if(typeof window.refreshMasterVocabulary==='function')window.refreshMasterVocabulary();try{if(typeof updateStats==='function')updateStats();}catch(e){}try{if(typeof renderReview==='function')renderReview();}catch(e){}}
  function showKnownDirect(){
    window.__vocabKnownView=true;
    const m=mem();
    try{
      if(typeof DB==='undefined'||!Array.isArray(DB))return;
      FILTER=(DB||[]).filter(x=>{const k=String(x?.word||'').trim().toLowerCase();return x&&x.word&&(m[x.word]==='know'||m[k]==='know');});
      idx=0;
      const search=document.getElementById('search');if(search)search.value='';
      const cat=document.getElementById('cat');if(cat)cat.value='';
      const select=document.getElementById('librarySelect');
      const label=select?.value==='master'?'主学习词库':select?.value==='daily'?'每日学习词汇':select?.value==='unknown'?'陌生词汇':'Top1000';
      const st=document.getElementById('dbStatus');if(st)st.textContent=label+' · 已掌握 '+FILTER.length+' 词（查看中）';
      if(FILTER.length&&typeof renderVocab==='function')renderVocab();else{const box=document.getElementById('vocabBox');if(box)box.innerHTML='<div class="empty">当前词库还没有标记“会了”的词。</div>';}
    }catch(e){console.warn('showKnownDirect failed',e)}
  }
  function install(){
    if(installed)return;if(typeof window.mark!=='function'||typeof window.go!=='function'){setTimeout(install,120);return;}installed=true;addStyle();moveStatsIntoVocab();
    const baseMark=window.mark;const wrappedMark=function(v){if(pending)return;const item=currentItem();if(!item)return;pending=true;const masterAtClick=isMaster();feedbackButton(v);setTimeout(function(){try{if(masterAtClick)markMasterDirect(v,item);else{baseMark(v);syncWeakness(item,v);if(v==='know'&&!window.__vocabKnownView)setTimeout(pruneKnown,20);else if(window.__vocabKnownView)showKnownDirect();}}finally{pending=false;}},120);};window.mark=wrappedMark;try{mark=wrappedMark}catch(e){}
    const baseGo=window.go;window.go=function(id){baseGo(id);moveStatsIntoVocab();if(id==='vocab'&&!window.__vocabKnownView)setTimeout(function(){if(isMaster()&&typeof window.refreshMasterVocabulary==='function')window.refreshMasterVocabulary();else pruneKnown();},60);};try{go=window.go}catch(e){}
    document.addEventListener('click',function(e){const card=e.target&&e.target.closest?e.target.closest('#statsBar button'):null;if(!card||!card.querySelector('#knownCount'))return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();showKnownDirect();},true);
    const sel=document.getElementById('librarySelect');if(sel)sel.addEventListener('change',function(){window.__vocabKnownView=false;setTimeout(function(){if(isMaster()&&typeof window.refreshMasterVocabulary==='function')window.refreshMasterVocabulary();else pruneKnown();},60);});
    document.querySelector('#vocab .toolbar')?.addEventListener('click',function(e){const t=e.target;if(t&&t.tagName==='BUTTON'&&(t.textContent||'').includes('重新加载')){window.__vocabKnownView=false;setTimeout(function(){if(isMaster()&&typeof window.refreshMasterVocabulary==='function')window.refreshMasterVocabulary();else pruneKnown();},100);}});
    setTimeout(moveStatsIntoVocab,180);
  }
  if(document.readyState==='complete')setTimeout(install,120);else window.addEventListener('load',()=>setTimeout(install,120),{once:true});
})();