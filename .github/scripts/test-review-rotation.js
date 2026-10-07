'use strict';
/** Regression tests for the executable review rotation (recent-4-day cap, focus quota, AM-review application ban). Read-only. */
const assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const {checkPm,rank}=require('./review-rotation');
const clone=x=>JSON.parse(JSON.stringify(x));
const fx=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','review-rotation-2026-10-03.json'),'utf8'));
const ON={enabled:true,effective_date:'2026-09-28'};
const rotation={enabled:true,effective_date:'2026-09-28',lookback_days:7,recent_core:{...ON,window_days:4,max_per_pm:2},focus_quota:{...ON,min:2,max:3},application_am_review:{...ON}};
const history=()=>fx.history.map(h=>h.session==='am'?{date:h.date,session:'am',review_vocab:h.review_vocab}:{date:h.date,session:'pm',vocab:h.review_core.map(word=>({word,source_group:'review'}))});
const runtime=()=>({generated_at:fx.generated_at,review_pool:clone(fx.review_pool),focus_pool:fx.focus_pool.map(w=>[w])});
const codes=r=>r.map(e=>e.code).sort();
const run=(rt,sel)=>checkPm({date:fx.date,runtime:rt,rotation,reviewHistory:history(),review:sel.review,application:sel.application,newWords:sel.new,amReview:fx.same_day_am.review_vocab});
let n=0;const t=(name,fn)=>{try{fn();n++}catch(e){e.message=name+': '+e.message;throw e}};

