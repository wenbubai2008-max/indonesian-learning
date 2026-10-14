// 2026-10-14: set up sync on another device by scanning a QR code instead of typing the Worker address and key.
// The computer ("弱项强化 → 学习状态同步 → 手机扫码设置") shows a QR code of <site>#sync-setup=<base64url {e,k}>.
// The phone's camera opens that link; this script (loaded synchronously, before the page's own hash navigation
// runs at DOMContentLoaded) removes the fragment from the address bar at once and saves nothing until the learner
// taps 启用. A URL fragment is never sent to any server. The QR library is loaded only when the code is shown.
(function(){
  if(window.__syncDeviceSetupLoaded)return;
  window.__syncDeviceSetupLoaded=true;
  const CFG_KEY='indo_weak_sync_config_v1',TRAINING_META_KEY='indo_training_sync_meta_v1',PREFIX='#sync-setup=';
  const QR_LIB='data/vendor/qrcode-generator-1.4.4.js',QR_TTL_MS=180000;
  function readObj(k){try{const x=JSON.parse(localStorage.getItem(k)||'{}');return x&&typeof x==='object'&&!Array.isArray(x)?x:{};}catch(e){return {};}}
  function cleanEndpoint(s){return String(s||'').trim().replace(/\/+$/,'');}
  function b64urlEncode(text){return btoa(unescape(encodeURIComponent(text))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
  function b64urlDecode(s){s=String(s).replace(/-/g,'+').replace(/_/g,'/');s+='='.repeat((4-s.length%4)%4);return decodeURIComponent(escape(atob(s)));}
  function currentConfig(){const x=readObj(CFG_KEY);return {endpoint:cleanEndpoint(x.endpoint),key:String(x.key||'')};}
  function link(cfg,base){return base+PREFIX+b64urlEncode(JSON.stringify({e:cfg.endpoint,k:cfg.key}));}
  function parse(hash){
    const m=String(hash||'').match(/^#sync-setup=([A-Za-z0-9_-]+)$/);if(!m)return null;
    try{
      const x=JSON.parse(b64urlDecode(m[1])),endpoint=cleanEndpoint(x&&x.e),key=String(x&&x.k||'').trim();
      return /^https:\/\/[^\s\/]+/.test(endpoint)&&key?{endpoint:endpoint,key:key}:null;
    }catch(e){return null;}
  }
  // Save the configuration and let both sync clients run now. A fresh setup also lifts the training client's
  // 6-hour back-off, which may have been recorded while the Worker had no /training endpoint.
  function accept(cfg){
    localStorage.setItem(CFG_KEY,JSON.stringify({endpoint:cfg.endpoint,key:cfg.key}));
    const meta=readObj(TRAINING_META_KEY);if(meta.unsupported_until){delete meta.unsupported_until;localStorage.setItem(TRAINING_META_KEY,JSON.stringify(meta));}
    const jobs=[];
    try{if(window.TrainingSync&&typeof window.TrainingSync.run==='function')jobs.push(window.TrainingSync.run());}catch(e){}
    try{if(window.WeaknessSync&&typeof window.WeaknessSync.pull==='function')jobs.push(window.WeaknessSync.pull());}catch(e){}
    return Promise.all(jobs.map(p=>Promise.resolve(p).catch(()=>null)));
  }

  // ---------- receiving side (the phone) ----------
  let incoming=null,gotLink=false;
  try{
    if(String(location.hash||'').indexOf(PREFIX)===0){
      gotLink=true;incoming=parse(location.hash);
      history.replaceState(null,'',location.pathname+location.search);
    }
  }catch(e){incoming=null;}
  function css(){
    if(document.getElementById('syncSetupStyle'))return;
    const st=document.createElement('style');st.id='syncSetupStyle';
    st.textContent='#syncSetupBanner{position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;max-width:480px;margin:0 auto;background:#fff;border:1px solid #dce3ef;border-radius:14px;box-shadow:0 8px 28px rgba(16,24,40,.18);padding:14px 16px;font-size:14px;line-height:1.55}'+
      '#syncSetupBanner p{margin:4px 0 10px;color:#475467;font-size:13px}#syncSetupBanner .ssbActions{display:flex;gap:8px;justify-content:flex-end}'+
      '#syncSetupBanner button,#weakSyncQrModal button{border:1px solid #dce3ef;background:#fff;border-radius:9px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer}'+
      '#syncSetupBanner button.primary{background:#2563eb;border-color:#2563eb;color:#fff}'+
      '#weakSyncQrModal{position:fixed;inset:0;z-index:9999;background:rgba(16,24,40,.45);display:flex;align-items:center;justify-content:center;padding:16px}'+
      '#weakSyncQrModal .wsqBox{background:#fff;border-radius:16px;padding:18px;max-width:340px;width:100%;text-align:center;font-size:13px;line-height:1.55;color:#344054}'+
      '#weakSyncQrModal .wsqImg{width:240px;max-width:100%;margin:12px auto}#weakSyncQrModal .wsqImg svg{width:100%;height:auto;display:block}'+
      '#weakSyncQrModal .wsqWarn{color:#b54708;font-weight:600}';
    document.head.appendChild(st);
  }
  function hostOf(u){try{return new URL(u).host;}catch(e){return u;}}
  function banner(html,buttons,autoHideMs){
    css();let el=document.getElementById('syncSetupBanner');if(el)el.remove();
    el=document.createElement('div');el.id='syncSetupBanner';el.setAttribute('role','dialog');
    el.innerHTML=html+'<div class="ssbActions"></div>';
    const bar=el.querySelector('.ssbActions');
    (buttons||[]).forEach(b=>{const x=document.createElement('button');x.type='button';x.textContent=b.label;if(b.primary)x.className='primary';x.onclick=b.onclick;bar.appendChild(x);});
    document.body.appendChild(el);
    if(autoHideMs)setTimeout(()=>{if(el.isConnected)el.remove();},autoHideMs);
    return el;
  }
  function offer(){
    if(!incoming){banner('<b>这个设置链接无效</b><p>请在电脑上重新打开二维码再扫一次。</p>',[],6000);return;}
    const cfg=incoming,cur=currentConfig();
    if(cur.endpoint===cfg.endpoint&&cur.key===cfg.key){banner('<b>这台设备已经设置过同步</b><p>不需要再操作。</p>',[],4000);return;}
    const replace=cur.endpoint&&cur.key?'这会替换本机原有的同步设置。':'';
    const el=banner('<b>在这台设备上启用学习状态同步？</b><p>同步服务：'+hostOf(cfg.endpoint).replace(/[<>&"]/g,'')+'。启用后，弱项和听词、快速练习、自动训练的进度会和其他设备合并。'+replace+'</p>',[
      {label:'取消',onclick:()=>{incoming=null;el.remove();}},
      {label:'启用',primary:true,onclick:()=>{
        const c=incoming;incoming=null;el.remove();
        banner('<b>已启用 · 正在同步…</b>',[],0);
        accept(c).then(()=>banner('<b>同步已启用</b><p>以后打开网站会自动同步，不用再设置。</p>',[{label:'好',primary:true,onclick:()=>{const b=document.getElementById('syncSetupBanner');if(b)b.remove();}}],8000));
      }}
    ]);
  }
  if(gotLink){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',offer,{once:true});else offer();
  }

  // ---------- showing side (the computer) ----------
  function loadQrLib(){
    if(typeof window.qrcode==='function')return Promise.resolve();
    return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=QR_LIB;s.onload=()=>resolve();s.onerror=()=>reject(new Error('二维码组件加载失败'));document.head.appendChild(s);});
  }
  async function showQr(){
    const cfg=currentConfig();if(!cfg.endpoint||!cfg.key)return false;
    await loadQrLib();
    const qr=window.qrcode(0,'M');qr.addData(link(cfg,location.origin+location.pathname));qr.make();
    css();const old=document.getElementById('weakSyncQrModal');if(old)old.remove();
    const m=document.createElement('div');m.id='weakSyncQrModal';
    m.innerHTML='<div class="wsqBox" role="dialog" aria-label="手机扫码设置同步"><b>用手机扫码设置同步</b><div class="wsqImg">'+qr.createSvgTag({cellSize:4,margin:4,scalable:true})+'</div>'+
      '<p>用手机相机扫码，用你平时练习的浏览器打开网页，点“启用”。</p><p class="wsqWarn">二维码里含有同步密钥：不要截图，不要发给别人。3 分钟后自动关闭。</p><button type="button">关闭</button></div>';
    const close=()=>{clearTimeout(t);document.removeEventListener('keydown',esc);if(m.isConnected)m.remove();};
    const esc=e=>{if(e.key==='Escape')close();};
    const t=setTimeout(close,QR_TTL_MS);
    m.querySelector('button').onclick=close;m.addEventListener('click',e=>{if(e.target===m)close();});document.addEventListener('keydown',esc);
    document.body.appendChild(m);
    return true;
  }
  window.SyncDeviceSetup={showQr:showQr,link:link,parse:parse,accept:accept};
})();
