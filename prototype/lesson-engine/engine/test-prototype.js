#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {generate,loadMaterials}=require('./generate-prototype');
const REPO=path.resolve(__dirname,'../../..');
const read=p=>JSON.parse(fs.readFileSync(path.join(REPO,p),'utf8'));
const norm=x=>String(x||'').trim().toLowerCase();
const wc=x=>String(x||'').trim().split(/\s+/).filter(Boolean).length;
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name)}

const ctx=read('data/lesson-context.json');
const M=loadMaterials();

test('curated lexicon covers every current legal dont+fuzzy word',()=>{
  const expected=new Set([...ctx.candidates.new_dont,...ctx.candidates.new_fuzzy].map(x=>norm(x[0])));
  const files=[];
  for(let i=1;i<=6;i++)files.push(JSON.parse(fs.readFileSync(path.join(REPO,'prototype/lesson-engine/materials/lexicon/eligible-0'+i+'.json'),'utf8')));
  const rows=files.flatMap(x=>x.entries),actual=new Set(rows.map(x=>norm(x.word)));
  assert.equal(rows.length,actual.size,'curated lexicon must not contain duplicate word identities');
  const missing=[...expected].filter(x=>!actual.has(x));
  assert.deepEqual(missing,[],'newly legal words need curated content before generation');
  for(const e of rows){
    for(const k of ['word','cn','en','root','root_cn','register','example','example_cn','note'])assert(String(e[k]||'').trim(),e.word+' missing '+k);
    assert(Array.isArray(e.tags)&&e.tags.length,e.word+' missing tags');
  }
});

test('scene bilingual arrays stay aligned',()=>{
  for(const s of M.scenes.scenes){
    const c=M.sceneCn.scenes[s.id];assert(c,'missing translation '+s.id);
    assert.equal(c.openings.length,s.openings.length,s.id+' openings');
    assert.equal(c.moves.length,s.moves.length,s.id+' moves');
    assert.equal(c.closing.length,s.closing.length,s.id+' closing');
    for(const move of s.dialogue||[])assert(M.language.dialogue_moves[move]?.length,'missing dialogue move '+move);
  }
});

const lesson=generate(ctx);
test('prototype identity matches context',()=>{
  assert.equal(lesson.date,ctx.target.date);assert.equal(lesson.session,ctx.target.session);assert.equal(lesson.time,ctx.target.time);assert.equal(lesson.day,ctx.target.day);
  assert.equal(lesson._prototype.production_write,false);
});
test('reading remains 80-120 Indonesian words',()=>assert(wc(lesson.reading.text)>=80&&wc(lesson.reading.text)<=120,'reading words='+wc(lesson.reading.text)));
test('core vocabulary is unique',()=>{
  const ws=lesson.vocab.map(x=>norm(x.word));assert.equal(new Set(ws).size,ws.length);
});
test('no low-quality placeholder cards are used',()=>{
  for(const v of lesson.vocab){
    assert(!/^—$/.test(v.en||''),v.word+' bad en');
    assert(!/正在日常语境中学习/.test(v.example_cn||''),v.word+' placeholder example');
    for(const k of ['display','audio_text','cn','en','formation','example','example_cn','synonym_note'])assert(String(v[k]||'').trim(),v.word+' missing '+k);
  }
});

if(ctx.target.session==='pm'){
  test('PM group counts and memory bands',()=>{
    const groups={new:lesson.vocab.filter(x=>x.source_group==='new'),review:lesson.vocab.filter(x=>x.source_group==='review'),application:lesson.vocab.filter(x=>x.source_group==='application')};
    assert(groups.new.length>=3&&groups.new.length<=4);
    assert(groups.review.length>=4&&groups.review.length<=6);
    assert(groups.application.length>=2&&groups.application.length<=3);
    const f=new Set(ctx.candidates.new_fuzzy.map(x=>norm(x[0]))),d=new Set(ctx.candidates.new_dont.map(x=>norm(x[0]))),oral=new Set(ctx.candidates.oral.map(x=>norm(x[0])));
    const nws=groups.new.map(x=>norm(x.word));
    if(f.size>=2&&d.size>=1){assert(nws.filter(x=>f.has(x)).length>=2);assert(nws.some(x=>d.has(x)))}
    if([...oral].some(x=>f.has(x)||d.has(x)))assert(groups.new.some(x=>x.is_oral_new),'eligible oral missing');
  });
  test('PM dialogue/rewrite/test shape',()=>{
    assert(lesson.dialogue.lines.length>=4);
    assert(lesson.rewrite.length>=3&&lesson.rewrite.length<=4);
    const q=lesson.daily_test.questions;
    assert.equal(q.length,6);assert.equal(q.filter(x=>x.type==='choice').length,3);assert.equal(q.filter(x=>x.type==='fill').length,2);assert.equal(q.filter(x=>x.type==='order').length,1);
  });
} else {
  test('AM exact 10 and dont-first',()=>{
    assert.equal(lesson.vocab.length,10);
    const d=new Set(ctx.candidates.new_dont.map(x=>norm(x[0])));
    if(d.size>=10)assert(lesson.vocab.every(x=>d.has(norm(x.word))));
  });
}

test('production validator accepts current prototype candidate',()=>{
  const {validate,collectReviewHistory}=require(path.join(REPO,'.github/scripts/validate-lesson-candidate.js'));
  const index=read('data/daily/index.json'),runtime=read('data/learning-runtime.json'),rules=read('data/learning-pool-rules.json');
  const date=ctx.target.date,prev=new Date(Date.parse(date+'T00:00:00Z')-86400000).toISOString().slice(0,10);
  const load=p=>read(p);
  const result=validate({
    lesson,index,runtime,rules,expectedDate:date,expectedSession:ctx.target.session,
    sameDayAm:fs.existsSync(path.join(REPO,'data/daily/'+date+'-am.json'))?read('data/daily/'+date+'-am.json'):null,
    previousPm:fs.existsSync(path.join(REPO,'data/daily/'+prev+'-pm.json'))?read('data/daily/'+prev+'-pm.json'):null,
    reviewHistory:collectReviewHistory(index,date,ctx.target.session,load)
  });
  assert.equal(result.ok,true,JSON.stringify(result.errors));
});

console.log('PROTOTYPE_TEST '+JSON.stringify({ok:true,passed,target:ctx.target,scene:lesson._prototype.scene_id,new_words:lesson.new_words,reading_words:wc(lesson.reading.text)}));
