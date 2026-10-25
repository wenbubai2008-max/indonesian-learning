#!/usr/bin/env node
'use strict';
/**
 * 2026-10-25 (user decision): the review-phase rules for the time after the new words run out are staged here,
 * DORMANT. The switch is data/review-phase.json. While `active` is not exactly true (or the lesson date is before
 * `activated_at`), every function below returns the current rules unchanged and reads no other file, so lessons,
 * validators, ranking and recurrence checks behave exactly as before. The learner says when to switch it on;
 * docs/tasks/REVIEW-PHASE.md (section 七) lists the activation steps.
 *
 *   node .github/scripts/review-phase.js --date D [--session am|pm]   prints what applies to that lesson
 */
const fs=require('fs'),path=require('path');
const REPO=path.resolve(__dirname,'..','..');
const FILE='data/review-phase.json',THEMES='data/themes.json',GOALS='data/vocab-goals.json';
// Current contract (identical to the numbers hard-coded before 2026-10-25). pm_dialogue max 1e9 = no upper limit.
const LEGACY=Object.freeze({am_cards:[10,10],am_reading:[80,120],pm_core:[10,12],pm_new:[3,4],pm_review:[4,6],pm_review_cycle:[4,9],pm_application:[2,3],pm_dialogue:[4,1e9]});
const ROLES=['core','core','core','variation','variation','transfer','weekly_test']; // Monday .. Sunday of a theme week
const DAY=86400000;
const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d||''))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
function readJson(root,f){try{return JSON.parse(fs.readFileSync(path.join(root,f),'utf8'))}catch(e){return null}}
/** The switch file; a missing or broken file means "off". */
function load(root=REPO){const p=readJson(root,FILE);return p&&typeof p==='object'&&!Array.isArray(p)?p:{active:false}}
/** True only when the learner switched the phase on and the lesson is on/after the activation date. */
function on(phase,date){return !!phase&&phase.active===true&&validDate(phase.activated_at)&&validDate(date)&&date>=phase.activated_at}
const pair=x=>Array.isArray(x)&&x.length===2&&x.every(Number.isInteger)&&x[0]<=x[1];
/** Card / text counts for the lesson on `date`. Off → LEGACY (a fresh copy). */
function counts(phase,date){
  const out={};for(const k of Object.keys(LEGACY))out[k]=LEGACY[k].slice();
  if(!on(phase,date))return out;
  const c=phase.counts||{};
  for(const k of Object.keys(LEGACY))if(pair(c[k]))out[k]=c[k].slice();
  out.am_target=Number.isInteger(c.am_target)?c.am_target:out.am_cards[0];
  out.pm_target=Number.isInteger(c.pm_target)?c.pm_target:out.pm_core[0];
  return out;
}
/** Minimum natural recurrence per lesson in the phase; null = keep the rules file value. */
function recurrenceMin(phase,date,session){
  if(!on(phase,date))return null;
  const n=phase.recurrence_min&&phase.recurrence_min[session];
  return Number.isInteger(n)&&n>=0?n:null;
}
function loadThemes(root=REPO){const t=readJson(root,THEMES);return t&&Array.isArray(t.themes)?t:{themes:[]}}
/** Theme and day role of `date`: weeks start on theme_start_date (a Monday) and walk through the theme list in order. */
function dayPlan(phase,date,themes){
  if(!on(phase,date)||!validDate(phase.theme_start_date)||!themes||!themes.themes.length)return null;
  const start=Date.parse(phase.theme_start_date+'T00:00:00Z'),at=Date.parse(date+'T00:00:00Z');
  if(new Date(start).getUTCDay()!==1||at<start)return null;
  const days=Math.round((at-start)/DAY),week=Math.floor(days/7),theme=themes.themes[week%themes.themes.length];
  return {theme_id:theme.id,theme_cn:theme.cn,day_role:ROLES[days%7],week:week+1,scenes:theme.scenes||[]};
}
/**
 * Confirmed learning goals (data/vocab-goals.json, written at activation from the learner-reviewed suggestions).
 * Read only while the phase is on: `recognize` words leave the core review cards (they still appear in texts),
 * `fast` words get a ranking bonus. Off → empty sets, and the goals file is not even opened.
 */
function goals(phase,date,root=REPO){
  const empty={skip:new Set(),fast:new Set(),bonus:0};
  if(!on(phase,date))return empty;
  const g=readJson(root,GOALS);if(!g||!g.words||g.observation_only===true)return empty;
  const r=phase.ranking||{},skipGoal=r.skip_goal||'recognize',bonus=Number.isFinite(r.fast_bonus)?r.fast_bonus:0;
  const out={skip:new Set(),fast:new Set(),bonus};
  for(const [w,x] of Object.entries(g.words)){const k=String(w).trim().toLowerCase();if(!x)continue;if(x.goal===skipGoal)out.skip.add(k);if(x.fast===true&&x.goal==='use')out.fast.add(k);}
  return out;
}
function describe(date,session,root=REPO){
  const phase=load(root),active=on(phase,date);
  if(!active)return {date,session:session||null,active:false,note:'复习阶段未启用：按现在的说明书和规则出课，忽略 docs/tasks/REVIEW-PHASE.md。'};
  const plan=dayPlan(phase,date,loadThemes(root));
  return {date,session:session||null,active:true,activated_at:phase.activated_at,counts:counts(phase,date),plan,
    recurrence_min:session?recurrenceMin(phase,date,session):phase.recurrence_min||null,
    note:'复习阶段已启用：按 docs/tasks/REVIEW-PHASE.md 出课（数量、结构以本输出为准）。'};
}
if(require.main===module){
  const a={};const v=process.argv.slice(2);for(let i=0;i<v.length;i+=2)a[String(v[i]).replace(/^--/,'')]=v[i+1];
  if(!validDate(a.date)){console.error('--date YYYY-MM-DD required');process.exit(2)}
  console.log(JSON.stringify(describe(a.date,a.session),null,2));
}
module.exports={load,on,counts,recurrenceMin,loadThemes,dayPlan,goals,describe,LEGACY,ROLES};
