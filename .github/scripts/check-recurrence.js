#!/usr/bin/env node
'use strict';
/**
 * Generator-side gate (2026-10-15): does a lesson candidate weave in enough stale pending-review words?
 * Read-only. Not part of the validator and never blocks a release; the AM/PM runbooks require it to pass before push.
 *
 * Counts words from the ranked natural_recurrence list (rank-review-candidates.js, longest-unseen first) that appear in
 * the candidate's reading / dialogue / sentences / word-card examples / AM output and PM rewrite reference answers (same
 * text recurrenceText() uses for the ranking, enclitics -nya/-lah/-kah/-pun/-ku/-mu allowed). The candidate's own core words never count.
 *
 * Also (2026-10-15): if the ranker lists an eligible same-root review group, the core review words must contain one.
 *
 * Usage: node .github/scripts/check-recurrence.js --candidate data/daily/D-am.json --date D --session am|pm [--root dir]
 * Exit 0 = enough (or the list is shorter than the minimum and every listed word is used); 1 = too few; 2 = usage error.
 */
const fs=require('fs'),path=require('path');
const {recurrenceText,wordRe,word}=require('./review-rotation');
const rankMain=require('./rank-review-candidates').main;

function cli(argv){const a={};for(let i=0;i<argv.length;i++){if(!argv[i].startsWith('--')||!argv[i+1]||argv[i+1].startsWith('--'))throw Error('Expected --key value');a[argv[i++].slice(2)]=argv[i]}return a}
const key=x=>String(x==null?'':x).trim().toLowerCase();

/** Core review words of a lesson: AM review_vocab, PM cards with source_group=review. */
function reviewWords(candidate){
  if(candidate.session==='pm')return (candidate.vocab||[]).filter(v=>v&&v.source_group==='review').map(v=>key(word(v)));
  return (candidate.review_vocab||[]).map(key);
}
/** Same-root group gate (2026-10-15): when the ranker could fit an eligible group into the recommendation
 * (review_group_applied set: fresh errors and the PM focus quota still kept), the lesson's core review must hold two or
 * more words sharing one root (roots from runtime.review_pool, column 7). When it could not, nothing is required and an
 * antonym / near-synonym pair is the writer's choice. */
function evaluateGroup({candidate,groups=[],rootOf,required=groups.length>0}){
  const rw=reviewWords(candidate),count=new Map();
  for(const w of rw){const r=rootOf.get(w);if(r)count.set(r,[...(count.get(r)||[]),w])}
  const used=[...count].filter(([,ws])=>ws.length>=2).map(([root,words])=>({root,words}));
  const available=!!required;
  return {ok:!available||used.length>0,required:available,available_groups:groups.map(g=>g.root+': '+g.words.join(' / ')),used_groups:used,
    note:available&&!used.length?'a same-root group was available but the core review words contain none: put 2-3 words of one listed group into the review words':undefined};
}

/** Pure part, unit-tested: which listed words does the candidate use, and does that reach the minimum? */
function evaluate({candidate,list,minRequired,overused=[]}){
  const core=new Set([...(candidate.vocab||[]).map(v=>key(word(v))),...(candidate.review_vocab||[]).map(key),...(candidate.cycle_vocab||[]).map(key)]);
  const text=recurrenceText({...candidate,review_vocab:[]}); // the core list itself is not text exposure
  const eligible=list.filter(c=>!core.has(key(c.word)));
  const used=eligible.filter(c=>wordRe(key(c.word)).test(text)).map(c=>c.word);
  const required=Math.min(minRequired,eligible.length);
  const overusedHit=overused.filter(o=>!core.has(key(o.word))&&wordRe(key(o.word)).test(text)).map(o=>o.word);
  return {ok:used.length>=required,used_count:used.length,required,used,
    suggestions:eligible.filter(c=>!used.includes(c.word)).slice(0,Math.max(0,required-used.length)+5).map(c=>c.word+(c.cn?'（'+c.cn+'）':'')),
    overused_in_text_used:overusedHit};
}

function main(argv){
  const a=cli(argv);
  for(const k of ['candidate','date','session'])if(!a[k])throw Error('--'+k+' required');
  if(!['am','pm'].includes(a.session))throw Error('--session must be am or pm');
  const root=path.resolve(a.root||'.');
  const candidate=JSON.parse(fs.readFileSync(path.resolve(a.candidate),'utf8'));
  const rankArgs=['--date',a.date,'--session',a.session];if(a.root)rankArgs.push('--root',a.root);
  const ranked=rankMain(rankArgs);
  const nr=ranked.natural_recurrence||{candidates:[]};
  const res=evaluate({candidate,list:nr.candidates||[],minRequired:Number(nr.min_required)||0,overused:ranked.overused_in_text||[]});
  const runtime=JSON.parse(fs.readFileSync(path.join(root,'data/learning-runtime.json'),'utf8'));
  const rootOf=new Map();for(const v of runtime.review_pool||[])if(Array.isArray(v)&&v[6])rootOf.set(key(word(v)),key(v[6]));
  const group=evaluateGroup({candidate,groups:ranked.review_groups||[],rootOf,required:ranked.review_group_applied!=null});
  res.ok=res.ok&&group.ok;res.review_group=group;
  return {...res,date:a.date,session:a.session,list_size:(nr.candidates||[]).length,
    note:res.used_count>=res.required?'enough stale pending-review words woven into the text':'too few: weave more of the suggestions into example sentences, sentences / rewrite or output reference answers first (natural sentences only), then re-run',
    overused_note:res.overused_in_text_used.length?'these were already in the text of 3+ of the last 6 lessons; keep them only if the sentence needs them':undefined};
}

if(require.main===module){
  try{const out=main(process.argv.slice(2));console.log('RECURRENCE_CHECK '+JSON.stringify(out));process.exitCode=out.ok?0:1}
  catch(e){console.error(JSON.stringify({ok:false,error:e.message}));process.exitCode=2}
}
module.exports={main,evaluate,evaluateGroup,reviewWords};
