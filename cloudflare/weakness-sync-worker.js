const KV_KEY='weakness-state-v1';

function cors(env,origin){
  const allowed=String(env.ALLOWED_ORIGIN||'https://wenbubai2008-max.github.io').split(',').map(s=>s.trim()).filter(Boolean);
  const ok=allowed.includes(origin)?origin:allowed[0]||'*';
  return {'access-control-allow-origin':ok,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type,x-sync-key','access-control-max-age':'86400','vary':'Origin'};
}
function json(data,status,env,origin){return new Response(JSON.stringify(data),{status:status||200,headers:Object.assign({'content-type':'application/json; charset=utf-8'},cors(env,origin))});}
function authorized(req,env){return !!env.SYNC_KEY&&req.headers.get('x-sync-key')===env.SYNC_KEY;}
function iso(v){if(!v)return '';const n=typeof v==='number'?v:Date.parse(v);return Number.isFinite(n)?new Date(n).toISOString():'';}
function norm(s){return String(s||'').trim().toLowerCase();}
function pick(x,k,max){const v=x&&x[k];if(v===undefined||v===null)return undefined;if(Array.isArray(v))return v.slice(0,max||8).map(a=>String(a).slice(0,120));return String(v).slice(0,max||500);}
function cleanRecord(r,key){
  const out={word:pick(r,'word',120)||key,status:r&&r.status==='mastered'?'mastered':'active',updated_at:iso(r&&r.updated_at)||new Date().toISOString()};
  ['display','cn','root','root_cn','last_wrong','last_review','last_mastered','source','source_date','session'].forEach(k=>{const v=pick(r,k,k==='cn'?300:160);if(v!==undefined&&v!=='')out[k]=v;});
  if(Array.isArray(r&&r.reasons))out.reasons=r.reasons.slice(0,8).map(x=>String(x).slice(0,80));
  out.wrong_count=Math.max(0,Math.min(9999,Number(r&&r.wrong_count||0)));
  out.right_streak=Math.max(0,Math.min(9999,Number(r&&r.right_streak||0)));
  return out;
}
async function loadState(env){
  if(!env.WEAK_SYNC_KV)throw new Error('Missing WEAK_SYNC_KV binding');
  const x=await env.WEAK_SYNC_KV.get(KV_KEY,'json');
  return x&&x.words?x:{version:1,updated_at:null,dirty:false,words:{}};
}
async function saveState(env,state){await env.WEAK_SYNC_KV.put(KV_KEY,JSON.stringify(state));}
function mergeWords(base,incoming){
  const out=Object.assign({},base||{});
  Object.keys(incoming||{}).slice(0,3000).forEach(k0=>{
    const raw=incoming[k0]||{},k=norm(raw.word||k0);if(!k)return;
    const r=cleanRecord(raw,k),old=out[k];
    const rt=Date.parse(r.updated_at||0)||0,ot=Date.parse(old&&old.updated_at||0)||0;
    if(!old||rt>=ot)out[k]=r;
  });
  return out;
}
function ghBase(env){const owner=env.GITHUB_OWNER||'wenbubai2008-max',repo=env.GITHUB_REPO||'indonesian-learning',path=env.SYNC_FILE||'data/weakness-sync.json';return {owner,repo,path,branch:env.GITHUB_BRANCH||'main'};}
async function ghFetch(env,url,opt){
  const r=await fetch(url,Object.assign({},opt||{},{headers:Object.assign({'authorization':'Bearer '+env.GITHUB_TOKEN,'accept':'application/vnd.github+json','x-github-api-version':'2022-11-28','user-agent':'indo-learning-sync-worker'},opt&&opt.headers||{})}));
  return r;
}
async function readGitHub(env){
  const g=ghBase(env),u=`https://api.github.com/repos/${g.owner}/${g.repo}/contents/${g.path}?ref=${encodeURIComponent(g.branch)}`;
  const r=await ghFetch(env,u);if(r.status===404)return {sha:null,data:{version:1,updated_at:null,words:{}}};if(!r.ok)throw new Error('GitHub read '+r.status);
  const j=await r.json(),bytes=Uint8Array.from(atob(String(j.content||'').replace(/\n/g,'')),c=>c.charCodeAt(0));
  const text=new TextDecoder().decode(bytes);let data={version:1,updated_at:null,words:{}};try{data=JSON.parse(text)}catch(e){}return {sha:j.sha,data:data&&data.words?data:{version:1,updated_at:null,words:{}}};
}
function b64(s){const bytes=new TextEncoder().encode(s);let bin='';for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(bin);}
async function writeGitHub(env,snapshot){
  if(!env.GITHUB_TOKEN)throw new Error('Missing GITHUB_TOKEN');
  const g=ghBase(env),old=await readGitHub(env),published={version:1,updated_at:snapshot.updated_at||new Date().toISOString(),words:snapshot.words||{}};
  const body={message:'chore: sync learning weakness state',content:b64(JSON.stringify(published,null,2)),branch:g.branch};if(old.sha)body.sha=old.sha;
  const u=`https://api.github.com/repos/${g.owner}/${g.repo}/contents/${g.path}`;
  const r=await ghFetch(env,u,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)});if(!r.ok){const t=await r.text();throw new Error('GitHub write '+r.status+' '+t.slice(0,160));}return true;
}
// 2026-10-14: per-device training schedules (quick / listen / auto) synced across devices. Stored only in KV
// (never written to GitHub). Each word keeps the record with the newest practice time.
const TRAIN_KEY='training-state-v1';
const TRAIN_FIELDS={quick:'last',listen:'last_at',auto:'last_at'};
function tsAny(v){if(!v)return 0;if(typeof v==='number')return v;const n=Date.parse(String(v).replace(' ','T'));return Number.isFinite(n)?n:0;}
// 2026-10-16: lesson-end recall (self-report). Per word one history entry per day; the EARLIEST attempt of a day wins,
// so a later answer on another device never replaces the day's first recall. Same rule as data/lesson-end-recall.js.
function mergeRecall(a,b){
  const by={};
  [a,b].forEach(r=>{if(!r||typeof r!=='object')return;const hist=Array.isArray(r.hist)&&r.hist.length?r.hist:(r.day?[{day:r.day,result:r.result,at:r.at,lesson:r.lesson}]:[]);
    hist.slice(0,60).forEach(h=>{if(!h||!/^\d{4}-\d{2}-\d{2}$/.test(h.day||'')||!['fast','slow','fail'].includes(h.result))return;const cur=by[h.day];if(!cur||tsAny(h.at)<tsAny(cur.at))by[h.day]={day:h.day,result:h.result,at:String(h.at||'').slice(0,40),lesson:String(h.lesson||'').slice(0,20)};});});
  const hist=Object.keys(by).sort().slice(-20).map(d=>by[d]);if(!hist.length)return null;
  const top=hist[hist.length-1];return {day:top.day,result:top.result,at:top.at,lesson:top.lesson,hist};
}
function mergeTraining(base,incoming){
  const out={};
  const rc=Object.assign({},base&&base.recall||{}),ri=incoming&&incoming.recall||{};
  Object.keys(ri).slice(0,5000).forEach(k0=>{const k=norm(k0);if(!k||JSON.stringify(ri[k0]||null).length>4000)return;const m=mergeRecall(rc[k],ri[k0]);if(m)rc[k]=m;});
  out.recall=rc;
  Object.keys(TRAIN_FIELDS).forEach(mode=>{
    const field=TRAIN_FIELDS[mode],cur=Object.assign({},base&&base[mode]||{}),inc=incoming&&incoming[mode]||{};
    Object.keys(inc).slice(0,5000).forEach(k0=>{
      const r=inc[k0],k=norm(k0);if(!k||!r||typeof r!=='object'||Array.isArray(r))return;
      if(JSON.stringify(r).length>4000)return;
      if(!cur[k]||tsAny(r[field])>tsAny(cur[k][field]))cur[k]=r;
    });
    out[mode]=cur;
  });
  return out;
}
async function loadTraining(env){
  if(!env.WEAK_SYNC_KV)throw new Error('Missing WEAK_SYNC_KV binding');
  const x=await env.WEAK_SYNC_KV.get(TRAIN_KEY,'json');
  const t=x&&x.modes?x:{version:1,updated_at:null,modes:{quick:{},listen:{},auto:{}}};
  if(!t.modes.recall)t.modes.recall={}; // presence of modes.recall tells the page this Worker can sync lesson-end recall
  return t;
}
// 2026-10-14 (user decision): the 5-minute cron used to write every change to GitHub, so practice sessions produced a
// commit (and a runtime rebuild) every few minutes. Devices sync through KV directly, so GitHub only needs the state
// before each generator reads the runtime: 07:24 AM lesson, 11:24 reading, 17:30 PM lesson (Jakarta, UTC+7), plus
// one evening snapshot. The cron keeps firing every 5 minutes; outside these windows it does nothing. A window has
// several 5-minute ticks, so a failed write is retried, and a clean state (dirty=false) never writes.
// "立即同步" (POST /flush) still writes at once.
const FLUSH_WINDOWS_WIB=[[6*60+40,7*60+15],[10*60+40,11*60+15],[16*60+40,17*60+20],[21*60,21*60+10]];
function inFlushWindow(ms){const d=new Date(Number(ms)+7*3600000),m=d.getUTCHours()*60+d.getUTCMinutes();return FLUSH_WINDOWS_WIB.some(w=>m>=w[0]&&m<w[1]);}
async function flush(env){
  const state=await loadState(env);if(!state.dirty)return {flushed:false};
  const stamp=state.updated_at||new Date().toISOString(),snapshot={version:1,updated_at:stamp,words:state.words||{}};
  await writeGitHub(env,snapshot);
  const latest=await loadState(env);if(latest.updated_at===stamp){latest.dirty=false;await saveState(env,latest);}return {flushed:true,updated_at:stamp};
}

