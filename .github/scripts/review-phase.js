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
// Historical contract retained for published lessons before 2026-11-04. pm_dialogue max 1e9 = no upper limit.
const LEGACY=Object.freeze({am_cards:[10,10],am_reading:[80,120],pm_core:[10,12],pm_new:[3,4],pm_review:[4,6],pm_review_cycle:[4,9],pm_application:[2,3],pm_dialogue:[4,1e9]});
const PM_FIVE_FROM='2026-11-04';
const PM_FIVE=Object.freeze({pm_core:[11,14],pm_new:[5,5]});
const ROLES=['core','core','core','variation','variation','transfer','weekly_test']; // Monday .. Sunday of a theme week
const DAY=86400000;
const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d||''))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
function readJson(root,f){try{return JSON.parse(fs.readFileSync(path.join(root,f),'utf8'))}catch(e){return null}}
/** The switch file; a missing or broken file means "off". */
function load(root=REPO){const p=readJson(root,FILE);return p&&typeof p==='object'&&!Array.isArray(p)?p:{active:false}}
/** True only when the learner switched the phase on and the lesson is on/after the activation date. */
function on(phase,date){return !!phase&&phase.active===true&&validDate(phase.activated_at)&&validDate(date)&&date>=phase.activated_at}
const pair=x=>Array.isArray(x)&&x.length===2&&x.every(Number.isInteger)&&x[0]<=x[1];
/** Date-aware card counts. Old published PM lessons keep their historical 3-4-new contract. */
function counts(phase,date){
  const out={};for(const k of Object.keys(LEGACY))out[k]=LEGACY[k].slice();
  if(String(date||'')>=PM_FIVE_FROM){for(const k of Object.keys(PM_FIVE))out[k]=PM_FIVE[k].slice()}
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
  return {theme_id:theme.id,theme_cn:theme.cn,day_role:ROLES[days%7],week:week+1,scenes:theme.scenes||[],functions:theme.functions||[]};
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
/**
 * 2026-11-16 (user decision, REVIEW-PHASE.md 2.1): from `story.from` on, the reading of every review-phase 08:00 lesson
 * is one episode of a weekly serial story (same cast and place Monday to Sunday). Episode = this theme week's earlier
 * published AM lessons that carry `story`, plus one; the series name stays the same all week. Off / before `from` → null.
 */
function storyRule(phase,date){
  const s=phase&&phase.story;if(!on(phase,date)||!s||typeof s!=='object'||!validDate(s.from)||String(date)<s.from)return null;
  return {from:s.from,reading:pair(s.reading)?s.reading.slice():[110,160]};
}
function weekStart(phase,date){
  if(!on(phase,date)||!validDate(phase.theme_start_date)||!validDate(date))return null;
  const start=Date.parse(phase.theme_start_date+'T00:00:00Z'),at=Date.parse(date+'T00:00:00Z');if(at<start)return null;
  return new Date(at-(Math.round((at-start)/DAY)%7)*DAY).toISOString().slice(0,10);
}
function weekAms(phase,date,root=REPO){
  const ws=weekStart(phase,date),out=[];if(!ws)return out;
  for(let t=Date.parse(ws+'T00:00:00Z');t<Date.parse(date+'T00:00:00Z');t+=DAY){
    const f=path.join(root,'data','daily',new Date(t).toISOString().slice(0,10)+'-am.json');
    if(fs.existsSync(f)){try{out.push(JSON.parse(fs.readFileSync(f,'utf8')))}catch(e){}}
  }
  return out;
}
function storyPlan(phase,date,ams){
  const r=storyRule(phase,date);if(!r)return null;const ws=weekStart(phase,date);
  const prior=(Array.isArray(ams)?ams:[]).filter(l=>l&&l.story&&typeof l.story==='object'&&!Array.isArray(l.story)&&String(l.date)<String(date)&&(!ws||String(l.date)>=ws))
    .sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const last=prior[prior.length-1];
  return {...r,week_start:ws,episode:prior.length+1,series:last?String(last.story.series||''):null,
    previous:prior.map(l=>({date:l.date,episode:l.story.episode,title:(l.reading&&l.reading.title)||'',next_cn:l.story.next_cn||''}))};
}
function describe(date,session,root=REPO){
  const phase=load(root),active=on(phase,date);
  if(!active)return {date,session:session||null,active:false,note:'复习阶段未启用：按现在的说明书和规则出课，忽略 docs/tasks/REVIEW-PHASE.md。'};
  const plan=dayPlan(phase,date,loadThemes(root));
  return {date,session:session||null,active:true,activated_at:phase.activated_at,counts:counts(phase,date),plan,
    recurrence_min:session?recurrenceMin(phase,date,session):phase.recurrence_min||null,
    ...(session==='am'?{story:storyPlan(phase,date,weekAms(phase,date,root))}:{}),
    note:'复习阶段已启用：按 docs/tasks/REVIEW-PHASE.md 出课（数量、结构以本输出为准）。'};
}
if(require.main===module){
  const a={};const v=process.argv.slice(2);for(let i=0;i<v.length;i+=2)a[String(v[i]).replace(/^--/,'')]=v[i+1];
  if(!validDate(a.date)){console.error('--date YYYY-MM-DD required');process.exit(2)}
  console.log(JSON.stringify(describe(a.date,a.session),null,2));
}
module.exports={load,on,counts,recurrenceMin,loadThemes,dayPlan,goals,storyRule,weekStart,weekAms,storyPlan,describe,LEGACY,ROLES,PM_FIVE_FROM,PM_FIVE};
