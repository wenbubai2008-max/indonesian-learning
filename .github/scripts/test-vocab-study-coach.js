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
const first=c.round('quick',start,false,2).map(r=>r.word);
assert.deepEqual(Array.from(c.round('quick',start,false,2).map(r=>r.word)),first,'Refresh preserves unanswered round');
x.quick(first[0],true,start);
assert.equal(c.statistics('quick',start).today,1);
assert.equal(c.statistics('listen',start).today,0,'Visual answer cannot complete listening');
assert.ok(c.eligible(first[0],start,'listen'));
assert.ok(c.eligible(first[0],start,'auto'));
assert.deepEqual(Array.from(c.round('quick',start,false,2).map(r=>r.word)),[first[1]],'Refresh resumes pending card');
x.quick(first[1],true,start);
assert.equal(c.round('quick',start,false,2).length,0,'Completed round waits for explicit next batch');
assert.equal(c.round('quick',start,true,2).length,1,'Next batch pulls another eligible due word');
assert.equal(c.dailyProgress(start).done,1,'An answered priority task counts per mode and word, not mastery');
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
x.listen('niat','fast_first',start);
x.listen('niat','fast_first',start+2*D);
x.listen('niat','fast_first',start+9*D);
assert.equal(c.status('listen','niat',start+9*D).stable,true);
assert.equal(c.status('quick','niat',start+9*D).level,0,'Auditory success cannot graduate visual recognition');
const y=app(['tunda','niat']);const yc=y.coach;
y.write('indo_automation_training_state_v1',{tunda:{last_at:start,next_due:start+48*H,status:'active',stage:4}});
y.quick('tunda',false,start+H);
assert.equal(yc.eligible('tunda',start+25*H,'auto'),false,'Quick mistake cannot override active-stage delay');
assert.equal(yc.eligible('tunda',start+48*H,'auto'),true);
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
console.log('Study coach tests passed: independent abilities and due dates, 2/7/30-day ladder, backlog, persistent rounds, legacy mastery, requested verification.');
