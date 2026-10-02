#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

const REPO=path.resolve(__dirname,'../../..');
const core=require('./core.js');
const wrapper=require('./generate-prototype.js');
const {validate}=require(path.join(REPO,'.github/scripts/validate-lesson-candidate.js'));
const {auditLesson}=require('./quality.js');

const read=p=>JSON.parse(fs.readFileSync(path.join(REPO,p),'utf8'));
const norm=x=>String(x||'').trim().toLowerCase();
const wc=x=>String(x||'').trim().split(/\s+/).filter(Boolean).length;
const hasWord=(text,word)=>{
  const escaped=String(word||'').replace(/[\/\\^$*+?.()|[\]{}]/g,'\\$&').replace(/\s+/g,'\\s+');
  return !!escaped&&new RegExp('(^|[^\\p{L}])'+escaped+'(?=$|[^\\p{L}])','iu').test(String(text||''));
};
const dailySource=fs.readFileSync(path.join(REPO,'data/daily-vocab-data.js'),'utf8');
const da=dailySource.indexOf('['),db=dailySource.lastIndexOf(']');
const dailyRows=JSON.parse(dailySource.slice(da,db+1));
const bundle=read('prototype/lesson-engine/materials/materials-bundle.json');
const rules=read('data/learning-pool-rules.json');
const prevPm=read('data/daily/2026-09-30-pm.json');
const sameDayAm=read('data/daily/2026-10-01-am.json');

let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name)}
function fakeHistory(ctx){
  return (ctx.history_7d||[]).map(h=>h.session==='am'
    ?{date:h.date,session:'am',review_vocab:h.review_core||[],vocab:[]}
    :{date:h.date,session:'pm',review_vocab:[],vocab:(h.review_core||[]).map(word=>({word,source_group:'review'}))}
  );
}
function cfg(slot){
  return {
    ctx:read('prototype/lesson-engine/fixtures/context-2026-10-01-'+slot+'.json'),
    runtime:read('prototype/lesson-engine/fixtures/runtime-2026-10-01-'+slot+'.json'),
    index:read('prototype/lesson-engine/fixtures/index-2026-10-01-'+slot+'.json')
  };
}
function newWords(lesson){
  return lesson.session==='am'?(lesson.vocab||[]).map(x=>norm(x.word)):(lesson.vocab||[]).filter(x=>x.source_group==='new').map(x=>norm(x.word));
}
function groupWords(lesson,group){
  return lesson.session==='am'
    ?(group==='review'?(lesson.review_vocab||[]).map(norm):[])
    :(lesson.vocab||[]).filter(x=>x.source_group===group).map(x=>norm(x.word));
}
function coverage(lesson,key){return (lesson._prototype?.[key]||[]).map(x=>norm(x.word))}

test('eligible lexicon still exactly covers 283 snapshot candidates',()=>{
  const lex=bundle.materials['eligible-lexicon'].entries;
  const ctx=cfg('pm').ctx;
  const expected=new Set([...ctx.candidates.new_dont,...ctx.candidates.new_fuzzy].map(x=>norm(x[0])));
  const actual=new Set(lex.map(x=>norm(x.word)));
  assert.equal(lex.length,283);
  assert.equal(actual.size,283);
  assert.deepEqual([...actual].sort(),[...expected].sort());
});

