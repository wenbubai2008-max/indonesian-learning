#!/usr/bin/env node
'use strict';
/** One guarded release transaction. GitHub transport is injected for regression tests. */
const crypto=require('node:crypto');
const {plan}=require('./plan-lesson-publication');
const sha256=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const stop=(status,detail,extra={})=>({ok:false,status,detail,...extra});
const draftPath=(date,session)=>'staging/drafts/'+date+'-'+session+'.json';
const targetPath=(date,session)=>'data/daily/'+date+'-'+session+'.json';
function validInputs(date,session,sha){
 return /^\d{4}-\d{2}-\d{2}$/.test(date)&&['am','pm'].includes(session)&&/^[a-f0-9]{40}$/i.test(sha);
}
async function publish(api,{date,session,stageSha,dryRun=false,planner=plan}){
 if(!validInputs(date,session,stageSha))return stop('INVALID_INPUT','date/session/stageSha invalid');
 const candidate=draftPath(date,session),target=targetPath(date,session);
 let phase='stage';
 try{
  const stage=await api.stageHead();
  if(stage!==stageSha)return stop('STAGE_MOVED','Ref moved; pin and reapprove current stage SHA',{stageHead:stage});
  const changes=await api.stageChanges(stageSha);
  if(!changes.some(x=>x.path===candidate&&['added','modified'].includes(x.status)))
   return stop('UNAPPROVED_DRAFT','Exact stage commit must add or modify requested draft');
  const lesson=await api.readJson(candidate,stageSha);
  const approval=await api.stageApproval(stageSha);
  if(!approval||approval.conclusion!=='success'||approval.preflight!=='success'||approval.sync!=='skipped'||approval.sha!==stageSha)
   return stop('PREFLIGHT_NOT_PASSED','Exact stage push must pass read-only preflight',{runId:approval?.id||null});
  if(lesson.date!==date||lesson.session!==session)return stop('CANDIDATE_IDENTITY','Draft date/session mismatch');
  phase='snapshot';
  const baseline=await api.mainSnapshot(date,session);
  // Recompute against the CURRENT relevant data. An unrelated main commit does not veto a valid candidate.
  const p=planner({lesson,index:baseline.index,runtime:baseline.runtime,rules:baseline.rules,
   sameDayAm:baseline.sameDayAm,previousPm:baseline.previousPm,
   publishedLesson:baseline.publishedLesson,expectedDate:date,expectedSession:session,mainHead:baseline.sha});
  if(!p.ok)return stop('PREFLIGHT_BLOCKED','Current main data reject the unchanged candidate',{errors:p.errors});
  if(p.candidateHash!==sha256(lesson))return stop('CANDIDATE_HASH_MISMATCH','Draft changed after plan');
  if(p.status==='already_published')return await verify(api,{date,session,lesson,target,existing:true});
  if(p.status!=='ready'||p.files?.length!==2||p.files[0].path!==target||p.files[1].path!=='data/daily/index.json')
   return stop('INVALID_PLAN','Expected exactly lesson and index');
  if(dryRun)return {ok:true,status:'READY_DRY_RUN',stageSha,mainSha:baseline.sha,candidateHash:p.candidateHash,files:p.files.map(x=>x.path)};
  phase='atomic_commit';
  const blobs=[];
  for(const file of p.files)blobs.push({path:file.path,mode:'100644',type:'blob',sha:await api.createBlob(file.content)});
  const tree=await api.createTree(baseline.tree,blobs);
  const commit=await api.createCommit('Publish validated '+date+' '+session.toUpperCase()+' lesson and index atomically',tree,baseline.sha);
  phase='main_ref';
  try{await api.updateMain(commit)}catch(e){
   const current=await api.mainSnapshot(date,session);
   if(current.index.dates.some(x=>x.date===date&&x[session]===true)&&same(current.publishedLesson,lesson))
    return await verify(api,{date,session,lesson,target,commit,existing:false});
   return stop('MAIN_REF_CONFLICT','No force push; draft retained, revalidate current state on recovery',{code:e.code||null,message:String(e.message||e).slice(0,250),stageSha});
  }
  return await verify(api,{date,session,lesson,target,commit,existing:false});
 }catch(e){
  return stop('PUBLISH_ERROR','Draft is retained; inspect failure before retry',{phase,code:e.code||null,message:String(e.message||e).slice(0,350),stageSha});
 }
}
async function verify(api,{date,session,lesson,target,commit,existing}){
 const official=await api.readJson(target,'main');
 const index=await api.readJson('data/daily/index.json','main');
 const row=index.dates.filter(x=>x.date===date);
 if(!same(official,lesson)||row.length!==1||row[0][session]!==true)
  return stop('READBACK_MISMATCH','Official lesson/index not identical to approved draft',{commit:commit||null});
 const runtime=await api.runtime();
 const expected=date+' '+(session==='am'?'08:00':'18:00');
 if(runtime.lesson_watermark!==expected||lesson.new_words?.some(w=>runtime.new_pool.includes(w)))
  return stop('PUBLISHED_PENDING_SYNC','Official two-file publication succeeded; downstream runtime not yet verified',{commit:commit||null,watermark:runtime.lesson_watermark});
 const sync=await api.syncStatus(commit,date,session);
 if(sync!=='success')return stop(sync==='failure'?'SYNC_FAILED':'PUBLISHED_PENDING_SYNC','Relevant Sync run not yet successful',{commit:commit||null});
 const pages=await api.pagesStatus();
 if(pages!=='success')return stop(pages==='failure'?'PAGES_FAILED':'PAGES_PENDING','Final Pages deployment not yet successful',{commit:commit||null});
 return {ok:true,status:'VERIFIED_COMPLETE',commit:commit||null,existing,stageRetained:true};
}
module.exports={publish,verify};
