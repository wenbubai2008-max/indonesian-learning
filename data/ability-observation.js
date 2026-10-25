// 2026-10-25 (review-phase plan, phase 1 — observation only, user-approved): review load and ability indicators,
// computed on this device from the existing training records. READ-ONLY: it never writes storage, never changes
// due dates, mastery, the weakness pool or lesson selection, and nothing else reads its results.
//   识别达标  quick practice review_level ≥ 3 (three cross-day passes, the trainer's own "visual recognition stable")
//   听觉识别  listening fast_first_hear_streak ≥ 3 (shown separately)
//   主动掌握  automatic training status 'stable' (three delayed typed recalls 2/4/7 days apart, no options)
//   要快      automatic-training first recall ≤ 5 s (last_recall_ms); listening keeps its own 3-second figure
// The three ability counts may overlap and are never added together; 确认掌握 keeps its original definition.
// Every number says where it comes from: training progress is merged across devices by training-sync-client.js,
// so it is "complete" only when this device pulled from the sync server today (Jakarta time).
(function(root){
  'use strict';
  const DAY=86400000,LONG_UNSEEN=30;
  const norm=s=>String(s||'').trim().toLowerCase();
  function jkt(t){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));}
  function read(k){try{const x=JSON.parse(root.localStorage.getItem(k)||'{}');return x&&typeof x==='object'&&!Array.isArray(x)?x:{};}catch(e){return {};}}
  function ts(v){if(!v)return 0;if(typeof v==='number')return v;const n=Date.parse(String(v).replace(' ','T'));return Number.isFinite(n)?n:0;}
  function byWord(m){const out={};Object.keys(m||{}).forEach(k=>{out[norm(k)]=m[k];});return out;}

  function source(now){
    const cfg=read('indo_weak_sync_config_v1'),meta=read('indo_training_sync_meta_v1');
    const configured=!!(cfg.endpoint&&cfg.key),lastPull=ts(meta.last_pull);
    const complete=configured&&lastPull>0&&jkt(lastPull)===jkt(now);
    return {configured,last_pull:lastPull?new Date(lastPull).toISOString():'',complete,
      label:complete?'已和其他设备同步（今天）':configured?'仅本机，今天还没从同步服务器拉取，可能不完整':'仅本机（这台设备没有设置同步），可能不完整'};
  }

  function compute(now=Date.now()){
    const taught=new Map();
    (root.DAILY_VOCAB_DB||[]).forEach(x=>{const k=norm(x&&x.word);if(k&&x.cn&&!taught.has(k))taught.set(k,{word:x.word,cn:x.cn,last_seen:x.last_seen||x.first_seen||''});});
    const pool=root.WeaknessPool;let mastered=new Set(),excluded=new Set();
    try{(pool&&pool.listMastered&&pool.listMastered()||[]).forEach(m=>mastered.add(norm(m&&m.word)));}catch(e){}
    try{taught.forEach((_,k)=>{if(pool&&pool.isExcluded&&pool.isExcluded(k))excluded.add(k);});}catch(e){}
    const quick=byWord(read('indo_quick_practice_state')),listen=byWord(read('indo_listen_stats_v1')),auto=byWord(read('indo_automation_training_state_v1'));
    const recall=byWord((read('indo_lesson_recall_v1').words)||{});

    // Abilities: current state of each trainer, counted over taught words.
    const ab={recognition:0,listening:0,active:0,fast:0,fast_measured:0,confirmed:0,active_and_confirmed:0,confirmed_without_active:0,active_not_confirmed:0};
    taught.forEach((_,k)=>{
      const q=quick[k]||{},l=listen[k]||{},a=auto[k]||{},isM=mastered.has(k);
      if(Number(q.review_level||0)>=3)ab.recognition++;
      if(Number(l.fast_first_hear_streak||0)>=3)ab.listening++;
      const act=a.status==='stable';if(act)ab.active++;
      const ms=a.last_recall_ms;if(typeof ms==='number'&&Number.isFinite(ms)){ab.fast_measured++;if(ms<=5000)ab.fast++;}
      if(isM){ab.confirmed++;if(act)ab.active_and_confirmed++;else ab.confirmed_without_active++;}else if(act)ab.active_not_confirmed++;
    });

    // Review load per trainer, from the trainers' own scheduler (VocabStudyCoach.candidates = the words that are ready
    // now, computed from one snapshot): practised words that are due, how many days overdue, and words never practised
    // in that trainer (listed apart, they are not a backlog). Mastered and excluded words are not scheduled.
    const coach=root.VocabStudyCoach,load={};
    ['quick','listen','auto'].forEach(mode=>{
      const r={due:0,never:0,buckets:{today:0,d1_3:0,d4_7:0,d8:0},max_overdue:0};
      let rows=[];try{rows=coach&&typeof coach.candidates==='function'?coach.candidates(mode,now)||[]:[];}catch(e){rows=[];}
      rows.forEach(x=>{
        if(!x)return;if(x.kind==='new'){r.never++;return;}
        r.due++;const od=x.due_at&&x.due_at!==Infinity?Math.max(0,Math.floor((now-x.due_at)/DAY)):0;
        r.max_overdue=Math.max(r.max_overdue,od);
        if(od===0)r.buckets.today++;else if(od<=3)r.buckets.d1_3++;else if(od<=7)r.buckets.d4_7++;else r.buckets.d8++;
      });
      load[mode]=r;
    });

    // Long unseen: taught, not mastered, not excluded, and neither a lesson nor any trainer nor the lesson-end recall
    // has touched it for 30+ days.
    const unseen=[];
    taught.forEach((it,k)=>{
      if(mastered.has(k)||excluded.has(k))return;
      const last=Math.max(ts(it.last_seen),ts((quick[k]||{}).last),ts((listen[k]||{}).last_at),ts((auto[k]||{}).last_at),ts((recall[k]||{}).at));
      const days=last?Math.floor((now-last)/DAY):null;
      if(days===null||days>=LONG_UNSEEN)unseen.push({word:it.word,cn:it.cn,days});
    });
    unseen.sort((a,b)=>(b.days==null?1e9:b.days)-(a.days==null?1e9:a.days)||a.word.localeCompare(b.word));
    return {at:new Date(now).toISOString(),source:source(now),taught:taught.size,abilities:ab,load,long_unseen:{days:LONG_UNSEEN,count:unseen.length,words:unseen.slice(0,12)}};
  }

  // Suggested goals (data/vocab-goals-suggested.json) are fetched only for this panel; nothing else reads them.
  let goals=null,goalsLoading=null;
  function loadGoals(){
    if(goals||goalsLoading||typeof root.fetch!=='function')return goalsLoading;
    goalsLoading=root.fetch('data/vocab-goals-suggested.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(j=>{goals=j;return j;}).catch(()=>null);
    return goalsLoading;
  }
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function card(v,label,note){return '<div><b>'+esc(v)+'</b><span>'+esc(label)+'</span>'+(note?'<small style="display:block;color:#667085">'+esc(note)+'</small>':'')+'</div>';}
  function html(now=Date.now()){
    let r=null;try{r=compute(now);}catch(e){}
    if(!r)return '<div class="vpSection"><div class="vpEmpty">复习负担与能力指标暂时无法计算。</div></div>';
    const a=r.abilities,src='<p class="vpCoverageNote" style="margin-top:0">数据来源：'+esc(r.source.label)+(r.source.last_pull?'，最近一次拉取 '+esc(new Date(r.source.last_pull).toLocaleString('zh-CN',{timeZone:'Asia/Jakarta',hour12:false})):'')+'。</p>';
    const names={quick:'快速',listen:'听词',auto:'自动'};
    const loadRows=Object.keys(names).map(m=>{const x=r.load[m];return '<tr><td>'+names[m]+'</td><td>'+x.due+'</td><td>'+x.buckets.today+'</td><td>'+x.buckets.d1_3+'</td><td>'+x.buckets.d4_7+'</td><td>'+x.buckets.d8+'</td><td>'+x.never+'</td></tr>';}).join('');
    let goalsBlock='<p class="vpCoverageNote" data-goals-pending>词汇目标建议加载中…</p>';
    if(goals&&goals.counts){const c=goals.counts.active;goalsBlock='<p class="vpCoverageNote">待强化的词：建议“会用” '+c.use+' 个（其中“要快” '+c.fast+' 个）、“会认” '+c.recognize+' 个、待确认 '+c.unsure+' 个。只是建议，不影响选词和复习。</p>';}
    return '<div class="vpSection" data-ability-observation><h3>复习负担与能力指标（观察中，不影响学习）</h3>'+src+
      '<div class="vpMiniStats">'+card(a.confirmed,'确认掌握','原定义不变')+card(a.active,'主动掌握','自动训练三次跨日验证')+card(a.recognition,'识别达标','快速练习跨日第 3 次通过')+card(a.listening,'听觉识别达标','连续 3 次第一遍 3 秒内听懂')+'</div>'+
      '<p class="vpCoverageNote">三个数可以重叠，不相加。确认掌握的 '+a.confirmed+' 个里，有主动掌握证据的 '+a.active_and_confirmed+' 个，没有的 '+a.confirmed_without_active+' 个；主动掌握但还没算确认掌握的 '+a.active_not_confirmed+' 个。自动训练第一关 5 秒内想出：'+a.fast+'/'+a.fast_measured+' 个。</p>'+
      '<div style="overflow-x:auto"><table class="vpLoadTable" style="width:100%;border-collapse:collapse;font-size:13px;text-align:center"><thead><tr><th style="text-align:left">训练</th><th>到期</th><th>当天</th><th>超1–3天</th><th>超4–7天</th><th>超8天+</th><th>未练过</th></tr></thead><tbody>'+loadRows+'</tbody></table></div><p class="vpCoverageNote">到期 = 现在就该复习、已经练过的词，按超过到期日几天分档；“未练过”是在这个训练里还没做过的已学词，不算积压。快速 = 快速练习，自动 = 自动训练。</p>'+
      '<p class="vpCoverageNote">长期未出现（课程和训练都 '+r.long_unseen.days+' 天以上没碰到，不含已掌握和退出训练的词）：'+r.long_unseen.count+' 个'+(r.long_unseen.words.length?'，例如 '+r.long_unseen.words.slice(0,8).map(x=>esc(x.word)).join('、'):'')+'。</p>'+
      goalsBlock+'</div>';
  }
  function refreshGoals(){
    const p=loadGoals();if(!p)return;
    p.then(()=>{const el=root.document&&root.document.querySelector('[data-ability-observation] [data-goals-pending]');if(el&&goals&&goals.counts){const c=goals.counts.active;el.removeAttribute('data-goals-pending');el.textContent='待强化的词：建议“会用” '+c.use+' 个（其中“要快” '+c.fast+' 个）、“会认” '+c.recognize+' 个、待确认 '+c.unsure+' 个。只是建议，不影响选词和复习。';}});
  }
  root.AbilityObservation={compute,html,refreshGoals};
})(typeof window!=='undefined'?window:globalThis);
