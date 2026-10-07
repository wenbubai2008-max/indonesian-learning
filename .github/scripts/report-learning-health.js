'use strict';
/**
 * Read-only learning health report. Never writes data, never blocks (always exit 0).
 * Answers three questions with official numbers instead of estimates:
 *  1. pool runway  - how many days until new_pool_dont runs out / primary hands off to secondary
 *  2. oral pool    - why oral_new_pool is empty (where each oral candidate is stuck)
 *  3. review gap   - how long active+taught words have gone without any lesson exposure
 * Usage: node .github/scripts/report-learning-health.js [--json] [--date YYYY-MM-DD]
 */
const fs=require('fs'),vm=require('vm'),path=require('path');
const key=s=>String(s==null?'':s).trim().toLowerCase();
const DAY=86400000;
// contract per-day consumption (AM 10 new; PM 3-4 new, default 2 fuzzy + 1-2 dont)
const PER_DAY={am_new:10,pm_new:3.5,am_dont:10,pm_dont:1.5};

function lessonWords(L){
 const s=L.session,out={taught:[],review:[]};
 if(s==='am'){
  for(const v of L.vocab||[])out.taught.push(typeof v==='string'?v:v&&v.word);
  for(const v of L.review_vocab||[])out.review.push(typeof v==='string'?v:v&&v.word);
 }else{
  for(const v of L.vocab||[]){
   const w=typeof v==='string'?v:v&&v.word,g=v&&v.source_group;
   (g==='new'||(v&&v.is_new===true)?out.taught:out.review).push(w);
  }
 }
 return out;
}

function runway({runtime,lessons,today}){
 const st=runtime.stats||{},h=runtime.handoff||{};
 const primary=Number(h.primary_remaining||0),dont=Number(st.new_pool_dont_total_full||0),fuzzy=Number(st.new_pool_fuzzy_total_full||0);
 const perDay=PER_DAY.am_new+PER_DAY.pm_new,perDayDont=PER_DAY.am_dont+PER_DAY.pm_dont;
 const recent=lessons.filter(l=>l.date<=today&&Date.parse(today)-Date.parse(l.date)<=14*DAY);
 const days=new Set(recent.map(l=>l.date));
 const taught=recent.reduce((n,l)=>n+lessonWords(l).taught.length,0);
 return {
  phase:h.phase||'',primary_remaining:primary,secondary_available:Number(h.secondary_available||0),
  new_pool_dont:dont,new_pool_fuzzy:fuzzy,
  observed_new_per_day_14d:days.size?+(taught/days.size).toFixed(1):0,
  est_days_until_dont_exhausted:+(dont/perDayDont).toFixed(1),
  est_days_until_transition:primary>=10?+((primary-9)/perDay).toFixed(1):0,
  est_days_until_primary_exhausted:+(primary/perDay).toFixed(1),
  assumptions:'AM 10 new (all dont if available) + PM 3.5 new (1.5 dont); estimate only, ignores cross-day dedup'
 };
}

function oralDiagnosis({oral,primary,secondary,taught,weak}){
 const prim=new Set(primary.map(key)),sec=new Set(secondary.map(key));
 const b={total:0,taught:0,mastered:0,not_active:0,not_in_primary_or_secondary:0,eligible_new:0};
 const examples={taught:[],mastered:[],not_active:[],not_in_primary_or_secondary:[],eligible_new:[]};
 const note=(k,w)=>{b[k]++;if(examples[k].length<5)examples[k].push(w)};
 const seen=new Set();
 for(const o of oral){
  const w=o&&o.word,k=key(w);if(!k||seen.has(k))continue;seen.add(k);b.total++;
  if(taught.has(k))note('taught',w);
  else if(weak.get(k)&&weak.get(k).status==='mastered')note('mastered',w);
  else if(!prim.has(k)&&!sec.has(k))note('not_in_primary_or_secondary',w);
  else if(!weak.get(k)||weak.get(k).status!=='active')note('not_active',w);
  else note('eligible_new',w);
 }
 return {buckets:b,examples};
}

