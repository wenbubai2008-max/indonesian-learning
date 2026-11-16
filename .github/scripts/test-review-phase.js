#!/usr/bin/env node
'use strict';
// 2026-10-25 (user decision): the review-phase rules are staged dormant behind data/review-phase.json.
// Off (the committed state) must leave every count, validation result, ranking and context exactly as before;
// on, the new AM/PM structure, theme week and confirmed goals apply.
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..','..'),read=f=>JSON.parse(fs.readFileSync(path.join(repo,f),'utf8'));
const RP=require('./review-phase');
const {validate,collectReviewHistory}=require('./validate-lesson-candidate');
const {rank}=require('./review-rotation');
const {buildLessonContext}=require('./build-lesson-context');
const clone=x=>JSON.parse(JSON.stringify(x));
const codes=r=>new Set(r.errors.map(e=>e.code));
const w=v=>String(v.word).trim().toLowerCase();
let n=0;const t=(name,fn)=>{try{fn();n++;console.log('PASS '+name)}catch(e){e.message=name+': '+e.message;throw e}};
const index=read('data/daily/index.json'),rules=read('data/learning-pool-rules.json'),baseRuntime=read('data/learning-runtime.json'),themes=read('data/themes.json');
const ON={version:1,active:true,activated_at:'2026-10-12',theme_start_date:'2026-10-12',counts:read('data/review-phase.json').counts,recurrence_min:{am:6,pm:8},ranking:{skip_goal:'recognize',fast_bonus:8}};

// ---------- the switch itself ----------
t('committed switch is on from 2026-11-16 (user 2026-11-14); before that PM keeps historical 3-4 quota and uses five new from Nov 4',()=>{
  const p=RP.load();assert.equal(p.active,true);assert.equal(p.activated_at,'2026-11-16');assert.equal(p.theme_start_date,'2026-11-16');
  assert.deepEqual(RP.counts(p,'2026-11-03'),{am_cards:[10,10],am_reading:[80,120],pm_core:[10,12],pm_new:[3,4],pm_review:[4,6],pm_review_cycle:[4,9],pm_application:[2,3],pm_dialogue:[4,1e9]});
  assert.deepEqual(RP.counts(p,'2026-11-15'),{am_cards:[10,10],am_reading:[80,120],pm_core:[11,14],pm_new:[5,5],pm_review:[4,6],pm_review_cycle:[4,9],pm_application:[2,3],pm_dialogue:[4,1e9]});
  assert.equal(RP.describe('2026-11-15','am').active,false);assert.equal(RP.recurrenceMin(p,'2026-11-15','am'),null);
  assert.equal(RP.describe('2026-11-16','am').active,true);
});
t('the guard fallback (older trees without review-phase.js) uses the same old numbers',()=>{
  const g=fs.readFileSync(path.join(__dirname,'regression-guard.js'),'utf8').match(/const OLD_COUNTS = (\{[^\n]+\});/);
  assert.ok(g);assert.deepEqual(Function('return '+g[1])(),RP.counts({active:false},'2026-11-03'));
});
t('only active===true from activated_at on counts as on',()=>{
  assert.equal(RP.on({...ON,active:'true'},'2026-10-20'),false);
  assert.equal(RP.on({...ON,activated_at:null},'2026-10-20'),false);
  assert.equal(RP.on(ON,'2026-10-11'),false);assert.equal(RP.on(ON,'2026-10-12'),true);
  assert.equal(RP.on(null,'2026-10-12'),false);
  assert.deepEqual(RP.counts({...ON,activated_at:'2099-01-05'},'2026-10-20'),RP.counts({active:false},'2026-10-20'));
  assert.deepEqual(RP.counts(ON,'2026-10-20').am_cards,[5,7]);assert.equal(RP.recurrenceMin(ON,'2026-10-20','pm'),8);
});
t('theme week: Monday start, 3 core / 2 variation / transfer / weekly test, then the next theme; wraps after 7 weeks',()=>{
  const role=d=>RP.dayPlan(ON,d,themes);
  assert.equal(role('2026-10-12').theme_id,'online-shop');assert.equal(role('2026-10-14').day_role,'core');
  assert.equal(role('2026-10-16').day_role,'variation');assert.equal(role('2026-10-17').day_role,'transfer');assert.equal(role('2026-10-18').day_role,'weekly_test');
  assert.equal(role('2026-10-19').theme_id,'logistics');assert.equal(role('2026-11-30').theme_id,'online-shop');
  assert.equal(RP.dayPlan({...ON,theme_start_date:'2026-10-13'},'2026-10-14',themes),null,'a start that is not a Monday is ignored');
  assert.equal(RP.dayPlan({active:false},'2026-10-14',themes),null);
});
t('confirmed goals: never opened while off; recognize skipped and fast flagged while on; suggestions file ignored',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rp-'));fs.mkdirSync(path.join(dir,'data'));
  fs.writeFileSync(path.join(dir,'data/vocab-goals.json'),JSON.stringify({words:{Jerapah:{goal:'recognize'},ternyata:{goal:'use',fast:true},namun:{goal:'unsure',fast:true}}}));
  const real=fs.readFileSync;let opened=0;fs.readFileSync=function(p,...a){if(String(p).endsWith('vocab-goals.json'))opened++;return real.call(this,p,...a)};
  try{const g=RP.goals({active:false},'2026-10-20',dir);assert.equal(g.skip.size+g.fast.size,0);assert.equal(opened,0,'goals file not read while off')}finally{fs.readFileSync=real}
  const g=RP.goals(ON,'2026-10-20',dir);
  assert.deepEqual([...g.skip],['jerapah']);assert.deepEqual([...g.fast],['ternyata']);assert.equal(g.bonus,8);
  fs.writeFileSync(path.join(dir,'data/vocab-goals.json'),JSON.stringify({observation_only:true,words:{jerapah:{goal:'recognize'}}}));
  assert.equal(RP.goals(ON,'2026-10-20',dir).skip.size,0,'an observation-only file is never used as confirmed goals');
});

