#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const generator=path.join(root,'.github/scripts/generate-extensive-reading.js');
const date='2026-10-02';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'reading-free-tier-'));
try{
 fs.mkdirSync(path.join(temp,'data'));
 fs.writeFileSync(path.join(temp,'data/extensive-reading-data.js'),'window.EXTENSIVE_READING_DB='+JSON.stringify([{date:'2026-10-01',title:'Older article'}])+';\n');
 fs.writeFileSync(path.join(temp,'data/learning-runtime.json'),JSON.stringify({focus_pool:[['menegaskan',120]]}));
 const words=('Warga Jakarta menggunakan layanan transportasi umum dengan lebih mudah setiap hari. ').repeat(19).trim();
 assert(words.split(/\s+/).length>=160&&words.split(/\s+/).length<=220);
 const article={id:'er-20261002-layanan-warga',date,title:'Layanan untuk Warga',title_cn:'为居民提供的服务',category:'生活',level:'A2+ → B1',minutes:4,source_name:'ANTARA News',source_date:date,source_url:'https://www.antaranews.com/berita/123/layanan-warga',text:words,cn:'居民每天使用公共交通更加方便。',hints:Array.from({length:8},(_,i)=>({term:'kata'+i,cn:'词语'+i}))};
 const mock=path.join(temp,'mock.cjs');
 fs.writeFileSync(mock,`
const assert=require('node:assert/strict');
globalThis.fetch=async (url,opts={})=>{
 if(url.includes('antaranews.com/rss/')){
  return {ok:true,text:async()=>'<rss><item><title>Warga mendapat layanan transportasi baru</title><description>Warga dan layanan transportasi umum di Jakarta</description><link>https://www.antaranews.com/berita/123/layanan-warga</link><pubDate>'+new Date().toUTCString()+'</pubDate></item></rss>'};
 }
 if(url.includes('antaranews.com/berita/123/')){
  return {ok:true,text:async()=>'<html><script type="application/ld+json">'+JSON.stringify({articleBody:'Warga Jakarta menggunakan layanan transportasi umum setiap hari. '.repeat(25)})+'</script></html>'};
 }
 if(url.includes('generativelanguage.googleapis.com/')){
  assert(url.includes('gemini-2.5-flash-lite:generateContent'));
  assert(opts.headers['x-goog-api-key']==='test-free-key');
  const body=JSON.parse(opts.body);
  assert(body.generationConfig.responseMimeType==='application/json');
  assert(body.generationConfig.responseSchema.type==='OBJECT');
  if(process.env.TEST_QUOTA==='1')return {ok:false,status:429,json:async()=>({error:{status:'RESOURCE_EXHAUSTED'}})};
  return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(${JSON.stringify(article)})}]}}]})};
 }
 throw Error('Unexpected outbound request '+url);
};
`);
 const env={...process.env,READING_DATE:date,GEMINI_API_KEY:'test-free-key',GEMINI_READING_MODEL:'gemini-2.5-flash-lite',OPENAI_API_KEY:'',NODE_OPTIONS:'--require '+mock};
 const run=(extra={})=>cp.spawnSync(process.execPath,[generator],{cwd:temp,env:{...env,...extra},encoding:'utf8',timeout:12000});
 const success=run();
 assert.equal(success.status,0,success.stderr);
 const out=JSON.parse(fs.readFileSync(path.join(temp,'data/extensive-reading-candidate.json'),'utf8'));
 assert.equal(out.id,article.id);assert.equal(out.date,date);assert.equal(out.source_name,'ANTARA News');assert.equal(out.hints.length,8);
 console.log('PASS Gemini Free Tier mock: source grounding, JSON generation, candidate written');
 fs.rmSync(path.join(temp,'data/extensive-reading-candidate.json'));
 const quota=run({TEST_QUOTA:'1'});
 assert.notEqual(quota.status,0);assert.match(quota.stderr,/HTTP 429/);
 assert.equal(fs.existsSync(path.join(temp,'data/extensive-reading-candidate.json')),false);
 console.log('PASS free quota exceeded: stop without candidate or paid fallback');
 const bad=run({GEMINI_READING_MODEL:'paid-model'});
 assert.notEqual(bad.status,0);assert.match(bad.stderr,/unsupported free-tier model/);
 assert.equal(fs.existsSync(path.join(temp,'data/extensive-reading-candidate.json')),false);
 console.log('PASS model allow-list: reject unsupported model');
}finally{fs.rmSync(temp,{recursive:true,force:true})}
