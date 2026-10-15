#!/usr/bin/env node
'use strict';
// Tests for the 2026-10-15 natural-recurrence gate: check-recurrence.js evaluate(), clitic-aware matching,
// same-day 08:00 text counting for the 18:00 ranking, and the overused-in-text list. Synthetic data only.
const assert=require('node:assert/strict');
const {evaluate}=require('./check-recurrence');
const {naturalRecurrence,overusedInText,wordRe}=require('./review-rotation');
let n=0;const t=(name,fn)=>{try{fn();n++}catch(e){e.message=name+': '+e.message;throw e}};

const RT={review_pool:[['alpha',1,0,'','','甲','',''],['beta',2,0,'','','乙','','']],
  recurrence_pool:[['gamma',4,'丙'],['delta',4,'丁'],['eps',4,'戊'],['zeta',4,'己'],['eta',4,'庚']]};
const L=(date,session,extra)=>({date,session,vocab:[],review_vocab:[],sentences:[],...extra});
const list=['alpha','beta','gamma','delta','eps','zeta','eta'].map(w=>({word:w,cn:''}));

t('C1 counts words in reading, dialogue, sentences and examples; reaches the minimum',()=>{
  const c=L('2026-10-20','pm',{reading:{text:'Alpha dan beta.'},dialogue:{lines:[{id:'Gamma, ayo!'}]},sentences:[{text:'Ada delta.'}],vocab:[{word:'baru',example:'Eps di sini.'}]});
  const r=evaluate({candidate:c,list,minRequired:5});
  assert.equal(r.used_count,5);assert.equal(r.ok,true);assert.deepEqual(r.used,['alpha','beta','gamma','delta','eps']);
});
t('C2 too few fails and suggests the next unused words in list order',()=>{
  const r=evaluate({candidate:L('2026-10-20','am',{reading:{text:'Hanya alpha.'}}),list,minRequired:5});
  assert.equal(r.ok,false);assert.equal(r.used_count,1);assert.deepEqual(r.suggestions.slice(0,2),['beta','gamma']);
});
t('C3 core words never count, and quiz/output/rewrite text is not exposure',()=>{
  const c=L('2026-10-20','am',{vocab:[{word:'alpha',example:'Alpha lagi.'}],review_vocab:['beta'],cycle_vocab:[],
    reading:{text:'Beta di sini.'},quiz:[{question:'gamma?',options:['delta']}],output:{reference_answer:'eps'}});
  const r=evaluate({candidate:c,list,minRequired:2});
  assert.equal(r.used_count,0,'alpha/beta are core; gamma/delta/eps only in quiz/output');assert.equal(r.ok,false);
});
t('C4 enclitics count, other derivations do not',()=>{
  assert.ok(wordRe('alpha').test(' alphanya '));assert.ok(wordRe('alpha').test('alphalah.'));
  assert.ok(!wordRe('alpha').test(' alphabet '));assert.ok(!wordRe('alpha').test(' dialpha '));
  assert.ok(wordRe('ngejar deadline').test('lagi ngejar deadline nih'));
});
t('C5 required shrinks to the eligible list size when the list is short',()=>{
  const r=evaluate({candidate:L('2026-10-20','pm',{reading:{text:'alpha beta'}}),list:list.slice(0,2),minRequired:8});
  assert.equal(r.required,2);assert.equal(r.ok,true);
});
t('C6 overused words in the candidate are reported (warning only)',()=>{
  const r=evaluate({candidate:L('2026-10-20','pm',{reading:{text:'alpha beta gamma delta eps zeta'}}),list,minRequired:3,overused:[{word:'zeta',lessons:4}]});
  assert.deepEqual(r.overused_in_text_used,['zeta']);assert.equal(r.ok,true);
});
t('R1 18:00 ranking counts the same day 08:00 text; 08:00 ranking does not see itself',()=>{
  const hist=[L('2026-09-01','am',{vocab:['alpha','beta','gamma','delta','eps','zeta','eta'].map(w=>({word:w}))}),
    L('2026-10-20','am',{reading:{text:'Pagi ini gamma dan delta.'}})];
  const pm=naturalRecurrence({date:'2026-10-20',session:'pm',runtime:RT,longHistory:hist,count:10});
  const d=Object.fromEntries(pm.candidates.map(x=>[x.word,x.days_since_any_appearance]));
  assert.equal(d.gamma,0);assert.equal(d.delta,0);assert.equal(d.alpha,49);
  assert.deepEqual(pm.candidates.slice(-2).map(x=>x.word).sort(),['delta','gamma'],'words used this morning sink to the bottom');
  const am=naturalRecurrence({date:'2026-10-20',session:'am',runtime:RT,longHistory:hist,count:10});
  assert.equal(Object.fromEntries(am.candidates.map(x=>[x.word,x.days_since_any_appearance])).gamma,49);
});
t('R2 overusedInText: pending words in the text of >= max of the last window lessons',()=>{
  const hist=[1,2,3,4].map(i=>L('2026-10-1'+i,'am',{reading:{text:i<4?'alphanya dan beta':'beta saja'}}));
  const o=overusedInText({date:'2026-10-20',runtime:RT,longHistory:hist,window:6,max:3});
  assert.deepEqual(o,[{word:'beta',lessons:4},{word:'alpha',lessons:3}]);
  assert.deepEqual(overusedInText({date:'2026-10-20',runtime:RT,longHistory:hist,window:2,max:3}),[],'only the last `window` lessons count');
});
console.log('check-recurrence tests: '+n+' passed');
