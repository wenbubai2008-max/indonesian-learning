#!/usr/bin/env node
'use strict';
// 2026-10-25 profile redesign step A: per-word diagnosis is bottom-up (meaning → listening → production), keeps "no cause
// guessed" honest (insufficient / unclear), and is read-only. Fixtures follow the real record shapes written by
// home-learning-upgrade-v2.js (quick), listening-word-training.js, automation-training.js, lesson-end-recall.js and weakness-pool.js.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const repo=path.resolve(__dirname,'..','..');
const D=require(path.join(repo,'data/word-diagnosis.js'));
const DAY=86400000,NOW=Date.parse('2026-10-25T05:00:00Z');
let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS '+name)};
const ago=d=>NOW-d*DAY,iso=d=>new Date(ago(d)).toISOString();
const dx=i=>D.diagnose(Object.assign({word:'kebutuhan'},i),NOW);

// quick: right/wrong counters + last_result; listen: attempts/correct/streaks; auto: attempts/failures/successes/fail_streak
const quick=(right,wrong,last='right',extra={})=>Object.assign({right,wrong,streak:last==='right'?right:0,last_result:last,last:ago(1),last_right:ago(last==='right'?1:3),last_wrong:wrong?ago(last==='wrong'?1:3):0},extra);
const listen=(attempts,correct,{wrong_streak=0,slow_streak=0,last='correct'}={})=>({attempts,correct,wrong_streak,slow_streak,last_result:last,last_at:iso(1)});
const auto=(attempts,failures,successes,{fail_streak=0,last='right',status='active'}={})=>({attempts,failures,successes,fail_streak,last_result:last,status,last_at:ago(1)});

