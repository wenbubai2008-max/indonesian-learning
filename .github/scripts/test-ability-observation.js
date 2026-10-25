#!/usr/bin/env node
'use strict';
// 2026-10-25 phase-1 observation: ability indicators, review load, long-unseen words and source labels are computed
// read-only from the existing training records; goal suggestions follow rules → review → history correction.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const repo=path.resolve(__dirname,'..','..');
const DAY=86400000,NOW=Date.parse('2026-10-25T05:00:00Z');
let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS '+name)};
function env({store={},candidates={}}={}){
  const writes=[];
  const localStorage={getItem:k=>k in store?JSON.stringify(store[k]):null,setItem:(k)=>writes.push(k),removeItem:(k)=>writes.push(k)};
  const iso=d=>new Date(NOW-d*DAY).toISOString();
  const win={localStorage,
    DAILY_VOCAB_DB:['satu','dua','tiga','empat','lima','enam'].map((w,i)=>({word:w,cn:'词'+i,first_seen:iso(60),last_seen:iso(i===5?45:2)})),
    WeaknessPool:{listMastered:()=>[{word:'satu'},{word:'dua'}],isExcluded:w=>w==='empat'},
    VocabStudyCoach:{candidates:(mode)=>candidates[mode]||[]}};
  win.window=win;
  vm.runInNewContext(fs.readFileSync(path.join(repo,'data/ability-observation.js'),'utf8'),win);
  return {api:win.AbilityObservation,writes};
}
const states={
  indo_quick_practice_state:{satu:{review_level:3,last:NOW-DAY},tiga:{review_level:4,last:NOW-DAY},lima:{review_level:2,last:NOW-DAY}},
  indo_listen_stats_v1:{dua:{fast_first_hear_streak:3,last_at:new Date(NOW).toISOString()}},
  indo_automation_training_state_v1:{satu:{status:'stable',last_recall_ms:3000,last_at:NOW-DAY},tiga:{status:'stable',last_recall_ms:8000,last_at:NOW-DAY},lima:{status:'active',last_at:NOW-DAY}},
  indo_weak_sync_config_v1:{endpoint:'https://w.example',key:'k'},
  indo_training_sync_meta_v1:{last_pull:new Date(NOW-3600000).toISOString()}
};
t('abilities: three separate counts that may overlap; confirmed mastery keeps its own definition',()=>{
  const {api}=env({store:states}),a=api.compute(NOW).abilities;
  assert.equal(a.recognition,2);assert.equal(a.listening,1);assert.equal(a.active,2);
  assert.equal(a.confirmed,2);assert.equal(a.active_and_confirmed,1);assert.equal(a.confirmed_without_active,1);assert.equal(a.active_not_confirmed,1);
  assert.equal(a.fast,1);assert.equal(a.fast_measured,2);
});
t('review load: due practised words by days overdue; never-practised words listed apart',()=>{
  const c={quick:[{kind:'review',due_at:NOW-2*3600000},{kind:'review',due_at:NOW-2*DAY},{kind:'stable',due_at:NOW-10*DAY},{kind:'new',due_at:0}],auto:[{kind:'verification',due_at:NOW-5*DAY}]};
  const l=env({store:states,candidates:c}).api.compute(NOW).load;
  assert.deepEqual(JSON.parse(JSON.stringify(l.quick)),{due:3,never:1,buckets:{today:1,d1_3:1,d4_7:0,d8:1},max_overdue:10});
  assert.equal(l.auto.buckets.d4_7,1);assert.equal(l.listen.due,0);
});
t('long unseen: 30+ days without lesson or training, mastered and excluded words skipped',()=>{
  const u=env({store:states}).api.compute(NOW).long_unseen;
  assert.equal(u.count,1);assert.equal(u.words[0].word,'enam');assert.equal(u.words[0].days,45);
});
t('source: complete only after a pull today; otherwise labelled as this device only',()=>{
  assert.equal(env({store:states}).api.compute(NOW).source.complete,true);
  const old=Object.assign({},states,{indo_training_sync_meta_v1:{last_pull:new Date(NOW-2*DAY).toISOString()}});
  const s=env({store:old}).api.compute(NOW).source;assert.equal(s.complete,false);assert.match(s.label,/仅本机/);
  const none=Object.assign({},states);delete none.indo_weak_sync_config_v1;
  assert.match(env({store:none}).api.compute(NOW).source.label,/没有设置同步/);
});
t('read-only: computing and rendering write nothing; the panel says it does not affect learning',()=>{
  const e=env({store:states});e.api.compute(NOW);const h=e.api.html(NOW);
  assert.equal(e.writes.length,0);assert.match(h,/观察中，不影响学习/);assert.match(h,/可以重叠，不相加/);assert.match(h,/数据来源/);
});
t('goal suggestions: review overrides rules; heavy errors keep a word out of recognize-only; fast only on use',()=>{
  const {build}=require('./suggest-vocab-goals.js');
  const src={taught:[{word:'jerapah'},{word:'seraya'},{word:'ternyata'},{word:'namun'}],rank:new Map(),primary:new Map([['namun',{stage:'C 扩展',topic:'连接词'}]]),secondary:new Map(),oral:new Map(),
    weak:{jerapah:{status:'active',wrong_count:0},seraya:{status:'active',wrong_count:4},ternyata:{status:'mastered'},namun:{status:'active'}},
    review:{jerapah:{goal:'recognize',note:'动物'},seraya:{goal:'recognize'},ternyata:{goal:'use',fast:true},namun:{goal:'use'}}};
  const o=build(src);
  assert.equal(o.words.jerapah.goal,'recognize');assert.equal(o.words.seraya.goal,'unsure');assert.match(o.words.seraya.by,/history/);
  assert.equal(o.words.ternyata.fast,true);assert.equal(o.words.namun.goal,'use');assert.equal(o.observation_only,true);
  assert.equal(o.counts.active.recognize,1);assert.equal(o.counts.active.unsure,1);
});
// Build regenerates the file after the weakness data changes, so only its shape is checked here (not freshness).
t('committed suggestions file is well formed and marked observation-only',()=>{
  const cur=JSON.parse(fs.readFileSync(path.join(repo,'data/vocab-goals-suggested.json'),'utf8'));
  assert.equal(cur.observation_only,true);const ws=Object.values(cur.words);
  assert.ok(ws.length>0&&ws.every(x=>['use','recognize','unsure'].includes(x.goal)&&(!x.fast||x.goal==='use')));
  assert.equal(cur.counts.all.use+cur.counts.all.recognize+cur.counts.all.unsure,ws.length);
});
console.log(`Ability observation tests passed: ${n}`);