// A. the real 2026-10-03 selection is rejected for all three reasons while legal alternatives exist.
t('A real Oct-3 selection is rejected',()=>{
 const r=run(runtime(),fx.published_selection);
 assert.deepEqual(codes(r),['PM_APPLICATION_AM_REVIEW_REPEAT','PM_FOCUS_MIX_HIGH','PM_RECENT_CORE_LIMIT']);
});
// A2. the ranker, run on the same inputs, yields a compliant set that the validator accepts.
t('A ranker output passes its own rules on the Oct-3 data',()=>{
 const out=rank({date:fx.date,runtime:runtime(),rotation,reviewHistory:history(),reviewCount:5,amVocab:fx.same_day_am.vocab,amReview:fx.same_day_am.review_vocab});
 assert.equal(out.recommended_review.length,5);
 const d=out.recommended_detail;
 assert.ok(d.filter(x=>x.recent4).length<=2,'recent4 cap');
 assert.ok(d.filter(x=>x.focus).length>=2&&d.filter(x=>x.focus).length<=3,'focus 2-3');
 assert.ok(d.every(x=>!x.blocked&&!x.am_core),'no cooldown / same-day AM core');
 assert.ok(d.filter(x=>x.count>=3).length<=1,'at most one 3+ exposure word');
 assert.ok(out.application_candidates.length>=2&&out.application_candidates.every(x=>!fx.same_day_am.review_vocab.includes(x.word)));
 const rt=runtime(),pool=new Set(rt.review_pool.map(r=>r[0]));
 assert.ok(out.recommended_review.every(w=>pool.has(w)),'only review_pool words');
 const apps=out.application_candidates.slice(0,2).map(x=>x.word);
 assert.deepEqual(run(rt,{review:out.recommended_review,application:apps,new:fx.published_selection.new}),[]);
 // old-focus words are not boosted by stale tags: ranking never gives credit to a wrong older than the last review
 assert.ok(!d.some(x=>x.fresh));
});
// B. a real NEW error (after the latest core review, not after runtime generation) lifts the limits for that word.
t('B new error after last core review releases the cap',()=>{
 const rt=runtime();
 const set=(w,iso)=>{const r=rt.review_pool.find(x=>x[0]===w);r[3]=iso};
 set('upaya','2026-10-02T10:00:00.000Z'); // after 09-29 18:00 PM review, before generated_at
 const sel={review:['upaya','berarti','sebel','bakal','nanggung'],application:['bentuk','kelepasan'],new:fx.published_selection.new};
 const r=run(rt,sel);
 assert.ok(!codes(r).includes('PM_RECENT_CORE_LIMIT'),'upaya fresh => only berarti+sebel count');
 set('layak','2026-10-03T01:30:00.000Z'); // after 08:00 WIB AM review, before generated_at
 const r2=run(rt,{review:['bakal','nanggung','kelepasan','kelewat','beliau'],application:['bentuk','layak'],new:fx.published_selection.new});
 assert.ok(!codes(r2).includes('PM_APPLICATION_AM_REVIEW_REPEAT'),'fresh layak may repeat as application');
});
// C. an OLD wrong answer (before the latest core review, or after runtime generation) never releases anything.
t('C old or future wrong answers do not count as new',()=>{
 const rt=runtime();
 const sel=clone(fx.published_selection);
 assert.ok(codes(run(rt,sel)).includes('PM_RECENT_CORE_LIMIT'));
 rt.review_pool.find(x=>x[0]==='upaya')[3]='2026-09-29T10:00:00.000Z'; // before the 09-29 18:00 review
 rt.review_pool.find(x=>x[0]==='layak')[3]='2026-10-03T00:30:00.000Z'; // before the 08:00 WIB review (01:00Z)
 rt.review_pool.find(x=>x[0]==='sebel')[3]='2026-10-05T00:00:00.000Z'; // after runtime generation: not valid evidence
 const r=run(rt,sel);
 assert.ok(codes(r).includes('PM_RECENT_CORE_LIMIT'));
 assert.ok(codes(r).includes('PM_APPLICATION_AM_REVIEW_REPEAT'));
});
// D. insufficient legal alternatives never forces illegal words nor blocks the release.
t('D scarce alternatives: no deadlock, only legal words',()=>{
 const rt=runtime();
 const keep=new Set(['upaya','bakal','berarti','sebel','ngabarin','bentuk','layak']); // no unused legal word left
 rt.review_pool=rt.review_pool.filter(r=>keep.has(r[0]));
 const r=run(rt,fx.published_selection);
 assert.deepEqual(codes(r),[]);
 const out=rank({date:fx.date,runtime:rt,rotation,reviewHistory:history(),reviewCount:5,amVocab:fx.same_day_am.vocab,amReview:fx.same_day_am.review_vocab});
 const pool=new Set(rt.review_pool.map(r=>r[0]));
 assert.ok(out.recommended_review.every(w=>pool.has(w)));
 assert.ok(out.recommended_review.length<=5);
});
// E. nothing changes before the effective date or when the new rules are absent (old lessons / old fixtures).
t('E rules disabled or not yet effective',()=>{
 const sel=fx.published_selection;
 const old={enabled:true,effective_date:'2026-09-28',lookback_days:7};
 assert.deepEqual(checkPm({date:fx.date,runtime:runtime(),rotation:old,reviewHistory:history(),review:sel.review,application:sel.application,newWords:sel.new,amReview:fx.same_day_am.review_vocab}),[]);
 const future=clone(rotation);for(const k of ['recent_core','focus_quota','application_am_review'])future[k].effective_date='2026-10-04';
 assert.deepEqual(checkPm({date:fx.date,runtime:runtime(),rotation:future,reviewHistory:history(),review:sel.review,application:sel.application,newWords:sel.new,amReview:fx.same_day_am.review_vocab}),[]);
});

