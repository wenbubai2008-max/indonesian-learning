const fs=require('fs'),vm=require('vm'),zlib=require('zlib');

const rules=JSON.parse(fs.readFileSync('data/learning-pool-rules.json','utf8'));
if(Number(rules.master_total)!==977) throw new Error('learning-pool-rules master_total must be 977');
if(rules.new_pool_formula!=='M ∩ A − D'||rules.review_pool_formula!=='A ∩ D') throw new Error('Unexpected learning-pool formula');

const ctx={window:{}};vm.createContext(ctx);
for(const p of ['data/master-vocab-data.js','data/master-vocab-data-2.js','data/master-vocab-data-3.js','data/oral-vocab-candidates.js','data/daily-vocab-data.js']){
  vm.runInContext(fs.readFileSync(p,'utf8'),ctx,{filename:p});
}

const key=s=>String(s||'').trim().toLowerCase();
const masterRaw=Array.isArray(ctx.window.MASTER_VOCAB_DB)?ctx.window.MASTER_VOCAB_DB:[];
const dailyRaw=Array.isArray(ctx.window.DAILY_VOCAB_DB)?ctx.window.DAILY_VOCAB_DB:[];
const oralRaw=Array.isArray(ctx.window.ORAL_VOCAB_CANDIDATES)?ctx.window.ORAL_VOCAB_CANDIDATES:[];
const weakDoc=JSON.parse(fs.readFileSync('data/weakness-sync.json','utf8'));
const weakWords=weakDoc&&weakDoc.words&&typeof weakDoc.words==='object'
  ?Object.values(weakDoc.words)
  :(Array.isArray(weakDoc)?weakDoc:Object.values(weakDoc||{}).filter(x=>x&&typeof x==='object'&&x.word));

const master=[],masterMeta=new Map(),seen=new Set();
for(const item of masterRaw){
  const w=Array.isArray(item)?item[0]:(item&&item.word);
  const cn=Array.isArray(item)?(item[1]||''):((item&&item.cn)||'');
  const k=key(w);if(!k||seen.has(k))continue;
  seen.add(k);master.push(String(w).trim());masterMeta.set(k,{cn:String(cn||'').trim()});
}
if(master.length!==977) throw new Error(`Master vocabulary count mismatch: ${master.length}`);
const primarySet=new Set(master.map(key));

function loadBipaRaw(){
  if(fs.existsSync('data/bipa-runtime-data.js')){
    const bctx={window:{}};vm.createContext(bctx);
    vm.runInContext(fs.readFileSync('data/bipa-runtime-data.js','utf8'),bctx,{filename:'data/bipa-runtime-data.js'});
    const raw=bctx.window.BIPA_VOCAB_RAW||{};
    if(['A1','A2','B1','B2'].every(lv=>Array.isArray(raw[lv])&&raw[lv].length))return raw;
  }
  const parts=[];
  for(let i=1;i<=8;i++){
    const p=`data/bipa-gz-${String(i).padStart(2,'0')}.js`;
    if(!fs.existsSync(p))continue;
    const s=fs.readFileSync(p,'utf8'),m=s.match(/\+'([^']+)'\s*;?\s*$/);
    if(m)parts.push(m[1]);
  }
  if(parts.length===8){
    const text=zlib.gunzipSync(Buffer.from(parts.join(''),'base64')).toString('utf8');
    const raw=JSON.parse(text);
    if(['A1','A2','B1','B2'].every(lv=>Array.isArray(raw[lv])&&raw[lv].length))return raw;
  }
  throw new Error('BIPA source is incomplete');
}

const bipaRaw=loadBipaRaw();
const secondaryCatalog=[],secondarySeen=new Set();
for(const lv of ['A1','A2','B1','B2']){
  const rows=Array.isArray(bipaRaw[lv])?bipaRaw[lv]:[];
  for(const r of rows){
    if(!Array.isArray(r))continue;
    const word=String(r[0]||'').trim(),k=key(word);if(!k||primarySet.has(k)||secondarySeen.has(k))continue;
    const sab=String(r[8]||'').trim().toUpperCase();
    if(lv==='B2'&&sab!=='S')continue;
    const x={word,cn:String(r[1]||'').trim(),en:String(r[2]||'').trim(),root:String(r[3]||'').trim(),root_cn:'',formation:String(r[4]||'').trim(),bipa_level:lv,sab};
    secondarySeen.add(k);secondaryCatalog.push(x);
  }
}

