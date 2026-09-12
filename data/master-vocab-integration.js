(function(){
  if(window.__masterVocabIntegrationLoading)return;
  window.__masterVocabIntegrationLoading=true;
  const KEY='master',LABEL='主学习词库';
  function norm(w){return String(w||'').trim().toLowerCase();}
  function mem(){try{return JSON.parse(localStorage.getItem('indo_mem')||'{}')}catch(e){return {}}}
  function load(src,done){const s=document.createElement('script');s.src=src;s.onload=()=>done&&done();s.onerror=()=>console.warn('master vocab load failed',src);document.body.appendChild(s);}

  function master(){
    const seen=new Set(),out=[];
    (window.MASTER_VOCAB_DB||[]).forEach(function(raw){
      let x;
      if(Array.isArray(raw)){
        x={word:String(raw[0]||'').trim(),cn:String(raw[1]||'').trim(),en:'',root:'',root_cn:'',scene:'',note:'',categories:['主学习词库']};
      }else if(raw&&typeof raw==='object'){
        x=Object.assign({},raw);
        x.categories=Array.isArray(x.categories)?x.categories.slice():[];
        if(!x.categories.includes('主学习词库'))x.categories.push('主学习词库');
      }else return;
      const k=norm(x.word);if(!k||seen.has(k))return;seen.add(k);out.push(x);
    });
    return out;
  }
  function rebuildCategories(){const cat=document.getElementById('cat');if(!cat)return;cat.innerHTML='<option value="">全部分类</option><option>主学习词库</option>';}
  function restoreIndex(arr){const saved=norm(localStorage.getItem('vocab_progress_master')||'');if(!saved)return 0;const i=arr.findIndex(x=>norm(x.word)===saved);return i>=0?i:0;}
  function saveProgress(){try{const x=typeof current==='function'?current():null;if(x&&x.word)localStorage.setItem('vocab_progress_master',norm(x.word));}catch(e){}}
  function statusOf(m,word){const k=norm(word);return m[word]||m[k]||'';}
  function isKnown(m,word){return statusOf(m,word)==='know';}
  function isWeak(m,word){const s=statusOf(m,word);return s==='fuzzy'||s==='dont';}
  function orderedPending(arr,m){
    const fresh=[],weak=[];
    arr.forEach(function(x){
      if(isKnown(m,x.word))return;
      (isWeak(m,x.word)?weak:fresh).push(x);
    });
    return fresh.concat(weak);
  }
  function setMaster(){
    const arr=master(),m=mem();
    DB=arr;FILTER=orderedPending(arr,m);idx=restoreIndex(FILTER);rebuildCategories();
    const search=document.getElementById('search');if(search)search.value='';
    const select=document.getElementById('librarySelect');if(select)select.value=KEY;
    const count=document.getElementById('vocabCount');if(count)count.textContent=arr.length;
    const tag=document.getElementById('vocabTag');if(tag)tag.textContent=LABEL+' '+arr.length+' 词';
    const weakCount=arr.filter(x=>isWeak(m,x.word)).length;
    const st=document.getElementById('dbStatus');if(st)st.textContent=LABEL+' · '+FILTER.length+' 待核对 / '+arr.length+' 总词'+(weakCount?' · '+weakCount+' 模糊/不会排末尾':'');
    if(FILTER.length&&typeof renderVocab==='function'){renderVocab();saveProgress();}
    else{const box=document.getElementById('vocabBox');if(box)box.innerHTML='<div class="empty"><b>主学习词库已全部核对 ✓</b><div style="margin-top:8px">点过“会了”的词仍保留在总词库，但不再占每日新词名额。</div></div>';}
    localStorage.setItem('selected_vocab_library',KEY);
  }
  function ensureOption(){
    const select=document.getElementById('librarySelect');if(!select)return false;
    const n=master().length;if(!n)return false;
    let opt=select.querySelector('option[value="master"]');
    if(!opt){opt=document.createElement('option');opt.value=KEY;const daily=select.querySelector('option[value="daily"]');if(daily)select.insertBefore(opt,daily);else select.appendChild(opt);}
    opt.textContent=LABEL+'（'+n+'）';
    select.onchange=function(){saveProgress();const key=this.value;if(key===KEY)setMaster();else if(typeof window.switchVocabLibrary==='function')window.switchVocabLibrary(key);};
    if(localStorage.getItem('selected_vocab_library')===KEY&&select.value!==KEY)setMaster();
    return true;
  }
  function patchKnownBridge(tries){
    const p=window.WeaknessPool;
    if(p&&typeof p.markMastered==='function'){
      if(!p.__masterKnownBridge){p.__masterKnownBridge=true;p.markKnown=function(word,reason){return p.markMastered(word,reason||'vocab_known');};}
      return;
    }
    if((tries||0)<40)setTimeout(()=>patchKnownBridge((tries||0)+1),100);
  }
  function install(){
    let tries=0;const timer=setInterval(function(){if(ensureOption()||++tries>50)clearInterval(timer);},100);
    patchKnownBridge(0);
    const select=document.getElementById('librarySelect');
    if(select){let queued=false;new MutationObserver(function(){if(queued)return;queued=true;queueMicrotask(function(){queued=false;ensureOption();});}).observe(select,{childList:true});}
    const back=document.querySelector('#vocab .back');if(back)back.addEventListener('click',saveProgress,true);
    window.addEventListener('pagehide',saveProgress);
    document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')saveProgress();});
    window.addEventListener('unknown-vocab-changed',()=>setTimeout(ensureOption,0));
    window.addEventListener('weak-pool-changed',patchKnownBridge);
    window.openMasterVocabulary=setMaster;
  }
  window.MASTER_VOCAB_DB=[];
  load('data/master-vocab-data.js?v=20260912-2',()=>load('data/master-vocab-data-2.js?v=20260912-2',()=>load('data/master-vocab-data-3.js?v=20260912-2',install)));
})();
