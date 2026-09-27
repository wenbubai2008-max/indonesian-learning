#!/usr/bin/env node
'use strict';
/** External GitHub-App/PAT transport for the fixed publisher; never use Actions GITHUB_TOKEN. */
const {publish,verify}=require('./publish-staged-lesson');
const repo=process.env.LESSON_REPOSITORY||'wenbubai2008-max/indonesian-learning';
function reportsFromLog(log){
 const items=[];
 for(const m of log.matchAll(/PREFLIGHT\s+(\{[^\r\n]*\})/g)){
  try{items.push(JSON.parse(m[1]))}catch(e){throw Error('Malformed PREFLIGHT JSON in successful staging log')}
 }
 return items;
}
function apiFor(token){
 if(!token)throw Error('LESSON_PUBLISH_TOKEN is required from an authorized external GitHub App; do not use Actions GITHUB_TOKEN');
 const base='https://api.github.com/repos/'+repo;
 async function request(path,method='GET',body){
  const res=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
   'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  if(!res.ok){const err=Error('GitHub '+res.status+' '+(await res.text()).slice(0,500));err.code=res.status;throw err}
  return res.json();
 }
 async function readJson(path,ref,optional=false){
  try{const x=await request('/contents/'+path+'?ref='+encodeURIComponent(ref));
   return JSON.parse(Buffer.from(x.content.replace(/\s/g,''),'base64').toString('utf8'))}
  catch(e){if(optional&&e.code===404)return undefined;throw e}
 }
 const ref=async branch=>(await request('/git/ref/heads/'+branch)).object.sha;
 async function runs(workflow,branch){return (await request('/actions/workflows/'+workflow+'/runs?branch='+branch+'&per_page=100')).workflow_runs}
 async function jobs(id){return (await request('/actions/runs/'+id+'/jobs?per_page=100')).jobs}
 async function jobLog(id){
  const res=await fetch(base+'/actions/jobs/'+id+'/logs',{headers:{
   Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
   'X-GitHub-Api-Version':'2022-11-28'},redirect:'manual'});
  let content=res;
  if([301,302,303,307,308].includes(res.status)){
   const location=res.headers.get('location');
   if(!location||new URL(location).protocol!=='https:')throw Error('Job log redirect unavailable or non-HTTPS');
   // Never forward the GitHub credential to an external log-storage redirect.
   content=await fetch(location,{redirect:'follow'});
  }
  if(!content.ok){const e=Error('Preflight job log HTTP '+content.status);e.code=content.status;throw e}
  return content.text();
 }
 return {
  stageHead:()=>ref('lesson-staging-v1'),
  stageChanges:async sha=>(await request('/commits/'+sha)).files.map(f=>({path:f.filename,status:f.status})),
  stageApproval:async(sha,candidate)=>{
   const run=(await runs('sync-daily-vocab.yml','lesson-staging-v1')).find(x=>x.head_sha===sha&&x.event==='push');
   if(!run)return null;
   const js=await jobs(run.id),preflight=js.find(x=>x.name==='preflight');
   let report=null;
   if(run.conclusion==='success'&&preflight?.conclusion==='success'){
    const matching=reportsFromLog(await jobLog(preflight.id)).filter(x=>x.candidate===candidate&&x.stageSha===sha);
    if(matching.length!==1)throw Error('Expected exactly one matching PREFLIGHT record for staged candidate');
    report=matching[0];
   }
   return {id:run.id,sha,conclusion:run.conclusion,report,
    preflight:preflight?.conclusion,sync:js.find(x=>x.name==='sync')?.conclusion};
  },
  readJson,
  mainSnapshot:async(date,session)=>{
   const sha=await ref('main'),tree=(await request('/git/commits/'+sha)).tree.sha;
   const prev=new Date(Date.parse(date+'T00:00:00Z')-86400000).toISOString().slice(0,10);
   // Keep repository reads sequential to avoid bursty connector/API requests.
   const index=await readJson('data/daily/index.json',sha);
   const runtime=await readJson('data/learning-runtime.json',sha);
   const rules=await readJson('data/learning-pool-rules.json',sha);
   const sameDayAm=await readJson('data/daily/'+date+'-am.json',sha,true);
   const previousPm=await readJson('data/daily/'+prev+'-pm.json',sha,true);
   const publishedLesson=await readJson('data/daily/'+date+'-'+session+'.json',sha,true);
   return {sha,tree,index,runtime,rules,sameDayAm,previousPm,publishedLesson};
  },
  createBlob:async content=>(await request('/git/blobs','POST',{content,encoding:'utf-8'})).sha,
  createTree:async(base,entries)=>(await request('/git/trees','POST',{base_tree:base,tree:entries})).sha,
  createCommit:async(message,tree,parent)=>(await request('/git/commits','POST',{message,tree,parents:[parent]})).sha,
  updateMain:async sha=>request('/git/refs/heads/main','PATCH',{sha,force:false}),
  runtime:()=>readJson('data/learning-runtime.json','main'),
  syncStatus:async(commit,date,session)=>{
   let target=commit;
   if(!target){const list=await request('/commits?path=data/daily/'+date+'-'+session+'.json&per_page=1');target=list[0]?.sha}
   const run=(await runs('sync-daily-vocab.yml','main')).find(x=>x.head_sha===target&&x.event==='push');
   return run?.conclusion==='success'?'success':run?.conclusion==='failure'?'failure':'pending';
  },
  pagesStatus:async()=>{
   const head=await ref('main'),all=(await request('/actions/runs?per_page=100')).workflow_runs;
   const run=all.find(x=>x.name==='pages build and deployment'&&x.head_sha===head);
   return run?.conclusion==='success'?'success':run?.conclusion==='failure'?'failure':'pending';
  }
 };
}
async function main(){
 const args=process.argv.slice(2),arg=k=>{const i=args.indexOf('--'+k);return i>=0?args[i+1]:undefined};
 const date=arg('date'),session=arg('session'),stageSha=arg('stage-sha');
 if(!date||!session)throw Error('Required: --date YYYY-MM-DD --session am|pm [--stage-sha 40hex --publish | --verify-existing]');
 const api=apiFor(process.env.LESSON_PUBLISH_TOKEN);
 let result;
 if(args.includes('--verify-existing')){
  const target='data/daily/'+date+'-'+session+'.json';
  const lesson=await api.readJson(target,'main');
  result=await verify(api,{date,session,lesson,target,existing:true});
 }else{
  if(!stageSha)throw Error('stageSha required for publishing');
  result=await publish(api,{date,session,stageSha,dryRun:!args.includes('--publish')});
 }
 console.log(JSON.stringify(result,null,2));
 if(!result.ok)process.exitCode=1;
}
if(require.main===module)main().catch(e=>{console.error(JSON.stringify({ok:false,status:'ADAPTER_ERROR',code:e.code||null,message:e.message}));process.exitCode=2});
module.exports={apiFor,reportsFromLog};
