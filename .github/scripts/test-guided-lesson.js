'use strict';
// 2026-10-18: 带学模式 step plan — built only from the lesson's own content, AM and PM differ, and it writes nothing
// but its own progress key.
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..','..'),src=fs.readFileSync(path.join(repo,'data','guided-lesson.js'),'utf8');
const store=new Map(),win={DAILY_VOCAB_DB:[{word:'rev1',cn:'复习词',example:'Ini rev1.',example_cn:'这是。'}]};
const doc={addEventListener(){},getElementById:()=>null,createElement:()=>({}),head:{appendChild(){}},querySelector:()=>null};
vm.runInNewContext(src,{window:win,document:doc,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},navigator:{},Intl,Date,JSON,Math,Set,Map,Array,Object,String,Number,setTimeout,clearInterval,setInterval},{filename:'guided-lesson.js'});
const G=win.GuidedLesson;
const read=f=>JSON.parse(fs.readFileSync(path.join(repo,'data','daily',f),'utf8'));
const am=read('2026-10-18-am.json'),pm=read('2026-10-18-pm.json');
// Lessons without lesson_focus get no guided mode.
assert.equal(G.buildSteps(am,null).length,0,'no lesson_focus → no guided mode (10-18 AM predates the requirement)');
// PM: real lesson with focus.
const amF=Object.assign({},am,{lesson_focus:{words:['ramping','keriting','uban'],patterns:[]}});
const s=G.buildSteps(pm,amF),types=Array.from(s.map(x=>x.type));
assert.deepEqual(types,['amcheck','overview','word','word','word','rest','dialogue','pattern','pattern','reading','finish'],'PM flow');
assert.deepEqual(Array.from(s[0].items.map(i=>i.w)),['ramping','keriting','uban'],'PM starts with this morning\'s focus');
const words=new Set(pm.vocab.map(v=>v.word));
s.filter(x=>x.type==='word').forEach(w=>{assert.ok(words.has(w.w));assert.ok(w.cn,'meaning comes from the lesson card')});
assert.equal(s.find(x=>x.type==='rest').items.length,pm.vocab.length-3,'other words = the rest of the lesson cards');
const d=s.find(x=>x.type==='dialogue');assert.ok(d.turns.every(t=>pm.dialogue.lines.some(l=>l.id===t.id)),'dialogue turns are the lesson lines');
assert.ok(d.turns.some(t=>t.speaker===d.me));
const r=s.find(x=>x.type==='reading');assert.equal(r.text,pm.reading.text);assert.ok(r.marks.length>=1&&r.marks.length<=3);assert.ok(r.marks.every(m=>pm.reading.text.includes(m)),'highlighted sentences are taken from the reading');
// AM without dialogue and without an AM check; review words get their meaning from the vocabulary database.
const am2=Object.assign({},am,{lesson_focus:{words:['ramping','rev1','uban'],patterns:[{pattern:'Waktu masih …',cn:'……的时候',example:am.sentences[0].text,example_cn:am.sentences[0].cn},{pattern:'Meskipun …',cn:'虽然',example:am.sentences[2].text,example_cn:am.sentences[2].cn}]}});
const a=G.buildSteps(am2,null),at=Array.from(a.map(x=>x.type));
assert.deepEqual(at,['overview','word','word','word','rest','pattern','pattern','reading','finish'],'AM flow');
assert.equal(a.find(x=>x.w==='rev1').cn,'复习词');
assert.equal(G.streak(['2026-10-16','2026-10-17','2026-10-18'],'2026-10-18'),3);assert.equal(G.streak(['2026-10-16'],'2026-10-18'),0);
assert.equal(store.size,0,'building the plan writes nothing');
assert.ok(!/recordLessonWrong|markAnswer|indo_lesson_recall_v1|indo_automation_training_state_v1|indo_quick_practice_state|markMastered/.test(src),'guided mode never writes training, recall, lesson errors or mastery');
console.log('Guided lesson tests passed: AM/PM flows from lesson content only, morning focus check, own progress only.');