test('V4 material bundle and separate sources stay synchronized and exact',()=>{
 const micro=read('prototype/lesson-engine/materials/microcontent.json');
 const situations=read('prototype/lesson-engine/materials/micro-scenes.json');
 const lex=new Set(bundle.materials['eligible-lexicon'].entries.map(e=>e.word));
 assert.deepEqual(bundle.materials.microcontent,micro,'Source microcontent must equal compiled bundle');
 assert.deepEqual(bundle.materials['micro-scenes'],situations,'Scene source must equal compiled bundle');
 assert(Object.keys(micro.entries).length>=120,'V4 requires at least 120 vetted microcontent entries');
 const transferred=Object.entries(micro.entries).filter(([,e])=>e.transfer_example);
 assert(transferred.length>=100,'V4 requires at least 100 independent real-situation sentences');
 for(const [word,e] of transferred){
   assert(hasWord(e.transfer_example,word),'Transfer sentence must contain target '+word);
   assert(String(e.transfer_cn||'').length>=4,'Transfer must have Chinese meaning '+word);
   assert.notEqual(norm(e.transfer_example),norm(e.example),'Transfer cannot repeat teaching example '+word);
 }
 assert(situations.scenes.length>=40,'V4 needs at least 40 paired micro-situations');
 const pairs=new Set();
 for(const p of situations.scenes){
   assert.equal(p.words.length,2);
   assert.equal(p.reading.length,2);
   const key=p.words.slice().sort().join('|');assert(!pairs.has(key),'Duplicate pair: '+key);
   pairs.add(key);
   for(let i=0;i<2;i++){
     assert(lex.has(p.words[i])||Object.hasOwn(micro.entries,p.words[i]),'Scene word unsupported: '+p.words[i]);
     assert(hasWord(p.reading[i].id,p.words[i]),'Paired scene must teach its actual target '+p.id);
     assert(String(p.reading[i].cn||'').length>=4,'Paired scene must have aligned Chinese');
   }
 }
 console.log('V4_MATERIAL_AUDIT '+JSON.stringify({
   microcontent:Object.keys(micro.entries).length,transfer:transferred.length,paired_scenes:situations.scenes.length
 }));
});

test('V4 real afternoon fixture uses rainy-day paired scene and alternate output',()=>{
 const c=cfg('pm'),lesson=core.generate(c.ctx,bundle,dailyRows,{variant:0});
 assert(lesson._prototype.micro_scene_pairs.includes('awan-mengalir'),
   'The PM reading must select genuinely relevant weather pair');
 assert.equal(lesson._prototype.dialogue_micro_scene,'awan-mengalir');
 assert(lesson._prototype.transfer_rewrite_count>=2,'PM must apply independent alternate-context drills');
 assert(lesson.rewrite.some(t=>/换个场景表达/.test(t.task)));
 assert(auditLesson(lesson).ok);
});

for(const slot of ['am','pm']){
  const c=cfg(slot);
  for(let variant=0;variant<6;variant++){
    const name=slot.toUpperCase()+' variant '+(variant+1);
    const lesson=core.generate(c.ctx,bundle,dailyRows,{variant});
    test(name+' formal validator',()=>{
      const result=validate({
        lesson,index:c.index,runtime:c.runtime,rules,
        expectedDate:c.ctx.target.date,expectedSession:slot,
        sameDayAm:slot==='pm'?sameDayAm:null,previousPm:prevPm,
        reviewHistory:fakeHistory(c.ctx)
      });
      assert.equal(result.ok,true,JSON.stringify(result.errors));
    });
    test(name+' instructional quality gate',()=>{
      const quality=auditLesson(lesson);
      assert.equal(quality.ok,true,JSON.stringify(quality.errors));
      assert(quality.metrics.reading_words>=80&&quality.metrics.reading_words<=120);
      assert.equal(quality.metrics.required_new_reading,slot==='am'?6:newWords(lesson).length);
      if(slot==='am')assert(quality.metrics.output_target_count>=2);
      else assert(quality.metrics.dialogue_new_count>=2);
    });
    test(name+' shared engine contract',()=>{
      assert.equal(lesson._prototype.engine_version,2);
      assert.equal(lesson._prototype.production_write,false);
      assert(wc(lesson.reading.text)>=80&&wc(lesson.reading.text)<=120);
      assert((lesson.vocab||[]).every(v=>String(v.formation||'').trim()&&String(v.synonym_note||'').trim()&&hasWord(v.example,v.word)));
      assert(!(lesson.vocab||[]).some(v=>/注意结合语境与常见搭配使用/.test(v.synonym_note)));
      const nws=newWords(lesson),rc=coverage(lesson,'reading_coverage');
      if(slot==='am'){
        assert.equal(nws.length,10);
        assert((lesson.review_vocab||[]).length>=4&&(lesson.review_vocab||[]).length<=6);
        assert.equal(lesson.sentences.length,5);
        assert.equal(lesson.quiz.length,3);
        assert.equal(lesson.review.length,3);
        assert(nws.filter(x=>hasWord(lesson.reading.text,x)).length>=6,'AM reading exact new coverage < 6');
      }else{
        const rw=groupWords(lesson,'review'),aw=groupWords(lesson,'application'),dc=coverage(lesson,'dialogue_coverage');
        assert(nws.length>=3&&nws.length<=4);
        assert(rw.length>=4&&rw.length<=6);
        assert(aw.length>=2&&aw.length<=3);
        assert(lesson.vocab.length>=10&&lesson.vocab.length<=12);
        assert(nws.every(x=>hasWord(lesson.reading.text,x)),'PM reading must cover every exact new word');
        assert(nws.filter(x=>hasWord(lesson.dialogue.lines.map(l=>l.id).join(' '),x)).length>=Math.min(2,nws.length),'PM dialogue new coverage too low');
        assert(lesson.dialogue.lines.length>=4);
        assert(lesson.rewrite.length>=3&&lesson.rewrite.length<=4);
        const q=lesson.daily_test.questions;
        assert.equal(q.length,6);
        assert.equal(q.filter(x=>x.type==='choice').length,3);
        assert.equal(q.filter(x=>x.type==='fill').length,2);
        assert.equal(q.filter(x=>x.type==='order').length,1);
      }
    });
  }
}

