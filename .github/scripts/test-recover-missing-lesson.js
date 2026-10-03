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
console.log('DAILY_LIGHT_CACHE_HASH '+require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(base,'data/daily-light-test.js'),'utf8')).digest('hex').slice(0,12));
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
   generate:(c,{variant})=>core.generate(c,bundle,rows,{variant}),planner:plan,
   v4Enabled:true}; // dormant V4 source stays tested; production default is OFF (see tests below)
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
   assert.equal(r.source,'v4_generated');
 });
 test(slot.toUpperCase()+' a valid staged original takes priority over V4 with no PR',()=>{
   const {input,target}=setup(slot);
   const draft=input.generate(input.contextBuilder(),{variant:0});
   let generated=0,contextBuilt=0;
   const result=recover({...input,originalCandidate:draft,
     contextBuilder:()=>{contextBuilt++;throw Error('V4 context not needed for original')},
     generate:()=>{generated++;throw Error('Must not replace valid ChatGPT draft')}});
   assert.equal(result.status,'ready');
   assert.equal(result.source,'original_staged');
   assert.equal(result.variant,null);
   assert.deepEqual(result.files.map(x=>x.path),[target,'data/daily/index.json']);
   assert.deepEqual(JSON.parse(result.files[0].content),draft);
   assert.equal(JSON.parse(result.files[1].content).dates.find(x=>x.date===input.date)[slot],true);
   assert.equal(generated,0);assert.equal(contextBuilt,0);
 });
 test(slot.toUpperCase()+' an invalid staged original fails formal validation before V4 fallback',()=>{
   const {input}=setup(slot),draft=input.generate(input.contextBuilder(),{variant:0});
   draft.reading.text='Terlalu pendek.';
   let n=0;
   const result=recover({...input,originalCandidate:draft,
     generate:(ctx,opt)=>{n++;return input.generate(ctx,opt)}});
   assert.equal(result.status,'ready');
   assert.equal(result.source,'v4_generated');
   assert(n>=1);
   assert(result.originalRejection?.some(x=>x.code==='READING_INVALID'),
     'A staged draft cannot bypass the authoritative reading length requirement');
   assert.notDeepEqual(JSON.parse(result.files[0].content),draft);
 });
 test(slot.toUpperCase()+' invalid staged JSON object does not weaken the V4 fallback',()=>{
   const {input}=setup(slot);
   const result=recover({...input,originalCandidate:null});
   assert.equal(result.source,'v4_generated');
   assert(result.originalRejection?.some(x=>x.code==='INPUT_INVALID'||x.code==='LESSON_INVALID'));
 });
 test(slot.toUpperCase()+' published lesson is never overwritten or regenerated',()=>{
   const {input,target}=setup(slot);let invoked=0;
   const original=core.generate(input.contextBuilder(),bundle,rows,{variant:0});
   const record=JSON.parse(JSON.stringify(input.index));
   let row=record.dates.find(x=>x.date===input.date);
   if(!row){row={date:input.date,am:false,pm:false};record.dates.push(row)}
   row[slot]=true;
   const result=recover({...input,index:record,originalCandidate:original,
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
test('V4 backup generation is disabled by default: nothing is generated or planned',()=>{
 delete process.env.LESSON_V4_FALLBACK;
 for(const slot of ['am','pm']){
   const {input,target}=setup(slot);
   let built=0,generated=0;
   const guarded={...input,v4Enabled:undefined,
     contextBuilder:()=>{built++;throw Error('V4 context must not be built while disabled')},
     generate:()=>{generated++;throw Error('V4 must not generate while disabled')}};
   const missing=recover(guarded);
   assert.equal(missing.status,'v4_disabled');
   assert.deepEqual(missing.files,[]);
   assert.equal(missing.target,target);
   assert.equal(built+generated,0);
   // An original draft that fails the formal planner is NOT replaced by a backup lesson.
   const bad=input.generate(input.contextBuilder(),{variant:0});
   bad.date='2000-01-01';
   const rejected=recover({...guarded,originalCandidate:bad});
   assert.equal(rejected.status,'v4_disabled');
   assert(Array.isArray(rejected.originalRejection)&&rejected.originalRejection.length>0,'rejection evidence is kept');
   assert.equal(built+generated,0);
   // Unparseable saved draft (null) also never falls through to V4.
   assert.equal(recover({...guarded,originalCandidate:null}).status,'v4_disabled');
 }
});
test('V4 switch is only on for LESSON_V4_FALLBACK=1 and stays off in every production step',()=>{
 const {v4FallbackEnabled}=require('./recover-missing-lesson');
 const saved=process.env.LESSON_V4_FALLBACK;
 try{
   delete process.env.LESSON_V4_FALLBACK;assert.equal(v4FallbackEnabled(),false);
   for(const v of ['','0','true','yes','on'])process.env.LESSON_V4_FALLBACK=v,assert.equal(v4FallbackEnabled(),false,'only "1" enables: '+v);
   process.env.LESSON_V4_FALLBACK='1';assert.equal(v4FallbackEnabled(),true);
 }finally{if(saved===undefined)delete process.env.LESSON_V4_FALLBACK;else process.env.LESSON_V4_FALLBACK=saved}
 const wf=fs.readFileSync(path.join(base,'.github/workflows/sync-daily-vocab.yml'),'utf8');
 const gen=wf.slice(wf.indexOf('      - name: Generate missing lesson with V2 and commit the two-file transaction'),
   wf.indexOf('      - name: Sync vocab safely'));
 assert(!/LESSON_V4_FALLBACK\s*[:=]/.test(gen),'the production generator step must never set the V4 switch');
 // The only places allowed to set it are the two CI-only isolated rehearsals in the PR preflight job.
 const uses=wf.split('\n').filter(x=>/LESSON_V4_FALLBACK=1 node /.test(x));
 assert.equal(uses.length,2,'only the two isolated CI rehearsals may enable V4');
 assert(!/LESSON_V4_FALLBACK/.test(fs.readFileSync(path.join(base,'.github/workflows/build-learning-runtime.yml'),'utf8')));
});
test('a valid saved original is still resumable while V4 is disabled',()=>{
 delete process.env.LESSON_V4_FALLBACK;
 const {input,target}=setup('pm');
 const draft=input.generate(input.contextBuilder(),{variant:0});
 const r=recover({...input,v4Enabled:undefined,originalCandidate:draft,
   contextBuilder:()=>{throw Error('no context needed')},generate:()=>{throw Error('no generation')}});
 assert.equal(r.status,'ready');assert.equal(r.source,'original_staged');
 assert.deepEqual(r.files.map(x=>x.path),[target,'data/daily/index.json']);
});
test('invalid date and main SHA cannot publish',()=>{
 const {input}=setup('am');
 assert.throws(()=>recover({...input,date:'2026-02-30'}),e=>e.code==='TARGET_INVALID');
 assert.throws(()=>recover({...input,mainHead:'abc'}),e=>e.code==='HEAD_INVALID');
});
test('CLI parser defaults to no file writes',()=>{
 assert.deepEqual(parseArgs(['--date','2026-10-01','--session','am','--main-head',sha]),{
   write:false,date:'2026-10-01',session:'am','main-head':sha
 });
 assert.equal(parseArgs(['--date','2026-10-01','--session','am','--main-head',sha,
   '--original-candidate','/tmp/readonly-original.json'])['original-candidate'],
   '/tmp/readonly-original.json');
});
test('fallback workflow has one existing twice-daily clock and valid Bash steps',()=>{
 const cp=require('node:child_process');
 const workflow=fs.readFileSync(path.join(base,'.github/workflows/sync-daily-vocab.yml'),'utf8');
 const lines=workflow.split('\n');
 const crons=lines.map(x=>x.trim()).filter(x=>x.startsWith('- cron: '));
 assert.deepEqual(crons,["- cron: '30 1 * * *'","- cron: '5 11 * * *'"]);
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
// V4 paused: the branch-create trigger is off and the dormant watcher job can never run.
 assert(!/^  create:\s*$/m.test(workflow),'create: must not be an active trigger while V4 is disabled');
 assert(/^  # create:\s*$/m.test(workflow),'the disabled trigger stays documented for explicit re-enable');
 assert(workflow.includes('    if: ${{ false }}'),'watcher job is hard-disabled');
 assert(workflow.includes("#   if: github.event_name == 'create' && github.event.ref_type == 'branch'"),'original watcher condition kept as a comment');
 assert(workflow.includes('lesson-watch-{0}'));
 assert(workflow.includes("github.ref == 'refs/heads/main' && github.event_name != 'create'"));
 assert(workflow.includes('LESSON_CREATE_FALLBACK_DISPATCHED'));
 assert(workflow.includes('LESSON_CREATE_ALREADY_PUBLISHED'));
 assert(workflow.includes('due_epoch=$((slot_epoch + grace_seconds))'), 'Watcher must not dispatch V2 before the session grace after official lesson start');
 assert.equal((workflow.match(/target_time=08:00; grace_seconds=1800; else target_time=18:00; grace_seconds=300;/g)||[]).length,2,'Remaining gates (dormant watcher + original-draft resume step) keep AM 30-minute / PM 5-minute grace; the failed-PR V4 dispatch and its gate are removed');
 assert(workflow.includes('event_grace=$((created_epoch + 60))'), 'Late-created release branches still get normal upload grace');
 assert(workflow.includes('FALLBACK_GRACE_ACTIVE'), 'The V2 generator must enforce the five-minute time barrier independently');
 assert(!workflow.includes('LESSON_RECOVERY_DEFERRED')&&workflow.includes('LESSON_RECOVERY_V4_DISABLED'), 'Failed-PR path no longer defers/dispatches V4; it reports the disabled state');
 assert(workflow.includes('LESSON_CREATE_DRAFT_STAGED'), 'Staged original gets a bounded normal publication window');
});

test('real watcher Bash enforces five minutes after lesson start (with late-branch upload grace)',()=>{
 const cp=require('node:child_process'),os=require('node:os');
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lesson-watch-test-'));
 try{
   const source=fs.readFileSync(path.join(base,'.github/workflows/sync-daily-vocab.yml'),'utf8').split('\n');
   const name='      - name: Check a newly created release scaffold without holding the main write lock';
   const start=source.indexOf(name);
   assert(start>0);
   const runner=source.findIndex((x,i)=>i>start&&x==='        run: |');
   assert(runner>start);
   const body=[];
   for(let i=runner+1;i<source.length;i++){
     if(source[i].startsWith('          '))body.push(source[i].slice(10));
     else if(!source[i].trim())body.push('');
     else break;
   }
   const dateStub=path.join(tmp,'date'),ghStub=path.join(tmp,'gh'),sleepStub=path.join(tmp,'sleep');
   // The fake Actions run was created at epoch=1000. Official PM starts at 900;
   // V2 cannot dispatch until slot+300=1200, even though event+60=1060.
   fs.writeFileSync(dateStub,[
     '#!/bin/bash',
     'case "$*" in',
     '  *"+%Y-%m-%d"*) echo 2026-10-01 ;;',
     '  *"+%H"*) echo "${FAKE_HOUR:-18}" ;;',
     '  *"18:00:00"*"+%s"*) echo "$FAKE_SLOT_EPOCH" ;;',
     '  *"08:00:00"*"+%s"*) echo "$FAKE_SLOT_EPOCH" ;;',
     '  *"T11:00:00Z"*"+%s"*) echo "$FAKE_CREATED_EPOCH" ;;',
     '  *"+%s"*) echo "$FAKE_NOW_EPOCH" ;;',
     '  *) /usr/bin/date "$@" ;;',
     'esac'
   ].join('\n')+'\n');
   fs.writeFileSync(ghStub,[
     '#!/bin/bash',
     'case "$*" in',
     '  *"/actions/runs/"*) echo "2026-10-01T11:00:00Z" ;;',
     '  *"/contents/data/daily/index.json?ref=main"*)',
     '    if [ "$FAKE_PUBLISH_AFTER_STAGED" = yes ] && grep -qx 120 "$FAKE_SLEEP_LOG" 2>/dev/null; then',
     '      echo "$FAKE_COMPLETE_INDEX_B64"',
     '    else echo "$FAKE_INDEX_B64"; fi ;;',
     '  *"/contents/data/daily/2026-10-01-"*".json?ref=main"*)',
     '    if [ "$FAKE_LESSON_EXISTS" = yes ]; then exit 0; fi',
     '    if [ "$FAKE_PUBLISH_AFTER_STAGED" = yes ] && grep -qx 120 "$FAKE_SLEEP_LOG" 2>/dev/null; then exit 0; fi',
     '    exit 1 ;;',
     '  *"?ref=lesson-release-2026-10-01-"*)',
     '    test "$FAKE_DRAFT_EXISTS" = yes ;;',
     '  *"--method POST"*) printf "DISPATCH %s\\n" "$*" >> "$FAKE_DISPATCH_LOG" ;;',
     '  *) echo "Unexpected gh api call: $*" >&2; exit 9 ;;',
     'esac'
   ].join('\n')+'\n');
   fs.writeFileSync(sleepStub,[
     '#!/bin/bash',
     'printf "%s\\n" "$1" >> "$FAKE_SLEEP_LOG"'
   ].join('\n')+'\n');
   for(const f of [dateStub,ghStub,sleepStub])fs.chmodSync(f,0o755);
   const log=path.join(tmp,'dispatch.log'),sleepLog=path.join(tmp,'sleep.log');
   const run=(ref,options={})=>{
     fs.rmSync(log,{force:true});fs.rmSync(sleepLog,{force:true});
     const am=options.am===true;
     const index={dates:[{date:'2026-10-01',am:am?(options.published||false):true,pm:am?false:(options.published||false)}]};
     const publishedIndex={dates:[{date:'2026-10-01',am:true,pm:!am}]};
     const env={...process.env,PATH:tmp+':'+process.env.PATH,
       CREATED_REF:ref,GITHUB_REPOSITORY:'test/indonesian-learning',GITHUB_RUN_ID:'123',
       GH_TOKEN:'unit-test',FAKE_INDEX_B64:Buffer.from(JSON.stringify(index)).toString('base64'),
       FAKE_COMPLETE_INDEX_B64:Buffer.from(JSON.stringify(publishedIndex)).toString('base64'),
       FAKE_LESSON_EXISTS:options.published?'yes':'no',
       FAKE_DRAFT_EXISTS:options.staged?'yes':'no',
       FAKE_PUBLISH_AFTER_STAGED:options.afterStaged?'yes':'no',
       FAKE_DISPATCH_LOG:log,FAKE_SLEEP_LOG:sleepLog,
       FAKE_CREATED_EPOCH:String(options.createdEpoch??1000),
       FAKE_NOW_EPOCH:String(options.nowEpoch??1000),
       FAKE_SLOT_EPOCH:String(options.slotEpoch??900),
       FAKE_HOUR:String(options.hour??18)};
     const result=cp.spawnSync('bash',['-c',body.join('\n')+'\n'],{env,encoding:'utf8'});
     assert.equal(result.status,0,ref+' stdout='+result.stdout+' stderr='+result.stderr);
     return {stdout:result.stdout,
       dispatched:fs.existsSync(log)?fs.readFileSync(log,'utf8'):'',
       slept:fs.existsSync(sleepLog)?fs.readFileSync(sleepLog,'utf8').trim().split('\n').map(Number):[]};
   };
   const probe=run('lesson-watch-test-probe');
   assert(probe.stdout.includes('LESSON_CREATE_IGNORED'));
   assert.deepEqual(probe.slept,[]);assert.equal(probe.dispatched,'');

   const done=run('lesson-release-2026-10-01-pm',{published:true});
   assert(done.stdout.includes('LESSON_CREATE_ALREADY_PUBLISHED'));
   assert.deepEqual(done.slept,[200]);assert.equal(done.dispatched,'');

   const missing=run('lesson-release-2026-10-01-pm');
   assert(missing.stdout.includes('LESSON_CREATE_FALLBACK_DISPATCHED'));
   assert.deepEqual(missing.slept,[200]);
   assert(missing.dispatched.includes('inputs[recover_date]=2026-10-01'));
   assert(missing.dispatched.includes('inputs[recover_session]=pm'));
   assert.equal(missing.dispatched.trim().split('\n').length,1);

   const runnerLate=run('lesson-release-2026-10-01-pm',{nowEpoch:1270});
   assert.deepEqual(runnerLate.slept,[],'A queued runner past slot+300 must not restart its wait');
   assert(runnerLate.dispatched.includes('inputs[recover_session]=pm'));

   const beforeSlot=run('lesson-release-2026-10-01-pm',{slotEpoch:1100});
   assert.deepEqual(beforeSlot.slept,[400],'Before session start, wait until slot+300, never the start time');
   assert(beforeSlot.dispatched.includes('inputs[recover_session]=pm'));

   const lateBranch=run('lesson-release-2026-10-01-pm',{createdEpoch:1300,nowEpoch:1300});
   assert.deepEqual(lateBranch.slept,[60],'A late ChatGPT release must receive its own 60-second upload grace after :05');
   assert(lateBranch.dispatched.includes('inputs[recover_session]=pm'));

   const tooEarly=run('lesson-release-2026-10-01-pm',{slotEpoch:3000});
   assert(tooEarly.stdout.includes('LESSON_CREATE_IGNORED'));
   assert.deepEqual(tooEarly.slept,[]);assert.equal(tooEarly.dispatched,'');

   const staged=run('lesson-release-2026-10-01-pm',{staged:true});
   assert(staged.stdout.includes('LESSON_CREATE_DRAFT_STAGED'));
   assert.deepEqual(staged.slept,[200,120]);
   assert(staged.dispatched.includes('inputs[recover_session]=pm'));

   const normallyPublished=run('lesson-release-2026-10-01-pm',{staged:true,afterStaged:true});
   assert(normallyPublished.stdout.includes('LESSON_CREATE_ALREADY_PUBLISHED'));
   assert.deepEqual(normallyPublished.slept,[200,120]);
   assert.equal(normallyPublished.dispatched,'');

   // AM: slot 900 (08:00), V2 never before slot+1800 (08:30).
   const amMissing=run('lesson-release-2026-10-01-am',{am:true,hour:8});
   assert.deepEqual(amMissing.slept,[1700],'AM waits until 08:30 before requesting V2');
   assert(amMissing.dispatched.includes('inputs[recover_session]=am'));
   const amStaged=run('lesson-release-2026-10-01-am',{am:true,hour:8,staged:true,afterStaged:true});
   assert(amStaged.stdout.includes('LESSON_CREATE_ALREADY_PUBLISHED'));
   assert.deepEqual(amStaged.slept,[1700,120]);assert.equal(amStaged.dispatched,'');
   const amEarlyBranch=run('lesson-release-2026-10-01-am',{am:true,hour:7,slotEpoch:2600});
   assert(amEarlyBranch.stdout.includes('LESSON_CREATE_IGNORED'),'AM branch created more than 25 minutes before 08:00 is left to the 08:30 schedule');
   const amWatched=run('lesson-release-2026-10-01-am',{am:true,hour:7,slotEpoch:2500});
   assert.deepEqual(amWatched.slept,[3300],'AM branch created 25 minutes before 08:00 is watched until 08:30');
 }finally{fs.rmSync(tmp,{recursive:true,force:true})}
});


test('V2 recovery rejects grammatically valid JSON with a target-free active output',()=>{
 const {input}=setup('am'),valid=input.generate;
 let count=0;
 assert.throws(()=>recover({...input,generate:(ctx,opt)=>{
   count++;
   const lesson=valid(ctx,opt);
   lesson.output.reference_answer='Saya pergi ke kantor hari ini. Setelah itu saya pulang ke rumah.';
   return lesson;
 }}),e=>e.code==='NO_VALID_VARIANT'&&e.message.includes('QUALITY_OUTPUT_TARGET_MISMATCH'));
 assert.equal(count,6,'Do not silently publish an otherwise structurally valid low-quality variant');
});

test('formal PM validator enforces precise AM source without invalidating immutable old lessons',()=>{
 const {ctx,input}=setup('pm');
 const {validate}=require('./validate-lesson-candidate');
 const candidate=core.generate(ctx,bundle,rows,{variant:0});
 const params={index:input.index,runtime:input.runtime,rules,
   expectedDate:'2026-10-01',expectedSession:'pm',sameDayAm,previousPm,
   reviewHistory:history(ctx)};
 let result=validate({lesson:candidate,...params});
 assert(result.ok,'Correct V2 labels must be accepted: '+JSON.stringify(result.errors));
 const mistaken=JSON.parse(JSON.stringify(candidate));
 mistaken.vocab.find(v=>v.word==='niat').usage_note='今天08:00新学；晚课作为 application 主动复现。';
 result=validate({lesson:mistaken,...params});
 assert(!result.ok,'Old niat must never be falsely marked as AM new');
 assert(result.errors.some(e=>e.code==='AM_MARKER_FALSE'&&e.detail==='niat'),
   'Invalid source marker must be explicitly rejected: '+JSON.stringify(result.errors));
 const legacyPublished=get('data/daily/2026-10-01-pm.json');
 result=validate({lesson:legacyPublished,...params});
 assert(result.ok,'Existing already-published PM should remain historically valid: '+JSON.stringify(result.errors));
});

test('October 1 PM application notes distinguish morning new from morning old reviews',()=>{
 const {ctx}=setup('pm'),lesson=core.generate(ctx,bundle,rows,{variant:0});
 const apps=new Map(lesson.vocab.filter(v=>v.source_group==='application').map(v=>[v.word,v]));
 assert(sameDayAm.new_words.includes('biarpun'));
 assert(sameDayAm.review_vocab.includes('niat'));
 assert(sameDayAm.review_vocab.includes('mengeluh'));
 assert(!sameDayAm.new_words.includes('niat'));
 assert(!sameDayAm.new_words.includes('mengeluh'));
 assert.match(apps.get('biarpun').usage_note,/今天08:00新学/);
 for(const w of ['niat','mengeluh']){
   assert.match(apps.get(w).usage_note,/今天08:00复习过的老词/);
   assert.doesNotMatch(apps.get(w).usage_note,/新学|已教/);
 }
});


test('active authorized normal PR has priority over V2, completed failure does not suppress recovery',()=>{
 const cp=require('node:child_process');
 const filter=path.join(base,'.github/scripts/normal-release-priority.jq');
 assert(fs.existsSync(filter),'Workflow priority filter must exist');
 const branch='lesson-release-2026-10-02-am',pr=54;
 const run=(status,ref=branch,n=pr,pulls=true)=>{
   const data={workflow_runs:status==null?[]:[{
     event:'pull_request',head_branch:ref,status,
     pull_requests:pulls?[{number:n}]:[]
   }]};
   const result=cp.spawnSync('jq',['-e','--arg','branch',branch,'--argjson','number',String(pr),
     '-f',filter],{encoding:'utf8',input:JSON.stringify(data)});
   assert([0,1].includes(result.status),'jq filter should be evaluable: '+result.stderr);
   return result.status===0;
 };
 assert(run('queued'), 'A queued original PR must defer V2');
 assert(run('in_progress'), 'An original PR in progress must defer V2');
 assert(run('waiting'), 'A waiting original PR must defer V2');
 assert(run('pending'), 'A pending original PR must defer V2');
 assert(run('requested'), 'An original PR awaiting runner must defer V2');
 assert(run('in_progress',branch,pr,false),'Fallback on exact head branch if Actions omits the PR list');
 for(const status of ['completed',null]){
   assert(!run(status),'A failed/completed or absent normal PR must allow V2');
 }
 assert(!run('in_progress','lesson-release-2026-10-02-pm'),'Wrong lesson cannot suppress V2');
 assert(!run('in_progress',branch,999),'Different PR number cannot suppress V2');
});

test('fallback checks normal/manual priority at publication time, not just in the branch watcher',()=>{
 const w=fs.readFileSync(path.join(base,'.github/workflows/sync-daily-vocab.yml'),'utf8');
 const start=w.indexOf('      - name: Generate missing lesson with V2 and commit the two-file transaction');
 const finish=w.indexOf('      - name: Sync vocab safely',start);
 assert(start>=0&&finish>start);
 const block=w.slice(start,finish);
 assert(block.includes('NORMAL_RELEASE_ACTIVE PR='));
 assert(block.includes('normal-release-priority.jq'));
 assert(block.includes('ORIGINAL_STAGED_FOUND'));
 assert(block.includes('stage_paths')&&block.includes('"$stage_paths" = "$candidate"'));
 assert(block.includes('original_arg=(--original-candidate "$staged_candidate")'));
 assert(block.includes('ORIGINAL_STAGED_CHANGED'));
 assert(block.includes('LESSON_RECOVERY_SOURCE'));
 assert(block.includes('git ls-remote --heads origin "refs/heads/$original_branch"'));
 assert(block.indexOf('ORIGINAL_STAGED_FOUND')<block.indexOf('node .github/scripts/recover-missing-lesson.js'));
 assert(block.includes('priority_rc'));
 assert(block.includes('Do not race the normal lesson'));
 assert(block.indexOf('NORMAL_RELEASE_ACTIVE')<block.indexOf('node .github/scripts/recover-missing-lesson.js'));
 assert(w.includes('pull-requests: read')&&w.includes('actions: read'));
 const failure=w.slice(w.indexOf('      - name: Recover immediately after an eligible lesson release fails'),
   w.indexOf('  extensive_reading_release:'));
assert(failure.includes('NORMAL_LESSON_ALREADY_PUBLISHED'));
 assert(failure.includes('dispatch Sync only, never V2'));
 assert(failure.includes('LESSON_RECOVERY_V4_DISABLED'));
 assert(!failure.includes('inputs[recover_date]=$date'),'failed-PR path must not dispatch a backup generator');
 assert(!failure.includes('inputs[recover_session]=$session'));
 assert(failure.includes('gh api --method POST'),'Sync-only dispatch for an already published lesson remains');
});

test('the actual failed-release Bash sends Sync only if ChatGPT/manual already published',()=>{
 const cp=require('node:child_process'),os=require('node:os');
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'normal-priority-failure-test-'));
 try{
   const lines=fs.readFileSync(path.join(base,'.github/workflows/sync-daily-vocab.yml'),'utf8').split('\n');
   const start=lines.findIndex(x=>x.includes('      - name: Recover immediately after an eligible lesson release fails'));
   const at=lines.findIndex((x,i)=>i>start&&x==='        run: |');
   assert(start>0&&at>start);
   const body=[];
   for(let i=at+1;i<lines.length;i++){
     if(lines[i].startsWith('          '))body.push(lines[i].slice(10));
     else if(!lines[i].trim())body.push('');
     else break;
   }
   const gh=path.join(tmp,'gh'),date=path.join(tmp,'date'),log=path.join(tmp,'calls.txt');
   fs.writeFileSync(gh,[
     '#!/bin/bash',
     'case "$*" in',
     '  *"/contents/data/daily/index.json?ref=main"*) echo "$TEST_INDEX_B64" ;;',
     '  *"/contents/data/daily/2026-10-01-pm.json?ref=main"*) test "$TEST_FILE_PRESENT" = yes ;;',
     '  *"--method POST"*) printf "%s\\n" "$*" >> "$TEST_GH_LOG" ;;',
     '  *) echo "Unexpected GitHub call: $*" >&2; exit 9 ;;',
     'esac'
   ].join('\n')+'\n');
   fs.writeFileSync(date,[
     '#!/bin/bash',
     'case "$*" in',
     '  *"18:00:00"*"+%s"*) echo 1000 ;;',
     '  *"+%s"*) echo "$FAKE_NOW_EPOCH" ;;',
     '  *) /usr/bin/date "$@" ;;',
     'esac'
   ].join('\n')+'\n');
   fs.chmodSync(gh,0o755);fs.chmodSync(date,0o755);
   const run=(flag,exists,now=1600)=>{
     fs.rmSync(log,{force:true});
     const ix=Buffer.from(JSON.stringify({dates:[{date:'2026-10-01',am:true,pm:flag}]})).toString('base64');
     const env={...process.env,PATH:tmp+':'+process.env.PATH,
       RELEASE_BRANCH:'lesson-release-2026-10-01-pm',
       GITHUB_REPOSITORY:'test/indonesian-learning',GH_TOKEN:'test-only',
       TEST_INDEX_B64:ix,TEST_FILE_PRESENT:exists?'yes':'no',TEST_GH_LOG:log,
       FAKE_NOW_EPOCH:String(now)};
     const r=cp.spawnSync('bash',['-c',body.join('\n')+'\n'],{env,encoding:'utf8'});
     assert.equal(r.status,0,'failure handler: '+r.stderr+' '+r.stdout);
     return {text:r.stdout,calls:fs.existsSync(log)?fs.readFileSync(log,'utf8').trim().split('\n'):[]};
   };
   const published=run(true,true);
   assert(published.text.includes('NORMAL_LESSON_ALREADY_PUBLISHED'));
   assert.equal(published.calls.length,1);
   assert(!published.calls[0].includes('inputs[recover_date]'));
   assert(!published.calls[0].includes('inputs[recover_session]'));
   // V4 paused: a failed release never dispatches a backup generator, at any time of day.
   for(const [flag,exists,now] of [[false,false,1299],[false,false,1300],[false,false,5000],[true,false,1300]]){
     const r=run(flag,exists,now);
     assert(r.text.includes('LESSON_RECOVERY_V4_DISABLED'),'failure is reported, not recovered with V4');
     assert.deepEqual(r.calls,[],'No recovery dispatch of any kind while V4 is disabled');
   }
 }finally{fs.rmSync(tmp,{recursive:true,force:true})}
});

test('actual V2 generator shell enforces AM slot+1800 and PM slot+300 for explicit dispatch and Cron',()=>{
 const cp=require('node:child_process'),os=require('node:os');
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fallback-time-gate-'));
 try{
   const lines=fs.readFileSync(path.join(base,'.github/workflows/sync-daily-vocab.yml'),'utf8').split('\n');
   const start=lines.findIndex(x=>x.includes('      - name: Generate missing lesson with V2 and commit the two-file transaction'));
   const at=lines.findIndex((x,i)=>i>start&&x==='        run: |');
   assert(start>0&&at>start);
   const body=[];
   for(let i=at+1;i<lines.length;i++){
     if(lines[i].startsWith('          '))body.push(lines[i].slice(10));
     else if(!lines[i].trim())body.push('');
     else break;
   }
   const cutoff=body.findIndex(x=>x.startsWith("git config user.name"));
   assert(cutoff>0,'Extract the production gate before any git/lesson writes');
   const date=path.join(tmp,'date');
   fs.writeFileSync(date,[
     '#!/bin/bash',
     'case "$*" in',
     '  *"+%Y-%m-%d"*) echo "$FAKE_LOCAL_DATE" ;;',
     '  *"+%H"*) echo "$FAKE_LOCAL_HOUR" ;;',
     '  *"08:00:00"*"+%s"*) echo 1000 ;;',
     '  *"18:00:00"*"+%s"*) echo 1000 ;;',
     '  *"+%s"*) echo "$FAKE_NOW_EPOCH" ;;',
     '  *) /usr/bin/date "$@" ;;',
     'esac'
   ].join('\n')+'\n');fs.chmodSync(date,0o755);
   const script=body.slice(0,cutoff).join('\n')+'\necho FALLBACK_GATE_CONTINUES\n';
   const run=(mode,now,session='pm',localDate='2026-10-01')=>{
     const env={...process.env,PATH:tmp+':'+process.env.PATH,
       GITHUB_EVENT_NAME:mode,RECOVER_DATE:'2026-10-01',RECOVER_SESSION:session,
       FALLBACK_CRON:session==='am'?'30 1 * * *':'5 11 * * *',
       FAKE_LOCAL_DATE:localDate,FAKE_LOCAL_HOUR:session==='am'?'08':'18',FAKE_NOW_EPOCH:String(now)};
     const result=cp.spawnSync('bash',['-c',script],{env,encoding:'utf8'});
     assert.equal(result.status,0,'V2 gate: '+result.stderr+' '+result.stdout);
     return result.stdout;
   };
   for(const mode of ['workflow_dispatch','schedule']){
     const before=run(mode,1299);
     assert(before.includes('FALLBACK_GRACE_ACTIVE')&&!before.includes('FALLBACK_GATE_CONTINUES'),
       mode+' must refuse 18:04:59');
     const onTime=run(mode,1300);
     assert(onTime.includes('FALLBACK_TIME_GATE_OPEN')&&onTime.includes('FALLBACK_GATE_CONTINUES'),
       mode+' must allow 18:05:00');
     const morningAt0805=run(mode,1300,'am');
     assert(morningAt0805.includes('FALLBACK_GRACE_ACTIVE')&&!morningAt0805.includes('FALLBACK_GATE_CONTINUES'),
       mode+' must refuse AM V2 at 08:05');
     const morningBefore=run(mode,2799,'am');
     assert(morningBefore.includes('FALLBACK_GRACE_ACTIVE'),mode+' must refuse 08:29:59');
     const morningOpen=run(mode,2800,'am');
     assert(morningOpen.includes('FALLBACK_GATE_CONTINUES'),mode+' must allow 08:30:00');
   }
   const stale=run('workflow_dispatch',1300,'pm','2026-10-02');
   assert(stale.includes('Stale or premature fallback')&&!stale.includes('FALLBACK_GATE_CONTINUES'),
     'Stale next-day recoveries stay blocked');
 }finally{fs.rmSync(tmp,{recursive:true,force:true})}
});

async function checkDailyAmTagRendering(){
 const vm=require('node:vm');
 const publishedPm=get('data/daily/2026-10-01-pm.json');
 // Include one application card that is neither in today's AM new set nor its AM review set.
 const pm=JSON.parse(JSON.stringify(publishedPm));
 pm.vocab.push({word:'rencana',source_group:'application'});
 const count=new Array(pm.vocab.length).fill(0);
 const cards=pm.vocab.map((v,i)=>{
   const card={tag:null};
   const meta={firstChild:null,insertBefore:(span)=>{card.tag=span;count[i]++}};
   card.querySelector=selector=>selector==='.dailyAmTaught'?card.tag:selector==='.dailyFixMeta'?meta:null;
   return card;
 });
 const body={lastElementChild:null,querySelector:()=>({})};
 const document={
   getElementById:id=>id==='dailyLightPatchStyle'?{}:id==='dailyMeta'?{textContent:'2026-10-01'}:id==='dailyBody'?body:null,
   querySelectorAll:selector=>selector==='#dailyBody .dailyFixVocab'?cards:[],
   createElement:tag=>({className:'',textContent:'',tag})
 };
 const window={openDaily:async()=>{}};
 const fetchJSON=async p=>p.endsWith('-am.json')?sameDayAm:pm;
 const script=fs.readFileSync(path.join(base,'data/daily-light-test.js'),'utf8');
 vm.runInNewContext(script,{window,document,fetchJSON,console},{filename:'daily-light-test.js'});
 await window.openDaily('pm','2026-10-01');
 const tag=w=>cards[pm.vocab.findIndex(x=>x.word===w)].tag?.textContent;
 assert.equal(tag('biarpun'),'今天 08:00 新学 · 晚课复现');
 assert.equal(tag('niat'),'今天 08:00 复习过 · 老词');
 assert.equal(tag('mengeluh'),'今天 08:00 复习过 · 老词');
 assert.equal(tag('rencana'),'此前已学 · 晚课复现');
 assert.equal(tag('sesudah'),undefined,'Only application cards receive previous-learning tags');
 await window.openDaily('pm','2026-10-01');
 assert(count.every(x=>x<=1),'Repeated opening must not duplicate a label');
 const home=fs.readFileSync(path.join(base,'index.html'),'utf8');
 const actualHash=require('node:crypto').createHash('sha256').update(script).digest('hex').slice(0,12);
 assert(home.includes('data/daily-light-test.js?v='+actualHash),'New UI must use actual content hash, not a stale script URL');
 passed++;
 console.log('PASS October 1 published PM cards render accurate new/review/old tags and remain idempotent');
}
checkDailyAmTagRendering()
 .then(()=>console.log('FALLBACK_RECOVERY_TEST '+JSON.stringify({ok:true,passed})))
 .catch(e=>{console.error('FAIL DAILY_AM_LABEL '+e.stack);process.exitCode=1});

