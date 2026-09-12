(function(){
  if(window.__masterVocabIntegrationLoading)return;
  window.__masterVocabIntegrationLoading=true;
  const KEY='master',LABEL='主学习词库';
  function norm(w){return String(w||'').trim().toLowerCase();}
  function uniq(arr){const seen=new Set();return (arr||[]).filter(x=>x&&x.word&&!seen.has(norm(x.word))&&seen.add(norm(x.word)));}
  function mem(){try{return JSON.parse(localStorage.getItem('indo_mem')||'{}')}catch(e){return {}}}
  function load(src,done){const s=document.createElement('script');s.src=src;s.onload=()=>done&&done();s.onerror=()=>console.warn('master vocab load failed',src);document.body.appendChild(s);}
  function master(){return uniq(window.MASTER_VOCAB_DB||[]);}
  function rebuildCategories(){const cat=document.getElementById('cat');if(!cat)return;cat.innerHTML='<option value="">全部分类</option><option>主学习词库</option>';}
  function restoreIndex(arr){const saved=norm(localStorage.getItem('vocab_progress_master')||'');if(!saved)return 0;const i=arr.findIndex(x=>norm(x.word)===saved);return i>=0?i:0;}
  function saveProgress(){try{const x=typeof current==='function'?current():null;if(x&&x.word)localStorage.setItem('vocab_progress_master',norm(x.word));}catch(e){}}
  function setMaster(){
    const arr=master();const m=mem();
    DB=arr;FILTER=arr.filter(x=>m[x.word]!=='know');idx=restoreIndex(FILTER);rebuildCategories();
    const search=document.getElementById('search');if(search)search.value='';
    const select=document.getElementById('librarySelect');if(select)select.value=KEY;
    const count=document.getElementById('vocabCount');if(count)count.textContent=arr.length;
    const tag=document.getElementById('vocabTag');if(tag)tag.textContent=LABEL+' '+arr.length+' 词';
    const st=document.getElementById('dbStatus');if(st)st.textContent=LABEL+' · '+FILTER.length+' 待核对 / '+arr.length+' 总词';
    if(FILTER.length&&typeof renderVocab==='function'){renderVocab();saveProgress();}
    else{const box=document.getElementById('vocabBox');if(box)box.innerHTML='<div class="empty"><b>主学习词库已全部核对 ✓</b><div style="margin-top:8px">点过“会了”的词仍保留在总词库，但不再占每日新词名额。</div></div>';}
    localStorage.setItem('selected_vocab_library',KEY);
  }
  function ensureOption(){
    const select=document.getElementById('librarySelect');if(!select)return;
    let opt=select.querySelector('option[value="master"]');
    if(!opt){opt=document.createElement('option');opt.value=KEY;const daily=select.querySelector('option[value="daily"]');if(daily)select.insertBefore(opt,daily);else select.appendChild(opt);}
    opt.textContent=LABEL+'（'+master().length+'）';
    select.onchange=function(){
      const key=this.value;
      if(key===KEY)setMaster();
      else if(typeof window.switchVocabLibrary==='function')window.switchVocabLibrary(key);
    };
    if(localStorage.getItem('selected_vocab_library')===KEY&&select.value!==KEY)setMaster();
  }
  function patchKnownBridge(tries){
    const p=window.WeaknessPool;
    if(p&&typeof p.markMastered==='function'){
      if(!p.__masterKnownBridge){p.__masterKnownBridge=true;p.markKnown=function(word,reason){return p.markMastered(word,reason||'vocab_known');};}
      return;
    }
    if((tries||0)<30)setTimeout(()=>patchKnownBridge((tries||0)+1),100);
  }
  function install(){
    ensureOption();patchKnownBridge(0);
    const select=document.getElementById('librarySelect');
    if(select){new MutationObserver(function(){queueMicrotask(ensureOption);}).observe(select,{childList:true});}
    window.addEventListener('unknown-vocab-changed',()=>setTimeout(ensureOption,0));
    window.addEventListener('weak-pool-changed',patchKnownBridge);
    window.openMasterVocabulary=setMaster;
  }
  load('data/master-vocab-data.js?v=20260912-1',()=>load('data/master-vocab-data-2.js?v=20260912-1',()=>load('data/master-vocab-data-3.js?v=20260912-1',install)));
})();
