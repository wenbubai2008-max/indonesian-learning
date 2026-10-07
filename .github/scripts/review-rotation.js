'use strict';
/**
 * Executable core-review rotation: ONE source of truth shared by
 *  - validate-lesson-candidate.js (rejects violations), and
 *  - rank-review-candidates.js (what the PM generator must pick from).
 * It only reads runtime/index/lesson history. It never writes data and never changes pool eligibility.
 */
const norm=x=>String(x==null?'':x).trim().toLowerCase().replace(/[.,!?;:，。！？；：]/g,'').replace(/\s+/g,' ');
const word=x=>norm(Array.isArray(x)?x[0]:typeof x==='string'?x:x&&x.word);
const ws=x=>Array.isArray(x)?x.map(word).filter(Boolean):[];
const DAY=86400000;

function config(rotation,date){
 const r=rotation||{};
 const on=(c,def)=>{const x=c&&typeof c==='object'?c:null;return !!(x&&x.enabled===true&&date>=(x.effective_date||def))};
 return {
  recent:on(r.recent_core,'2026-10-04')?{days:Number(r.recent_core.window_days)||4,max:Number.isInteger(r.recent_core.max_per_pm)?r.recent_core.max_per_pm:2}:null,
  focus:on(r.focus_quota,'2026-10-04')?{min:Number.isInteger(r.focus_quota.min)?r.focus_quota.min:2,max:Number.isInteger(r.focus_quota.max)?r.focus_quota.max:3}:null,
  appAm:on(r.application_am_review,'2026-10-04'),
  ledger:ledgerConfig(r,date)
 };
}

/**
 * Exposure ledger (2026-10-08): an application card is an ACTIVE exposure just like a core review, and a word that
 * keeps appearing (any slot, text included) on consecutive days is cooled down. Off when the rules block is absent.
 */
function ledgerConfig(r,date){
 const x=r&&r.exposure_ledger;
 if(!(x&&typeof x==='object'&&x.enabled===true&&date>=(x.effective_date||'2026-10-08')))return null;
 const int=(v,d)=>Number.isInteger(v)&&v>0?v:d,cap=x.fresh_error_cap||{};
 return {lessons:int(x.recent_active_lessons,2),streak:int(x.streak_days,3),
  capMin:int(cap.min,2),capMax:int(cap.max,3),minDue:int(cap.min_due,3),hard:int(x.hard_word_wrong_count,3)};
}
const lessonTime=h=>Date.parse(h.date+'T'+(h.session==='am'?'08:00:00':h.date<'2026-09-16'?'19:00:00':'18:00:00')+'+07:00');
/** Active exposures of one lesson: AM.review_vocab; PM review, plus PM application when the ledger is on. */
function activeWords(h,ledger){
 if(h.session==='am')return ws(h.review_vocab);
 return ws((h.vocab||[]).filter(v=>v&&(v.source_group==='review'||(ledger&&v.source_group==='application'))));
}

