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
  appAm:on(r.application_am_review,'2026-10-04')
 };
}

/** reviewHistory: completed AM/PM lesson JSON objects of the last 7 days (same shape as collectReviewHistory). */
function analyze({date,session,runtime,reviewHistory}){
 const at=Date.parse(date+'T00:00:00Z');
 const exposures=new Map(),stamps=[];
 const completed=(reviewHistory||[]).slice().sort((a,b)=>(a.date+' '+a.session).localeCompare(b.date+' '+b.session));
 for(const h of completed){
  if(!h||!['am','pm'].includes(h.session))continue;
  const time=Date.parse(h.date+'T'+(h.session==='am'?'08:00:00':h.date<'2026-09-16'?'19:00:00':'18:00:00')+'+07:00');
  const words=h.session==='am'?ws(h.review_vocab):ws((h.vocab||[]).filter(v=>v&&v.source_group==='review'));
  const rec={date:h.date,session:h.session,time,words:new Set(words)};
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
  const fresh=!!last&&Number.isFinite(wrong)&&Number.isFinite(generatedAt)&&wrong>last.time&&wrong<=generatedAt+300000;
  const daysAgo=last?Math.round((at-Date.parse(last.date+'T00:00:00Z'))/DAY):null;
  return {word:w,count:list.length,last,daysAgo,fresh,wrong,priority:Array.isArray(row)?Number(row[1]):9,wrongCount:Array.isArray(row)?Number(row[2])||0:0,focus:focus.has(w)};
 };
 const blocked=w=>{ // original cooldowns, unchanged
  const i=info(w);if(i.fresh)return false;
  if(session==='pm'&&sameDayAm&&sameDayAm.words.has(w))return true;
  if(session==='am'&&latest&&latest.session==='pm'&&latest.words.has(w))return true;
  return pms.length===2&&pms.every(x=>x.words.has(w))&&(at-Date.parse(pms[1].date+'T00:00:00Z'))<=3*DAY;
 };
 return {info,blocked,sameDayAm,exposures,stamps,reviewPool:new Set(rows.keys()),focus};
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
 const ctx=analyze({date,session:'pm',runtime,reviewHistory});
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
 * Deterministic candidate ranking + recommended PM selection (what the 17:30 generator must start from).
 * Score favours: fresh real error > never/long-ago core exposure > lower exposure count > memory priority.
 */
/** Days since each word's last lesson exposure (taught / AM review / PM new+review; application excluded), from a long lesson history. */
function lastExposureDays(date,longHistory){
 const last=new Map(),at=Date.parse(date+'T00:00:00Z');
 for(const h of longHistory||[]){
  if(!h||!['am','pm'].includes(h.session)||!(h.date<date))continue;
  const list=h.session==='am'?[...(h.vocab||[]),...(h.review_vocab||[])]:(h.vocab||[]).filter(v=>!(v&&v.source_group==='application'));
  for(const v of list){const w=word(v);if(w&&(!last.has(w)||last.get(w)<h.date))last.set(w,h.date)}
 }
 return new Map([...last].map(([w,d])=>[w,Math.round((at-Date.parse(d+'T00:00:00Z'))/DAY)]));
}
// Stale bonus: only beyond the 7-day window, capped (30) so it never outranks a fresh real error (+100).
const staleBonus=d=>d==null||d<=7?0:Math.min(30,Math.round((d-7)*0.75));

function rank({date,runtime,rotation,reviewHistory,longHistory=null,reviewCount=5,amVocab=[],amReview=[]}){
 const cfg=config(rotation,date),ctx=analyze({date,session:'pm',runtime,reviewHistory});
 const stale=longHistory?lastExposureDays(date,longHistory):new Map();
 const am=new Set(amReview.map(norm)),penalty={0:0,1:12,2:25};
 const items=[...ctx.reviewPool].map(w=>{
  const i=ctx.info(w),reasons=[];
  let score=0;
  if(i.fresh){score+=100;reasons.push('fresh_error_after_last_core_review')}
  const p=i.count>=3?45:(penalty[i.count]||0);score-=p;if(p)reasons.push('exposure_'+i.count+'_in_7d(-'+p+')');
  if(i.daysAgo==null){score+=10;reasons.push('no_core_review_in_7d')}else score+=Math.min(i.daysAgo,7);
  if(i.priority===1){score+=6;reasons.push('priority1')}
  if(i.wrongCount>0&&!i.fresh)reasons.push('older_wrong_not_counted_as_new');
  score+=Math.min(i.wrongCount,3);
  const staleDays=stale.has(w)?stale.get(w):null,sb=staleBonus(staleDays);
  if(sb){score+=sb;reasons.push('stale_'+staleDays+'d(+'+sb+')')}
  const blocked=ctx.blocked(w),recent=cfg.recent?isRecent(i,cfg.recent.days)&&!i.fresh:false;
  return {word:w,score,stale_days:staleDays,count:i.count,days_ago:i.daysAgo,fresh:i.fresh,focus:i.focus,recent4:recent,blocked,am_core:am.has(w),reasons};
 }).sort((a,b)=>b.score-a.score||a.word.localeCompare(b.word));
 const usable=items.filter(x=>!x.blocked&&(x.count<3||x.fresh));
 const pick=[];let recentUsed=0,heavyUsed=0,focusUsed=0;
 const fits=(x,ignoreFocusCap)=>{
  if(x.recent4&&cfg.recent&&recentUsed>=cfg.recent.max)return false;
  if(x.count>=3&&heavyUsed>=1)return false;
  if(!ignoreFocusCap&&cfg.focus&&x.focus&&focusUsed>=cfg.focus.max)return false;
  return true;
 };
 const take=x=>{pick.push(x);if(x.recent4)recentUsed++;if(x.count>=3)heavyUsed++;if(x.focus)focusUsed++};
 const focusMin=cfg.focus?cfg.focus.min:0;
 for(const x of usable){if(pick.length>=focusMin)break;if(x.focus&&fits(x))take(x)}
 for(const x of usable){if(pick.length>=reviewCount)break;if(!pick.includes(x)&&fits(x))take(x)}
 const notes=[];
 if(pick.length<reviewCount){ // legal fallback only: never mastered, never outside review_pool, never cooling-down words
  for(const x of usable){if(pick.length>=reviewCount)break;if(!pick.includes(x)){take(x);notes.push('fallback_used:'+x.word)}}
 }
 const used=new Set(pick.map(x=>x.word));
 const amSet=new Set(amVocab.map(norm));
 const apps=items.filter(x=>!used.has(x.word)&&!x.am_core).sort((a,b)=>(amSet.has(b.word)-amSet.has(a.word))||b.score-a.score||a.word.localeCompare(b.word))
  .slice(0,6).map(x=>({word:x.word,from_today_am_vocab:amSet.has(x.word)}));
 return {date,review_pool_size:items.length,recent_window_days:cfg.recent?cfg.recent.days:null,
  recommended_review:pick.map(x=>x.word),recommended_detail:pick,
  counts:{recent4:recentUsed,focus:focusUsed,heavy_3plus:heavyUsed},
  application_candidates:apps,notes,ranking_top:items.filter(x=>!x.blocked).slice(0,25)};
}

module.exports={config,analyze,checkPm,rank,lastExposureDays,staleBonus,eligibleAlternatives,word,ws,norm};
