#!/usr/bin/env node
'use strict';
// Read-only phase-1 coverage against REAL latest origin/main and bounded synthetic faults.
// Does NOT write lesson-context.json or trigger any publication/sync.
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {buildLessonContext}=require('./build-lesson-context');
const {collectReviewHistory}=require('./validate-lesson-candidate');
const git=(...xs)=>cp.execFileSync('git',xs,{encoding:'utf8'}).trim();
git('fetch','origin','main');
// Immutable REAL 2026-09-28 post-PM main; tests must not change meaning when future lessons arrive.
const sha='fa2d2c7b35026140da912f94c2b287e845911ac5';
const raw=p=>git('show',sha+':'+p),read=p=>JSON.parse(raw(p)),clone=x=>JSON.parse(JSON.stringify(x));
const index=read('data/daily/index.json'),runtime=read('data/learning-runtime.json'),rules=read('data/learning-pool-rules.json');
const prepare=(changes={})=>({index,runtime,rules,load:read,sourceSha:sha,...changes});
const key=x=>String(Array.isArray(x)?x[0]:x||'').trim().toLowerCase();
let passed=0;
function ok(name,fn){fn();passed++;console.log('PASS context: '+name)}
function bad(name,args,code){ok(name,()=>assert.throws(()=>buildLessonContext(args),e=>e.code===code,'Expected '+code))}
const now=buildLessonContext(prepare()),target=now.target;
ok('immutable real 2026-09-28 post-PM main is the sole source',()=>{
 assert.equal(target.date,'2026-09-29');assert.equal(target.session,'am');
 assert.equal(now.source.main_sha,sha);assert.equal(now.source.master_unique,977);
 assert.equal(now.source.lesson_watermark,runtime.lesson_watermark);
 assert.equal(now.source.runtime_generated_at,runtime.generated_at);
 assert.equal(now.source.rules_version,4);
});
ok('entire authorized new candidate partition kept with real Chinese meanings',()=>{
 const all=new Set(runtime.new_pool.map(key));
 const candidate=[...now.candidates.new_dont,...now.candidates.new_fuzzy].map(x=>x[0]);
 assert.equal(candidate.length,all.size-runtime.new_pool_unclassified.length);
 assert.equal(new Set(candidate).size,candidate.length);
 for(const [w,cn] of [...now.candidates.new_dont,...now.candidates.new_fuzzy]){
  assert(all.has(w));assert.equal(typeof cn,'string');assert(cn.trim());
 }
 assert.deepEqual(now.candidates.new_dont.map(x=>x[0]),runtime.new_pool_dont);
 assert.deepEqual(now.candidates.new_fuzzy.map(x=>x[0]),runtime.new_pool_fuzzy);
});
ok('review/focus/oral are precisely the runtime candidate pools, not new eligibility rules',()=>{
 assert.deepEqual(now.candidates.review,runtime.review_pool);
 assert.deepEqual(now.candidates.focus,runtime.focus_pool.map(x=>x.slice(0,3)));
 assert.deepEqual(now.candidates.oral.map(x=>x[0]),runtime.oral_new_pool.filter(x=>runtime.new_pool.includes(x[0])).map(x=>x[0]));
 assert(now.candidates.oral.every(x=>['dont','fuzzy'].includes(x[5])));
});
ok('seven-day completed core-review history exactly equals existing validator history',()=>{
 const real=collectReviewHistory(index,target.date,target.session,read);
 assert.deepEqual(now.history_7d.map(x=>x.date+'-'+x.session),real.map(x=>x.date+'-'+x.session));
 for(let i=0;i<real.length;i++){
  const h=real[i],x=now.history_7d[i];
  assert.deepEqual(x.review_core,h.session==='am'?h.review_vocab:h.vocab.filter(v=>v.source_group==='review').map(v=>v.word));
  assert.deepEqual(x.new_words,h.session==='am'?h.vocab.map(v=>v.word):h.new_words);
 }
 assert.equal(now.history_7d.length,14);
});
ok('last PM new words exposed without misclassifying PM application as review',()=>{
 const prev=read('data/daily/2026-09-28-pm.json');
 assert.deepEqual(now.previous_pm.new_words,prev.new_words);
 assert.deepEqual(now.previous_pm.review_core,prev.vocab.filter(v=>v.source_group==='review').map(v=>v.word));
 for(const w of now.previous_pm.new_words)assert(!runtime.new_pool.includes(w));
});
ok('deterministic generated JSON for same authoritative inputs',()=>assert.deepEqual(buildLessonContext(prepare()),now));
ok('compact compared with runtime + seven days of real lesson payloads',()=>{
 const origins=Buffer.byteLength(raw('data/learning-runtime.json'))+Buffer.byteLength(raw('data/daily/index.json'))+
  collectReviewHistory(index,target.date,target.session,read).reduce((n,x)=>n+Buffer.byteLength(raw('data/daily/'+x.date+'-'+x.session+'.json')),0);
 const bytes=Buffer.byteLength(JSON.stringify(now));
 assert(bytes<origins*0.50,'compact context became too big relative to inputs');
 console.log('Context size:',JSON.stringify({bytes,sourceBytes:origins,ratio:Number((bytes/origins).toFixed(3)),new:now.candidates.new_dont.length+now.candidates.new_fuzzy.length,review:now.candidates.review.length,history:now.history_7d.length}));
});
{
 const i=clone(index),t=clone(runtime),row=i.dates.find(x=>x.date==='2026-09-28');
 row.pm=false;delete row.pm_day;delete row.pm_status;
 t.lesson_watermark='2026-09-28 08:00';
 const pm=buildLessonContext(prepare({index:i,runtime:t}));
 ok('18:00 context only exposes the real morning lesson as application source',()=>{
  assert.deepEqual(pm.target,{date:'2026-09-28',session:'pm',time:'18:00',day:38});
  assert.deepEqual(pm.same_day_am.vocab.map(x=>x[0]),read('data/daily/2026-09-28-am.json').vocab.map(v=>v.word));
  assert.deepEqual(pm.same_day_am.review_vocab,read('data/daily/2026-09-28-am.json').review_vocab);
  assert(!pm.history_7d.some(x=>x.date==='2026-09-28'&&x.session==='pm'));
  assert(pm.history_7d.some(x=>x.date==='2026-09-28'&&x.session==='am'));
 });
 bad('stale runtime/index combination stops instead of publishing',prepare({index:i}),'BASELINE_SYNC_STALE');
 const missing=clone(i);missing.dates.at(-1).am=false;
 const t2=clone(t);t2.lesson_watermark='2026-09-28 08:00';
 bad('missing completed lesson record conflicts with runtime watermark',prepare({index:missing,runtime:t2}),'BASELINE_SYNC_STALE');
}
{const t=clone(runtime);t.stats.master_unique=976;bad('977 invariant is mandatory',prepare({runtime:t}),'RULE_RUNTIME_MISMATCH')}
{const t=clone(runtime);t.lesson_watermark='2026-09-28 08:00';bad('baseline watermark mismatch stops context',prepare({runtime:t}),'BASELINE_SYNC_STALE')}
{const t=clone(runtime);t.new_pool_fuzzy.push(t.new_pool_dont[0]);bad('overlapping dont/fuzzy stops context',prepare({runtime:t}),'POOL_PARTITION_INVALID')}
{const t=clone(runtime);t.new_meta=t.new_meta.filter(x=>x[0]!==t.new_pool_dont[0]);bad('missing meaning stops rather than creating an incomplete word card',prepare({runtime:t}),'NEW_META_MISSING')}
{const t=clone(runtime);t.focus_pool[0][0]='unqualified';bad('focus cannot exceed review qualification',prepare({runtime:t}),'FOCUS_NOT_REVIEW')}
{const i=clone(index);i.dates.push(clone(i.dates.at(-1)));bad('duplicate index day fails closed',prepare({index:i}),'INDEX_INVALID')}
ok('missing one completed historical lesson fails closed',()=>{
 const missing='data/daily/2026-09-27-pm.json';
 assert.throws(()=>buildLessonContext(prepare({load:p=>{if(p===missing)throw Error('Missing history '+p);return read(p)}})),/Missing history/);
});
ok('unpublished next AM has no fabricated same-day lesson',()=>assert.equal(now.same_day_am,null));
ok('real CLI writes a matching JSON in an isolated temporary directory only when explicitly requested',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'learning-context-v1-'));
 try{
  const real=collectReviewHistory(index,target.date,target.session,read);
  for(const f of ['data/daily/index.json','data/learning-runtime.json','data/learning-pool-rules.json',...real.map(x=>'data/daily/'+x.date+'-'+x.session+'.json')]){
   fs.mkdirSync(path.dirname(path.join(tmp,f)),{recursive:true});
   fs.writeFileSync(path.join(tmp,f),raw(f));
  }
  const output='data/lesson-context.json',full=path.join(tmp,output);
  const command=path.join(__dirname,'build-lesson-context.js');
  const stdout=cp.execFileSync(process.execPath,[command,'--source-sha',sha],{cwd:tmp,encoding:'utf8'});
  assert.deepEqual(JSON.parse(stdout),now);
  assert.equal(fs.existsSync(full),false,'stdout mode unexpectedly wrote a file');
  cp.execFileSync(process.execPath,[command,'--output',output,'--source-sha',sha],{cwd:tmp,encoding:'utf8'});
  assert.deepEqual(JSON.parse(fs.readFileSync(full,'utf8')),now);
  // Pinned source passes only when both output and check use exactly the same SHA.
  assert.match(cp.execFileSync(process.execPath,[command,'--check','--source-sha',sha],{cwd:tmp,encoding:'utf8'}),/LESSON_CONTEXT_CHECK/);
  // Production context intentionally omits an origin commit SHA: its hashes describe
  // the NEW runtime and the index bundled in the same generated-data commit.
  cp.execFileSync(process.execPath,[command,'--output',output],{cwd:tmp});
  assert.match(cp.execFileSync(process.execPath,[command,'--check'],{cwd:tmp,encoding:'utf8'}),/LESSON_CONTEXT_CHECK/);
  const live=JSON.parse(fs.readFileSync(full,'utf8'));
  assert.deepEqual(live,buildLessonContext(prepare({sourceSha:''})));
  const failure=args=>{
   try{cp.execFileSync(process.execPath,[command,...args],{cwd:tmp,stdio:['ignore','pipe','pipe']});return null}
   catch(e){return JSON.parse(e.stderr.toString())}
  };
  const originalIndex=fs.readFileSync(path.join(tmp,'data/daily/index.json'));
  const originalRuntime=fs.readFileSync(path.join(tmp,'data/learning-runtime.json'));
  const oldContext=fs.readFileSync(full);
  fs.rmSync(full);
  assert.equal(failure(['--check']).code,'CONTEXT_MISSING','missing context must fail closed');
  fs.writeFileSync(full,oldContext);
  const newRuntime=clone(runtime);
  newRuntime.generated_at='2026-09-28T20:00:00.000Z';
  fs.writeFileSync(path.join(tmp,'data/learning-runtime.json'),JSON.stringify(newRuntime));
  assert.equal(failure(['--check']).code,'CONTEXT_STALE','feedback rebuild must invalidate stale context');
  fs.writeFileSync(path.join(tmp,'data/learning-runtime.json'),originalRuntime);
  const newIndex=clone(index);
  newIndex.dates.at(-1).verified='updated-after-check';
  fs.writeFileSync(path.join(tmp,'data/daily/index.json'),JSON.stringify(newIndex));
  assert.equal(failure(['--check']).code,'CONTEXT_STALE','even matching watermark with different index hash must fail');
  fs.writeFileSync(path.join(tmp,'data/daily/index.json'),originalIndex);
  assert.match(cp.execFileSync(process.execPath,[command,'--check'],{cwd:tmp,encoding:'utf8'}),/LESSON_CONTEXT_CHECK/);
 }finally{fs.rmSync(tmp,{recursive:true,force:true})}
});
ok('both existing writer workflows update context in their own derived-data transaction',()=>{
 const sync=fs.readFileSync(path.join(__dirname,'../workflows/sync-daily-vocab.yml'),'utf8');
 const build=fs.readFileSync(path.join(__dirname,'../workflows/build-learning-runtime.yml'),'utf8');
 for(const [name,workflow] of [['Sync daily vocab',sync],['Build learning runtime',build]]){
  assert(workflow.includes('node .github/scripts/build-learning-runtime.js'),name+' does not build canonical runtime');
  const rebuilt=workflow.indexOf('node .github/scripts/build-learning-runtime.js');
  const context=workflow.indexOf('node .github/scripts/build-lesson-context.js --output data/lesson-context.json');
  assert(context>rebuilt,name+' builds context before runtime');
  assert(workflow.includes('node .github/scripts/build-lesson-context.js --check'),name+' lacks fresh context readback');
  assert(workflow.split('\n').some(line=>line.trim().startsWith('git add ')&&line.includes('data/learning-runtime.json data/lesson-context.json')),name+' does not commit runtime and context together');
 }
 assert(sync.includes('node .github/scripts/build-lesson-context.js --check > /dev/null'),'scheduled healthy check accepts stale context');
 assert(build.includes("      - '.github/scripts/build-lesson-context.js'"),'weakness writer cannot seed a context on first merge');
 const workflows=git('ls-files','.github/workflows').split('\n');
 assert.deepEqual(workflows.sort(),['.github/workflows/build-learning-runtime.yml','.github/workflows/sync-daily-vocab.yml']);
});

