#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const assert=require('node:assert/strict');
const {recover,run,parseArgs}=require('./recover-missing-lesson');
const root=path.resolve(__dirname,'../..');
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name)}
function fixture(session){
  const date='2026-10-01',target='data/daily/'+date+'-'+session+'.json';
  const original={date,session,time:session==='am'?'08:00':'18:00',write_status:'lesson_complete'};
  const resultFiles=[
    {path:target,content:JSON.stringify(original)+'\n'},
    {path:'data/daily/index.json',content:JSON.stringify({dates:[{date,am:session==='am',pm:session==='pm'}]})+'\n'}
  ];
  const input={
    date,session,mainHead:'a'.repeat(40),
    index:{dates:[]},runtime:{generated_at:'test'},rules:{},
    read:()=>undefined,historyBuilder:()=>[],
    planner:({lesson,expectedDate,expectedSession,mainHead})=>{
      assert.deepEqual(lesson,original);
      assert.equal(expectedDate,date);
      assert.equal(expectedSession,session);
      assert.equal(mainHead,'a'.repeat(40));
      return {ok:true,status:'ready',files:resultFiles,candidateHash:'test'};
    }
  };
  return {input,original,target,resultFiles};
}
for(const session of ['am','pm']){
  test(session.toUpperCase()+' without a saved original neither plans nor generates',()=>{
    const {input,target}=fixture(session);
    let used=0;
    const r=recover({...input,planner:()=>{used++;throw Error('must not plan')},historyBuilder:()=>{used++;throw Error('must not inspect history')}});
    assert.equal(r.status,'no_original');
    assert.deepEqual(r.files,[]);
    assert.equal(r.target,target);
    assert.equal(used,0);
  });
  test(session.toUpperCase()+' valid original uses the canonical two-file planner',()=>{
    const {input,original,target}=fixture(session);
    const r=recover({...input,originalCandidate:original});
    assert.equal(r.status,'ready');
    assert.equal(r.source,'original_staged');
    assert.equal(r.variant,null);
    assert.deepEqual(r.files.map(x=>x.path),[target,'data/daily/index.json']);
    assert.deepEqual(JSON.parse(r.files[0].content),original);
  });
  test(session.toUpperCase()+' invalid original is rejected without replacement',()=>{
    const {input,original}=fixture(session);
    const r=recover({...input,originalCandidate:original,planner:()=>({
      ok:false,status:'invalid',errors:[{code:'READING_INVALID'}]
    })});
    assert.equal(r.status,'original_invalid');
    assert.deepEqual(r.files,[]);
    assert.equal(r.originalRejection[0].code,'READING_INVALID');
  });
  test(session.toUpperCase()+' invalid JSON object cannot trigger a second candidate',()=>{
    const {input}=fixture(session);
    let plans=0;
    const r=recover({...input,originalCandidate:null,planner:()=>{
      plans++;return {ok:false,status:'invalid',errors:[{code:'INPUT_INVALID'}]};
    }});
    assert.equal(r.status,'original_invalid');
    assert.equal(plans,1);
    assert.deepEqual(r.files,[]);
  });
  test(session.toUpperCase()+' planner throwing fails closed',()=>{
    const {input,original}=fixture(session);
    const r=recover({...input,originalCandidate:original,planner:()=>{throw Error('broken planner')}});
    assert.equal(r.status,'original_invalid');
    assert.equal(r.originalRejection[0].code,'ORIGINAL_PLAN_ERROR');
    assert.deepEqual(r.files,[]);
  });
  test(session.toUpperCase()+' unexpected planner file paths are rejected',()=>{
    const {input,original}=fixture(session);
    const r=recover({...input,originalCandidate:original,planner:()=>({
      ok:true,status:'ready',files:[{path:'other.json'},{path:'data/daily/index.json'}]
    })});
    assert.equal(r.status,'original_invalid');
    assert.deepEqual(r.files,[]);
  });
  test(session.toUpperCase()+' published lesson is never overwritten',()=>{
    const {input,original}=fixture(session);
    const index={dates:[{date:input.date,[session]:true}]};
    const r=recover({...input,index,originalCandidate:original,read:p=>p.includes('2026-10-01-'+session)?original:undefined,planner:()=>{throw Error('must not plan')}});
    assert.equal(r.status,'already_published');
    assert.deepEqual(r.files,[]);
  });
  test(session.toUpperCase()+' already-published identity mismatch is blocked',()=>{
    const {input,original}=fixture(session);
    const index={dates:[{date:input.date,[session]:true}]};
    assert.throws(()=>recover({...input,index,read:p=>p.includes('2026-10-01-'+session)?{...original,time:'00:00'}:undefined}),e=>e.code==='PUBLISHED_IDENTITY_MISMATCH');
  });
  test(session.toUpperCase()+' orphan original is blocked',()=>{
    const {input,original,target}=fixture(session);
    assert.throws(()=>recover({...input,read:p=>p===target?original:undefined}),e=>e.code==='PARTIAL_PUBLICATION');
  });
  test(session.toUpperCase()+' missing lesson with index=true is blocked',()=>{
    const {input}=fixture(session);
    assert.throws(()=>recover({...input,index:{dates:[{date:input.date,[session]:true}]}}),e=>e.code==='PARTIAL_PUBLICATION');
  });
}
test('duplicate date and malformed target are refused',()=>{
  const {input}=fixture('am');
  assert.throws(()=>recover({...input,index:{dates:[{date:input.date},{date:input.date}]}}),e=>e.code==='INDEX_INVALID');
  assert.throws(()=>recover({...input,date:'2026-02-30'}),e=>e.code==='TARGET_INVALID');
  assert.throws(()=>recover({...input,mainHead:'not a sha'}),e=>e.code==='HEAD_INVALID');
});
test('CLI validates original-draft arguments',()=>{
  assert.deepEqual(parseArgs(['--date','2026-10-01','--session','am','--main-head','a'.repeat(40),'--write']),{
    write:true,date:'2026-10-01',session:'am','main-head':'a'.repeat(40)
  });
  assert.throws(()=>parseArgs(['--unknown','x']),e=>e.code==='ARGUMENT_INVALID');
  assert.throws(()=>parseArgs(['--write','--write']),e=>e.code==='ARGUMENT_INVALID');
});
test('CLI with --write and no original leaves official data unchanged',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'original-recovery-'));
  try{
    fs.mkdirSync(path.join(temp,'data/daily'),{recursive:true});
    const idx=path.join(temp,'data/daily/index.json'),value='{"dates":[]}\n';
    fs.writeFileSync(idx,value);
    fs.writeFileSync(path.join(temp,'data/learning-runtime.json'),'{}\n');
    fs.writeFileSync(path.join(temp,'data/learning-pool-rules.json'),'{}\n');
    const r=run(['--date','2026-10-01','--session','am','--main-head','a'.repeat(40),'--write'],temp);
    assert.equal(r.status,'no_original');
    assert.deepEqual(r.paths,[]);
    assert.equal(fs.readFileSync(idx,'utf8'),value);
    assert.equal(fs.existsSync(path.join(temp,'data/daily/2026-10-01-am.json')),false);
  }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
