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
t('C3 core words never count; quiz options are not exposure, but output and rewrite reference answers are',()=>{
  const c=L('2026-10-20','am',{vocab:[{word:'alpha',example:'Alpha lagi.'}],review_vocab:['beta'],cycle_vocab:[],
    reading:{text:'Beta di sini.'},quiz:[{question:'gamma?',options:['delta']}],output:{reference_answer:'Ada eps.'}});
  const r=evaluate({candidate:c,list,minRequired:2});
  assert.deepEqual(r.used,['eps'],'alpha/beta are core; gamma/delta only in the quiz; eps in the output answer counts');assert.equal(r.ok,false);
  const p=L('2026-10-20','pm',{rewrite:[{reference_answer:'Zeta dan eta.'}]});
  assert.deepEqual(evaluate({candidate:p,list,minRequired:2}).used,['zeta','eta']);
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
const {evaluateGroup}=require('./check-recurrence');
const {rank}=require('./review-rotation');
const rootOf=new Map([['mengeluh','keluh'],['ngeluh','keluh'],['keluhan','keluh'],['susah','susah'],['nyusahin','susah'],['tinggi','tinggi']]);
t('G1 group gate: fails when a group was available and the review words have none; passes with a same-root pair',()=>{
  const groups=[{root:'keluh',words:['mengeluh','ngeluh']}];
  assert.equal(evaluateGroup({candidate:{session:'am',review_vocab:['tinggi','susah']},groups,rootOf}).ok,false);
  const ok=evaluateGroup({candidate:{session:'am',review_vocab:['tinggi','susah','nyusahin']},groups,rootOf});
  assert.equal(ok.ok,true,'any same-root pair counts, not only the listed group');assert.deepEqual(ok.used_groups,[{root:'susah',words:['susah','nyusahin']}]);
  assert.equal(evaluateGroup({candidate:{session:'am',review_vocab:['tinggi']},groups:[],rootOf}).ok,true,'no group available: nothing required');
  assert.equal(evaluateGroup({candidate:{session:'am',review_vocab:['tinggi']},groups,rootOf,required:false}).ok,true,'group listed but the ranker could not fit it (fresh errors / focus quota): nothing required');
  const pm={session:'pm',vocab:[{word:'mengeluh',source_group:'review'},{word:'ngeluh',source_group:'application'},{word:'tinggi',source_group:'review'}]};
  assert.equal(evaluateGroup({candidate:pm,groups,rootOf}).ok,false,'PM counts source_group=review only');
});
// Ranker: groups come only from usable words; a group never pushes out a fresh error; the PM focus minimum holds.
const RROW=(w,p,root,extra={})=>[w,p,extra.wrong||0,extra.lastWrong||'','','',root,''];
const RRT={generated_at:'2026-10-20T10:00:00Z',focus_pool:[['f1',90],['f2',80],['f3',70]],
  review_pool:[RROW('f1',1,'a'),RROW('f2',1,'b'),RROW('f3',1,'c'),RROW('x1',2,'d'),RROW('x2',2,'e'),
   RROW('mengeluh',3,'keluh'),RROW('ngeluh',3,'keluh'),RROW('keluhan',3,'keluh'),RROW('err',2,'g',{wrong:2,lastWrong:'2026-10-19T10:00:00Z'})]};
const ROT={enabled:true,effective_date:'2026-09-28',lookback_days:7,focus_quota:{enabled:true,effective_date:'2026-10-04',min:2,max:3},
  recent_core:{enabled:true,effective_date:'2026-10-04',window_days:4,max_per_pm:2}};
t('R3 ranker puts one same-root group into the recommendation without dropping focus words',()=>{
  const out=rank({date:'2026-10-20',session:'pm',runtime:RRT,rotation:ROT,reviewHistory:[],reviewCount:5});
  const rec=out.recommended_review;
  assert.equal(out.review_group_applied,'keluh');assert.ok(rec.filter(w=>['mengeluh','ngeluh','keluhan'].includes(w)).length>=2,rec.join(','));
  assert.ok(rec.filter(w=>['f1','f2','f3'].includes(w)).length>=2,'PM focus minimum kept: '+rec.join(','));
  assert.equal(rec.length,5);assert.ok(out.review_groups.some(g=>g.root==='keluh'));
});
t('R5 a group never displaces fresh errors or the PM focus minimum: then review_group_applied is null',()=>{
  const rt={...RRT,review_pool:[...RRT.review_pool,RROW('err2',2,'h',{wrong:1,lastWrong:'2026-10-19T11:00:00Z'})]};
  const rot={...ROT,exposure_ledger:{enabled:true,effective_date:'2026-10-08'}};
  const out=rank({date:'2026-10-20',session:'pm',runtime:rt,rotation:rot,reviewHistory:[],reviewCount:5});
  const fresh=out.recommended_detail.filter(x=>x.fresh).map(x=>x.word);
  assert.ok(fresh.length>=2,'fresh errors kept: '+out.recommended_review.join(','));
  assert.ok(out.recommended_review.filter(w=>['f1','f2','f3'].includes(w)).length>=2);
  if(out.review_group_applied==null)assert.ok(out.review_groups.some(g=>g.root==='keluh'),'group still listed for information');
});
t('R4 AM ranking applies a group too, and with no same-root words nothing changes',()=>{
  const am=rank({date:'2026-10-20',session:'am',runtime:RRT,rotation:ROT,reviewHistory:[],reviewCount:5});
  assert.equal(am.review_group_applied,'keluh');
  const flat={...RRT,review_pool:RRT.review_pool.filter(r=>r[6]!=='keluh')};
  const a=rank({date:'2026-10-20',session:'am',runtime:flat,rotation:ROT,reviewHistory:[],reviewCount:5});
  assert.equal(a.review_group_applied,null);assert.deepEqual(a.review_groups,[]);
});
console.log('check-recurrence tests: '+n+' passed');
