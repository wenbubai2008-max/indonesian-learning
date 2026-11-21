'use strict';
const assert=require('node:assert/strict');
const {collectThemeWords}=require('./theme-word-pool');
let checks=0;
const t=(name,fn)=>{try{fn();checks++;}catch(e){e.message=name+': '+e.message;throw e}};
function run(){
const doc={version:1,per_lesson:2,weeks:[
 {theme_id:'logistics',start_date:'2026-11-23',approved:true,words:[
  {word:'resi',cn:'运单号'},{word:'ongkir',cn:'运费',formal:'ongkos kirim'},{word:'paket',cn:'包裹'},
  {word:'gudang',cn:'仓库'},{word:'lacak',cn:'追踪'},{word:'kurir',cn:'快递员'},{word:'bad\nword',cn:'x'},{word:'kosong',cn:''},
  {word:'tertahan',cn:'滞留'}]},
 {theme_id:'government',start_date:'2026-11-30',approved:true,words:[{word:'KTP',cn:'身份证'}]},
 {theme_id:'health',start_date:'2026-12-07',approved:false,words:[{word:'resep',cn:'处方'}]}
]};
const weakMap=new Map([['gudang',{word:'gudang',status:'mastered'}],['lacak',{word:'lacak',status:'active',reasons:['memory_fuzzy']}]]);
const base={doc,dailySet:new Set(),weakMap,primarySet:new Set(['paket']),secondarySet:new Set(['kurir'])};
const at=wm=>collectThemeWords({...base,lessonWatermark:wm});
t('closed before the previous Sunday PM is published',()=>{assert.deepEqual(at('2026-11-22 08:00').release,[]);assert.deepEqual(at('2026-11-22 08:00').eligible,[])});
t('opens after the previous Sunday PM; releases exactly per_lesson words in list order',()=>assert.deepEqual(at('2026-11-22 18:00').release.map(x=>x.word),['resi','ongkir']));
t('skips mastered, library words, garbled and meaning-less entries',()=>assert.deepEqual(at('2026-11-22 18:00').eligible.map(x=>x.word),['resi','ongkir','lacak','tertahan']));
t('teaching the released words moves the release forward',()=>assert.deepEqual(collectThemeWords({...base,dailySet:new Set(['resi','ongkir']),lessonWatermark:'2026-11-23 08:00'}).release.map(x=>x.word),['lacak','tertahan']));
t('unfinished words carry over before the next week',()=>assert.deepEqual(collectThemeWords({...base,dailySet:new Set(['resi']),lessonWatermark:'2026-11-29 18:00'}).release.map(x=>x.word),['ongkir','lacak']));
t('unapproved weeks never release',()=>assert.ok(!collectThemeWords({...base,dailySet:new Set(['resi','ongkir','lacak','tertahan','ktp']),lessonWatermark:'2026-12-08 08:00'}).eligible.some(x=>x.word==='resep')));
t('taught words without a weakness record are returned for review; with a record the weakness rules take over',()=>{
  const r=collectThemeWords({...base,dailySet:new Set(['resi','lacak']),lessonWatermark:'2026-11-23 18:00'});
  assert.deepEqual(r.taughtNoRecord.map(x=>x.word),['resi']);});
t('keeps meta for lesson generation',()=>assert.deepEqual(at('2026-11-22 18:00').release[1],{word:'ongkir',cn:'运费',formal:'ongkos kirim',note:'',theme_id:'logistics'}));
t('per_lesson is capped at 3 and the real data file is well-formed',()=>{
  assert.equal(collectThemeWords({...base,doc:{...doc,per_lesson:9},lessonWatermark:'2026-11-22 18:00'}).perLesson,3);
  const real=JSON.parse(require('fs').readFileSync('data/theme-words.json','utf8'));
  assert.equal(real.per_lesson,2);
  for(const w of real.weeks){assert.match(w.start_date,/^\d{4}-\d{2}-\d{2}$/);assert.equal(new Date(w.start_date+'T00:00:00Z').getUTCDay(),1,'start_date must be a Monday');
    const ks=w.words.map(x=>String(x.word).trim().toLowerCase());assert.equal(new Set(ks).size,ks.length,'duplicate word in '+w.theme_id);
    w.words.forEach(x=>assert.ok(String(x.cn||'').trim(),'missing cn: '+x.word));}
});
}
if(require.main===module){run();console.log('Theme new-word pool tests passed: '+checks)}
module.exports={run};
