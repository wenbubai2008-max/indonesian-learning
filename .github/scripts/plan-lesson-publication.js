#!/usr/bin/env node
'use strict';
/** Pure, read-only Stage-2 publication planner. Never writes main or daily-vocab. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {validate,collectReviewHistory}=require('./validate-lesson-candidate');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const json=value=>JSON.stringify(value,null,2)+'\n';
const fail=(code,detail)=>({ok:false,errors:[{code,detail}]});
function plan(input){
 const {lesson,index,runtime,rules,expectedDate:date,expectedSession:session,mainHead,sameDayAm,previousPm,reviewHistory}=input||{};
 if(typeof mainHead!=='string'||!/^[a-f0-9]{40}$/i.test(mainHead))return fail('MAIN_HEAD_REQUIRED','Pin the current main commit SHA');
 if(!lesson||!index||!runtime||!rules)return fail('INPUT_INVALID','Missing candidate or baseline');
 const target='data/daily/'+date+'-'+session+'.json';
 const row=(Array.isArray(index.dates)?index.dates:[]).find(x=>x&&x.date===date);
 if(row&&row[session]===true){
  const published=input.publishedLesson;
  if(published&&JSON.stringify(published)===JSON.stringify(lesson))
   return {ok:true,status:'already_published',mainHead,target,files:[],candidateHash:hash(lesson)};
  return fail('ALREADY_PUBLISHED','Target already marked complete; no overwrites');
 }
 const gate=validate({lesson,index,runtime,rules,expectedDate:date,expectedSession:session,sameDayAm,previousPm,reviewHistory});
 if(!gate.ok)return {...gate,status:'blocked'};
 const next=JSON.parse(JSON.stringify(index));
 let current=next.dates.find(x=>x&&x.date===date);
 if(!current){current={date,am:false,pm:false,verified:'generated_daily_lesson',day:lesson.day};next.dates.push(current)}
 if(current.day!=null&&current.day!==lesson.day)return fail('DAY_MISMATCH','Existing index day differs from candidate');
 current.day=lesson.day;current.verified=current.verified||'generated_daily_lesson';
 current[session]=true;current[session+'_day']=lesson.day;current[session+'_status']=session==='am'?'generated':'lesson_complete';
 next.updated=next.dates.map(x=>x.date).filter(Boolean).sort().at(-1);
 return {
  ok:true,status:'ready',mainHead,date,session,target,
  baselineFingerprint:hash({index,runtime,rules}),candidateHash:hash(lesson),
  requiresFreshMain:true,requiresSuccessfulStageCheck:true,
  files:[{path:target,content:json(lesson)},{path:'data/daily/index.json',content:json(next)}],errors:[]
 };
}
function args(a){const x={};for(let i=0;i<a.length;i+=2){if(!/^--[a-z-]+$/.test(a[i])||!a[i+1])throw Error('Expected --key value');x[a[i].slice(2)]=a[i+1]}return x}
function read(f){return JSON.parse(fs.readFileSync(path.resolve(process.cwd(),f),'utf8'))}
function maybe(f){return fs.existsSync(path.resolve(process.cwd(),f))?read(f):undefined}
if(require.main===module){
 try{
  const a=args(process.argv.slice(2));
  if(!a.candidate||!a.date||!a.session||!a['main-head'])throw Error('Required --candidate --date --session --main-head');
  const prev=new Date(Date.parse(a.date+'T00:00:00Z')-86400000).toISOString().slice(0,10);
  const result=plan({
   lesson:read(a.candidate),index:read(a.index||'data/daily/index.json'),runtime:read(a.runtime||'data/learning-runtime.json'),
   rules:read(a.rules||'data/learning-pool-rules.json'),
   sameDayAm:maybe(a['same-day-am']||'data/daily/'+a.date+'-am.json'),
   previousPm:maybe(a['previous-pm']||'data/daily/'+prev+'-pm.json'),
   reviewHistory:collectReviewHistory(read(a.index||'data/daily/index.json'),a.date,a.session,p=>read(p)),
   expectedDate:a.date,expectedSession:a.session,mainHead:a['main-head']
  });
  console.log(JSON.stringify(result,null,2));process.exitCode=result.ok?0:1;
 }catch(e){console.error(JSON.stringify(fail('PLAN_INPUT_ERROR',e.message)));process.exitCode=2}
}
module.exports={plan};
