'use strict';
const fs=require('fs');
const vm=require('vm');
const assert=require('assert/strict');
const path=require('path');
const script=fs.readFileSync(path.resolve(__dirname,'../../data/vocab-profile-evidence.js'),'utf8');
const listeners=new Map(),stored=new Map();
const root={
 DAILY_VOCAB_DB:[{word:'tunda'},{word:'supaya'},{word:'niat'}],
 localStorage:{
  getItem(k){return stored.has(k)?stored.get(k):null},
  setItem(k,v){stored.set(k,String(v))}
 },
 addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn)},
 dispatchEvent(ev){(listeners.get(ev.type)||[]).forEach(fn=>fn(ev));return true}
};
const CustomEvent=function(type,o){this.type=type;this.detail=o&&o.detail};
vm.runInNewContext(script,{window:root,CustomEvent,console,Intl,Date,Set,Map,Object,Number,String,Array}, {filename:'vocab-profile-evidence.js'});
const api=root.VocabProfileEvidence;
assert.ok(api);
const ev=(source,word,at,result,stage)=>({id:[source,word,at,result,stage].join('|'),source,word,at,result,stage});
function add(...args){return api.capture(ev(...args));}
function summary(){return api.summarize();}
assert.equal(summary().attempts,0,'No fabricated results before observed training');
assert.equal(add('quick','not-taught','2026-09-25T02:00:00Z','right'),false,'Only formally taught words may count');
assert.equal(add('quick','supaya','2026-09-25T02:00:00Z','right'),true);
assert.equal(add('quick','supaya','2026-09-25T02:00:00Z','right'),false,'Duplicate events must be ignored');
assert.equal(add('quick','supaya','2026-09-25T03:00:00Z','right'),true);
assert.equal(summary().passive,0,'A single day never verifies passive recognition');
assert.equal(add('quick','supaya','2026-09-26T02:00:00Z','right'),true);
assert.equal(summary().passive,1,'Three successes across two dates confirm stable recognition');
assert.equal(add('quick','supaya','2026-09-26T03:00:00Z','wrong'),true);
assert.equal(summary().passive,0,'A later recognition failure invalidates the prior streak');
assert.equal(add('listen','niat','2026-09-25T02:00:00Z','fast_first'),true);
assert.equal(add('listen','niat','2026-09-25T03:00:00Z','slow'),true);
assert.equal(add('listen','niat','2026-09-26T02:00:00Z','fast_first'),true);
assert.equal(summary().passive,0,'Slow/replayed recognition must not count as fast-first');
assert.equal(add('listen','niat','2026-09-26T03:00:00Z','fast_first'),true);
assert.equal(summary().passive,1,'Fast first-hear recognition across days is passive evidence');
add('auto','tunda','2026-09-25T02:00:00Z','direct',1);
add('auto','tunda','2026-09-25T03:00:00Z','right',2);
add('auto','tunda','2026-09-25T04:00:00Z','right',3);
add('auto','tunda','2026-09-27T02:00:00Z','right',4);
assert.equal(summary().active,0,'One delayed-verification date is insufficient');
add('auto','tunda','2026-09-29T02:00:00Z','stable',4);
assert.equal(summary().active,1,'Independent production sequence plus cross-day delayed recall verifies active');
add('auto','tunda','2026-09-30T02:00:00Z','fail',4);
assert.equal(summary().active,0);
assert.equal(summary().forgotten,1,'A real failure after verification creates a forgotten signal');
add('auto','tunda','2026-09-30T03:00:00Z','direct',1);
add('auto','tunda','2026-09-30T04:00:00Z','right',2);
add('auto','tunda','2026-09-30T05:00:00Z','right',3);
add('auto','tunda','2026-10-02T02:00:00Z','right',4);
add('auto','tunda','2026-10-04T02:00:00Z','stable',4);
assert.equal(summary().active,1);
assert.equal(summary().forgotten,0);
assert.equal(summary().relearned,1,'Relearning requires a real second verification sequence');
assert.equal(summary().passive,1,'Active and passive word categories do not overlap');
assert.ok(stored.has('indo_vocab_profile_evidence_v2'),'Evidence must persist locally');
const before=summary().attempts;
root.dispatchEvent(new CustomEvent('quick-practice-updated',{detail:{word:'supaya',ok:true,state:{last:Date.parse('2026-10-05T02:00:00Z'),right:4,wrong:1}}}));
assert.equal(summary().attempts,before+1,'Real quick-practice event is captured');
const prior=summary().attempts;
root.dispatchEvent(new CustomEvent('listening-answer-recorded',{detail:{word:'niat',at:'2026-10-05T03:00:00Z',attempts:5,ok:true,fast_first:true}}));
assert.equal(summary().attempts,prior+1,'Real listening event is captured');
console.log('Local profile evidence tests passed: taught-only, dedupe, passive/active thresholds, errors, forgetting/relearning, persistence and module events.');