// Phase 3: replay actual immutable Git histories across AM/PM publication and Sync barriers.
// No tomorrow lesson is generated; no production branch, index, runtime or website is written.
const {plan}=require('./plan-lesson-publication');
const actualCommit={
 amPublished:'e8d4ba66cf971c2109bca7c25fb8f596511e43ae',
 amSynced:'47fc83cab4ab212d2f07141515b87ca8f0b7d207',
 pmPublished:'884dad9bae06c3c47fabe3943247a333e0f4005b',
 pmSynced:'fa2d2c7b35026140da912f94c2b287e845911ac5'
};
const readAt=(ref,p)=>JSON.parse(git('show',ref+':'+p));
const at=(ref)=>{
 const load=p=>readAt(ref,p);
 return {index:load('data/daily/index.json'),runtime:load('data/learning-runtime.json'),
         rules:load('data/learning-pool-rules.json'),load,sourceSha:ref};
};
const earlyAm=at(actualCommit.amPublished),readyPm=at(actualCommit.amSynced);
const earlyPm=at(actualCommit.pmPublished),readyNextAm=at(actualCommit.pmSynced);
bad('actual AM commit before Sync cannot authorize PM word selection',earlyAm,'BASELINE_SYNC_STALE');
const pmInput=buildLessonContext(readyPm);
ok('actual completed AM Sync creates precisely PM 2026-09-28, with real AM applications',()=>{
 assert.deepEqual(pmInput.target,{date:'2026-09-28',session:'pm',time:'18:00',day:38});
 assert.deepEqual(pmInput.same_day_am.vocab.map(v=>v[0]),readyPm.load('data/daily/2026-09-28-am.json').vocab.map(v=>v.word));
 assert.equal(pmInput.source.lesson_watermark,'2026-09-28 08:00');
 assert.equal(pmInput.candidates.new_dont.length+pmInput.candidates.new_fuzzy.length,readyPm.runtime.new_pool.length);
 assert.equal(pmInput.history_7d.some(v=>v.date==='2026-09-28'&&v.session==='pm'),false);
});
const actualPm=readyNextAm.load('data/daily/2026-09-28-pm.json');
const pmPlanInput={
 lesson:actualPm,index:readyPm.index,runtime:readyPm.runtime,rules:readyPm.rules,
 mainHead:actualCommit.amSynced,expectedDate:'2026-09-28',expectedSession:'pm',
 sameDayAm:readyPm.load('data/daily/2026-09-28-am.json'),
 previousPm:readyPm.load('data/daily/2026-09-27-pm.json'),
 reviewHistory:collectReviewHistory(readyPm.index,'2026-09-28','pm',readyPm.load)
};
ok('actual recovered PM can be planned unchanged into exactly lesson+index on a synced baseline',()=>{
 const before=JSON.stringify(pmPlanInput),p=plan(pmPlanInput);
 assert.equal(p.ok,true,JSON.stringify(p.errors||[]));
 assert.equal(p.status,'ready');
 assert.deepEqual(p.files.map(f=>f.path),['data/daily/2026-09-28-pm.json','data/daily/index.json']);
 assert.deepEqual(JSON.parse(p.files[0].content),actualPm);
 const i=JSON.parse(p.files[1].content),row=i.dates.find(v=>v.date==='2026-09-28');
 assert.equal(row.am,true);assert.equal(row.pm,true);
 assert.equal(JSON.stringify(pmPlanInput),before,'planner mutated the approved candidate');
});
bad('actual PM commit before Sync cannot authorize next morning selection',earlyPm,'BASELINE_SYNC_STALE');
const nextAmInput=buildLessonContext(readyNextAm);
ok('actual PM Sync enables only next AM and removes actually taught PM new words',()=>{
 assert.deepEqual(nextAmInput.target,{date:'2026-09-29',session:'am',time:'08:00',day:39});
 assert.equal(nextAmInput.same_day_am,null);
 assert.deepEqual(nextAmInput.previous_pm.new_words,actualPm.new_words);
 for(const w of actualPm.new_words){
  assert(readyPm.runtime.new_pool.includes(w),'Historical PM new word unexpectedly ineligible: '+w);
  assert(!readyNextAm.runtime.new_pool.includes(w),'Published PM new word still eligible: '+w);
  assert(!nextAmInput.candidates.new_dont.some(x=>x[0]===w));
  assert(!nextAmInput.candidates.new_fuzzy.some(x=>x[0]===w));
 }
 assert.equal(nextAmInput.history_7d.length,14);
 assert.equal(nextAmInput.history_7d.some(v=>v.date==='2026-09-28'&&v.session==='pm'),true);
});
ok('identical real official PM is a no-op, never a second release',()=>{
 const p=plan({lesson:actualPm,index:readyNextAm.index,runtime:readyNextAm.runtime,
 rules:readyNextAm.rules,mainHead:actualCommit.pmSynced,expectedDate:'2026-09-28',
 expectedSession:'pm',publishedLesson:actualPm});
 assert.equal(p.ok,true);assert.equal(p.status,'already_published');assert.deepEqual(p.files,[]);
});
ok('different real official PM is refused instead of overwritten',()=>{
 const changed=clone(actualPm);changed.title+=' changed';
 const p=plan({lesson:changed,index:readyNextAm.index,runtime:readyNextAm.runtime,
 rules:readyNextAm.rules,mainHead:actualCommit.pmSynced,expectedDate:'2026-09-28',
 expectedSession:'pm',publishedLesson:actualPm});
 assert.equal(p.ok,false);assert.equal(p.errors[0].code,'ALREADY_PUBLISHED');assert.equal(p.files,undefined);
});
ok('post-PM stable replay has no source drift or invented input',()=>{
 assert.deepEqual(buildLessonContext(readyNextAm),nextAmInput);
 assert.equal(nextAmInput.source.master_unique,977);
 assert.deepEqual(nextAmInput.history_7d.map(h=>h.date+'-'+h.session),
   collectReviewHistory(readyNextAm.index,'2026-09-29','am',readyNextAm.load).map(h=>h.date+'-'+h.session));
 console.log('LIFECYCLE_REPLAY '+JSON.stringify({amPublished:actualCommit.amPublished,amSynced:actualCommit.amSynced,
 pmPublished:actualCommit.pmPublished,pmSynced:actualCommit.pmSynced,
 beforeSyncBlocked:2,afterSync:{pm:pmInput.target,nextAm:nextAmInput.target},pmApprovedCandidatePaths:2,
 duplicate:'no-op',changedDuplicate:'blocked',productionWrites:0}));
});

console.log('Lesson context integration tests:',JSON.stringify({passed,failed:0,main_sha:sha,target:now.target}));
