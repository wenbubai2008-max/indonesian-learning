'use strict';
// 2026-10-14: review-cycle mode (user decision). When fewer than 10 legal new words remain, the 08:00 lesson teaches
// every remaining new word and fills its other cards with cycle_vocab words; when fewer than 3 remain for 18:00, the PM
// teaches all of them and grows its review group (4-9). Normal lessons must behave exactly as before.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..','..'),read=f=>JSON.parse(fs.readFileSync(path.join(repo,f),'utf8'));
const {validate}=require('./validate-lesson-candidate');
const {rank,activeWords}=require('./review-rotation');
const clone=x=>JSON.parse(JSON.stringify(x));
const index=read('data/daily/index.json'),rules=read('data/learning-pool-rules.json'),baseRuntime=read('data/learning-runtime.json');
const codes=r=>new Set(r.errors.map(e=>e.code));
const CYCLE=['CYCLE_NOT_ACTIVE','CYCLE_NEW_REQUIRED','CYCLE_VOCAB_MISMATCH','CYCLE_WORD_INELIGIBLE','CYCLE_ORAL_FLAG'];
const w=v=>String(v.word).trim().toLowerCase();
const row=x=>[x,2,0,'','','','',''];
let n=0;const t=(name,fn)=>{try{fn();n++}catch(e){e.message=name+': '+e.message;throw e}};

// ---------- 08:00 ----------
const am=read('data/daily/2026-10-14-am.json'),amWords=am.vocab.map(w);
function amRuntime(newWords){
 const rt=clone(baseRuntime);
 rt.new_pool=newWords.map(x=>[x,'']);rt.new_pool_dont=newWords.slice();rt.new_pool_fuzzy=[];rt.new_pool_unclassified=[];rt.oral_new_pool=[];rt.oral_new_pool_dont=[];
 const have=new Set(rt.review_pool.map(r=>String(r[0]).toLowerCase()));
 for(const x of [...amWords,...am.review_vocab.map(s=>s.toLowerCase())])if(!have.has(x)&&!newWords.includes(x))rt.review_pool.push(row(x));
 return rt;
}
const runAm=(lesson,rt)=>validate({lesson,index,runtime:rt,rules,expectedDate:'2026-10-14',expectedSession:'am',sameDayAm:null,previousPm:null,reviewHistory:[]});
const four=amWords.slice(0,4),six=amWords.slice(4);
t('A1 cycle AM: 4 remaining new words + 6 cycle words passes every cycle rule',()=>{
 const L=clone(am);L.cycle_vocab=six;L.vocab.forEach(v=>{if(six.includes(w(v)))v.is_oral_new=false});
 const c=codes(runAm(L,amRuntime(four)));
 for(const k of [...CYCLE,'AM_CORE_COUNT','NEW_WORD_INELIGIBLE','AM_DONT_PRIORITY','NEW_MEMORY_POOL_INVALID'])assert.ok(!c.has(k),k);
});
t('A2 cycle AM without cycle_vocab is rejected',()=>{assert.ok(codes(runAm(clone(am),amRuntime(four))).has('CYCLE_VOCAB_MISMATCH'))});
t('A3 cycle AM must teach every remaining new word first',()=>{
 const L=clone(am);L.cycle_vocab=six;const rt=amRuntime([...four,'kata-baru-lain']);
 assert.ok(codes(runAm(L,rt)).has('CYCLE_NEW_REQUIRED'));
});
t('A4 a cycle word must come from review_pool',()=>{
 const L=clone(am);L.cycle_vocab=six;const rt=amRuntime(four);rt.review_pool=rt.review_pool.filter(r=>String(r[0]).toLowerCase()!==six[0]);
 assert.ok(codes(runAm(L,rt)).has('CYCLE_WORD_INELIGIBLE'));
});
t('A5 normal mode: cycle_vocab is refused and the 10-new-word contract is unchanged',()=>{
 const L=clone(am);L.cycle_vocab=six;const c=codes(runAm(L,amRuntime(amWords.concat(['x1','x2']))));
 assert.ok(c.has('CYCLE_NOT_ACTIVE'));
 const c2=codes(runAm(clone(am),amRuntime(amWords.concat(['x1','x2']))));
 for(const k of CYCLE)assert.ok(!c2.has(k),k);
 assert.ok(!c2.has('NEW_WORD_INELIGIBLE'));
});

