'use strict';
/**
 * Drill: runs the REAL build-learning-runtime.js against a throw-away copy of data/ in which more
 * words are marked as taught, to exercise phase changes that production has not hit yet:
 *   primary -> transition (1-9 primary words left) -> secondary (committed, permanent)
 * and the new_pool_dont exhaustion fallback. Never touches the repository's own data files.
 */
const assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),vm=require('vm');
const {execFileSync}=require('child_process');
const repo=path.resolve(__dirname,'..','..');
const builder=path.join(repo,'.github','scripts','build-learning-runtime.js');
const key=s=>String(s||'').trim().toLowerCase();

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'handoff-drill-'));
process.on('exit',()=>{try{fs.rmSync(tmp,{recursive:true,force:true})}catch(e){}});
fs.cpSync(path.join(repo,'data'),path.join(tmp,'data'),{recursive:true});

const rd=p=>JSON.parse(fs.readFileSync(path.join(tmp,p),'utf8'));
const build=()=>{execFileSync('node',[builder],{cwd:tmp,stdio:'pipe'});return rd('data/learning-runtime.json')};
const dailyFile=path.join(tmp,'data','daily-vocab-data.js');
const taughtStamp='2026-08-22 08:00';
const markTaught=words=>{
 if(!words.length)return;
 const rows=words.map(w=>({word:w,cn:'drill',last_seen:taughtStamp,lesson_occurrences:[taughtStamp]}));
 fs.appendFileSync(dailyFile,'\nwindow.DAILY_VOCAB_DB.push(...'+JSON.stringify(rows)+');\n');
};
const win=(()=>{const c={window:{}};vm.createContext(c);
 for(const p of ['master-vocab-data.js','master-vocab-data-2.js','master-vocab-data-3.js'])vm.runInContext(fs.readFileSync(path.join(tmp,'data',p),'utf8'),c);
 return c.window})();
const win2=(()=>{const c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(tmp,'data','master-vocab-secondary.js'),'utf8'),c);return c.window})();
const primary=new Set(win.MASTER_VOCAB_DB.map(x=>key(Array.isArray(x)?x[0]:x.word)));
const secondaryWords=rt=>rt.new_pool.filter(w=>!primary.has(key(w)));
let n=0;const t=(name,fn)=>{try{fn();n++}catch(e){e.message=name+': '+e.message;throw e}};

// Teach primary words (taking them from the exposed pool) until at most `left` remain.
function drainPrimaryTo(left){
 let rt=rd('data/learning-runtime.json');
 for(let i=0;i<20&&rt.handoff.primary_remaining>left;i++){
  const prim=rt.new_pool.filter(w=>primary.has(key(w)));
  const take=Math.min(prim.length,rt.handoff.primary_remaining-left);
  assert.ok(take>0,'no exposed primary word to teach');
  markTaught(prim.slice(0,take));
  rt=build();
 }
 return rt;
}

let base=build();
const baseline={phase:base.handoff.phase,remaining:base.handoff.primary_remaining};

t('0 baseline copy builds and matches the repo state',()=>{
 const real=JSON.parse(fs.readFileSync(path.join(repo,'data','learning-runtime.json'),'utf8'));
 assert.equal(baseline.phase,real.handoff.phase);
 assert.equal(baseline.remaining,real.handoff.primary_remaining);
});

// A0. 2026-10-07: primary phase appends secondary dont words after the primary words (never fuzzy, never ahead of primary).
t('A0 primary phase: secondary dont top-up follows primary words',()=>{
 assert.equal(base.handoff.phase,'primary');
 assert.ok(base.stats.new_pool_secondary_dont_topup>0,'top-up present');
 const dont=base.new_pool_dont;
 const firstSec=dont.findIndex(w=>!primary.has(key(w)));
 assert.ok(firstSec>0,'secondary dont exists and is not first');
 assert.ok(dont.slice(0,firstSec).every(w=>primary.has(key(w))),'all primary dont words precede secondary ones');
 assert.ok(base.new_pool_fuzzy.every(w=>primary.has(key(w))),'no secondary fuzzy before transition');
 const sab=Object.fromEntries(win2.SECONDARY_MASTER_VOCAB_DB.map(x=>[key(x.word),x.sab]));
 const rank={S:0,A:1,B:2},order=dont.filter(w=>!primary.has(key(w))).map(w=>rank[sab[key(w)]]??3);
 assert.deepEqual(order,[...order].sort((a,b)=>a-b),'secondary dont ordered S>A>B');
 assert.equal(base.stats.primary_new_pool_total_full,base.handoff.primary_remaining);
});
t('A1 oral pool: new colloquial candidates are eligible and dont-oral covers the 08:00 quota of 2',()=>{
 assert.ok(base.oral_new_pool.length>=10);
 assert.ok(base.oral_new_pool_dont.length>=2);
 const pool=new Set(base.new_pool.map(key));
 assert.ok(base.oral_new_pool.every(x=>pool.has(key(x[0]))),'oral pool is a subset of new_pool');
});

