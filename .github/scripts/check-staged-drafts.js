#!/usr/bin/env node
'use strict';
/** Staging-only, read-only verifier. Always uses the *current main ref* as baseline. */
const fs=require('node:fs'),crypto=require('node:crypto'),cp=require('node:child_process');
const {validate,collectReviewHistory}=require('./validate-lesson-candidate');
const {plan}=require('./plan-lesson-publication');
const git=(...a)=>cp.execFileSync('git',a,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const read=(ref,file,required=true)=>{
 try{return JSON.parse(cp.execFileSync('git',['show',ref+':'+file],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))}
 catch(e){if(required)throw Error('Required main source unavailable: '+file);return undefined}
};
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const main=git('rev-parse','origin/main');
let failed=0;
for(const file of process.argv.slice(2)){
 const m=/^staging\/drafts\/(\d{4}-\d{2}-\d{2})-(am|pm)\.json$/.exec(file);
 if(!m){console.error('REJECT unsupported staging draft path: '+file);failed++;continue}
 const [,date,session]=m;
 let lesson;
 try{lesson=JSON.parse(fs.readFileSync(file,'utf8'))}
 catch(e){console.error('REJECT malformed candidate '+file+': '+e.message);failed++;continue}
 const day=new Date(date+'T00:00:00Z'),prev=new Date(day.valueOf()-86400000).toISOString().slice(0,10);
 try{
  const index=read('origin/main','data/daily/index.json'),runtime=read('origin/main','data/learning-runtime.json'),rules=read('origin/main','data/learning-pool-rules.json');
  const sameDayAm=read('origin/main','data/daily/'+date+'-am.json',false),previousPm=read('origin/main','data/daily/'+prev+'-pm.json',false);
  const reviewHistory=collectReviewHistory(index,date,session,p=>read('origin/main',p));
  const result=plan({lesson,index,runtime,rules,sameDayAm,previousPm,reviewHistory,expectedDate:date,expectedSession:session,mainHead:main});
  const report={candidate:file,stageSha:git('rev-parse','HEAD'),mainSha:main,candidateHash:hash(JSON.stringify(lesson)),ok:result.ok&&result.status==='ready',status:result.status||'blocked',errors:result.errors||[],baselineFingerprint:result.baselineFingerprint||null};
  console.log('PREFLIGHT '+JSON.stringify(report));
  if(!report.ok)failed++;
 }catch(e){console.error('REJECT '+file+': '+e.message);failed++}
}
if(failed)process.exitCode=1;else console.log('Stage preflight successful against main='+main+'; no production data changed.');
