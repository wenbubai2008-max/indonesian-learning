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
 const index=read(sha,'data/daily/index.json'),runtime=read(sha,'data/learning-runtime.json');
 const latest=index.dates.filter(x=>x.am||x.pm).sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
 const date=latest.date,session=latest.pm?'pm':'am',target='data/daily/'+date+'-'+session+'.json';
 const rules=read(sha,'data/learning-pool-rules.json'),lesson=read(sha,target);
 const p=plan({lesson,index,runtime,rules,expectedDate:date,expectedSession:session,mainHead:sha,publishedLesson:lesson});
 assert.equal(p.ok,true);assert.equal(p.status,'already_published');assert.deepEqual(p.files,[]);
 assert.equal(runtime.lesson_watermark,date+' '+(session==='am'?'08:00':'18:00'));
 assert.equal(runtime.stats.master_unique,977);
 assert.equal(index.dates.filter(x=>x.date===date).length,1);
 assert.equal(index.dates.find(x=>x.date===date)[session],true);
 const newWords=Array.isArray(lesson.new_words)?lesson.new_words:lesson.vocab.map(v=>v.word);
 assert.deepEqual(newWords.filter(w=>runtime.new_pool.includes(w)),[]);
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