// F. stale-word bonus (2026-10-07): ranking only; applies beyond the 7-day window, capped, never beats a fresh error, off without long history.
const {lastExposureDays,staleBonus}=require('./review-rotation');
const rankArgs=lh=>({date:fx.date,runtime:runtime(),rotation,reviewHistory:history(),longHistory:lh,reviewCount:5,amVocab:fx.same_day_am.vocab,amReview:fx.same_day_am.review_vocab});
t('F1 no long history => no stale effect (identical to legacy ranking)',()=>{
 const a=rank(rankArgs(null)),b=rank({...rankArgs(undefined),longHistory:undefined});
 assert.deepEqual(a.recommended_review,b.recommended_review);
 assert.ok(a.ranking_top.every(x=>x.stale_days==null&&!x.reasons.some(r=>r.startsWith('stale_'))));
});
t('F2 bonus curve: 0 inside 7d, grows after, capped at 30 (< fresh error 100)',()=>{
 assert.equal(staleBonus(null),0);assert.equal(staleBonus(7),0);assert.equal(staleBonus(8),1);
 assert.equal(staleBonus(47),30);assert.equal(staleBonus(10000),30);assert.ok(staleBonus(10000)<100);
});
t('F3 lastExposureDays: counts taught/AM review/PM new+review, ignores application and same/future dates',()=>{
 const lh=[
  {date:'2026-08-30',session:'am',vocab:[{word:'Aaa'}],review_vocab:['bbb']},
  {date:'2026-09-20',session:'pm',vocab:[{word:'ccc',source_group:'review'},{word:'ddd',source_group:'application'},{word:'eee',source_group:'new',is_new:true}]},
  {date:fx.date,session:'am',vocab:[{word:'zzz'}]},
 ];
 const m=lastExposureDays(fx.date,lh);
 assert.equal(m.get('aaa'),34);assert.equal(m.get('bbb'),34);assert.equal(m.get('ccc'),13);assert.equal(m.get('eee'),13);
 assert.ok(!m.has('ddd')&&!m.has('zzz'));
});
t('F4 a long-unseen legal word gains exactly its bonus and still obeys every rule',()=>{
 const base=rank(rankArgs(null));
 const target=base.ranking_top.find(x=>!x.blocked&&!x.focus&&x.count===0&&!x.recent4);
 assert.ok(target,'fixture has an unblocked non-focus word');
 const lh=[{date:'2026-08-24',session:'am',vocab:[],review_vocab:[target.word]}];
 const out=rank(rankArgs(lh));
 const after=out.ranking_top.find(x=>x.word===target.word)||out.recommended_detail.find(x=>x.word===target.word);
 assert.equal(after.score-target.score,staleBonus(40));
 assert.equal(after.stale_days,40);
 const rt=runtime(),pool=new Set(rt.review_pool.map(r=>r[0]));
 assert.ok(out.recommended_review.every(w=>pool.has(w)));
 assert.deepEqual(run(rt,{review:out.recommended_review,application:out.application_candidates.slice(0,2).map(x=>x.word),new:fx.published_selection.new}),[]);
});

// G. legacy unverified words (taught, no weakness record, priority 5): ranked by staleness but at most ONE per PM and never an application word.
t('G legacy words: at most one per PM, never application candidates',()=>{
 const rt=runtime();
 rt.review_pool=rt.review_pool.slice(0,30); // smaller pool of normal words so the four legacy words compete for the top
 const legacy=['lga','lgb','lgc','lgd'];
 for(const w of legacy)rt.review_pool.push([w,5,0,'','','cn','','']);
 const lh=legacy.map(w=>({date:'2026-08-24',session:'am',vocab:[],review_vocab:[w]}));
 const out=rank({...rankArgs(lh),runtime:rt});
 const top=out.ranking_top.filter(x=>legacy.includes(x.word));
 assert.equal(top.length,4,'all four legacy words are eligible and ranked');
 assert.ok(top.every(x=>x.stale_days===40&&x.legacy));
 const picked=out.recommended_detail.filter(x=>x.legacy);
 assert.equal(picked.length,1,'exactly one legacy word is taken, got '+picked.length);
 assert.ok(out.recommended_review.length<=5);
 assert.ok(out.application_candidates.every(x=>!legacy.includes(x.word)),'legacy words are not application words');
 const pool=new Set(rt.review_pool.map(r=>r[0]));
 assert.ok(out.recommended_review.every(w=>pool.has(w)));
});

t('G2 legacy cap also holds in the scarce-alternatives fallback (fewer words beat padding with unverified ones)',()=>{
 const rt=runtime();
 rt.review_pool=[...rt.review_pool.slice(0,2)];
 const legacy=['lge','lgf','lgg','lgh','lgi'];
 for(const w of legacy)rt.review_pool.push([w,5,0,'','','cn','','']);
 const out=rank({...rankArgs([]),runtime:rt});
 assert.ok(out.recommended_detail.filter(x=>x.legacy).length<=1,'legacy words in fallback: '+out.recommended_review.join(','));
 assert.ok(out.recommended_review.length<=5);
});

