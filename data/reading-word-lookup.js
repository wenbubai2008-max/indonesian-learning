(function(){
  if(window.__readingWordLookupLoaded)return;
  window.__readingWordLookupLoaded=true;

  let popup=null,popupSeq=0,lastSelection='',lastSelectionAt=0;
  const TRANS_CACHE_KEY='indo_translate_cache_v2';
  const WEAK_QUEUE_KEY='indo_weak_example_translate_queue_v1';
  const WEAK_SEED_KEY='indo_weak_example_translate_seed_v2';
  const MAX_TRANSLATE_CONCURRENCY=2;
  const translateCache=new Map();
  const translatePending=new Map();
  const translateQueue=[];
  let activeTranslations=0,weakWorkerBusy=false,weakWorkerTimer=null;

  function ensureStyle(){
    if(document.getElementById('readingWordLookupStyle'))return;
    const st=document.createElement('style');
    st.id='readingWordLookupStyle';
    st.textContent=`
      .rw-popup{position:fixed;z-index:99999;min-width:180px;max-width:320px;background:#172033;color:#fff;border-radius:12px;padding:10px 13px;box-shadow:0 8px 28px rgba(0,0,0,.22);font-size:14px;line-height:1.45}
      .rw-word{font-weight:850;font-size:15px;margin-bottom:3px}.rw-cn{color:#f4f6fb}.rw-empty{color:#cbd2df}
      .rw-actions{display:flex;gap:7px;margin-top:9px}.rw-add{border:0;border-radius:8px;padding:6px 9px;background:#eef3ff;color:#3157d5;font-weight:800;cursor:pointer;font-size:12px}.rw-add.added{background:#e8f7ed;color:#18733a}.rw-add:disabled{opacity:.65;cursor:default}
      .rw-popup:after{content:"";position:absolute;left:18px;bottom:-6px;border-width:6px 6px 0;border-style:solid;border-color:#172033 transparent transparent}
      #weaknessBody .v2-excn,#weaknessBody .weak-card .v2-excn{color:#826a57;line-height:1.55;margin:3px 0 9px}
    `;
    document.head.appendChild(st);
  }

  function hide(){popupSeq++;if(popup){popup.remove();popup=null;}}
  function norm(s){return String(s||'').trim().toLowerCase().replace(/^[^a-zA-ZÀ-ÿ]+|[^a-zA-ZÀ-ÿ-]+$/g,'');}
  function plainNorm(s){const w=norm(s);if(!w)return '';try{return w.normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(e){return w;}}
  function parseStore(key){try{return JSON.parse(localStorage.getItem(key)||'{}')||{};}catch(e){return {};}}
  function saveStore(key,val){try{localStorage.setItem(key,JSON.stringify(val));}catch(e){}}
  function weakPool(){return window.WeaknessPool||null;}
  function allWords(){
    return [].concat(
      Array.isArray(window.DAILY_VOCAB_DB)?window.DAILY_VOCAB_DB:[],
      Array.isArray(window.UNFAMILIAR_VOCAB_DB)?window.UNFAMILIAR_VOCAB_DB:[],
      Array.isArray(window.MASTER_VOCAB_OBJECTS)?window.MASTER_VOCAB_OBJECTS:[],
      Array.isArray(window.EMBEDDED_DB)?window.EMBEDDED_DB:[]
    );
  }

  function persistentCached(text){
    const k=String(text||'').trim();if(!k)return '';
    const x=parseStore(TRANS_CACHE_KEY)[k];
    return x&&typeof x==='object'?String(x.zh||''):String(x||'');
  }
  function rememberTranslation(text,zh){
    const k=String(text||'').trim(),v=String(zh||'').trim();if(!k||!v)return;
    translateCache.set(k,v);
    const m=parseStore(TRANS_CACHE_KEY);m[k]={zh:v,at:Date.now()};
    const keys=Object.keys(m);
    if(keys.length>400){keys.sort((a,b)=>Number((m[a]||{}).at||0)-Number((m[b]||{}).at||0)).slice(0,keys.length-400).forEach(x=>delete m[x]);}
    saveStore(TRANS_CACHE_KEY,m);
  }

  function enqueueTranslation(run){return new Promise(resolve=>{translateQueue.push({run,resolve});drainTranslations();});}
  function drainTranslations(){
    while(activeTranslations<MAX_TRANSLATE_CONCURRENCY&&translateQueue.length){
      const job=translateQueue.shift();activeTranslations++;
      Promise.resolve().then(job.run).then(job.resolve,()=>job.resolve('')).finally(()=>{activeTranslations--;drainTranslations();});
    }
  }
  async function translateZh(text){
    const w=String(text||'').trim();if(!w)return '';
    if(translateCache.has(w))return translateCache.get(w);
    const saved=persistentCached(w);if(saved){translateCache.set(w,saved);return saved;}
    if(translatePending.has(w))return translatePending.get(w);
    const task=enqueueTranslation(async function(){
      const controller=typeof AbortController!=='undefined'?new AbortController():null;
      const timer=controller?setTimeout(()=>{try{controller.abort();}catch(e){}},4500):null;
      try{
        const url='https://translate.googleapis.com/translate_a/single?client=gtx&sl=id&tl=zh-CN&dt=t&q='+encodeURIComponent(w);
        const opt={method:'GET',mode:'cors',cache:'no-store'};if(controller)opt.signal=controller.signal;
        const r=await fetch(url,opt);if(!r.ok)throw new Error('HTTP '+r.status);
        const data=await r.json();
        const zh=Array.isArray(data&&data[0])?data[0].map(x=>Array.isArray(x)?x[0]:'').join('').trim():'';
        if(zh)rememberTranslation(w,zh);
        return zh;
      }catch(e){return '';}
      finally{if(timer)clearTimeout(timer);}
    });
    translatePending.set(w,task);task.finally(()=>translatePending.delete(w));return task;
  }

  const WEAK_EXAMPLE_CN_OVERRIDES={
    'Buatku, kalau rencana tiba-tiba berubah, yang penting bukan panik, tapi cepat tentuin mana yang memang harus diberesin dulu.':'对我来说，计划突然改变时，重点不是慌，而是赶紧判断什么事情确实必须先处理完。',
    'Aku sebenarnya nggak enakan buat nagih, bahkan kadang nggak tega kalau orangnya lagi susah.':'其实我不太好意思去催别人，有时候对方正处在困难中，我甚至会觉得不忍心。',
    'Dampak abu vulkanik Gunung Anak Krakatau masih memengaruhi perjalanan udara di sekitar Jakarta.':'阿纳克喀拉喀托火山的火山灰影响仍在影响雅加达周边的航空出行。',
    'Walaupun pagi ini padat, aku tetap nyempetin follow up vendor yang prosesnya masih nyangkut.':'虽然今天早上很忙，我还是挤出时间跟进了流程还卡着的供应商。'
  };
  function sentenceKey(s){return String(s||'').replace(/\s+/g,' ').trim();}
  function overrideExampleCn(text){return WEAK_EXAMPLE_CN_OVERRIDES[sentenceKey(text)]||'';}
  function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}

  function weakQueue(){return parseStore(WEAK_QUEUE_KEY);}
  function saveWeakQueue(q){saveStore(WEAK_QUEUE_KEY,q);}
  function queueKey(word,example){return norm(word)+'|'+hash(sentenceKey(example));}
  function scheduleWeakWorker(delay){clearTimeout(weakWorkerTimer);weakWorkerTimer=setTimeout(drainWeakQueue,delay==null?300:delay);}
  function enrichWeakExample(word,example,cn){
    const p=weakPool();if(!p||typeof p.enrich!=='function'||!word||!cn)return false;
    if(!p.get(word))return false;
    p.enrich(word,{example:example,example_cn:cn});return true;
  }
  function enqueueWeakExampleTranslation(word,item){
    const x=item||{},example=sentenceKey(x.example||((x.contexts||[]).slice(-1)[0])||''),w=String(word||x.word||'').trim();
    if(!w||!example||String(x.example_cn||'').trim())return false;
    const fixed=overrideExampleCn(example)||persistentCached(example);
    if(fixed){enrichWeakExample(w,example,fixed);return true;}
    const q=weakQueue(),k=queueKey(w,example),old=q[k]||{};
    q[k]={word:w,example:example,tries:Number(old.tries||0),next_at:Number(old.next_at||0),created_at:Number(old.created_at||Date.now())};
    saveWeakQueue(q);scheduleWeakWorker(250);return true;
  }
  window.enqueueWeakExampleTranslation=enqueueWeakExampleTranslation;

  async function drainWeakQueue(){
    if(weakWorkerBusy||!navigator.onLine)return;
    if(document.getElementById('weakness')?.classList.contains('active')){scheduleWeakWorker(2200);return;}
    const q=weakQueue(),now=Date.now(),keys=Object.keys(q);
    const due=keys.filter(k=>Number((q[k]||{}).next_at||0)<=now).sort((a,b)=>Number((q[a]||{}).created_at||0)-Number((q[b]||{}).created_at||0));
    if(!due.length){
      const future=keys.map(k=>Number((q[k]||{}).next_at||0)).filter(t=>t>now).sort((a,b)=>a-b)[0];
      if(future)scheduleWeakWorker(Math.min(60000,Math.max(1000,future-now)));
      return;
    }
    const k=due[0],task=q[k];if(!task){delete q[k];saveWeakQueue(q);return;}
    weakWorkerBusy=true;
    try{
      const p=weakPool(),rec=p&&typeof p.get==='function'?p.get(task.word):null;
      if(rec&&String(rec.example_cn||'').trim()){delete q[k];saveWeakQueue(q);return;}
      const zh=overrideExampleCn(task.example)||persistentCached(task.example)||await translateZh(task.example);
      const fresh=weakQueue();
      if(zh){enrichWeakExample(task.word,task.example,zh);delete fresh[k];saveWeakQueue(fresh);}
      else{
        const cur=fresh[k]||task,tries=Number(cur.tries||0)+1;
        cur.tries=tries;cur.next_at=Date.now()+Math.min(21600000,300000*Math.pow(2,Math.min(tries-1,6)));fresh[k]=cur;saveWeakQueue(fresh);
      }
    }finally{weakWorkerBusy=false;scheduleWeakWorker(400);}
  }

  function seedOldMissingOnce(){
    if(localStorage.getItem(WEAK_SEED_KEY)==='1')return;
    const p=weakPool();if(!p||typeof p.listActive!=='function'){setTimeout(seedOldMissingOnce,300);return;}
    try{
      p.listActive().forEach(function(x){
        const r=x&&x.reasons||[];
        if(!x||(!r.includes('quick_wrong')&&!r.includes('manual_unknown')))return;
        if(x.example&&!x.example_cn)enqueueWeakExampleTranslation(x.word,x);
      });
      localStorage.setItem(WEAK_SEED_KEY,'1');
    }catch(e){}
  }

  function hintLookup(node,raw){
    const hint=node&&node.closest?node.closest('.erHint'):null;if(!hint)return null;
    const shown=String(hint.querySelector('.erHintWord')&&hint.querySelector('.erHintWord').textContent||'').trim();
    if(norm(shown)!==norm(raw))return null;
    const cn=String(hint.querySelector('.erTip b')&&hint.querySelector('.erTip b').textContent||'').trim();if(!cn)return null;
    let root='',formation='';
    Array.from(hint.querySelectorAll('.erTip span')).forEach(function(s){const t=String(s.textContent||'').trim();if(/^词根[：:]/.test(t))root=t.replace(/^词根[：:]\s*/,'');else if(!formation)formation=t;});
    return {word:String(raw).trim(),base:norm(raw),cn:cn,en:'',root:root,root_cn:'',formation:formation,example:'',example_cn:''};
  }
  function hitFromRecord(raw,hit,base){return {word:String(raw).trim(),base:hit.word||base||norm(raw),cn:String(hit.cn||hit.zh||'').trim(),en:String(hit.en||'').trim(),root:String(hit.root||'').trim(),root_cn:String(hit.root_cn||'').trim(),example:String(hit.example||'').trim(),example_cn:String(hit.example_cn||'').trim()};}
  function lookup(raw,node){
    const fromHint=hintLookup(node,raw);if(fromHint)return fromHint;
    const w=norm(raw),plain=plainNorm(raw);if(!w)return null;
    const p=weakPool(),pooled=p&&typeof p.get==='function'?(p.get(w)||(plain!==w?p.get(plain):null)):null;if(pooled&&pooled.cn)return hitFromRecord(raw,pooled,plain||w);
    const variants=[];[w,plain].forEach(function(v){if(v&&!variants.includes(v))variants.push(v);});
    variants.slice().forEach(function(v){if(/-(ku|mu|nya)$/.test(v)){const x=v.replace(/-(ku|mu|nya)$/,'');if(x&&!variants.includes(x))variants.push(x);}if(/(ku|mu|nya)$/.test(v)&&v.length>5){const x=v.replace(/(ku|mu|nya)$/,'');if(x&&!variants.includes(x))variants.push(x);}});
    const words=allWords();
    for(const v of variants){const hit=words.find(x=>x&&(plainNorm(x.word)===v||plainNorm(x.display)===v||plainNorm(x.audio_text)===v));if(hit)return hitFromRecord(raw,hit,v);}
    const base=plain||w;return {word:String(raw).trim(),base:base,cn:persistentCached(base)||persistentCached(w),en:'',root:'',root_cn:'',example:'',example_cn:''};
  }

  function escapeHtml(s){return String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function sentenceFrom(node,raw){
    const box=node.closest('.rl-text,.dailyFixReading,#daily .reading');const text=(box&&(box.innerText||box.textContent)||'').replace(/\s+/g,' ').trim();if(!text)return '';
    const p=text.toLowerCase().indexOf(String(raw).toLowerCase());if(p<0)return text.slice(0,220);
    let a=Math.max(0,p-120),b=Math.min(text.length,p+String(raw).length+120);
    const left=text.slice(0,p).search(/[.!?。！？][^.!?。！？]*$/);if(left>=0)a=left+1;
    const rest=text.slice(p+String(raw).length),m=rest.match(/[.!?。！？]/);if(m)b=p+String(raw).length+m.index+1;
    return text.slice(a,b).trim();
  }
  function sourceInfo(node){
    const daily=node.closest('#daily');
    if(daily){const date=(document.getElementById('dailyMeta')&&document.getElementById('dailyMeta').textContent||'').trim();const nav=daily.querySelector('.dailyFixMid span');const title=document.getElementById('dailyTitle');const label=String((nav&&nav.textContent)||(title&&title.textContent)||'');const session=/19:00|晚间/.test(label)?'19:00':(/08:00|早间/.test(label)?'08:00':'');return {date:date,session:session,source:'每日学习阅读'};}
    const readingPage=node.closest('#readingPage');if(readingPage){const meta=String(document.getElementById('readingMeta')&&document.getElementById('readingMeta').textContent||'');const dm=meta.match(/\b(20\d{2}-\d{2}-\d{2})\b/),tm=meta.match(/\b(08:00|19:00)\b/);return {date:dm?dm[1]:'',session:tm?tm[1]:'',source:'每日阅读库'};}
    const extensive=node.closest('#extensive');if(extensive)return {date:(document.getElementById('extensiveMeta')&&document.getElementById('extensiveMeta').textContent||'').split('·')[0].trim(),session:'',source:'泛读'};
    return {date:'',session:'',source:'阅读短文'};
  }
  function unknownMap(){return parseStore('indo_unknown_words');}
  function isUnknown(word){
    const p=weakPool();
    if(p){
      const x=typeof p.get==='function'?p.get(word):null;if(!x||x.status!=='active')return false;
      const r=x.reasons||[],h=x.reason_history||[];
      if(r.includes('manual_unknown')||r.includes('quick_wrong'))return true;
      return r.includes('manual_restore')&&(h.includes('manual_unknown')||h.includes('quick_wrong'));
    }
    return !!unknownMap()[norm(word)];
  }
  function backfillExisting(hit){
    const key=norm(hit.base||hit.word);if(!key||!hit.cn)return;
    const p=weakPool();if(p&&p.get(key))p.enrich(key,{cn:hit.cn,en:hit.en,root:hit.root,root_cn:hit.root_cn,example:hit.example,example_cn:hit.example_cn});
    const m=unknownMap();if(m[key]&&(!m[key].cn||m[key].cn==='暂无释义'||m[key].cn==='暂未查到释义')){m[key].cn=hit.cn;m[key].last_seen=new Date().toISOString();saveStore('indo_unknown_words',m);window.dispatchEvent(new CustomEvent('unknown-vocab-changed'));}
  }
  async function ensureMeaning(hit,cnEl,seq){
    if(hit.cn){backfillExisting(hit);return hit.cn;}
    if(cnEl&&seq===popupSeq){cnEl.textContent='查询中文释义…';cnEl.className='rw-empty';}
    const zh=await translateZh(hit.base||hit.word);
    if(zh){hit.cn=zh;backfillExisting(hit);if(cnEl&&seq===popupSeq&&cnEl.isConnected){cnEl.textContent=zh;cnEl.className='rw-cn';}}
    else if(cnEl&&seq===popupSeq&&cnEl.isConnected){cnEl.textContent='暂未查到释义';cnEl.className='rw-empty';}
    return hit.cn||'';
  }

  function saveUnknown(hit,node){
    const key=norm(hit.base||hit.word);if(!key)return;
    const now=new Date().toISOString(),src=sourceInfo(node),context=sentenceFrom(node,hit.word);
    const cachedContext=context?(overrideExampleCn(context)||persistentCached(context)):'';
    const item={word:hit.base||key,display:hit.word,cn:hit.cn||'暂未查到释义',en:hit.en||'',root:hit.root||'',root_cn:hit.root_cn||'',example:context||hit.example||'',example_cn:cachedContext||(!context?hit.example_cn:'')||'',first_seen:now,last_seen:now,times_seen:1,source:src.source,source_date:src.date,session:src.session,contexts:context?[context]:[]};
    const p=weakPool();if(p){p.markUnknown(item);return;}
    const m=unknownMap();
    if(m[key]){m[key].last_seen=now;m[key].times_seen=(m[key].times_seen||1)+1;if(hit.cn&&(!m[key].cn||m[key].cn==='暂无释义'||m[key].cn==='暂未查到释义'))m[key].cn=hit.cn;if(context&&!(m[key].contexts||[]).includes(context))m[key].contexts=(m[key].contexts||[]).concat(context).slice(-5);if(item.example&&!m[key].example)m[key].example=item.example;if(item.example_cn&&!m[key].example_cn)m[key].example_cn=item.example_cn;}else m[key]=item;
    saveStore('indo_unknown_words',m);window.dispatchEvent(new CustomEvent('unknown-vocab-changed'));enqueueWeakExampleTranslation(item.word,item);
  }

  function show(raw,rect,node){
    const hit=lookup(raw,node);if(!hit)return;hide();ensureStyle();
    const seq=popupSeq,added=isUnknown(hit.base||hit.word);popup=document.createElement('div');popup.className='rw-popup';
    popup.innerHTML='<div class="rw-word">'+escapeHtml(hit.word)+'</div><div class="'+(hit.cn?'rw-cn':'rw-empty')+'">'+escapeHtml(hit.cn||'查询中文释义…')+'</div><div class="rw-actions"><button class="rw-add '+(added?'added':'')+'" type="button">'+(added?'✓ 已在弱项':'＋ 加入陌生词')+'</button></div>';
    const currentPopup=popup,cnEl=popup.children[1],btn=popup.querySelector('.rw-add');
    btn.addEventListener('mousedown',e=>e.stopPropagation());
    btn.addEventListener('click',e=>{e.stopPropagation();if(isUnknown(hit.base||hit.word))return;saveUnknown(hit,node);btn.textContent='✓ 已在弱项';btn.classList.add('added');btn.disabled=true;if(!hit.cn)ensureMeaning(hit,cnEl,seq);});
    document.body.appendChild(popup);if(!hit.cn)ensureMeaning(hit,cnEl,seq);else backfillExisting(hit);
    const pw=popup.offsetWidth,ph=popup.offsetHeight;let left=Math.max(8,Math.min(window.innerWidth-pw-8,rect.left)),top=rect.top-ph-10;if(top<8)top=Math.min(window.innerHeight-ph-8,rect.bottom+10);popup.style.left=left+'px';popup.style.top=top+'px';
  }

  function handleSelection(){
    const sel=window.getSelection&&window.getSelection();if(!sel||sel.rangeCount===0||sel.isCollapsed)return;
    const txt=sel.toString().trim();if(!txt||txt.length>40||/\s/.test(txt))return;
    const range=sel.getRangeAt(0),node=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer.parentElement;
    if(!node||!node.closest||!node.closest('.rl-text,.dailyFixReading,#daily .reading'))return;
    const rect=range.getBoundingClientRect();if(!rect||(!rect.width&&!rect.height))return;
    const sig=norm(txt)+'|'+Math.round(rect.left)+'|'+Math.round(rect.top),now=Date.now();if(sig===lastSelection&&now-lastSelectionAt<350)return;lastSelection=sig;lastSelectionAt=now;show(txt,rect,node);
  }

  if(window.PointerEvent)document.addEventListener('pointerup',()=>setTimeout(handleSelection,20));
  else{document.addEventListener('mouseup',()=>setTimeout(handleSelection,0));document.addEventListener('touchend',()=>setTimeout(handleSelection,80));}
  document.addEventListener('mousedown',e=>{if(!e.target.closest('.rw-popup'))hide();});document.addEventListener('scroll',hide,true);
  window.addEventListener('online',()=>scheduleWeakWorker(500));
  function boot(){ensureStyle();seedOldMissingOnce();scheduleWeakWorker(800);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();