// ---------- 18:00 ----------
const pm=read('data/daily/2026-10-13-pm.json'),sameAm=read('data/daily/2026-10-13-am.json');
function pmRuntime(newWords,extraReview){
 const rt=clone(baseRuntime);rt.new_pool=newWords.map(x=>[x,'']);rt.new_pool_dont=newWords.slice();rt.new_pool_fuzzy=[];rt.new_pool_unclassified=[];rt.oral_new_pool=[];rt.oral_new_pool_dont=[];
 const have=new Set(rt.review_pool.map(r=>String(r[0]).toLowerCase()));
 for(const x of [...pm.vocab.map(w),...extraReview])if(!have.has(x)&&!newWords.includes(x))rt.review_pool.push(row(x));
 return rt;
}
const runPm=(lesson,rt,amLesson=sameAm)=>validate({lesson,index,runtime:rt,rules,expectedDate:'2026-10-13',expectedSession:'pm',sameDayAm:amLesson,previousPm:null,reviewHistory:[]});
const toReview=L=>{const x=clone(L);x.vocab.forEach(v=>{if(v.source_group==='new'){v.source_group='review';v.is_new=false;v.is_oral_new=false}});x.new_words=[];return x};
t('P1 cycle PM: no new words left, review group grows to keep 10-12 cards',()=>{
 const c=codes(runPm(toReview(pm),pmRuntime([],[])));assert.ok(!c.has('PM_GROUP_COUNT'),'group count');assert.ok(!c.has('PM_NEW_WORDS_MISMATCH'));
});
t('P2 cycle PM still teaching new words that do not exist is rejected',()=>{assert.ok(codes(runPm(clone(pm),pmRuntime([],[]))).has('PM_GROUP_COUNT'))});
t('P3 normal PM keeps 3-4 new words',()=>{
 const pool=pm.new_words.map(s=>s.toLowerCase()).concat(['x1','x2','x3']);
 assert.ok(!codes(runPm(clone(pm),pmRuntime(pool,[]))).has('PM_GROUP_COUNT'));
 assert.ok(codes(runPm(toReview(pm),pmRuntime(pool,[]))).has('PM_GROUP_COUNT'));
});
t('P4 a same-day AM cycle word is an old word reviewed at 08:00, not a new word',()=>{
 const L=toReview(pm),app=L.vocab.find(v=>v.source_group==='application');
 const amX=clone(sameAm),cw=w(app);
 if(!amX.vocab.some(v=>w(v)===cw))amX.vocab[0]=Object.assign({},amX.vocab[0],{word:app.word});
 amX.cycle_vocab=[app.word];
 app.usage_note='今天08:00复习过的老词。';app.formation=String(app.formation||'').replace(/今天\s*08:00\s*(新学|已教)[^。]*。?/g,'');
 const c=codes(runPm(L,pmRuntime([],[]),amX));
 assert.ok(!c.has('AM_MARKER_FALSE')&&!c.has('AM_MARKER_MISSING'),'cycle word marked as 08:00 old review');
 delete amX.cycle_vocab;assert.ok(codes(runPm(L,pmRuntime([],[]),amX)).has('AM_MARKER_FALSE'),'without cycle_vocab the same word counts as an 08:00 new word');
});

// ---------- ranking and ledger ----------
t('R1 cycle words are active reviews in the exposure ledger',()=>{
 assert.deepEqual(activeWords({session:'am',review_vocab:['a'],cycle_vocab:['B']},null),['a','b']);
});
t('R2 ranking fills cycle slots half weakest, half longest unseen, disjoint from review_vocab',()=>{
 const out=rank({date:'2026-10-15',session:'am',runtime:baseRuntime,rotation:rules.review_rotation,reviewHistory:[],longHistory:[],reviewCount:5,cycleCount:6});
 const c=out.review_cycle;assert.ok(c&&c.active);assert.equal(c.cycle_words.length,6);
 assert.equal(new Set(c.cycle_words).size,6);assert.equal(c.weak.length,3);assert.equal(c.stale.length,3);
 assert.ok(c.cycle_words.every(x=>!out.recommended_review.includes(x)),'disjoint from review_vocab');
 const none=rank({date:'2026-10-15',session:'am',runtime:baseRuntime,rotation:rules.review_rotation,reviewHistory:[],longHistory:[],reviewCount:5});
 assert.equal(none.review_cycle,null,'no cycle in normal mode');
 assert.deepEqual(none.recommended_review,out.recommended_review,'review_vocab picks unchanged by the cycle');
});
console.log('Review cycle tests passed: '+n+' checks (AM 4+6 cycle, cycle_vocab required, remaining new first, review_pool only, normal mode unchanged, PM 0-new growth, 08:00 old-review marker, ledger, ranking split).');