// H. natural recurrence (2026-10-07): pending-review words ranked by how long since they last appeared ANYWHERE in a lesson.
const {naturalRecurrence,lessonText}=require('./review-rotation');
const NR_RT={review_pool:[['alpha',1,0,'','','甲','',''],['beta',2,0,'','','乙','',''],['gamma',3,0,'','','丙','','']],
 recurrence_pool:[['delta',4,'丁'],['eps',5,'戊'],['zeta',4,'己']]};
const nrLesson=(date,session,extra)=>({date,session,vocab:[],review_vocab:[],sentences:[],...extra});
t('H1 text appearances count: a word used in a recent reading drops down, an old one rises',()=>{
 const lh=[
  nrLesson('2026-09-01','am',{vocab:[{word:'alpha'},{word:'beta'},{word:'gamma'},{word:'delta'},{word:'eps'},{word:'zeta'}]}),
  nrLesson('2026-10-05','pm',{reading:{text:'Saya makan Alpha dan zeta setiap hari.'}}), // alpha + zeta reappear in free text
  nrLesson('2026-10-06','am',{dialogue:{lines:[{id:'Beta, kamu di mana?'}]}}),
 ];
 const out=naturalRecurrence({date:'2026-10-07',runtime:NR_RT,longHistory:lh,count:6});
 const d=Object.fromEntries(out.candidates.map(x=>[x.word,x.days_since_any_appearance]));
 assert.deepEqual(d,{alpha:2,beta:1,gamma:36,delta:36,eps:36,zeta:2});
 assert.deepEqual(out.candidates.slice(0,3).map(x=>x.word).sort(),['delta','eps','gamma'],'the three untouched words are the stalest');
 assert.equal(out.pool_size,6);
});
t('H2 exclusions, count, determinism, unknown history, no mastered/outside-pool words',()=>{
 const base={date:'2026-10-07',runtime:NR_RT,longHistory:[]};
 const all=naturalRecurrence({...base,count:50});
 assert.deepEqual(all.candidates.map(x=>x.word).sort(),['alpha','beta','delta','eps','gamma','zeta']);
 assert.ok(all.candidates.every(x=>x.days_since_any_appearance===null),'unknown history is reported as null');
 assert.deepEqual(naturalRecurrence({...base,count:50}).candidates,all.candidates,'deterministic for the same date');
 const ex=naturalRecurrence({...base,count:50,exclude:['ALPHA','Beta']});
 assert.ok(!ex.candidates.some(x=>['alpha','beta'].includes(x.word)));
 assert.equal(naturalRecurrence({...base,count:2}).candidates.length,2);
 assert.ok(!all.candidates.some(x=>x.word==='mastered-word'));
});
t('H3 legacy flag follows priority 5; lessonText covers reading, sentences, dialogue, examples and core lists',()=>{
 assert.equal(naturalRecurrence({date:'2026-10-07',runtime:NR_RT,longHistory:[],count:9}).candidates.find(x=>x.word==='eps').legacy,true);
 const txt=lessonText({reading:{text:'R1'},sentences:['S1',{id:'S2'}],dialogue:{lines:[{id:'D1'}]},vocab:[{word:'W1',example:'E1'}],review_vocab:['V1']});
 for(const x of ['r1','s1','s2','d1','e1','w1','v1'])assert.ok(txt.includes(x),x);
});