test('quality gate explicitly rejects the historical answer/target mismatch',()=>{
 const old=getPublished('data/daily/2026-10-02-am.json');
 const q=auditLesson(old);
 assert.equal(q.ok,false);
 assert(q.errors.some(e=>e.code==='QUALITY_OUTPUT_TARGET_MISMATCH'),
   'Published lesson previously requested 2 new words but used none in answer');
});
test('quality gate blocks semantic regressions instead of just counting JSON fields',()=>{
 const c=cfg('pm'),valid=core.generate(c.ctx,bundle,dailyRows,{variant:0});
 const repeated=JSON.parse(JSON.stringify(valid));
 repeated.dialogue.lines[2].id=repeated.dialogue.lines[0].id;
 assert(auditLesson(repeated).errors.some(e=>e.code==='QUALITY_DIALOGUE_REPETITION'));
 const mislabeled=JSON.parse(JSON.stringify(valid));
 mislabeled.title='18:00 晚课｜Makan siang';
 if(mislabeled._prototype.reading_mode==='thematic-notes')
   assert(auditLesson(mislabeled).errors.some(e=>e.code==='QUALITY_MISLEADING_SCENE_TITLE'));
 const ca=cfg('am'),am=core.generate(ca.ctx,bundle,dailyRows,{variant:0});
 const wrong=JSON.parse(JSON.stringify(am));
 wrong.output.reference_answer='Hari ini saya akan istirahat lebih banyak. Kalau situasinya berubah, saya akan pulang.';
 assert(auditLesson(wrong).errors.some(e=>e.code==='QUALITY_OUTPUT_TARGET_MISMATCH'));
});
test('V4 actively refuses fake transfer metadata and target-free evening rewrites',()=>{
 const am=core.generate(cfg('am').ctx,bundle,dailyRows,{variant:0});
 assert(am._prototype.transfer_output_count>=1,'AM fixture must exercise alternate-context output');
 const invalidAm=JSON.parse(JSON.stringify(am));
 invalidAm._prototype.transfer_output_count=10;
 assert(auditLesson(invalidAm).errors.some(e=>e.code==='QUALITY_OUTPUT_TRANSFER_FALSE'));
 const pm=core.generate(cfg('pm').ctx,bundle,dailyRows,{variant:0});
 assert(pm._prototype.dialogue_contextual_review===true,'PM dialogue should reuse related learned language');
 assert(pm.dialogue.lines.some(x=>hasWord(x.id,'biarpun')),'PM third turn should retain the relevant learned concessive');
 const wrong=JSON.parse(JSON.stringify(pm));
 wrong.rewrite[0].reference_answer='Hari ini saya ingin pulang saja.';
 assert(auditLesson(wrong).errors.some(e=>e.code==='QUALITY_REWRITE_TARGET_MISMATCH'));
 const fakeTransfer=JSON.parse(JSON.stringify(pm));
 fakeTransfer._prototype.transfer_rewrite_count=10;
 assert(auditLesson(fakeTransfer).errors.some(e=>e.code==='QUALITY_REWRITE_TRANSFER_FALSE'));
});
test('alternate real-candidate order remains publishable and educationally matched',()=>{
 const c=cfg('am'),ctx=JSON.parse(JSON.stringify(c.ctx));
 const preferred=['sepenuhnya','sembuh','menyentuh','bersinar','tindakan','kisah','ditemukan','sebelah','peristiwa','daya'];
 const priority=new Map(preferred.map((x,i)=>[x,i]));
 ctx.candidates.new_dont.sort((a,b)=>(priority.get(a[0])??999)-(priority.get(b[0])??999));
 for(const variant of [0,1,2,3,4,5]){
   const lesson=core.generate(ctx,bundle,dailyRows,{variant});
   const q=auditLesson(lesson);
   assert(q.ok,variant+' '+JSON.stringify(q.errors));
   assert(lesson.title.includes('Beberapa catatan sehari-hari')||
     lesson._prototype.reading_mode==='single-scene');
 }
});
function getPublished(p){return read(p)}

