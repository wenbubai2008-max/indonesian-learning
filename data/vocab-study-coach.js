(function(root){
  'use strict';
  // A read-only scheduling overlay: never changes lesson eligibility or source status.
  const KNOWN_KEY='indo_vocab_coach_verify_requests_v1';
  const HOUR=3600000,DAY=24*HOUR;
  const norm=s=>String(s||'').trim().toLowerCase();
  const time=v=>{const n=typeof v==='number'?v:Date.parse(String(v||''));return Number.isFinite(n)&&n>0?n:0;};
  const read=(key,fallback)=>{try{const x=JSON.parse(root.localStorage.getItem(key)||'null');return x&&typeof x==='object'?x:fallback}catch(e){return fallback}};
  const taught=()=>{const map=new Map();(Array.isArray(root.DAILY_VOCAB_DB)?root.DAILY_VOCAB_DB:[]).forEach(x=>{const k=norm(x&&x.word);if(k&&x.cn&&!map.has(k))map.set(k,{word:x.word,cn:x.cn,example:x.example||'',last_seen:x.last_seen||x.first_seen||''})});return map};
  const known=()=>read(KNOWN_KEY,{});
  function evidence(){
    const out=new Map();
    const api=root.VocabProfileEvidence;
    if(!api)return out;
    api.records().forEach(x=>{const k=norm(x.word),arr=out.get(k)||[];arr.push(x);out.set(k,arr)});
    return out;
  }
  function weak(){
    try{
      const api=root.WeaknessPool;
      if(!api)return {};
      return typeof api.focusMap==='function'?api.focusMap():typeof api.activeMap==='function'?api.activeMap():{};
    }catch(e){return {}}
  }
  function inputs(){
    return {items:taught(),ev:evidence(),weak:weak(),quick:read('indo_quick_practice_state',{}),auto:read('indo_automation_training_state_v1',{}),listen:read('indo_listen_stats_v1',{}),requests:known(),memory:read('indo_mem',{}),abilities:root.VocabProfileEvidence?root.VocabProfileEvidence.summarize().words:[]};
  }
  function describe(word,source,now){
    const k=norm(word),item=source.items.get(k);
    if(!item)return null;
    const ev=source.ev.get(k)||[],last=ev[ev.length-1]||null,req=source.requests[k]||null,st=source.auto[k]||{},q=source.quick[k]||{},l=source.listen[k]||{};
    const w=source.weak[k]||null,reason=w&&Array.isArray(w.reasons)?w.reasons:[];
    const ability=source.abilities.find(x=>norm(x.word)===k)||null;
    const lastAt=last?time(last.at):0,requestedAt=req?time(req.requested_at):0;
    let due=0;
    if(last){
      if(last.source==='auto'){
        const fallback=last.result==='fail'?3*HOUR:last.result==='hinted'?20*HOUR:last.result==='stable'?14*DAY:20*HOUR;
        due=lastAt+fallback;
        if(time(st.last_at)===lastAt&&time(st.next_due))due=time(st.next_due);
      }else if(last.source==='quick')due=lastAt+(last.result==='wrong'?3*HOUR:6*HOUR);
      else due=lastAt+(last.result==='wrong'?3*HOUR:last.result==='slow'?5*HOUR:8*HOUR);
    }
    if(req&&requestedAt>=lastAt)due=Math.max(due,Number(req.due_at)||requestedAt+DAY);
    const requested=!!req&&requestedAt>=lastAt;
    const errors=Number(q.wrong||0)+Number(st.failures||0);
    const listeningProblem=reason.includes('listening_wrong')||reason.includes('listening_slow')||l.last_result==='wrong'&&Number(l.wrong_streak||0)>=2;
    const quickProblem=reason.includes('quick_wrong')||q.last_result==='wrong';
    let mode='auto',note='需要确认能否无提示主动说出';
    if(requested){mode='auto';note='你标记了“我会了”，等待一次跨日主动验证';}
    else if(listeningProblem){mode='listen';note='听词识别不稳定，先练听觉';}
    else if(ability&&ability.passive){mode='auto';note='已能识别，但还需要主动提取';}
    else if(st.attempts){mode='auto';note='自动训练第'+Math.max(1,Math.min(4,Number(st.stage)||1))+'关等待验证';}
    else if(quickProblem){mode='auto';note='选择题曾答错，改用无提示提取确认';}
    else if(w){mode='auto';note='已学弱词，优先确认能否主动提取';}
    else if(q.last_result==='right'){mode='auto';note='识别答对后，下一次检查主动回忆';}
    else if(l.last_result==='wrong'){mode='listen';note='听词答错，需要隔开时间再听';}
    else note='正式学过，等待首次主动验证';
    const focus=!!w||errors>0||!!st.attempts||!!q.last||!!l.attempts||!!ability||requested;
    const stable=!!(ability&&ability.active)&&!listeningProblem&&!requested;
    const priority=(requested?220:0)+(listeningProblem?85:0)+(quickProblem?50:0)+(ability&&ability.passive?70:0)+(w?45:0)+Math.min(40,errors*5)+(st.attempts?25:0)+(due&&now>=due?12:0);
    return {word:item.word,cn:item.cn,mode,note,focus,stable,due_at:due,ready:now>=due,requested,score:priority,events:ev,ability,stage:requested?1:Math.max(1,Math.min(4,Number(st.stage)||1)),last_at:last?last.at:'',errors};
  }
  function plan(now=Date.now(),max=8){
    const input=inputs(),out=[];
    input.items.forEach((v,k)=>{
      const x=describe(k,input,now);
      if(x&&x.focus&&!x.stable&&x.ready)out.push(x);
    });
    out.sort((a,b)=>b.score-a.score||a.word.localeCompare(b.word));
    return out.slice(0,max);
  }
  function detail(word,now=Date.now()){return describe(word,inputs(),now)}
  function eligible(word,now=Date.now()){
    const x=detail(word,now);return !!x&&x.ready&&!x.stable;
  }
  function requestVerification(word,now=Date.now()){
    const k=norm(word);if(!taught().has(k))return false;
    const entries=known();
    entries[k]={requested_at:new Date(now).toISOString(),due_at:now+DAY};
    try{root.localStorage.setItem(KNOWN_KEY,JSON.stringify(entries))}catch(e){return false}
    root.dispatchEvent(new CustomEvent('vocab-coach-updated',{detail:{word:k}}));
    return true;
  }
  function clearRequest(word){
    const k=norm(word),entries=known();if(!entries[k])return;
    delete entries[k];
    try{root.localStorage.setItem(KNOWN_KEY,JSON.stringify(entries))}catch(e){}
  }
  root.VocabStudyCoach={plan,detail,eligible,requestVerification,clearRequest};
  root.addEventListener('automation-training-updated',e=>{const word=e&&e.detail&&e.detail.word;if(word)clearRequest(word);root.dispatchEvent(new CustomEvent('vocab-coach-updated',{detail:{word}}))});
  root.addEventListener('vocab-profile-evidence-updated',e=>root.dispatchEvent(new CustomEvent('vocab-coach-updated',{detail:e.detail})));
})(window);