// L. Exposure ledger (2026-10-08): application counts as an active exposure; 3-day streaks cool down; fresh-error quota.
// Real case behind it: nggak heran was a PM application on 10-04, 10-05, 10-06 and became a core review on 10-07.
{
const {checkExposure,rank:rankL}=require('./review-rotation');
const LEDGER={enabled:true,effective_date:'2026-10-08',recent_active_lessons:2,streak_days:3,fresh_error_cap:{min:2,max:3,min_due:3},hard_word_wrong_count:3};
const rotL={...rotation,exposure_ledger:LEDGER};
const POOL=['nggak heran','ngerjain','mengatur','keberatan','menurut','biar','a1','a2','a3','a4','a5','a6','a7','a8','am1','am2'];
const rtL=(over={})=>({generated_at:'2026-10-10T10:00:00.000Z',review_pool:POOL.map(w=>[w,1,over[w]&&over[w].wrongs||1,over[w]&&over[w].wrong||'2026-09-29T10:00:00.000Z','','中','','']),focus_pool:[]});
const amL=(date,review=[],extra={})=>({date,session:'am',vocab:[],review_vocab:review,...extra});
const pmL=(date,groups={},extra={})=>({date,session:'pm',vocab:Object.entries(groups).flatMap(([g,ws])=>ws.map(word=>({word,source_group:g}))),...extra});
// 10-07..10-09 history: nggak heran is application on 10-07 and 10-08 PM (two nights in a row).
const histApp=()=>[amL('2026-10-07'),pmL('2026-10-07',{application:['nggak heran']}),amL('2026-10-08'),pmL('2026-10-08',{application:['nggak heran']}),amL('2026-10-09',[],{vocab:[{word:'am1'},{word:'am2'}]})];
const exp=(sel,hist,rt=rtL(),date='2026-10-09',session='pm')=>checkExposure({date,session,runtime:rt,rotation:rotL,reviewHistory:hist,review:sel.review||[],application:sel.application||[],newWords:sel.new||[],amVocab:sel.amVocab||[]});
t('L1 an application last night blocks tonight\'s core review (the nggak heran case)',()=>{
 const r=exp({review:['nggak heran','a1','a2','a3'],application:['am1','am2']},histApp());
 assert.deepEqual(codes(r),['PM_EXPOSURE_COOLDOWN']);
 assert.match(r[0].detail,/nggak heran\(.*active_last_2_lessons/);
});
t('L2 the same word cannot take a third application card either; today\'s AM new words stay allowed',()=>{
 assert.deepEqual(codes(exp({review:['a1','a2','a3','a4'],application:['nggak heran','am1']},histApp())),['PM_APPLICATION_EXPOSURE_COOLDOWN']);
 assert.deepEqual(exp({review:['a1','a2','a3','a4'],application:['am1','am2'],amVocab:['am1','am2']},histApp()),[]);
});
t('L3 a fresh real error after the last ACTIVE exposure (application included) releases the word',()=>{
 const after=rtL({'nggak heran':{wrong:'2026-10-08T12:00:00.000Z'}}); // 19:00 WIB, after the 18:00 application
 assert.deepEqual(exp({review:['nggak heran','a1','a2','a3'],application:['am1','am2']},histApp(),after),[]);
 const before=rtL({'nggak heran':{wrong:'2026-10-08T10:30:00.000Z'}}); // 17:30 WIB, before that application: not new
 assert.deepEqual(codes(exp({review:['nggak heran','a1','a2','a3'],application:['am1','am2']},histApp(),before)),['PM_EXPOSURE_COOLDOWN']);
});
t('L4 three days in a row in any form (with one active exposure) is blocked; a pure-text streak is not',()=>{
 const hist=[amL('2026-10-07'),pmL('2026-10-07',{application:['ngerjain']}),amL('2026-10-08'),pmL('2026-10-08',{},{reading:{text:'Aku lagi ngerjain PR, biar cepat.'}}),amL('2026-10-09',[],{reading:{text:'Biar aman, kita pulang.'}})];
 const r=exp({review:['ngerjain','a1','a2','a3'],application:['am1','am2']},hist);
 assert.deepEqual(codes(r),['PM_EXPOSURE_COOLDOWN']);assert.match(r[0].detail,/ngerjain\(streak_3_days\)/);
 const hist2=[amL('2026-10-07',[],{reading:{text:'biar'}}),pmL('2026-10-07',{},{reading:{text:'biar'}}),amL('2026-10-08',[],{reading:{text:'biar'}}),pmL('2026-10-08',{},{reading:{text:'biar'}}),amL('2026-10-09',[],{reading:{text:'biar'}})];
 assert.deepEqual(exp({review:['biar','a1','a2','a3'],application:['am1','am2']},hist2),[],'everyday text words are never locked out of review');
});
t('L5 no deadlock: blocked words are allowed when legal alternatives are insufficient',()=>{
 const rt=rtL();rt.review_pool=rt.review_pool.filter(r=>['nggak heran','a1','a2','a3','am1','am2'].includes(r[0]));
 assert.deepEqual(exp({review:['nggak heran','a1','a2','a3'],application:['am1','am2']},histApp(),rt),[]);
});
t('L6 ledger off (absent or before 2026-10-08) changes nothing',()=>{
 const sel={review:['nggak heran','a1','a2','a3'],application:['nggak heran']};
 assert.deepEqual(checkExposure({date:'2026-10-09',session:'pm',runtime:rtL(),rotation,reviewHistory:histApp(),...sel,newWords:[]}),[]);
 assert.deepEqual(checkExposure({date:'2026-10-07',session:'pm',runtime:rtL(),rotation:rotL,reviewHistory:histApp(),...sel,newWords:[]}),[]);
 const off=rankL({date:'2026-10-09',runtime:rtL(),rotation,reviewHistory:histApp(),reviewCount:5});
 assert.deepEqual(off.avoid_in_text,[]);assert.equal(off.counts.fresh_error_cap,null);
});
t('L7 ranking: never recommends a cooling word, lists it in avoid_in_text, and passes its own checks (AM and PM)',()=>{
 const out=rankL({date:'2026-10-09',runtime:rtL(),rotation:rotL,reviewHistory:histApp(),reviewCount:5,amVocab:['am1','am2']});
 assert.ok(!out.recommended_review.includes('nggak heran'));
 assert.ok(!out.application_candidates.some(x=>x.word==='nggak heran'));
 assert.deepEqual(out.avoid_in_text,['nggak heran']);
 const apps=out.application_candidates.slice(0,2).map(x=>x.word);
 assert.deepEqual(apps,['am1','am2'],'today\'s AM new words lead the application list');
 assert.deepEqual(exp({review:out.recommended_review,application:apps,amVocab:['am1','am2']},histApp()),[]);
 const amHist=histApp().slice(0,4); // tomorrow-morning view: last two lessons are 10-08 AM and 10-08 PM
 const amOut=rankL({date:'2026-10-09',session:'am',runtime:rtL(),rotation:rotL,reviewHistory:amHist,reviewCount:5});
 assert.equal(amOut.session,'am');assert.ok(!amOut.recommended_review.includes('nggak heran'));assert.deepEqual(amOut.application_candidates,[]);
 assert.deepEqual(exp({review:amOut.recommended_review},amHist,rtL(),'2026-10-09','am'),[]);
 assert.deepEqual(codes(exp({review:['nggak heran','a1','a2','a3']},amHist,rtL(),'2026-10-09','am')),['AM_EXPOSURE_COOLDOWN']);
});
t('L8 fresh-error quota: at most 2 of 5 (3 of 6) go to errors, the rest to due words; extras are deferred, hard words flagged',()=>{
 const over={};for(const w of ['a1','a2','a3','a4'])over[w]={wrong:'2026-10-09T12:00:00.000Z'}; // all after any exposure
 over.a1.wrongs=4;
 const hist=[amL('2026-10-08'),pmL('2026-10-08',{review:['a1','a2','a3','a4']}),amL('2026-10-09')];
 const five=rankL({date:'2026-10-09',runtime:rtL(over),rotation:rotL,reviewHistory:hist,reviewCount:5});
 assert.equal(five.recommended_detail.filter(x=>x.fresh).length,2);assert.equal(five.counts.fresh_error_cap,2);
 assert.equal(five.recommended_review.length,5);assert.equal(five.fresh_errors_deferred.length,2);
 const six=rankL({date:'2026-10-09',runtime:rtL(over),rotation:rotL,reviewHistory:hist,reviewCount:6});
 assert.equal(six.recommended_detail.filter(x=>x.fresh).length,3);
 assert.ok(five.recommended_detail.find(x=>x.word==='a1').hard,'4 wrongs => hard word');
 const legacy=rankL({date:'2026-10-09',runtime:rtL(over),rotation,reviewHistory:hist,reviewCount:5});
 assert.equal(legacy.recommended_detail.filter(x=>x.fresh).length,4,'without the ledger the old behaviour (errors first, no cap) is kept');
});
t('L9 a recent training error on a word with no lesson exposure in 7 days joins the error pool (ledger only)',()=>{
 const over={a5:{wrong:'2026-10-07T03:00:00.000Z'},a6:{wrong:'2026-09-20T03:00:00.000Z'}};
 const hist=[amL('2026-10-08'),pmL('2026-10-08',{review:['a1']}),amL('2026-10-09')];
 const on=rankL({date:'2026-10-09',runtime:rtL(over),rotation:rotL,reviewHistory:hist,reviewCount:5});
 assert.ok(on.recommended_detail.find(x=>x.word==='a5').fresh,'wrong 2 days ago, never re-practised => fresh');
 assert.ok(!on.ranking_top.find(x=>x.word==='a6').fresh,'wrong outside the 7-day window => not fresh');
 const off=rankL({date:'2026-10-09',runtime:rtL(over),rotation,reviewHistory:hist,reviewCount:5});
 assert.ok(!off.ranking_top.find(x=>x.word==='a5').fresh,'legacy semantics unchanged without the ledger');
});
}

// Integration through the real validator() using the shared PM fixture of test-lesson-candidate.js.
module.exports=function integration(makePm,validate){
 const day='2026-09-28';
 const base=()=>{
  const x=makePm();
  x.rules.review_rotation={enabled:true,effective_date:day,lookback_days:7,recent_core:{...ON,window_days:4,max_per_pm:2},focus_quota:{enabled:true,effective_date:day,min:2,max:3},application_am_review:{...ON}};
  x.sameDayAm.review_vocab=[];
  x.reviewHistory=[{date:'2026-09-27',session:'am',review_vocab:[]},{date:'2026-09-27',session:'pm',vocab:['review1','review2','review3'].map(word=>({word,source_group:'review'}))},{...x.sameDayAm,review_vocab:[]}];
  return x;
 };
 const withAlts=n=>{const x=base();const alts=Array.from({length:n},(_,i)=>'alt'+i);x.runtime.review_pool=x.runtime.review_pool.concat(alts.map(w=>[w]));return x};
 const bad=(name,x,code)=>{const r=validate(x);assert.ok(!r.ok&&r.errors.some(e=>e.code===code),name+' expected '+code+' got '+JSON.stringify(r.errors));n++};
 const ok=(name,x)=>{const r=validate(x);assert.ok(r.ok,name+' '+JSON.stringify(r.errors));n++};
 bad('validator rejects 3 recent-4-day core words when alternatives exist',withAlts(5),'PM_RECENT_CORE_LIMIT');
 ok('validator accepts scarce alternatives (no deadlock)',base());
 {const x=withAlts(5);const c=x.lesson.vocab.find(v=>v.word==='review3');c.word=c.display=c.audio_text='alt0';ok('validator accepts 2 recent + 1 alternative',x)}
 {const x=withAlts(5);x.runtime.focus_pool=['review0','review1','review2','review4'].map(w=>[w,50,['dont']]);x.reviewHistory[1].vocab=[];bad('validator rejects 4 focus words when non-focus alternatives exist',x,'PM_FOCUS_MIX_HIGH')}
 {const x=withAlts(5);x.reviewHistory[1].vocab=[];x.sameDayAm.review_vocab=['app0'];x.reviewHistory[2].review_vocab=['app0'];bad('validator rejects application repeating the 08:00 review core',x,'PM_APPLICATION_AM_REVIEW_REPEAT')}
 return n;
};
const standalone=n;
module.exports.standalone=standalone;