// ---------- off = unchanged on every real lesson ----------
t('off: validator results on the last 14 days of real lessons are identical with and without the switch',()=>{
  const dates=index.dates.map(r=>r.date).sort().slice(-14);let compared=0;
  for(const d of dates)for(const s of ['am','pm']){
    const f='data/daily/'+d+'-'+s+'.json';if(!fs.existsSync(path.join(repo,f)))continue;
    const prev=new Date(Date.parse(d+'T00:00:00Z')-86400000).toISOString().slice(0,10);
    const opt=p=>fs.existsSync(path.join(repo,p))?read(p):null;
    const args={lesson:read(f),index,runtime:baseRuntime,rules,expectedDate:d,expectedSession:s,sameDayAm:opt('data/daily/'+d+'-am.json'),previousPm:opt('data/daily/'+prev+'-pm.json'),reviewHistory:collectReviewHistory(index,d,s,read)};
    // Off is pinned explicitly: lessons on or after the real activation day (2026-11-16) follow the phase rules by
    // default; before it, the committed switch must still give exactly the off result.
    const base=JSON.stringify(validate({...args,reviewPhase:{active:false}}));
    if(d<RP.load().activated_at)assert.equal(JSON.stringify(validate(args)),base,f+' changed by the committed switch before its activation day');
    for(const reviewPhase of [{...ON,active:false},{...ON,activated_at:'2099-01-05'},null])
      assert.equal(JSON.stringify(validate({...args,reviewPhase})),base,f+' changed with '+JSON.stringify(reviewPhase&&{active:reviewPhase.active,at:reviewPhase.activated_at}));
    compared++;
  }
  assert.ok(compared>=20,'compared '+compared+' lessons');
});
t('off: ranking without goals equals ranking with empty goal sets',()=>{
  const d='2026-10-25',hist=collectReviewHistory(index,d,'pm',read),am=read('data/daily/2026-10-25-am.json');
  const base={date:d,session:'pm',runtime:baseRuntime,rotation:rules.review_rotation,reviewHistory:hist,reviewCount:5,amVocab:am.vocab.map(w),amReview:am.review_vocab};
  const g=RP.goals({active:false},d);
  assert.equal(JSON.stringify(rank({...base,goalSkip:g.skip,goalFast:g.fast,goalBonus:g.bonus})),JSON.stringify(rank(base)));
});