/** reviewHistory: completed AM/PM lesson JSON objects of the last 7 days (same shape as collectReviewHistory). */
function analyze({date,session,runtime,reviewHistory,ledger=null}){
 const at=Date.parse(date+'T00:00:00Z');
 const exposures=new Map(),stamps=[];
 const completed=(reviewHistory||[]).slice().sort((a,b)=>(a.date+' '+a.session).localeCompare(b.date+' '+b.session));
 for(const h of completed){
  if(!h||!['am','pm'].includes(h.session))continue;
  const time=lessonTime(h);
  const words=activeWords(h,ledger);
  const rec={date:h.date,session:h.session,time,words:new Set(words),lesson:h};
  stamps.push(rec);
  for(const w of words){if(!exposures.has(w))exposures.set(w,[]);exposures.get(w).push(rec)}
 }
 const rows=new Map((runtime.review_pool||[]).map(v=>[word(v),v]));
 const focus=new Set(ws(runtime.focus_pool));
 const generatedAt=Date.parse(runtime.generated_at||'');
 const sameDayAm=stamps.find(x=>x.date===date&&x.session==='am')||null;
 const latest=stamps.at(-1)||null;
 const pms=stamps.filter(x=>x.session==='pm').slice(-2);
 const info=w=>{
  const list=exposures.get(w)||[],last=list.length?list[list.length-1]:null;
  const row=rows.get(w),wrong=Array.isArray(row)?Date.parse(row[3]||''):NaN;
  // A wrong answer is "new" only if it is later than the latest formal core review of that word.
  // Ledger: a word with no active exposure in the 7-day window but a wrong answer inside that window is also a
  // fresh error (wrong in training, never re-practised in a lesson since) -> it belongs to the error pool.
  const valid=Number.isFinite(wrong)&&Number.isFinite(generatedAt)&&wrong<=generatedAt+300000;
  const fresh=valid&&(last?wrong>last.time:!!ledger&&wrong>=at-7*DAY);
  const daysAgo=last?Math.round((at-Date.parse(last.date+'T00:00:00Z'))/DAY):null;
  return {word:w,count:list.length,last,daysAgo,fresh,wrong,priority:Array.isArray(row)?Number(row[1]):9,wrongCount:Array.isArray(row)?Number(row[2])||0:0,focus:focus.has(w)};
 };
 const original=w=>{ // original cooldowns, unchanged (with the ledger on, PM application counts as an exposure)
  if(session==='pm'&&sameDayAm&&sameDayAm.words.has(w))return true;
  if(session==='am'&&latest&&latest.session==='pm'&&latest.words.has(w))return true;
  return pms.length===2&&pms.every(x=>x.words.has(w))&&(at-Date.parse(pms[1].date+'T00:00:00Z'))<=3*DAY;
 };
 // Ledger 1: active in any of the last N completed lessons (AM review / PM review / PM application) -> no core slot now.
 const lastLessons=ledger?stamps.slice(-ledger.lessons):[];
 const activeRecent=w=>!!ledger&&lastLessons.some(x=>x.words.has(w));
 // Ledger 2: appearing in ANY form (core list, reading, dialogue, sentences, examples) on each of the previous
 // streak-1 days, with at least one active exposure among them, would make this lesson the streak-th day in a row.
 const dayOf=x=>Math.round((at-Date.parse(x.date+'T00:00:00Z'))/DAY);
 const texts=ledger?stamps.map(x=>({day:dayOf(x),words:x.words,text:lessonText(x.lesson)})):[];
 const streakCache=new Map();
 const streak=w=>{
  if(!ledger)return false;
  if(streakCache.has(w))return streakCache.get(w);
  const re=new RegExp('(^|[^a-z])'+reEsc(w)+'([^a-z]|$)');
  const seen=new Set(),act=new Set();
  for(const x of texts){if(x.words.has(w)){seen.add(x.day);act.add(x.day)}else if(re.test(x.text))seen.add(x.day)}
  const need=ledger.streak-1,ends=session==='pm'?[0,1]:[1];
  let hit=false;
  for(const e of ends){const days=Array.from({length:need},(_,k)=>e+k);if(days.every(d=>seen.has(d))&&days.some(d=>act.has(d))){hit=true;break}}
  streakCache.set(w,hit);return hit;
 };
 const why=w=>{const i=info(w);if(i.fresh)return [];const r=[];if(original(w))r.push('cooldown');if(activeRecent(w))r.push('active_last_'+ledger.lessons+'_lessons');if(streak(w))r.push('streak_'+ledger.streak+'_days');return r};
 const blocked=w=>why(w).length>0;
 return {info,blocked,why,activeRecent,streak,sameDayAm,exposures,stamps,reviewPool:new Set(rows.keys()),focus,ledger};
}

const isRecent=(i,days)=>i.count>0&&i.daysAgo!=null&&i.daysAgo<=days;

/**
 * Words that may still take a core-review slot: legal, not cooling down, not over-exposed (>=3 in 7 days
 * unless a fresh error), not already used by another group.
 */
