#!/usr/bin/env node
'use strict';

/**
 * Independent, fail-closed recovery of a missing daily lesson. The existing Sync workflow
 * owns scheduling, locking, git transport, runtime reconciliation and Pages publication.
 * This script writes ONLY the official lesson + index in --write mode; never pushes.
 */
const fs=require('node:fs');
const path=require('node:path');
const {plan}=require('./plan-lesson-publication');
const {buildLessonContext}=require('./build-lesson-context');
const {collectReviewHistory}=require('./validate-lesson-candidate');
const engine=require('../../prototype/lesson-engine/engine/generate-prototype');
const {auditLesson}=require('../../prototype/lesson-engine/engine/quality');

const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&
  !Number.isNaN(Date.parse(s+'T00:00:00Z'))&&
  new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const error=(code,detail)=>{const e=new Error(detail);e.code=code;throw e};
const requireIt=(test,code,detail)=>{if(!test)error(code,detail)};
const fileFor=(date,session)=>'data/daily/'+date+'-'+session+'.json';
const previousDate=date=>new Date(Date.parse(date+'T00:00:00Z')-86400000).toISOString().slice(0,10);
const json=(x)=>JSON.stringify(x,null,2)+'\n';

// V4 backup-lesson generation is TEMPORARILY DISABLED by explicit user instruction (2026-10-03).
// Claude is the only automatic lesson generator. This master switch is off unless the process
// environment sets LESSON_V4_FALLBACK=1, and no production workflow step sets it. The V4 engine
// source stays in the repository; re-enable ONLY on the user's explicit instruction.
// Resuming the SAME saved original draft (originalCandidate) is unaffected by this switch.
const v4FallbackEnabled=()=>process.env.LESSON_V4_FALLBACK==='1';

function recover({
  date,session,mainHead,index,runtime,rules,read,originalCandidate,
  contextBuilder=buildLessonContext,generate=engine.generate,planner=plan,
  historyBuilder=collectReviewHistory,v4Enabled=v4FallbackEnabled()
}){
  requireIt(validDate(date)&&['am','pm'].includes(session),'TARGET_INVALID','Expected real YYYY-MM-DD and am|pm');
  requireIt(/^[a-f0-9]{40}$/i.test(mainHead||''),'HEAD_INVALID','A pinned 40-character main SHA is required');
  requireIt(index&&runtime&&rules&&typeof read==='function','INPUT_INVALID','Missing baseline or lesson reader');
  const target=fileFor(date,session);
  const rows=(index.dates||[]).filter(x=>x&&x.date===date);
  requireIt(rows.length<=1,'INDEX_INVALID','Duplicate target date in index');
  const official=read(target,true),flag=rows[0]?.[session]===true;
  if(flag&&official){
    requireIt(official.date===date&&official.session===session&&
      official.time===(session==='am'?'08:00':'18:00')&&
      (session!=='pm'||official.write_status==='lesson_complete'),
      'PUBLISHED_IDENTITY_MISMATCH','Published lesson has wrong identity');
    return {status:'already_published',target,files:[],variant:null};
  }
  // Never overwrite an orphan lesson or silently paper over a true flag with a missing file.
  requireIt(!flag&&!official,'PARTIAL_PUBLICATION','Lesson/index disagree; manual integrity repair required');

  const previousPm=read(fileFor(previousDate(date),'pm'),true);
  const sameDayAm=session==='pm'?read(fileFor(date,'am'),true):undefined;
  const reviewHistory=historyBuilder(index,date,session,p=>read(p));

  // A same-slot original ChatGPT draft takes priority if it passes the SAME formal
  // planner as an ordinary lesson PR. Do not apply V4-specific stylistic gates to it.
  // The caller must supply an exact, trusted release-branch snapshot (never arbitrary
  // remote content); an invalid draft cannot weaken the canonical eligibility rules.
  let originalRejection=null;
  if(originalCandidate!==undefined){
    try{
      const planned=planner({
        lesson:originalCandidate,index,runtime,rules,expectedDate:date,
        expectedSession:session,mainHead,sameDayAm,previousPm,reviewHistory
      });
      if(planned.ok&&planned.status==='ready'&&planned.files?.length===2&&
        planned.files[0].path===target&&planned.files[1].path==='data/daily/index.json'){
        return {status:'ready',target,source:'original_staged',variant:null,
          files:planned.files,candidateHash:planned.candidateHash,
          baselineFingerprint:planned.baselineFingerprint};
      }
      originalRejection=(planned.errors||[{code:'ORIGINAL_PLAN_NOT_READY',detail:planned.status}]).slice(0,12);
    }catch(e){
      originalRejection=[{code:e.code||'ORIGINAL_PLAN_ERROR',detail:String(e.message||e).slice(0,220)}];
    }
  }

  // V4 is disabled: never build a context or generate a second/backup lesson. Report the state
  // (with any original rejection as evidence) and let the caller fail visibly instead.
  if(!v4Enabled){
    return {status:'v4_disabled',target,files:[],variant:null,originalRejection};
  }

  // Only a missing or formally rejected original may invoke the existing V4 engine.
  const ctx=contextBuilder({index,runtime,rules,load:p=>read(p),sourceSha:mainHead});
  requireIt(ctx?.target?.date===date&&ctx?.target?.session===session,
    'TARGET_NOT_READY','Latest legal next lesson is '+JSON.stringify(ctx?.target));
  requireIt(ctx.source?.runtime_generated_at===runtime.generated_at&&
    ctx.source?.lesson_watermark===runtime.lesson_watermark,'CONTEXT_STALE','Context and runtime are inconsistent');
  const rejected=[];
  for(let variant=0;variant<6;variant++){
    let lesson;
    try{
      lesson=generate(ctx,{variant});
      const quality=auditLesson(lesson);
      if(!quality.ok){
        rejected.push({variant,errors:quality.errors});
        continue;
      }
      const result=planner({
        lesson,index,runtime,rules,expectedDate:date,expectedSession:session,mainHead,
        sameDayAm,previousPm,reviewHistory
      });
      if(result.ok&&result.status==='ready'&&result.files?.length===2&&
        result.files[0].path===target&&result.files[1].path==='data/daily/index.json'){
        return {
          status:'ready',target,source:'v4_generated',variant,files:result.files,
          candidateHash:result.candidateHash,baselineFingerprint:result.baselineFingerprint,
          originalRejection
        };
      }
      rejected.push({variant,errors:result.errors||[{code:'UNEXPECTED_PLAN',detail:result.status}]});
    }catch(e){
      rejected.push({variant,errors:[{code:e.code||'GENERATION_FAILED',detail:String(e.message||e).slice(0,220)}]});
    }
  }
  error('NO_VALID_VARIANT','All 6 V2 candidates failed the original planner: '+JSON.stringify({originalRejection,rejected}));
}