// ---------- on: ranking ----------
t('on: recognize words leave the core cards; fast words get the bonus',()=>{
  const d='2026-10-25',hist=collectReviewHistory(index,d,'pm',read),am=read('data/daily/2026-10-25-am.json');
  const base={date:d,session:'pm',runtime:baseRuntime,rotation:rules.review_rotation,reviewHistory:hist,reviewCount:5,amVocab:am.vocab.map(w),amReview:am.review_vocab};
  const plain=rank(base),top=plain.recommended_review[0],other=plain.ranking_top.find(x=>!plain.recommended_review.includes(x.word)).word;
  const r=rank({...base,goalSkip:new Set([top]),goalFast:new Set([other]),goalBonus:8});
  assert.ok(!r.recommended_review.includes(top)&&!r.ranking_top.some(x=>x.word===top),'skipped word gone');
  assert.ok(r.ranking_top.find(x=>x.word===other).reasons.includes('goal_fast(+8)'));
  assert.equal(r.recommended_review.length,plain.recommended_review.length,'slot count kept');
});

// ---------- on: 08:00 表达难点课 ----------
const am14=read('data/daily/2026-10-14-am.json'),amWords=am14.vocab.map(w);
const row=x=>[x,2,0,'','','','',''];
function rtWith(words){const rt=clone(baseRuntime);rt.new_pool=[];rt.new_pool_dont=[];rt.new_pool_fuzzy=[];rt.new_pool_unclassified=[];rt.oral_new_pool=[];rt.oral_new_pool_dont=[];
  const have=new Set(rt.review_pool.map(r=>String(r[0]).toLowerCase()));for(const x of words)if(!have.has(x))rt.review_pool.push(row(x));return rt}
const rtAm=rtWith([...amWords,...am14.review_vocab.map(s=>s.toLowerCase())]);
function phaseAm(){
  const L=clone(am14),six=amWords.slice(0,6);
  L.vocab=L.vocab.slice(0,6);L.vocab.forEach(v=>v.is_oral_new=false);L.cycle_vocab=six;
  L.reading.text=L.reading.text.split(/\s+/).slice(0,70).join(' ');
  L.review_cards={recall:six.slice(0,4).map(x=>({cn:'提示',id:x})),contrasts:[{items:[{id:six[0],cn:'甲'},{id:six[1],cn:'乙'}],note:'区别'}],apply:[{word:six[2],usage:'用法',examples:[{id:'contoh',cn:'例'}]}]};
  L.phase={theme_id:'online-shop',day_role:'core'};
  // One of the two focus patterns is a frame of this week's functions (2026-10-31), with its example in the lesson.
  L.sentences[0].text='Menurut resi, paketnya seharusnya sampai kemarin.';
  L.lesson_focus={words:six.slice(0,3),patterns:[{pattern:'Menurut …, … seharusnya …',function:'state-problem',cn:'按……，……本该……',example:'Menurut resi, paketnya seharusnya sampai kemarin.',example_cn:'根据运单，包裹本该昨天到。'},{pattern:'自由句型',cn:'自由',example:L.sentences[1].text,example_cn:L.sentences[1].cn}]};
  return L;
}
const runAm=(L,reviewPhase=ON)=>codes(validate({lesson:L,index,runtime:rtAm,rules,expectedDate:'2026-10-14',expectedSession:'am',sameDayAm:null,previousPm:null,reviewHistory:[],reviewPhase,themes}));
const PHASE_CODES=['PHASE_FUNCTION_MISSING','PHASE_FUNCTION_INVALID','LESSON_FOCUS_PATTERN','LESSON_FOCUS_INVALID','LESSON_FOCUS_WORD','AM_CORE_COUNT','READING_INVALID','PHASE_AM_CONTRAST_MISSING','PHASE_TAG_MISSING','PHASE_TAG_MISMATCH','CYCLE_NOT_ACTIVE','CYCLE_NEW_REQUIRED','CYCLE_VOCAB_MISMATCH','CYCLE_WORD_INELIGIBLE','CYCLE_ORAL_FLAG','AM_REVIEW_CARDS_INVALID','AM_REVIEW_CARDS_ANSWER'];
t('on AM: 6 cycle cards, 70-word reading, contrast cards and theme tag pass every phase rule',()=>{
  const c=runAm(phaseAm());for(const k of PHASE_CODES)assert.ok(!c.has(k),k);
});
t('on AM: the same lesson is refused while the switch is off (10 cards, 80-120 reading words required)',()=>{
  const c=runAm(phaseAm(),{active:false});assert.ok(c.has('AM_CORE_COUNT')&&c.has('READING_INVALID'));
});
t('on AM: 10 cards, missing contrasts, missing or wrong theme tag are refused',()=>{
  const ten=clone(am14);ten.cycle_vocab=amWords;ten.vocab.forEach(v=>v.is_oral_new=false);ten.phase={theme_id:'online-shop',day_role:'core'};
  assert.ok(runAm(ten).has('AM_CORE_COUNT'));
  const a=phaseAm();delete a.review_cards;assert.ok(runAm(a).has('PHASE_AM_CONTRAST_MISSING'));
  const b=phaseAm();delete b.phase;assert.ok(runAm(b).has('PHASE_TAG_MISSING'));
  const c=phaseAm();c.phase={theme_id:'logistics',day_role:'core'};assert.ok(runAm(c).has('PHASE_TAG_MISMATCH'));
});

