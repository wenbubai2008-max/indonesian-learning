#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const core=require('./core.js');

const ROOT=path.resolve(__dirname,'..');
const REPO=path.resolve(ROOT,'../..');

function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8'))}
function loadBundle(){return readJson(path.join(ROOT,'materials/materials-bundle.json'))}
function loadDailyRows(){
  const p=path.join(REPO,'data/daily-vocab-data.js');
  if(!fs.existsSync(p))return [];
  const s=fs.readFileSync(p,'utf8'),a=s.indexOf('['),b=s.lastIndexOf(']');
  return a>=0&&b>a?JSON.parse(s.slice(a,b+1)):[];
}
function generate(ctx,opts={}){
  return core.generate(ctx,loadBundle(),loadDailyRows(),opts);
}

if(require.main===module){
  const input=process.argv[2]||path.join(REPO,'data/lesson-context.json');
  const variant=Number(process.argv[3]||0);
  const ctx=readJson(path.resolve(process.cwd(),input));
  process.stdout.write(JSON.stringify(generate(ctx,{variant}),null,2)+'\n');
}

module.exports={generate,loadBundle,loadDailyRows};
