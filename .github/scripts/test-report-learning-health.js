'use strict';
/** Unit tests for the pure functions of report-learning-health.js (read-only report; fixtures are tiny and synthetic). */
const assert=require('node:assert/strict');
const {runway,oralDiagnosis,oralRunway,oralUsage,recurrenceCoverage,reviewGap,commitStats,alerts,buildReport,format,ALERT}=require('./report-learning-health');
let n=0;const t=(name,fn)=>{try{fn();n++}catch(e){e.message=name+': '+e.message;throw e}};
const W=(word,status='active')=>[word.toLowerCase(),{word,status}];
const runtime=(o={})=>({handoff:{phase:'primary',primary_remaining:212,secondary_available:340,...(o.handoff||{})},
 stats:{new_pool_dont_total_full:189,new_pool_fuzzy_total_full:172,oral_new_pool_total_full:33,oral_new_pool_dont_total_full:8,...(o.stats||{})}});
const lesson=(date,session,extra)=>({date,session,...extra});

t('runway: dont/transition/exhaustion estimates and observed pace',()=>{
 const lessons=[lesson('2026-10-06','am',{vocab:Array(10).fill('x').map((x,i)=>({word:'a'+i}))}),lesson('2026-10-06','pm',{vocab:[{word:'p1',source_group:'new'},{word:'p2',source_group:'new'},{word:'p3',source_group:'new'},{word:'r1',source_group:'review'}]})];
 const r=runway({runtime:runtime(),lessons,today:'2026-10-07'});
 assert.equal(r.observed_new_per_day_14d,13);
 assert.equal(r.est_days_until_dont_exhausted,+(189/11.5).toFixed(1));
 assert.equal(r.est_days_until_transition,+((212-9)/13.5).toFixed(1));
 assert.equal(runway({runtime:runtime({handoff:{primary_remaining:5}}),lessons:[],today:'2026-10-07'}).est_days_until_transition,0);
});
t('oralDiagnosis: each candidate lands in exactly one bucket',()=>{
 const weak=new Map([W('santai'),W('paham','mastered'),W('ngopi'),W('lama','active')]);
 const d=oralDiagnosis({oral:[{word:'santai'},{word:'paham'},{word:'nyasar'},{word:'lama'},{word:'asing'},{word:'santai'}],
  primary:['santai','paham','lama'],secondary:['asing'],taught:new Set(['lama']),weak});
 assert.deepEqual(d.buckets,{total:5,taught:1,mastered:1,not_active:1,not_in_primary_or_secondary:1,eligible_new:1});
});
t('oralRunway: 3 oral words per day',()=>{
 assert.equal(oralRunway(runtime()).est_days,11);
 assert.equal(oralRunway({stats:{}}).est_days,0);
});
t('reviewGap: buckets by days since last exposure, application excluded, mastered ignored',()=>{
 const weak=new Map([W('a'),W('b'),W('c'),W('d'),W('e'),W('m','mastered')]);
 const taught=new Set(['a','b','c','d','e','m']);
 const lessons=[lesson('2026-10-05','am',{vocab:[{word:'a'}],review_vocab:[]}),lesson('2026-09-25','pm',{vocab:[{word:'b',source_group:'review'},{word:'e',source_group:'application'}]}),
  lesson('2026-09-10','am',{vocab:[{word:'c'}],review_vocab:[]}),lesson('2026-08-25','am',{vocab:[{word:'d'},{word:'m'}],review_vocab:[]})];
 const g=reviewGap({taught,weak,lessons,today:'2026-10-07'});
 assert.equal(g.active_taught,5);
 assert.deepEqual(g.buckets,{'0-7d':1,'8-14d':1,'15-30d':1,'31d+':1,no_lesson_record:1}); // e only seen as application => no record
 assert.deepEqual(g.stalest[0],['d',43]);
});
t('commitStats: classifies machine vs human commits',()=>{
 const c=commitStats(['Build learning runtime pools','chore: sync learning weakness state','Sync daily lesson vocabulary and runtime','lesson: 2026-10-06 18:00 PM (Day 46) (#89)','Lesson release 2026-10-07 AM (Day 47) (#90)','Publish extensive reading 2026-10-07','Fix something']);
 assert.deepEqual(c,{total:7,machine_runtime_sync:3,lesson:2,reading:1,other:1,machine_share:0.43});
 assert.deepEqual(commitStats(undefined),{total:0,machine_runtime_sync:0,lesson:0,reading:0,other:0,machine_share:0});
});
t('alerts: thresholds trigger and stay quiet when healthy; stale-word count is NOT an alert (review is a later cycle)',()=>{
 const healthy={runway:{phase:'primary',est_days_until_dont_exhausted:16,est_days_until_transition:40,est_days_until_all_new_exhausted:41},oral_runway:{est_days:11},review_gap:{buckets:{'31d+':999}}};
 assert.deepEqual(alerts(healthy),[]);
 const bad={runway:{phase:'primary',est_days_until_dont_exhausted:3,est_days_until_transition:15,est_days_until_all_new_exhausted:10},oral_runway:{est_days:2},review_gap:{buckets:{'31d+':0}}};
 assert.equal(alerts(bad).length,4);
 assert.ok(alerts(bad).some(x=>/all new words run out in ~10 days/.test(x)));
 assert.deepEqual(alerts({...healthy,runway:{phase:'secondary',est_days_until_dont_exhausted:16,est_days_until_transition:0,est_days_until_all_new_exhausted:30}}),[]);
});
t('runway: remaining new words across both libraries, secondary phase counts only the second library',()=>{
 const p=runway({runtime:runtime(),lessons:[],today:'2026-10-07'});
 assert.equal(p.new_words_left_total,212+340);
 assert.equal(p.est_days_until_all_new_exhausted,+(552/13.5).toFixed(1));
 const s=runway({runtime:runtime({handoff:{phase:'secondary',primary_remaining:0,secondary_available:270}}),lessons:[],today:'2026-10-07'});
 assert.equal(s.new_words_left_total,270);
});
t('oralUsage: counts oral new words per lesson, ignores review/application and old lessons, alerts only above the guideline',()=>{
 const o=(w,oral)=>({word:w,source_group:'new',is_new:true,is_oral_new:oral});
 const lessons=[
  lesson('2026-10-07','am',{vocab:[{word:'a',is_oral_new:true},{word:'b',is_oral_new:true},{word:'c'}]}), // AM: every vocab entry is new
  lesson('2026-10-07','pm',{vocab:[o('x',true),o('y',true),o('z',true),{word:'r',source_group:'review',is_oral_new:true}]}), // review row must not count
  lesson('2026-09-01','pm',{vocab:[o('old',true)]}), // outside the window
 ];
 const u=oralUsage({lessons,today:'2026-10-07'});
 assert.deepEqual(u.rows,[{date:'2026-10-07',session:'am',new_words:3,oral_new:2},{date:'2026-10-07',session:'pm',new_words:3,oral_new:3}]);
 assert.equal(u.oral_total,5);assert.equal(u.new_total,6);assert.equal(u.oral_share,0.83);
 const r={runway:{phase:'secondary',est_days_until_dont_exhausted:99,est_days_until_transition:0},oral_runway:{est_days:99},review_gap:{buckets:{'31d+':0}},oral_usage:u};
 const a=alerts(r);
 assert.equal(a.length,1);assert.match(a[0],/2026-10-07 PM: 3 oral new words of 3/);
 r.oral_usage=oralUsage({lessons:[lesson('2026-10-07','pm',{vocab:[o('x',true),o('y',true),o('z',false)]})],today:'2026-10-07'});
 assert.deepEqual(alerts(r),[],'2 oral in PM is within the alert threshold');
 assert.deepEqual(oralUsage({lessons:[],today:'2026-10-07'}).rows,[]);
});
t('recurrenceCoverage: share of the backlog seen in lesson text in the last 14 days',()=>{
 const rt={review_pool:[['aa',1,0,'','','x','','']],recurrence_pool:[['bb',2,'y'],['cc',2,'z'],['dd',2,'w']]};
 const lessons=[lesson('2026-08-20','am',{vocab:[{word:'aa'},{word:'bb'},{word:'cc'},{word:'dd'}]}),lesson('2026-10-05','pm',{reading:{text:'Ada aa dan bb.'}})];
 const c=recurrenceCoverage({runtime:rt,lessons,today:'2026-10-07'});
 assert.equal(c.pool_size,4);assert.equal(c.seen_last_14d,2);assert.equal(c.seen_share,0.5);assert.equal(c.not_seen_30d_or_unknown,2);
 assert.equal(recurrenceCoverage({runtime:{},lessons:[],today:'2026-10-07'}).pool_size,0);
});
t('buildReport/format never throw on empty inputs',()=>{
 const r=buildReport({today:'2026-10-07',runtime:{},lessons:[],oral:[],primary:[],secondary:[],taught:new Set(),weak:new Map(),commitSubjects:[]});
 assert.ok(Array.isArray(r.alerts));
 assert.match(format(r),/Alerts/);
});
console.log(`report-learning-health tests: ${n} passed`);
