'use strict';
// 2026-10-16 PR 2: lesson-end recall — word choice, first-attempt-wins, no lesson-error / mastery side effects, coach
// reordering, and two-device sync through the real Worker (earliest attempt of the day wins on both devices).
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..','..');
const recallSrc=fs.readFileSync(path.join(repo,'data','lesson-end-recall.js'),'utf8');
const coachSrc=fs.readFileSync(path.join(repo,'data','vocab-study-coach.js'),'utf8');
const syncSrc=fs.readFileSync(path.join(repo,'data','training-sync-client.js'),'utf8');
const H=3600000,D=24*H;
const CustomEvent=function(t,o){this.type=t;this.detail=o&&o.detail};
function makeStore(){const m=new Map();return {m,ls:{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}};}
function page(db,{mastered=[],store=makeStore()}={}){
  const calls=[],root={DAILY_VOCAB_DB:db,localStorage:store.ls,addEventListener(){},dispatchEvent(){return true},
    WeaknessPool:{listMastered:()=>mastered,focusMap:()=>({}),recordLessonWrong:(...a)=>calls.push(a)},
    VocabProfileEvidence:{records:()=>[],summarize:()=>({words:[]})}};
  const ctx={window:root,localStorage:store.ls,document:{getElementById:()=>null,readyState:'complete',addEventListener(){}},CustomEvent,Date,Map,Set,Object,String,Number,Array,Intl,JSON,Math,setTimeout:()=>0};
  vm.runInNewContext(coachSrc,ctx,{filename:'vocab-study-coach.js'});
  vm.runInNewContext(recallSrc,ctx,{filename:'lesson-end-recall.js'});
  return {root,R:root.LessonRecall,C:root.VocabStudyCoach,store,calls};
}
const today='2026-10-16',now=Date.parse(today+'T02:00:00Z'); // 09:00 Jakarta
const w=(word,first)=>({word,cn:'cn-'+word,first_seen:first,last_seen:first});
const db=[
  ...['a1','a2','a3','a4','a5','a6','a7'].map(x=>w(x,'2026-10-15 08:00')), // yesterday AM: 7 (not padded to 10)
  w('p1','2026-10-15 18:00'),w('p2','2026-10-15 18:00'),w('p3','2026-10-15 18:00'),          // yesterday PM: 3
  w('t1','2026-10-16 08:00'),                                                                 // today: never asked
  w('b3','2026-10-13 18:00'),w('b5','2026-10-11 08:00'),w('b6','2026-10-10 08:00'),w('b12','2026-10-04 08:00'),w('b40','2026-09-06 08:00'),
  w('m1','2026-10-15 08:00')];
{
  const P=page(db,{mastered:[{word:'m1',last_mastered:'2026-10-15T12:00:00Z'}]});
  const am=P.R.select(today,'am',now).map(x=>x.word);
  assert.deepEqual(Array.from(am),['a1','a2','a3','a4','a5','a6','a7'],'AM: exactly the real count of yesterday 08:00 new words, mastered skipped, never padded');
  const pm=P.R.select(today,'pm',now);
  assert.deepEqual(Array.from(pm.filter(x=>x.group==='yesterday').map(x=>x.word)),['p1','p2','p3'],'PM: yesterday evening new words');
  const back=pm.filter(x=>x.group==='backlog').map(x=>x.word);
  assert.equal(back.length,3,'PM adds 3 backlog words when yesterday had <= 4');
  assert.ok(back.includes('b12')&&!back.includes('b40'),'backlog: one from 8-30 days, nothing older than 30');
  assert.ok(!back.includes('t1')&&!back.includes('a1'),'backlog never takes today or yesterday words');
  // Review cycle: no new words yesterday → no section at all.
  const Q=page(db.filter(x=>!x.word.startsWith('a')&&x.word!=='m1'));
  assert.equal(Q.R.select(today,'am',now).length,0,'no yesterday AM new words → empty, nothing invented');
  // Frozen per lesson.
  P.store.m.set('x','');assert.deepEqual(Array.from(P.R.select(today,'am',now+H).map(x=>x.word)),Array.from(am),'refresh shows the same words');
  // First attempt per day wins; no lesson error, no mastery, no training pass.
  assert.equal(P.R.record('a1','fail','2026-10-16-am',now),true);
  assert.equal(P.R.record('a1','fast','2026-10-16-am',now+60000),false,'second attempt after seeing the answer is ignored');
  assert.equal(P.R.todayResult('a1',now+60000),'fail');
  P.R.record('a2','fast','2026-10-16-am',now);P.R.record('a3','slow','2026-10-16-am',now);
  assert.equal(P.calls.length,0,'self-recall never calls WeaknessPool.recordLessonWrong');
  assert.equal(P.store.m.has('indo_automation_training_state_v1'),false,'no automatic-training pass is written');
  assert.equal(P.store.m.has('indo_quick_practice_state'),false,'no quick-practice answer is written');
  assert.equal(P.C.status('auto','a1',now).kind,'new','word still waits for its first formal check');
  // Coach: fail first, fast behind other recent words (lane), listening unaffected.
  const lane=P.C.candidates('auto',now).filter(x=>x.lane&&x.age<=2).map(x=>x.word);
  assert.equal(lane[0],'a1','想不起来 comes first among recent words');
  assert.ok(lane.indexOf('a3')<lane.indexOf('a4')&&lane.indexOf('a2')===lane.length-1,'有点慢 next, 马上想到 last');
  // Next day: the stored result rolls into history, a new day records again.
  const next=now+D;assert.equal(P.R.todayResult('a1',next),'');assert.equal(P.R.record('a1','fast','2026-10-17-pm',next),true);
  const rec=JSON.parse(P.store.m.get('indo_lesson_recall_v1')).words.a1;
  assert.equal(rec.hist.length,2);assert.equal(rec.result,'fast');assert.equal(rec.hist[0].result,'fail');
  // PM backlog skips words recalled at the previous lesson end.
  const P2=page(db);P2.R.record('b3','fail','2026-10-15-pm',now-15*H);
  assert.ok(!P2.R.select(today,'pm',now).some(x=>x.word==='b3'),'recalled yesterday evening → not asked again today');
}
// 2026-10-18: lesson focus words are asked first, but only among eligible words (mastered / practised today stay out).
{
  const P=page(db,{mastered:[{word:'m1',last_mastered:'2026-10-15T12:00:00Z'}]});
  P.store.m.set('indo_lesson_focus_v1',JSON.stringify({version:1,lessons:{'2026-10-15-am':{words:['a6','a3','m1']},'2026-10-11-am':{words:['b5']}}}));
  const am=Array.from(P.R.select(today,'am',now).map(x=>x.word));
  assert.deepEqual(am.slice(0,2),['a3','a6'],'focus words lead the AM list');
  assert.equal(am.length,7,'focus never adds words: still the 7 real new words');assert.ok(!am.includes('m1'),'a mastered focus word is not forced in');
  const back=Array.from(P.R.select(today,'pm',now).filter(x=>x.group==='backlog').map(x=>x.word));
  assert.equal(back[0],'b5','a focus backlog word is picked first among unrecalled words');
  P.R.record('a3','fail','2026-10-16-am',now);assert.equal(P.R.record('a3','fast','2026-10-16-am',now+1000),false,'first attempt still wins');
}
// Merge rule shared by page, client and Worker: earliest attempt of a day wins, order of arrival does not matter.
{
  const P=page([]),m=P.R.mergeRecord;
  const early={day:today,result:'fail',at:'2026-10-16T01:00:00Z'},late={day:today,result:'fast',at:'2026-10-16T03:00:00Z'};
  assert.equal(m(early,late).result,'fail');assert.equal(m(late,early).result,'fail');
}
(async()=>{
  const worker=(await import(path.join(repo,'cloudflare','weakness-sync-worker.js'))).default;
  const kv=new Map(),env={SYNC_KEY:'k',ALLOWED_ORIGIN:'https://wenbubai2008-max.github.io',
    WEAK_SYNC_KV:{get:async(k,t)=>kv.has(k)?(t==='json'?JSON.parse(kv.get(k)):kv.get(k)):null,put:async(k,v)=>{kv.set(k,v)}}};
  function device(name,{oldWorker=false}={}){
    const P=page(db);P.store.m.set('indo_weak_sync_config_v1',JSON.stringify({endpoint:'https://w.example',key:'k'}));
    const fetch=async(url,opt)=>{
      const req=new Request(url,{method:opt.method,headers:Object.assign({origin:'https://wenbubai2008-max.github.io'},opt.headers),body:opt.body});
      const res=await worker.fetch(req,env);const body=await res.json();
      if(oldWorker&&body.modes)delete body.modes.recall; // a Worker deployed before 2026-10-16
      return {status:res.status,ok:res.ok,json:async()=>body};
    };
    const ctx={window:P.root,document:{readyState:'loading',addEventListener(){},visibilityState:'visible'},localStorage:P.store.ls,fetch,CustomEvent,
      setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,Date,JSON,Object,Number,String,Math,Array};
    vm.runInNewContext(syncSrc,ctx,{filename:name+'-training-sync-client.js'});
    return Object.assign(P,{S:P.root.TrainingSync,words:()=>JSON.parse(P.store.m.get('indo_lesson_recall_v1')||'{}').words||{}});
  }
  // Old Worker: recall stays on the device and the page says so.
  const old=device('old',{oldWorker:true});old.R.record('p1','fail','2026-10-16-am',now);
  assert.equal(old.S.recallStatus(),'local');await old.S.run();
  assert.equal(old.S.recallStatus(),'local','without modes.recall the lesson shows 仅本机保存');
  assert.ok(!(JSON.parse(kv.get('training-state-v1')||'{"modes":{}}').modes.recall||{}).p1,'nothing is pushed to an old Worker');
  // New Worker: phone answered first (fail at 08:00), laptop later the same day (fast at 10:00) before syncing.
  kv.clear();
  const phone=device('phone'),laptop=device('laptop');
  phone.R.record('a5','fail','2026-10-16-am',now-H);laptop.R.record('a5','fast','2026-10-16-am',now+H);
  laptop.R.record('a6','slow','2026-10-16-am',now);
  await laptop.S.run();await laptop.S.run();await phone.S.run();await phone.S.run();await laptop.S.run();
  assert.equal(phone.S.recallStatus(),'synced');
  for(const d of [phone,laptop]){
    assert.equal(d.words().a5.result,'fail','the first recall of the day wins on both devices, whichever uploaded last');
    assert.equal(d.words().a6.result,'slow','a recall made only on the laptop reaches the phone');
  }
  assert.equal(laptop.R.todayResult('a5',now+2*H),'fail');
  console.log('Lesson-end recall tests passed: real counts, backlog, first attempt wins, no side effects, coach order, two-device sync, old Worker = local only.');
})().catch(e=>{console.error(e);process.exit(1);});