t('on: weekly function frames: one focus pattern must be a frame of this week, tagged and really used',()=>{
  const a=phaseAm();delete a.lesson_focus.patterns[0].function;assert.ok(runAm(a).has('PHASE_FUNCTION_MISSING'),'untagged');
  const b=phaseAm();b.lesson_focus.patterns[0].function='ask-status';assert.ok(runAm(b).has('PHASE_FUNCTION_INVALID'),'function of another theme');
  const c=phaseAm();c.lesson_focus.patterns[0].pattern='Menurut …, … harus …';assert.ok(runAm(c).has('PHASE_FUNCTION_INVALID'),'not one of the frames');
  const d=phaseAm();d.sentences[0].text='Menurut resi, paketnya sampai kemarin.';d.lesson_focus.patterns[0].example=d.sentences[0].text;assert.ok(runAm(d).has('PHASE_FUNCTION_INVALID'),'example does not use the frame');
  assert.ok(!runAm(phaseAm(),{active:false}).has('PHASE_FUNCTION_MISSING'),'off: no function rule');
  const plan=RP.dayPlan(ON,'2026-10-19',themes);assert.equal(plan.theme_id,'logistics');assert.ok(plan.functions.length>=2);
  for(const th of themes.themes){assert.ok(th.functions.length>=2&&th.functions.length<=3,th.id);for(const f of th.functions)assert.ok(f.frames.length>=2&&f.frames.every(x=>x.id.includes('…')&&x.cn),th.id+'/'+f.id)}
});

// ---------- on: 08:00 weekly serial story (2026-11-16 user decision, REVIEW-PHASE.md 2.1) ----------
const ONS={...ON,story:{from:'2026-10-13',reading:[110,160]}};
function storyAm(ep,extra={}){const L=phaseAm(),words=am14.reading.text.split(/\s+/);let a=[];while(a.length<120)a=a.concat(words);
  L.reading.text=a.slice(0,120).join(' ');L.reading.title='Paket yang Tersesat · 迷路的包裹';
  L.story={series:'Toko Bu Narti · 纳尔蒂太太的网店',episode:ep,...(ep>1?{previously_cn:'上集：顾客催单。'}:{}),...extra};return L}
