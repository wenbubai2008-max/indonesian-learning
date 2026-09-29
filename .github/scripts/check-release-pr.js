#!/usr/bin/env node
'use strict';
/** Read-only PR gate. Release head contains only the two final files; main is the authority. */
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {isDeepStrictEqual}=require('node:util');
const {collectReviewHistory}=require('./validate-lesson-candidate');
const {plan}=require('./plan-lesson-publication');
const git=(...args)=>cp.execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const read=(ref,file,required=true)=>{
 try{return JSON.parse(git('show',ref+':'+file))}
 catch(e){if(required)throw Error('Required main source unavailable: '+file);return undefined}
};
function checkPaths(rows,expected){
 const file='data/daily/'+expected+'.json',index='data/daily/index.json';
 if(rows.length!==2)return {ok:false,detail:'Release PR must change exactly the lesson and index (found '+rows.length+')'};
 const actual=rows.map(s=>s.trim().split(/\s+/)).map(([status,...p])=>({status,path:p.join(' ')}));
 if(actual.some(x=>!['A','M'].includes(x.status))||
   actual.filter(x=>x.path===file).length!==1||
   actual.filter(x=>x.path===index).length!==1||
   actual.find(x=>x.path===index)?.status!=='M')
  return {ok:false,detail:'Expected only added/updated '+file+' and updated '+index};
 return {ok:true};
}
function equalIndex(actual,proposed){
 return isDeepStrictEqual(actual,JSON.parse(proposed));
}
function verify({headSha,headRef,baseRef,mainSha,changed,loadHead,loadMain}){
 if(!/^[a-f0-9]{40}$/i.test(headSha||''))throw Error('HEAD_SHA_REQUIRED');
 if(baseRef!=='main')throw Error('BASE_MUST_BE_MAIN');
 const branch=/^lesson-release-(\d{4}-\d{2}-\d{2})-(am|pm)$/.exec(headRef||'');
 if(!branch)throw Error('NOT_A_RELEASE_BRANCH');
 const [,date,session]=branch,target=date+'-'+session;
 const paths=checkPaths(changed,target);
 if(!paths.ok)throw Error('RELEASE_DIFF_INVALID: '+paths.detail);
 const lesson=loadHead('data/daily/'+target+'.json');
 const proposedIndex=loadHead('data/daily/index.json');
 const index=loadMain('data/daily/index.json'),runtime=loadMain('data/learning-runtime.json'),rules=loadMain('data/learning-pool-rules.json');
 const previous=new Date(Date.parse(date+'T00:00:00Z')-86400000).toISOString().slice(0,10);
 const sameDayAm=loadMain('data/daily/'+date+'-am.json',false),previousPm=loadMain('data/daily/'+previous+'-pm.json',false);
 const reviewHistory=collectReviewHistory(index,date,session,p=>loadMain(p));
 const p=plan({lesson,index,runtime,rules,sameDayAm,previousPm,reviewHistory,expectedDate:date,expectedSession:session,mainHead:mainSha,
 publishedLesson:loadMain('data/daily/'+target+'.json',false)});
 if(!p.ok||p.status!=='ready')throw Error('CANDIDATE_REJECTED: '+JSON.stringify(p.errors||[]));
 if(!equalIndex(proposedIndex,p.files[1].content))
   throw Error('INDEX_MISMATCH: Release index must exactly match the planner applied to CURRENT main');
 return {ok:true,status:'ready',headSha,mainSha,date,session,candidate:'data/daily/'+target+'.json',
 candidateHash:p.candidateHash,baselineFingerprint:p.baselineFingerprint,paths:p.files.map(f=>f.path),errors:[]};
}
function main(){
 const headSha=git('rev-parse','HEAD'),expected=process.env.PR_HEAD_SHA;
 if(!expected||headSha!==expected)throw Error('HEAD_SHA_MISMATCH: checkout is not the exact PR head');
 git('fetch','origin','main');
 const mainSha=git('rev-parse','origin/main');
 const changed=git('diff','--name-status','origin/main...HEAD').split('\n').filter(Boolean);
 // Code-only PRs are allowed. Any PR modifying daily course/index data MUST be an approved release,
 // even when someone gives it a different branch name.
 const touchesDaily=changed.some(row=>/\tdata\/daily\//.test(row));
 if(!touchesDaily&&!/^lesson-release-/.test(process.env.PR_HEAD_REF||'')){
  console.log('CODE_ONLY_PR '+JSON.stringify({ok:true,headSha,mainSha,dailyFilesChanged:0}));
  return;
 }
 const report=verify({headSha,headRef:process.env.PR_HEAD_REF,baseRef:process.env.PR_BASE_REF,mainSha,changed,
  loadHead:(path,required=true)=>read('HEAD',path,required),
  loadMain:(path,required=true)=>read('origin/main',path,required)});
 console.log('RELEASE_PREFLIGHT '+JSON.stringify(report));
}
if(require.main===module){
 try{main()}
 catch(e){console.error('RELEASE_PREFLIGHT '+JSON.stringify({ok:false,status:'blocked',error:e.message}));process.exitCode=1}
}
module.exports={checkPaths,equalIndex,verify};
