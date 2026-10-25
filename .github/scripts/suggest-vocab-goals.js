#!/usr/bin/env node
'use strict';
/**
 * 2026-10-25 (phase 1 of the review-phase plan, observation only): suggest a learning goal for every taught word.
 *   use       — should be producible on demand (daily life / work value)
 *   recognize — understanding it when reading or hearing is enough (low frequency, narrow domain)
 *   unsure    — the rules and the review could not decide; listed for the learner
 *   fast      — extra flag on `use` words: everyday expressions worth answering within ~3 seconds
 * Order: rules from the word lists (977 frequency order, topic/stage/register, BIPA level/importance, oral candidates)
 * → one manual review (data/vocab-goals-review.json, written once by Claude and edited by the learner) → history
 * correction (a word answered wrong 3+ times or wrong in lessons/automatic training is never only `recognize`).
 * OBSERVATION ONLY: nothing that selects words, schedules reviews, judges mastery or generates lessons may read the
 * output (data/vocab-goals-suggested.json); regression-guard.js enforces this.
 *   node .github/scripts/suggest-vocab-goals.js [--check]   (--check: verify the committed file is up to date)
 */
const fs=require('fs'),path=require('path'),vm=require('vm');
const repo=path.resolve(__dirname,'..','..'),rel=p=>path.join(repo,p);
const OUT='data/vocab-goals-suggested.json',REVIEW='data/vocab-goals-review.json';
const n=s=>String(s||'').trim().toLowerCase();
const FAST_TOPICS=new Set(['连接词','口语','疑问词','时间']);
function load(){
  const ctx={window:{}};
  for(const f of ['data/vocab-data.js','data/daily-vocab-data.js','data/master-vocab-secondary.js','data/oral-vocab-candidates.js','data/master-vocab-data.js','data/master-vocab-data-2.js','data/master-vocab-data-3.js'])
    vm.runInNewContext(fs.readFileSync(rel(f),'utf8'),ctx,{filename:f});
  const w=ctx.window;
  const weak=JSON.parse(fs.readFileSync(rel('data/weakness-sync.json'),'utf8')).words||{};
  const review=fs.existsSync(rel(REVIEW))?JSON.parse(fs.readFileSync(rel(REVIEW),'utf8')):{words:{}};
  return {
    taught:w.DAILY_VOCAB_DB||[],
    rank:new Map((w.MASTER_VOCAB_DB||[]).map((x,i)=>[n(x[0]),i+1])),
    primary:new Map((w.EMBEDDED_DB||[]).map(x=>[n(x.word),x])),
    secondary:new Map((w.SECONDARY_MASTER_VOCAB_DB||[]).map(x=>[n(x.word),x])),
    oral:new Map((w.ORAL_VOCAB_CANDIDATES||[]).map(x=>[n(x.word),x])),
    weak,review:review.words||{}
  };
}
function rule(k,src){
  const p=src.primary.get(k)||src.oral.get(k),s=src.secondary.get(k),r=src.rank.get(k);
  const why=[];let goal='use',fast=false;
  if(p&&(p.register==='口语'||FAST_TOPICS.has(p.topic))){fast=true;why.push('日常高频表达（'+(p.register==='口语'?'口语':p.topic)+'）')}
  if(p&&p.stage==='C 扩展'){goal='recognize';why.push('扩展词')}
  if(s&&s.sab==='B'){goal='recognize';why.push('第二词库低重要度（'+s.bipa_level+' / B）')}
  else if(s){why.push('第二词库 '+s.bipa_level+' / '+s.sab)}
  if(r)why.push('977 主库第 '+r+' 位');
  if(!p&&!s&&!r)why.push('课程里出现的派生词或常用表达');
  return {goal,fast,why};
}
function build(src){
  const words={},counts={all:{use:0,recognize:0,unsure:0,fast:0},active:{use:0,recognize:0,unsure:0,fast:0}};
  const seen=new Set();
  for(const d of src.taught){
    const k=n(d.word);if(!k||seen.has(k))continue;seen.add(k);
    let {goal,fast,why}=rule(k,src);let by='rule';
    const rv=src.review[k];
    if(rv&&['use','recognize','unsure'].includes(rv.goal)){goal=rv.goal;fast=goal==='use'&&!!rv.fast;by='review';if(rv.note)why=[rv.note].concat(why)}
    const wk=src.weak[k]||{},status=wk.status==='mastered'?'mastered':wk.status==='active'?'active':'other';
    const errs=Number(wk.wrong_count||0),hard=errs>=3||(wk.reasons||[]).some(x=>x==='lesson_wrong'||x==='automation_fail');
    if(goal==='recognize'&&hard){goal='unsure';by+='+history';why.unshift('答错较多，不建议只要求认识')}
    if(goal!=='use')fast=false;
    words[d.word]={goal,fast,by,status,why:why.slice(0,3)};
    counts.all[goal]++;if(fast)counts.all.fast++;
    if(status==='active'){counts.active[goal]++;if(fast)counts.active.fast++}
  }
  return {version:1,observation_only:true,note:'阶段一旁路观察：只做统计和建议，不被选词、复习排程、掌握判定或课程生成读取。',counts,words};
}
if(require.main===module){
  const out=build(load()),text=JSON.stringify(out,null,1)+'\n';
  if(process.argv.includes('--check')){
    const cur=fs.existsSync(rel(OUT))?fs.readFileSync(rel(OUT),'utf8'):'';
    if(cur!==text){console.error('vocab-goals-suggested.json is out of date; run node .github/scripts/suggest-vocab-goals.js');process.exit(1)}
    console.log('vocab goal suggestions up to date',JSON.stringify(out.counts));
  }else{fs.writeFileSync(rel(OUT),text);console.log(JSON.stringify(out.counts))}
}
module.exports={build,load,rule};
