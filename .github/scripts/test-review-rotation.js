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
