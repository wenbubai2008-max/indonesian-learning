#!/usr/bin/env node
'use strict';
/**
 * Soft check (2026-10-14): warn when a lesson / reading candidate contains a collocation the user already
 * flagged as unnatural (data/lesson-collocation-watchlist.json). It never blocks publishing: exit code is 0
 * unless --strict is given. Usage:
 *   node .github/scripts/check-collocations.js --candidate data/daily/YYYY-MM-DD-am.json [--strict]
 *   node .github/scripts/check-collocations.js --all            # scan every published lesson (audit)
 */
const fs=require('fs'),path=require('path');
const repo=path.resolve(__dirname,'..','..');
const args=process.argv.slice(2),arg=n=>{const i=args.indexOf(n);return i>=0?args[i+1]:''};
const list=JSON.parse(fs.readFileSync(path.join(repo,'data','lesson-collocation-watchlist.json'),'utf8')).entries
  .map(e=>Object.assign({re:new RegExp(e.pattern,'i')},e));
// A flagged phrase quoted as a counter-example in a note ("不说 khas batik") is not a hit.
const NEGATED=/不说|不要|别说|不能说|不用|而不是|不是|避免|✗|×/;
function strings(x,at,out){
  if(typeof x==='string')out.push([at,x]);
  else if(Array.isArray(x))x.forEach((v,i)=>strings(v,at+'['+i+']',out));
  else if(x&&typeof x==='object')Object.keys(x).forEach(k=>strings(x[k],at?at+'.'+k:k,out));
  return out;
}
function check(file){
  let doc;try{doc=JSON.parse(fs.readFileSync(file,'utf8'))}catch(e){return [{file,at:'',error:'cannot parse: '+e.message}]}
  const hits=[];
  for(const [at,text] of strings(doc,'',[]))for(const e of list){const m=text.match(e.re);if(m&&!NEGATED.test(text.slice(Math.max(0,m.index-8),m.index)))hits.push({file:path.relative(repo,path.resolve(file)),at,found:m[0],better:e.better,why:e.why})}
  return hits;
}
const files=args.includes('--all')?fs.readdirSync(path.join(repo,'data','daily')).filter(f=>/^\d{4}-\d{2}-\d{2}-(am|pm)\.json$/.test(f)).sort().map(f=>path.join(repo,'data','daily',f)):[arg('--candidate')].filter(Boolean);
if(!files.length){console.error('usage: check-collocations.js --candidate <file> [--strict] | --all');process.exit(2)}
const hits=files.flatMap(check);
console.log(JSON.stringify({ok:!hits.length,checked:files.length,watchlist:list.length,warnings:hits},null,1));
process.exit(hits.length&&args.includes('--strict')?1:0);