const ep=(d,n,series='Toko Bu Narti · 纳尔蒂太太的网店')=>({date:d,session:'am',story:{series,episode:n},reading:{title:'第'+n+'集'}});
const runS=(L,weekAms,reviewPhase=ONS)=>codes(validate({lesson:L,index,runtime:rtAm,rules,expectedDate:'2026-10-14',expectedSession:'am',sameDayAm:null,previousPm:null,reviewHistory:[],reviewPhase,themes,weekAms}));
const STORY=['PHASE_AM_STORY_MISSING','PHASE_AM_STORY_INVALID','PHASE_AM_STORY_EPISODE','PHASE_AM_STORY_SERIES','READING_INVALID'];
t('story: from story.from every review-phase AM is an episode of this week\'s serial, 110-160 reading words',()=>{
  const ok=runS(storyAm(1),[]);for(const k of [...STORY,...PHASE_CODES])assert.ok(!ok.has(k),k);
  const a=runS(phaseAm(),[]);assert.ok(a.has('PHASE_AM_STORY_MISSING')&&a.has('READING_INVALID'),'no story, 70-word reading');
  const b=storyAm(1);b.reading.title='';assert.ok(runS(b,[]).has('PHASE_AM_STORY_INVALID'),'episode title required');
  const c=storyAm(1,{next_cn:''});assert.ok(runS(c,[]).has('PHASE_AM_STORY_INVALID'),'empty next_cn');
});
t('story: episode continues this week\'s published episodes, same series, recap from episode 2',()=>{
  const week=[ep('2026-10-13',1)];
  for(const k of STORY)assert.ok(!runS(storyAm(2),week).has(k),k);
  assert.ok(runS(storyAm(1),week).has('PHASE_AM_STORY_EPISODE'),'episode must be 2');
  const n=storyAm(2);delete n.story.previously_cn;assert.ok(runS(n,week).has('PHASE_AM_STORY_INVALID'),'recap required');
  const s=storyAm(2);s.story.series='Cerita Lain · 另一个故事';assert.ok(runS(s,week).has('PHASE_AM_STORY_SERIES'),'series fixed all week');
  assert.ok(!runS(storyAm(1),[ep('2026-10-11',6)]).has('PHASE_AM_STORY_EPISODE'),'last week\'s episodes do not count');
  assert.ok(!runS(storyAm(1),[{date:'2026-10-13',session:'am'}]).has('PHASE_AM_STORY_EPISODE'),'a lesson without story is not an episode');
  const p=RP.storyPlan(ONS,'2026-10-14',[ep('2026-10-13',1),ep('2026-10-14',2)]);assert.equal(p.episode,2,'the lesson itself is not counted');
  assert.equal(p.week_start,'2026-10-12');assert.equal(p.series,'Toko Bu Narti · 纳尔蒂太太的网店');
});
t('story: off, before story.from or without story config, nothing changes',()=>{
  for(const ph of [{...ONS,active:false},ON,{...ONS,story:{from:'2026-10-15'}}]){const c=runS(phaseAm(),[],ph);assert.ok(!c.has('PHASE_AM_STORY_MISSING'),JSON.stringify(ph.story||null));}
  assert.equal(RP.storyRule({...ONS,active:false},'2026-10-14'),null);assert.equal(RP.storyRule(ONS,'2026-10-12'),null);
  assert.deepEqual(RP.storyRule({...ONS,story:{from:'2026-10-13'}},'2026-10-14').reading,[110,160],'default length');
  const committed=RP.load();assert.equal(committed.story.from,'2026-11-17');assert.deepEqual(committed.story.reading,[110,160]);
});

