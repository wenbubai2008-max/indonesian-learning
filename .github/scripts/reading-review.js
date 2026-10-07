#!/usr/bin/env node
'use strict';
/**
 * Read-only: the daily review-word list for the 12:00 extensive reading.
 *
 * Learned-but-not-mastered words (runtime.focus_pool > runtime.review_pool > runtime.recurrence_pool) ranked so the
 * reading can re-use them, and so the same weak word comes back every few days in a DIFFERENT scene:
 *   score = tier weight + days since the word last appeared anywhere (lessons AND extensive readings, capped at 30)
 *           + a spacing bonus for words seen in exactly one reading 3-10 days ago (second exposure, new scene)
 *           - a penalty for words already used in a reading in the last 2 days.
 * Passive reading exposure never counts as core review, never changes eligibility, cooling or mastery.
 *
 * Usage: node .github/scripts/reading-review.js --date YYYY-MM-DD [--count 40] [--root dir]
 */
const fs=require('fs'),path=require('path'),vm=require('vm');
const {lessonText,word,norm}=require('./review-rotation');

const DAY=86400000;
const TIER_WEIGHT={focus:40,review:20,legacy:10,recurrence:0};
const UNKNOWN_DAYS=45;

const reEsc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
/** Whole-word match that also accepts the clitics -nya/-lah/-kah/-pun/-ku/-mu (a reading may write "bebasnya"). */
function wordRegex(w){return new RegExp('(^|[^a-z])'+reEsc(w)+'(-?(nya|lah|kah|pun|ku|mu))?([^a-z]|$)','i');}

/** All Indonesian text of an extensive-reading article: body, dialogue lines and declared review words. Lower-cased. */
function readingText(a){
 const t=[];
 if(a&&a.text)t.push(a.text);
 const lines=a&&a.dialogue&&Array.isArray(a.dialogue.lines)?a.dialogue.lines:[];
 for(const l of lines)t.push((l&&l.text)||'');
 for(const r of (a&&a.review_words)||[])t.push(word(r));
 return t.join(' \n ').toLowerCase();
}

function loadWindowVar(file,name){
 const sandbox={window:Object.create(null)};
 vm.createContext(sandbox,{codeGeneration:{strings:false,wasm:false}});
 new vm.Script(fs.readFileSync(file,'utf8'),{filename:file}).runInContext(sandbox,{timeout:1000});
 return sandbox.window[name];
}

/** Current article + every archived article listed in the history index. Missing archives are skipped. */
function loadReadings(root){
 const out=[];
 const cur=path.join(root,'data/extensive-reading-data.js'),idx=path.join(root,'data/extensive-reading-history.js');
 if(fs.existsSync(cur))for(const a of loadWindowVar(cur,'EXTENSIVE_READING_DB')||[])if(a)out.push(a);
 if(fs.existsSync(idx))for(const m of loadWindowVar(idx,'EXTENSIVE_READING_HISTORY_INDEX')||[]){
  const p=m&&m.path&&path.join(root,m.path);
  if(!p||!fs.existsSync(p)||out.some(x=>x.id===m.id))continue;
  try{const a=loadWindowVar(p,'EXTENSIVE_READING_ARCHIVE_ITEM');if(a)out.push(a)}catch(e){}
 }
 return out;
}

function loadLessons(root,date){
 const index=JSON.parse(fs.readFileSync(path.join(root,'data/daily/index.json'),'utf8'));
 const out=[];
 for(const d of index.dates||[]){
  if(!(d.date<=date))continue;
  for(const s of ['am','pm'])if(d[s]){
   try{const L=JSON.parse(fs.readFileSync(path.join(root,'data/daily',d.date+'-'+s+'.json'),'utf8'));out.push({...L,date:L.date||d.date,session:s})}catch(e){}
  }
 }
 return out;
}

/** Colloquial words (register 口语 or with an oral counterpart) fit best in the short dialogue, not in news prose. */
function oralSet(root){
 const f=path.join(root,'data/oral-vocab-candidates.js');
 const s=new Set();
 if(!fs.existsSync(f))return s;
 for(const x of loadWindowVar(f,'ORAL_VOCAB_CANDIDATES')||[]){
  if(!x||!x.word)continue;
  if(x.register==='口语')s.add(norm(x.word));
  if(x.register==='口语'&&x.oral)s.add(norm(x.oral));
 }
 return s;
}

/**
 * Pure ranking. `lessons` are lesson JSONs ({date, session, ...}); `readings` are extensive-reading articles.
 * Everything dated after `date` is ignored; a reading dated `date` itself is ignored too (it is the one being written).
 */