function eligibleAlternatives(ctx,used,cfg){
 const out=[];
 for(const w of ctx.reviewPool){
  if(used.has(w))continue;
  const i=ctx.info(w);
  if(ctx.blocked(w))continue;
  if(i.count>=3&&!i.fresh)continue;
  if(cfg.recent&&isRecent(i,cfg.recent.days)&&!i.fresh)continue;
  out.push(w);
 }
 return out;
}

/** Returns validator errors [{code,detail}] for a PM candidate; empty when compliant or when alternatives are insufficient. */
function checkPm({date,runtime,rotation,reviewHistory,review,application,newWords,amReview}){
 const cfg=config(rotation,date),errors=[];
 if(!cfg.recent&&!cfg.focus&&!cfg.appAm)return errors;
 const ctx=analyze({date,session:'pm',runtime,reviewHistory,ledger:cfg.ledger});
 const used=new Set([...review,...application,...newWords]);
 const alts=eligibleAlternatives(ctx,used,cfg);
 if(cfg.recent){
  const recent=review.filter(w=>{const i=ctx.info(w);return isRecent(i,cfg.recent.days)&&!i.fresh});
  const excess=recent.length-cfg.recent.max;
  if(excess>0&&alts.length>=excess)errors.push({code:'PM_RECENT_CORE_LIMIT',detail:'At most '+cfg.recent.max+' core-review words may come from the last '+cfg.recent.days+' days while '+alts.length+' eligible low-exposure alternatives exist; selected: '+recent.join(', ')});
 }
 if(cfg.focus){
  const focusSel=review.filter(w=>ctx.focus.has(w));
  const excess=focusSel.length-cfg.focus.max;
  const nonFocusAlts=alts.filter(w=>!ctx.focus.has(w));
  if(excess>0&&nonFocusAlts.length>=excess)errors.push({code:'PM_FOCUS_MIX_HIGH',detail:'Use at most '+cfg.focus.max+' focus_pool words among the core reviews when non-focus eligible alternatives exist; selected '+focusSel.length+': '+focusSel.join(', ')});
  const lack=cfg.focus.min-focusSel.length;
  const focusAlts=alts.filter(w=>ctx.focus.has(w));
  if(lack>0&&focusAlts.length>=lack&&review.length>=4)errors.push({code:'PM_FOCUS_MIX_LOW',detail:'Use at least '+cfg.focus.min+' focus_pool words when eligible focus alternatives exist; selected '+focusSel.length});
 }
 if(cfg.appAm){
  const am=new Set((amReview||[]).map(norm));
  const repeats=application.filter(w=>am.has(w)&&!ctx.info(w).fresh);
  const appAlts=[...ctx.reviewPool].filter(w=>!used.has(w)&&!am.has(w));
  if(repeats.length&&appAlts.length>=repeats.length)errors.push({code:'PM_APPLICATION_AM_REVIEW_REPEAT',detail:'Full application cards must not repeat words already reviewed at 08:00 when other legal application words exist; use reading/dialogue instead: '+repeats.join(', ')});
 }
 return errors;
}

/**
 * Exposure-ledger validator errors for AM review_vocab or PM review/application. Only raised when enough legal,
 * non-cooling alternatives exist, so it never deadlocks publication; a fresh real error always exempts the word.
 */
