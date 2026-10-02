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

function recover({
  date,session,mainHead,index,runtime,rules,read,
  contextBuilder=buildLessonContext,generate=engine.generate,planner=plan,
  historyBuilder=collectReviewHistory
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

  const ctx=contextBuilder({index,runtime,rules,load:p=>read(p),sourceSha:mainHead});
  requireIt(ctx?.target?.date===date&&ctx?.target?.session===session,
    'TARGET_NOT_READY','Latest legal next lesson is '+JSON.stringify(ctx?.target));
  requireIt(ctx.source?.runtime_generated_at===runtime.generated_at&&
    ctx.source?.lesson_watermark===runtime.lesson_watermark,'CONTEXT_STALE','Context and runtime are inconsistent');

  const previousPm=read(fileFor(previousDate(date),'pm'),true);
  const sameDayAm=session==='pm'?read(fileFor(date,'am'),true):undefined;
  const reviewHistory=historyBuilder(index,date,session,p=>read(p));
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
          status:'ready',target,variant,files:result.files,
          candidateHash:result.candidateHash,baselineFingerprint:result.baselineFingerprint
        };
      }
      rejected.push({variant,errors:result.errors||[{code:'UNEXPECTED_PLAN',detail:result.status}]});
    }catch(e){
      rejected.push({variant,errors:[{code:e.code||'GENERATION_FAILED',detail:String(e.message||e).slice(0,220)}]});
    }
  }
  error('NO_VALID_VARIANT','All 6 V2 candidates failed the original planner: '+JSON.stringify(rejected));
}

function parseArgs(args){
  const out={write:false};
  for(let i=0;i<args.length;i++){
    if(args[i]==='--write'){requireIt(!out.write,'ARGUMENT_INVALID','Duplicate --write');out.write=true;continue}
    const key=args[i].replace(/^--/,'');
    requireIt(['date','session','main-head'].includes(key)&&args[i]==='--'+key&&args[i+1]&&!args[i+1].startsWith('--')&&!out[key],
      'ARGUMENT_INVALID','Usage: --date YYYY-MM-DD --session am|pm --main-head SHA [--write]');
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
  const outcome=recover({
    date:a.date,session:a.session,mainHead:a['main-head'],
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
    variant:outcome.variant,paths:outcome.files.map(x=>x.path),
    candidateHash:outcome.candidateHash||null,write:a.write};
}
if(require.main===module){
  try{console.log('FALLBACK_LESSON '+JSON.stringify(run(process.argv.slice(2))))}
  catch(e){console.error('FALLBACK_LESSON '+JSON.stringify({ok:false,code:e.code||'RECOVERY_ERROR',detail:String(e.message||e).slice(0,1500)}));process.exitCode=1}
}
module.exports={recover,run,parseArgs,validDate};
