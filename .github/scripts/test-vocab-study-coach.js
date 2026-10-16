'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const script=fs.readFileSync(path.resolve(__dirname,'../../data/vocab-study-coach.js'),'utf8');
const CustomEvent=function(type,o){this.type=type;this.detail=o&&o.detail};
function app(words,mastered=[]){
  const store=new Map(),handlers=new Map(),root={
    DAILY_VOCAB_DB:words.map(word=>({word,cn:word})),
    localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v))},
    addEventListener(k,fn){const a=handlers.get(k)||[];a.push(fn);handlers.set(k,a)},
    dispatchEvent(e){(handlers.get(e.type)||[]).forEach(fn=>fn(e));return true},
    WeaknessPool:{listMastered:()=>mastered,focusMap:()=>({})},
    VocabProfileEvidence:{records:()=>[],summarize:()=>({words:[]})}
  };
  vm.runInNewContext(script,{window:root,CustomEvent,Date,Map,Set,Object,String,Number,Array,Intl},{filename:'vocab-study-coach.js'});
  const coach=root.VocabStudyCoach;
  const read=k=>JSON.parse(store.get(k)||'{}'),write=(k,x)=>store.set(k,JSON.stringify(x));
  const quick=(word,ok,now)=>{
    const m=read('indo_quick_practice_state'),p=m[word]||{};
    p.last=now;p.last_result=ok?'right':'wrong';p.streak=ok?(p.streak||0)+1:0;
    if(!ok)p.last_wrong=now;
    m[word]=p;write('indo_quick_practice_state',m);
    coach.markAnswer('quick',word,ok,now);
  };
  const listen=(word,quality,now)=>{
    const m=read('indo_listen_stats_v1'),p=m[word]||{};
    p.last_at=new Date(now).toISOString();p.last_result=quality==='wrong'?'wrong':'correct';
    m[word]=p;write('indo_listen_stats_v1',m);
    coach.markAnswer('listen',word,quality!=='wrong',now,quality);
  };
  return {root,coach,store,read,write,quick,listen};
}
const H=3600000,D=24*H,start=Date.parse('2026-09-28T10:00:00Z');
const x=app(['tunda','niat','mendukung']),c=x.coach;
assert.equal(c.words().length,3,'Only formally taught words are eligible');
assert.equal(c.detail('not-taught'),null);
assert.ok(c.candidates('quick',start).some(r=>r.word==='tunda'));
assert.ok(c.candidates('listen',start).some(r=>r.word==='tunda'));
assert.ok(c.candidates('auto',start).some(r=>r.word==='tunda'),'One word can appear in all three capability queues');
assert.equal(c.statistics('quick',start).unverified,3);
c.dailyProgress(start);
const first=[...c.round('quick',start,false,2)].map(r=>r.word);
assert.deepEqual([...c.round('quick',start,false,2)].map(r=>r.word),first,'Refresh preserves unanswered round');
x.quick(first[0],true,start);
assert.equal(c.statistics('quick',start).today,1);
assert.equal(c.statistics('listen',start).today,0,'Visual answer cannot complete listening');
assert.ok(c.eligible(first[0],start,'listen'));
assert.ok(c.eligible(first[0],start,'auto'));
assert.deepEqual(Array.from(c.round('quick',start,false,2).map(r=>r.word)),[first[1]],'Refresh resumes pending card');
x.quick(first[1],true,start);
assert.equal(c.round('quick',start,false,2).length,0,'Completed round waits for explicit next batch');
assert.equal(c.round('quick',start,true,2).length,1,'Next batch pulls another eligible due word');
assert.equal(c.dailyProgress(start).done,2,'Each actual priority answer counts per mode and word, not mastery');
const word=first[0];
assert.equal(c.status('quick',word,start).level,1);
assert.equal(c.status('quick',word,start+2*D-1000).ready,false);
x.quick(word,true,start+2*D);
assert.equal(c.status('quick',word,start+2*D).level,2);
assert.equal(c.status('quick',word,start+9*D-1000).ready,false);
x.quick(word,true,start+9*D);
assert.equal(c.status('quick',word,start+9*D).level,3);
assert.equal(c.status('quick',word,start+9*D).stable,true);
assert.equal(c.status('quick',word,start+10*D).ready,false,'Graduated recognition leaves daily quick work for 30 days');
assert.ok(c.eligible(word,start+10*D,'listen'),'Visual graduation never suppresses auditory verification');
x.quick(word,false,start+39*D);
assert.equal(c.status('quick',word,start+39*D).level,0,'A genuine mistake reopens visual review without rewriting other skills');
assert.equal(c.status('quick',word,start+40*D).ready,true,'Wrong recognition reappears next day');
x.listen('tunda','fast_first',start);
x.listen('tunda','fast_first',start+2*D);
x.listen('tunda','fast_first',start+9*D);
assert.equal(c.status('listen','tunda',start+9*D).stable,true);
assert.equal(c.status('quick','tunda',start+9*D).level,0,'Auditory success cannot graduate visual recognition');
const y=app(['tunda','niat']);const yc=y.coach;
y.write('indo_automation_training_state_v1',{tunda:{last_at:start,next_due:start+48*H,status:'active',stage:4}});
y.quick('tunda',false,start+H);
assert.equal(yc.eligible('tunda',start+25*H,'auto'),false,'Quick mistake cannot override active-stage delay');
assert.equal(yc.eligible('tunda',start+48*H,'auto'),true);
y.write('indo_automation_training_state_v1',{tunda:{last_at:start+48*H,next_due:start+49*H,status:'active',stage:1,last_result:'fail'}});
assert.equal(yc.eligible('tunda',start+48*H+30*60000,'auto'),false,'Active failure retry must still honor its own one-hour delay');
assert.equal(yc.eligible('tunda',start+49*H,'auto'),true,'Active failure can be retried when its delay expires on the same Jakarta day');
assert.equal(yc.requestVerification('unknown',start),false);
assert.equal(yc.requestVerification('niat',start),true);
assert.equal(yc.status('auto','niat',start).ready,false);
assert.equal(yc.status('auto','niat',start+D).stage,1);
y.root.dispatchEvent(new CustomEvent('automation-training-updated',{detail:{word:'niat',state:{last_at:start+H}}}));
assert.equal(yc.pendingSet().has('niat'),true,'Early practice does not clear requested cross-day verification');
y.root.dispatchEvent(new CustomEvent('automation-training-updated',{detail:{word:'niat',state:{last_at:start+D}}}));
assert.equal(yc.pendingSet().has('niat'),false);
const backlog=app(Array.from({length:25},(_,i)=>'word'+String(i).padStart(2,'0'))),bc=backlog.coach;
const batch=bc.round('quick',start,false,10);
assert.equal(batch.length,10);
batch.forEach(r=>backlog.quick(r.word,true,start));
assert.equal(bc.statistics('quick',start).due,15);
assert.equal(bc.round('quick',start,false,10).length,0);
const next=bc.round('quick',start,true,10);
assert.equal(next.length,10);
assert.ok(next.every(r=>!batch.some(prev=>prev.word===r.word)),'No repeated same-day answer; backlog continues in bounded rounds');
const historic=app(['prior'],[{word:'prior',last_mastered:new Date(start-5*D).toISOString()}]);
assert.equal(historic.coach.status('quick','prior',start).stable,true,'Historical explicit mastery is respected without forging three dated choices');
assert.equal(historic.coach.status('quick','prior',start).ready,false);
assert.equal(historic.store.has('data/daily-vocab-data.js'),false,'Scheduler never alters lesson eligibility source');
// 2026-10-14: never-practiced words are not served alphabetically; the longest-unseen lesson word comes first.
const tie=app(['acara','zaman','tetangga']);
tie.root.DAILY_VOCAB_DB[0].last_seen='2026-10-13 08:00';tie.root.DAILY_VOCAB_DB[1].last_seen='2026-09-01 08:00';tie.root.DAILY_VOCAB_DB[2].last_seen='2026-10-01 18:00';
assert.deepEqual(Array.from(tie.coach.candidates('auto',start).map(x=>x.word)),['zaman','tetangga','acara'],'Ties go to the word longest without a lesson appearance, not to alphabetical order');
console.log('Study coach tests passed: independent abilities and due dates, 2/7/30-day ladder, backlog, persistent rounds, legacy mastery, requested verification.');
// 2026-10-16 PR 1: recent-new-word lane. Age comes from first_seen; caps quick 4/10, auto 3/8, plan <= 2 of 8; recall
// signals (indo_lesson_recall_v1) reorder only inside the lane and only when present.
{
  const now=Date.parse('2026-10-16T03:00:00Z'),dd=n=>new Date(now-n*D+7*H).toISOString().slice(0,10);
  const old=Array.from({length:30},(_,i)=>'lama'+String(i).padStart(2,'0'));
  const fresh=['baru1a','baru1b','baru1c','baru2a','baru5a','baru5b','baru9a','baru40','hariini'];
  const L=app([...old,...fresh]);
  const ages={baru1a:1,baru1b:1,baru1c:1,baru2a:2,baru5a:5,baru5b:5,baru9a:9,baru40:40,hariini:0};
  L.root.DAILY_VOCAB_DB.forEach(x=>{if(ages[x.word]!=null){x.first_seen=dd(ages[x.word]);x.last_seen=dd(0)}else{x.first_seen='2026-08-01';x.last_seen='2026-08-01'}});
  // Old words have prior auto/quick records that are due now, so without the lane they would fill every page.
  const auto={},qs={};old.forEach((w,i)=>{auto[w]={last_at:new Date(now-3*D).toISOString(),stage:2,next_due:new Date(now-D-i*60000).toISOString(),last_result:'pass'};qs[w]={last:now-3*D,review_level:1,review_due:now-D-i*60000,last_result:'right',streak:1}});
  L.write('indo_automation_training_state_v1',auto);L.write('indo_quick_practice_state',qs);
  const st=L.coach.status('auto','baru1a',now);
  assert.equal(st.age,1,'Age is counted from first_seen, not last_seen');assert.equal(st.lane,true);
  assert.equal(L.coach.status('auto','hariini',now).lane,false,'Words taught today wait until tomorrow');
  assert.equal(L.coach.status('auto','baru40',now).lane,false,'Lane window is 30 days; older unverified words keep the normal order');
  assert.equal(L.coach.status('listen','baru1a',now).lane,false,'Listening is unchanged');
  const page=(mode,n)=>L.coach.candidates(mode,now).slice(0,n).map(x=>x.word);
  const isNew=w=>/^baru/.test(w);
  const a8=page('auto',8),q10=page('quick',10);
  assert.equal(a8.filter(isNew).length,3,'Auto: exactly the 3-word cap when enough new words exist');
  assert.equal(q10.filter(isNew).length,4,'Quick: exactly the 4-word cap');
  assert.ok(a8.filter(isNew).some(w=>/^baru[12]/.test(w))&&a8.filter(isNew).some(w=>/^baru[59]/.test(w)),'Recent and backlog words share the lane');
  assert.ok(q10.includes('baru9a'),'Backlog older than 7 days is not dropped');
  assert.equal(q10.filter(w=>!isNew(w)).length,6,'Due reviews keep at least 6 of 10 quick slots');
  // Recall signals: fail first, fast last; stale recall (older than the skill's own practice) ignored.
  L.write('indo_lesson_recall_v1',{version:1,words:{baru1c:{day:dd(0),result:'fail',at:new Date(now-H).toISOString()},baru1a:{day:dd(0),result:'fast',at:new Date(now-H).toISOString()},baru5b:{day:dd(0),result:'slow',at:new Date(now-H).toISOString()}}});
  const a8r=page('auto',8).filter(isNew);
  assert.ok(a8r.includes('baru1c')&&!a8r.includes('baru1a'),'Recall fail is picked first and fast drops behind other recent words');
  assert.ok(a8r.includes('baru5b'),'Slow backlog word outranks unrecalled backlog');
  assert.equal(L.coach.status('listen','baru1c',now).recall,'','Recall never alters listening');
  // Daily plan: <= 2 lane words of 8, never both on the same word, plan frozen for the day.
  const plan=L.coach.dailySession?L.coach.dailySession(now):L.coach.plan(now);
  const items=(plan.items||plan).map(x=>x.word);
  assert.ok(items.filter(isNew).length<=2&&items.filter(isNew).length>=1,'Daily plan uses at most 2 recent-new slots');
  assert.equal(new Set(items.filter(isNew)).size,items.filter(isNew).length,'Lane word is not repeated across skills in the plan');
  const cov=L.coach.newWordCoverage(now);
  assert.equal(cov.total,6,'Coverage counts words first taught 1-7 days ago');assert.equal(cov.auto,0);
  // Compat: with no first_seen anywhere the order equals the pre-lane order (covered by the tests above) and no lane exists.
  const C=app(['satu','dua']);assert.equal(C.coach.status('auto','satu',now).lane,false);assert.equal(C.coach.status('auto','satu',now).age,null);
  // Mastered new words never take a lane slot.
  const M=app(['kuasa'],[{word:'kuasa',last_mastered:new Date(now-D).toISOString()}]);M.root.DAILY_VOCAB_DB[0].first_seen=dd(2);
  assert.equal(M.coach.status('auto','kuasa',now).lane,false);assert.equal(M.coach.status('quick','kuasa',now).lane,false);
}
console.log('New-word lane tests passed: first_seen age, 4/3 caps with recent+backlog split, recall ordering, plan <= 2, coverage, compat.');