function reviewGap({taught,weak,lessons,today}){
 const last=new Map();
 for(const l of lessons){
  if(l.date>today)continue;
  const w=lessonWords(l);
  for(const x of [...w.taught,...w.review]){const k=key(x);if(!k)continue;if(!last.has(k)||last.get(k)<l.date)last.set(k,l.date)}
 }
 const b={'0-7d':0,'8-14d':0,'15-30d':0,'31d+':0,no_lesson_record:0};
 let active=0;const stale=[];
 for(const k of taught){
  const x=weak.get(k);if(!x||x.status!=='active')continue;active++;
  const d=last.get(k);
  if(!d){b.no_lesson_record++;continue}
  const age=Math.round((Date.parse(today)-Date.parse(d))/DAY);
  if(age<=7)b['0-7d']++;else if(age<=14)b['8-14d']++;else if(age<=30)b['15-30d']++;else{b['31d+']++;stale.push([x.word,age])}
 }
 stale.sort((a,b)=>b[1]-a[1]);
 return {active_taught:active,buckets:b,stalest:stale.slice(0,10),
  note:'exposure = any lesson appearance (taught, AM review_vocab, PM review/application); quick-practice and reading recurrence are not counted'};
}

function buildReport(input){
 return {
  date:input.today,
  runway:runway(input),
  oral:oralDiagnosis(input),
  review_gap:reviewGap(input)
 };
}

function format(r){
 const L=[`# Learning health report ${r.date}`,''];
 const a=r.runway;
 L.push('## 1. Pool runway',
  `- phase=${a.phase} primary_remaining=${a.primary_remaining} secondary_available=${a.secondary_available}`,
  `- new_pool_dont=${a.new_pool_dont} new_pool_fuzzy=${a.new_pool_fuzzy}`,
  `- observed new words/day (14d)=${a.observed_new_per_day_14d}`,
  `- est. days until dont exhausted=${a.est_days_until_dont_exhausted}, until transition (<10 primary left)=${a.est_days_until_transition}, until primary exhausted=${a.est_days_until_primary_exhausted}`,
  `- (${a.assumptions})`,'');
 const o=r.oral;
 L.push('## 2. Oral candidate pool',...Object.entries(o.buckets).map(([k,v])=>`- ${k}=${v}`));
 for(const [k,v] of Object.entries(o.examples))if(v.length)L.push(`  - ${k} e.g. ${v.join(', ')}`);
 L.push('');
 const g=r.review_gap;
 L.push('## 3. Review gap (active + taught words, days since last lesson exposure)',`- active_taught=${g.active_taught}`,
  ...Object.entries(g.buckets).map(([k,v])=>`- ${k}=${v}`),
  `- stalest: ${g.stalest.map(x=>x[0]+'('+x[1]+'d)').join(', ')||'-'}`,`- (${g.note})`);
 return L.join('\n');
}

function loadWindow(files,root){
 const ctx={window:{}};vm.createContext(ctx);
 for(const p of files)vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'),ctx,{filename:p});
 return ctx.window;
}

function load(root,today){
 const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
 const runtime=read('data/learning-runtime.json');
 const win=loadWindow(['data/master-vocab-data.js','data/master-vocab-data-2.js','data/master-vocab-data-3.js','data/oral-vocab-candidates.js','data/daily-vocab-data.js','data/master-vocab-secondary.js'],root);
 const wdoc=read('data/weakness-sync.json');
 const weak=new Map();
 for(const x of Object.values(wdoc.words||{}))if(x&&x.word)weak.set(key(x.word),x);
 const dir=path.join(root,'data/daily');
 const lessons=fs.readdirSync(dir).filter(f=>/^\d{4}-\d{2}-\d{2}-(am|pm)\.json$/.test(f)).sort()
  .map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')));
 return {
  runtime,today,weak,lessons,
  oral:win.ORAL_VOCAB_CANDIDATES||[],
  primary:(win.MASTER_VOCAB_DB||[]).map(x=>Array.isArray(x)?x[0]:x&&x.word),
  secondary:(win.SECONDARY_MASTER_VOCAB_DB||[]).map(x=>x&&x.word),
  taught:new Set((win.DAILY_VOCAB_DB||[]).map(x=>key(x&&x.word)).filter(Boolean))
 };
}

module.exports={buildReport,format,runway,oralDiagnosis,reviewGap,lessonWords};

if(require.main===module){
 try{
  const args=process.argv.slice(2),i=args.indexOf('--date');
  const today=i>=0?args[i+1]:new Date().toISOString().slice(0,10);
  const report=buildReport(load(process.cwd(),today));
  console.log(args.includes('--json')?JSON.stringify(report,null,2):format(report));
 }catch(e){console.error('report-learning-health: '+e.message);}
 process.exitCode=0;
}