// A. dont exhaustion: every dont word taught -> dont pool empty, fuzzy still supplies new words, nothing unclassified.
t('A new_pool_dont exhausted: fuzzy remains the only legal supply',()=>{
 let rt=base;
 for(let i=0;i<10&&rt.new_pool_dont.length;i++){markTaught(rt.new_pool_dont);rt=build()}
 assert.equal(rt.stats.new_pool_dont_total_full,0);
 assert.equal(rt.new_pool_dont.length,0);
 assert.ok(rt.new_pool_fuzzy.length>=10,'AM still needs 10 legal fuzzy words');
 assert.equal(rt.stats.new_pool_unclassified_total_full,0);
 const pool=new Set(rt.new_pool.map(key));
 assert.ok(rt.new_pool_fuzzy.every(w=>pool.has(key(w))),'fuzzy subset of new_pool');
 assert.equal(rt.handoff.phase,'primary');
});

// B. transition: 1-9 primary words left.
t('B transition: remaining primary first, topped up from secondary',()=>{
 const rt=drainPrimaryTo(5);
 assert.equal(rt.handoff.phase,'transition');
 assert.equal(rt.active_master_pool,'primary_to_secondary');
 assert.equal(rt.handoff.primary_remaining,5);
 assert.equal(rt.handoff.committed_secondary,false);
 const first=rt.new_pool.slice(0,5);
 assert.ok(first.every(w=>primary.has(key(w))),'remaining primary words come first');
 assert.ok(rt.new_pool.length>=10,'new_pool still offers >=10 candidates (needs secondary top-up)');
 assert.ok(secondaryWords(rt).length>0,'secondary words present');
 assert.equal(rd('data/master-handoff-state.json').phase,'transition');
 assert.equal(rd('data/master-handoff-state.json').committed_secondary,false);
});

// C. exhaustion of primary: permanent commit to secondary.
t('C primary exhausted: committed to secondary, primary words gone',()=>{
 const rt=drainPrimaryTo(0);
 assert.equal(rt.handoff.phase,'secondary');
 assert.equal(rt.handoff.committed_secondary,true);
 assert.equal(rt.active_master_pool,'secondary_bipa');
 assert.ok(rt.new_pool.length>=10);
 assert.ok(rt.new_pool.every(w=>!primary.has(key(w))),'no primary word in new_pool');
 const st=rd('data/master-handoff-state.json');
 assert.equal(st.phase,'secondary');assert.equal(st.committed_secondary,true);assert.ok(st.switched_at);
});

// D. permanence: a primary word becoming new again must not pull the source back to primary.
t('D commit is permanent even if a primary word becomes untaught again',()=>{
 const before=rd('data/master-handoff-state.json').switched_at;
 let s=fs.readFileSync(dailyFile,'utf8');
 const victim=[...primary].find(w=>s.includes('"word":"'+w+'","cn":"drill"'));
 assert.ok(victim,'a drill-taught primary word exists');
 s=s.split('{"word":"'+victim+'","cn":"drill"').join('{"word":"__removed_'+victim+'","cn":"drill"');
 fs.writeFileSync(dailyFile,s);
 const rt=build();
 assert.equal(rt.handoff.phase,'secondary');
 assert.equal(rt.handoff.committed_secondary,true);
 assert.ok(rt.new_pool.every(w=>!primary.has(key(w))),'primary word not re-offered after commit');
 assert.equal(rd('data/master-handoff-state.json').switched_at,before,'switched_at not rewritten');
});

// E. the drill never changed the real repository files.
t('E repository data untouched',()=>{
 const real=JSON.parse(fs.readFileSync(path.join(repo,'data','master-handoff-state.json'),'utf8'));
 assert.equal(real.phase,baseline.phase);
});

console.log(`handoff drill: ${n} checks passed`);
