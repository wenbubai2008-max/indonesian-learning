const fs=require('fs'),vm=require('vm');

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

const dailySet=new Set(dailyRaw.map(x=>key(x&&x.word)).filter(Boolean));
const dailyMeta=new Map(dailyRaw.map(x=>[key(x&&x.word),x]).filter(([k])=>k));
const weakMap=new Map();for(const x of weakWords){const k=key(x&&x.word);if(k)weakMap.set(k,x)}
const activeMap=new Map([...weakMap].filter(([,x])=>x&&x.status==='active'));
const masteredCount=[...weakMap.values()].filter(x=>x&&x.status==='mastered').length;

const newFull=master.filter(w=>activeMap.has(key(w))&&!dailySet.has(key(w)));
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
const newMeta=newExposed.map(w=>[w,(masterMeta.get(key(w))||{}).cn||'']);

const reviewFull=[];
for(const x of activeMap.values()){
  const k=key(x.word);if(!dailySet.has(k))continue;
  const reasons=Array.isArray(x.reasons)?x.reasons:[];
  // Agreed order: recent wrong / taught word re-marked unknown > memory_dont > memory_fuzzy > other active.
  // Do not make an old last_wrong timestamp permanently priority 1 by itself.
  let p=4;
  if(reasons.includes('quick_wrong')||reasons.includes('manual_unknown'))p=1;
  else if(reasons.includes('memory_dont'))p=2;
  else if(reasons.includes('memory_fuzzy'))p=3;
  const d=dailyMeta.get(k)||{};
  reviewFull.push([
    String(x.word||'').trim(),p,Number(x.wrong_count||0),x.last_wrong||'',x.last_review||'',
    d.cn||x.cn||'',d.root||x.root||'',d.root_cn||x.root_cn||''
  ]);
}
reviewFull.sort((a,b)=>{
  if(a[1]!==b[1])return a[1]-b[1];
  if(a[2]!==b[2])return b[2]-a[2];
  if(a[1]===1&&String(a[3]||'')!==String(b[3]||''))return String(b[3]||'').localeCompare(String(a[3]||''));
  const ar=String(a[4]||''),br=String(b[4]||'');
  if(ar!==br)return ar.localeCompare(br); // never/older reviewed first
  return String(a[0]).localeCompare(String(b[0]));
});
const reviewExposed=reviewFull.slice(0,60);

const runtime={
  version:4,
  rules_version:Number(rules.version||0),
  generated_at:new Date().toISOString(),
  weakness_updated_at:weakDoc&&weakDoc.updated_at?weakDoc.updated_at:'',
  stats:{
    master_unique:master.length,
    weak_active_total:activeMap.size,
    weak_mastered_total:masteredCount,
    daily_taught_unique:dailySet.size,
    new_pool_total_full:newFull.length,
    new_pool_exposed:newExposed.length,
    review_pool_total_full:reviewFull.length,
    review_pool_exposed:reviewExposed.length,
    oral_new_pool_total_full:oralFull.length,
    oral_new_pool_exposed:oralExposed.length
  },
  schema:{
    new_meta:['word','cn'],
    oral:['word','register','counterpart','root','rank'],
    review:['word','priority','wrong_count','last_wrong','last_review','cn','root','root_cn']
  },
  new_pool:newExposed,
  new_meta:newMeta,
  oral_new_pool:oralExposed,
  review_pool:reviewExposed
};

fs.writeFileSync('data/learning-runtime.json',JSON.stringify(runtime)+'\n');
console.log(runtime.stats);