test('V4 diverse legal candidate orders include forty-eight contexts with six bounded variants',()=>{
 const shifts=[0,1,2,3,4,5,6,7,9,11,13,15,18,21,24,27,30,36,42,48,54,60,72,105];
 const rotate=(items,n)=>items.length?items.slice(n%items.length).concat(items.slice(0,n%items.length)):[];
 for(const slot of ['am','pm']){
   const c=cfg(slot);
   for(const shift of shifts){
     const ctx=JSON.parse(JSON.stringify(c.ctx));
     ctx.candidates.new_dont=rotate(ctx.candidates.new_dont,shift);
     ctx.candidates.new_fuzzy=rotate(ctx.candidates.new_fuzzy,shift);
     let good=0;
     const failures=[];
     for(let variant=0;variant<6;variant++){
       try{
         const lesson=core.generate(ctx,bundle,dailyRows,{variant});
         const q=auditLesson(lesson);
         const v=validate({lesson,index:c.index,runtime:c.runtime,rules,
           expectedDate:ctx.target.date,expectedSession:slot,
           sameDayAm:slot==='pm'?sameDayAm:null,previousPm:prevPm,
           reviewHistory:fakeHistory(ctx)});
         if(q.ok&&v.ok)good++;
         else failures.push({variant,quality:q.errors,formal:v.errors});
       }catch(e){failures.push({variant,error:String(e.message||e)})}
     }
     assert(good>0,slot+' offset '+shift+' has no viable V2 candidate: '+JSON.stringify(failures));
   }
 }
 console.log('V4_STRESS '+JSON.stringify({contexts:shifts.length*2,slots:2,max_variants:6,all_have_valid_output:true}));
});

test('CLI wrapper delegates to same shared core',()=>{
  const c=cfg('pm'),a=core.generate(c.ctx,bundle,dailyRows,{variant:0}),b=wrapper.generate(c.ctx,{variant:0});
  assert.deepEqual(b,a);
});

test('preview is read-only and loads shared core',()=>{
  const html=fs.readFileSync(path.join(REPO,'prototype/lesson-engine/preview.html'),'utf8');
  const js=fs.readFileSync(path.join(REPO,'prototype/lesson-engine/preview.js'),'utf8').toLowerCase();
  assert(html.includes('./engine/core.js'));
  assert(!js.includes("method:'post'")&&!js.includes('method:"post"'));
  assert(!js.includes("method:'put'")&&!js.includes('method:"put"'));
  assert(!js.includes("method:'delete'")&&!js.includes('method:"delete"'));
  assert(!js.includes('api.github.com'));
  assert(!js.includes('localstorage')&&!js.includes('indexeddb'));
});

test('missing historical new-word bands fail clearly, never as a TypeError',()=>{
  const ctx=JSON.parse(JSON.stringify(cfg('am').ctx));
  ctx.candidates.new_dont=[];ctx.candidates.new_fuzzy=[];
  assert.throws(()=>core.generate(ctx,bundle,dailyRows,{variant:0}),/LESSON_NEW_POOL_INSUFFICIENT/);
});

test('Unicode exact matching supports hyphens and rejects derived-form false positives',()=>{
  assert(hasWord('Dia bicara seolah-olah sudah tahu.', 'seolah-olah'));
  assert(hasWord('Hujan turun terus-menerus sejak siang.', 'terus-menerus'));
  assert(hasWord('Saya lupa kata sandi akun.', 'kata sandi'));
  assert(!hasWord('Apa gunanya laporan ini?', 'guna'));
});

console.log('PROTOTYPE_V2_TEST '+JSON.stringify({ok:true,passed,variants:12,engine_version:2}));