function checkExposure({date,session,runtime,rotation,reviewHistory,review=[],application=[],newWords=[],amVocab=[]}){
 const cfg=config(rotation,date),errors=[];
 if(!cfg.ledger)return errors;
 const ctx=analyze({date,session,runtime,reviewHistory,ledger:cfg.ledger});
 const used=new Set([...review,...application,...newWords]);
 const alts=eligibleAlternatives(ctx,used,cfg);
 const hits=review.filter(w=>ctx.blocked(w));
 if(hits.length&&alts.length>=hits.length)errors.push({code:session==='am'?'AM_EXPOSURE_COOLDOWN':'PM_EXPOSURE_COOLDOWN',
  detail:'Core-review words still cooling down under the exposure ledger (application counts as an exposure; a word may not be active in the last '+cfg.ledger.lessons+' lessons or appear '+cfg.ledger.streak+' days in a row) while '+alts.length+' eligible alternatives exist: '+hits.map(w=>w+'('+ctx.why(w).join('+')+')').join(', ')});
 if(session==='pm'){
  const am=new Set(amVocab.map(norm));
  const appHits=application.filter(w=>ctx.blocked(w)&&!am.has(w));
  const appAlts=[...new Set([...alts,...[...am].filter(w=>ctx.reviewPool.has(w)&&!used.has(w))])];
  if(appHits.length&&appAlts.length>=appHits.length)errors.push({code:'PM_APPLICATION_EXPOSURE_COOLDOWN',
   detail:'Full application cards must not reuse words that were active in the last '+cfg.ledger.lessons+' lessons or appeared '+cfg.ledger.streak+' days in a row when other legal application words exist: '+appHits.map(w=>w+'('+ctx.why(w).join('+')+')').join(', ')});
 }
 return errors;
}

/**
 * Deterministic candidate ranking + recommended PM selection (what the 17:30 generator must start from).
 * Score favours: fresh real error > never/long-ago core exposure > lower exposure count > memory priority.
 */
/** Days since each word's last lesson exposure (taught / AM review / PM new+review; application excluded), from a long lesson history. */
function lastExposureDays(date,longHistory,includeApplication=false){
 const last=new Map(),at=Date.parse(date+'T00:00:00Z');
 for(const h of longHistory||[]){
  if(!h||!['am','pm'].includes(h.session)||!(h.date<date))continue;
  const list=h.session==='am'?[...(h.vocab||[]),...(h.review_vocab||[])]:(h.vocab||[]).filter(v=>includeApplication||!(v&&v.source_group==='application'));
  for(const v of list){const w=word(v);if(w&&(!last.has(w)||last.get(w)<h.date))last.set(w,h.date)}
 }
 return new Map([...last].map(([w,d])=>[w,Math.round((at-Date.parse(d+'T00:00:00Z'))/DAY)]));
}
// Stale bonus: only beyond the 7-day window, capped (30) so it never outranks a fresh real error (+100).
const staleBonus=d=>d==null||d<=7?0:Math.min(30,Math.round((d-7)*0.75));

