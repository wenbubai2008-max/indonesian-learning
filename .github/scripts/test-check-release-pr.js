#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {checkPaths,equalIndex,verify}=require('./check-release-pr');
const {plan}=require('./plan-lesson-publication');
const {makeAm,makePm}=require('./test-lesson-candidate');
const clone=x=>JSON.parse(JSON.stringify(x)),sha='a'.repeat(40);
let passed=0;
const ok=(name,fn)=>{fn();passed++;console.log('PASS release PR: '+name)};
const changes=s=>['A\tdata/daily/2026-09-28-'+s+'.json','M\tdata/daily/index.json'];
function fixture(make,session){
 const x=make(),date=x.expectedDate,prior='2026-09-27';
 const history={
  ['data/daily/'+prior+'-am.json']:{date:prior,session:'am',review_vocab:[],vocab:[]},
  ['data/daily/'+prior+'-pm.json']:x.previousPm||{date:prior,session:'pm',new_words:[],vocab:[]}
 };
 const main={
  'data/daily/index.json':clone(x.index),'data/learning-runtime.json':clone(x.runtime),
  'data/learning-pool-rules.json':clone(x.rules),
  'data/daily/'+date+'-am.json':x.sameDayAm||undefined,...history
 };
 if(session==='am')main['data/daily/'+date+'-am.json']=undefined;
 const result=plan({...x,mainHead:sha,reviewHistory:[]});
 assert.equal(result.ok,true,JSON.stringify(result.errors));
 const head={'data/daily/'+date+'-'+session+'.json':clone(x.lesson),
   'data/daily/index.json':JSON.parse(result.files[1].content)};
 const args={headSha:sha,headRef:'lesson-release-'+date+'-'+session,baseRef:'main',mainSha:sha,
  changed:changes(session),loadHead:p=>clone(head[p]),loadMain:(p,required=true)=>{
   if(main[p]===undefined){if(required)throw Error('missing '+p);return undefined}
   return clone(main[p]);
  }};
 return {args,main,head};
}
ok('only exact two paths allowed',()=>{
 assert.equal(checkPaths(changes('am'),'2026-09-28-am').ok,true);
 assert.equal(checkPaths(changes('am').slice(0,1),'2026-09-28-am').ok,false);
 assert.equal(checkPaths([...changes('am'),'M\tREADME.md'],'2026-09-28-am').ok,false);
 assert.equal(checkPaths(['D\tdata/daily/2026-09-28-am.json','M\tdata/daily/index.json'],'2026-09-28-am').ok,false);
});
ok('index compared by complete JSON rather than stale patch',()=>{assert(equalIndex({a:1},'{"a":1}'));assert(!equalIndex({a:2},'{"a":1}'))});
ok('valid AM, exact index, source and SHA pass',()=>{
 const {args}=fixture(makeAm,'am');const r=verify(args);
 assert.equal(r.ok,true);assert.equal(r.headSha,sha);assert.equal(r.paths.length,2);
 assert.match(r.baselineFingerprint,/^[0-9a-f]{64}$/);
});
ok('valid PM maintains morning row and exact index',()=>{
 const {args}=fixture(makePm,'pm');const r=verify(args);
 assert.equal(r.ok,true);assert.equal(r.session,'pm');assert.deepEqual(r.paths,changes('pm').map(x=>x.split('\t')[1]));
});
ok('missing index, wrong release branch, or unintended file blocks',()=>{
 const {args}=fixture(makeAm,'am');
 for(const value of [[changes('am').slice(0,1),'RELEASE_DIFF_INVALID'],
   [[...changes('am'),'M\tsecret'], 'RELEASE_DIFF_INVALID']]){
   assert.throws(()=>verify({...args,changed:value[0]}),new RegExp(value[1]));
 }
 assert.throws(()=>verify({...args,headRef:'lesson-staging-v1'}),/NOT_A_RELEASE_BRANCH/);
});
ok('different index content cannot be promoted',()=>{
 const {args,head}=fixture(makeAm,'am');
 head['data/daily/index.json'].dates.at(-1).am=false;
 assert.throws(()=>verify(args),/INDEX_MISMATCH/);
});
ok('main index changed since branch creation forces revalidation',()=>{
 const {args,main}=fixture(makeAm,'am');
 main['data/daily/index.json'].dates.at(-1).am=true;
 assert.throws(()=>verify(args),/CANDIDATE_REJECTED/);
});
ok('main runtime eligibility drift blocks old candidate',()=>{
 const {args,main}=fixture(makeAm,'am');
 main['data/learning-runtime.json'].new_pool=[];
 assert.throws(()=>verify(args),/CANDIDATE_REJECTED/);
});
ok('main unrelated change permits matching relevant source',()=>{
 const {args}=fixture(makeAm,'am');
 const r=verify({...args,mainSha:'b'.repeat(40)});
 assert.equal(r.ok,true);
});
console.log('Release PR preflight:',JSON.stringify({passed,failed:0}));