t('fewer than 3 records → 待验证, never guessed',()=>{
  const r=dx({quick:quick(1,1)});
  assert.equal(r.type,'insufficient');assert.equal(r.label,'待验证');assert.equal(r.confidence,null);assert.match(r.next.text,/再练几次/);
});
t('recognition mostly wrong → 意思记不住 (even if production also fails: the lower layer comes first)',()=>{
  const r=dx({quick:quick(1,4,'wrong'),auto:auto(4,4,0,{fail_streak:3,last:'fail'})});
  assert.equal(r.type,'meaning');assert.equal(r.next.train,'quick');
  assert.ok(!r.secondary.includes('production'),'production failures are not interpreted while recognition fails');
});
t('recognition reliable + listening wrong/slow twice → 听不出来',()=>{
  assert.equal(dx({quick:quick(4,0),listen:listen(4,2,{wrong_streak:2,last:'wrong'})}).type,'listening');
  assert.equal(dx({quick:quick(4,0),listen:listen(4,4,{slow_streak:2})}).type,'listening');
});
t('recognition reliable + automatic training fails twice in a row → 说不出来; hinted passes are not failures',()=>{
  const r=dx({quick:quick(4,0),auto:auto(5,3,2,{fail_streak:2,last:'fail'})});
  assert.equal(r.type,'production');assert.equal(r.next.train,'auto');
  const hinted=dx({quick:quick(4,0),auto:auto(4,0,4,{last:'hinted'})});
  assert.notEqual(hinted.type,'production');
});
t('single production failure is not enough (production is naturally harder than recognition)',()=>{
  const r=dx({quick:quick(5,0),auto:auto(3,1,2,{fail_streak:1,last:'fail'})});
  assert.notEqual(r.type,'production');
});
t('production failing while recognition is untested → 原因待确认 and asks for a quick practice first',()=>{
  const r=dx({auto:auto(4,4,0,{fail_streak:3,last:'fail'})});
  assert.equal(r.type,'unclear');assert.equal(r.next.train,'quick');assert.match(r.next.text,/确认认得/);
});
t('listening failing while recognition is untested → 原因待确认 (the word may just not be known)',()=>{
  assert.equal(dx({listen:listen(4,1,{wrong_streak:3,last:'wrong'})}).type,'unclear');
});
t('lesson-end self-report counts for production only when recognition is reliable, and is labelled as self-report',()=>{
  const recall={hist:[{day:'2026-10-22',result:'fail',at:iso(3)},{day:'2026-10-23',result:'fail',at:iso(2)},{day:'2026-10-24',result:'slow',at:iso(1)}]};
  const r=dx({quick:quick(4,0),recall});
  assert.equal(r.type,'production');assert.ok(r.evidence.some(e=>e.includes('只是自我感觉')));
  assert.equal(dx({quick:quick(1,3,'wrong'),recall}).type,'meaning');
});
t('mastered earlier then wrong again → 掌握后又答错 (primary only when no layer explains it)',()=>{
  const weak={status:'active',last_mastered:iso(10),last_wrong:iso(2),wrong_count:2};
  assert.equal(dx({quick:quick(4,0),weak}).type,'forgetting');
  const both=dx({quick:quick(1,4,'wrong'),weak});
  assert.equal(both.type,'meaning');assert.ok(both.secondary.includes('forgetting'));
  assert.equal(dx({weak}).type,'forgetting','the weakness record alone is enough evidence');
  assert.equal(dx({quick:quick(4,0),weak:{status:'mastered',last_mastered:iso(1),last_wrong:iso(5)}}).type,'recognized','wrong BEFORE mastering is not forgetting');
});
t('recognition fine but listening / automatic training never tested → 认得没问题 (NOT "no problem"), label names what is untested',()=>{
  const r=dx({quick:quick(4,0)});
  assert.equal(r.type,'recognized');assert.deepEqual(r.untested.sort(),['auto','listen']);
  assert.equal(r.label,'认得没问题，听词、自动训练还没测');
  assert.equal(dx({quick:quick(4,0),listen:listen(3,3)}).label,'认得没问题，自动训练还没测');
  assert.equal(dx({quick:quick(4,0),auto:auto(3,0,3)}).label,'认得没问题，听词还没测');
});
t('every layer tested and reliable → 各层都验证过，暂无问题',()=>{
  const r=dx({quick:quick(4,0),listen:listen(3,3),auto:auto(3,0,3)});
  assert.equal(r.type,'ok');assert.equal(r.label,'各层都验证过，暂无问题');assert.deepEqual(r.layers,{recognition:'reliable',listening:'reliable',production:'reliable'});
});
t('summarize counts words per type and how many words each layer was tested on',()=>{
  const store={indo_quick_practice_state:{a:quick(4,0),b:quick(1,4,'wrong'),c:quick(4,0)},indo_listen_stats_v1:{c:listen(3,3)},indo_automation_training_state_v1:{c:auto(3,0,3)},indo_lesson_recall_v1:{words:{b:{hist:[]}}},indo_weak_pool_v1:{}};
  const snap=D.snapshot({getItem:k=>k in store?JSON.stringify(store[k]):null});
  const s=D.summarize(snap,NOW);
  assert.equal(s.words,3);assert.deepEqual(s.tested,{recognition:3,listening:1,production:1,self_report:1});
  assert.deepEqual(s.types,{recognized:1,meaning:1,ok:1});
});
t('words the learner opted out of training are never diagnosed (they are status=mastered + training_excluded, not real mastery)',()=>{
  const weak={status:'mastered',reasons:['training_excluded','memory_dont'],last_mastered:iso(3),last_wrong:iso(1),wrong_count:3};
  const r=dx({quick:quick(1,4,'wrong'),weak});
  assert.equal(r.type,'excluded');assert.equal(r.label,'已退出训练');
});
t('summarize skips excluded words and counts words that failed before and were mastered in the last 30 days',()=>{
  const store={
    indo_quick_practice_state:{a:quick(4,0),x:quick(1,4,'wrong')},
    indo_weak_pool_v1:{
      x:{status:'mastered',reasons:['training_excluded'],wrong_count:2,last_mastered:iso(2)},
      r1:{status:'mastered',reasons:[],wrong_count:2,last_mastered:iso(5)},
      r2:{status:'mastered',reasons:[],wrong_count:1,last_mastered:iso(40)},
      r3:{status:'mastered',reasons:[],wrong_count:0,last_mastered:iso(2)},
      r4:{status:'mastered',reasons:[],wrong_count:3,last_mastered:iso(1)}}};
  const snap=D.snapshot({getItem:k=>k in store?JSON.stringify(store[k]):null});
  const s=D.summarize(snap,NOW);
  assert.equal(s.words,1);assert.equal(s.excluded,1);assert.deepEqual(s.tested,{recognition:1,listening:0,production:0,self_report:0});
  assert.equal(s.recovered_30d,2,'r1 and r4 only: r2 is too old, r3 never failed, x is excluded');
  assert.equal(D.summarize(snap,NOW,{taught:new Set(['r1'])}).recovered_30d,1);
});
t('mixed recognition (not reliable, not failing) → 原因待确认, not a guess',()=>{
  assert.equal(dx({quick:quick(2,1,'wrong')}).type,'unclear');
  assert.equal(dx({quick:quick(2,2,'wrong')}).type,'meaning','half wrong or worse is a recognition failure');
});
t('confidence grows with records, days and agreeing signals',()=>{
  const low=dx({quick:quick(0,3,'wrong',{last_right:0,last_wrong:ago(0.1),last:ago(0.1)})});
  assert.equal(low.type,'meaning');assert.equal(low.confidence,'low');
  const high=dx({quick:quick(1,6,'wrong'),listen:listen(4,1,{wrong_streak:3,last:'wrong'}),weak:{status:'active',last_mastered:iso(20),last_wrong:iso(1)}});
  assert.equal(high.confidence,'high');
});
t('next verification date is the earliest future due date',()=>{
  const r=dx({quick:quick(4,0,'right',{review_due:ago(-2)}),listen:listen(3,3,{}) ,auto:Object.assign(auto(3,0,3),{next_due:ago(-5)})});
  assert.equal(r.next.verify_at,new Date(ago(-2)).toISOString());
  assert.equal(dx({quick:quick(4,0,'right',{review_due:ago(2)})}).next.verify_at,null,'a past due date is not a verification date');
});
t('read-only: snapshot/diagnoseFrom never write storage; keys are matched case-insensitively',()=>{
  const writes=[],store={
    indo_quick_practice_state:{Kebutuhan:quick(4,0)},indo_listen_stats_v1:{kebutuhan:listen(4,4,{slow_streak:3})},
    indo_automation_training_state_v1:{},indo_lesson_recall_v1:{words:{}},indo_weak_pool_v1:{}};
  const storage={getItem:k=>k in store?JSON.stringify(store[k]):null,setItem:k=>writes.push(k),removeItem:k=>writes.push(k)};
  const snap=D.snapshot(storage);
  assert.equal(D.diagnoseFrom(snap,'KEBUTUHAN',NOW).type,'listening');
  assert.deepEqual(writes,[]);
  assert.doesNotMatch(fs.readFileSync(path.join(repo,'data/word-diagnosis.js'),'utf8'),/setItem|removeItem|localStorage\.|MutationObserver|fetch\(/);
});
t('malformed records never throw and never invent a cause',()=>{
  for(const bad of [null,undefined,{},{quick:'x'},{quick:[1],listen:5,auto:null,weak:'a'},{quick:{right:'a',wrong:{}}},{recall:{hist:'zz'}}]){
    const r=D.diagnose(Object.assign({word:'x'},bad||{}),NOW);
    assert.ok(['insufficient','unclear','recognized','ok'].includes(r.type),JSON.stringify(bad));
  }
  assert.doesNotThrow(()=>D.snapshot({getItem:()=>'{not json'}));
});
t('real weakness records: every word gets a valid type; most have too little evidence (no guessing)',()=>{
  const w=JSON.parse(fs.readFileSync(path.join(repo,'data/weakness-sync.json'),'utf8')).words;
  const counts={};
  for(const [k,rec] of Object.entries(w)){
    const r=D.diagnose({word:k,weak:rec},NOW);
    assert.ok(r.label,k);counts[r.type]=(counts[r.type]||0)+1;
    assert.ok(!['meaning','listening','production'].includes(r.type),'weakness record alone cannot name a training layer: '+k);
  }
  assert.ok((counts.insufficient||0)+(counts.unclear||0)>Object.keys(w).length*.8,JSON.stringify(counts));
  console.log('   real records →',JSON.stringify(counts));
});
console.log('Word diagnosis tests passed: '+n);
