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
const PER_DAY={am_new:10,pm_new:3.5,am_dont:10,pm_dont:1.5,oral:3}; // oral: AM 2 + PM 1 preferred oral new words
// Alert thresholds (report only; they never block anything).
const ALERT={dont_days:5,oral_days:7,transition_days:20,stale_31d:50};
// Soft contract: ~2 oral new words at 08:00, ~1 at 18:00 (rules am_contract/pm_contract). Alert only when clearly above.
const ORAL_GUIDE={am_max:3,pm_max:2,days:7};

function lessonWords(L){
 const s=L.session,out={taught:[],review:[]};
 if(s==='am'){
  for(const v of L.vocab||[])out.taught.push(typeof v==='string'?v:v&&v.word);
  for(const v of L.review_vocab||[])out.review.push(typeof v==='string'?v:v&&v.word);
 }else{
  for(const v of L.vocab||[]){
   const w=typeof v==='string'?v:v&&v.word,g=v&&v.source_group;
   if(g==='application')continue; // same definition as review-rotation.js lastExposureDays: application is not core exposure
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

function oralRunway(runtime){
 const st=runtime.stats||{};
 return {eligible_total:Number(st.oral_new_pool_total_full||0),eligible_dont:Number(st.oral_new_pool_dont_total_full||0),
  est_days:+(Number(st.oral_new_pool_total_full||0)/PER_DAY.oral).toFixed(1),assumption:'AM 2 + PM 1 oral new words per day'};
}

/** Machine vs human commit mix from commit subjects (e.g. `git log --format=%s`). */
function commitStats(subjects){
 const c={machine_runtime_sync:0,lesson:0,reading:0,other:0};
 for(const s of subjects||[]){
  if(/^(Build learning runtime|chore: sync learning weakness|Sync daily lesson vocabulary)/i.test(s))c.machine_runtime_sync++;
  else if(/^(lesson|Lesson release)/i.test(s))c.lesson++;
  else if(/^Publish extensive reading/i.test(s))c.reading++;
  else c.other++;
 }
 const total=(subjects||[]).length;
 return {total,...c,machine_share:total?+(c.machine_runtime_sync/total).toFixed(2):0};
}

/** Oral new words (is_oral_new) per lesson over the last N days, with the share of new words. Soft-contract monitor only. */
function oralUsage({lessons,today}){
 const rows=[];
 for(const l of lessons){
  if(l.date>today||Date.parse(today)-Date.parse(l.date)>ORAL_GUIDE.days*DAY)continue;
  const vocab=(l.vocab||[]).filter(v=>v&&typeof v==='object');
  const isNew=l.session==='am'?vocab:vocab.filter(v=>v.source_group==='new'||v.is_new===true);
  rows.push({date:l.date,session:l.session,new_words:isNew.length,oral_new:isNew.filter(v=>v.is_oral_new===true).length});
 }
 rows.sort((a,b)=>(a.date+a.session).localeCompare(b.date+b.session));
 const tot=rows.reduce((n,x)=>n+x.oral_new,0),newTot=rows.reduce((n,x)=>n+x.new_words,0);
 return {rows,oral_total:tot,new_total:newTot,oral_share:newTot?+(tot/newTot).toFixed(2):0,guideline:'AM ~2, PM ~1 (about 20% of new words)'};
}

function alerts(r){
 const a=[],rw=r.runway,o=r.oral_runway,g=r.review_gap;
 if(rw.est_days_until_dont_exhausted<ALERT.dont_days)a.push(`dont pool runs out in ~${rw.est_days_until_dont_exhausted} days (< ${ALERT.dont_days})`);
 if(o.est_days<ALERT.oral_days)a.push(`oral candidates last ~${o.est_days} days (< ${ALERT.oral_days}): add more candidates or relax the oral quota`);
 if(rw.phase==='primary'&&rw.est_days_until_transition>0&&rw.est_days_until_transition<ALERT.transition_days)a.push(`primary->transition in ~${rw.est_days_until_transition} days`);
 for(const x of (r.oral_usage&&r.oral_usage.rows)||[]){
  const max=x.session==='am'?ORAL_GUIDE.am_max:ORAL_GUIDE.pm_max;
  if(x.oral_new>max)a.push(`${x.date} ${x.session.toUpperCase()}: ${x.oral_new} oral new words of ${x.new_words} (guideline ~${x.session==='am'?2:1}, alert > ${max}): oral candidates will run out sooner`);
 }
 if(g.buckets['31d+']>ALERT.stale_31d)a.push(`${g.buckets['31d+']} active words unseen for 31+ days (> ${ALERT.stale_31d})`);
 return a;
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
  note:'exposure = core lesson appearance (taught, AM review_vocab, PM new/review; PM application excluded, same as the ranking); quick-practice and reading recurrence are not counted'};
}

function buildReport(input){
 const r={
  date:input.today,
  runway:runway(input),
  oral:oralDiagnosis(input),
  oral_runway:oralRunway(input.runtime),
  oral_usage:oralUsage(input),
  review_gap:reviewGap(input),
  commits:commitStats(input.commitSubjects),
  alerts:[]
 };
 r.alerts=alerts(r);
 return r;
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
 L.push('- (eligible_new counts both libraries; runtime.new_pool exposes secondary fuzzy words only in transition/secondary phase, see runtime pool size below)');
 const ow=r.oral_runway;
 L.push(`- eligible new oral words=${ow.eligible_total} (dont ${ow.eligible_dont}), est. ${ow.est_days} days (${ow.assumption})`,'');
 const g=r.review_gap;
 L.push('## 3. Review gap (active + taught words, days since last lesson exposure)',`- active_taught=${g.active_taught}`,
  ...Object.entries(g.buckets).map(([k,v])=>`- ${k}=${v}`),
  `- stalest: ${g.stalest.map(x=>x[0]+'('+x[1]+'d)').join(', ')||'-'}`,`- (${g.note})`,'');
 const ou=r.oral_usage;
 L.push('## 3b. Oral new words per lesson (last '+ORAL_GUIDE.days+' days)',ou.rows.length?'- '+ou.rows.map(x=>x.date.slice(5)+' '+x.session+': '+x.oral_new+'/'+x.new_words).join(' | '):'- no lessons',`- total ${ou.oral_total}/${ou.new_total} new words (${Math.round(ou.oral_share*100)}%), guideline ${ou.guideline}`,'');
 const c=r.commits;
 L.push('## 4. Recent commit mix (git history, last 7 days)',c.total?`- total=${c.total} machine_runtime_sync=${c.machine_runtime_sync} (${Math.round(c.machine_share*100)}%) lesson=${c.lesson} reading=${c.reading} other=${c.other}`:'- unavailable (no git history)','');
 L.push('## Alerts',...(r.alerts.length?r.alerts.map(x=>'- WARNING: '+x):['- none']));
 return L.join('\n');
}

function loadWindow(files,root){
 const ctx={window:{}};vm.createContext(ctx);
 for(const p of files)vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'),ctx,{filename:p});
 return ctx.window;
}

function gitSubjects(root,days){
 try{return require('child_process').execFileSync('git',['log','--since='+days+' days ago','--format=%s'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).split('\n').filter(Boolean)}
 catch(e){return []}
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
  taught:new Set((win.DAILY_VOCAB_DB||[]).map(x=>key(x&&x.word)).filter(Boolean)),
  commitSubjects:gitSubjects(root,7)
 };
}

module.exports={buildReport,format,runway,oralDiagnosis,oralRunway,oralUsage,ORAL_GUIDE,reviewGap,commitStats,alerts,lessonWords,ALERT};

if(require.main===module){
 try{
  const args=process.argv.slice(2),i=args.indexOf('--date');
  const today=i>=0?args[i+1]:new Date().toISOString().slice(0,10);
  const report=buildReport(load(process.cwd(),today));
  console.log(args.includes('--json')?JSON.stringify(report,null,2):format(report));
 }catch(e){console.error('report-learning-health: '+e.message);}
 process.exitCode=0;
}
