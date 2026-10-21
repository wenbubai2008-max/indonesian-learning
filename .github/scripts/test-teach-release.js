#!/usr/bin/env node
'use strict';
// 2026-10-21: runs the real teach_release step script from sync-daily-vocab.yml in a temporary local Git repository.
// GitHub's API (gh) and sleep are local stand-ins; git, jq, node, check-teach.js, validate-teach.js and deep-teach.js
// are real. The pilot lesson/teach pair from the repository is the valid fixture.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const repo=path.resolve(__dirname,'..','..');
const wf=fs.readFileSync(path.join(repo,'.github/workflows/sync-daily-vocab.yml'),'utf8');
function stepScript(name){
  const at=wf.indexOf('- name: '+name);assert(at>0,'step not found: '+name);
  const run=wf.indexOf('run: |',at),lines=wf.slice(run).split('\n').slice(1),out=[];
  const indent=lines[0].match(/^ */)[0].length;
  for(const l of lines){if(l.trim()&&l.match(/^ */)[0].length<indent)break;out.push(l.slice(indent))}
  return out.join('\n');
}
const script=stepScript('Wait for the lesson, validate and squash-merge the deep-teach file');
const ID='2026-10-19-am',LESSON=`data/daily/${ID}.json`,TEACH=`data/teach/${ID}.json`;
const sh=(cmd,cwd)=>cp.execSync(cmd,{cwd,stdio:['ignore','pipe','pipe']}).toString().trim();
let passed=0;
function scenario(label,{onMain=true,teachOnMain=false,extraFile=false,teach=null,merged=false},expect){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'teach-release-')),origin=path.join(tmp,'origin.git'),work=path.join(tmp,'work'),bin=path.join(tmp,'bin'),runner=path.join(tmp,'runner');
  try{
    fs.mkdirSync(bin);fs.mkdirSync(runner);
    sh(`git init -q --bare -b main "${origin}"`,tmp);sh(`git clone -q "${origin}" work`,tmp);
    sh('git config user.email t@t && git config user.name t',work);
    const put=(rel,from)=>{fs.mkdirSync(path.dirname(path.join(work,rel)),{recursive:true});fs.copyFileSync(from||path.join(repo,rel),path.join(work,rel))};
    for(const f of ['.github/scripts/check-teach.js','.github/scripts/validate-teach.js','data/deep-teach.js'])put(f);
    if(onMain)put(LESSON);
    if(teachOnMain)put(TEACH);
    fs.writeFileSync(path.join(work,'README'),'x');
    sh('git add -A && git commit -qm main && git push -q origin HEAD:main',work);
    sh(`git checkout -q -b teach-${ID}`,work);
    if(teach)fs.mkdirSync(path.join(work,'data/teach'),{recursive:true}),fs.writeFileSync(path.join(work,TEACH),JSON.stringify(teach));else put(TEACH);
    if(extraFile)fs.writeFileSync(path.join(work,'data/extra.json'),'{}');
    sh('git add -A && git commit -qm teach',work);
    const head=sh('git rev-parse HEAD',work),log=path.join(tmp,'gh.log');
    fs.writeFileSync(path.join(bin,'gh'),`#!/usr/bin/env node
const fs=require('fs');const a=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(log)},a.join(' ')+'\\n');
if(a.includes('PUT')){console.log(JSON.stringify({merged:true,sha:'m'.repeat(40)}));process.exit(0)}
console.log(JSON.stringify({state:${JSON.stringify(merged?'closed':'open')},merged:${merged},mergeable:true,head:{sha:${JSON.stringify(head)}}}));`,{mode:0o755});
    fs.writeFileSync(path.join(bin,'sleep'),'#!/bin/sh\nexit 0\n',{mode:0o755});
    const env={...process.env,PATH:bin+':'+process.env.PATH,GITHUB_REPOSITORY:'o/r',GH_TOKEN:'t',PR_NUMBER:'7',PR_HEAD_REF:'teach-'+ID,PR_HEAD_SHA:head,RUNNER_TEMP:runner,GITHUB_WORKSPACE:work};
    const r=cp.spawnSync('bash',['-c',script],{cwd:work,env,encoding:'utf8'});
    const calls=fs.existsSync(log)?fs.readFileSync(log,'utf8'):'';
    expect({code:r.status,out:r.stdout+r.stderr,mergedCall:/PUT/.test(calls),calls,head});
    passed++;console.log('PASS '+label);
  }finally{fs.rmSync(tmp,{recursive:true,force:true})}
}
scenario('valid deep-teach file is checked against the main lesson and squash-merged at the exact head',{},x=>{
  assert.equal(x.code,0,x.out);assert.match(x.out,/DEEP_TEACH_PUBLISHED id=2026-10-19-am pr=7/);assert(x.mergedCall);assert(x.calls.includes('sha='+x.head));assert.match(x.out,/"shape_ok": true/)});
scenario('a PR that changes any other path is refused',{extraFile:true},x=>{assert.notEqual(x.code,0);assert.match(x.out,/Unexpected deep-teach PR paths/);assert(!x.mergedCall)});
scenario('no lesson on main: waits (bounded), then fails without merging',{onMain:false},x=>{assert.notEqual(x.code,0);assert.match(x.out,/Lesson not published/);assert.match(x.out,/attempt 60\/60/);assert(!x.mergedCall)});
scenario('invalid teaching data is refused',{teach:{version:1,intro:['x'],items:[]}},x=>{assert.notEqual(x.code,0);assert(!x.mergedCall);assert.match(x.out,/ITEM_MISSING|SHAPE_INVALID/)});
const edited=JSON.parse(fs.readFileSync(path.join(repo,TEACH),'utf8'));edited.title+=' v2';
scenario('a lesson that already has deep-teach on main is not overwritten',{teachOnMain:true,teach:edited},x=>{assert.notEqual(x.code,0);assert.match(x.out,/Deep-teach already published/);assert(!x.mergedCall)});
scenario('an already merged PR is a no-op',{merged:true},x=>{assert.equal(x.code,0);assert.match(x.out,/already merged\/closed/);assert(!x.mergedCall)});
console.log(`Teach release tests passed: ${passed} scenarios.`);