function readingReview({date,runtime,lessons=[],readings=[],oral=new Set(),count=40}){
 const at=Date.parse(date+'T00:00:00Z');
 const age=d=>Math.round((at-Date.parse(d+'T00:00:00Z'))/DAY);
 const rows=new Map();
 const add=(w,tier,priority,cn)=>{if(!w||rows.has(w))return;rows.set(w,{word:w,tier,priority,cn:String(cn||'')})};
 for(const v of runtime.focus_pool||[])add(word(v),'focus',1,v[6]||v[8]);
 for(const v of runtime.review_pool||[]){const p=Number(v[1]);add(word(v),p===5?'legacy':'review',p,v[5]||v[7])}
 for(const v of runtime.recurrence_pool||[])add(word(v),'recurrence',Number(v[1]),v[2]);
 const res=[...rows.values()].map(r=>[r,wordRegex(r.word)]);

 const lastAny=new Map(),lastReading=new Map(),reading14=new Map();
 const seen=(m,w,a)=>{if(!m.has(w)||a<m.get(w))m.set(w,a)};
 for(const L of lessons){
  if(!L||!L.date||L.date>date)continue;
  const text=lessonText(L),a=age(L.date);
  for(const [r,re] of res)if(re.test(text))seen(lastAny,r.word,a);
 }
 for(const A of readings){
  if(!A||!A.date||!(A.date<date))continue;
  const text=readingText(A),a=age(A.date);
  for(const [r,re] of res)if(re.test(text)){
   seen(lastAny,r.word,a);
   const prev=lastReading.get(r.word);
   if(!prev||a<prev.days)lastReading.set(r.word,{days:a,date:A.date,title:A.title_cn||A.title||'',category:A.category||''});
   if(a<=14)reading14.set(r.word,(reading14.get(r.word)||0)+1);
  }
 }

 const hash=x=>{let h=0;for(const c of x+date)h=(h*31+c.charCodeAt(0))>>>0;return h};
 const scored=[...rows.values()].map(r=>{
  const d=lastAny.has(r.word)?lastAny.get(r.word):null;
  const lr=lastReading.get(r.word)||null,n14=reading14.get(r.word)||0;
  let score=TIER_WEIGHT[r.tier]+Math.min(d==null?UNKNOWN_DAYS:d,30);
  const second_scene=!!(lr&&n14===1&&lr.days>=3&&lr.days<=10);
  if(second_scene)score+=8;
  const too_recent=!!(lr&&lr.days<=2);
  if(too_recent)score-=40;
  const isOral=oral.has(r.word)||/口语/.test(r.cn)||/^(nggak|gak|udah|lagi) /.test(r.word);
  return {word:r.word,cn:r.cn,tier:r.tier,priority:r.priority,oral:isOral,
   days_since_any_appearance:d,readings_14d:n14,last_reading:lr,second_scene,too_recent,score};
 }).sort((a,b)=>b.score-a.score||a.priority-b.priority||hash(a.word)-hash(b.word)||a.word.localeCompare(b.word));

 const candidates=scored.slice(0,count);
 // keep at least 8 focus words visible even when long-unseen review words outscore them
 const focusShown=candidates.filter(x=>x.tier==='focus').length;
 if(focusShown<8)for(const x of scored){if(candidates.filter(y=>y.tier==='focus').length>=8)break;if(x.tier==='focus'&&!candidates.includes(x)&&!x.too_recent)candidates.push(x)}
 const oralExtra=scored.filter(x=>x.oral&&!x.too_recent&&!candidates.includes(x)).slice(0,6);
 return {date,pool_size:rows.size,count:candidates.length,
  target:{review_words:'8-12',focus_min:3,dialogue_oral:'1-3'},
  candidates,oral_for_dialogue:oralExtra,
  guidance:'Pick 8-12 candidates (at least 3 tier=focus) that fit the chosen news story naturally; earlier entries first. '+
   'Prefer a different scene from last_reading. Put oral=true words in the dialogue. Do not distort facts to fit a word. '+
   'This is passive recurrence: it never counts as core review and never changes eligibility, cooling or mastery.'};
}

function cli(argv){const a={};for(let i=0;i<argv.length;i++){if(!argv[i].startsWith('--')||argv[i+1]==null)throw Error('Expected --key value');a[argv[i++].slice(2)]=argv[i]}return a}
function main(argv){
 const a=cli(argv);if(!a.date||!/^\d{4}-\d{2}-\d{2}$/.test(a.date))throw Error('--date YYYY-MM-DD required');
 const root=path.resolve(a.root||'.');
 const runtime=JSON.parse(fs.readFileSync(path.join(root,'data/learning-runtime.json'),'utf8'));
 return readingReview({date:a.date,runtime,lessons:loadLessons(root,a.date),readings:loadReadings(root),oral:oralSet(root),count:Number(a.count)||40});
}
if(require.main===module){try{console.log(JSON.stringify(main(process.argv.slice(2)),null,2))}catch(e){console.error(JSON.stringify({ok:false,error:e.message}));process.exitCode=2}}
module.exports={readingReview,readingText,wordRegex,loadReadings,loadLessons,oralSet,loadWindowVar,main};