// ---------- on: 18:00 任务课 ----------
const pm14=read('data/daily/2026-10-14-pm.json');
function phasePm(){
  const L=clone(pm14);
  L.vocab=L.vocab.filter(v=>v.source_group!=='new');L.new_words=[]; // 5 review + 2 application = 7 cards, no new words left
  L.dialogue.lines.push({speaker:'A',id:'Baik, terima kasih.',cn:'好的，谢谢。'});L.dialogue.twist=3;
  L.rewrite[0].kind='twist';L.phase={theme_id:'online-shop',day_role:'core'};
  return L;
}
const sameAm=phaseAm(),rtPm=rtWith([...pm14.vocab.map(w),...amWords]);
const runPm=(L,reviewPhase=ON,extra={})=>codes(validate({lesson:L,index,runtime:rtPm,rules,expectedDate:extra.date||'2026-10-14',expectedSession:'pm',sameDayAm:extra.am||sameAm,previousPm:null,reviewHistory:extra.history||[],reviewPhase,themes}));
const PM_PHASE=['PM_CORE_COUNT','PM_GROUP_COUNT','PM_DIALOGUE_INVALID','PHASE_PM_TWIST','PHASE_TAG_MISSING','PHASE_TAG_MISMATCH'];
t('on PM: 7 cards (0 new / 5 review / 2 application), 8-line dialogue with a twist pass every phase rule',()=>{
  const c=runPm(phasePm());for(const k of PM_PHASE)assert.ok(!c.has(k),k);
});
t('on PM: missing twist, twist on line 0, no twist rewrite, 7-line dialogue, 10 cards are refused',()=>{
  const a=phasePm();delete a.dialogue.twist;assert.ok(runPm(a).has('PHASE_PM_TWIST'));
  const b=phasePm();b.dialogue.twist=0;assert.ok(runPm(b).has('PHASE_PM_TWIST'));
  const c=phasePm();delete c.rewrite[0].kind;assert.ok(runPm(c).has('PHASE_PM_TWIST'));
  const d=phasePm();d.dialogue.lines.pop();assert.ok(runPm(d).has('PM_DIALOGUE_INVALID'));
  assert.ok(runPm(clone(pm14)).has('PM_CORE_COUNT'));
});
// ---------- on: slim 18:00 back half (2026-11-16 user decision, REVIEW-PHASE.md 3.1) ----------
const ONP={...ON,pm_slim:{from:'2026-10-13'}};
function slimPm(){const L=phasePm();L.rewrite=[{...L.rewrite[0],kind:'twist',frame:'Mohon maaf, Kak, …… . Kakak bebas pilih: …… atau …… .'}];
  delete L.daily_test.self_check;
  L.review={title:'可选 · 30 秒复述',steps:['用今天的 3 个词，30 秒说说这件事怎么解决的。'],retell_reference:'Pembeli mau tukar ukuran, tapi ukurannya kosong. Admin minta maaf dan kasih dua pilihan.',retell_reference_cn:'买家想换尺码，但尺码断货了。客服道歉并给了两个选择。'};return L}