export default {
  async fetch(request,env){
    const origin=request.headers.get('origin')||'';
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(env,origin)});
    if(!authorized(request,env))return json({error:'unauthorized'},401,env,origin);
    const url=new URL(request.url);
    try{
      if(request.method==='GET'&&url.pathname==='/state'){
        let state=await loadState(env);
        if(!state.updated_at&&Object.keys(state.words||{}).length===0){
          try{const gh=await readGitHub(env);state={version:1,updated_at:gh.data.updated_at||null,dirty:false,words:gh.data.words||{}};await saveState(env,state);}catch(e){}
        }
        return json({version:1,updated_at:state.updated_at||null,words:state.words||{}},200,env,origin);
      }
      if(request.method==='POST'&&url.pathname==='/sync'){
        const body=await request.json();const state=await loadState(env);state.words=mergeWords(state.words,body&&body.words||{});state.updated_at=new Date().toISOString();state.dirty=true;state.last_device=String(body&&body.device_id||'').slice(0,120);await saveState(env,state);
        return json({ok:true,queued:true,updated_at:state.updated_at,count:Object.keys(state.words).length},200,env,origin);
      }
      if(request.method==='GET'&&url.pathname==='/training'){
        const t=await loadTraining(env);return json({version:1,updated_at:t.updated_at||null,modes:t.modes},200,env,origin);
      }
      if(request.method==='POST'&&url.pathname==='/training'){
        const body=await request.json(),t=await loadTraining(env);
        t.modes=mergeTraining(t.modes,body&&body.modes||{});t.updated_at=new Date().toISOString();t.last_device=String(body&&body.device_id||'').slice(0,120);
        await env.WEAK_SYNC_KV.put(TRAIN_KEY,JSON.stringify(t));
        return json({ok:true,updated_at:t.updated_at,counts:Object.fromEntries(Object.keys(t.modes).map(m=>[m,Object.keys(t.modes[m]).length]))},200,env,origin);
      }
      if(request.method==='POST'&&url.pathname==='/flush')return json(Object.assign({ok:true},await flush(env)),200,env,origin);
      return json({error:'not_found'},404,env,origin);
    }catch(e){return json({error:String(e&&e.message||e)},500,env,origin);}
  },
  async scheduled(event,env,ctx){if(!inFlushWindow(event&&event.scheduledTime||Date.now()))return;ctx.waitUntil(flush(env));}
};
