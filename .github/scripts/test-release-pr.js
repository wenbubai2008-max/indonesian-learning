#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {inspect}=require('./check-release-pr');
const {plan}=require('./plan-lesson-publication');
const {collectReviewHistory}=require('./validate-lesson-candidate');
const {makeAm,makePm}=require('./test-lesson-candidate');
const clone=x=>JSON.parse(JSON.stringify(x));
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const base='a'.repeat(40),head='b'.repeat(40);
let passed=0;
function test(label,fn){fn();passed++;console.log('PASS '+label)}
function fixture(make){
 const x=make(),date=x.expectedDate,session=x.expectedSession,prev='2026-09-27';
 const lessonPath='data/daily/'+date+'-'+session+'.json';
 const sources={'data/daily/index.json':clone(x.index),'data/learning-runtime.json':clone(x.runtime),
  'data/learning-pool-rules.json':clone(x.rules)};
 for(const row of x.index.dates){
  for(const slot of ['am','pm'])if(row[slot]===true){
   let v=row.date===date&&slot==='am'?x.sameDayAm:row.date===prev&&slot==='pm'?x.previousPm:null;
   if(!v)v={date:row.date,session:slot,review_vocab:[],vocab:[],new_words:[],write_status:'lesson_complete'};
   sources['data/daily/'+row.date+'-'+slot+'.json']=clone(v);
  }
 }
 const ctx={target:{date,session,time:session==='am'?'08:00':'18:00',day:x.lesson.day},
  source:{rules_version:4,runtime_version:4,master_unique:977,
   runtime_generated_at:x.runtime.generated_at,lesson_watermark:x.runtime.lesson_watermark,index_updated:x.index.updated,
   runtime_hash:hash(x.runtime),index_hash:hash(x.index),rules_hash:hash(x.rules)}};
 sources['data/lesson-context.json']=ctx;
 const history=collectReviewHistory(x.index,date,session,p=>sources[p]);
 const p=plan({...x,reviewHistory:history,mainHead:base});
 assert.equal(p.ok,true,JSON.stringify(p.errors));
 const release=clone(sources);
 release[lessonPath]=clone(x.lesson);
 release['data/daily/index.json']=JSON.parse(p.files[1].content);
 const state={base: sources,head:release,baseSha:base,headSha:head,branch:'lesson-release-'+date+'-'+session,
  files:[lessonPath,'data/daily/index.json']};
 const read=(ref,path,required=true)=>{
  const doc=state[ref===base?'base':'head'][path];
  if(doc===undefined&&required)throw Error('Missing '+path);
  return doc===undefined?undefined:clone(doc);
 };
 return {state,read,lessonPath,check:()=>inspect({...state,read})};
}
function has(report,code){assert.equal(report.ok,false,JSON.stringify(report));assert(report.errors.some(x=>x.code===code),JSON.stringify(report.errors))}
test('AM valid exact two-file release',()=>assert.equal(fixture(makeAm).check().status,'ready'));
test('PM valid exact two-file release',()=>assert.equal(fixture(makePm).check().status,'ready'));
test('partial write (only lesson) cannot merge',()=>{const f=fixture(makeAm);f.state.files=[f.lessonPath];has(f.check(),'RELEASE_FILES_INVALID')});
test('partial write (only index) cannot merge',()=>{const f=fixture(makeAm);f.state.files=['data/daily/index.json'];has(f.check(),'RELEASE_FILES_INVALID')});
test('unrelated third path cannot merge',()=>{const f=fixture(makeAm);f.state.files.push('data/daily-vocab-data.js');has(f.check(),'RELEASE_FILES_INVALID')});
test('malformed question blocked',()=>{const f=fixture(makeAm);delete f.state.head[f.lessonPath].quiz[0].answer_index;has(f.check(),'QUESTION_INVALID')});
test('unknown word blocked',()=>{const f=fixture(makeAm);f.state.head[f.lessonPath].vocab[0].word='unapproved';has(f.check(),'NEW_WORD_INELIGIBLE')});
test('index historical edit blocked',()=>{const f=fixture(makeAm);f.state.head['data/daily/index.json'].dates[0].pm=false;has(f.check(),'INDEX_TRANSACTION_MISMATCH')});
test('index counterpart session preserved',()=>{const f=fixture(makePm);f.state.head['data/daily/index.json'].dates.at(-1).am=false;has(f.check(),'INDEX_TRANSACTION_MISMATCH')});
test('context source stale blocked',()=>{const f=fixture(makeAm);f.state.base['data/lesson-context.json'].source.runtime_hash='x';has(f.check(),'CONTEXT_SOURCE_MISMATCH')});
test('target day mismatch blocked',()=>{const f=fixture(makeAm);f.state.base['data/lesson-context.json'].target.day=99;has(f.check(),'CONTEXT_TARGET_MISMATCH')});
test('duplicate already-published AM blocked',()=>{const f=fixture(makeAm);f.state.base['data/daily/index.json'].dates.at(-1).am=true;has(f.check(),'ALREADY_PUBLISHED')});
test('orphan published file is not overwritten',()=>{const f=fixture(makeAm);f.state.base[f.lessonPath]=clone(f.state.head[f.lessonPath]);has(f.check(),'OFFICIAL_ALREADY_EXISTS')});
test('main data conflict blocks stale candidate',()=>{const f=fixture(makeAm);f.state.base['data/learning-runtime.json'].lesson_watermark='2000-01-01 08:00';has(f.check(),'CONTEXT_SOURCE_MISMATCH')});
test('branch identity mismatch blocked',()=>{const f=fixture(makeAm);f.state.branch='lesson-release-2026-09-27-am';has(f.check(),'RELEASE_FILES_INVALID')});
test('non-release branch blocked',()=>{const f=fixture(makeAm);f.state.branch='lesson-staging-v1';has(f.check(),'RELEASE_BRANCH_INVALID')});
test('identical SHA blocked',()=>{const f=fixture(makeAm);f.state.headSha=base;has(f.check(),'REF_INVALID')});
test('source or draft absent blocked, no accidental publish',()=>{const f=fixture(makeAm);delete f.state.head[f.lessonPath];has(f.check(),'RELEASE_INPUT_INVALID')});
console.log('Release PR gate:',passed,'passed, 0 failed');
