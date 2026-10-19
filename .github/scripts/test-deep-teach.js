const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const {validateTeach}=require('./validate-teach');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8'),json=p=>JSON.parse(read(p));
const source=read('data/deep-teach.js');
const sandbox={window:{},document:{addEventListener(){}},console};
vm.runInNewContext(source,sandbox);const D=sandbox.window.DeepTeach;
const copy=x=>JSON.parse(JSON.stringify(x));
let n=0;function test(label,fn){fn();n++;console.log('PASS '+label)}
const fixtures=['2026-10-19-am','2026-10-18-pm'].map(id=>({id,L:json(`data/daily/${id}.json`),T:json(`data/teach/${id}.json`)}));
for(const {id,L,T} of fixtures)test(id+' validates and has a safe runtime shape',()=>{assert.deepEqual(validateTeach(L,T).errors,[]);assert.equal(D.validateShape(T,L),true)});
test('validator returns diagnostics for malformed input instead of throwing',()=>{for(const t of [null,[],{}, {items:{}}])assert(validateTeach(fixtures[0].L,t).errors.length>0)});
const {L,T}=fixtures[0];
function broken(code,change){test('corruption: '+code,()=>{const t=copy(T);change(t);assert(validateTeach(L,t).errors.some(e=>e.startsWith(code+' ')),code)})}
broken('SCENE_QUOTE',t=>{t.items[0].scene.quotes[0].id='Kalimat ini tidak ada dalam pelajaran.'});
broken('CHECK_RIGHT',t=>{t.items[0].check.options.forEach(o=>o.v='right')});
broken('CHECK_WHY',t=>{t.items[0].check.options[0].why=[]});
broken('CHECK_OK_REASON',t=>{const o=t.items[0].check.options[0];o.v='ok';o.why=['这里的语义不符合题目的要求。']});
broken('RECALL_NOT_NEW',t=>{t.items[0].recall.ref=L.reading.text});
broken('SAY_SKEL_REF',t=>{t.items[0].say.skel='TidakAdaDalamReferensi ____.'});
broken('READING_CHUNKS',t=>{t.reading[0].chunks[0][0]='potongan yang salah'});
broken('MARKUP',t=>{t.intro.push('{{tidak ditutup')});
broken('ITEM_MISSING',t=>{t.items.pop()});
test('shape rejects missing and malformed nested fields without throwing',()=>{
 for(const value of [null,{},[],{items:[{}]}])assert.equal(D.validateShape(value,L),false);
 for(const change of [t=>delete t.items[0].scene,t=>delete t.items[0].check,t=>delete t.items[0].say,t=>delete t.items[0].final,t=>t.items[0].check.options[0].why='oops',t=>t.tasks={},t=>t.reading[0].chunks=[null],t=>t.items[1].key=t.items[0].key]){const t=copy(T);change(t);assert.equal(D.validateShape(t,L),false)}
});
test('recall needs TWO completed intervening units; is pure; capped at two attempts',()=>{
 const queue=[{key:'x',at:2,tries:0},{key:'second',at:2,tries:1},{key:'done',at:0,tries:0,done:true},{key:'capped',at:0,tries:2}];const before=JSON.stringify(queue);
 assert.equal(D.dueRecalls(queue,3).length,0);assert.deepEqual(Array.from(D.dueRecalls(queue,4),r=>r.key),['x','second']);assert.equal(JSON.stringify(queue),before);
 const retry=[{key:'x',at:4,tries:1}];assert.equal(D.dueRecalls(retry,5).length,0);assert.equal(D.dueRecalls(retry,6).length,1);
 assert(source.includes('at:S.pos+1,tries:0'));assert(source.includes('r.tries<1'));assert(source.includes('at:S.pos,tries:1'));
});
test('classification distinguishes independent, prompted, partial and unvisited items',()=>{
 const items=[{key:'a'},{key:'b'},{key:'c'},{key:'d'},{key:'e'}];
 const log={checks:{a:'right',b:'right',c:'wrong',d:'right'},backup:{c:'right'},say:{a:{rate:'yes',hinted:false},b:{rate:'yes',hinted:true},c:{rate:'part',hinted:false},d:{rate:'yes',hinted:false}},recall:{d:[{rate:'yes',hinted:true}]},final:{a:'fast',b:'fast',c:'slow',d:'fast'}};
 const before=JSON.stringify(log),r=D.classify(log,items);
 assert.deepEqual(Array.from(r.good,x=>x.it.key),['a']);assert.deepEqual(Array.from(r.weak,x=>x.it.key),['b','c','d','e']);assert(r.weak[0].r.some(x=>x.includes('提示')));assert(r.weak[2].r.some(x=>x.includes('隔时回想')));assert.equal(JSON.stringify(log),before);
});
test('markup escapes HTML/attributes before adding only supported tags',()=>{
 const html=D.md('<img src=x onerror="evil()"> {{a" onmouseover="evil()}} [[词]] **重点**\n下一行');
 assert(!html.includes('<img'));assert(!html.includes('data-say="a"'));assert(html.includes('&lt;img'));assert(html.includes('class="spk"'));assert(html.includes('<b>重点</b>'));assert(html.includes('<br>下一行'));assert.equal(D.md(null),'');assert(D.md('**{{uji}}**').includes('<b><span class="id">uji'));assert(!D.md('**<script>evil()</script>**').includes('<script>'));
});
test('no persistent records, data writers, external fonts or unscoped document listeners',()=>{
 assert(!/localStorage|sessionStorage|indexedDB|recordLessonWrong|markMastered|indo_lesson_recall_v1|indo_automation_training_state_v1|WeaknessPool|LessonRecall|TrainingSync/.test(source));
 assert(!/fonts\.google|@import|MutationObserver/.test(source));assert(source.includes("overlay.addEventListener('click'"));
});
(async()=>{
 const without=copy(L);delete without.lesson_focus.teach;
 test('direct open safely rejects invalid data before touching the DOM',()=>assert.equal(D.open(L,{}),false));
 let count=0;const notFound=async()=>{count++;return {status:404}};
 assert.equal((await D.selectTeach(without,notFound)).mode,'legacy');assert.equal(count,1);n++;
 assert.equal((await D.selectTeach(without,async()=>({ok:true,json:async()=>T}))).mode,'deep');n++;
 const embedded=copy(L);embedded.lesson_focus.teach=T;
 assert.equal((await D.selectTeach(embedded,()=>{throw Error('embedded data must not fetch')})).mode,'deep');n++;
 embedded.lesson_focus.teach={};assert.equal((await D.selectTeach(embedded,notFound)).mode,'legacy');n++;
 assert.equal((await D.selectTeach(without,async()=>({ok:true,json:async()=>({})}))).mode,'legacy');n++;
 assert.equal((await D.selectTeach(without,async()=>{throw Error('offline')})).mode,'legacy');n++;
 console.log(`PASS ${n} deep-teach tests (including absent/invalid/offline fallback and embedded precedence)`);
})().catch(e=>{console.error(e);process.exitCode=1});