const dailySet=new Set(dailyRaw.map(x=>key(x&&x.word)).filter(Boolean));
const primaryTaughtUnique=master.reduce((n,w)=>n+(dailySet.has(key(w))?1:0),0);
const primaryUnlearnedTotal=master.length-primaryTaughtUnique;
const dailyMeta=new Map(dailyRaw.map(x=>[key(x&&x.word),x]).filter(([k])=>k));
const weakMap=new Map();for(const x of weakWords){const k=key(x&&x.word);if(k)weakMap.set(k,x)}
const activeMap=new Map([...weakMap].filter(([,x])=>x&&x.status==='active'));
const masteredCount=[...weakMap.values()].filter(x=>x&&x.status==='mastered').length;
const secondaryReason=x=>Array.isArray(x&&x.reasons)&&x.reasons.some(r=>r==='bipa_secondary_dont'||r==='bipa_secondary_fuzzy');

const secondaryMaster=[];
for(const meta of secondaryCatalog){
  const x=activeMap.get(key(meta.word));
  if(!x||!secondaryReason(x))continue;
  const reason=x.reasons.includes('bipa_secondary_dont')?'dont':'fuzzy';
  secondaryMaster.push(Object.assign({},meta,{selection:reason}));
}
fs.writeFileSync('data/master-vocab-secondary.js','window.SECONDARY_MASTER_VOCAB_DB = '+JSON.stringify(secondaryMaster,null,2)+';\n');

const primaryNewFull=master.filter(w=>activeMap.has(key(w))&&!dailySet.has(key(w)));
const secondaryNewFull=secondaryMaster.map(x=>x.word).filter(w=>activeMap.has(key(w))&&!dailySet.has(key(w)));

const HANDOFF_FILE='data/master-handoff-state.json';
const HANDOFF_FILL_TARGET=10;
function defaultHandoff(){return {version:1,phase:'primary',committed_secondary:false,switched_at:'',updated_at:''}}
function readHandoff(){
  if(!fs.existsSync(HANDOFF_FILE))return defaultHandoff();
  try{return Object.assign(defaultHandoff(),JSON.parse(fs.readFileSync(HANDOFF_FILE,'utf8'))||{})}
  catch(e){throw new Error('Invalid master-handoff-state.json: '+e.message)}
}
function handoffCore(x){return {version:1,phase:x.phase,committed_secondary:!!x.committed_secondary,switched_at:x.switched_at||''}}
const oldHandoff=readHandoff();
let handoff=Object.assign({},oldHandoff),activeMasterPool='exhausted',newFull=[];

if(oldHandoff.committed_secondary||oldHandoff.phase==='secondary'){
  handoff.phase='secondary';handoff.committed_secondary=true;
  activeMasterPool=secondaryNewFull.length?'secondary_bipa':'exhausted';
  newFull=secondaryNewFull.slice();
}else if(primaryNewFull.length>=HANDOFF_FILL_TARGET){
  handoff.phase='primary';handoff.committed_secondary=false;handoff.switched_at='';
  activeMasterPool='primary_977';
  newFull=primaryNewFull.slice();
}else if(primaryNewFull.length>0){
  handoff.phase='transition';handoff.committed_secondary=false;
  activeMasterPool='primary_to_secondary';
  newFull=[...primaryNewFull,...secondaryNewFull];
}else if(secondaryNewFull.length){
  handoff.phase='secondary';handoff.committed_secondary=true;
  if(!handoff.switched_at)handoff.switched_at=new Date().toISOString();
  activeMasterPool='secondary_bipa';
  newFull=secondaryNewFull.slice();
}else{
  handoff.phase='primary_exhausted';handoff.committed_secondary=false;
  activeMasterPool='exhausted';
  newFull=[];
}

if(JSON.stringify(handoffCore(oldHandoff))!==JSON.stringify(handoffCore(handoff)))handoff.updated_at=new Date().toISOString();
else handoff.updated_at=oldHandoff.updated_at||'';
fs.writeFileSync(HANDOFF_FILE,JSON.stringify(handoff,null,2)+'\n');

const newFullSet=new Set(newFull.map(key));
const oralFull=oralRaw
  .filter(x=>newFullSet.has(key(x&&x.word)))
  .map(x=>[String(x.word||'').trim(),x.register||'',x.oral||'',x.root||'',Number.isFinite(Number(x.rank))?Number(x.rank):999999])
  .sort((a,b)=>((a[1]==='口语'?0:1)-(b[1]==='口语'?0:1))||(a[4]-b[4])||a[0].localeCompare(b[0]));
const oralExposed=oralFull.slice(0,40);

const newExposed=[];const newSeen=new Set();
for(const w of [...newFull.slice(0,140),...oralExposed.map(x=>x[0])]){
  const k=key(w);if(!k||newSeen.has(k))continue;newSeen.add(k);newExposed.push(w);
}
const secondaryMeta=new Map(secondaryMaster.map(x=>[key(x.word),x]));
const newMeta=newExposed.map(w=>{
  const k=key(w),meta=secondaryMeta.get(k)||masterMeta.get(k)||{};
  return [w,meta.cn||''];
});

