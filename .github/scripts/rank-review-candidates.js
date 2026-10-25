#!/usr/bin/env node
'use strict';
/** Read-only: deterministic review/application candidate ranking for the AM (--session am) and PM generators. Writes nothing. */
const fs=require('fs'),path=require('path');
const {collectReviewHistory}=require('./validate-lesson-candidate');
const {rank,naturalRecurrence,overusedInText}=require('./review-rotation');
const RP=require('./review-phase');
/** All completed lessons before `date`, used only for the stale-word bonus (never for eligibility). */
function readLongHistory(index,date,read){
 const out=[];
 for(const d of (index.dates||[])){if(!(d.date<date))continue;
  for(const s of ['am','pm'])if(d[s]){try{out.push(read('data/daily/'+d.date+'-'+s+'.json'))}catch(e){}}}
 return out;
}
function cli(argv){const a={};for(let i=0;i<argv.length;i++){if(!argv[i].startsWith('--')||!argv[i+1]||argv[i+1].startsWith('--'))throw Error('Expected --key value');a[argv[i++].slice(2)]=argv[i]}return a}
function main(argv){
 const a=cli(argv);if(!a.date)throw Error('--date required');
 const root=path.resolve(a.root||'.'),read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
 const index=read('data/daily/index.json'),runtime=read('data/learning-runtime.json'),rules=read('data/learning-pool-rules.json');
 const session=a.session||'pm';if(!['am','pm'].includes(session))throw Error('--session must be am or pm');
 const history=collectReviewHistory(index,a.date,session,read);
 const names=x=>(Array.isArray(x)?x:[]).map(v=>Array.isArray(v)?v[0]:typeof v==='string'?v:v&&v.word);
 const amFile=path.join(root,'data/daily/'+a.date+'-am.json');
 const am=session==='pm'&&fs.existsSync(amFile)?read('data/daily/'+a.date+'-am.json'):{};
 // Review cycle (2026-10-14): legal new words still available for this lesson (same definition as the validator).
 const key=w=>String(w||'').trim().toLowerCase();
 const pool=new Set(names(runtime.new_pool).map(key)),dont=new Set(names(runtime.new_pool_dont).map(key)),fuzzy=new Set(names(runtime.new_pool_fuzzy).map(key)),uncl=new Set(names(runtime.new_pool_unclassified).map(key));
 let blockedNew=new Set();
 if(session==='am'){const prev=new Date(Date.parse(a.date+'T00:00:00Z')-86400000).toISOString().slice(0,10),pf='data/daily/'+prev+'-pm.json';
  if(fs.existsSync(path.join(root,pf))){const pm=read(pf);if(pm.write_status==='lesson_complete')blockedNew=new Set(names(pm.new_words).map(key))}}
 else blockedNew=new Set([...names(am.vocab),...names(am.review_vocab)].map(key));
 const availNew=[...pool].filter(w=>!blockedNew.has(w)&&!uncl.has(w)&&(dont.has(w)||fuzzy.has(w))).length;
 // Review phase (2026-10-25, dormant until data/review-phase.json is switched on): shorter lessons and confirmed goals.
 const phase=RP.load(root),P=RP.on(phase,a.date),C=RP.counts(phase,a.date),G=RP.goals(phase,a.date,root);
 const amCycleCount=session==='am'?(P?Math.max(0,C.am_target-availNew):availNew<10?10-availNew:0):0;
 const pmCycle=session==='pm'&&(P||availNew<3);
 const reviewCount=Number(a.count)||(P&&session==='pm'?Math.max(C.pm_review[0],Math.min(C.pm_review[1],C.pm_target-Math.min(availNew,C.pm_new[1])-2)):pmCycle?Math.max(4,Math.min(9,10-availNew-3)):5);
 const base={date:a.date,session,runtime,rotation:rules.review_rotation,reviewHistory:history,reviewCount,amVocab:names(am.vocab).filter(w=>!names(am.cycle_vocab).includes(w)),amReview:[...names(am.review_vocab),...names(am.cycle_vocab)]};
 const longHistory=readLongHistory(index,a.date,read);
 // 12:00 extensive readings of the last 7 days count as passive appearances for the 3-day streak (ranking only).
 let passiveTexts=[];
 try{const {loadReadings,readingText}=require('./reading-review');
  passiveTexts=loadReadings(root).filter(r=>r&&r.date&&r.date<=a.date).map(r=>({date:r.date,text:readingText(r)}));}catch(e){passiveTexts=[]}
 const out=rank({...base,longHistory,passiveTexts,cycleCount:amCycleCount,goalSkip:G.skip,goalFast:G.fast,goalBonus:G.bonus});
 if(P)out.review_phase={active:true,counts:C,plan:RP.dayPlan(phase,a.date,RP.loadThemes(root)),goal_skipped:G.skip.size,goal_fast:G.fast.size};
 if(session==='am')out.review_cycle=out.review_cycle||{active:false,new_words_available:availNew};
 else out.review_cycle={active:pmCycle,new_words_available:availNew,review_target:pmCycle?reviewCount:null};
 if(out.review_cycle.active)out.review_cycle.new_words_available=availNew;
 // Pending-review words to weave into reading / dialogue / examples (not core review, not application).
 // Excludes today's core picks and words still cooling down under the exposure ledger (avoid_in_text).
 const nrCfg=(rules.review_rotation&&rules.review_rotation.natural_recurrence)||{};
 const textHistory=session==='pm'&&am&&am.date===a.date?[...longHistory,am]:longHistory;
 out.natural_recurrence=naturalRecurrence({date:a.date,session,runtime,longHistory:textHistory,count:Number(nrCfg.list_size)||12,
  exclude:[...out.recommended_review,...((out.review_cycle&&out.review_cycle.cycle_words)||[]),...out.application_candidates.slice(0,3).map(x=>x.word),...base.amVocab,...base.amReview,...(out.avoid_in_text||[])]});
 // 2026-10-15: minimum woven per lesson (checked by check-recurrence.js before push) and words already overused in text.
 out.natural_recurrence.min_required=Number((nrCfg.min_per_lesson||{})[session])||0;
 {const pm=RP.recurrenceMin(phase,a.date,session);if(pm!=null)out.natural_recurrence.min_required=pm;}
 const ov=nrCfg.overuse||{};
 out.overused_in_text=overusedInText({date:a.date,session,runtime,longHistory:textHistory,window:Number(ov.window_lessons)||6,max:Number(ov.max_lessons)||3});
 if(a.compare==='1'){const old=rank(base);out.compare_without_stale_bonus={recommended_review:old.recommended_review,only_new:out.recommended_review.filter(w=>!old.recommended_review.includes(w)),only_old:old.recommended_review.filter(w=>!out.recommended_review.includes(w))}}
 return out;
}
if(require.main===module){try{console.log(JSON.stringify(main(process.argv.slice(2)),null,2))}catch(e){console.error(JSON.stringify({ok:false,error:e.message}));process.exitCode=2}}
module.exports={main,readLongHistory};
