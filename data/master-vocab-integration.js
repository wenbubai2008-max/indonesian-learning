(function(){
  if(window.__masterVocabIntegrationLoading)return;
  window.__masterVocabIntegrationLoading=true;
  const KEY='master',LABEL='主学习词库',BACKFILL_KEY='master_known_backfill_v1',PROGRESS_KEY='vocab_progress_master';
  function norm(w){return String(w||'').trim().toLowerCase();}
  function mem(){try{return JSON.parse(localStorage.getItem('indo_mem')||'{}')}catch(e){return {}}}
  function load(src,done){const s=document.createElement('script');s.src=src;s.onload=()=>done&&done();s.onerror=()=>console.warn('master vocab load failed',src);document.body.appendChild(s);}

  function buildMasterObjects(){
    const seen=new Set(),out=[];
    (window.MASTER_VOCAB_DB||[]).forEach(function(raw){
      let x;
      if(Array.isArray(raw))x={word:String(raw[0]||'').trim(),cn:String(raw[1]||'').trim(),en:'',root:'',root_cn:'',scene:'',note:'',categories:['主学习词库']};
      else if(raw&&typeof raw==='object'){
        x=Object.assign({},raw);
        x.categories=Array.isArray(x.categories)?x.categories.slice():[];
        if(!x.categories.includes('主学习词库'))x.categories.push('主学习词库');
      }else return;
      const k=norm(x.word);if(!k||seen.has(k))return;seen.add(k);out.push(x);
    });
    window.MASTER_VOCAB_OBJECTS=out;
    return out;
  }
  function master(){return Array.isArray(window.MASTER_VOCAB_OBJECTS)&&window.MASTER_VOCAB_OBJECTS.length?window.MASTER_VOCAB_OBJECTS:buildMasterObjects();}
  function rebuildCategories(){const cat=document.getElementById('cat');if(!cat)return;cat.innerHTML='<option value="">全部分类</option><option>主学习词库</option>';}
  function statusOf(m,word){const k=norm(word);return m[word]||m[k]||'';}
  function isFresh(m,word){return !statusOf(m,word);}
  function uncheckedOnly(arr,m){return arr.filter(x=>isFresh(m,x.word));}
  function resolveResumeWord(arr,m){const saved=norm(localStorage.getItem(PROGRESS_KEY)||'');if(saved){const exact=arr.find(x=>norm(x.word)===saved);if(exact&&isFresh(m,exact.word))return exact.word;}const first=arr.find(x=>isFresh(m,x.word));return first?first.word:'';}
  function restoreIndex(pending,arr,m){if(!pending.length)return 0;const target=norm(resolveResumeWord(arr,m));if(target){const i=pending.findIndex(x=>norm(x.word)===target);if(i>=0)return i;}return 0;}
  function saveProgress(){try{if(document.getElementById('librarySelect')?.value!==KEY)return;const x=typeof current==='function'?current():null;if(x&&x.word&&isFresh(mem(),x.word))localStorage.setItem(PROGRESS_KEY,norm(x.word));}catch(e){}}
  function updateMasterStatus(arr,m){arr=arr||master();m=m||mem();let known=0,review=0;arr.forEach(function(x){const s=statusOf(m,x.word);if(s==='know')known++;else if(s==='fuzzy'||s==='dont')review++;});const unchecked=Math.max(0,arr.length-known-review);const st=document.getElementById('dbStatus');if(st)st.textContent=LABEL+' · '+unchecked+' 未核对 · '+review+' 待复习 · '+known+' 已掌握 · '+arr.length+' 总词';if(typeof window.renderScopedStats==='function')setTimeout(window.renderScopedStats,0);}
  function renderMaster(){
    const arr=master(),m=mem();
    if(!arr.length){const box=document.getElementById('vocabBox');if(box)box.innerHTML='<div class="error"><b>主学习词库加载失败</b><div>未读取到主词库数据，请重新加载页面。</div></div>';return;}
    DB=arr;FILTER=uncheckedOnly(arr,m);idx=restoreIndex(FILTER,arr,m);rebuildCategories();
    const search=document.getElementById('search');if(search)search.value='';
    const select=document.getElementById('librarySelect');if(select)select.value=KEY;
    const count=document.getElementById('vocabCount');if(count)count.textContent=arr.length;
    const tag=document.getElementById('vocabTag');if(tag)tag.textContent=LABEL+' '+arr.length+' 词';
    updateMasterStatus(arr,m);
    if(FILTER.length&&typeof renderVocab==='function'){renderVocab();saveProgress();}
    else{const box=document.getElementById('vocabBox');if(box)box.innerHTML='<div class="empty"><b>主学习词库已全部核对 ✓</b><div style="margin-top:8px">“会了 / 模糊 / 不会”都已记录；本轮没有未核对词。</div></div>';}
    localStorage.setItem('selected_vocab_library',KEY);
    window.dispatchEvent(new CustomEvent('master-vocab-ready',{detail:{total:arr.length,pending:FILTER.length}}));
  }
  function ensureOption(){
    const select=document.getElementById('librarySelect');if(!select)return false;
    const n=master().length;if(!n)return false;
    let opt=select.querySelector('option[value="master"]');
    if(!opt){opt=document.createElement('option');opt.value=KEY;const daily=select.querySelector('option[value="daily"]');if(daily)select.insertBefore(opt,daily);else select.appendChild(opt);}
    opt.textContent=LABEL+'（'+n+'）';
    select.onchange=function(){saveProgress();const key=this.value;if(key===KEY)renderMaster();else if(typeof window.switchVocabLibrary==='function')window.switchVocabLibrary(key);};
    return true;
  }
  function backfillKnownOnce(p){if(!p||typeof p.markMastered!=='function'||localStorage.getItem(BACKFILL_KEY)==='done')return;const m=mem();let n=0;Object.keys(m).forEach(function(word){if(m[word]!=='know')return;try{p.markMastered(word,'master_known_backfill');n++;}catch(e){}});localStorage.setItem(BACKFILL_KEY,'done');if(n&&window.WeaknessSync&&typeof window.WeaknessSync.syncNow==='function')setTimeout(function(){window.WeaknessSync.syncNow();},1200);}
  function patchKnownBridge(tries){const p=window.WeaknessPool;if(p&&typeof p.markMastered==='function'){if(!p.__masterKnownBridge){p.__masterKnownBridge=true;p.markKnown=function(word,reason){return p.markMastered(word,reason||'vocab_known');};}backfillKnownOnce(p);return;}if((tries||0)<80)setTimeout(()=>patchKnownBridge((tries||0)+1),100);}
  function install(){
    ensureOption();patchKnownBridge(0);
    const select=document.getElementById('librarySelect');
    if(select){let queued=false;new MutationObserver(function(){if(queued)return;queued=true;queueMicrotask(function(){queued=false;ensureOption();if(document.getElementById('vocab')?.classList.contains('active')&&select.value===KEY)renderMaster();});}).observe(select,{childList:true});}
    const page=document.getElementById('vocab');if(page){new MutationObserver(function(){if(page.classList.contains('active')&&document.getElementById('librarySelect')?.value===KEY)renderMaster();}).observe(page,{attributes:true,attributeFilter:['class']});}
    const back=document.querySelector('#vocab .back');if(back)back.addEventListener('click',saveProgress,true);
    window.addEventListener('pagehide',saveProgress);document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')saveProgress();});
    window.addEventListener('unknown-vocab-changed',function(){setTimeout(ensureOption,0);});window.addEventListener('weak-pool-changed',function(){patchKnownBridge(0);});
    window.openMasterVocabulary=renderMaster;window.refreshMasterVocabulary=renderMaster;
    if(localStorage.getItem('selected_vocab_library')===KEY||select?.value===KEY){if(select)select.value=KEY;renderMaster();}
  }
  window.MASTER_VOCAB_DB=[];window.MASTER_VOCAB_OBJECTS=[];
  load('data/master-vocab-data.js?v=20260912-5',()=>load('data/master-vocab-data-2.js?v=20260912-5',()=>load('data/master-vocab-data-3.js?v=20260912-5',()=>{buildMasterObjects();install();})));
})();