test('workflow contains original recovery but no backup-generator path',()=>{
  const wf=fs.readFileSync(path.join(root,'.github/workflows/sync-daily-vocab.yml'),'utf8');
  const recovery=fs.readFileSync(path.join(root,'.github/scripts/recover-missing-lesson.js'),'utf8');
  assert(!/^  create:\s*$/m.test(wf));
  assert(!wf.includes('watch_release_scaffold:'));
  assert(!wf.includes('LESSON_V4_FALLBACK'));
  assert(!wf.includes('prototype/lesson-engine'));
  assert(!/generate-prototype|engine\.generate|v4FallbackEnabled|LESSON_V4_FALLBACK/.test(recovery));
  assert(wf.includes("      - name: Recover saved original lesson and commit the two-file transaction"));
  assert(wf.includes("node .github/scripts/recover-missing-lesson.js"));
  assert(wf.includes('(no_original|already_published)'));
  assert(wf.includes('(no_original|original_invalid)'));
  assert(wf.includes('ORIGINAL_STAGED_FOUND'));
  assert(wf.includes('NORMAL_RELEASE_ACTIVE'));
  assert(wf.includes('ORIGINAL_RECOVERY_SOURCE'));
  assert(wf.includes('Request Pages build after original-draft recovery'));
  assert(wf.includes('Scheduled recovery found incomplete lesson'));
  assert(!wf.includes('LESSON_RECOVERY_V4_DISABLED'));
  const crons=wf.split('\n').map(x=>x.trim()).filter(x=>x.startsWith('- cron: '));
  assert.deepEqual(crons,["- cron: '30 1 * * *'","- cron: '5 11 * * *'"]);
});
test('original-recovery and failed-release Bash steps remain valid',()=>{
  const wf=fs.readFileSync(path.join(root,'.github/workflows/sync-daily-vocab.yml'),'utf8').split('\n');
  for(const name of ['Recover saved original lesson and commit the two-file transaction','Recover immediately after an eligible lesson release fails']){
    const start=wf.findIndex(x=>x==='      - name: '+name);
    assert(start>0,name+' step missing');
    const runIndex=wf.findIndex((x,i)=>i>start&&x==='        run: |');
    assert(runIndex>start,name+' shell missing');
    const body=[];
    for(let i=runIndex+1;i<wf.length;i++){
      if(wf[i].startsWith('          '))body.push(wf[i].slice(10));
      else if(!wf[i].trim())body.push('');
      else break;
    }
    const c=cp.spawnSync('bash',['-n'],{input:body.join('\n')+'\n',encoding:'utf8'});
    assert.equal(c.status,0,name+': '+c.stderr);
  }
});
console.log('Original-only recovery: '+passed+' passed');
