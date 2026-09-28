'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const script=fs.readFileSync(path.resolve(__dirname,'../../data/vocab-study-coach.js'),'utf8');
const data=new Map(),events=new Map();
const root={
 DAILY_VOCAB_DB:[{word:'mendukung',cn:'支持'},{word:'niat',cn:'意图'},{word:'tunda',cn:'推迟'}],
 localStorage:{getItem(k){return data.has(k)?data.get(k):null},setItem(k,v){data.set(k,String(v))}},
 addEventListener(k,fn){const list=events.get(k)||[];list.push(fn);events.set(k,list)},
 dispatchEvent(e){(events.get(e.type)||[]).forEach(fn=>fn(e));return true},
 WeaknessPool:{focusMap(){return {mendukung:{word:'mendukung',reasons:['quick_wrong']},niat:{word:'niat',reasons:['listening_wrong']}}}},
 VocabProfileEvidence:{records(){return []},summarize(){return {words:[]}}}
};
const CustomEvent=function(type,opts){this.type=type;this.detail=opts&&opts.detail};
vm.runInNewContext(script,{window:root,CustomEvent,Date,Map,Set,Object,String,Number,Array,Intl}, {filename:'vocab-study-coach.js'});
const coach=root.VocabStudyCoach;
const now=Date.parse('2026-09-28T10:00:00Z');
assert.deepEqual(Array.from(coach.plan(now).map(x=>x.word)),['niat','mendukung'],'Rank weak listening and active failures before unrelated taught words');
assert.equal(coach.plan(now).length,2,'Never pad the queue with unqualified words');
assert.deepEqual(Array.from(coach.assigned('listen',now).map(x=>x.word)),['niat']);
assert.deepEqual(Array.from(coach.assigned('auto',now).map(x=>x.word)),['mendukung']);
assert.equal(coach.assigned('quick',now).length,0,'The generic quick module must not invent a separate random queue');
assert.deepEqual(Array.from(coach.quickSupplement(now).map(x=>x.word)),['tunda'],'Quick practice remains available from unassigned, formally taught due words even if priority assigns zero quick tasks');
assert.deepEqual(Array.from(coach.quickSupplement(now).map(x=>x.word)),['tunda'],'Optional quick batch stays fixed on refresh');
assert.equal(coach.dailyProgress(now).total,2,'Optional quick choices do not create a ninth priority task');
const beforeOptionalRecords=root.VocabProfileEvidence.records;
root.VocabProfileEvidence.records=()=>[{id:'optional-tunda',word:'tunda',source:'quick',at:new Date(now+60000).toISOString(),result:'right',stage:0}];
root.dispatchEvent(new CustomEvent('vocab-profile-evidence-updated',{detail:{word:'tunda'}}));
assert.equal(coach.dailyProgress(now+60000).done,0,'An optional answer cannot falsely complete one of the assigned priority tasks');
assert.equal(coach.quickSupplement(now+60000).length,0,'Optional answer enters shared cooldown instead of instant refill');
root.VocabProfileEvidence.records=beforeOptionalRecords;
assert.equal(coach.dailyProgress(now).total,2);
assert.equal(coach.detail('niat',now).mode,'listen');
assert.equal(coach.detail('mendukung',now).mode,'auto');
assert.equal(coach.detail('not-taught',now),null);
data.set('indo_quick_practice_state',JSON.stringify({mendukung:{last:now-30*60*1000,last_result:'wrong',wrong:2,streak:0}}));
root.VocabProfileEvidence.records=()=>[{word:'mendukung',source:'quick',at:new Date(now-30*60*1000).toISOString(),result:'wrong',id:'q1',stage:0}];
assert.equal(coach.eligible('mendukung',now),false,'Wrong answer gets a real cross-module cooling period');
assert.equal(coach.eligible('mendukung',now+3*3600000),true);
assert.equal(coach.plan(now).some(x=>x.word==='mendukung'),false,'Recently answered word must not be repeated in today queue immediately');
const recent=root.VocabProfileEvidence.records;
root.VocabProfileEvidence.records=()=>recent().concat([{id:'niat-done',word:'niat',source:'listen',at:new Date(now+60000).toISOString(),result:'wrong',stage:0}]);
root.dispatchEvent(new CustomEvent('vocab-profile-evidence-updated',{detail:{word:'niat'}}));
assert.equal(coach.dailyProgress(now+60000).done,1,'An actual answer closes a task for that day');
assert.equal(coach.assigned('listen',now+60000).length,0,'Completed listening task cannot reappear in another generic draw');
root.VocabProfileEvidence.records=recent;
assert.equal(coach.requestVerification('not-taught',now),false);
assert.equal(coach.requestVerification('tunda',now),true);
assert.equal(coach.quickSupplement(now).length,0,'Reserved delayed-verification words must not leak into self-directed quick choices');
assert.equal(coach.eligible('tunda',now),false,'User-marked known must not be auto-mastered or immediately tested');
const due=coach.detail('tunda',now+86400000);
assert.equal(due.ready,true);assert.equal(due.requested,true);assert.equal(due.stage,1);
const prev=root.VocabProfileEvidence.records;
root.VocabProfileEvidence.records=()=>prev().concat([{id:'q-tunda',word:'tunda',source:'quick',at:new Date(now+3600000).toISOString(),result:'right',stage:0}]);
assert.equal(coach.detail('tunda',now+86400000).requested,true,'Quick recognition cannot silently cancel a pending active verification');
root.VocabProfileEvidence.records=prev;
data.set('indo_listen_stats_v1',JSON.stringify({niat:{last_at:new Date(now-5*60000).toISOString(),last_result:'wrong',wrong_streak:2}}));
assert.equal(coach.eligible('niat',now),false,'Existing listening timestamps protect cooldown without forging older events');
root.dispatchEvent(new CustomEvent('automation-training-updated',{detail:{word:'tunda',state:{last_at:now+3600000}}}));
assert.equal(coach.detail('tunda',now+86400000).requested,true,'An early or unverified attempt must not cancel the next-day verification');
assert.ok(coach.plan(now+86400000).some(x=>x.word==='tunda'),'Next-day reservation enters the unified queue at its due time');
root.dispatchEvent(new CustomEvent('automation-training-updated',{detail:{word:'tunda',state:{last_at:now+86400000}}}));
assert.equal(coach.detail('tunda',now+86400000).requested,false,'A real due-time attempt clears its verification request');

