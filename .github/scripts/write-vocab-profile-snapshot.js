'use strict';
const fs=require('fs');
const path=require('path');
const PROFILE='data/vocab-profile.json';
const RUNTIME='data/learning-runtime.json';
const WEAK='data/weakness-sync.json';
const HISTORY='data/vocab-profile-history.json';
function read(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
function validDate(s){return typeof s==='string'&&Number.isFinite(Date.parse(s));}
function jakartaDate(iso){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));}
function build(){
 const p=read(PROFILE),r=read(RUNTIME),w=read(WEAK);
 if(!validDate(p.generated_at)||!validDate(r.generated_at)||!validDate(w.updated_at))throw Error('Missing valid source timestamp');
 if(p.source_updated_at!==w.updated_at||r.weakness_updated_at!==w.updated_at)throw Error('Source watermark mismatch');
 const keys=['taught_total','confirmed_mastered','needs_reinforcement','unverified'];
 if(keys.some(k=>!Number.isSafeInteger(p[k])||p[k]<0))throw Error('Invalid profile count');
 if(p.confirmed_mastered+p.needs_reinforcement+p.unverified!==p.taught_total)throw Error('Invalid partition');
 if(p.taught_total!==r.stats.daily_taught_unique||p.needs_reinforcement!==r.stats.review_pool_total_full)throw Error('Runtime mismatch');
 const now=new Date().toISOString(),date=jakartaDate(now);
 // A snapshot is a daily observation, never reconstructed from later totals.
 const row={date,generated_at:now};
 for(const k of keys)row[k]=p[k];
 for(const k of ['active_vocab','passive_vocab','forgotten','relearned']){
   if(Number.isSafeInteger(p[k])&&p[k]>=0)row[k]=p[k];
 }
 const old=fs.existsSync(HISTORY)?read(HISTORY):{version:1,timezone:'Asia/Jakarta',snapshots:[]};
 if(old.version!==1||old.timezone!=='Asia/Jakarta'||!Array.isArray(old.snapshots))throw Error('Invalid history schema');
 if(old.snapshots.some(x=>!/^\d{4}-\d{2}-\d{2}$/.test(x.date)))throw Error('Invalid historical date');
 const map=new Map(old.snapshots.map(x=>[x.date,x]));
 if(map.size!==old.snapshots.length)throw Error('Duplicate existing history date');
 const prev=map.get(date);
 if(prev&&keys.every(k=>prev[k]===row[k])&&['active_vocab','passive_vocab','forgotten','relearned'].every(k=>prev[k]===row[k])){
   console.log('Daily snapshot unchanged');return;
 }
 map.set(date,row);
 const out={version:1,timezone:'Asia/Jakarta',snapshots:[...map.values()].sort((a,b)=>a.date.localeCompare(b.date))};
 const tmp=HISTORY+'.tmp';fs.writeFileSync(tmp,JSON.stringify(out,null,2)+'\n');fs.renameSync(tmp,HISTORY);
 console.log('Snapshot upserted:',date);
}
build();
