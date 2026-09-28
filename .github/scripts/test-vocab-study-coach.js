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

assert.equal(data.has('data/daily-vocab-data.js'),false,'Scheduling must not mutate lesson data');
console.log('Study coach tests passed: stable bounded daily assignments, shared module queues, answer completion, cooldown, next-day validation and no lesson mutation.');
