#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {publish}=require('./publish-staged-lesson');
const date='2026-09-28',session='am',sha='a'.repeat(40),main='b'.repeat(40);
const lesson={date,session,vocab:[{word:'one'}]},index={dates:[{date,am:false,pm:false}]};
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
let tests=0;
function fixture(change={}){
 const state={blobs:[],commits:[],updated:[],stage:sha,lesson:JSON.parse(JSON.stringify(lesson)),
  index:JSON.parse(JSON.stringify(index)),runtime:{lesson_watermark:date+' 08:00',new_pool:[]},
  approval:{id:12,sha,conclusion:'success',preflight:'success',sync:'skipped'},commit:'c'.repeat(40),...change};
 const api={
  stageHead:async()=>state.stage,
  stageChanges:async()=>[{path:'staging/drafts/'+date+'-am.json',status:'added'}],
  stageApproval:async()=>state.approval,
  readJson:async(path,ref)=>ref===sha?state.lesson:path.endsWith('index.json')?state.index:state.lesson,
  mainSnapshot:async()=>({sha:main,tree:'d'.repeat(40),index:state.index,runtime:state.runtime,rules:{},publishedLesson:state.publishedLesson}),
  createBlob:async content=>{state.blobs.push(content);return ('e'.repeat(39)+state.blobs.length)},
  createTree:async(base,entries)=>{state.treeEntries=entries;return 'f'.repeat(40)},
  createCommit:async(message,tree,parent)=>{state.commits.push({message,tree,parent});return state.commit},
  updateMain:async commit=>{state.updated.push(commit);if(state.rejectRef){let e=Error('Update is not a fast forward');e.code=422;throw e}state.index.dates[0].am=true},
  runtime:async()=>state.runtime,
  syncStatus:async()=>state.sync||'success',
  pagesStatus:async()=>state.pages||'success'
 };
 const planner=()=>({ok:true,status:state.already?'already_published':'ready',candidateHash:digest(state.lesson),
 files:[{path:'data/daily/'+date+'-am.json',content:JSON.stringify(state.lesson)},{path:'data/daily/index.json',content:JSON.stringify(state.index)}]});
 return {state,api,planner};
}
async function test(label,fn){await fn();tests++;console.log('PASS '+label)}
(async()=>{
 await test('exact approved stage produces one two-file atomic commit',async()=>{
  const {state,api,planner}=fixture();const r=await publish(api,{date,session,stageSha:sha,planner});
  assert.equal(r.status,'VERIFIED_COMPLETE');assert.equal(state.commits.length,1);
  assert.equal(state.commits[0].parent,main);assert.equal(state.blobs.length,2);
  assert.deepEqual(state.treeEntries.map(x=>x.path),['data/daily/'+date+'-am.json','data/daily/index.json']);
  assert.deepEqual(state.updated,[state.commit]);
 });
 await test('unrelated main advancement is revalidated, not rejected solely by old SHA',async()=>{
  const {state,api,planner}=fixture();let r=await publish(api,{date,session,stageSha:sha,planner});
  assert.equal(r.status,'VERIFIED_COMPLETE');assert.equal(state.commits[0].parent,main);
 });
 await test('dry-run leaves main untouched',async()=>{
  const {state,api,planner}=fixture();let r=await publish(api,{date,session,stageSha:sha,dryRun:true,planner});
  assert.equal(r.status,'READY_DRY_RUN');assert.equal(state.blobs.length,0);assert.equal(state.updated.length,0);
 });
 await test('moved staging SHA is rejected before any write',async()=>{
  const {state,api,planner}=fixture({stage:'9'.repeat(40)});let r=await publish(api,{date,session,stageSha:sha,planner});
  assert.equal(r.status,'STAGE_MOVED');assert.equal(state.updated.length,0);
 });
 await test('preflight failure blocks publication',async()=>{
  const {state,api,planner}=fixture({approval:{id:12,sha,conclusion:'failure',preflight:'failure',sync:'skipped'}});
  let r=await publish(api,{date,session,stageSha:sha,planner});assert.equal(r.status,'PREFLIGHT_NOT_PASSED');assert.equal(state.updated.length,0);
 });
 await test('remote conflict returns recoverable state, never force pushes',async()=>{
  const {state,api,planner}=fixture({rejectRef:true});let r=await publish(api,{date,session,stageSha:sha,planner});
  assert.equal(r.status,'MAIN_REF_CONFLICT');assert.equal(state.updated.length,1);
 });
 await test('failed current main validation blocks',async()=>{
  const {state,api}=fixture();let r=await publish(api,{date,session,stageSha:sha,planner:()=>({ok:false,errors:[{code:'STALE_POOL'}]})});
  assert.equal(r.status,'PREFLIGHT_BLOCKED');assert.equal(state.updated.length,0);
 });
 await test('already-published matching content is verified without another commit',async()=>{
  const {state,api,planner}=fixture({already:true});state.index.dates[0].am=true;let r=await publish(api,{date,session,stageSha:sha,planner});
  assert.equal(r.status,'VERIFIED_COMPLETE');assert.equal(r.existing,true);assert.equal(state.blobs.length,0);
 });
 await test('runtime watermark pending does not falsely report success',async()=>{
  const {state,api,planner}=fixture();state.runtime.lesson_watermark='2026-09-27 18:00';
  let r=await publish(api,{date,session,stageSha:sha,planner});assert.equal(r.status,'PUBLISHED_PENDING_SYNC');
 });
 await test('AM new word still in pool blocks verified status',async()=>{
  const {state,api,planner}=fixture();state.runtime.new_pool=['one'];
  let r=await publish(api,{date,session,stageSha:sha,planner});assert.equal(r.status,'PUBLISHED_PENDING_SYNC');
 });
 await test('pages pending is reported separately',async()=>{
  const {state,api,planner}=fixture({pages:'pending'});
  let r=await publish(api,{date,session,stageSha:sha,planner});assert.equal(r.status,'PAGES_PENDING');
 });
 await test('invalid input blocks without tools',async()=>{
  let r=await publish({}, {date:'invalid',session,stageSha:sha});assert.equal(r.status,'INVALID_INPUT');
 });
 console.log('Fixed publisher:',tests,'passed, 0 failed');
})().catch(e=>{console.error(e);process.exitCode=1});
