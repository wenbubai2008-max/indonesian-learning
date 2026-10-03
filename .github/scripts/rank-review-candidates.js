#!/usr/bin/env node
'use strict';
/** Read-only: deterministic review/application candidate ranking for the PM generator. Writes nothing. */
const fs=require('fs'),path=require('path');
const {collectReviewHistory}=require('./validate-lesson-candidate');
const {rank}=require('./review-rotation');
function cli(argv){const a={};for(let i=0;i<argv.length;i++){if(!argv[i].startsWith('--')||!argv[i+1]||argv[i+1].startsWith('--'))throw Error('Expected --key value');a[argv[i++].slice(2)]=argv[i]}return a}
function main(argv){
 const a=cli(argv);if(!a.date)throw Error('--date required');
 const root=path.resolve(a.root||'.'),read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
 const index=read('data/daily/index.json'),runtime=read('data/learning-runtime.json'),rules=read('data/learning-pool-rules.json');
 const session=a.session||'pm';if(session!=='pm')throw Error('Only the PM ranking is defined');
 const history=collectReviewHistory(index,a.date,'pm',read);
 const amFile=path.join(root,'data/daily/'+a.date+'-am.json');
 const am=fs.existsSync(amFile)?read('data/daily/'+a.date+'-am.json'):{};
 const names=x=>(Array.isArray(x)?x:[]).map(v=>Array.isArray(v)?v[0]:typeof v==='string'?v:v&&v.word);
 return rank({date:a.date,runtime,rotation:rules.review_rotation,reviewHistory:history,reviewCount:Number(a.count)||5,amVocab:names(am.vocab),amReview:names(am.review_vocab)});
}
if(require.main===module){try{console.log(JSON.stringify(main(process.argv.slice(2)),null,2))}catch(e){console.error(JSON.stringify({ok:false,error:e.message}));process.exitCode=2}}
module.exports={main};
