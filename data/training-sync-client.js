// 2026-10-14: cross-device sync for the three training schedules (quick practice, listening, automatic training).
// Uses the same Worker address and key as the weakness sync ("弱项强化 → 学习状态同步"). The Worker must have the
// /training endpoint (cloudflare/weakness-sync-worker.js, 2026-10-14); until it is redeployed the endpoint answers
// 404 and this client quietly does nothing, so nothing on the page changes.
(function(){
  if(window.__trainingSyncLoaded)return;
  window.__trainingSyncLoaded=true;
  const CFG_KEY='indo_weak_sync_config_v1',META_KEY='indo_training_sync_meta_v1',DEVICE_KEY='indo_weak_sync_device_v1';
  const MODES={quick:{key:'indo_quick_practice_state',field:'last',event:'quick-practice-updated'},
    listen:{key:'indo_listen_stats_v1',field:'last_at',event:'listening-weakness-updated'},
    auto:{key:'indo_automation_training_state_v1',field:'last_at',event:'automation-training-updated'}};
  const DEBOUNCE_MS=10000,RETRY_404_MS=6*3600000;
  // 2026-10-16: lesson-end recall (indo_lesson_recall_v1 → words). Synced only after the Worker answers GET /training
  // with modes.recall (Worker updated); before that it stays on this device and the lesson shows "仅本机保存".
  // Merge = LessonRecall.mergeRecord: one entry per word per day, the earliest attempt of that day wins on every device.
  const RECALL_KEY='indo_lesson_recall_v1';
  function recallTs(r){return Math.max(0,...((r&&Array.isArray(r.hist)?r.hist:[r]).map(h=>ts(h&&h.at))));}
  function mergeRecallWords(local,remote){
    const fn=window.LessonRecall&&window.LessonRecall.mergeRecord;if(typeof fn!=='function')return {merged:local,changed:0};
    const out=Object.assign({},local);let changed=0;
    Object.keys(remote||{}).forEach(rk=>{const k=norm(rk),m=fn(out[k],remote[rk]);if(m&&JSON.stringify(m)!==JSON.stringify(out[k]||null)){out[k]=m;changed++;}});
    return {merged:out,changed};
  }
  let timer=null,busy=false,lastSig='';
  function norm(s){return String(s||'').trim().toLowerCase();}
  function ts(v){if(!v)return 0;if(typeof v==='number')return v;const n=Date.parse(String(v).replace(' ','T'));return Number.isFinite(n)?n:0;}
  function readObj(k){try{const x=JSON.parse(localStorage.getItem(k)||'{}');return x&&typeof x==='object'&&!Array.isArray(x)?x:{};}catch(e){return {};}}
  function writeObj(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}}
  function cfg(){const x=readObj(CFG_KEY);return {endpoint:String(x.endpoint||'').replace(/\/+$/,''),key:String(x.key||'')};}
  function meta(){return readObj(META_KEY);}
  // Newest practice time wins per word; local keys keep their original spelling.
  function mergeMode(local,remote,field){
    const out=Object.assign({},local),index={};let changed=0;
    Object.keys(out).forEach(k=>{index[norm(k)]=k;});
    Object.keys(remote||{}).forEach(rk=>{
      const r=remote[rk];if(!r||typeof r!=='object'||Array.isArray(r))return;
      const n=norm(rk),lk=index[n],l=lk!==undefined?out[lk]:null;
      if(!l||ts(r[field])>ts(l[field])){const key=lk!==undefined?lk:rk;out[key]=r;index[n]=key;changed++;}
    });
    return {merged:out,changed};
  }
  function delta(local,field,since){const out={};Object.keys(local).forEach(k=>{const r=local[k];if(r&&typeof r==='object'&&ts(r[field])>since)out[k]=r;});return out;}
  async function call(method,body){
    const c=cfg();if(!c.endpoint||!c.key)return null;
    const res=await fetch(c.endpoint+'/training',{method,headers:{'content-type':'application/json','x-sync-key':c.key},body:body?JSON.stringify(body):undefined,cache:'no-store'});
    if(res.status===404){const m=meta();m.unsupported_until=Date.now()+RETRY_404_MS;writeObj(META_KEY,m);return null;}
    if(!res.ok)throw new Error('training sync '+res.status);
    return res.json();
  }
  function supported(){const m=meta();return !(m.unsupported_until&&Date.now()<m.unsupported_until);}
  async function pull(){
    const data=await call('GET');if(!data||!data.modes)return 0;
    let total=0;
    const m0=meta(),sup=!!(data.modes.recall&&typeof data.modes.recall==='object');
    if(!!m0.recall_supported!==sup){m0.recall_supported=sup;writeObj(META_KEY,m0);try{window.dispatchEvent(new CustomEvent('training-sync-recall'));}catch(e){}}
    if(sup){
      const st=readObj(RECALL_KEY),r=mergeRecallWords(st.words&&typeof st.words==='object'?st.words:{},data.modes.recall);
      if(r.changed){st.version=1;st.words=r.merged;if(writeObj(RECALL_KEY,st)){total+=r.changed;try{window.dispatchEvent(new CustomEvent('lesson-recall-updated',{detail:{source:'training-sync'}}));}catch(e){}}}
    }
    Object.keys(MODES).forEach(mode=>{
      const def=MODES[mode],r=mergeMode(readObj(def.key),data.modes[mode]||{},def.field);
      if(r.changed&&writeObj(def.key,r.merged)){total+=r.changed;try{window.dispatchEvent(new CustomEvent(def.event,{detail:{source:'training-sync'}}));}catch(e){}}
    });
    return total;
  }
  async function push(){
    const m=meta(),since=m.pushed||{},modes={},next={};let n=0;
    Object.keys(MODES).forEach(mode=>{
      const def=MODES[mode],d=delta(readObj(def.key),def.field,Number(since[mode]||0));
      const keys=Object.keys(d);if(!keys.length)return;modes[mode]=d;n+=keys.length;
      next[mode]=Math.max(Number(since[mode]||0),...keys.map(k=>ts(d[k][def.field])));
    });
    if(m.recall_supported){
      const words=readObj(RECALL_KEY).words||{},since0=Number(since.recall||0),d={};
      Object.keys(words).forEach(k=>{if(recallTs(words[k])>since0)d[k]=words[k];});
      const keys=Object.keys(d);if(keys.length){modes.recall=d;n+=keys.length;next.recall=Math.max(since0,...keys.map(k=>recallTs(d[k])));}
    }
    if(!n)return 0;
    const res=await call('POST',{modes,device_id:localStorage.getItem(DEVICE_KEY)||''});
    if(res&&res.ok){const m2=meta();m2.pushed=Object.assign({},m2.pushed||{},next);m2.last_push=new Date().toISOString();writeObj(META_KEY,m2);}
    return n;
  }
  function signature(){return Object.keys(MODES).map(m=>MODES[m].key).concat(RECALL_KEY).map(k=>{const s=localStorage.getItem(k)||'';return s.length+':'+s.slice(-64);}).join('|');}
  function recallStatus(){const c=cfg();return c.endpoint&&c.key&&meta().recall_supported?'synced':'local';}
  async function run(){
    const c=cfg();if(busy||!c.endpoint||!c.key||!supported())return;
    busy=true;
    try{await pull();await push();lastSig=signature();}catch(e){}finally{busy=false;}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(run,DEBOUNCE_MS);}
  Object.keys(MODES).map(m=>MODES[m].event).concat('lesson-recall-updated').forEach(ev=>window.addEventListener(ev,e=>{if(!(e&&e.detail&&e.detail.source==='training-sync'))schedule();}));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&signature()!==lastSig)run();});
  setInterval(()=>{if(signature()!==lastSig)schedule();},60000);
  window.TrainingSync={run,pull,push,mergeMode,mergeRecallWords,recallStatus};
  if(document.readyState==='complete')setTimeout(run,2000);else window.addEventListener('load',()=>setTimeout(run,2000),{once:true});
})();
