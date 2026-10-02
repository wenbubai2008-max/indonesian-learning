#!/usr/bin/env node
'use strict';
/**
 * Side-by-side old/new V2 benchmark on IDENTICAL learning contexts, vocabulary
 * tables, material bundle and variant. PR baseline is origin/main by default.
 * No lesson, index or runtime writes.
 */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),vm=require('node:vm');
const repo=path.resolve(__dirname,'../../..');
const read=p=>JSON.parse(fs.readFileSync(path.join(repo,p),'utf8'));
const newCore=require('./core');
const {auditLesson,containsWord}=require('./quality');
const baselineRef=process.argv[2]||'origin/main';
const baselineSource=cp.execFileSync('git',['show',baselineRef+':prototype/lesson-engine/engine/core.js'],
  {cwd:repo,encoding:'utf8'});
const sandbox={module:{exports:{}},globalThis:{},console};
vm.runInNewContext(baselineSource,sandbox,{filename:'baseline-v2-core.js'});
const oldCore=sandbox.module.exports;
const bundle=read('prototype/lesson-engine/materials/materials-bundle.json');
const source=fs.readFileSync(path.join(repo,'data/daily-vocab-data.js'),'utf8');
const rows=JSON.parse(source.slice(source.indexOf('['),source.lastIndexOf(']')+1));
const wc=s=>String(s||'').trim().split(/\s+/).filter(Boolean).length;
function metric(x){
 const news=x.session==='am'?(x.vocab||[]).map(v=>v.word):
   (x.vocab||[]).filter(v=>v.source_group==='new').map(v=>v.word);
 const topicJump=(x.dialogue?.lines||[]).filter(v=>/ngomong-ngomong/i.test(v.id)).length;
 const questions=(x.dialogue?.lines||[]).filter(v=>v.speaker==='A').map(v=>v.id);
 return {
  title:x.title,source_mode:x._prototype?.reading_mode||'legacy-unlabeled',
  new_words:news,reading_words:wc(x.reading?.text),
  reading_new_coverage:news.filter(w=>containsWord(x.reading?.text,w)).length,
  legacy_glue:Number(/Hari ini saya mencatat beberapa kejadian berbeda dari orang-orang/.test(x.reading?.text||'')),
  answer_target_words:x.session==='am'?news.filter(w=>containsWord(x.output?.task,w)&&containsWord(x.output?.reference_answer,w)).length:null,
  dialogue_new_coverage:x.session==='pm'?news.filter(w=>containsWord((x.dialogue?.lines||[]).map(v=>v.id).join(' '),w)).length:null,
  dialogue_abrupt_topic_changes:x.session==='pm'?topicJump:null,
  dialogue_repeated_A_prompts:x.session==='pm'?questions.length-new Set(questions).size:null
 };
}
const cases=['am','pm'];
let worse=[],results=[];
for(const slot of cases){
 const ctx=read('prototype/lesson-engine/fixtures/context-2026-10-01-'+slot+'.json');
 for(let variant=0;variant<6;variant++){
  const oldLesson=oldCore.generate(ctx,bundle,rows,{variant});
  const newLesson=newCore.generate(ctx,bundle,rows,{variant});
  const before=metric(oldLesson),after=metric(newLesson),q=auditLesson(newLesson);
  if(!q.ok)worse.push(slot+'/'+variant+':quality='+JSON.stringify(q.errors));
  if(JSON.stringify(before.new_words)!==JSON.stringify(after.new_words))
    worse.push(slot+'/'+variant+': changed legal selected vocabulary');
  if(after.reading_new_coverage<before.reading_new_coverage)
    worse.push(slot+'/'+variant+': reading coverage fell');
  if(slot==='am'&&after.answer_target_words<2)
    worse.push(slot+'/'+variant+': answer still ignores target words');
  if(slot==='pm'&&after.dialogue_abrupt_topic_changes>before.dialogue_abrupt_topic_changes)
    worse.push(slot+'/'+variant+': more abrupt transitions');
  results.push({session:slot,variant,before,after});
  if(variant===0)console.log('V2_QUALITY_SAMPLE '+JSON.stringify({
    session:slot,
    old:{title:oldLesson.title,reading:oldLesson.reading.text,
      output:slot==='am'?oldLesson.output:null,dialogue:slot==='pm'?oldLesson.dialogue.lines:null},
    upgraded:{title:newLesson.title,reading:newLesson.reading.text,
      output:slot==='am'?newLesson.output:null,dialogue:slot==='pm'?newLesson.dialogue.lines:null}
  }));
 }
}
const avg=(slot,stage,k)=>{
 const xs=results.filter(r=>r.session===slot).map(r=>r[stage][k]).filter(Number.isFinite);
 return xs.length?Math.round(xs.reduce((a,b)=>a+b,0)*100/xs.length)/100:null;
};
console.log('V2_QUALITY_COMPARE '+JSON.stringify({
 baseline_ref:baselineRef,cases:results.length,failures:worse,
 summary:{
  am:{
   output_matched_target_words:{old:avg('am','before','answer_target_words'),upgraded:avg('am','after','answer_target_words')},
   reading_new_coverage:{old:avg('am','before','reading_new_coverage'),upgraded:avg('am','after','reading_new_coverage')},
   reading_words:{old:avg('am','before','reading_words'),upgraded:avg('am','after','reading_words')}
  },
  pm:{
   abrupt_topic_changes:{old:avg('pm','before','dialogue_abrupt_topic_changes'),upgraded:avg('pm','after','dialogue_abrupt_topic_changes')},
   repeated_questions:{old:avg('pm','before','dialogue_repeated_A_prompts'),upgraded:avg('pm','after','dialogue_repeated_A_prompts')},
   reading_new_coverage:{old:avg('pm','before','reading_new_coverage'),upgraded:avg('pm','after','reading_new_coverage')},
   reading_words:{old:avg('pm','before','reading_words'),upgraded:avg('pm','after','reading_words')}
  }
 }
}));
if(worse.length)process.exitCode=1;
