(function(){
  if(window.__VOCAB_CONTROLLER_20260917__) return;
  window.__VOCAB_CONTROLLER_20260917__=true;

  const $=id=>document.getElementById(id);
  const norm=s=>String(s||'').trim().toLowerCase();
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
  const MASTER_SCRIPTS=['data/master-vocab-data.js?v=20260917-controller1','data/master-vocab-data-2.js?v=20260917-controller1','data/master-vocab-data-3.js?v=20260917-controller1'];
  const EXPECTED_MASTER_COUNT=977;
  const EXPECTED_BIPA_COUNTS={A1:515,A2:290,B1:204,B2:274};
  const NORMAL_KEYS=['master','pending-primary','pending-secondary','daily','unknown'];
  const BIPA_KEYS=['bipa-a1','bipa-a2','bipa-b1','bipa-b2'];
  const ALL_KEYS=[...NORMAL_KEYS,...BIPA_KEYS];
  let activeKey='master';
  let activeView='';
  let installed=false;
  let initPromise=null;
  let dataReady=false;
  let activeAudio=null;
  let switchSeq=0;
  let vocabOpenObserver=null;
  const meaningAttempts=new Set();
  const memCache=new Map();
  const sourceCache=new Map();
  let pendingCatalog=null,pendingPromise=null,pendingError='',pendingUndo=null,pendingRefreshQueued=false;

  function uniqueByWord(arr){
    const seen=new Set(),out=[];
    (arr||[]).forEach(x=>{if(!x||!x.word)return;const k=norm(x.word);if(!k||seen.has(k))return;seen.add(k);out.push(x)});
    return out;
  }
  function loadScript(src){
    return new Promise(resolve=>{
      const s=document.createElement('script');s.src=src;s.async=false;
      s.onload=()=>resolve(true);s.onerror=()=>resolve(false);document.head.appendChild(s);
    });
  }
  function masterObjects(){
    const seen=new Set(),out=[];
    (window.MASTER_VOCAB_DB||[]).forEach(raw=>{
      let x;
      if(Array.isArray(raw))x={word:String(raw[0]||'').trim(),cn:String(raw[1]||'').trim(),en:'',root:'',root_cn:'',scene:'',note:'',categories:['主学习词库']};
      else if(raw&&typeof raw==='object'){x=Object.assign({},raw);x.categories=Array.isArray(x.categories)?x.categories.slice():[];if(!x.categories.includes('主学习词库'))x.categories.push('主学习词库');}
      else return;
      const k=norm(x.word);if(!k||seen.has(k))return;seen.add(k);out.push(x);
    });
    return out;
  }
  async function ensureMasterData(){
    let current=masterObjects();
    if(current.length===EXPECTED_MASTER_COUNT){window.MASTER_VOCAB_OBJECTS=current;sourceCache.set('master',current);return;}
    window.MASTER_VOCAB_DB=[];
    for(const src of MASTER_SCRIPTS){const ok=await loadScript(src);if(!ok)throw new Error('主学习词库加载失败：'+src)}
    current=masterObjects();
    if(current.length!==EXPECTED_MASTER_COUNT)throw new Error('主学习词库数量异常：'+current.length+' / '+EXPECTED_MASTER_COUNT);
    window.MASTER_VOCAB_OBJECTS=current;sourceCache.set('master',current);
  }
  function bipaCounts(){
    const r=window.BIPA_VOCAB_RAW||{},out={};
    Object.keys(EXPECTED_BIPA_COUNTS).forEach(k=>{out[k]=Array.isArray(r[k])?r[k].length:0});
    return out;
  }
  function bipaReady(level){
    const lv=String(level||'').toUpperCase(),r=window.BIPA_VOCAB_RAW||{};
    if(lv&&EXPECTED_BIPA_COUNTS[lv])return Array.isArray(r[lv])&&r[lv].length===EXPECTED_BIPA_COUNTS[lv];
    return Object.keys(EXPECTED_BIPA_COUNTS).every(k=>Array.isArray(r[k])&&r[k].length===EXPECTED_BIPA_COUNTS[k]);
  }
  async function ensureBipaData(level){
    const lv=String(level||'').toUpperCase();
    if(!EXPECTED_BIPA_COUNTS[lv])throw new Error('未知 BIPA 级别：'+level);
    if(bipaReady(lv))return;
    if(window.BipaDataLoader&&typeof window.BipaDataLoader.load==='function')await window.BipaDataLoader.load(lv);
    if(!bipaReady(lv))throw new Error('BIPA '+lv+' 词库数量异常：'+(bipaCounts()[lv]||0)+' / '+EXPECTED_BIPA_COUNTS[lv]);
    sourceCache.delete('bipa-'+lv.toLowerCase());
  }


  function isPendingKey(key=activeKey){return key==='pending-primary'||key==='pending-secondary'}
  async function ensurePendingData(force=false){
    if(pendingCatalog&&!force)return pendingCatalog;
    if(pendingPromise)return pendingPromise;
    pendingPromise=(async()=>{
      const r=await fetch('data/pending-vocab.json?v='+Date.now(),{cache:'no-store'});
      if(!r.ok)throw new Error('HTTP '+r.status);
      const doc=await r.json();
      if(!doc||doc.version!==1||!Array.isArray(doc.primary)||!Array.isArray(doc.secondary))throw new Error('待学习清单格式错误');
      for(const rows of [doc.primary,doc.secondary]){
        const keys=new Set();
        for(const x of rows){
          if(!x||!String(x.word||'').trim()||keys.has(norm(x.word)))throw new Error('待学习清单包含空词或重复词');
          keys.add(norm(x.word));
        }
      }
      pendingCatalog=doc;pendingError='';return doc;
    })();
    try{return await pendingPromise}
    catch(e){pendingError=e&&e.message||'读取失败';throw e}
    finally{pendingPromise=null}
  }
  // The server snapshot gives the complete M ∩ A − D list, not the truncated
  // lesson runtime window. Local/cloud mastered edits hide immediately here.
  function pendingRows(key){
    if(!pendingCatalog)return [];
    const wp=window.WeaknessPool,states=new Map(),mem=normalMem();
    if(wp&&typeof wp.all==='function')wp.all().forEach(x=>{if(x&&x.word)states.set(norm(x.word),x.status)});
    const source=key==='pending-primary'?pendingCatalog.primary:pendingCatalog.secondary;
    return source.filter(x=>{
      const st=states.get(norm(x.word));
      return st?st!=='mastered':statusFromMemory(x.word,key,mem)!=='know';
    }).map(x=>Object.assign({},x,{
      categories:[key==='pending-primary'?'主词库待学习':'第二词库待学习'],
      note:x.memory_class==='dont'?'当前状态：明确不会':x.memory_class==='fuzzy'?'当前状态：模糊':'当前待学习'
    }));
  }

  function localUnknownMap(){try{return JSON.parse(localStorage.getItem('indo_unknown_words')||'{}')}catch(e){return {}}}
  function missingMeaning(v){const s=String(v||'').trim();return !s||['暂无释义','暂未查到释义','查询中文释义…','查询中文释义...'].includes(s)}
  function localUnknownWords(){
    return Object.values(localUnknownMap()).map(x=>({word:x.word,display:x.display||x.word,cn:x.cn||'',en:x.en||'',root:x.root||'',scene:(x.contexts&&x.contexts.length)?x.contexts[x.contexts.length-1]:'',note:'遇到 '+(x.times_seen||1)+' 次'+(x.source_date?' · '+x.source_date:'')+(x.session?' · '+x.session:''),contexts:x.contexts||[],times_seen:x.times_seen||1,source:'电脑新增'}));
  }
  function sharedUnknownWords(){return Array.isArray(window.UNFAMILIAR_VOCAB_DB)?window.UNFAMILIAR_VOCAB_DB:[]}
  function bipaLevelForKey(key){const m=String(key||'').match(/^bipa-(a1|a2|b1|b2)$/i);return m?m[1].toUpperCase():''}
  function isBipaKey(key=activeKey){return !!bipaLevelForKey(key)}
  function memKeyFor(key=activeKey){const lv=bipaLevelForKey(key);return lv?'indo_bipa_mem_'+lv:'indo_mem'}
  function memoryFor(key=activeKey){
    const mk=memKeyFor(key);
    if(memCache.has(mk))return memCache.get(mk);
    let m={};try{m=JSON.parse(localStorage.getItem(mk)||'{}')||{}}catch(e){m={}}
    memCache.set(mk,m);return m;
  }
  function persistMemory(key,m){const mk=memKeyFor(key);memCache.set(mk,m);localStorage.setItem(mk,JSON.stringify(m))}
  function normalMem(){return memoryFor('top1000')}
  function statusFromMemory(word,key,m){const k=norm(word);return isBipaKey(key)?(m[k]||''):(m[word]||m[k]||'')}
  function statusOf(word,key=activeKey){return statusFromMemory(word,key,memoryFor(key))}
  window.addEventListener('storage',e=>{if(e&&e.key&&(e.key==='indo_mem'||/^indo_bipa_mem_/.test(e.key)))memCache.delete(e.key)});

  function unknownWords(){
    const merged=new Map();
    sharedUnknownWords().forEach(x=>{if(x&&x.word)merged.set(norm(x.word),Object.assign({},x,{source:x.source||'共享陌生词'}))});
    localUnknownWords().forEach(x=>{if(!x||!x.word)return;const k=norm(x.word),old=merged.get(k)||{},cn=!missingMeaning(x.cn)?x.cn:(!missingMeaning(old.cn)?old.cn:(x.cn||old.cn||''));merged.set(k,Object.assign({},old,x,{cn,contexts:[...(old.contexts||[]),...(x.contexts||[])].filter((v,i,a)=>v&&a.indexOf(v)===i),times_seen:Math.max(Number(old.times_seen||0),Number(x.times_seen||0),1)}))});
    const m=normalMem();return [...merged.values()].filter(x=>(m[x.word]||m[norm(x.word)]||'')!=='know');
  }
  function bipaObjects(level){
    const ck='bipa-'+String(level||'').toLowerCase();if(sourceCache.has(ck))return sourceCache.get(ck);
    const rows=(window.BIPA_VOCAB_RAW&&window.BIPA_VOCAB_RAW[level])||[];
    const out=uniqueByWord(rows.map(r=>Array.isArray(r)?({word:String(r[0]||'').trim(),cn:String(r[1]||'').trim(),en:String(r[2]||'').trim(),root:String(r[3]||'').trim(),root_note:String(r[4]||'').trim(),theme:String(r[5]||'').trim(),lesson:String(r[6]||'').trim(),pages:String(r[7]||'').trim(),sab:String(r[8]||'').trim().toUpperCase(),note:String(r[9]||'').trim(),categories:[String(r[5]||'').trim()].filter(Boolean)}):null));
    sourceCache.set(ck,out);return out;
  }
  function sourceFor(key=activeKey){
    if(isPendingKey(key))return pendingRows(key);
    if(key==='master'){if(sourceCache.has('master'))return sourceCache.get('master');const out=uniqueByWord(window.MASTER_VOCAB_OBJECTS||masterObjects());sourceCache.set('master',out);return out}
    if(key==='daily'){if(sourceCache.has('daily'))return sourceCache.get('daily');const out=uniqueByWord(window.DAILY_VOCAB_DB||[]);sourceCache.set('daily',out);return out}
    if(key==='unknown')return uniqueByWord(unknownWords());
    if(key==='top1000'){if(sourceCache.has('top1000'))return sourceCache.get('top1000');const out=uniqueByWord(window.EMBEDDED_DB||[]);sourceCache.set('top1000',out);return out}
    const lv=bipaLevelForKey(key);if(lv)return bipaObjects(lv);
    return [];
  }
  function labelFor(key=activeKey){
    if(key==='master')return '主学习词库';if(key==='pending-primary')return '主词库·待学习';if(key==='pending-secondary')return '第二词库·待学习';if(key==='daily')return '每日学习词汇';if(key==='unknown')return '陌生词汇';
    const lv=bipaLevelForKey(key);return lv?'BIPA（'+lv+'）':'当前词库';
  }
  function canonicalKey(v){
    const s=String(v||'').trim().toLowerCase();
    if(ALL_KEYS.includes(s))return s;
    if(s.includes('bipa')){for(const lv of ['a1','a2','b1','b2'])if(s.includes(lv))return 'bipa-'+lv;}
    return NORMAL_KEYS.includes(s)?s:'master';
  }
  function currentItem(){try{const a=Array.isArray(FILTER)?FILTER:[];if(!a.length)return null;const i=((Number(idx||0)%a.length)+a.length)%a.length;return a[i]||null}catch(e){return null}}
  function progressKey(key=activeKey){return 'vocab_progress_'+key}
  function saveProgress(){const x=currentItem();if(x&&x.word)try{localStorage.setItem(progressKey(),norm(x.word))}catch(e){}}
  function restoreIndex(arr){const saved=norm(localStorage.getItem(progressKey())||'');if(!saved||!arr.length)return 0;const i=arr.findIndex(x=>norm(x.word)===saved);return i>=0?i:0}

  function ensureGradeSelect(){
    const tb=document.querySelector('#vocab .toolbar');if(!tb)return null;
    let s=$('sabFilterStable');
    if(!s){s=document.createElement('select');s.id='sabFilterStable';s.innerHTML='<option value="">全部分级</option><option value="S">S · 核心</option><option value="A">A · 常用</option><option value="B">B · 低频</option>';const cat=$('cat');if(cat&&cat.nextSibling)tb.insertBefore(s,cat.nextSibling);else tb.appendChild(s);}
    s.style.display=isBipaKey()?'':'none';if(!isBipaKey())s.value='';s.onchange=()=>rebuild(true);return s;
  }
  function rebuildCategories(){
    const cat=$('cat');if(!cat)return;
    const cur=cat.value,src=sourceFor();let values=[];
    if(isBipaKey())values=[...new Set(src.map(x=>x.theme).filter(Boolean))].sort();
    else values=[...new Set(src.flatMap(x=>x.categories||[]).filter(c=>c&&!['每日学习','08:00','19:00','原始课程','历史记录不完整'].includes(c)))].sort();
    cat.innerHTML='<option value="">'+(isBipaKey()?'全部主题':'全部分类')+'</option>'+values.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('');
    if(values.includes(cur))cat.value=cur;
  }
  function libraryCount(key){if(isPendingKey(key)&&!pendingCatalog)return pendingError?'暂不可用':'读取中';const lv=bipaLevelForKey(key);if(lv&&!bipaReady(lv))return EXPECTED_BIPA_COUNTS[lv]||0;return sourceFor(key).length}
  function populateLibraryOptions(){
    const select=$('librarySelect');if(!select)return;
    const cur=canonicalKey(select.value||localStorage.getItem('selected_vocab_library')||activeKey);
    const opts=[
      ['master','主学习词库',libraryCount('master')],
      ['pending-primary','主词库·待学习',libraryCount('pending-primary')],
      ['pending-secondary','第二词库·待学习',libraryCount('pending-secondary')],
      ['daily','每日学习词汇',libraryCount('daily')],['unknown','陌生词汇',libraryCount('unknown')],
      ...['A1','A2','B1','B2'].map(lv=>['bipa-'+lv.toLowerCase(),'BIPA（'+lv+'）',libraryCount('bipa-'+lv.toLowerCase())])
    ];
    // Keep the native select and existing option nodes stable while its menu is open.
    const wanted=new Set(opts.map(x=>x[0]));
    const existing=new Map([...select.options].map(o=>[o.value,o]));
    opts.forEach(([k,l,n],i)=>{
      let option=existing.get(k);
      if(!option){option=document.createElement('option');option.value=k;select.add(option)}
      // Move only out-of-place native nodes; do not recreate the open selector.
      if(select.options[i]!==option)select.add(option,select.options[i]||null);
      const label=l+'（'+n+'）';
      if(option.textContent!==label)option.textContent=label;
    });
    [...select.options].forEach(option=>{if(!wanted.has(option.value))option.remove()});
    const next=opts.some(x=>x[0]===cur)?cur:'master';
    if(select.value!==next)select.value=next;
  }
  function ensureLibrarySelect(){const tb=document.querySelector('#vocab .toolbar');if(!tb)return null;let s=$('librarySelect');if(!s){s=document.createElement('select');s.id='librarySelect';tb.insertBefore(s,tb.firstChild)}return s}
  function syncUiMode(){const sec=$('vocab');if(sec){sec.classList.toggle('bipaFinalV7',isBipaKey());sec.classList.remove('bipaStable','bipaSwitching')}ensureGradeSelect()}
  function computeStats(src=sourceFor(),mem=memoryFor()){
    let known=0,review=0;src.forEach(x=>{const s=statusFromMemory(x.word,activeKey,mem);if(s==='know')known++;else if(s==='fuzzy'||s==='dont')review++});
    return {total:src.length,known,review,unchecked:Math.max(0,src.length-known-review)};
  }
  function updateStats(src=sourceFor(),mem=memoryFor()){
    const s=computeStats(src,mem);
    if($('vocabCount'))$('vocabCount').textContent=s.total;if($('knownCount'))$('knownCount').textContent=s.known;if($('reviewCount'))$('reviewCount').textContent=s.review;
    let suffix='';if(activeView==='known')suffix=' · 查看已掌握';else if(activeView==='review')suffix=' · 查看待掌握';
    if($('dbStatus'))$('dbStatus').textContent=isPendingKey()?labelFor()+' · '+s.total+' 个合法待学词 · 会了即可移出（同步后下次课程排除）':labelFor()+' · '+s.unchecked+' 未判断 · '+s.review+' 待掌握 · '+s.known+' 已掌握 · '+s.total+' 总词'+suffix;
    if($('vocabTag'))$('vocabTag').textContent=labelFor()+' '+s.total+' 词';return s;
  }
  function currentFilterPredicate(x,mem=memoryFor()){
    if(!x||!x.word)return false;if((x.categories||[]).includes('粗口/俚语'))return false;
    const st=statusFromMemory(x.word,activeKey,mem);
    if(activeView==='known'){if(st!=='know')return false}else if(activeView==='review'){if(st!=='fuzzy'&&st!=='dont')return false}else if(st&&!isPendingKey())return false;
    const q=String($('search')?.value||'').trim().toLowerCase(),cat=String($('cat')?.value||''),sab=isBipaKey()?String($('sabFilterStable')?.value||''):'';
    if(cat){if(isBipaKey()){if(String(x.theme||'')!==cat)return false}else if(!(x.categories||[]).includes(cat))return false}
    if(sab&&String(x.sab||'').toUpperCase()!==sab)return false;
    if(q&&!([x.word,x.cn,x.en,x.root,x.theme,x.example,x.example_cn,x.scene,x.scene_cn,x.note].join(' ').toLowerCase().includes(q)))return false;return true;
  }
  function renderPendingUndo(){
    let bar=$('pendingUndoBar');
    if(!isPendingKey()||!pendingUndo){if(bar)bar.remove();return}
    if(!bar){bar=document.createElement('div');bar.id='pendingUndoBar';const box=$('vocabBox');if(box)box.insertAdjacentElement('afterend',bar)}
    if(!bar)return;
    bar.style.cssText='margin:12px 0;padding:11px 14px;border:1px solid #dce3ef;border-radius:12px;background:#f8faff;font-size:13px;display:flex;justify-content:space-between;align-items:center;gap:12px';
    bar.textContent='已将 '+pendingUndo.word+' 标为会了（尚需云端同步）';
    const undo=document.createElement('button');undo.type='button';undo.textContent='撤销';undo.style.cssText='padding:7px 12px;border:1px solid #dce3ef;border-radius:8px;background:white;cursor:pointer';
    undo.onclick=()=>{
      const u=pendingUndo;if(!u)return;pendingUndo=null;
      const m=memoryFor(u.library),k=norm(u.word);
      if(u.oldWord===undefined)delete m[u.word];else m[u.word]=u.oldWord;
      if(u.oldNorm===undefined)delete m[k];else m[k]=u.oldNorm;
      persistMemory(u.library,m);
      const p=window.WeaknessPool;
      if(p){
        if(u.oldRecord&&typeof p.importRecord==='function')p.importRecord(Object.assign({},u.oldRecord,{word:u.word,status:'active'}));
        else if(typeof p.markWeak==='function')p.markWeak(u.word,u.item,u.item.memory_class==='dont'?'memory_dont':'memory_fuzzy');
      }
      populateLibraryOptions();rebuild(false);
    };
    bar.appendChild(undo);
  }
  function renderCurrent(){
    if(window.__VOCAB_UNIFIED_RENDERER_20260917__&&typeof window.renderVocab==='function')window.renderVocab();
    renderPendingUndo();
  }
  function rebuild(reset=false){
    const src=sourceFor(),mem=memoryFor();try{DB=src.slice()}catch(e){}
    const out=src.filter(x=>currentFilterPredicate(x,mem));
    try{FILTER=out;if(reset)idx=0;else if(out.length)idx=Math.min(Math.max(0,Number(idx||0)),out.length-1);else idx=0}catch(e){}
    updateStats(src,mem);renderCurrent();return out;
  }
  function setView(mode=''){
    activeView=mode==='known'||mode==='review'?mode:'';if(activeView)localStorage.setItem('vocab_view_mode',activeView);else localStorage.removeItem('vocab_view_mode');
    if($('search'))$('search').value='';if($('cat'))$('cat').value='';if($('sabFilterStable'))$('sabFilterStable').value='';rebuild(true);
  }
  async function setLibrary(key,opts={}){
    key=canonicalKey(key);const mySeq=++switchSeq,lv=bipaLevelForKey(key);
    if(isPendingKey(key)){
      if($('dbStatus'))$('dbStatus').textContent=labelFor(key)+' · 正在更新完整待学习清单…';
      try{await ensurePendingData(true)}catch(e){
        if(mySeq!==switchSeq)return [];
        const s=$('librarySelect');if(s)s.value=activeKey;
        if($('dbStatus'))$('dbStatus').textContent=labelFor(key)+' · 读取失败：'+pendingError+'（请重试）';
        return [];
      }
      if(mySeq!==switchSeq)return [];
      populateLibraryOptions();
    }
    if(lv&&!bipaReady(lv)){
      if($('dbStatus'))$('dbStatus').textContent=labelFor(key)+' · 正在加载…';
      try{await ensureBipaData(lv)}
      catch(e){
        if(mySeq!==switchSeq)return [];
        const select=$('librarySelect');if(select)select.value=activeKey;
        if($('dbStatus'))$('dbStatus').textContent=labelFor(key)+' · 加载失败：'+(e&&e.message?e.message:'请重试');
        return [];
      }
      if(mySeq!==switchSeq)return [];
    }
    saveProgress();activeKey=key;if(!isPendingKey(key))pendingUndo=null;activeView='';localStorage.removeItem('vocab_view_mode');
    const select=$('librarySelect');if(select&&select.value!==key)select.value=key;localStorage.setItem('selected_vocab_library',key);
    if($('search'))$('search').value='';syncUiMode();rebuildCategories();if($('cat'))$('cat').value='';if($('sabFilterStable'))$('sabFilterStable').value='';
    const src=sourceFor(),mem=memoryFor();try{DB=src.slice()}catch(e){}
    const out=src.filter(x=>(isPendingKey(key)||!statusFromMemory(x.word,activeKey,mem))&&!(x.categories||[]).includes('粗口/俚语'));
    try{FILTER=out;idx=opts.restore===false?0:restoreIndex(out)}catch(e){}
    updateStats(src,mem);renderCurrent();window.dispatchEvent(new CustomEvent('vocab-library-ready',{detail:{key,total:src.length}}));return out;
  }
  function move(delta){const a=Array.isArray(FILTER)?FILTER:[];if(!a.length)return;try{idx=(Number(idx||0)+delta+a.length)%a.length}catch(e){}saveProgress();renderCurrent()}
  function syncWeakness(item,v){
    if(isBipaKey()||!item||!item.word)return;const p=window.WeaknessPool;if(!p)return;
    if(v==='know'){const reason=isPendingKey()?'manual_preknown':'vocab_known';if(typeof p.markMastered==='function')p.markMastered(item.word,reason);else if(typeof p.markKnown==='function')p.markKnown(item.word,reason)}
    else if(v==='fuzzy'&&typeof p.markWeak==='function')p.markWeak(item.word,item,'memory_fuzzy');else if(v==='dont'&&typeof p.markWeak==='function')p.markWeak(item.word,item,'memory_dont');
  }
  function mark(v){
    if(!['know','fuzzy','dont'].includes(v))return;const x=currentItem();if(!x||!x.word)return;
    const m=memoryFor(),k=norm(x.word),lv=bipaLevelForKey(),pending=isPendingKey();
    if(pending&&v==='know'){
      const old=window.WeaknessPool?.get?.(x.word)||null;
      pendingUndo={word:x.word,item:x,library:activeKey,oldWord:m[x.word],oldNorm:m[k],oldRecord:old?JSON.parse(JSON.stringify(old)):null};
    }
    if(lv)m[k]=v;else{m[x.word]=v;m[k]=v}
    persistMemory(activeKey,m);syncWeakness(x,v);
    if(lv)window.dispatchEvent(new CustomEvent('bipa-memory-changed',{detail:{level:lv,word:x.word,status:v}}));
    if(pending)populateLibraryOptions();
    rebuild(false);
  }
  function emptyMessage(){
    const q=String($('search')?.value||'').trim(),cat=String($('cat')?.value||''),sab=String($('sabFilterStable')?.value||'');
    if(q||cat||sab)return '没有匹配词汇';if(activeView==='known')return '当前词库还没有标记“会了”的词。';if(activeView==='review')return '当前词库没有“模糊 / 不会”的词。';if(isPendingKey())return '此词库待学词已经清零 ✓';return '当前词库没有未判断词 ✓';
  }
  function speak(text){
    text=String(text||'').trim();if(!text)return;try{if(activeAudio){activeAudio.pause();activeAudio=null}}catch(e){}try{if(window.speechSynthesis)window.speechSynthesis.cancel()}catch(e){}
    try{if(window.speechSynthesis&&typeof SpeechSynthesisUtterance!=='undefined'){const u=new SpeechSynthesisUtterance(text);u.lang='id-ID';u.rate=.88;const vs=window.speechSynthesis.getVoices?window.speechSynthesis.getVoices():[];const v=vs.find(v=>/^id(?:-|_)/i.test(v.lang||''))||vs.find(v=>/indones/i.test((v.name||'')+' '+(v.lang||'')));if(v)u.voice=v;window.speechSynthesis.speak(u);return}}catch(e){}
    try{activeAudio=new Audio('https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=id&q='+encodeURIComponent(text));activeAudio.play().catch(()=>{})}catch(e){}
  }
  async function translateZh(word){const w=String(word||'').trim();if(!w)return '';try{const r=await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=id&tl=zh-CN&dt=t&q='+encodeURIComponent(w),{cache:'no-store'});if(!r.ok)return '';const data=await r.json();return Array.isArray(data?.[0])?data[0].map(x=>Array.isArray(x)?x[0]:'').join('').trim():''}catch(e){return ''}}
  async function fillMissingUnknownMeanings(){
    const map=localUnknownMap();let changed=false;
    for(const [key,item] of Object.entries(map)){if(!item||!item.word||!missingMeaning(item.cn))continue;const shared=sharedUnknownWords().find(x=>norm(x.word)===norm(item.word));if(shared&&!missingMeaning(shared.cn)){item.cn=shared.cn;map[key]=item;changed=true;continue}const k=norm(item.word);if(meaningAttempts.has(k))continue;meaningAttempts.add(k);const zh=await translateZh(item.word);if(zh){item.cn=zh;map[key]=item;changed=true}}
    if(changed){localStorage.setItem('indo_unknown_words',JSON.stringify(map));populateLibraryOptions();if(activeKey==='unknown')setLibrary('unknown')}
  }
  function bindControls(){
    const select=ensureLibrarySelect();if(select)select.onchange=function(){void setLibrary(this.value)};
    const search=$('search');if(search)search.oninput=()=>rebuild(true);const cat=$('cat');if(cat)cat.onchange=()=>rebuild(true);const mode=$('mode');if(mode)mode.onchange=()=>renderCurrent();
    const known=$('knownCount')?.closest('button');if(known)known.onclick=e=>{e&&e.preventDefault();setView('known')};const review=$('reviewCount')?.closest('button');if(review)review.onclick=e=>{e&&e.preventDefault();setView('review')};ensureGradeSelect();
  }
  function installOwnership(){
    window.loadDB=()=>setLibrary(activeKey,{restore:true});try{loadDB=window.loadDB}catch(e){}
    window.applyFilter=()=>rebuild(true);try{applyFilter=window.applyFilter}catch(e){}
    window.showKnownWords=()=>setView('known');try{showKnownWords=window.showKnownWords}catch(e){}
    window.showReviewWords=()=>setView('review');window.mark=mark;try{mark=window.mark}catch(e){}
    window.nextWord=()=>move(1);try{nextWord=window.nextWord}catch(e){}
    window.switchVocabLibrary=setLibrary;window.openMasterVocabulary=()=>setLibrary('master');window.refreshMasterVocabulary=()=>setLibrary('master');
    window.getUnfamiliarVocabulary=unknownWords;window.refreshUnknownLibrary=()=>{sourceCache.delete('unknown');populateLibraryOptions();if(activeKey==='unknown')setLibrary('unknown')};
    window.speak=speak;try{speak=window.speak}catch(e){}
  }
  function prepareHiddenLibrary(stored){
    activeKey=stored;const select=$('librarySelect');if(select)select.value=stored;syncUiMode();
    const count=libraryCount(stored);if($('vocabTag'))$('vocabTag').textContent=labelFor(stored)+' '+count+' 词';if($('vocabCount'))$('vocabCount').textContent=count;
    const sec=$('vocab');if(!sec)return;
    const open=()=>{if(!sec.classList.contains('active'))return;vocabOpenObserver&&vocabOpenObserver.disconnect();vocabOpenObserver=null;void setLibrary(stored,{restore:true})};
    if(sec.classList.contains('active'))open();else{vocabOpenObserver=new MutationObserver(open);vocabOpenObserver.observe(sec,{attributes:true,attributeFilter:['class']})}
  }
  function init(){
    if(initPromise)return initPromise;
    initPromise=(async function(){
      if(installed)return true;ensureLibrarySelect();await ensureMasterData();
      try{await ensurePendingData()}catch(e){console.warn('[pending vocab]',e)}
      populateLibraryOptions();bindControls();installOwnership();
      const stored=canonicalKey(localStorage.getItem('selected_vocab_library')||$('librarySelect')?.value||'master');prepareHiddenLibrary(stored);
      window.addEventListener('unknown-vocab-changed',()=>{sourceCache.delete('unknown');populateLibraryOptions();if(activeKey==='unknown'&&$('librarySelect')?.value==='unknown'&&$('vocab')?.classList.contains('active'))void setLibrary('unknown')});
      window.addEventListener('master-core-locked',()=>{sourceCache.delete('master');populateLibraryOptions();if(activeKey==='master'&&$('librarySelect')?.value==='master'&&$('vocab')?.classList.contains('active'))void setLibrary('master')});
      // Batched, local-only refresh: no polling or whole-page MutationObserver.
      window.addEventListener('weak-pool-changed',()=>{
        if(!pendingCatalog||pendingRefreshQueued)return;
        pendingRefreshQueued=true;
        queueMicrotask(()=>{
          pendingRefreshQueued=false;populateLibraryOptions();
          if(isPendingKey(activeKey)&&$('vocab')?.classList.contains('active'))rebuild(false);
        });
      });
      document.addEventListener('visibilitychange',()=>{
        if(document.hidden||!isPendingKey(activeKey)||!$('vocab')?.classList.contains('active'))return;
        ensurePendingData(true).then(()=>{
          populateLibraryOptions();rebuild(false);
        }).catch(e=>{if($('dbStatus'))$('dbStatus').textContent='待学习清单刷新失败：'+(e&&e.message||'网络错误')});
      });
      window.addEventListener('beforeunload',saveProgress);dataReady=true;installed=true;window.dispatchEvent(new CustomEvent('vocab-controller-ready',{detail:{key:activeKey}}));return true;
    })().catch(e=>{initPromise=null;installed=false;dataReady=false;throw e});return initPromise;
  }

  window.VocabController={
    init,rebuild,setLibrary,setView,mark,move,sourceFor,statusOf,currentItem,updateStats,emptyMessage,speak,activeKey:()=>activeKey,activeView:()=>activeView,isBipa:()=>isBipaKey(),bipaLevel:()=>bipaLevelForKey(),refresh:function(reset=false){bindControls();installOwnership();syncUiMode();rebuildCategories();return rebuild(reset)},dataReady:()=>dataReady
  };
  if(document.readyState==='complete')setTimeout(init,0);else window.addEventListener('load',()=>setTimeout(init,0),{once:true});
})();