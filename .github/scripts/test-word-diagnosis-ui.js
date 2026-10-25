#!/usr/bin/env node
'use strict';
// 2026-10-25 profile redesign step B1: the home card and the detail section show per-layer COVERAGE first (how many words were
// actually tested), never present an untested layer as "no problem", escape word text, stay read-only and read storage once.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const repo=path.resolve(__dirname,'..','..');
const UI=require(path.join(repo,'data/word-diagnosis-ui.js'));
const NOW=Date.parse('2026-10-25T05:00:00Z'),DAY=86400000;
let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS '+name)};
const model=(over={})=>Object.assign({taught:928,excluded:49,summary:{words:920,excluded:49,types:{meaning:5,listening:8,production:4,forgetting:4,unclear:8,recognized:637,insufficient:254},tested:{recognition:917,listening:24,production:48,self_report:99},recovered_30d:46,items:[]},items:[],cnOf:()=>''},over);
const item=(word,type,conf,records,extra={})=>Object.assign({word,type,label:type,secondary:[],confidence:conf,evidence:['快速练习（看印尼语选中文）：答对 1 次、答错 4 次'],records,days:3},extra);

t('home card: three layers with tested / trainable counts, problems only where evidence exists, button id kept',()=>{
  const h=UI.homeCardHTML(model());
  assert.match(h,/已教 928 个词/);assert.match(h,/id="openVocabProfile"/);
  for(const l of ['认得','听得懂','说得出来'])assert.ok(h.includes('>'+l+'<'),l);
  assert.match(h,/<b>917<\/b> \/ 879<em>5 有问题<\/em>/,'denominator = taught − excluded');
  assert.match(h,/<b>24<\/b> \/ 879<em>8 有问题<\/em>/);assert.match(h,/<b>48<\/b> \/ 879<em>4 有问题<\/em>/);
});
t('home card: the low-coverage note names the real numbers and disappears once listening AND production reach half',()=>{
  assert.match(UI.homeCardHTML(model()),/听和说的证据很少：只测过 24、48 个词。其余词只证明“认得”。/);
  const full=model();full.summary.tested={recognition:870,listening:500,production:450,self_report:0};
  assert.doesNotMatch(UI.homeCardHTML(full),/vdNote/);
  const onlyListen=model();onlyListen.summary.tested={recognition:870,listening:10,production:600,self_report:0};
  assert.match(UI.homeCardHTML(onlyListen),/听得懂的证据很少：只测过 10 个词/);
  const onlyProd=model();onlyProd.summary.tested={recognition:870,listening:600,production:10,self_report:0};
  assert.match(UI.homeCardHTML(onlyProd),/说得出来的证据很少：只测过 10 个词/);
});
t('an untested layer is "还没测", a tested layer without problems says so (never silently green)',()=>{
  const m=model();m.summary.types={};m.summary.tested={recognition:800,listening:0,production:30,self_report:0};
  const h=UI.homeCardHTML(m);
  assert.match(h,/<b>0<\/b> \/ 879<span class="vdNone">还没测<\/span>/);
  assert.match(h,/<b>30<\/b> \/ 879<span class="vdOk">没发现问题<\/span>/);
});
t('no training records on this device → an explanation instead of zeros',()=>{
  const h=UI.homeCardHTML(model({summary:{words:0,excluded:0,types:{},tested:{recognition:0,listening:0,production:0,self_report:0},recovered_30d:0,items:[]}}));
  assert.match(h,/这台设备还没有训练记录/);assert.doesNotMatch(h,/vdRow/);assert.match(h,/id="openVocabProfile"/);
});
t('detail: groups follow the fixed order, sort by confidence then records, cap at 15 with a remainder, escape text',()=>{
  const items=[item('biasa','listening','low',3),item('<img src=x onerror=1>','meaning','high',9,{secondary:['forgetting']}),item('kebutuhan','production','medium',5)];
  for(let i=0;i<17;i++)items.push(item('w'+String(i).padStart(2,'0'),'forgetting','medium',4));
  const h=UI.detailHTML(model({items,cnOf:w=>w==='kebutuhan'?'需求<b>':''}));
  const at=g=>h.indexOf('<summary>'+g);
  assert.ok(at('意思记不住')>-1&&at('意思记不住')<at('听不出来')&&at('听不出来')<at('说不出来')&&at('说不出来')<at('反复遗忘'));
  assert.doesNotMatch(h,/<img/);assert.match(h,/&lt;img src=x onerror=1&gt;/);assert.match(h,/需求&lt;b&gt;/);
  assert.match(h,/还没有|还有 2 个/);assert.equal((h.match(/class="vdItem"/g)||[]).length,1+1+1+15);
  assert.match(h,/也有：反复遗忘/);assert.match(h,/近 30 天：之前答错过、现在已掌握 <b>46<\/b> 个/);
  assert.match(h,/认得没问题、但听词或自动训练还没测：637 个/);assert.match(h,/记录不足（少于 3 次）：254 个/);assert.match(h,/已选择不再训练：49 个/);
});
t('detail: "原因待确认" starts collapsed, problem groups start open; empty groups are not rendered',()=>{
  const h=UI.detailHTML(model({items:[item('a','meaning','high',5),item('b','unclear','low',3)]}));
  assert.match(h,/<details class="vdGroup" open><summary>意思记不住/);assert.match(h,/<details class="vdGroup"><summary>原因待确认/);
  assert.doesNotMatch(h,/听不出来 <b>/);
  assert.match(UI.detailHTML(model({items:[]})),/目前没有发现需要单独处理的词/);
});
t('browser wrapper: reads the stored records once (memoised), writes nothing, falls back to "" when the diagnosis module is missing',()=>{
  const reads=[],writes=[],store={
    indo_quick_practice_state:{berjemur:{right:1,wrong:4,last_result:'wrong',last:NOW-DAY,last_wrong:NOW-DAY,last_right:NOW-9*DAY},kebutuhan:{right:5,wrong:0,last_result:'right',last:NOW-DAY,last_right:NOW-DAY}},
    indo_automation_training_state_v1:{kebutuhan:{attempts:5,failures:3,successes:2,fail_streak:2,last_result:'fail',status:'active',last_at:NOW-3600000}},
    indo_weak_pool_v1:{},indo_lesson_recall_v1:{words:{}},indo_listen_stats_v1:{}};
  const win={localStorage:{getItem:k=>{reads.push(k);return k in store?JSON.stringify(store[k]):null},setItem:k=>writes.push(k),removeItem:k=>writes.push(k)},DAILY_VOCAB_DB:[{word:'berjemur',cn:'晒太阳'},{word:'kebutuhan',cn:'需求'}]};
  win.window=win;
  vm.runInNewContext(fs.readFileSync(path.join(repo,'data/word-diagnosis.js'),'utf8'),win);
  vm.runInNewContext(fs.readFileSync(path.join(repo,'data/word-diagnosis-ui.js'),'utf8'),win);
  const data={taught_total:928,excluded_from_training:49};
  const a=win.WordDiagnosisUI.homeCard(data),b=win.WordDiagnosisUI.detail(data),once=reads.length;
  assert.match(a,/认得/);assert.match(b,/晒太阳/);assert.match(b,/需求/);
  win.WordDiagnosisUI.homeCard(data);win.WordDiagnosisUI.detail(data);
  assert.equal(reads.length,once,'second render inside the memo window reads nothing');
  assert.deepEqual(writes,[]);
  const bare={localStorage:win.localStorage};bare.window=bare;
  vm.runInNewContext(fs.readFileSync(path.join(repo,'data/word-diagnosis-ui.js'),'utf8'),bare);
  assert.equal(bare.WordDiagnosisUI.homeCard(data),'');
});
t('source stays read-only: no storage writes, no observers, no network',()=>{
  assert.doesNotMatch(fs.readFileSync(path.join(repo,'data/word-diagnosis-ui.js'),'utf8'),/setItem|removeItem|localStorage\.(set|remove|clear)|MutationObserver|fetch\(|XMLHttpRequest/);
});
console.log('Word diagnosis UI tests passed: '+n);
