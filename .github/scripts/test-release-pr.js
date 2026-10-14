#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const {inspect}=require('./check-release-pr');
const {plan}=require('./plan-lesson-publication');
const {collectReviewHistory}=require('./validate-lesson-candidate');
const {makeAm,makePm}=require('./test-lesson-candidate');
const clone=x=>JSON.parse(JSON.stringify(x));
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const base='a'.repeat(40),head='b'.repeat(40);
let passed=0;
function test(label,fn){fn();passed++;console.log('PASS '+label)}
function fixture(make){
 const x=make(),date=x.expectedDate,session=x.expectedSession,prev='2026-09-27';
 const lessonPath='data/daily/'+date+'-'+session+'.json';
 const sources={'data/daily/index.json':clone(x.index),'data/learning-runtime.json':clone(x.runtime),
  'data/learning-pool-rules.json':clone(x.rules)};
 for(const row of x.index.dates){
  for(const slot of ['am','pm'])if(row[slot]===true){
   let v=row.date===date&&slot==='am'?x.sameDayAm:row.date===prev&&slot==='pm'?x.previousPm:null;
   if(!v)v={date:row.date,session:slot,review_vocab:[],vocab:[],new_words:[],write_status:'lesson_complete'};
   sources['data/daily/'+row.date+'-'+slot+'.json']=clone(v);
  }
 }
 const ctx={target:{date,session,time:session==='am'?'08:00':'18:00',day:x.lesson.day},
  source:{rules_version:4,runtime_version:4,master_unique:977,
   runtime_generated_at:x.runtime.generated_at,lesson_watermark:x.runtime.lesson_watermark,index_updated:x.index.updated,
   runtime_hash:hash(x.runtime),index_hash:hash(x.index),rules_hash:hash(x.rules)}};
 sources['data/lesson-context.json']=ctx;
 const history=collectReviewHistory(x.index,date,session,p=>sources[p]);
 const p=plan({...x,reviewHistory:history,mainHead:base});
 assert.equal(p.ok,true,JSON.stringify(p.errors));
 const release=clone(sources);
 release[lessonPath]=clone(x.lesson);
 release['data/daily/index.json']=JSON.parse(p.files[1].content);
 const state={base: sources,head:release,baseSha:base,headSha:head,branch:'lesson-release-'+date+'-'+session,
  files:[lessonPath,'data/daily/index.json']};
 const read=(ref,path,required=true)=>{
  const doc=state[ref===base?'base':'head'][path];
  if(doc===undefined&&required)throw Error('Missing '+path);
  return doc===undefined?undefined:clone(doc);
 };
 return {state,read,lessonPath,check:()=>inspect({...state,read})};
}
function has(report,code){assert.equal(report.ok,false,JSON.stringify(report));assert(report.errors.some(x=>x.code===code),JSON.stringify(report.errors))}
test('AM valid exact two-file release',()=>assert.equal(fixture(makeAm).check().status,'ready'));
test('PM valid exact two-file release',()=>assert.equal(fixture(makePm).check().status,'ready'));
test('partial write (only lesson) cannot merge',()=>{const f=fixture(makeAm);f.state.files=[f.lessonPath];has(f.check(),'RELEASE_FILES_INVALID')});
test('partial write (only index) cannot merge',()=>{const f=fixture(makeAm);f.state.files=['data/daily/index.json'];has(f.check(),'RELEASE_FILES_INVALID')});
test('unrelated third path cannot merge',()=>{const f=fixture(makeAm);f.state.files.push('data/daily-vocab-data.js');has(f.check(),'RELEASE_FILES_INVALID')});
test('malformed question blocked',()=>{const f=fixture(makeAm);delete f.state.head[f.lessonPath].quiz[0].answer_index;has(f.check(),'QUESTION_INVALID')});
test('unknown word blocked',()=>{const f=fixture(makeAm);f.state.head[f.lessonPath].vocab[0].word='unapproved';has(f.check(),'NEW_WORD_INELIGIBLE')});
test('index historical edit blocked',()=>{const f=fixture(makeAm);f.state.head['data/daily/index.json'].dates[0].pm=false;has(f.check(),'INDEX_TRANSACTION_MISMATCH')});
test('index counterpart session preserved',()=>{const f=fixture(makePm);f.state.head['data/daily/index.json'].dates.at(-1).am=false;has(f.check(),'INDEX_TRANSACTION_MISMATCH')});
test('context source stale blocked',()=>{const f=fixture(makeAm);f.state.base['data/lesson-context.json'].source.runtime_hash='x';has(f.check(),'CONTEXT_SOURCE_MISMATCH')});
test('target day mismatch blocked',()=>{const f=fixture(makeAm);f.state.base['data/lesson-context.json'].target.day=99;has(f.check(),'CONTEXT_TARGET_MISMATCH')});
test('duplicate already-published AM blocked',()=>{const f=fixture(makeAm);f.state.base['data/daily/index.json'].dates.at(-1).am=true;has(f.check(),'ALREADY_PUBLISHED')});
test('orphan published file is not overwritten',()=>{const f=fixture(makeAm);f.state.base[f.lessonPath]=clone(f.state.head[f.lessonPath]);has(f.check(),'OFFICIAL_ALREADY_EXISTS')});
test('main data conflict blocks stale candidate',()=>{const f=fixture(makeAm);f.state.base['data/learning-runtime.json'].lesson_watermark='2000-01-01 08:00';has(f.check(),'CONTEXT_SOURCE_MISMATCH')});
test('branch identity mismatch blocked',()=>{const f=fixture(makeAm);f.state.branch='lesson-release-2026-09-27-am';has(f.check(),'RELEASE_FILES_INVALID')});
test('non-release branch blocked',()=>{const f=fixture(makeAm);f.state.branch='lesson-staging-v1';has(f.check(),'RELEASE_BRANCH_INVALID')});
test('identical SHA blocked',()=>{const f=fixture(makeAm);f.state.headSha=base;has(f.check(),'REF_INVALID')});
test('source or draft absent blocked, no accidental publish',()=>{const f=fixture(makeAm);delete f.state.head[f.lessonPath];has(f.check(),'RELEASE_INPUT_INVALID')});
test('CLI checks PR changes after main advances, still validates current baseline',()=>{
 const f=fixture(makeAm),dir=fs.mkdtempSync(path.join(os.tmpdir(),'release-diff-test-'));
 const git=(...args)=>cp.execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const write=(p,value)=>{const file=path.join(dir,p);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n')};
 const commit=message=>{git('add','.');git('commit','-m',message);return git('rev-parse','HEAD')};
 const check=(base,head)=>{
  const run=cp.spawnSync(process.execPath,[path.join(__dirname,'check-release-pr.js'),base,head,f.state.branch],{cwd:dir,encoding:'utf8'});
  assert.ifError(run.error);const report=JSON.parse(run.stdout.trim().replace(/^RELEASE_PREFLIGHT /,''));
  assert.equal(run.status,report.ok?0:1,run.stderr);return report;
 };
 try{
  git('init','-b','main');git('config','user.name','Release regression');git('config','user.email','test@example.invalid');
  for(const [p,v]of Object.entries(f.state.base))write(p,v);
  const original=commit('baseline');git('checkout','-b',f.state.branch);
  write(f.lessonPath,f.state.head[f.lessonPath]);write('data/daily/index.json',f.state.head['data/daily/index.json']);
  const release=commit('lesson and index');assert.equal(check(original,release).ok,true);
  git('checkout','main');write('unrelated.json',{mainOnly:true});const advanced=commit('main-only change');
  assert.equal(check(advanced,release).ok,true,'Main-only changes are not part of the release PR');
  const index=clone(f.state.base['data/daily/index.json']);index.note='new baseline metadata';write('data/daily/index.json',index);
  const context=clone(f.state.base['data/lesson-context.json']);context.source.index_hash=hash(index);write('data/lesson-context.json',context);
  has(check(commit('new current index'),release),'INDEX_TRANSACTION_MISMATCH');
  git('checkout',f.state.branch);write('extra.json',{releaseOnly:true});
  has(check(advanced,commit('unrelated release change')),'RELEASE_FILES_INVALID');
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
// Run the actual workflow shell, with real local Git/planner/validator and a local
// GitHub API substitute. Baseline suites are run separately against the full repo;
// this small fixture bypasses only those suites, not release planning or validation.
const workflow=fs.readFileSync(path.join(__dirname,'../workflows/sync-daily-vocab.yml'),'utf8');
const releaseStep=workflow.split('      - name: Generate index, validate and squash-merge the lesson release\n')[1]
 .split('\n      - name: ')[0];
const releaseShell=releaseStep.split('        run: |\n')[1].split('\n').map(s=>s.replace(/^ {10}/,'')).join('\n');
test('workflow contract uses bounded same-job recovery instead of synchronize',()=>{
 assert(releaseShell.includes('for release_attempt in 0 1 2; do'));
 assert(releaseShell.includes('git diff --name-only "$release_base" "$latest_main"'));
 assert(releaseShell.includes('--main-head "$latest_main"'));
 assert(!releaseShell.includes('the synchronize run will recompute the index'));
 assert(!/git (?:rebase|reset --hard)|git push[^\n]*(?:--force|-f\b)|\[skip ci\]/.test(releaseShell));
});
function workflowScenario({daily=false,advances=1,late=false,invalidate=false}={}){
 const f=fixture(makePm),dir=fs.mkdtempSync(path.join(os.tmpdir(),'lesson-workflow-test-'));
 const repo=path.join(dir,'release'),remote=path.join(dir,'origin.git'),writer=path.join(dir,'main-writer');
 const bin=path.join(dir,'bin'),runner=path.join(dir,'runner'),statePath=path.join(dir,'state.json'),logPath=path.join(dir,'calls.jsonl');
 const realGit=cp.execFileSync('which',['git'],{encoding:'utf8'}).trim();
 const git=(cwd,...args)=>cp.execFileSync(realGit,args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const write=(p,v)=>{const target=path.join(repo,p);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(v,null,2)+'\n')};
 const script=(name,body)=>{fs.writeFileSync(path.join(bin,name),body);fs.chmodSync(path.join(bin,name),0o755)};
 try{
  for(const d of [repo,bin,runner])fs.mkdirSync(d);
  git(repo,'init','-b','main');git(repo,'config','user.name','Release regression');git(repo,'config','user.email','test@example.invalid');
  for(const [p,v]of Object.entries(f.state.base))write(p,v);
  fs.cpSync(__dirname,path.join(repo,'.github/scripts'),{recursive:true});
  git(repo,'add','.');git(repo,'commit','-m','baseline');
  git(dir,'clone','--bare',repo,remote);git(repo,'remote','add','origin',remote);
  git(dir,'clone',remote,writer);git(writer,'config','user.name','Main writer');git(writer,'config','user.email','test@example.invalid');
  git(repo,'checkout','-b',f.state.branch);write(f.lessonPath,f.state.head[f.lessonPath]);
  git(repo,'add',f.lessonPath);git(repo,'commit','-m','original lesson only');git(repo,'push','origin','HEAD:'+f.state.branch);
  const candidateBlob=git(repo,'rev-parse','HEAD:'+f.lessonPath);
  fs.writeFileSync(statePath,JSON.stringify({remaining:advances,changed:0,reads:0,pushes:0,daily,late,invalidate,merged:false}));
  // All mutation occurs in disposable repositories, without reset/rebase/force.
  const mock=path.join(dir,'mock.js');
  fs.writeFileSync(mock,`
const fs=require('fs'),cp=require('child_process'),path=require('path'),crypto=require('crypto');
const [kind,...args]=process.argv.slice(2),realGit=${JSON.stringify(realGit)};
const repo=${JSON.stringify(repo)},remote=${JSON.stringify(remote)},writer=${JSON.stringify(writer)};
const statePath=${JSON.stringify(statePath)},logPath=${JSON.stringify(logPath)},branch=${JSON.stringify(f.state.branch)};
const state=JSON.parse(fs.readFileSync(statePath,'utf8'));
const save=()=>fs.writeFileSync(statePath,JSON.stringify(state));
const log=x=>fs.appendFileSync(logPath,JSON.stringify(x)+'\\n');
const git=(cwd,...a)=>cp.execFileSync(realGit,a,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const read=p=>JSON.parse(fs.readFileSync(path.join(writer,p),'utf8'));
const write=(p,v)=>fs.writeFileSync(path.join(writer,p),JSON.stringify(v,null,2)+'\\n');
function advance(){
 if(!state.remaining)return;
 state.remaining--;state.changed++;
 if(state.daily){
  const index=read('data/daily/index.json');
  index.dates.unshift({date:'2026-09-'+String(27-state.changed).padStart(2,'0'),am:false,pm:false,verified:'concurrent-main'});
  write('data/daily/index.json',index);
  const context=read('data/lesson-context.json');
  context.source.index_hash=crypto.createHash('sha256').update(JSON.stringify(index)).digest('hex');
  write('data/lesson-context.json',context);
 }else if(state.invalidate){
  const runtime=read('data/learning-runtime.json');runtime.new_pool=[];write('data/learning-runtime.json',runtime);
  const context=read('data/lesson-context.json');
  context.source.runtime_hash=crypto.createHash('sha256').update(JSON.stringify(runtime)).digest('hex');
  write('data/lesson-context.json',context);
 }else write('data/weakness-sync.json',{revision:state.changed});
 git(writer,'add','.');git(writer,'commit','-m','concurrent main '+state.changed);git(writer,'push','origin','main');
 log({event:'advance',sha:git(writer,'rev-parse','HEAD')});save();
}
if(kind==='node'){
 const file=args[0]||'';
 if(/(?:^|\\/)test-[^/]+\\.js$/.test(file)||/(?:^|\\/)regression-guard\\.js$/.test(file))process.exit(0);
 if(file.endsWith('plan-lesson-publication.js'))log({event:'plan',base:args[args.indexOf('--main-head')+1]});
 if(file.endsWith('check-release-pr.js'))log({event:'validate',base:args[1],head:args[2]});
 const r=cp.spawnSync(${JSON.stringify(process.execPath)},args,{stdio:'inherit'});process.exit(r.status??1);
}
if(kind==='git'){
 if(args[0]==='fetch'&&state.advanceOnFetch){state.advanceOnFetch=false;advance();save()}
 const r=cp.spawnSync(realGit,args,{stdio:'inherit'});
 if(r.status!==0)process.exit(r.status??1);
 if(args[0]==='push'){
  state.pushes++;log({event:'push',head:git(repo,'rev-parse','HEAD')});
  if(!state.late)advance();save();
 }
 process.exit(0);
}
if(kind==='gh'){
 if(args.includes('PUT')){
  const wanted=args.find(x=>x.startsWith('sha=')).slice(4),base=git(remote,'rev-parse','main');
  if(wanted!==git(remote,'rev-parse',branch))throw Error('Merge SHA must equal final remote head');
  git(writer,'fetch','origin',branch);git(writer,'merge','--squash','FETCH_HEAD');git(writer,'commit','-m','Publish lesson');git(writer,'push','origin','main');
  state.merged=true;save();log({event:'merge',base,head:wanted});
  console.log(JSON.stringify({merged:true,sha:git(writer,'rev-parse','HEAD')}));
 }else if(args.includes('POST')){log({event:'dispatch'});console.log('{}')}
 else{
  state.reads++;
  if(state.late&&state.reads===2){state.advanceOnFetch=true;save()}
  else save();
  console.log(JSON.stringify({state:'open',merged:state.merged,head:{sha:git(remote,'rev-parse',branch)},base:{sha:git(remote,'rev-parse','main')},mergeable:true,mergeable_state:'clean'}));
 }
}
`);
  for(const name of ['node','git','gh'])script(name,'#!/bin/sh\nexec '+JSON.stringify(process.execPath)+' '+JSON.stringify(mock)+' '+name+' "$@"\n');
  script('sleep','#!/bin/sh\nexit 0\n');
  // macOS's Bash 3 lacks uppercase expansion; Ubuntu runner uses Bash 5.
  const shell=releaseShell.replaceAll('${release_session^^}','PM');
  const run=cp.spawnSync('bash',['-c',shell],{cwd:repo,encoding:'utf8',timeout:60000,
   env:{...process.env,PATH:bin+path.delimiter+process.env.PATH,GH_TOKEN:'local-test',
    PR_NUMBER:'123',PR_HEAD_REF:f.state.branch,GITHUB_REPOSITORY:'test/repo',GITHUB_WORKSPACE:repo,RUNNER_TEMP:runner,GITHUB_RUN_ID:'fixture'}});
  assert.ifError(run.error);
  const calls=fs.readFileSync(logPath,'utf8').trim().split('\n').map(x=>JSON.parse(x));
  const state=JSON.parse(fs.readFileSync(statePath,'utf8'));
  assert.equal(git(repo,'rev-parse','HEAD:'+f.lessonPath),candidateBlob,'Original lesson must be byte-identical');
  assert.deepEqual(git(remote,'for-each-ref','--format=%(refname:short)','refs/heads').split('\n').sort(),[f.state.branch,'main'].sort());
  assert(!git(repo,'log','--format=%B').includes('[skip ci]'));
  return {run,calls,state,index:JSON.parse(git(remote,'show','main:data/daily/index.json')),
   finalDiff:state.merged?git(remote,'diff','--name-only',calls.find(x=>x.event==='merge').base,'main').split('\n').sort():[],lessonPath:f.lessonPath};
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
}
test('main advances without data/daily: replan/revalidate latest main, no second index push',()=>{
 const s=workflowScenario(),evidence=s.run.stdout+s.run.stderr;
 assert.equal(s.run.status,0,evidence);assert.equal(s.state.pushes,1);
 const advanced=s.calls.find(x=>x.event==='advance').sha,merge=s.calls.find(x=>x.event==='merge');
 assert.equal(merge.base,advanced);assert(s.calls.some(x=>x.event==='plan'&&x.base===advanced));
 assert(s.calls.some(x=>x.event==='validate'&&x.base===advanced&&x.head===merge.head));
 assert.deepEqual(s.finalDiff,['data/daily/index.json',s.lessonPath].sort());
 assert.equal(s.calls.filter(x=>x.event==='dispatch').length,1);
});
test('main advances with data/daily: regenerate index, ordinary merge/push preserves concurrent rows',()=>{
 const s=workflowScenario({daily:true}),evidence=s.run.stdout+s.run.stderr;
 assert.equal(s.run.status,0,evidence);assert.equal(s.state.pushes,2);
 assert.equal(s.index.dates[0].verified,'concurrent-main');
 assert.equal(s.index.dates.at(-1).am,true);assert.equal(s.index.dates.at(-1).pm,true);
 const advanced=s.calls.find(x=>x.event==='advance').sha,merge=s.calls.find(x=>x.event==='merge');
 assert.equal(merge.base,advanced);assert(s.calls.some(x=>x.event==='plan'&&x.base===advanced));
 assert(s.calls.some(x=>x.event==='validate'&&x.base===advanced&&x.head===merge.head));
 assert.deepEqual(s.finalDiff,['data/daily/index.json',s.lessonPath].sort());
});
test('main advances during mergeability wait: final fetch retries in the same job',()=>{
 const s=workflowScenario({daily:true,late:true});assert.equal(s.run.status,0,s.run.stdout+s.run.stderr);
 assert.equal(s.state.changed,1);assert.equal(s.state.pushes,2);
 assert.equal(s.calls.find(x=>x.event==='merge').base,s.calls.find(x=>x.event==='advance').sha);
});
test('repeated daily movement stops after two retries, preserving the original PR branch',()=>{
 const s=workflowScenario({daily:true,advances:3});assert.equal(s.run.status,1,s.run.stdout+s.run.stderr);
 assert.equal(s.state.pushes,3);assert.equal(s.calls.filter(x=>x.event==='plan').length,3);
 assert(!s.calls.some(x=>x.event==='merge'||x.event==='dispatch'));assert(s.run.stdout.includes('Lesson release retry limit'));
});
test('main-only changes cannot bypass new-word eligibility validation',()=>{
 const s=workflowScenario({invalidate:true});assert.equal(s.run.status,1,s.run.stdout+s.run.stderr);
 assert.equal(s.state.pushes,1);assert(!s.calls.some(x=>x.event==='merge'||x.event==='dispatch'));
 assert(s.run.stdout.includes('NEW_WORD_INELIGIBLE'));
});
console.log('Release PR gate:',passed,'passed, 0 failed');