const reviewFull=[];
for(const x of activeMap.values()){
  const k=key(x.word);if(!dailySet.has(k))continue;
  const reasons=Array.isArray(x.reasons)?x.reasons:[];
  let p=4;
  if(reasons.includes('quick_wrong')||reasons.includes('manual_unknown'))p=1;
  else if(reasons.includes('listening_wrong')||reasons.includes('memory_dont')||reasons.includes('bipa_secondary_dont'))p=2;
  else if(reasons.includes('listening_slow')||reasons.includes('memory_fuzzy')||reasons.includes('bipa_secondary_fuzzy'))p=3;
  const d=dailyMeta.get(k)||{};
  reviewFull.push([
    String(x.word||'').trim(),p,Number(x.wrong_count||0),x.last_wrong||'',x.last_review||'',
    d.cn||x.cn||(secondaryMeta.get(k)||{}).cn||'',d.root||x.root||(secondaryMeta.get(k)||{}).root||'',d.root_cn||x.root_cn||''
  ]);
}
reviewFull.sort((a,b)=>{
  if(a[1]!==b[1])return a[1]-b[1];
  if(a[2]!==b[2])return b[2]-a[2];
  if(a[1]===1&&String(a[3]||'')!==String(b[3]||''))return String(b[3]||'').localeCompare(String(a[3]||''));
  const ar=String(a[4]||''),br=String(b[4]||'');
  if(ar!==br)return ar.localeCompare(br);
  return String(a[0]).localeCompare(String(b[0]));
});
let reviewExposed=reviewFull.slice(0,60);

const focusFull=[];
for(const x of activeMap.values()){
  const k=key(x.word);if(!dailySet.has(k))continue;
  const reasons=Array.isArray(x.reasons)?x.reasons:[];
  let score=0,signals=[];
  if(reasons.includes('automation_fail')){score+=50;signals.push('automation_fail');}
  if(reasons.includes('quick_wrong')){score+=36;signals.push('quick_wrong');}
  if(reasons.includes('listening_wrong')){score+=32;signals.push('listening_wrong');}
  if(reasons.includes('manual_unknown')||reasons.includes('seed_unfamiliar')){score+=30;signals.push('unknown');}
  if(reasons.includes('memory_dont')||reasons.includes('bipa_secondary_dont')){score+=28;signals.push('dont');}
  if(reasons.includes('memory_fuzzy')||reasons.includes('bipa_secondary_fuzzy')){score+=20;signals.push('fuzzy');}
  if(reasons.includes('listening_slow')){score+=14;signals.push('listening_slow');}
  if(!score)continue;
  score+=Math.min(12,Number(x.wrong_count||0)*2);
  const d=dailyMeta.get(k)||{},meta=secondaryMeta.get(k)||{};
  focusFull.push([
    String(x.word||'').trim(),score,signals,Number(x.wrong_count||0),
    x.last_wrong||'',x.last_review||'',d.cn||x.cn||meta.cn||'',
    d.root||x.root||meta.root||'',d.root_cn||x.root_cn||''
  ]);
}
focusFull.sort((a,b)=>{
  if(a[1]!==b[1])return b[1]-a[1];
  if(a[3]!==b[3])return b[3]-a[3];
  const ar=String(a[4]||a[5]||''),br=String(b[4]||b[5]||'');
  if(ar!==br)return br.localeCompare(ar);
  return String(a[0]).localeCompare(String(b[0]));
});
const focusExposed=focusFull.slice(0,30);

const listeningFocusFull=[];
for(const x of weakMap.values()){
  const k=key(x&&x.word);if(!k||!dailySet.has(k))continue;
  const reasons=Array.isArray(x.reasons)?x.reasons:[];
  const signals=[];let score=0;
  if(reasons.includes('listening_wrong')){score+=40;signals.push('listening_wrong');}
  if(reasons.includes('listening_slow')){score+=18;signals.push('listening_slow');}
  if(!score)continue;
  const d=dailyMeta.get(k)||{},meta=secondaryMeta.get(k)||{};
  listeningFocusFull.push([
    String(x.word||'').trim(),score,x.status==='mastered'?'mastered':'active',signals,
    d.cn||x.cn||meta.cn||'',d.root||x.root||meta.root||'',d.root_cn||x.root_cn||''
  ]);
}
listeningFocusFull.sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
const listeningFocusExposed=listeningFocusFull.slice(0,40);

