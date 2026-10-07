#!/usr/bin/env node
'use strict';
/** Read-only: deterministic review/application candidate ranking for the AM (--session am) and PM generators. Writes nothing. */
const fs=require('fs'),path=require('path');
const {collectReviewHistory}=require('./validate-lesson-candidate');
const {rank,naturalRecurrence}=require('./review-rotation');
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
 const base={date:a.date,session,runtime,rotation:rules.review_rotation,reviewHistory:history,reviewCount:Number(a.count)||5,amVocab:names(am.vocab),amReview:names(am.review_vocab)};
 const longHistory=readLongHistory(index,a.date,read);
 // 12:00 extensive readings of the last 7 days count as passive appearances for the 3-day streak (ranking only).
 let passiveTexts=[];
 try{const {loadReadings,readingText}=require('./reading-review');
  passiveTexts=loadReadings(root).filter(r=>r&&r.date&&r.date<=a.date).map(r=>({date:r.date,text:readingText(r)}));}catch(e){passiveTexts=[]}
 const out=rank({...base,longHistory,passiveTexts});
 // Pending-review words to weave into reading / dialogue / examples (not core review, not application).
 // Excludes today's core picks and words still cooling down under the exposure ledger (avoid_in_text).
 out.natural_recurrence=naturalRecurrence({date:a.date,runtime,longHistory,count:12,
  exclude:[...out.recommended_review,...out.application_candidates.slice(0,3).map(x=>x.word),...base.amVocab,...base.amReview,...(out.avoid_in_text||[])]});
 if(a.compare==='1'){const old=rank(base);out.compare_without_stale_bonus={recommended_review:old.recommended_review,only_new:out.recommended_review.filter(w=>!old.recommended_review.includes(w)),only_old:old.recommended_review.filter(w=>!out.recommended_review.includes(w))}}
 return out;
}
if(require.main===module){try{console.log(JSON.stringify(main(process.argv.slice(2)),null,2))}catch(e){console.error(JSON.stringify({ok:false,error:e.message}));process.exitCode=2}}
module.exports={main,readLongHistory};