function rank({date,session='pm',runtime,rotation,reviewHistory,longHistory=null,reviewCount=5,amVocab=[],amReview=[]}){
 const cfg=config(rotation,date),L=cfg.ledger,ctx=analyze({date,session,runtime,reviewHistory,ledger:L});
 const pmRules=session==='pm'; // recent-4-day cap and focus quota are PM rules
 const recentCfg=pmRules?cfg.recent:null,focusCfg=pmRules?cfg.focus:null;
 const stale=longHistory?lastExposureDays(date,longHistory,!!L):new Map();
 const am=new Set(amReview.map(norm)),penalty={0:0,1:12,2:25};
 const items=[...ctx.reviewPool].map(w=>{
  const i=ctx.info(w),reasons=[];
  let score=0;
  if(i.fresh){score+=100;reasons.push(L?'fresh_error_after_last_active_exposure':'fresh_error_after_last_core_review')}
  const p=i.count>=3?45:(penalty[i.count]||0);score-=p;if(p)reasons.push('exposure_'+i.count+'_in_7d(-'+p+')');
  if(i.daysAgo==null){score+=10;reasons.push('no_core_review_in_7d')}else score+=Math.min(i.daysAgo,7);
  if(i.priority===1){score+=6;reasons.push('priority1')}
  if(i.wrongCount>0&&!i.fresh)reasons.push('older_wrong_not_counted_as_new');
  score+=Math.min(i.wrongCount,3);
  const hard=!!L&&i.wrongCount>=L.hard;
  if(hard)reasons.push('hard_word_'+i.wrongCount+'_wrongs(换题型/辨析讲解)');
  const staleDays=stale.has(w)?stale.get(w):null,sb=staleBonus(staleDays);
  if(sb){score+=sb;reasons.push('stale_'+staleDays+'d(+'+sb+')')}
  const why=ctx.why(w),blocked=why.length>0,recent=recentCfg?isRecent(i,recentCfg.days)&&!i.fresh:false;
  if(blocked)reasons.push('blocked:'+why.join('+'));
  return {word:w,score,stale_days:staleDays,legacy:i.priority===5,count:i.count,days_ago:i.daysAgo,fresh:i.fresh,hard,focus:i.focus,recent4:recent,blocked,blocked_by:why,am_core:am.has(w),reasons};
 }).sort((a,b)=>b.score-a.score||a.word.localeCompare(b.word));
 const usable=items.filter(x=>!x.blocked&&(x.count<3||x.fresh));
 // Fresh-error quota: errors come back next lesson, but never crowd out the due words (ledger only).
 const errCap=L?Math.min(L.capMax,Math.max(L.capMin,reviewCount-L.minDue)):Infinity;
 const pick=[];let recentUsed=0,heavyUsed=0,focusUsed=0,legacyUsed=0,freshUsed=0; // legacy = taught words without a weakness record (priority 5): at most 1 per lesson
 const fits=(x,ignoreFocusCap)=>{
  if(x.recent4&&recentCfg&&recentUsed>=recentCfg.max)return false;
  if(x.count>=3&&heavyUsed>=1)return false;
  if(x.legacy&&legacyUsed>=1)return false;
  if(x.fresh&&freshUsed>=errCap)return false;
  if(!ignoreFocusCap&&focusCfg&&x.focus&&focusUsed>=focusCfg.max)return false;
  return true;
 };
 const take=x=>{pick.push(x);if(x.recent4)recentUsed++;if(x.count>=3)heavyUsed++;if(x.focus)focusUsed++;if(x.legacy)legacyUsed++;if(x.fresh)freshUsed++};
 const focusMin=focusCfg?focusCfg.min:0;
 for(const x of usable){if(pick.length>=focusMin)break;if(x.focus&&fits(x))take(x)}
 for(const x of usable){if(pick.length>=reviewCount)break;if(!pick.includes(x)&&fits(x))take(x)}
 const notes=[];
 if(pick.length<reviewCount){ // legal fallback only: never mastered, never outside review_pool, never cooling-down words
  for(const x of usable){if(pick.length>=reviewCount)break;if(x.legacy&&legacyUsed>=1)continue; // the legacy cap is strict even in fallback: fewer words beats padding with unverified ones
   if(!pick.includes(x)){take(x);notes.push('fallback_used:'+x.word)}}
 }
 const used=new Set(pick.map(x=>x.word));
 const deferred=usable.filter(x=>x.fresh&&!used.has(x.word)).map(x=>x.word);
 if(deferred.length)notes.push('fresh_errors_deferred_to_next_lesson:'+deferred.join(','));
 const amSet=new Set(amVocab.map(norm));
 const apps=pmRules?items.filter(x=>!used.has(x.word)&&!x.am_core&&!x.legacy&&!(L&&x.blocked&&!amSet.has(x.word))).sort((a,b)=>(amSet.has(b.word)-amSet.has(a.word))||b.score-a.score||a.word.localeCompare(b.word))
  .slice(0,6).map(x=>({word:x.word,from_today_am_vocab:amSet.has(x.word),fresh:x.fresh,hard:x.hard})):[];
 // Words actively used very recently (or on a streak): keep them out of tonight's reading/dialogue/examples too.
 const avoid=L?items.filter(x=>!used.has(x.word)&&!amSet.has(x.word)&&x.blocked_by.some(r=>r.startsWith('active_')||r.startsWith('streak_'))).map(x=>x.word).sort():[];
 return {date,session,review_pool_size:items.length,recent_window_days:recentCfg?recentCfg.days:null,
  recommended_review:pick.map(x=>x.word),recommended_detail:pick,
  counts:{recent4:recentUsed,focus:focusUsed,heavy_3plus:heavyUsed,fresh_errors:freshUsed,fresh_error_cap:Number.isFinite(errCap)?errCap:null},
  fresh_errors_deferred:deferred,application_candidates:apps,avoid_in_text:avoid,notes,ranking_top:items.filter(x=>!x.blocked).slice(0,25)};
}