const reviewByKey=new Map(reviewFull.map(x=>[key(x[0]),x]));
const mergedReview=[],mergedSeen=new Set();
for(const x of [...focusExposed.map(f=>reviewByKey.get(key(f[0]))).filter(Boolean),...reviewExposed]){
  const k=key(x&&x[0]);if(!k||mergedSeen.has(k))continue;mergedSeen.add(k);mergedReview.push(x);if(mergedReview.length>=60)break;
}
reviewExposed=mergedReview;

const runtime={
  version:4,
  rules_version:Number(rules.version||0),
  generated_at:new Date().toISOString(),
  weakness_updated_at:weakDoc&&weakDoc.updated_at?weakDoc.updated_at:'',
  active_master_pool:activeMasterPool,
  secondary_master_file:'data/master-vocab-secondary.js',
  handoff:{
    phase:handoff.phase,
    committed_secondary:handoff.committed_secondary,
    fill_target:HANDOFF_FILL_TARGET,
    primary_remaining:primaryNewFull.length,
    secondary_available:secondaryNewFull.length,
    switched_at:handoff.switched_at||''
  },
  stats:{
    master_unique:master.length,
    primary_master_unique:master.length,
    secondary_master_unique:secondaryMaster.length,
    secondary_catalog_unique:secondaryCatalog.length,
    weak_active_total:activeMap.size,
    weak_mastered_total:masteredCount,
    daily_taught_unique:dailySet.size,
    primary_taught_unique:primaryTaughtUnique,
    primary_unlearned_total:primaryUnlearnedTotal,
    primary_new_pool_total_full:primaryNewFull.length,
    secondary_new_pool_total_full:secondaryNewFull.length,
    new_pool_total_full:newFull.length,
    new_pool_exposed:newExposed.length,
    review_pool_total_full:reviewFull.length,
    review_pool_exposed:reviewExposed.length,
    focus_pool_total_full:focusFull.length,
    focus_pool_exposed:focusExposed.length,
    listening_focus_pool_total_full:listeningFocusFull.length,
    listening_focus_pool_exposed:listeningFocusExposed.length,
    oral_new_pool_total_full:oralFull.length,
    oral_new_pool_exposed:oralExposed.length
  },
  schema:{
    new_meta:['word','cn'],
    oral:['word','register','counterpart','root','rank'],
    review:['word','priority','wrong_count','last_wrong','last_review','cn','root','root_cn'],
    focus:['word','score','signals','wrong_count','last_wrong','last_review','cn','root','root_cn'],
    listening_focus:['word','score','status','signals','cn','root','root_cn']
  },
  new_pool:newExposed,
  new_meta:newMeta,
  oral_new_pool:oralExposed,
  review_pool:reviewExposed,
  focus_pool:focusExposed,
  listening_focus_pool:listeningFocusExposed
};

fs.writeFileSync('data/learning-runtime.json',JSON.stringify(runtime)+'\n');
const audit={
  generated_at:runtime.generated_at,
  master_unique:master.length,
  primary_new_pool_total:primaryNewFull.length,
  secondary_master_unique:secondaryMaster.length,
  secondary_new_pool_total:secondaryNewFull.length,
  active_master_pool:activeMasterPool,
  handoff:runtime.handoff,
  weak_active_total:activeMap.size,
  weak_mastered_total:masteredCount,
  daily_taught_unique:dailySet.size,
  primary_taught_unique:primaryTaughtUnique,
  primary_unlearned_total:primaryUnlearnedTotal,
  new_pool_total:runtime.stats.new_pool_total_full,
  review_pool_total:runtime.stats.review_pool_total_full,
  focus_pool_total:runtime.stats.focus_pool_total_full,
  listening_focus_pool_total:runtime.stats.listening_focus_pool_total_full,
  oral_new_pool_total:runtime.stats.oral_new_pool_total_full,
  rules:{
    new_pool:'primary first; when primary has 1-9 legal words, expose them first and top up from secondary to keep the 10-word AM contract; after primary reaches 0, secondary handoff is committed and never falls back automatically',
    review_pool:'weak_active ∩ daily_vocab',
    focus_pool:'high-priority subset of weak_active ∩ daily_vocab; automation_fail > quick_wrong > listening_wrong > unknown > dont > fuzzy > listening_slow',
    listening_focus_pool:'auditory weakness overlay for taught words; may include mastered without changing mastered status',
    secondary:'BIPA人工筛选不会/模糊；B2仅S；与977重复永久剔除'
  }
};
fs.writeFileSync('data/learning-pool-audit.json',JSON.stringify(audit,null,2)+'\n');
console.log(runtime.stats,'active_master_pool='+activeMasterPool,'handoff_phase='+handoff.phase);
