(function(){
  if(window.__masterVocabIntegrationLoading)return;
  window.__masterVocabIntegrationLoading=true;
  const KEY='master',LABEL='主学习词库',BACKFILL_KEY='master_known_backfill_v1',PROGRESS_KEY='vocab_progress_master';
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
  function statusOf(m,word){const k=norm(word);return m[word]||m[k]||'';}
  function isFresh(m,word){return !statusOf(m,word);}
  function uncheckedOnly(arr,m){return arr.filter(x=>isFresh(m,x.word));}
  function resolveResumeWord(arr,m){
    const saved=norm(localStorage.getItem(PROGRESS_KEY)||'');
    if(saved){const exact=arr.find(x=>norm(x.word)===saved);if(exact&&isFresh(m,exact.word))return exact.word;}
    const first=arr.find(x=>isFresh(m,x.word));return first?first.word:'';
  }
  function restoreIndex(pending,arr,m){
    if(!pending.length)return 0;
    const target=norm(resolveResumeWord(arr,m));
    if(target){const i=pending.findIndex(x=>norm(x.word)===target);if(i>=0)return i;}
    return 0;
  }
  function saveProgress(){
    try{
      if(document.getElementById('librarySelect')?.value!==KEY)return;
      const x=typeof current==='function'?current():null;
      if(x&&x.word&&isFresh(mem(),x.word))localStorage.setItem(PROGRESS_KEY,norm(x.word));
    }catch(e){}
  }
  function updateMasterStatus(arr,m){
    arr=arr||master();m=m||mem();
    let known=0,review=0;
    arr.forEach(function(x){const s=statusOf(m,x.word);if(s==='know')known++;else if(s==='fuzzy'||s==='dont')review++;});
    const unchecked=Math.max(0,arr.length-known-review);
    const st=document.getElementById('dbStatus');
    if(st)st.textContent=LABEL+' · '+unchecked+' 未核对 · '+review+' 已标待复习 · '+known+' 已掌握 · '+arr.length+' 总词';
  }
  function renderMaster(){
    const arr=master(),m=mem();
    DB=arr;FILTER=uncheckedOnly(arr,m);idx=restoreIndex(FILTER,arr,m);rebuildCategories();
    const search=document.getElementById('search');if(search)search.value='';
    const select=document.getElementById('librarySelect');if(select)select.value=KEY;
    const count=document.getElementById('vocabCount');if(count)count.textContent=arr.length;
    const tag=document.getElementById('vocabTag');if(tag)tag.textContent=LABEL+' '+arr.length+' 词';
    updateMasterStatus(arr,m);
    if(FILTER.length&&typeof renderVocab==='function'){renderVocab();saveProgress();}
    else{const box=document.getElementById('vocabBox');if(box)box.innerHTML='<div class="empty"><b>主学习词库已全部核对 ✓</b><div style="margin-top:8px">“会了 / 模糊 / 不会”只用于记录状态；点过的词都不会在本轮再次出现。</div></div>';}
    localStorage.setItem('selected_vocab_library',KEY);
  }
  function removeCurrentAfterMark(word){
    if(document.getElementById('librarySelect')?.value!==KEY)return;
    const arr=master(),m=mem();
    FILTER=uncheckedOnly(arr,m);idx=0;
    if(FILTER.length)localStorage.setItem(PROGRESS_KEY,norm(FILTER[0].word));
    updateMasterStatus(arr,m);
    if(FILTER.length&&typeof renderVocab==='function')renderVocab();
    else{const box=document.getElementById('vocabBox');if(box)box.innerHTML='<div class="empty"><b>主学习词库已全部核对 ✓</b><div style="margin-top:8px">“会了 / 模糊 / 不会”只用于记录状态；点过的词都不会在本轮再次出现。</div></div>';}
  }
  function ensureOption(){
    const select=document.getElementById('librarySelect');if(!select)return false;
    const n=master().length;if(!n)return false;
    let opt=select.querySelector('option[value="master"]');
    if(!opt){opt=document.createElement('option');opt.value=KEY;const daily=select.querySelector('option[value="daily"]');if(daily)select.insertBefore(opt,daily);else select.appendChild(opt);}
    opt.textContent=LABEL+'（'+n+'）';
    select.onchange=function(){saveProgress();const key=this.value;if(key===KEY)renderMaster();else if(typeof window.switchVocabLibrary==='function')window.switchVocabLibrary(key);};
    if(localStorage.getItem('selected_vocab_library')===KEY&&select.value!==KEY)renderMaster();
    return true;
  }
  function backfillKnownOnce(p){
    if(!p||typeof p.markMastered!=='function')return;
    if(localStorage.getItem(BACKFILL_KEY)==='done')return;
    const m=mem();let n=0;
    Object.keys(m).forEach(function(word){if(m[word]!=='know')return;try{p.markMastered(word,'master_known_backfill');n++;}catch(e){}});
    localStorage.setItem(BACKFILL_KEY,'done');
    if(n&&window.WeaknessSync&&typeof window.WeaknessSync.syncNow==='function')setTimeout(function(){window.WeaknessSync.syncNow();},1200);
  }
  function patchKnownBridge(tries){
    const p=window.WeaknessPool;
    if(p&&typeof p.markMastered==='function'){
      if(!p.__masterKnownBridge){p.__masterKnownBridge=true;p.markKnown=function(word,reason){return p.markMastered(word,reason||'vocab_known');};}
      backfillKnownOnce(p);return;
    }
    if((tries||0)<80)setTimeout(()=>patchKnownBridge((tries||0)+1),100);
  }
  function install(){
    let tries=0;const timer=setInterval(function(){if(ensureOption()||++tries>50)clearInterval(timer);},100);
    patchKnownBridge(0);
    const select=document.getElementById('librarySelect');
    if(select){let queued=false;new MutationObserver(function(){if(queued)return;queued=true;queueMicrotask(function(){queued=false;ensureOption();});}).observe(select,{childList:true});}
    const back=document.querySelector('#vocab .back');if(back)back.addEventListener('click',saveProgress,true);
    window.addEventListener('pagehide',saveProgress);
    document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')saveProgress();});
    document.addEventListener('click',function(e){
      const btn=e.target&&e.target.closest?e.target.closest('#vocabBox .memory button'):null;
      if(!btn||document.getElementById('librarySelect')?.value!==KEY)return;
      const x=typeof current==='function'?current():null,word=x&&x.word;if(!word)return;
      setTimeout(function(){removeCurrentAfterMark(word);},360);
    },true);
    window.addEventListener('unknown-vocab-changed',function(){setTimeout(ensureOption,0);});
    window.addEventListener('weak-pool-changed',function(){patchKnownBridge(0);});
    window.openMasterVocabulary=renderMaster;
  }
  window.MASTER_VOCAB_DB=[];
  load('data/master-vocab-data.js?v=20260912-2',()=>load('data/master-vocab-data-2.js?v=20260912-2',()=>load('data/master-vocab-data-3.js?v=20260912-2',install)));
})();