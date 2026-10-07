#!/usr/bin/env node
'use strict';
/**
 * Read-only: pending-review words (A ∩ D) ranked by how long ago they last appeared anywhere in a lesson, to be woven
 * into reading / dialogue / example sentences. Works for AM and PM. Writes nothing.
 * Usage: node .github/scripts/rank-natural-recurrence.js --date YYYY-MM-DD [--session am|pm] [--count 12] [--exclude a,b] [--root dir]
 */
const fs=require('fs'),path=require('path');
const {naturalRecurrence}=require('./review-rotation');
const {readLongHistory}=require('./rank-review-candidates');
function cli(argv){const a={};for(let i=0;i<argv.length;i++){if(!argv[i].startsWith('--')||!argv[i+1]||argv[i+1].startsWith('--'))throw Error('Expected --key value');a[argv[i++].slice(2)]=argv[i]}return a}
function main(argv){
 const a=cli(argv);if(!a.date)throw Error('--date required');
 const root=path.resolve(a.root||'.'),read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
 const runtime=read('data/learning-runtime.json'),index=read('data/daily/index.json');
 const names=x=>(Array.isArray(x)?x:[]).map(v=>Array.isArray(v)?v[0]:typeof v==='string'?v:v&&v.word);
 const exclude=(a.exclude||'').split(',').map(x=>x.trim()).filter(Boolean);
 if((a.session||'pm')==='pm'){ // today's 08:00 words are already in play
  const amFile=path.join(root,'data/daily/'+a.date+'-am.json');
  if(fs.existsSync(amFile)){const am=read('data/daily/'+a.date+'-am.json');exclude.push(...names(am.vocab),...names(am.review_vocab))}
 }
 return naturalRecurrence({date:a.date,runtime,longHistory:readLongHistory(index,a.date,read),exclude,count:Number(a.count)||12});
}
if(require.main===module){try{console.log(JSON.stringify(main(process.argv.slice(2)),null,2))}catch(e){console.error(JSON.stringify({ok:false,error:e.message}));process.exitCode=2}}
module.exports={main};
