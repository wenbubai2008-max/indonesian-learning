'use strict';
// Separate "today's three focus words" rotation from core review and natural exposure.
// Reads only completed lesson_focus history and the already-built runtime; no state writes.
const norm=x=>String(x==null?'':x).trim().toLowerCase().replace(/[.,!?;:，。！？；：]/g,'').replace(/\s+/g,' ');
const word=x=>norm(Array.isArray(x)?x[0]:typeof x==='string'?x:x&&x.word);
const words=x=>Array.isArray(x)?x.map(word).filter(Boolean):[];
const DAY=86400000;
const lessonTime=(date,session)=>Date.parse(date+'T'+(session==='am'?'08:00:00':date<'2026-09-16'?'19:00:00':'18:00:00')+'+07:00');
const activeWords=h=>h.session==='am'?[...words(h.review_vocab),...words(h.cycle_vocab)]:
  words((h.vocab||[]).filter(v=>v&&(v.source_group==='review'||v.source_group==='application')));

/**
 * New candidate only. Cool a highlighted word for 72 hours or after 2 highlights
 * within seven days. A new, timestamped wrong answer after the last focus AND
 * active review may override. Only avoid a cooled choice when another uncool
 * word actually exists in this candidate lesson. History is never rewritten.
 */
function checkFocus({lesson,reviewHistory,runtime,config}){
 const cfg=config||{},date=String(lesson&&lesson.date||''),session=lesson&&lesson.session;
 if(cfg.enabled!==true||date<(cfg.effective_date||'9999-12-31'))return [];
 if(!Array.isArray(reviewHistory))return [{code:'LESSON_FOCUS_HISTORY_MISSING',detail:'Completed seven-day lesson history required'}];
 const now=lessonTime(date,session);
 if(!Number.isFinite(now))return [];
 const cooldown=(Number(cfg.cooldown_hours)||72)*3600000,window=(Number(cfg.window_days)||7)*DAY;
 const maxPrior=Number.isInteger(cfg.max_prior_focus)?cfg.max_prior_focus:2;
 const history=reviewHistory.filter(h=>h&&['am','pm'].includes(h.session))
   .map(h=>({lesson:h,at:lessonTime(h.date,h.session)}))
   .filter(h=>Number.isFinite(h.at)&&h.at<now&&h.at>=now-window)
   .sort((a,b)=>a.at-b.at);
 const hits=new Map(),lastActive=new Map();
 for(const h of history){
  for(const w of new Set(words(h.lesson.lesson_focus&&h.lesson.lesson_focus.words))){
   if(!hits.has(w))hits.set(w,[]);
   hits.get(w).push(h.at);
  }
  for(const w of new Set(activeWords(h.lesson)))lastActive.set(w,h.at);
 }
 const runtimeRows=new Map((runtime&&runtime.review_pool||[]).map(r=>[word(r),r]));
 const generated=Date.parse(runtime&&runtime.generated_at||'');
 const status=w=>{
  const recent=hits.get(w)||[],last=recent.length?recent[recent.length-1]:-Infinity;
  const bad=runtimeRows.get(w),wrong=Array.isArray(bad)?Date.parse(bad[3]||''):NaN;
  const lastPractice=Math.max(last,lastActive.get(w)||-Infinity);
  const fresh=Number.isFinite(wrong)&&Number.isFinite(generated)&&wrong<=generated+300000&&wrong>lastPractice;
  const hours=now-last;
  const blocked=!fresh&&(hours<cooldown||recent.length>=maxPrior);
  return {blocked,fresh,count:recent.length,hours};
 };
 const selected=words(lesson&&lesson.lesson_focus&&lesson.lesson_focus.words);
 const errors=[];
 // An AM lesson is the first introduction to its new words. Fresh mistakes in old
 // review words can still drive review_vocab, but cannot displace new-word highlights.
 // When fewer than three new words remain, use cycle_vocab before review_vocab.
 if(session==='am'&&cfg.am_new_first_from&&date>=cfg.am_new_first_from){
  const cycle=new Set(words(lesson.cycle_vocab));
  const newcomers=new Set(words(lesson.vocab).filter(w=>!cycle.has(w)));
  const selectedSet=new Set(selected);
  const expectedNew=Math.min(3,newcomers.size);
  const actualNew=[...selectedSet].filter(w=>newcomers.has(w)).length;
  if(actualNew<expectedNew)errors.push({code:'AM_FOCUS_NEW_REQUIRED',
   detail:'AM lesson_focus needs '+expectedNew+' new vocab words, got '+actualNew+
    '. Replace old review highlights with '+[...newcomers].filter(w=>!selectedSet.has(w)).slice(0,3).join(', ')});
  const expectedCycle=Math.min(3-expectedNew,cycle.size);
  const actualCycle=[...selectedSet].filter(w=>cycle.has(w)).length;
  if(actualCycle<expectedCycle)errors.push({code:'AM_FOCUS_CYCLE_REQUIRED',
   detail:'With '+expectedNew+' new words, the remaining focus slots must use '+expectedCycle+' cycle_vocab word(s); got '+actualCycle});
 }
 const own=session==='am'?[...words(lesson.vocab),...words(lesson.review_vocab),...words(lesson.cycle_vocab)]:words(lesson&&lesson.vocab);
 const chosen=new Set(selected),available=[...new Set(own)].filter(w=>!chosen.has(w)&&!status(w).blocked);
 const blocked=selected.filter(w=>status(w).blocked);
 // Fallback: if fewer alternatives exist than repeated words, allow only the unavoidable repeats.
 return errors.concat(blocked.slice(0,available.length).map(w=>{
  const info=status(w);
  const why=info.hours<cooldown?'within '+cfg.cooldown_hours+'h':'already highlighted '+info.count+' times in '+cfg.window_days+' days';
  return {code:'LESSON_FOCUS_COOLDOWN',detail:w+' '+why+'; available alternative(s): '+available.join(', ')};
 }));
}
module.exports={checkFocus,lessonTime};