const SLIM=['PM_REWRITE_INVALID','PHASE_PM_SLIM_REWRITE','PM_SELF_CHECK_INVALID','PHASE_PM_SLIM_REVIEW','PM_FINAL_REVIEW_INVALID','PHASE_PM_TWIST'];
t('slim PM: one twist rewrite with a frame, no self_check, one retell step with a reference',()=>{
  const ok=runPm(slimPm(),ONP);for(const k of SLIM)assert.ok(!ok.has(k),k);
  const a=slimPm();delete a.rewrite[0].frame;assert.ok(runPm(a,ONP).has('PHASE_PM_SLIM_REWRITE'),'frame required');
  const b=slimPm();b.rewrite[0].frame='Mohon maaf, Kak.';assert.ok(runPm(b,ONP).has('PHASE_PM_SLIM_REWRITE'),'frame needs blanks');
  const c=slimPm();c.rewrite.push({...pm14.rewrite[1]});assert.ok(runPm(c,ONP).has('PHASE_PM_SLIM_REWRITE'),'a second ordinary rewrite');
  const d=slimPm();d.rewrite.push({...pm14.rewrite[1],kind:'challenge'});assert.ok(!runPm(d,ONP).has('PHASE_PM_SLIM_REWRITE'),'Sunday challenge allowed');
  const e=slimPm();e.daily_test.self_check=['x'];assert.ok(runPm(e,ONP).has('PM_SELF_CHECK_INVALID'),'self_check removed');
  const f=slimPm();delete f.review.retell_reference;assert.ok(runPm(f,ONP).has('PHASE_PM_SLIM_REVIEW'),'reference retell');
  const g=slimPm();g.review.steps.push('另一步');assert.ok(runPm(g,ONP).has('PHASE_PM_SLIM_REVIEW'),'one step only');
});
t('slim PM: off, before pm_slim.from or without the config, the old 3-4 rewrite contract still applies',()=>{
  for(const ph of [ON,{...ONP,pm_slim:{from:'2026-10-15'}}]){const c=runPm(slimPm(),ph);assert.ok(c.has('PM_REWRITE_INVALID')&&c.has('PM_SELF_CHECK_INVALID'),JSON.stringify(ph.pm_slim||null));
    const old=runPm(phasePm(),ph);for(const k of SLIM)assert.ok(!old.has(k),k);}
  assert.equal(RP.pmSlim({...ONP,active:false},'2026-10-14'),false);assert.equal(RP.pmSlim(ONP,'2026-10-14'),true);
  assert.equal(RP.load().pm_slim.from,'2026-11-17');
});
t('on PM: the 6-card morning counts as the published same-day AM; off it would not',()=>{
  // AM_PREREQUISITE_MISSING also needs index am=true for 2026-10-14, which the real index has.
  assert.ok(!runPm(phasePm()).has('AM_PREREQUISITE_MISSING'));
  assert.ok(runPm(phasePm(),{active:false}).has('AM_PREREQUISITE_MISSING'));
});
t('on Sunday PM: week_words must come from this week and be tested',()=>{
  const sun='2026-10-18',week=[{date:'2026-10-13',session:'am',vocab:amWords.slice(0,8).map(x=>({word:x})),review_vocab:[]}];
  const base=()=>{const L=phasePm();L.date=sun;L.phase={theme_id:'online-shop',day_role:'weekly_test'};return L};
  const tested=amWords.filter(x=>JSON.stringify(pm14.daily_test.questions).toLowerCase().includes(x));
  const run=L=>runPm(L,ON,{date:sun,history:week,am:{...sameAm,date:sun}});
  const a=base();assert.ok(run(a).has('PHASE_WEEKLY_TEST'),'week_words required');
  const b=base();b.daily_test.week_words=amWords.slice(0,6);
  b.daily_test.questions[0].prompt+=' '+amWords.slice(0,6).join(' ');assert.ok(!run(b).has('PHASE_WEEKLY_TEST'),'6 week words, all tested');
  const c=base();c.daily_test.week_words=[...amWords.slice(0,5),'kata-lain'];c.daily_test.questions[0].prompt+=' '+c.daily_test.week_words.join(' ');assert.ok(run(c).has('PHASE_WEEKLY_TEST'),'word outside the week');
  const d=base();d.daily_test.week_words=amWords.slice(0,6);assert.equal(run(d).has('PHASE_WEEKLY_TEST'),amWords.slice(0,6).some(x=>!tested.includes(x)),'untested word refused');
});
t('on Sunday PM: exactly one open-speaking challenge naming 2+ of this week\'s functions',()=>{
  const sun='2026-10-18',run=L=>runPm(L,ON,{date:sun,am:{...sameAm,date:sun}});
  const base=()=>{const L=phasePm();L.date=sun;L.phase={theme_id:'online-shop',day_role:'weekly_test'};return L};
  assert.ok(run(base()).has('PHASE_WEEKLY_CHALLENGE'),'challenge required on Sunday');
  const ok=base();ok.rewrite.push({kind:'challenge',functions:['state-problem','offer-solution'],task:'t',reference_answer:'r',reference_cn:'c'});ok.rewrite=ok.rewrite.slice(-4);
  assert.ok(!run(ok).has('PHASE_WEEKLY_CHALLENGE'));
  const bad=base();bad.rewrite[1].kind='challenge';bad.rewrite[1].functions=['state-problem','ask-status'];assert.ok(run(bad).has('PHASE_WEEKLY_CHALLENGE'),'function of another week');
  const mon=phasePm();assert.ok(!runPm(mon).has('PHASE_WEEKLY_CHALLENGE'),'not required on other days');
});

// ---------- lesson context (fix applies with the switch off too) ----------
t('context: a review-cycle PM with no new words and a cycle AM no longer stop the context builder',()=>{
  const runtime=baseRuntime,rawLoad=p=>read(p);
  const pms=index.dates.filter(r=>r.pm).map(r=>r.date).sort(),lastPm=pms.at(-1);
  const load=p=>{const x=clone(rawLoad(p));if(p==='data/daily/'+lastPm+'-pm.json')x.new_words=[];return x};
  const ctx=buildLessonContext({index,runtime,rules,load});
  assert.ok(ctx&&ctx.target,'context built');
});
console.log('Review phase tests passed: '+n);
