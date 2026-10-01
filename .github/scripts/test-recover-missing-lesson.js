#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {recover,parseArgs}=require('./recover-missing-lesson');
const {plan}=require('./plan-lesson-publication');
const core=require('../../prototype/lesson-engine/engine/core');
const base=path.resolve(__dirname,'../..');
const get=p=>JSON.parse(fs.readFileSync(path.join(base,p),'utf8'));
const source=fs.readFileSync(path.join(base,'data/daily-vocab-data.js'),'utf8');
const rows=JSON.parse(source.slice(source.indexOf('['),source.lastIndexOf(']')+1));
const bundle=get('prototype/lesson-engine/materials/materials-bundle.json');
const rules=get('data/learning-pool-rules.json'),sha='a'.repeat(40);
const previousPm=get('data/daily/2026-09-30-pm.json');
const sameDayAm=get('data/daily/2026-10-01-am.json');
function history(ctx){
 return (ctx.history_7d||[]).map(h=>h.session==='am'
   ?{date:h.date,session:'am',review_vocab:h.review_core||[],vocab:[]}
   :{date:h.date,session:'pm',review_vocab:[],vocab:(h.review_core||[]).map(word=>({word,source_group:'review'}))});
}
function setup(slot){
 const ctx=get('prototype/lesson-engine/fixtures/context-2026-10-01-'+slot+'.json');
 const index=get('prototype/lesson-engine/fixtures/index-2026-10-01-'+slot+'.json');
 const runtime=get('prototype/lesson-engine/fixtures/runtime-2026-10-01-'+slot+'.json');
 const target='data/daily/2026-10-01-'+slot+'.json';
 const read=(p,optional)=>{
   if(p===target)return undefined; // Simulated gap: never read the production October 1 lesson.
   if(p==='data/daily/2026-10-01-am.json')return sameDayAm;
   if(p==='data/daily/2026-09-30-pm.json')return previousPm;
   if(!fs.existsSync(path.join(base,p))&&optional)return undefined;
   return get(p);
 };
 const input={date:'2026-10-01',session:slot,mainHead:sha,
   index,runtime,rules,read,contextBuilder:()=>ctx,historyBuilder:()=>history(ctx),
   generate:(c,{variant})=>core.generate(c,bundle,rows,{variant}),planner:plan};
 return {ctx,target,input};
}
let passed=0;
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)};
for(const slot of ['am','pm']){
 test(slot.toUpperCase()+' missing lesson generates a valid two-file transaction',()=>{
   const {input,target}=setup(slot),r=recover(input);
   assert.equal(r.status,'ready');
   assert.equal(r.files.length,2);
   assert.deepEqual(r.files.map(x=>x.path),[target,'data/daily/index.json']);
   const lesson=JSON.parse(r.files[0].content),index=JSON.parse(r.files[1].content);
   assert.equal(lesson.date,input.date);assert.equal(lesson.session,slot);
   assert(index.dates.find(x=>x.date===input.date)[slot]===true);
   assert(r.variant>=0&&r.variant<6);
 });
 test(slot.toUpperCase()+' published lesson is never overwritten or regenerated',()=>{
   const {input,target}=setup(slot);let invoked=0;
   const original=core.generate(input.contextBuilder(),bundle,rows,{variant:0});
   const record=JSON.parse(JSON.stringify(input.index));
   let row=record.dates.find(x=>x.date===input.date);
   if(!row){row={date:input.date,am:false,pm:false};record.dates.push(row)}
   row[slot]=true;
   const result=recover({...input,index:record,
     read:(p,optional)=>p===target?original:input.read(p,optional),
     contextBuilder:()=>{invoked++;throw Error('must not generate')}});
   assert.equal(result.status,'already_published');assert.equal(invoked,0);assert.deepEqual(result.files,[]);
 });
 test(slot.toUpperCase()+' partial file without index flag is blocked',()=>{
   const {input,target}=setup(slot);
   assert.throws(()=>recover({...input,read:(p,optional)=>
     p===target?{date:input.date,session:slot,time:slot==='am'?'08:00':'18:00'}:input.read(p,optional)
   }),e=>e.code==='PARTIAL_PUBLICATION');
 });
 test(slot.toUpperCase()+' flag without official lesson is blocked',()=>{
   const {input}=setup(slot),index=JSON.parse(JSON.stringify(input.index));
   let row=index.dates.find(x=>x.date===input.date);
   if(!row){row={date:input.date,am:false,pm:false};index.dates.push(row)}
   row[slot]=true;
   assert.throws(()=>recover({...input,index}),e=>e.code==='PARTIAL_PUBLICATION');
 });
 test(slot.toUpperCase()+' six failing variants fail closed (no publication plan)',()=>{
   const {input}=setup(slot);let n=0;
   assert.throws(()=>recover({...input,generate:()=>{n++;throw Error('unsafe candidate')}}),
     e=>e.code==='NO_VALID_VARIANT'&&e.message.includes('unsafe candidate'));
   assert.equal(n,6);
 });
 test(slot.toUpperCase()+' first failed variant advances to next validated variant',()=>{
   const {input}=setup(slot);let n=0;
   const r=recover({...input,generate:(ctx,opt)=>{
     n++;if(opt.variant===0)throw Error('example mismatch');
     return input.generate(ctx,opt);
   }});
   assert.equal(r.status,'ready');assert.equal(r.variant,1);assert.equal(n,2);
 });
 test(slot.toUpperCase()+' stale or mismatched context is blocked',()=>{
   const {input,ctx}=setup(slot);
   assert.throws(()=>recover({...input,contextBuilder:()=>({...ctx,target:{...ctx.target,date:'2026-10-02'}})}),
      e=>e.code==='TARGET_NOT_READY');
 });
}
test('invalid date and main SHA cannot publish',()=>{
 const {input}=setup('am');
 assert.throws(()=>recover({...input,date:'2026-02-30'}),e=>e.code==='TARGET_INVALID');
 assert.throws(()=>recover({...input,mainHead:'abc'}),e=>e.code==='HEAD_INVALID');
});
test('CLI parser defaults to no file writes',()=>{
 assert.deepEqual(parseArgs(['--date','2026-10-01','--session','am','--main-head',sha]),{
   write:false,date:'2026-10-01',session:'am','main-head':sha
 });
});
test('fallback workflow has one existing twice-daily clock and valid Bash steps',()=>{
 const cp=require('node:child_process');
 const workflow=fs.readFileSync(path.join(base,'.github/workflows/sync-daily-vocab.yml'),'utf8');
 const lines=workflow.split('\n');
 const crons=lines.map(x=>x.trim()).filter(x=>x.startsWith('- cron: '));
 assert.deepEqual(crons,["- cron: '5 1 * * *'","- cron: '5 11 * * *'"]);
 assert(workflow.includes('group: learning-data-write')||workflow.includes("'learning-data-write'"));
 assert(workflow.includes('inputs[recover_date]')&&workflow.includes('inputs[recover_session]'));
 const names=[
   'Check a newly created release scaffold without holding the main write lock',
   'Recover immediately after an eligible lesson release fails',
   'Generate missing lesson with V2 and commit the two-file transaction',
   'Request Pages build after GitHub Actions fallback publication'
 ];
 for(const name of names){
   const start=lines.findIndex(x=>x==='      - name: '+name);
   assert(start>0,'Step missing: '+name);
   const runner=lines.findIndex((x,i)=>i>start&&x==='        run: |');
   assert(runner>start,'Step has no script: '+name);
   const body=[];
   for(let i=runner+1;i<lines.length;i++){
     if(lines[i].startsWith('          '))body.push(lines[i].slice(10));
     else if(!lines[i].trim())body.push('');
     else break;
   }
   assert(body.length>4,'Script too short: '+name);
   const check=cp.spawnSync('bash',['-n'],{encoding:'utf8',input:body.join('\n')+'\n'});
   assert.equal(check.status,0,name+' bash syntax: '+check.stderr);
 }
 assert(workflow.includes('node .github/scripts/recover-missing-lesson.js'));
 assert(workflow.includes('FALLBACK_PAGES_BUILD_REQUESTED'));
 assert(workflow.includes('  create:'));
 assert(workflow.includes("github.event_name == 'create' && github.event.ref_type == 'branch'"));
 assert(workflow.includes('lesson-watch-{0}'));
 assert(workflow.includes("github.ref == 'refs/heads/main' && github.event_name != 'create'"));
 assert(workflow.includes('LESSON_CREATE_FALLBACK_DISPATCHED'));
 assert(workflow.includes('LESSON_CREATE_ALREADY_PUBLISHED'));
});