// Fairness: with six equally weak and due words, no group should monopolize all three active slots forever.
const rotationStore=new Map();
const rotationWords=['alpha','bravo','charlie','delta','echo','foxtrot'];
const rotationRoot={
 DAILY_VOCAB_DB:rotationWords.map(word=>({word,cn:word})),
 localStorage:{getItem(k){return rotationStore.has(k)?rotationStore.get(k):null},setItem(k,v){rotationStore.set(k,String(v))}},
 addEventListener(){},dispatchEvent(){return true},
 WeaknessPool:{focusMap(){return Object.fromEntries(rotationWords.map(word=>[word,{word,reasons:['dont']}]))}},
 VocabProfileEvidence:{records(){return []},summarize(){return {words:[]}}}
};
vm.runInNewContext(script,{window:rotationRoot,CustomEvent,Date,Map,Set,Object,String,Number,Array,Intl},{filename:'vocab-study-coach-rotation.js'});
const rotation=rotationRoot.VocabStudyCoach,start=Date.parse('2026-10-06T10:00:00Z');
const first=Array.from(rotation.plan(start).map(x=>x.word));
assert.equal(first.length,3,'Daily active cap stays in place');
assert.deepEqual(Array.from(rotation.plan(start+3600000).map(x=>x.word)),first,'Same-day refresh does not reshuffle');
const second=Array.from(rotation.plan(start+86400000).map(x=>x.word));
assert.equal(second.length,3);
assert.equal(second.some(word=>first.includes(word)),false,'Next day must give previously unserved eligible weak words a chance');
assert.ok(rotationStore.has('indo_vocab_coach_rotation_v1'),'Selection history persists independently of one daily plan');
assert.equal(rotation.requestVerification(first[0],start+86400000),true);
assert.equal(rotation.detail(first[0],start+86400000).ready,false,'Self-mark only reserves next-day verification');
assert.ok(rotation.plan(start+2*86400000).some(x=>x.word===first[0]),'Delayed verification overrides normal rotation penalty');

assert.equal(data.has('data/daily-vocab-data.js'),false,'Scheduling must not mutate lesson data');
console.log('Study coach tests passed: priority quick zero still gives safe optional recognition, no extra task completion, cooldown, multi-day rotation and delayed verification.');
