#!/usr/bin/env node
'use strict';
const assert=require('assert/strict'),fs=require('fs');
const {buildLesson}=require('./build-lesson-json');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const clone=x=>JSON.parse(JSON.stringify(x));
const am=read('data/daily/2026-09-28-am.json');
const pm=read('data/daily/2026-09-27-pm.json');
let pass=0;
function ok(name,fn){fn();pass++;console.log('PASS assembly: '+name)}
function bad(name,obj,code){ok(name,()=>assert.throws(()=>buildLesson(obj),e=>e.code===code,e=>e.message))}
ok('real published AM JSON round trip unchanged',()=>assert.deepEqual(buildLesson(am),am));
ok('real published PM JSON round trip unchanged',()=>assert.deepEqual(buildLesson(pm),pm));
ok('existing published AM vocab/review/reading/answers remain authored',()=>{
 const out=buildLesson(am);
 assert.deepEqual(out.vocab.map(x=>x.word),am.vocab.map(x=>x.word));
 assert.deepEqual(out.review_vocab,am.review_vocab);
 assert.deepEqual(out.reading,am.reading);
 assert.deepEqual(out.quiz.map(q=>q.answer_index),am.quiz.map(q=>q.answer_index));
});
ok('reproduce actual 2026-09-28 AM missing presentation fields and PM-style sentence and question aliases',()=>{
 const input=clone(am);
 input.vocab.forEach(v=>{delete v.display;delete v.audio_text});
 input.sentences.forEach(x=>{x.id=x.text;delete x.text});
 input.quiz.forEach(q=>{q.prompt=q.question;delete q.question});
 const original=clone(input),result=buildLesson(input);
 assert.deepEqual(result,am);
 assert.deepEqual(input,original); // no mutation of input
});
ok('PM line and choice aliases restored to PM rather than accidentally using AM keys',()=>{
 const input=clone(pm);
 input.dialogue.lines.forEach(l=>{l.text=l.id;delete l.id});
 input.daily_test.questions.filter(q=>q.type==='choice').forEach(q=>{q.question=q.prompt;delete q.prompt});
 assert.deepEqual(buildLesson(input),pm);
});
ok('authored correct option mechanically fills missing redundant answer string',()=>{
 const input=clone(am);delete input.quiz[0].answer;
 const out=buildLesson(input);
 assert.equal(out.quiz[0].answer,am.quiz[0].options[am.quiz[0].answer_index]);
});
{const x=clone(am);x.quiz[2]={type:'fill',prompt:'填空：___',answer:'sia-sia',explain:'解释'};bad('AM fill is rejected rather than inventing multiple-choice distractors',x,'ASSEMBLY_QUESTION_TYPE')}
{const x=clone(am);x.quiz[0].answer_index=999;bad('cannot invent answer index',x,'ASSEMBLY_ANSWER_INVALID')}
{const x=clone(am);x.quiz[0].answer='incorrect';bad('cannot silently rewrite authored wrong answer',x,'ASSEMBLY_ANSWER_MISMATCH')}
{const x=clone(am);x.sentences[0].id='Different sentence';bad('conflicting text/id aliases rejected',x,'ASSEMBLY_AMBIGUOUS_ALIAS')}
{const x=clone(am);x.vocab[0].display='';bad('explicitly empty presentation field not silently changed',x,'ASSEMBLY_CONTENT_MISSING')}
{const x=clone(pm);x.dialogue=x.dialogue.lines;bad('PM dialogue requires title and lines container',x,'ASSEMBLY_INPUT_INVALID')}
{const x=clone(pm);x.daily_test.questions[0].answer='invalid';bad('PM answer inconsistency rejected',x,'ASSEMBLY_ANSWER_MISMATCH')}
{const x=clone(pm);x.vocab[0].source_group='review';ok('assembler does not guess or rewrite PM semantic source group',()=>assert.equal(buildLesson(x).vocab[0].source_group,'review'))}
{const x=clone(am);x.vocab[0].cn='';ok('unwritten human translation is not invented',()=>assert.equal(buildLesson(x).vocab[0].cn,''))}
{const x=clone(am);ok('real validator remains required when validation context is supplied',()=>assert.throws(()=>buildLesson(x,{index:{dates:[]},runtime:{},rules:{}}),e=>e.code==='ASSEMBLY_VALIDATION_FAILED'))}
console.log('Experimental lesson assembler:',pass+' passed, 0 failed');
module.exports={pass};
