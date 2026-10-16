'use strict';
// 2026-10-16 PR 4: weekly memory report — counts, self-report kept apart from accuracy, 7-30 day retention with a
// minimum sample, repeated forgetting on >= 2 days, 14-day practice strip, and no writes.
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.resolve(__dirname,'../../data/weekly-memory-report.js'),'utf8');
const H=3600000,D=24*H,now=Date.parse('2026-10-16T05:00:00Z'); // 12:00 Jakarta
const iso=(daysAgo,h=3)=>new Date(now-daysAgo*D-h*H).toISOString();
function run({db,mastered=[],ev=[],store={}}){
  const writes=[],ls={getItem:k=>k in store?JSON.stringify(store[k]):null,setItem:(k)=>writes.push(k)};
  const root={DAILY_VOCAB_DB:db,localStorage:ls,WeaknessPool:{listMastered:()=>mastered},VocabProfileEvidence:{records:()=>ev}};
  vm.runInNewContext(src,{window:root,Intl,Date,Math,JSON,Object,String,Number,Array,Map,Set});
  return {r:root.WeeklyMemoryReport.compute(now),writes};
}
const w=(word,first)=>({word,cn:'cn-'+word,first_seen:first+' 08:00'});
const db=[w('n0','2026-10-16'),w('n1','2026-10-15'),w('n2','2026-10-14'),w('n6','2026-10-10'),w('n7','2026-10-09'),w('n8','2026-10-08'),
  ...Array.from({length:12},(_,i)=>w('old'+i,'2026-09-25'))];
{
  const {r,writes}=run({db,
    mastered:[{word:'x',last_mastered:iso(2)},{word:'y',last_mastered:iso(9)}],
    store:{indo_lesson_recall_v1:{version:1,words:{n1:{day:'2026-10-16',result:'fail',at:iso(0),hist:[{day:'2026-10-16',result:'fail',at:iso(0)}]},n2:{day:'2026-10-16',result:'fast',at:iso(0),hist:[{day:'2026-10-15',result:'slow',at:iso(1)},{day:'2026-10-16',result:'fast',at:iso(0)}]},
      old1:{day:'2026-10-14',result:'fail',hist:[{day:'2026-10-10',result:'fail'},{day:'2026-10-14',result:'fail'}]}}},
      indo_automation_training_state_v1:{n6:{last_at:now-D}},indo_quick_practice_state:{N7:{last:now-2*D}}},
    ev:[...Array.from({length:6},(_,i)=>({word:'old'+i,source:'auto',result:'right',stage:4,at:iso(1)})),
        {word:'old6',source:'quick',result:'wrong',at:iso(1)},{word:'old6',source:'quick',result:'right',at:iso(1,1)},
        {word:'old7',source:'listen',result:'wrong',at:iso(3)},{word:'old7',source:'listen',result:'wrong',at:iso(5)},
        {word:'n1',source:'quick',result:'right',at:iso(0)}]});
  assert.equal(r.newThisWeek,4,'n0, n1, n2, n6: first taught today..6 days ago');
  assert.equal(r.recentTotal,4,'n1, n2, n6, n7: taught 1-7 days ago');
  assert.equal(r.mastered,1,'only masteries dated this week');
  assert.equal(r.recall.covered,2);assert.deepEqual({...r.recall.split},{fast:0,slow:1,fail:1},'first recall per word counts');
  assert.equal(r.verified,2,'n6 (auto) and n7 (quick, key spelling ignored)');
  assert.equal(r.retention.n,9,'first answer per word per day per trainer; n1 too young for retention');
  assert.equal(r.retention.enough,false,'below 10 answers → 样本不足');assert.equal(r.retention.rate,67);
  assert.deepEqual(Array.from(r.forgotten.map(x=>x.word)),['old1','old7'],'failures on >= 2 different days (formal or recall); old6 failed once');
  assert.equal(r.days.length,14);assert.equal(r.days[13].day,'2026-10-16');assert.equal(r.formalTotal,11);
  assert.equal(writes.length,0,'report never writes');
}
{
  const ev=Array.from({length:12},(_,i)=>({word:'old'+i,source:'auto',result:i<9?'right':'fail',stage:4,at:iso(2)}));
  const {r}=run({db,ev});assert.equal(r.retention.enough,true);assert.equal(r.retention.rate,75);
}
console.log('Weekly memory report tests passed: counts, recall kept apart, retention sample guard, repeated forgetting, 14-day strip, read-only.');
