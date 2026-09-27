#!/usr/bin/env node
'use strict';
/** Read-only integration probe against latest REAL main, never changes any production data. */
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const {plan}=require('./plan-lesson-publication');
const {verify}=require('./publish-staged-lesson');
const git=(...args)=>cp.execFileSync('git',args,{encoding:'utf8'}).trim();
const read=(sha,file)=>JSON.parse(git('show',sha+':'+file));
(async()=>{
 git('fetch','origin','main');
 const sha=git('rev-parse','origin/main');
 const date='2026-09-27',session='pm',target='data/daily/'+date+'-pm.json';
 const index=read(sha,'data/daily/index.json'),runtime=read(sha,'data/learning-runtime.json');
 const rules=read(sha,'data/learning-pool-rules.json'),lesson=read(sha,target);
 const p=plan({lesson,index,runtime,rules,expectedDate:date,expectedSession:session,mainHead:sha,publishedLesson:lesson});
 assert.equal(p.ok,true);assert.equal(p.status,'already_published');assert.deepEqual(p.files,[]);
 assert.equal(runtime.lesson_watermark,date+' 18:00');
 assert.equal(runtime.stats.master_unique,977);
 assert.equal(index.dates.filter(x=>x.date===date).length,1);
 assert.equal(index.dates.find(x=>x.date===date).pm,true);
 assert.deepEqual(lesson.new_words.filter(w=>runtime.new_pool.includes(w)),[]);
 // Real official JSON + derived state are wired through the publisher's final readback function.
 const api={readJson:async path=>path===target?lesson:index,runtime:async()=>runtime,
  syncStatus:async()=> 'success',pagesStatus:async()=> 'success'};
 const checked=await verify(api,{date,session,lesson,target,existing:true});
 assert.equal(checked.status,'VERIFIED_COMPLETE'); // Sync/Pages statuses are stubs here; live Actions checked separately.
 const bad=JSON.parse(JSON.stringify(lesson));bad.title+=' unapproved edit';
 const rejected=plan({lesson:bad,index,runtime,rules,expectedDate:date,expectedSession:session,mainHead:sha,publishedLesson:lesson});
 assert.equal(rejected.ok,false);assert.equal(rejected.errors[0].code,'ALREADY_PUBLISHED');
 console.log('REAL-MAIN READ-ONLY:',JSON.stringify({sha,date,watermark:runtime.lesson_watermark,master:runtime.stats.master_unique,
  unchangedDuplicate:'no-op',changedDuplicate:'blocked',lessonAndIndex:'consistent',taughtWordsExited:true}));
})().catch(e=>{console.error(e);process.exitCode=1});