/** All Indonesian text of a lesson (reading, sentences, dialogue, example sentences) plus the core word lists. Lower-cased. */
function lessonText(L){
 const t=[];
 if(L&&L.reading&&L.reading.text)t.push(L.reading.text);
 for(const x of (L&&L.sentences)||[])t.push(typeof x==='string'?x:(x&&(x.id||x.text||x.indo))||'');
 if(L&&L.dialogue&&Array.isArray(L.dialogue.lines))for(const l of L.dialogue.lines)t.push((l&&l.id)||'');
 for(const v of (L&&L.vocab)||[])t.push((v&&(v.example||''))+' '+word(v));
 for(const v of (L&&L.review_vocab)||[])t.push(word(v));
 return t.join(' \n ').toLowerCase();
}
const reEsc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const hashStr=x=>{let h=0;for(const c of x)h=(h*31+c.charCodeAt(0))>>>0;return h};

/**
 * Natural recurrence: pending-review words (A ∩ D, from runtime.review_pool + runtime.recurrence_pool) ranked by how long
 * ago they last appeared ANYWHERE in a lesson (text or core). Used to weave them into reading / dialogue / examples.
 * Never counts as core review, never overrides eligibility; mastered words are not in these pools.
 * Unknown history is treated as 45 days so a matching miss (inflection) cannot lock a word at the top forever.
 */
function naturalRecurrence({date,runtime,longHistory,exclude=[],count=12}){
 const at=Date.parse(date+'T00:00:00Z'),ex=new Set(exclude.map(norm));
 const rows=new Map();
 for(const v of (runtime.review_pool||[]))rows.set(word(v),{word:word(v),priority:Number(v[1]),cn:String(v[5]||'')});
 for(const v of (runtime.recurrence_pool||[]))if(!rows.has(word(v)))rows.set(word(v),{word:word(v),priority:Number(v[1]),cn:String(v[2]||'')});
 const res=[...rows.values()].filter(r=>r.word&&!ex.has(r.word)).map(r=>[r,new RegExp('(^|[^a-z])'+reEsc(r.word)+'([^a-z]|$)')]);
 const last=new Map(),n14=new Map();
 const lessons=(longHistory||[]).filter(h=>h&&h.date<date&&['am','pm'].includes(h.session)).sort((a,b)=>(a.date+a.session).localeCompare(b.date+b.session));
 for(const h of lessons){
  const text=lessonText(h),age=Math.round((at-Date.parse(h.date+'T00:00:00Z'))/DAY);
  for(const [r,re] of res)if(re.test(text)){last.set(r.word,age);if(age<=14)n14.set(r.word,(n14.get(r.word)||0)+1)}
  // later lessons overwrite earlier ones, so `last` ends up as the most recent appearance
 }
 const out=res.map(([r])=>({word:r.word,cn:r.cn,priority:r.priority,legacy:r.priority===5,days_since_any_appearance:last.has(r.word)?last.get(r.word):null,appearances_14d:n14.get(r.word)||0}))
  .map(x=>({...x,_d:x.days_since_any_appearance==null?45:x.days_since_any_appearance}))
  .sort((a,b)=>b._d-a._d||a.priority-b.priority||(hashStr(a.word+date)-hashStr(b.word+date))||a.word.localeCompare(b.word))
  .slice(0,count).map(({_d,...x})=>x);
 return {date,pool_size:rows.size,count:out.length,candidates:out,
  guidance:'Weave these into reading / dialogue / example sentences (about 6-8 per lesson, earlier entries first). They do not count as core review or application and never replace them.'};
}

module.exports={config,analyze,checkPm,checkExposure,activeWords,rank,naturalRecurrence,lessonText,lastExposureDays,staleBonus,eligibleAlternatives,word,ws,norm};
