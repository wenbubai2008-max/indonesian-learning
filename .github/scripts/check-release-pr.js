#!/usr/bin/env node
'use strict';
/** Read-only PR release gate. Baseline is the exact PR base SHA; candidate is the exact PR head SHA. */
const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto');
const {plan}=require('./plan-lesson-publication');
const {collectReviewHistory}=require('./validate-lesson-candidate');
const sha256=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const pattern=/^lesson-release-(\d{4}-\d{2}-\d{2})-(am|pm)$/;
function inspect({baseSha,headSha,branch,files,read}){
 const errors=[],add=(code,detail)=>errors.push({code,detail});
 const match=pattern.exec(branch||'');
 if(!match)add('RELEASE_BRANCH_INVALID','Expected exact lesson-release-YYYY-MM-DD-am|pm');
 if(!/^[0-9a-f]{40}$/.test(baseSha||'')||!/^[0-9a-f]{40}$/.test(headSha||'')||baseSha===headSha)add('REF_INVALID','Distinct full base/head commit SHA required');
 if(errors.length)return {ok:false,status:'blocked',errors};
 const [,date,session]=match,path='data/daily/'+date+'-'+session+'.json';
 const expected=[path,'data/daily/index.json'].sort();
 if(!Array.isArray(files)||!equal([...files].sort(),expected))add('RELEASE_FILES_INVALID','Exactly official lesson and index must differ from PR base; got '+JSON.stringify(files));
 let lesson,index,next,runtime,rules,context,sameDayAm,previousPm,history;
 try{
  lesson=read(headSha,path);next=read(headSha,'data/daily/index.json');
  index=read(baseSha,'data/daily/index.json');
  runtime=read(baseSha,'data/learning-runtime.json');
  rules=read(baseSha,'data/learning-pool-rules.json');
  context=read(baseSha,'data/lesson-context.json');
  const prev=new Date(Date.parse(date+'T00:00:00Z')-86400000).toISOString().slice(0,10);
  sameDayAm=read(baseSha,'data/daily/'+date+'-am.json',false);
  previousPm=read(baseSha,'data/daily/'+prev+'-pm.json',false);
  history=collectReviewHistory(index,date,session,p=>read(baseSha,p));
  if(read(baseSha,path,false)!==undefined)add('OFFICIAL_ALREADY_EXISTS','Refuse overwrite even if index flag is missing');
 }catch(e){add('RELEASE_INPUT_INVALID',String(e.message||e));}
 if(lesson&&index&&next&&runtime&&rules&&context){
  const target=context.target||{},source=context.source||{};
  if(target.date!==date||target.session!==session||target.time!==(session==='am'?'08:00':'18:00')||target.day!==lesson.day)add('CONTEXT_TARGET_MISMATCH','Context target must match exact lesson identity/day');
  if(source.rules_version!==4||source.runtime_version!==4||source.master_unique!==977||
     source.runtime_generated_at!==runtime.generated_at||source.lesson_watermark!==runtime.lesson_watermark||
     source.index_updated!==index.updated||source.runtime_hash!==sha256(runtime)||
     source.index_hash!==sha256(index)||source.rules_hash!==sha256(rules))
    add('CONTEXT_SOURCE_MISMATCH','Context must be built from the exact current baseline sources');
  const result=plan({lesson,index,runtime,rules,expectedDate:date,expectedSession:session,
    mainHead:baseSha,sameDayAm,previousPm,reviewHistory:history});
  if(!result.ok||result.status!=='ready')errors.push(...(result.errors||[{code:'PLAN_NOT_READY',detail:result.status}]));
  if(result.ok&&result.status==='ready'&&!equal(next,JSON.parse(result.files[1].content)))
    add('INDEX_TRANSACTION_MISMATCH','Index differs from exact two-file publication plan; historical rows/other session cannot change');
  const report={candidate:path,releaseSha:headSha,mainSha:baseSha,
    candidateHash:sha256(lesson),baselineFingerprint:sha256({index,runtime,rules}),
    ok:errors.length===0,status:errors.length?'blocked':'ready',errors};
  return report;
 }
 return {candidate:path,releaseSha:headSha,mainSha:baseSha,ok:false,status:'blocked',errors};
}
function git(...args){return cp.execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()}
function read(ref,p,required=true){
 try{return JSON.parse(cp.execFileSync('git',['show',ref+':'+p],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))}
 catch(e){if(required)throw Error('Missing/malformed '+p+' at '+ref);return undefined}
}
if(require.main===module){
 const [baseSha,headSha,branch]=process.argv.slice(2);
 try{
  // A PR introduces changes since the merge base. Comparing both complete trees
  // falsely counts main-only changes when the release branch is behind main.
  // inspect still validates eligibility and the exact index against baseSha.
  const files=git('diff','--name-only',baseSha+'...'+headSha).split('\n').filter(Boolean);
  const report=inspect({baseSha,headSha,branch,files,read});
  console.log('RELEASE_PREFLIGHT '+JSON.stringify(report));
  if(!report.ok)process.exitCode=1;
 }catch(e){console.error('RELEASE_PREFLIGHT '+JSON.stringify({ok:false,status:'blocked',errors:[{code:'GIT_OR_INPUT_ERROR',detail:String(e.message||e)}]}));process.exitCode=1;}
}
module.exports={inspect};
