(function(root){
  'use strict';
  // One scheduler over three existing local skill records. Never changes lesson eligibility.
  const KNOWN_KEY='indo_vocab_coach_verify_requests_v1';
  const SESSION_KEY='indo_vocab_coach_daily_session_v1';
  const ROUND_KEY='indo_vocab_skill_rounds_v1';
  const HOUR=3600000,DAY=24*HOUR;
  const norm=s=>String(s||'').trim().toLowerCase();
  const time=v=>{const n=typeof v==='number'?v:Date.parse(String(v||''));return Number.isFinite(n)&&n>0?n:0};
  const read=(key,fallback)=>{try{const x=JSON.parse(root.localStorage.getItem(key)||'null');return x&&typeof x==='object'?x:fallback}catch(e){return fallback}};
  const write=(key,x)=>{try{root.localStorage.setItem(key,JSON.stringify(x));return true}catch(e){return false}};
  function day(now){const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now)),m=Object.fromEntries(p.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return m.year+'-'+m.month+'-'+m.day}
  function taught(){const m=new Map();(root.DAILY_VOCAB_DB||[]).forEach(x=>{const k=norm(x&&x.word);if(k&&x.cn&&!m.has(k))m.set(k,{word:x.word,cn:x.cn,last_seen:x.last_seen||x.first_seen||''})});return m}
  function snapshot(){const mastered={};try{if(root.WeaknessPool&&root.WeaknessPool.listMastered)root.WeaknessPool.listMastered().forEach(x=>{mastered[norm(x.word)]=x})}catch(e){}
    let weak={};try{if(root.WeaknessPool)weak=root.WeaknessPool.focusMap?root.WeaknessPool.focusMap():root.WeaknessPool.activeMap()}catch(e){}
    return {items:taught(),mastered,weak:weak||{},quick:read('indo_quick_practice_state',{}),listen:read('indo_listen_stats_v1',{}),auto:read('indo_automation_training_state_v1',{}),requests:read(KNOWN_KEY,{})};
  }
  function status(mode,word,now=Date.now(),src){
    const s=src||snapshot(),k=norm(word),item=s.items.get(k);if(!item||!['quick','listen','auto'].includes(mode))return null;
    const old=s[mode][k]||s[mode][item.word]||{},mastered=s.mastered[k]||null,weak=s.weak[k]||null;
    let last=0,due=0,level=0,stable=false,kind='new',lastResult='',score=0;
    if(mode==='quick'){
      last=time(old.last);level=Number(old.review_level||0);lastResult=old.last_result||'';
      if(last){due=time(old.review_due)||last+(lastResult==='wrong'?15*60000:Number(old.streak)>=3?48*HOUR:Number(old.streak)===2?20*HOUR:6*HOUR);kind='review'}
      else if(mastered){due=time(mastered.last_mastered)+30*DAY||0;kind='legacy_stable'}
      stable=level>=3||!!mastered&&!last;
      if(level>=3)kind='stable';
      score=(lastResult==='wrong'?95:0)+(weak&&weak.reasons&&weak.reasons.includes('quick_wrong')?65:0)+(!last&&!mastered?25:0);
    }else if(mode==='listen'){
      last=time(old.last_at);level=Number(old.review_level||0);lastResult=old.last_result||'';
      if(last){due=time(old.review_due)||last+(lastResult==='wrong'?3*HOUR:Number(old.last_replays)>0||Number(old.last_ms)>3000?5*HOUR:8*HOUR);kind='review'}
      stable=level>=3;if(stable)kind='stable';
      score=(lastResult==='wrong'?100:0)+(Number(old.wrong_streak)>=2?90:0)+(Number(old.slow_streak)>=2?55:0)+(!last?25:0);
    }else{
      last=time(old.last_at);level=Number(old.stage||1);lastResult=old.last_result||'';
      due=time(old.next_due)||last+(lastResult==='fail'?6*HOUR:20*HOUR);
      stable=old.status==='stable'||!!mastered&&!last;
      if(mastered&&!last)due=Infinity;
      kind=stable?'stable':last?'review':'new';
      const req=s.requests[k];if(req){due=Math.max(due===Infinity?0:due,Number(req.due_at)||time(req.requested_at)+DAY);kind='verification'}
      score=(lastResult==='fail'?110:0)+(old.status==='active'?55:0)+(weak&&weak.reasons&&weak.reasons.includes('automation_fail')?90:0)+(req?130:0)+(!last&&!mastered?22:0);
    }
    const lastToday=last>0&&day(last)===day(now);
    const overdue=due&&due!==Infinity?Math.max(0,Math.floor((now-due)/DAY)):0;
    score+=Math.min(110,overdue*3)+(stable?0:18);
    const ready=now>=due&&!lastToday;
    return {word:item.word,cn:item.cn,mode,stage:mode==='auto'?Math.max(1,Math.min(4,level)):1,score,due_at:due,last_at:last,ready,stable,kind,last_result:lastResult,level,weak:!!weak,last_today:lastToday};
  }
  function candidates(mode,now=Date.now()){
    const s=snapshot(),rows=[];s.items.forEach((_,k)=>{const x=status(mode,k,now,s);if(x&&x.ready)rows.push(x)});
    rows.sort((a,b)=>{
      const category=x=>x.kind==='stable'||x.kind==='legacy_stable'?2:x.kind==='new'?1:0;
      if(category(a)!==category(b))return category(a)-category(b);
      return b.score-a.score||(a.due_at||0)-(b.due_at||0)||a.word.localeCompare(b.word);
    });
    // Due/weak words first, then unverified words and long-term checks. No random starvation.
    return rows;
  }
  function statistics(mode,now=Date.now()){
    const s=snapshot(),result={taught:s.items.size,due:0,future:0,stable:0,unverified:0,today:0};
    s.items.forEach((_,k)=>{const x=status(mode,k,now,s);if(!x)return;if(x.stable)result.stable++;if(x.kind==='new')result.unverified++;if(x.last_today)result.today++;else if(x.ready)result.due++;else result.future++});return result;
  }
  function round(mode,now=Date.now(),advance=false,max=10){
    if(!['quick','listen','auto'].includes(mode))return [];
    const all=read(ROUND_KEY,{}),d=day(now),old=all[mode],valid=old&&old.version===1&&old.day===d&&Array.isArray(old.items);
    const pending=valid?old.items.filter(k=>!old.done||!old.done[k]).filter(k=>{const x=status(mode,k,now);return x&&x.ready}):[];
    if(valid&&pending.length)return pending.map(k=>status(mode,k,now)).filter(Boolean);
    if(valid&&!advance)return [];
    const next=candidates(mode,now).slice(0,Math.max(0,max));
    all[mode]={version:1,day:d,items:next.map(x=>norm(x.word)),done:{}};write(ROUND_KEY,all);return next;
  }
  function markAnswer(mode,word,ok,now=Date.now(),quality){
    const k=norm(word);if(!taught().has(k))return null;
    if(mode==='quick'||mode==='listen'){
      const key=mode==='quick'?'indo_quick_practice_state':'indo_listen_stats_v1',all=read(key,{}),p=all[k]||{},d=day(now);
      // Keep original totals intact; old undated streaks are not invented as cross-day successes.
      if(p.review_last_counted_day!==d){
        if(mode==='quick'&&ok||mode==='listen'&&ok&&quality==='fast_first'){
          let level=Math.max(0,Number(p.review_level||0));
          if(level===0)p.review_first_day=d;
          level=Math.min(5,level+1);
          p.review_level=level;p.review_due=now+([0,2,7,30,90,180][level]||180)*DAY;
        }else{
          if(!ok){p.review_level=0;p.review_first_day=''}
          p.review_due=now+(ok?2:1)*DAY;
        }
        p.review_last_counted_day=d;
        all[k]=p;write(key,all);
      }
    }
    const all=read(ROUND_KEY,{}),r=all[mode];if(r&&r.day===day(now)&&r.items&&r.items.includes(k)){r.done=r.done||{};r.done[k]=true;write(ROUND_KEY,all)}
    const session=read(SESSION_KEY,{});if(session&&session.version===2&&session.day===day(now)&&session.items){
      const id=mode+'|'+k;if(session.items.some(x=>x.mode===mode&&norm(x.word)===k)){session.done=session.done||{};session.done[id]=true;write(SESSION_KEY,session)}
    }
    try{root.dispatchEvent(new CustomEvent('vocab-coach-updated',{detail:{word:k,mode}}))}catch(e){}
    return status(mode,k,now);
  }
  function dailySession(now=Date.now()){
    const old=read(SESSION_KEY,{}),d=day(now);
    if(old.version===2&&old.day===d&&Array.isArray(old.items))return old;
    const all=[];for(const mode of ['auto','listen','quick']){
      const quota=mode==='auto'?3:mode==='listen'?3:2;
      candidates(mode,now).slice(0,quota).forEach(x=>all.push({word:x.word,mode,stage:x.stage}));
    }
    const s={version:2,day:d,items:all,done:{}};write(SESSION_KEY,s);return s;
  }
  function plan(now=Date.now()){
    const s=dailySession(now),src=snapshot();return s.items.filter(x=>!s.done[x.mode+'|'+norm(x.word)]).map(x=>{
      const v=status(x.mode,x.word,now,src);return v&&v.ready?Object.assign({},v,{note:x.mode==='quick'?'识别能力到期验证':x.mode==='listen'?'听觉识别到期验证':'主动提取或跨日验证'}):null;
    }).filter(Boolean);
  }
  function progress(now=Date.now()){const s=dailySession(now);return {total:s.items.length,done:Object.keys(s.done||{}).length,remaining:plan(now).length,waiting:s.items.length-Object.keys(s.done||{}).length-plan(now).length}}
  function detail(word,now=Date.now()){
    const s=snapshot(),rows=['auto','listen','quick'].map(m=>status(m,word,now,s)).filter(Boolean);if(!rows.length)return null;
    rows.sort((a,b)=>Number(b.ready)-Number(a.ready)||b.score-a.score);
    const x=rows[0],ev=root.VocabProfileEvidence?root.VocabProfileEvidence.records().filter(y=>norm(y.word)===norm(word)):[];
    const ability=root.VocabProfileEvidence?root.VocabProfileEvidence.summarize().words.find(y=>norm(y.word)===norm(word)):null;
    const req=s.requests[norm(word)];return Object.assign({},x,{events:ev,ability,requested:!!req,skills:Object.fromEntries(rows.map(y=>[y.mode,y])),note:x.mode==='auto'?'检查主动提取与语境应用':x.mode==='listen'?'检查首次听音识别':'检查选择识别'});
  }
  function requestVerification(word,now=Date.now()){
    const k=norm(word);if(!taught().has(k))return false;const x=read(KNOWN_KEY,{});x[k]={requested_at:new Date(now).toISOString(),due_at:now+DAY};if(!write(KNOWN_KEY,x))return false;
    try{root.dispatchEvent(new CustomEvent('vocab-coach-updated',{detail:{word:k}}))}catch(e){}return true;
  }
  function clearRequest(word,at){const k=norm(word),all=read(KNOWN_KEY,{});if(!all[k]||time(at)<Number(all[k].due_at))return;delete all[k];write(KNOWN_KEY,all)}
  const assigned=(mode,now=Date.now())=>plan(now).filter(x=>x.mode===mode);
  const eligible=(word,now=Date.now(),mode='auto')=>{const x=status(mode,word,now);return !!x&&x.ready};
  const eligibleSet=(now=Date.now(),mode='auto')=>new Set(candidates(mode,now).map(x=>norm(x.word)));
  root.VocabStudyCoach={day,status,candidates,statistics,round,markAnswer,plan,assigned,assignedSet:(mode,now=Date.now())=>new Set(assigned(mode,now).map(x=>norm(x.word))),dailyProgress:progress,detail,eligible,eligibleSet,supplement:(mode,now=Date.now(),max=10)=>candidates(mode,now).slice(0,max),quickSupplement:(now=Date.now(),max=10)=>candidates('quick',now).slice(0,max),pendingSet:()=>new Set(Object.keys(read(KNOWN_KEY,{}))),requestVerification,clearRequest,words:()=>[...taught().values()]};
  root.addEventListener('automation-training-updated',e=>{const d=e&&e.detail||{};if(d.word&&d.state)clearRequest(d.word,d.state.last_at)});
})(window);
