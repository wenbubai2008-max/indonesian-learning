#!/usr/bin/env node
'use strict';
/**
 * Generator-side gate (2026-10-15): does a lesson candidate weave in enough stale pending-review words?
 * Read-only. Not part of the validator and never blocks a release; the AM/PM runbooks require it to pass before push.
 *
 * Counts words from the ranked natural_recurrence list (rank-review-candidates.js, longest-unseen first) that appear in
 * the candidate's reading / dialogue / sentences / word-card examples (same text lessonText() uses for the ranking,
 * enclitics -nya/-lah/-kah/-pun/-ku/-mu allowed). The candidate's own core words never count.
 *
 * Usage: node .github/scripts/check-recurrence.js --candidate data/daily/D-am.json --date D --session am|pm [--root dir]
 * Exit 0 = enough (or the list is shorter than the minimum and every listed word is used); 1 = too few; 2 = usage error.
 */
const fs=require('fs'),path=require('path');
const {lessonText,wordRe,word}=require('./review-rotation');
const rankMain=require('./rank-review-candidates').main;

function cli(argv){const a={};for(let i=0;i<argv.length;i++){if(!argv[i].startsWith('--')||!argv[i+1]||argv[i+1].startsWith('--'))throw Error('Expected --key value');a[argv[i++].slice(2)]=argv[i]}return a}
const key=x=>String(x==null?'':x).trim().toLowerCase();

/** Pure part, unit-tested: which listed words does the candidate use, and does that reach the minimum? */
function evaluate({candidate,list,minRequired,overused=[]}){
  const core=new Set([...(candidate.vocab||[]).map(v=>key(word(v))),...(candidate.review_vocab||[]).map(key),...(candidate.cycle_vocab||[]).map(key)]);
  const text=lessonText({...candidate,review_vocab:[]}); // the core list itself is not text exposure
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
  return {...res,date:a.date,session:a.session,list_size:(nr.candidates||[]).length,
    note:res.ok?'enough stale pending-review words woven into the text':'too few: weave more of the suggestions into reading / dialogue / sentences / examples (natural sentences only), then re-run',
    overused_note:res.overused_in_text_used.length?'these were already in the text of 3+ of the last 6 lessons; keep them only if the sentence needs them':undefined};
}

if(require.main===module){
  try{const out=main(process.argv.slice(2));console.log('RECURRENCE_CHECK '+JSON.stringify(out));process.exitCode=out.ok?0:1}
  catch(e){console.error(JSON.stringify({ok:false,error:e.message}));process.exitCode=2}
}
module.exports={main,evaluate};
