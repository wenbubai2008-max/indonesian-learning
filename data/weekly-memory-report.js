// 2026-10-16 (user-approved PR 4): weekly memory report for the vocabulary profile (「本周报告」 tab). Read-only.
// Sources on this device: DAILY_VOCAB_DB (first_seen), WeaknessPool mastered list, the dated answer log of the three
// formal trainers (VocabProfileEvidence), the three training states, and the lesson-end recall (indo_lesson_recall_v1).
// Self-reported recall is shown separately and never mixed into accuracy. Retention uses formal answers only, with a
// minimum sample; below it the report says 样本不足 instead of a percentage.
(function(root){
  'use strict';
  const DAY=86400000,MIN_SAMPLE=10;
  const norm=s=>String(s||'').trim().toLowerCase();
  function jkt(t){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));}
  function shift(d,n){return new Date(Date.parse(d+'T00:00:00Z')+n*DAY).toISOString().slice(0,10);}
  function diff(a,b){return Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/DAY);}
  function read(k){try{const x=JSON.parse(root.localStorage.getItem(k)||'{}');return x&&typeof x==='object'?x:{};}catch(e){return {};}}
  function ts(v){if(!v)return 0;if(typeof v==='number')return v;const n=Date.parse(String(v).replace(' ','T'));return Number.isFinite(n)?n:0;}
  const CORRECT={auto:['direct','slow','right','stable','self_checked'],quick:['right'],listen:['fast_first','slow']};
  const FAIL={auto:['fail'],quick:['wrong'],listen:['wrong']};
  function compute(now=Date.now()){
    const today=jkt(now),weekStart=shift(today,-6),d14=shift(today,-13);
    const items=new Map();
    (root.DAILY_VOCAB_DB||[]).forEach(x=>{const k=norm(x&&x.word),f=String(x&&x.first_seen||'').slice(0,10);if(k&&x.cn&&!items.has(k)&&/^\d{4}-\d{2}-\d{2}$/.test(f))items.set(k,{word:x.word,cn:x.cn,first:f});});
    // 1. New words this week (first taught D-6..D) and words taught 1-7 days ago (the ones that should be checked by now).
    let newThisWeek=0;const recent=[];
    items.forEach((x,k)=>{const age=diff(x.first,today);if(age>=0&&age<=6)newThisWeek++;if(age>=1&&age<=7)recent.push(k);});
    // 2. Newly confirmed mastered this week.
    let mastered=0;try{(root.WeaknessPool&&root.WeaknessPool.listMastered()||[]).forEach(m=>{const t=ts(m&&m.last_mastered);if(t&&jkt(t)>=weekStart)mastered++;});}catch(e){}
    // 3. Lesson-end recall (self-report) on recent words: coverage and the split of each word's first recall.
    const recall=read('indo_lesson_recall_v1').words||{},split={fast:0,slow:0,fail:0};let recalled=0;
    recent.forEach(k=>{const r=recall[k];const h=r&&(Array.isArray(r.hist)&&r.hist.length?r.hist:[r]).filter(x=>x&&x.day)[0];if(h&&split[h.result]!=null){recalled++;split[h.result]++;}});
    // 4. First formal verification: any quick / listen / auto answer recorded for the word.
    const quick=read('indo_quick_practice_state'),listen=read('indo_listen_stats_v1'),auto=read('indo_automation_training_state_v1');
    const has=(m,k,f)=>Object.keys(m).some(x=>norm(x)===k&&ts(m[x]&&m[x][f])>0);
    let verified=0;recent.forEach(k=>{if(has(auto,k,'last_at')||has(quick,k,'last')||has(listen,k,'last_at'))verified++;});
    // 5. Retention: formal answers in the last 7 days on words first taught 7-30 days before the answer; first answer per
    // word per day per trainer. Self-reports are not included.
    let ev=[];try{ev=(root.VocabProfileEvidence&&root.VocabProfileEvidence.records()||[]);}catch(e){}
    const seen=new Set();let n=0,right=0;
    ev.slice().sort((a,b)=>ts(a.at)-ts(b.at)).forEach(e=>{const k=norm(e.word),it=items.get(k);if(!it)return;const d=jkt(ts(e.at));if(d<weekStart||d>today)return;
      const age=diff(it.first,d);if(age<7||age>30)return;const id=e.source+'|'+k+'|'+d;if(seen.has(id))return;seen.add(id);
      if((CORRECT[e.source]||[]).includes(e.result)){n++;right++;}else if((FAIL[e.source]||[]).includes(e.result)||e.result==='hinted')n++;});
    const retention={n,right,enough:n>=MIN_SAMPLE,rate:n?Math.round(right*100/n):null,min:MIN_SAMPLE};
    // 6. Repeatedly forgotten (last 14 days): failures on at least 2 different days, formal or self-report.
    const fails=new Map();const addFail=(k,d,src)=>{if(!items.has(k)||d<d14||d>today)return;const s=fails.get(k)||new Set();s.add(d);fails.set(k,s);};
    ev.forEach(e=>{if((FAIL[e.source]||[]).includes(e.result))addFail(norm(e.word),jkt(ts(e.at)),e.source);});
    Object.keys(recall).forEach(k=>{const r=recall[k];(Array.isArray(r&&r.hist)?r.hist:[r]).forEach(h=>{if(h&&h.result==='fail')addFail(norm(k),h.day,'recall');});});
    const forgotten=[...fails].filter(([,s])=>s.size>=2).map(([k,s])=>({word:items.get(k).word,cn:items.get(k).cn,days:s.size})).sort((a,b)=>b.days-a.days||a.word.localeCompare(b.word));
    // 7. Practice over 14 days: formal answers per Jakarta day (lesson-end recall counted separately).
    const days=[];for(let i=13;i>=0;i--)days.push({day:shift(today,-i),formal:0,recall:0});
    const idx=Object.fromEntries(days.map((x,i)=>[x.day,i]));
    ev.forEach(e=>{const i=idx[jkt(ts(e.at))];if(i!=null)days[i].formal++;});
    Object.keys(recall).forEach(k=>{const r=recall[k];(Array.isArray(r&&r.hist)?r.hist:[r]).forEach(h=>{const i=h&&idx[h.day];if(i!=null)days[i].recall++;});});
    return {today,weekStart,newThisWeek,mastered,recentTotal:recent.length,recall:{covered:recalled,split},verified,retention,forgotten,days,
      activeDays:days.filter(x=>x.formal>0).length,formalTotal:days.reduce((a,x)=>a+x.formal,0)};
  }
  root.WeeklyMemoryReport={compute,MIN_SAMPLE};
})(typeof window!=='undefined'?window:globalThis);