function parseArgs(args){
  const out={write:false};
  for(let i=0;i<args.length;i++){
    if(args[i]==='--write'){requireIt(!out.write,'ARGUMENT_INVALID','Duplicate --write');out.write=true;continue}
    const key=args[i].replace(/^--/,'');
    requireIt(['date','session','main-head','original-candidate'].includes(key)&&args[i]==='--'+key&&args[i+1]&&!args[i+1].startsWith('--')&&!out[key],
      'ARGUMENT_INVALID','Usage: --date YYYY-MM-DD --session am|pm --main-head SHA [--original-candidate PATH] [--write]');
    out[key]=args[++i];
  }
  return out;
}
function run(args,root=process.cwd()){
  const a=parseArgs(args),resolve=p=>path.join(root,p);
  const read=(p,optional=false)=>{
    if(optional&&!fs.existsSync(resolve(p)))return undefined;
    return JSON.parse(fs.readFileSync(resolve(p),'utf8'));
  };
  let originalCandidate,originalParseError=null;
  if(a['original-candidate']){
    // Read errors fail closed; only invalid draft JSON falls back to V4.
    const raw=fs.readFileSync(path.resolve(root,a['original-candidate']),'utf8');
    try{originalCandidate=JSON.parse(raw)}
    catch(e){
      if(!(e instanceof SyntaxError))throw e;
      originalCandidate=null;originalParseError='ORIGINAL_JSON_INVALID';
    }
  }
  const outcome=recover({
    date:a.date,session:a.session,mainHead:a['main-head'],originalCandidate,
    index:read('data/daily/index.json'),runtime:read('data/learning-runtime.json'),
    rules:read('data/learning-pool-rules.json'),read
  });
  if(outcome.status==='ready'&&a.write){
    requireIt(!fs.existsSync(resolve(outcome.target)),'TARGET_RACE','Lesson unexpectedly exists; refusing overwrite');
    requireIt(outcome.files.map(x=>x.path).join('|')===outcome.target+'|data/daily/index.json',
      'PLAN_FILES_INVALID','Only lesson and index can be published');
    fs.writeFileSync(resolve(outcome.target),outcome.files[0].content,{flag:'wx'});
    fs.writeFileSync(resolve('data/daily/index.json'),outcome.files[1].content);
  }
  return {ok:true,status:outcome.status,date:a.date,session:a.session,
    source:outcome.source||(outcome.status==='v4_disabled'?'v4_disabled':'already_published'),variant:outcome.variant,
    originalRejection:originalParseError?[{code:originalParseError}]:outcome.originalRejection||null,
    paths:outcome.files.map(x=>x.path),
    candidateHash:outcome.candidateHash||null,write:a.write};
}
if(require.main===module){
  try{console.log('FALLBACK_LESSON '+JSON.stringify(run(process.argv.slice(2))))}
  catch(e){console.error('FALLBACK_LESSON '+JSON.stringify({ok:false,code:e.code||'RECOVERY_ERROR',detail:String(e.message||e).slice(0,1500)}));process.exitCode=1}
}
module.exports={recover,run,parseArgs,validDate,v4FallbackEnabled};
