'use strict';
/**
 * 2026-10-14 regression test: WeaknessPool.importRecords (batch) must give exactly the same data as calling
 * importRecord once per record, while touching the ~800KB pool storage once and firing ONE change event
 * (the per-record path froze the page for many seconds on a pull with hundreds of newer cloud records).
 */
const assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'..','..','data','weakness-pool.js'),'utf8');

function makeEnv(seed){
 const store=new Map(Object.entries(seed||{}));const writes={};let events=0;
 const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>{store.set(k,String(v));writes[k]=(writes[k]||0)+1},removeItem:k=>store.delete(k)};
 const window={dispatchEvent:e=>{if(e&&e.type==='weak-pool-changed')events++;return true},addEventListener(){},removeEventListener(){}};
 const ctx={window,localStorage,document:{addEventListener(){},getElementById:()=>null,readyState:'complete'},console,setTimeout:()=>0,clearTimeout(){},
  CustomEvent:function(type,init){this.type=type;this.detail=init&&init.detail},Date,JSON,Math,Object,Array,Set,Map,String,Number,Promise};
 ctx.window.window=ctx.window;vm.createContext(ctx);vm.runInContext(src,ctx,{filename:'weakness-pool.js'});
 // the script itself may write once while loading; count only what happens after it is ready
 for(const k of Object.keys(writes))delete writes[k];events=0;
 return {pool:ctx.window.WeaknessPool,store,writes,events:()=>events};
}
assert.ok(makeEnv().pool&&typeof makeEnv().pool.importRecords==='function','WeaknessPool.importRecords is exported');

// A pool that already holds some words, plus legacy keys that the import touches.
const seed={
 indo_weak_pool_v1:JSON.stringify({
  makan:{word:'makan',status:'active',reasons:['memory_dont'],wrong_count:2,right_streak:0,first_seen:'2026-09-01T00:00:00.000Z'},
  minum:{word:'minum',status:'mastered',reasons:[],wrong_count:0,right_streak:3,last_mastered:'2026-09-10T00:00:00.000Z',mastered_reason:'self'},
  tidur:{word:'tidur',status:'active',reasons:['quick_wrong'],wrong_count:1,right_streak:0},
 }),
 indo_weakness_dismissed:JSON.stringify({tidur:{word:'tidur',at:1}}),
 indo_unknown_words:JSON.stringify({baru:{word:'baru',times_seen:1}}),
};
const records=[
 {word:'makan',status:'mastered',reasons:[],wrong_count:2,right_streak:3,last_mastered:'2026-10-13T01:00:00.000Z'},            // active -> mastered
 {word:'Minum',status:'active',reasons:['memory_fuzzy'],wrong_count:1,right_streak:0,last_wrong:'2026-10-13T02:00:00.000Z'}, // mastered -> active (case differs)
 {word:'tidur',status:'active',reasons:['cloud_sync','memory_dont'],wrong_count:5,right_streak:0,last_review:'2026-10-13T03:00:00.000Z'},
 {word:'baru',status:'mastered',reasons:[],wrong_count:0,right_streak:4,last_mastered:'2026-10-13T04:00:00.000Z'},           // clears legacy unknown
 {word:'lari',display:'lari',cn:'跑',status:'active',reasons:['memory_dont'],wrong_count:0,right_streak:0},                   // brand new word
 {word:'lompat',status:'mastered',reasons:[],right_streak:2,last_mastered:'2026-10-13T05:00:00.000Z'},
 {word:'',status:'active'},{status:'active'},null,                                                                          // invalid rows are ignored
 {word:'makan',status:'active',reasons:['automation_fail'],wrong_count:3,right_streak:0,last_wrong:'2026-10-13T06:00:00.000Z'}, // same word twice: last one wins
];
const norm=env=>{const o={};for(const k of ['indo_weak_pool_v1','indo_weakness_dismissed','indo_unknown_words'])o[k]=JSON.parse(env.store.get(k)||'{}');
 // timestamps created "now" differ between runs: compare everything except those
 const strip=x=>{if(Array.isArray(x))return x.map(strip);if(x&&typeof x==='object'){const r={};Object.keys(x).sort().forEach(k=>{if(!['updated_at','at','first_seen','last_seen','created_at'].includes(k)||k==='first_seen'&&false)r[k]=strip(x[k])});return r}return x};
 return strip(o)};

const oldWay=makeEnv(seed);records.forEach(r=>oldWay.pool.importRecord(r));
const batch=makeEnv(seed);const n=batch.pool.importRecords(records);

assert.deepEqual(norm(batch),norm(oldWay),'batch import yields exactly the same pool / legacy keys as per-record import');
assert.equal(n,7,'valid rows are counted (invalid ones ignored)');
const valid=records.filter(r=>r&&r.word).length;
assert.ok(oldWay.writes.indo_weak_pool_v1>=valid&&oldWay.events()>=valid,'baseline: the per-record path writes the pool and fires the event once per record');
// <= 2: the final save plus (only when legacy keys exist, as in this seed) the one-off legacy migration the first migrate() always does.
assert.ok(batch.writes.indo_weak_pool_v1<=2&&batch.events()<=2,'batch: constant number of pool writes/events, independent of the record count ('+batch.writes.indo_weak_pool_v1+' writes, '+batch.events()+' events vs '+oldWay.writes.indo_weak_pool_v1+' / '+oldWay.events()+' per-record)');

// empty / invalid input is a no-op: no write, no event.
const idle=makeEnv(seed);assert.equal(idle.pool.importRecords([]),0);assert.equal(idle.pool.importRecords([null,{}]),0);assert.equal(idle.pool.importRecords(),0);
assert.ok(!idle.writes.indo_weak_pool_v1&&idle.events()===0,'nothing to import => nothing written');

// the single-record API still works and still writes once + one event
const one=makeEnv(seed);assert.ok(one.pool.importRecord({word:'baru2',status:'active',reasons:['memory_dont']}));
assert.equal(one.writes.indo_weak_pool_v1,1);assert.equal(one.events(),1);

// scale: 1500 records in one batch = still one write / one event
const big=makeEnv({});const many=Array.from({length:1500},(_,i)=>({word:'kata'+i,status:i%3?'active':'mastered',reasons:['memory_dont'],last_mastered:'2026-10-13T00:00:00.000Z'}));
assert.equal(big.pool.importRecords(many),1500);assert.equal(big.writes.indo_weak_pool_v1,1);assert.equal(big.events(),1);
console.log('weakness batch import tests passed: same data as per-record import, constant pool writes and events for any batch size');
