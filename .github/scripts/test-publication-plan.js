#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {plan}=require('./plan-lesson-publication');
const {makeAm,makePm}=require('./test-lesson-candidate');
const clone=x=>JSON.parse(JSON.stringify(x));
const head='a'.repeat(40);
let count=0;
function pass(label,fn){fn();count++;console.log('PASS '+label)}
function input(make){return {...make(),mainHead:head}}
function ready(make){const value=input(make),prior=JSON.stringify(value),p=plan(value);assert.equal(p.ok,true,JSON.stringify(p.errors));assert.equal(p.status,'ready');assert.equal(p.files.length,2);assert.equal(p.files[0].path,'data/daily/'+value.expectedDate+'-'+value.expectedSession+'.json');assert.equal(p.files[1].path,'data/daily/index.json');assert.equal(JSON.stringify(value),prior,'planning must be read-only');return {p,value}}
pass('AM plan is exact atomic two-file payload',()=>{const {p,value}=ready(makeAm),i=JSON.parse(p.files[1].content);assert.deepEqual(i.dates.at(-1).am,true);assert.equal(i.dates.at(-1).am_status,'generated');assert.equal(i.updated,value.expectedDate)});
pass('PM plan preserves published AM and only marks PM',()=>{const {p,value}=ready(makePm),i=JSON.parse(p.files[1].content);assert.equal(i.dates.at(-1).am,true);assert.equal(i.dates.at(-1).pm,true);assert.equal(i.dates.at(-1).pm_status,'lesson_complete');assert.equal(i.dates.at(-1).am_status,undefined);assert.equal(i.updated,value.expectedDate)});
pass('AM canonical content is not rewritten by planner',()=>{const {p,value}=ready(makeAm);assert.deepEqual(JSON.parse(p.files[0].content),value.lesson)});
pass('PM canonical content is not rewritten by planner',()=>{const {p,value}=ready(makePm);assert.deepEqual(JSON.parse(p.files[0].content),value.lesson)});
pass('Missing pinned main head blocks',()=>{const v=input(makeAm);v.mainHead='';assert.equal(plan(v).errors[0].code,'MAIN_HEAD_REQUIRED')});
pass('Invalid pinned main head blocks',()=>{const v=input(makeAm);v.mainHead='refs/heads/main';assert.equal(plan(v).errors[0].code,'MAIN_HEAD_REQUIRED')});
pass('Stale runtime fails before publish',()=>{const v=input(makeAm);v.runtime.lesson_watermark='2026-09-26 18:00';assert.equal(plan(v).status,'blocked');assert.equal(plan(v).files,undefined)});
pass('Malformed content fails before publish',()=>{const v=input(makePm);delete v.lesson.dialogue;assert.equal(plan(v).status,'blocked')});
pass('Unknown lesson word fails before publish',()=>{const v=input(makeAm);v.lesson.vocab[0].word='not-eligible';assert.equal(plan(v).status,'blocked')});
pass('Already complete but different content refuses overwrite',()=>{const v=input(makeAm);v.index.dates.at(-1).am=true;assert.equal(plan(v).errors[0].code,'ALREADY_PUBLISHED')});
pass('Already complete with identical content is no-op',()=>{const v=input(makeAm);v.index.dates.at(-1).am=true;v.publishedLesson=clone(v.lesson);const p=plan(v);assert.equal(p.status,'already_published');assert.deepEqual(p.files,[])});
pass('Index day conflict stops draft',()=>{const v=input(makePm);v.index.dates.at(-1).day=99;const p=plan(v);assert.equal(p.errors[0].code,'DAY_MISMATCH')});
pass('No third file or daily-vocab writer',()=>{const {p}=ready(makePm);assert.deepEqual(p.files.map(f=>f.path),['data/daily/2026-09-28-pm.json','data/daily/index.json'])});
pass('Output carries current SHA, candidate and baseline hashes',()=>{const {p}=ready(makeAm);assert.equal(p.mainHead,head);assert.match(p.candidateHash,/^[0-9a-f]{64}$/);assert.match(p.baselineFingerprint,/^[0-9a-f]{64}$/);assert.equal(p.requiresFreshMain,true);assert.equal(p.requiresSuccessfulReleasePreflight,true)});
console.log('Stage 2 publication plan:',count,'passed, 0 failed');
