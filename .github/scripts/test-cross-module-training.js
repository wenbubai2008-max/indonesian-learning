'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const read=name=>fs.readFileSync(path.resolve(__dirname,'../../data/'+name),'utf8');
const eventHandlers=new Map(),store=new Map();
const root={
 DAILY_VOCAB_DB:[{word:'tunda',cn:'推迟'}],UNFAMILIAR_VOCAB_DB:[],
 localStorage:{getItem(k){return store.get(k)||null},setItem(k,v){store.set(k,String(v))},removeItem(k){store.delete(k)}},
 addEventListener(k,fn){const arr=eventHandlers.get(k)||[];arr.push(fn);eventHandlers.set(k,arr)},
 dispatchEvent(e){(eventHandlers.get(e.type)||[]).forEach(fn=>fn(e));return true}
};
const CustomEvent=function(type,o){this.type=type;this.detail=o&&o.detail};
vm.runInNewContext(read('weakness-pool.js'),{window:root,localStorage:root.localStorage,CustomEvent,Date,Map,Set,Object,String,Number,Array},{filename:'weakness-pool.js'});
const wp=root.WeaknessPool;
wp.recordPractice('tunda',false,{word:'tunda',cn:'推迟'});
for(let i=0;i<3;i++)wp.recordPractice('tunda',true,{word:'tunda',cn:'推迟'});
assert.equal(wp.get('tunda').right_streak,3);
assert.equal(wp.get('tunda').status,'active','Three recognition choices must not falsely mark a word mastered');
assert.equal(wp.get('tunda').mastered_reason,'');
wp.markMastered('tunda','explicit_user_mastered');
assert.equal(wp.get('tunda').status,'mastered','Explicit manual marking still works outside automatic practice');

// Weak-list filtering and its "I know" button must not mutate the authoritative mastery state.
const weakPage=read('weakness-paging-roots.js'),eligStart=weakPage.indexOf('  function eligibleRecords(){'),eligEnd=weakPage.indexOf('  function activeMapSnapshot(){',eligStart);
assert.ok(eligStart>0&&eligEnd>eligStart);
const weakRecords=[
 {word:'tunda',status:'active',reasons:['quick_wrong']},
 {word:'baru',status:'active',reasons:['manual_unknown']},
 {word:'lain',status:'active',reasons:['quick_wrong']}
];
let pending=new Set(['tunda']),hidden={baru:true};
const pageContext={
 pool:()=>({listActive:()=>weakRecords}),paused:()=>hidden,allowedSource:x=>x.status==='active'&&x.reasons.some(r=>['quick_wrong','manual_unknown'].includes(r)),
 window:{VocabStudyCoach:{pendingSet:()=>pending}},norm:s=>String(s||'').toLowerCase(),Set
};
const visible=vm.runInNewContext(weakPage.slice(eligStart,eligEnd)+"\neligibleRecords()",pageContext);
assert.deepEqual(Array.from(visible.map(x=>x.word)),['lain'],'Pending verification and paused untaught words are hidden only from this special list');
const actionStart=weakPage.indexOf('  function dismiss(word){'),actionEnd=weakPage.indexOf('  function pauseWord(word){',actionStart);
assert.ok(actionStart>0&&actionEnd>actionStart);
let requested=0,rendered=0;
vm.runInNewContext(weakPage.slice(actionStart,actionEnd)+"\ndismiss('tunda')",{
 window:{VocabStudyCoach:{requestVerification(word){requested++;return word==='tunda'}}},
 makeSession(){},render(){rendered++}
});
assert.equal(requested,1);
assert.equal(rendered,1,'Requesting verification should refresh the weak list');
assert.equal(wp.get('tunda').status,'mastered','The isolated button test must not independently change authoritative status');

// Extract the actual listening contrast chooser and supply a deterministic candidate pool.
const listening=read('listening-word-training.js'),start=listening.indexOf('  function nearestUnused(word){'),end=listening.indexOf('  function choicesFor(item){',start);
assert.ok(start>0&&end>start,'Listening contrast chooser boundaries must remain identifiable');
const fragment=listening.slice(start,end);
const pool=[{word:'mendukung'},{word:'menunduk'}],state={pool,queue:[pool[0]],pos:0};
const contrast=(allowed)=>vm.runInNewContext(fragment+"\nnearestUnused('mendukung')",{state,rootCoachEligible:()=>new Set(allowed),soundSimilarity:()=>0.85,Set});
assert.equal(contrast(['mendukung']),null,'An unassigned similar word cannot be inserted as a scored question');
assert.equal(contrast(['mendukung','menunduk']).word,'menunduk','A genuinely assigned similar word may be selected');
state.queue.push(pool[1]);
assert.equal(contrast(['mendukung','menunduk']),null,'A word already in the queue cannot be duplicated');

// Run the real automatic-training recorder on stage 3, preserving the self-check origin.
const automation=read('automation-training.js'),a=automation.indexOf('  function record(word,stage,result,item){'),b=automation.indexOf('  function markPlanDone(word,result){',a);
assert.ok(a>0&&b>a,'Automatic recorder boundaries must remain identifiable');
const states={},recordSrc=automation.slice(a,b);
const recorded=vm.runInNewContext(recordSrc+"\nrecord('tunda',3,{ok:true,kind:'self_checked'},{word:'tunda'})",{
 stateMap:()=>states,saveState:s=>Object.assign(states,s),norm:s=>String(s||'').toLowerCase(),Date,
 HOUR:3600000,DAY:86400000,window:{dispatchEvent(){return true},WeaknessPool:null},CustomEvent,Number,Object
});
assert.equal(recorded.last_result,'self_checked','Stage 3 must retain user-confirmed status, not rewrite to machine-graded right');
assert.equal(recorded.stage,4,'Self-checked practice advances to delayed verification');
console.log('Cross-module tests passed: choice-only no auto-mastery; weak-list pending/pause semantics; scored listening contrasts respect assignments; stage-three user self-check remains explicit.');
