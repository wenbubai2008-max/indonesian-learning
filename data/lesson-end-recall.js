// 2026-10-16 (user-approved PR 2): lesson-end recall, shown on today's 08:00 / 18:00 lesson just above 「我学完了」.
// 08:00: the words first taught in yesterday's 08:00 lesson (the real count, never padded; none → no section).
// 18:00: the words first taught in yesterday's evening lesson + 2–3 backlog words (taught 2–30 days ago, no automatic-
// training record yet, not recalled since yesterday). Mastered words and words practised today are skipped.
// Flow: Chinese → 「想到了 / 想不起来」 → answer + audio → 「对，很快 / 对，有点慢 / 不对」. Results go to
// indo_lesson_recall_v1 only: first attempt per word per day counts, later attempts never overwrite it. It is a self-
// report, so it never counts as a training pass, never marks mastery, never moves due dates and never calls
// WeaknessPool.recordLessonWrong. The training scheduler only uses it to reorder recent new words (vocab-study-coach.js).
// Optional: 「我学完了」 is never blocked.
(function(){
  if(window.__lessonEndRecallLoaded)return;
  window.__lessonEndRecallLoaded=true;
  const KEY='indo_lesson_recall_v1',DAY=86400000,HIST_MAX=20,LESSONS_MAX=10;
  const root=window;
  function norm(s){return String(s||'').trim().toLowerCase();}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function jkt(now){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));}
  function shift(day,n){return new Date(Date.parse(day+'T00:00:00Z')+n*DAY).toISOString().slice(0,10);}
  function diff(a,b){return Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/DAY);}
  function ts(v){const n=Date.parse(String(v||''));return Number.isFinite(n)?n:0;}
  function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'{}');return {version:1,words:x&&x.words&&typeof x.words==='object'?x.words:{},lessons:x&&x.lessons&&typeof x.lessons==='object'?x.lessons:{}};}catch(e){return {version:1,words:{},lessons:{}};}}
  function save(s){try{localStorage.setItem(KEY,JSON.stringify(s));return true;}catch(e){return false;}}

  // Per word: history keeps one entry per day (the earliest attempt); the top-level day/result/at mirror the latest day.
  // Used locally and by training-sync-client.js; the Worker applies the same rule, so two devices never overwrite the
  // day's first recall with a later one.
  function mergeRecord(a,b){
    const by={};
    [a,b].forEach(r=>{if(!r||typeof r!=='object')return;const hist=Array.isArray(r.hist)&&r.hist.length?r.hist:(r.day?[{day:r.day,result:r.result,at:r.at,lesson:r.lesson}]:[]);
      hist.forEach(h=>{if(!h||!/^\d{4}-\d{2}-\d{2}$/.test(h.day||'')||!['fast','slow','fail'].includes(h.result))return;const cur=by[h.day];if(!cur||ts(h.at)<ts(cur.at))by[h.day]={day:h.day,result:h.result,at:h.at,lesson:h.lesson||''};});});
    const hist=Object.keys(by).sort().slice(-HIST_MAX).map(d=>by[d]);if(!hist.length)return null;
    const top=hist[hist.length-1];return {day:top.day,result:top.result,at:top.at,lesson:top.lesson,hist};
  }

  function taughtOn(date,session){
    // session 'am' = first taught at 08:00; 'pm' = first taught in the evening lesson (18:00, 19:00 before 2026-09-16).
    const out=[],seen=new Set();
    (root.DAILY_VOCAB_DB||[]).forEach(x=>{const f=String(x&&x.first_seen||''),k=norm(x&&x.word);if(!k||!x.cn||seen.has(k)||f.slice(0,10)!==date)return;
      const am=f.slice(11,16)==='08:00';if((session==='am')!==am)return;seen.add(k);out.push({word:x.word,cn:x.cn,first:f.slice(0,10)});});
    return out;
  }
  function masteredSet(){try{return new Set((root.WeaknessPool&&root.WeaknessPool.all()||[]).filter(x=>x&&x.status==='mastered').map(x=>norm(x&&x.word)));}catch(e){return new Set();}}
  function practicedToday(word,now){const c=root.VocabStudyCoach;if(!c||typeof c.status!=='function')return false;
    return ['quick','listen','auto'].some(m=>{try{const s=c.status(m,word,now);return !!(s&&s.last_today);}catch(e){return false;}});}
  function autoChecked(word,now){const c=root.VocabStudyCoach;try{const s=c&&c.status('auto',word,now);return !!(s&&s.last_at);}catch(e){return false;}}
  const RANK={fail:0,slow:1,'':2,fast:3};

  // Picks are frozen per lesson so a refresh shows the same words with their answers.
  // 2026-10-18: words named in a lesson's 今天的重点 (remembered by history-v2.js) are asked first. Ordering only: the
  // eligibility filters (mastered, practised today, recalled since yesterday) and first-attempt-wins are unchanged.
  function focusSet(){try{const l=(JSON.parse(localStorage.getItem('indo_lesson_focus_v1')||'{}').lessons)||{};return new Set(Object.values(l).flatMap(x=>Array.isArray(x&&x.words)?x.words:[]).map(norm));}catch(e){return new Set();}}
  function select(date,session,now=Date.now()){
    const state=load(),id=date+'-'+session;
    if(state.lessons[id]&&Array.isArray(state.lessons[id].words)){const mastered=masteredSet();return state.lessons[id].words.filter(w=>!mastered.has(norm(w.word))).slice();}
    const mastered=masteredSet(),yesterday=shift(date,-1);
    const ok=x=>!mastered.has(norm(x.word))&&!practicedToday(x.word,now);
    const main=taughtOn(yesterday,session).filter(ok);
    const focus=focusSet(),fo=w=>focus.has(norm(w))?0:1;
    let words=main.map(x=>({word:x.word,cn:x.cn,group:'yesterday'})).sort((a,b)=>fo(a.word)-fo(b.word));
    if(session==='pm'){
      const taken=new Set(words.map(x=>norm(x.word))),pool=[],seen=new Set();
      (root.DAILY_VOCAB_DB||[]).forEach(x=>{const k=norm(x&&x.word),f=String(x&&x.first_seen||'').slice(0,10);if(!k||!x.cn||seen.has(k)||taken.has(k)||!/^\d{4}-\d{2}-\d{2}$/.test(f))return;seen.add(k);
        const age=diff(f,date);if(age<2||age>30||!ok(x)||autoChecked(x.word,now))return;
        const r=state.words[k];if(r&&r.day>=yesterday)return; // recalled at the previous lesson end or earlier today
        pool.push({word:x.word,cn:x.cn,age,prev:r&&r.result||''});});
      const rank=x=>RANK[x.prev]-(focus.has(norm(x.word))?0.5:0); // a focus word comes right after earlier misses
      const sort=(a,b)=>(rank(a)-rank(b))||(b.age-a.age)||a.word.localeCompare(b.word);
      const g=[pool.filter(x=>x.age<=7).sort(sort),pool.filter(x=>x.age>7).sort(sort)];
      const n=Math.max(2,Math.min(3,7-words.length)),take=[Math.min(g[0].length,n-1),Math.min(g[1].length,1)];
      let left=n-take[0]-take[1];for(let i=0;i<2&&left>0;i++){const more=Math.min(left,g[i].length-take[i]);take[i]+=more;left-=more;}
      g.forEach((arr,i)=>arr.slice(0,take[i]).forEach(x=>words.push({word:x.word,cn:x.cn,group:'backlog'})));
    }
    if(words.length){
      state.lessons[id]={words,created_at:new Date(now).toISOString()};
      const ids=Object.keys(state.lessons).sort();ids.slice(0,Math.max(0,ids.length-LESSONS_MAX)).forEach(k=>delete state.lessons[k]);
      save(state);
    }
    return words;
  }
  function todayResult(word,now=Date.now()){const r=load().words[norm(word)],d=jkt(now);if(!r)return '';const h=(r.hist||[]).find(x=>x.day===d);return h?h.result:(r.day===d?r.result:'');}
  // First attempt of the day wins; a later attempt (another tap, after seeing the answer) is ignored.
  function record(word,result,lesson,now=Date.now()){
    if(!['fast','slow','fail'].includes(result))return false;
    const s=load(),k=norm(word),d=jkt(now);if(!k)return false;
    if(todayResult(word,now))return false;
    s.words[k]=mergeRecord(s.words[k],{day:d,result,at:new Date(now).toISOString(),lesson:lesson||''});
    const ok=save(s);
    if(ok)try{root.dispatchEvent(new CustomEvent('lesson-recall-updated',{detail:{word:k,result}}));}catch(e){}
    return ok;
  }
  function syncLabel(){
    try{const t=root.TrainingSync;if(t&&typeof t.recallStatus==='function')return t.recallStatus();}catch(e){}
    return 'local';
  }

  // ---------- UI ----------
  const LABEL={fast:'马上想到',slow:'想得慢',fail:'没想起来'};
  function css(){
    if(document.getElementById('lessonRecallStyle'))return;
    const st=document.createElement('style');st.id='lessonRecallStyle';
    st.textContent='.lessonRecall .lrIntro{color:#5b6475;font-size:14px;margin:4px 0 10px}.lessonRecall .lrList{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}@media(min-width:640px){.lessonRecall .lrList{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(min-width:900px){.lessonRecall .lrList{grid-template-columns:repeat(4,minmax(0,1fr))}}.lessonRecall .lrItem{border:1px solid #e3e8f0;border-radius:10px;padding:8px 8px 9px;background:#fbfcfe;display:flex;flex-direction:column;justify-content:space-between;gap:6px;text-align:center;min-width:0}.lessonRecall .lrCn{font-weight:600;font-size:14px;line-height:1.35;color:#475467;overflow-wrap:anywhere}.lessonRecall .lrTag{display:block;font-size:11px;color:#7a8396;font-weight:400}.lessonRecall .lrBtns{display:flex;flex-wrap:wrap;justify-content:center;gap:4px}.lessonRecall .lrBtns button{border:1px solid #cfd7e4;background:#fff;border-radius:999px;padding:3px 9px;font-size:13px;line-height:1.4;cursor:pointer;white-space:nowrap}.lessonRecall .lrAns{display:none;font-size:15px}.lessonRecall .lrItem.open .lrAns{display:block}.lessonRecall .lrAns b{color:#1d4ed8}.lessonRecall .lrSpeak{border:0;background:none;cursor:pointer;font-size:14px;padding:0 2px}.lessonRecall .lrDone{font-size:12px;color:#4b5563}.lessonRecall .lrDone.fail{color:#b45309}.lessonRecall .lrFoot{margin-top:10px;font-size:13px;color:#6b7280}@media(max-width:639px){.lessonRecall .lrItem{padding:7px 5px 8px}.lessonRecall .lrBtns{gap:3px}.lessonRecall .lrBtns button{padding:3px 6px;font-size:12.5px}.lessonRecall .lrCn{font-size:13.5px}}';
    document.head.appendChild(st);
  }
  function itemHTML(x,i){
    const res=todayResult(x.word);
    const tag=x.group==='backlog'?'<span class="lrTag">前几天学的</span>':'';
    const ans='<div class="lrAns"><b>'+esc(x.word)+'</b> <button type="button" class="lrSpeak" data-say="'+esc(x.word)+'" aria-label="发音">🔊</button></div>';
    const body=res?'<div class="lrDone '+res+'">已回想：'+LABEL[res]+'</div>'
      :'<div class="lrBtns" data-step="1"><button type="button" data-act="know">想到了</button><button type="button" data-act="fail">想不出</button></div>';
    return '<div class="lrItem'+(res?' open':'')+'" data-i="'+i+'"><div class="lrCn">'+esc(x.cn)+tag+'</div>'+ans+body+'</div>';
  }
  function pending(sec){return [...sec.querySelectorAll('.lrItem')].filter(x=>!x.querySelector('.lrDone')).length;}
  function foot(sec){
    const n=pending(sec),f=sec.querySelector('.lrFoot');if(!f)return;
    const sync=syncLabel()==='synced'?'结果会同步到其他设备。':'仅本机保存。';
    f.textContent=(n?'还有 '+n+' 个没回想，可以跳过，不影响「我学完了」。':'都回想过了。想不起来的词会优先进入快速练习和自动训练。')+' 自评不算训练通过，也不计入掌握。'+sync;
  }
  function bind(sec,words,lessonId){
    sec.addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.dataset.say){try{root.speak&&root.speak(b.dataset.say);}catch(err){}return;}
      const item=b.closest('.lrItem');if(!item)return;const x=words[Number(item.dataset.i)];if(!x)return;
      const act=b.dataset.act,box=b.parentElement;
      const finish=res=>{record(x.word,res,lessonId);const r0=todayResult(x.word)||res;box.outerHTML='<div class="lrDone '+r0+'">已记录：'+LABEL[r0]+'</div>';foot(sec);};
      if(act==='know'){item.classList.add('open');box.innerHTML='<button type="button" data-act="fast">对·很快</button><button type="button" data-act="slow">对·有点慢</button><button type="button" data-act="wrong">不对</button>';return;}
      if(act==='fail'||act==='wrong'){item.classList.add('open');finish('fail');return;}
      if(act==='fast'||act==='slow')finish(act);
    });
  }
  function currentLesson(){
    const btn=document.querySelector('#daily button[onclick*="completeSession"]');
    const m=btn&&String(btn.getAttribute('onclick')||'').match(/completeSession\(\s*['"](\d{4}-\d{2}-\d{2})['"]\s*,\s*['"](am|pm)['"]/);
    return m?{date:m[1],session:m[2],btn}:null;
  }
  function place(body,sec,btn){
    let holder=btn.closest('div');while(holder&&holder.parentElement&&holder.parentElement!==body)holder=holder.parentElement;
    if(holder&&holder.parentElement===body){if(sec.nextElementSibling!==holder)body.insertBefore(sec,holder);}
    else if(sec.parentElement!==body)body.appendChild(sec);
  }
  function inject(){
    const daily=document.getElementById('daily'),body=document.getElementById('dailyBody');
    if(!body||(daily&&!daily.classList.contains('active')))return;
    const cur=currentLesson();if(!cur||cur.date!==jkt(Date.now()))return; // today's lesson only
    const old=body.querySelector('.lessonRecall');
    if(old){place(body,old,cur.btn);return;} // later sections (test, review) may be added after us: stay last
    const words=select(cur.date,cur.session);if(!words.length)return;
    css();
    const sec=document.createElement('section');sec.className='dailyFixSec lessonRecall';sec.dataset.lesson=cur.date+'-'+cur.session;
    const what=cur.session==='am'?'昨天早课的 '+words.length+' 个新词':'昨天晚课的新词和前几天学的词，共 '+words.length+' 个';
    sec.innerHTML='<h3><span class="dailyFixNo">↺</span>课末回想 · 约 1 分钟</h3><div class="lrIntro">'+what+'。先看中文，在心里或说出印尼语，再点「想到了」或「想不出」看答案。</div><div class="lrList">'+words.map(itemHTML).join('')+'</div><div class="lrFoot"></div>';
    place(body,sec,cur.btn);
    bind(sec,words,cur.date+'-'+cur.session);foot(sec);
  }
  function schedule(){setTimeout(inject,0);setTimeout(inject,600);setTimeout(inject,1500);}
  const base=root.openDaily;
  if(typeof base==='function'&&!base.__lessonRecall){
    const wrapped=async function(){const out=await base.apply(this,arguments);schedule();return out;};
    wrapped.__lessonRecall=true;root.openDaily=wrapped;
  }
  const body=document.getElementById('dailyBody');
  if(body&&typeof MutationObserver==='function')new MutationObserver(()=>setTimeout(inject,0)).observe(body,{childList:true});
  root.addEventListener('training-sync-recall',()=>{const s=document.querySelector('.lessonRecall');if(s)foot(s);});
  root.LessonRecall={KEY,select,record,todayResult,mergeRecord,taughtOn,load};
})();