test('real watcher Bash ignores non-release branches and dispatches only a missing main lesson',()=>{
 const cp=require('node:child_process'),os=require('node:os');
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lesson-watch-test-'));
 try{
   const source=fs.readFileSync(path.join(base,'.github/workflows/sync-daily-vocab.yml'),'utf8').split('\n');
   const n='      - name: Check a newly created release scaffold without holding the main write lock';
   const step=source.indexOf(n);
   assert(step>0);
   const runner=source.findIndex((x,i)=>i>step&&x==='        run: |');
   assert(runner>step);
   const body=[];
   for(let i=runner+1;i<source.length;i++){
     if(source[i].startsWith('          '))body.push(source[i].slice(10));
     else if(!source[i].trim())body.push('');
     else break;
   }
   const dateStub=path.join(tmp,'date'),ghStub=path.join(tmp,'gh'),sleepStub=path.join(tmp,'sleep');
   fs.writeFileSync(dateStub,[
     '#!/bin/bash',
     'case "$*" in',
     '  *"+%Y-%m-%d"*) echo 2026-10-01 ;;',
     '  *"+%H"*) echo 18 ;;',
     '  *"-d"*"+%s"*) echo 1000 ;;',
     '  *"+%s"*) echo 1001 ;;',
     '  *) /usr/bin/date "$@" ;;',
     'esac'
   ].join('\n')+'\n');
   fs.writeFileSync(ghStub,[
     '#!/bin/bash',
     'case "$*" in',
     '  *"/contents/data/daily/index.json?ref=main"*) echo "$FAKE_INDEX_B64" ;;',
     '  *"/contents/data/daily/2026-10-01-pm.json?ref=main"*) test "$FAKE_LESSON_EXISTS" = yes ;;',
     '  *"--method POST"*) printf "DISPATCH %s\\n" "$*" >> "$FAKE_DISPATCH_LOG" ;;',
     '  *) echo "Unexpected gh api call: $*" >&2; exit 9 ;;',
     'esac'
   ].join('\n')+'\n');
   fs.writeFileSync(sleepStub,'#!/bin/bash\\necho "Unexpected sleep: $*" >&2\\nexit 8\\n');
   for(const f of [dateStub,ghStub,sleepStub])fs.chmodSync(f,0o755);
   const log=path.join(tmp,'dispatch.log');
   const run=(ref,flag,fileExists)=>{
     fs.rmSync(log,{force:true});
     const index={dates:[{date:'2026-10-01',am:true,pm:flag}]};
     const env={...process.env,PATH:tmp+':'+process.env.PATH,
       CREATED_REF:ref,GITHUB_REPOSITORY:'test/indonesian-learning',GH_TOKEN:'unit-test',
       FAKE_INDEX_B64:Buffer.from(JSON.stringify(index)).toString('base64'),
       FAKE_LESSON_EXISTS:fileExists?'yes':'no',FAKE_DISPATCH_LOG:log};
     const result=cp.spawnSync('bash',['-c',body.join('\n')+'\n'],{env,encoding:'utf8'});
     assert.equal(result.status,0,ref+' stdout='+result.stdout+' stderr='+result.stderr);
     return {stdout:result.stdout,dispatched:fs.existsSync(log)?fs.readFileSync(log,'utf8'):''};
   };
   const probe=run('lesson-watch-test-probe',false,false);
   assert(probe.stdout.includes('LESSON_CREATE_IGNORED'));
   assert.equal(probe.dispatched,'');
   const done=run('lesson-release-2026-10-01-pm',true,true);
   assert(done.stdout.includes('LESSON_CREATE_ALREADY_PUBLISHED'));
   assert.equal(done.dispatched,'');
   const missing=run('lesson-release-2026-10-01-pm',false,false);
   assert(missing.stdout.includes('LESSON_CREATE_FALLBACK_DISPATCHED'));
   assert(missing.dispatched.includes('inputs[recover_date]=2026-10-01'));
   assert(missing.dispatched.includes('inputs[recover_session]=pm'));
 }finally{fs.rmSync(tmp,{recursive:true,force:true})}
});
console.log('FALLBACK_RECOVERY_TEST '+JSON.stringify({ok:true,passed}));
