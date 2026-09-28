#!/usr/bin/env node
'use strict';

/**
 * Phase 1 / experimental: deterministic, lightweight generation INPUT only.
 * The v4 runtime and actual completed lessons remain the source of truth.
 * This is NOT a new selector, validator, writer of daily-vocab, or publisher.
 * No file is written unless the caller explicitly supplies --output.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const {collectReviewHistory}=require('./validate-lesson-candidate');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const word=x=>String(Array.isArray(x)?x[0]:x||'').trim().toLowerCase();
const words=x=>Array.isArray(x)?x.map(word).filter(Boolean):[];
const dateOK=x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x||''))&&
  Number.isFinite(Date.parse(x+'T00:00:00Z'))&&
  new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const datePlus=(x,n)=>new Date(Date.parse(x+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const err=(code,detail)=>{const e=Error(detail);e.code=code;throw e};
const requireIt=(test,code,detail)=>{if(!test)err(code,detail)};
const set=x=>new Set(words(x));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const stamp=(row,session)=>row.date+' '+(session==='am'?'08:00':row.date<'2026-09-16'?'19:00':'18:00');

function buildLessonContext({index,runtime,rules,load,sourceSha=''}) {
 requireIt(index&&Array.isArray(index.dates)&&runtime&&rules&&typeof load==='function','INPUT_INVALID','Requires index, runtime, rules and an actual lesson loader');
 requireIt(runtime.version===4&&runtime.rules_version===4&&rules.version===4&&runtime.stats?.master_unique===977,
   'RULE_RUNTIME_MISMATCH','Require version 4 and 977 primary master words');
 requireIt(Number.isFinite(Date.parse(runtime.generated_at||'')),'RUNTIME_INVALID','Runtime generated_at invalid');
 const rows=[...index.dates].sort((a,b)=>String(a?.date).localeCompare(String(b?.date))),dates=new Set(),stamps=[];
 for(const row of rows){
   requireIt(row&&dateOK(row.date)&&!dates.has(row.date),'INDEX_INVALID','Duplicate/invalid index date');
   dates.add(row.date);
   for(const slot of ['am','pm'])if(row[slot]===true)stamps.push(stamp(row,slot));
 }
 requireIt(rows.length>0&&index.updated===rows.at(-1).date,'INDEX_INVALID','index.updated does not identify newest date');
 const watermark=stamps.sort().at(-1);
 requireIt(watermark&&runtime.lesson_watermark===watermark,'BASELINE_SYNC_STALE','Runtime watermark does not match completed index');
 const m=/^(\d{4}-\d{2}-\d{2}) (08:00|18:00|19:00)$/.exec(watermark);
 requireIt(m&&dateOK(m[1]),'WATERMARK_INVALID','Unexpected lesson watermark');
 const targetSession=m[2]==='08:00'?'pm':'am';
 const targetDate=targetSession==='am'?datePlus(m[1],1):m[1];
 requireIt(targetDate>='2026-09-16','TARGET_INVALID','Only current 08:00/18:00 contracts are supported');
 const targetRow=rows.find(x=>x.date===targetDate);
 requireIt(!targetRow||targetRow[targetSession]!==true,'ALREADY_PUBLISHED','Target session already complete');
 if(targetSession==='pm')
   requireIt(targetRow?.am===true,'AM_PREREQUISITE_MISSING','PM needs completed same-day AM');
 const yesterday=datePlus(targetDate,-1);
 if(targetSession==='am')requireIt(rows.find(x=>x.date===yesterday)?.pm===true&&
     watermark===yesterday+' 18:00','PREVIOUS_PM_INCOMPLETE','Next AM requires previous PM and synchronized runtime');
 if(targetSession==='pm')requireIt(watermark===targetDate+' 08:00','AM_SYNC_STALE','PM runtime must include today AM');

 const newAll=set(runtime.new_pool),dont=set(runtime.new_pool_dont),fuzzy=set(runtime.new_pool_fuzzy),
       unclassified=set(runtime.new_pool_unclassified),review=set(runtime.review_pool);
 for(const w of dont)requireIt(newAll.has(w)&&!fuzzy.has(w)&&!unclassified.has(w),'POOL_PARTITION_INVALID','Bad dont: '+w);
 for(const w of fuzzy)requireIt(newAll.has(w)&&!unclassified.has(w),'POOL_PARTITION_INVALID','Bad fuzzy: '+w);
 requireIt(newAll.size===dont.size+fuzzy.size+unclassified.size,'POOL_PARTITION_INVALID','Incomplete/overlapping new-word pool');
 const meta=new Map((runtime.new_meta||[]).map(x=>[word(x),x[1]]));
 const poolEntries=xs=>xs.map(w=>{
   const k=word(w);
   requireIt(newAll.has(k)&&typeof meta.get(k)==='string'&&meta.get(k).trim(),'NEW_META_MISSING','Missing new candidate meaning: '+k);
   return [k,meta.get(k)];
 });
 const newDont=poolEntries(runtime.new_pool_dont||[]),newFuzzy=poolEntries(runtime.new_pool_fuzzy||[]);
 const focus=set(runtime.focus_pool);
 for(const w of focus)requireIt(review.has(w),'FOCUS_NOT_REVIEW','Focus word is not in the review pool: '+w);
 const reviewEntries=(runtime.review_pool||[]).map(x=>{
   requireIt(Array.isArray(x)&&x.length>=8&&review.has(word(x)),'REVIEW_INPUT_INVALID','Malformed runtime review row');
   return [...x.slice(0,8)];
 });
 const focusEntries=(runtime.focus_pool||[]).map(x=>[x[0],x[1],x[2]]);
 const oralEntries=(runtime.oral_new_pool||[]).filter(x=>newAll.has(word(x))).map(x=>{
   const w=word(x),pool=dont.has(w)?'dont':fuzzy.has(w)?'fuzzy':'unclassified';
   return [...x.slice(0,5),pool];
 });
 const fullHistory=collectReviewHistory(index,targetDate,targetSession,p=>load(p));
 const history=fullHistory.map(h=>{
   requireIt(h&&dateOK(h.date)&&['am','pm'].includes(h.session),'HISTORY_INVALID','Completed history identity invalid');
   const core=h.session==='am'?words(h.review_vocab):words((h.vocab||[]).filter(v=>v?.source_group==='review'));
   const taught=h.session==='am'?words((h.vocab||[]).map(v=>v?.word)):words(h.new_words);
   requireIt(core.length>=0&&taught.length>0,'HISTORY_INVALID','Missing completed lesson vocabulary');
   return {date:h.date,session:h.session,review_core:core,new_words:taught};
 });
 const prior=history.find(x=>x.date===yesterday&&x.session==='pm')||null;
 const sameDayAm=targetSession==='pm'?load('data/daily/'+targetDate+'-am.json'):null;
 if(targetSession==='pm'){
   requireIt(sameDayAm&&sameDayAm.date===targetDate&&sameDayAm.session==='am'&&
      sameDayAm.time==='08:00'&&sameDayAm.vocab?.length===10,'AM_PREREQUISITE_MISSING','Actual completed same-day AM missing');
   for(const v of sameDayAm.vocab)
     requireIt(!newAll.has(word(v.word)),'AM_SYNC_STALE','Today AM taught new word remains in new_pool: '+v.word);
 }
 if(targetSession==='am'&&prior){
   for(const w of prior.new_words)requireIt(!newAll.has(w),'CROSS_DAY_SYNC_STALE','Previous PM taught new word remains in new_pool: '+w);
 }
 const targetDay=targetRow?.day??((rows.filter(x=>x.date<targetDate).at(-1)?.day||0)+1);
 requireIt(Number.isInteger(targetDay)&&targetDay>0,'DAY_INVALID','Target day invalid');
 const context={
   version:1,
   purpose:'read-only lesson-generation context; final candidate MUST pass existing validator',
   target:{date:targetDate,session:targetSession,time:targetSession==='am'?'08:00':'18:00',day:targetDay},
   source:{
     rules_version:rules.version,runtime_version:runtime.version,master_unique:runtime.stats.master_unique,
     runtime_generated_at:runtime.generated_at,lesson_watermark:watermark,index_updated:index.updated,
     runtime_hash:hash(runtime),index_hash:hash(index),rules_hash:hash(rules),
     ...(sourceSha?{main_sha:sourceSha}:{})
   },
   schema:{
     new:['word','cn'],
     review:runtime.schema?.review||['word','priority','wrong_count','last_wrong','last_review','cn','root','root_cn'],
     focus:['word','score','signals'],
     oral:['word','register','counterpart','root','rank','memory_band']
   },
   candidates:{
     new_dont:newDont,new_fuzzy:newFuzzy,review:reviewEntries,focus:focusEntries,oral:oralEntries
   },
   history_7d:history,
   previous_pm:prior?{date:prior.date,new_words:prior.new_words,review_core:prior.review_core}:null,
   same_day_am:sameDayAm?{
     date:sameDayAm.date,
     vocab:sameDayAm.vocab.map(v=>[v.word,v.cn,v.en,v.root,v.root_cn]),
     review_vocab:words(sameDayAm.review_vocab)
   }:null,
   contract:{rules:'data/learning-pool-rules.json',validator:'.github/scripts/validate-lesson-candidate.js'}
 };
 requireIt(context.candidates.new_dont.length===dont.size&&context.candidates.new_fuzzy.length===fuzzy.size&&
   context.candidates.review.length===review.size&&context.candidates.focus.length===focus.size,
   'SNAPSHOT_LOSS','Context silently dropped an eligible candidate');
 requireIt(!same(context.source.runtime_hash,'')&&!same(context.source.index_hash,''),'HASH_INVALID','Missing source hash');
 return context;
}
function parseArgs(args){const out={};for(let i=0;i<args.length;i+=2){
  requireIt(/^--(?:output|source-sha)$/.test(args[i])&&args[i+1]&&!args[i+1].startsWith('--'),
  'ARGUMENT_INVALID','Usage: [--output data/lesson-context.json] [--source-sha <pinned-main>]');out[args[i].slice(2)]=args[i+1]}
 return out}
if(require.main===module){
 try{
  const args=parseArgs(process.argv.slice(2)),read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
  if(args['source-sha'])requireIt(/^[a-f0-9]{40}$/.test(args['source-sha']),'SOURCE_SHA_INVALID','Expected a 40-character SHA');
  const snapshot=buildLessonContext({index:read('data/daily/index.json'),runtime:read('data/learning-runtime.json'),
   rules:read('data/learning-pool-rules.json'),load:read,sourceSha:args['source-sha']||''});
  const serialized=JSON.stringify(snapshot,null,2)+'\n';
  if(args.output){
   requireIt(args.output==='data/lesson-context.json','OUTPUT_PATH_INVALID','Only the future canonical derived-data path is supported');
   fs.mkdirSync(path.dirname(args.output),{recursive:true});
   fs.writeFileSync(args.output,serialized);
  }else process.stdout.write(serialized);
 }catch(e){console.error(JSON.stringify({ok:false,code:e.code||'CONTEXT_BUILD_ERROR',error:e.message}));process.exitCode=1}
}
module.exports={buildLessonContext};
