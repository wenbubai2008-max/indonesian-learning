#!/usr/bin/env node
'use strict';
/**
 * 2026-10-21: one check for a deep-teach file (data/teach/D-S.json) against its published lesson.
 * Runs both the content validator (validate-teach.js) and the page's own shape check (DeepTeach.validateShape in
 * data/deep-teach.js), so a file that passes here is one the site will actually show.
 *   node .github/scripts/check-teach.js --lesson data/daily/D-S.json --teach data/teach/D-S.json [--repo <root>]
 * --repo selects which copy of the validator and engine to trust (the release job passes a main worktree).
 * Prints JSON {ok, errors, warnings, shape_ok, size}; exit 1 when not ok.
 */
const fs=require('fs'),path=require('path'),vm=require('vm');
function arg(name){const i=process.argv.indexOf(name);return i>0?process.argv[i+1]:''}
function checkTeach(lesson,teach,repo){
  const root=repo||path.resolve(__dirname,'..','..');
  const {validateTeach}=require(path.join(root,'.github','scripts','validate-teach.js'));
  const r=validateTeach(lesson,teach);
  const sandbox={window:{},document:{addEventListener(){}},console:{warn(){},log(){},error(){}}};
  let shape=false;
  try{vm.runInNewContext(fs.readFileSync(path.join(root,'data','deep-teach.js'),'utf8'),sandbox);shape=sandbox.window.DeepTeach.validateShape(teach,lesson)===true}catch(e){r.errors.push('SHAPE_CHECK_FAILED '+e.message)}
  if(!shape)r.errors.push('SHAPE_INVALID the page would not show this teaching data (DeepTeach.validateShape=false)');
  return {ok:r.errors.length===0,errors:r.errors,warnings:r.warnings,shape_ok:shape,size:JSON.stringify(teach||null).length};
}
module.exports={checkTeach};
if(require.main===module){
  const lp=arg('--lesson'),tp=arg('--teach');
  if(!lp||!tp){console.error('usage: check-teach.js --lesson data/daily/D-S.json --teach data/teach/D-S.json [--repo <root>]');process.exit(2)}
  let out;
  try{out=checkTeach(JSON.parse(fs.readFileSync(lp,'utf8')),JSON.parse(fs.readFileSync(tp,'utf8')),arg('--repo')?path.resolve(arg('--repo')):'')}
  catch(e){out={ok:false,errors:['TEACH_INVALID '+e.message],warnings:[],shape_ok:false,size:0}}
  console.log(JSON.stringify(out,null,1));
  process.exitCode=out.ok?0:1;
}
