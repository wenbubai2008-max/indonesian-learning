#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

const REPO=path.resolve(__dirname,'../../..');
const core=require('./core.js');
const wrapper=require('./generate-prototype.js');
const {validate}=require(path.join(REPO,'.github/scripts/validate-lesson-candidate.js'));

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
