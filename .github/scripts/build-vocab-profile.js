const fs=require('fs'),vm=require('vm');
const ctx={window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('data/daily-vocab-data.js','utf8'),ctx,{filename:'data/daily-vocab-data.js'});
const daily=Array.isArray(ctx.window.DAILY_VOCAB_DB)?ctx.window.DAILY_VOCAB_DB:[];
const weakDoc=JSON.parse(fs.readFileSync('data/weakness-sync.json','utf8'));
const runtime=JSON.parse(fs.readFileSync('data/learning-runtime.json','utf8'));
const key=s=>String(s||'').trim().toLowerCase();
const taught=new Map();
for(const x of daily){const k=key(x&&x.word);if(k&&!taught.has(k))taught.set(k,x)}
const weak=weakDoc&&weakDoc.words&&typeof weakDoc.words==='object'?weakDoc.words:{};
let mastered=0,active=0,unverified=0;
for(const k of taught.keys()){
  const s=weak[k];
  if(s&&s.status==='mastered')mastered++;
  else if(s&&s.status==='active')active++;
  else unverified++;
}
const total=taught.size;
if(active!==Number(runtime.stats&&runtime.stats.review_pool_total_full||0))throw new Error(`Profile active mismatch: ${active} != runtime review ${runtime.stats&&runtime.stats.review_pool_total_full}`);
if(total!==Number(runtime.stats&&runtime.stats.daily_taught_unique||0))throw new Error(`Profile taught mismatch: ${total} != runtime taught ${runtime.stats&&runtime.stats.daily_taught_unique}`);
const focus=(Array.isArray(runtime.focus_pool)?runtime.focus_pool:[]).slice(0,8).map(x=>({word:String(x[0]||''),score:Number(x[1]||0),signals:Array.isArray(x[2])?x[2]:[],cn:String(x[6]||'')}));
const out={version:1,generated_at:new Date().toISOString(),source_updated_at:weakDoc.updated_at||'',taught_total:total,confirmed_mastered:mastered,needs_reinforcement:active,unverified,mastery_percent:total?Math.round(mastered/total*1000)/10:0,focus_total:Number(runtime.stats&&runtime.stats.focus_pool_total_full||0),focus_words:focus,definitions:{taught_total:'已正式进入每日学习词库的去重词数',confirmed_mastered:'已正式学习且统一状态为mastered',needs_reinforcement:'已正式学习且统一状态仍为active',unverified:'已正式学习但尚无足够统一状态证据',mastery_percent:'confirmed_mastered / taught_total；仅表示已学词中的确认掌握比例'}};
if(mastered+active+unverified!==total)throw new Error('Profile partition mismatch');
fs.writeFileSync('data/vocab-profile.json',JSON.stringify(out,null,2)+'\n');
console.log(out);
