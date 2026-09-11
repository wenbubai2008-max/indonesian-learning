(function(){
  if(window.__weaknessSyncClientLoaded)return;
  window.__weaknessSyncClientLoaded=true;

  const CFG_KEY='indo_weak_sync_config_v1';
  const META_KEY='indo_weak_sync_meta_v1';
  const SHADOW_KEY='indo_weak_sync_shadow_v1';
  const DEVICE_KEY='indo_weak_sync_device_v1';
  const DEBOUNCE_MS=10000;
  let timer=null,applyingRemote=false,readingPool=false,pending=false,lastMessage='';

  function parse(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'')||fallback;}catch(e){return fallback;}}
  function save(key,val){localStorage.setItem(key,JSON.stringify(val));}
  function norm(s){return String(s||'').trim().toLowerCase();}
  function iso(v){
    if(!v)return '';
    if(typeof v==='number')return new Date(v).toISOString();
    const n=Date.parse(v);return Number.isFinite(n)?new Date(n).toISOString():'';
  }
  function newest(){
    const xs=Array.from(arguments).map(iso).filter(Boolean).sort();
    return xs.length?xs[xs.length-1]:'';
  }
  function cfg(){const x=parse(CFG_KEY,{});return {endpoint:String(x.endpoint||'').replace(/\/+$/,''),key:String(x.key||'')};}
  function configured(){const c=cfg();return !!(c.endpoint&&c.key);}
  function deviceId(){
    let id=localStorage.getItem(DEVICE_KEY);if(id)return id;
    id=(crypto&&crypto.randomUUID)?crypto.randomUUID():'dev-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
    localStorage.setItem(DEVICE_KEY,id);return id;
  }
  function pool(){return window.WeaknessPool||null;}
  function recordTime(x){return newest(x.updated_at,x.last_mastered,x.last_wrong,x.last_review,x.last_seen,x.first_seen)||new Date().toISOString();}
  function baseRecord(x){
    return {
      word:x.word||'',display:x.display||'',cn:x.cn||'',root:x.root||'',root_cn:x.root_cn||'',
      status:x.status||'active',reasons:Array.isArray(x.reasons)?x.reasons.slice(0,8):[],
      wrong_count:Number(x.wrong_count||0),right_streak:Number(x.right_streak||0),
      last_wrong:iso(x.last_wrong),last_review:iso(x.last_review),last_mastered:iso(x.last_mastered),
      source:x.source||'',source_date:x.source_date||'',session:x.session||''
    };
  }
  function signature(x){return JSON.stringify(baseRecord(x));}
  function currentMaps(){
    const p=pool();let items=[];
    if(p&&typeof p.all==='function'){
      readingPool=true;
      try{items=p.all();}finally{readingPool=false;}
    }
    const meta=parse(META_KEY,{}),words={},shadow={};
    items.forEach(function(x){
      if(!x||!x.word)return;const k=norm(x.word);if(!k)return;
      if(!meta[k])meta[k]={updated_at:recordTime(x)};
      const r=baseRecord(x);r.updated_at=meta[k].updated_at||recordTime(x);words[k]=r;shadow[k]=signature(x);
    });
    save(META_KEY,meta);return {words:words,shadow:shadow,meta:meta};
  }
  function refreshShadow(){const x=currentMaps();save(SHADOW_KEY,x.shadow);return x;}
  function detectLocalChanges(){
    if(applyingRemote||readingPool)return false;
    const p=pool();if(!p)return false;
    const old=parse(SHADOW_KEY,{}),x=currentMaps(),meta=x.meta,now=new Date().toISOString();let changed=false;
    Object.keys(x.shadow).forEach(function(k){if(old[k]!==x.shadow[k]){meta[k]={updated_at:now};changed=true;}});
    save(META_KEY,meta);save(SHADOW_KEY,x.shadow);return changed;
  }

  function injectUI(){
    const page=document.getElementById('weakness');if(!page||document.getElementById('weakSyncPanel'))return;
    const head=page.querySelector('.sectionHead');if(!head)return;
    const panel=document.createElement('div');panel.id='weakSyncPanel';panel.innerHTML='<div class="weakSyncText"><b>学习状态同步</b><span id="weakSyncStatus">未配置</span></div><div class="weakSyncActions"><button type="button" id="weakSyncSetup">设置同步</button><button type="button" id="weakSyncNow">立即同步</button></div>';
    head.insertAdjacentElement('afterend',panel);
    const st=document.createElement('style');st.id='weakSyncStyle';st.textContent='#weakSyncPanel{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:12px 0 16px;padding:10px 12px;background:#f8faff;border:1px solid #e6ebf5;border-radius:12px}.weakSyncText{display:flex;flex-direction:column;gap:3px}.weakSyncText b{font-size:13px}.weakSyncText span{font-size:12px;color:#667085}.weakSyncActions{display:flex;gap:7px;flex-wrap:wrap}.weakSyncActions button{border:1px solid #dce3ef;background:#fff;border-radius:9px;padding:7px 10px;font-size:12px;font-weight:700;cursor:pointer}.weakSyncActions button:disabled{opacity:.5}@media(max-width:650px){#weakSyncPanel{align-items:flex-start;flex-direction:column}}';document.head.appendChild(st);
    document.getElementById('weakSyncSetup').onclick=configure;
    document.getElementById('weakSyncNow').onclick=function(){syncNow(true)};
    setStatus(configured()?'已配置 · 有变化时后台同步':'未配置 · 本机状态正常保存');
  }
  function setStatus(msg){lastMessage=msg;const el=document.getElementById('weakSyncStatus');if(el)el.textContent=msg;}
  function setBusy(v){const b=document.getElementById('weakSyncNow');if(b)b.disabled=!!v;}

  function configure(){
    const old=cfg();
    const endpoint=prompt('Cloudflare Worker 地址\n例如：https://xxx.workers.dev',old.endpoint||'');
    if(endpoint===null)return;
    const ep=String(endpoint||'').trim().replace(/\/+$/,'');if(!ep){setStatus('未配置 · 本机状态正常保存');return;}
    const key=prompt('同步密钥 SYNC_KEY（只保存在本机浏览器）',old.key||'');
    if(key===null||!String(key).trim())return;
    save(CFG_KEY,{endpoint:ep,key:String(key).trim()});
    setStatus('正在首次合并…');
    initialMerge();
  }

  async function request(path,opt){
    const c=cfg();if(!c.endpoint||!c.key)throw new Error('未配置同步服务');
    const o=Object.assign({method:'GET',cache:'no-store'},opt||{});
    o.headers=Object.assign({'x-sync-key':c.key},o.headers||{});
    const r=await fetch(c.endpoint+path,o);
    if(!r.ok){let t='';try{t=await r.text()}catch(e){}throw new Error('HTTP '+r.status+(t?' · '+t.slice(0,120):''));}
    return r.status===204?{}:r.json();
  }

  function applyRemoteRecord(r){
    const p=pool();if(!p||!r||!r.word)return;
    const item={word:r.word,display:r.display||r.word,cn:r.cn||'',root:r.root||'',root_cn:r.root_cn||'',source:r.source||'',source_date:r.source_date||'',session:r.session||''};
    if(r.status==='mastered')p.markMastered(r.word,'cloud_sync');
    else p.markWeak(r.word,item,(r.reasons&&r.reasons[0])||'cloud_sync');
    if(typeof p.enrich==='function')p.enrich(r.word,item);
  }

  async function pullRemote(){
    if(!configured()||!navigator.onLine)return {changed:0};
    const data=await request('/state');const remote=data&&data.words||{},local=currentMaps(),meta=local.meta;
    let changed=0,localNewer=0;applyingRemote=true;
    try{
      Object.keys(remote).forEach(function(k0){
        const r=remote[k0]||{},k=norm(r.word||k0);if(!k)return;
        const rt=Date.parse(r.updated_at||0)||0,lt=Date.parse((meta[k]||{}).updated_at||0)||0;
        if(rt>lt){applyRemoteRecord(Object.assign({},r,{word:r.word||k}));meta[k]={updated_at:new Date(rt).toISOString()};changed++;}
        else if(lt>rt)localNewer++;
      });
    }finally{applyingRemote=false;}
    save(META_KEY,meta);refreshShadow();
    if(localNewer>0)scheduleSync(1200);
    return {changed:changed,localNewer:localNewer};
  }

  function payload(){
    const x=currentMaps();
    return {version:1,device_id:deviceId(),client_time:new Date().toISOString(),words:x.words};
  }
  async function pushState(keepalive){
    if(!configured())return false;
    if(!navigator.onLine){pending=true;setStatus('离线 · 已保存在本机，联网后补同步');return false;}
    const body=JSON.stringify(payload());
    await request('/sync',{method:'POST',headers:{'content-type':'application/json'},body:body,keepalive:!!keepalive});
    pending=false;setStatus('已发送 · 5分钟内写入 GitHub');return true;
  }
  async function flush(){await request('/flush',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});setStatus('已立即写入 GitHub');}
  async function syncNow(doFlush){
    if(!configured()){configure();return;}
    clearTimeout(timer);timer=null;setBusy(true);setStatus('正在同步…');
    try{await pullRemote();await pushState(false);if(doFlush)await flush();}
    catch(e){setStatus('同步失败 · '+e.message);}
    finally{setBusy(false);}
  }
  function scheduleSync(delay){
    if(!configured())return;pending=true;clearTimeout(timer);
    timer=setTimeout(async function(){timer=null;setStatus('后台同步中…');try{await pushState(false);}catch(e){setStatus('同步失败 · 将在下次操作或联网后重试');}},delay==null?DEBOUNCE_MS:delay);
  }
  async function initialMerge(){
    if(!configured())return;
    setBusy(true);
    try{await pullRemote();await pushState(false);await flush();setStatus('首次同步完成');}
    catch(e){setStatus('配置已保存，但同步失败 · '+e.message);}
    finally{setBusy(false);}
  }

  function onWeakChange(){if(applyingRemote||readingPool)return;if(detectLocalChanges()){setStatus(configured()?'有新变化 · 10秒后同步':'有新变化 · 仅保存在本机');scheduleSync();}}
  window.addEventListener('weak-pool-changed',onWeakChange);
  window.addEventListener('online',function(){if(pending||configured()){setStatus('网络已恢复 · 准备同步');scheduleSync(1000);}});
  window.addEventListener('offline',function(){setStatus('离线 · 学习状态继续保存在本机');});
  window.addEventListener('pagehide',function(){if(pending&&configured())pushState(true).catch(function(){});});

  function boot(){
    if(!pool()){setTimeout(boot,80);return;}
    refreshShadow();injectUI();
    if(configured())pullRemote().then(function(r){setStatus(r.changed?'已合并云端状态':'已连接 · 有变化时后台同步');}).catch(function(){setStatus('同步服务暂时不可用 · 本机学习不受影响');});
  }
  window.WeaknessSync={configure:configure,syncNow:function(){return syncNow(true)},pull:pullRemote,getConfig:cfg,clearConfig:function(){localStorage.removeItem(CFG_KEY);setStatus('未配置 · 本机状态正常保存');}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
