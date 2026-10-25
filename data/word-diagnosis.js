// 2026-10-25 (profile redesign, step A — no UI, user-approved): per-word diagnosis from the training records that already
// exist. READ-ONLY and pure: it never writes storage, never changes due dates, mastery, the weakness pool or lesson
// selection, and no scheduler / lesson script may read its results.
// Rules run bottom-up, because production is naturally harder than recognition: a higher layer is only judged once the
// layer below it is reliable.
//   meaning     quick practice (Indonesian → choose Chinese) mostly wrong
//   listening   recognition is reliable, but listening is repeatedly wrong or slow
//   production  recognition is reliable, but automatic training fails repeatedly (hinted passes are by design, not failures)
//               or the lesson-end self-report says 想不起来 on most recent days (labelled as self-report)
//   forgetting  mastered earlier, answered wrong later (weakness record: last_wrong after last_mastered)
//   unclear     records exist but the layer below is not proven yet, so no cause is guessed
//   insufficient too few records
//   recognized   recognition is fine, but listening / automatic training were never tested — NOT "no problem" (real data 2026-10-25:
//               917 words had quick practice, 24 listening, 48 automatic training, so most words are only proven at recognition)
//   ok           every layer was tested and nothing wrong was found
(function(root,factory){
  const m=factory();
  if(typeof module==='object'&&module.exports)module.exports=m;else root.WordDiagnosis=m;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const CFG={min_records:3,recog_min_right:2,recog_fail_wrong:2,recog_fail_ratio:.5,listen_fail_streak:2,listen_fail_rate:.5,auto_fail_streak:2,auto_fail_total:3,recall_window:3,recall_fail_min:2};
  const LABEL={meaning:'意思记不住',listening:'听不出来',production:'说不出来',forgetting:'反复遗忘',unclear:'原因待确认',insufficient:'待验证',recognized:'认得没问题',ok:'各层都验证过，暂无问题'};
  const NEXT={
    meaning:{train:'quick',text:'快速练习（看印尼语选中文），并回看词义和例句'},
    listening:{train:'listen',text:'听词训练（只听声音判断词义）'},
    production:{train:'auto',text:'自动训练（中文 → 想出印尼语，限时）'},
    forgetting:{train:'quick',text:'间隔复测：快速练习 + 自动训练，按跨日间隔再验证'},
    unclear:{train:'quick',text:'先做快速练习，确认认得之后才能判断'},
    insufficient:{train:'quick',text:'再练几次才能判断'},
    recognized:{train:'listen',text:'认得已经验证；听词和自动训练还没测，有机会时补测'},
    ok:{train:'',text:'按计划跨日验证即可'}
  };
  const num=x=>{const n=Number(x);return Number.isFinite(n)?n:0};
  const ts=x=>{if(!x)return 0;if(typeof x==='number')return x>0?x:0;const t=Date.parse(x);return Number.isFinite(t)?t:0};
  const jkt=t=>new Date(t+7*3600000).toISOString().slice(0,10);
  const norm=w=>String(w||'').trim().toLowerCase();
  const obj=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};

  function quickLayer(q,weak){
    const right=num(q.right),wrong=num(q.wrong),n=right+wrong,lastWrong=q.last_result==='wrong';
    const flagged=(Array.isArray(weak.reasons)?weak.reasons:[]).includes('quick_wrong');
    let state='unknown';
    if(n){
      if(n>=2&&wrong>=CFG.recog_fail_wrong&&wrong/n>=CFG.recog_fail_ratio)state='fail';
      else if(right>=CFG.recog_min_right&&!lastWrong&&wrong/n<CFG.recog_fail_ratio)state='reliable';
      else state='unsure';
    }
    const ev=n?'快速练习（看印尼语选中文）：答对 '+right+' 次、答错 '+wrong+' 次'+(lastWrong?'，最近一次答错':''):(flagged?'弱项记录里有快速练习答错的标记，但没有本机逐次记录':'');
    return {state,n,ev,days:[ts(q.last_right),ts(q.last_wrong),q.review_first_day?Date.parse(q.review_first_day+'T00:00:00Z'):0],due:ts(q.review_due)};
  }
  function listenLayer(l){
    const n=num(l.attempts),correct=num(l.correct),wrongStreak=num(l.wrong_streak),slowStreak=num(l.slow_streak);
    let state='unknown';
    if(n){
      if(wrongStreak>=CFG.listen_fail_streak||slowStreak>=CFG.listen_fail_streak||(n>=3&&correct/n<CFG.listen_fail_rate))state='fail';
      else if(n>=2&&l.last_result==='correct'&&!wrongStreak&&!slowStreak)state='reliable';
      else state='unsure';
    }
    const ev=n?'听词（只听声音）：'+n+' 次中答对 '+correct+' 次'+(wrongStreak?'，连续答错 '+wrongStreak+' 次':'')+(slowStreak?'，连续偏慢 '+slowStreak+' 次':''):'';
    return {state,n,ev,days:[ts(l.last_at)],due:ts(l.review_due)};
  }
  function autoLayer(a){
    const n=num(a.attempts),failures=num(a.failures),successes=num(a.successes),streak=num(a.fail_streak);
    let state='unknown';
    if(n){
      if(streak>=CFG.auto_fail_streak||(failures>=CFG.auto_fail_total&&a.last_result==='fail'))state='fail';
      else if(a.status==='stable'||(successes>=2&&!streak&&['right','direct'].includes(a.last_result)))state='reliable';
      else state='unsure';
    }
    const ev=n?'自动训练（中文 → 想出印尼语）：'+n+' 次中失败 '+failures+' 次、通过 '+successes+' 次'+(streak?'，连续失败 '+streak+' 次':''):'';
    return {state,n,ev,days:[ts(a.last_at)],due:ts(a.next_due)};
  }
  function recallLayer(r){
    const hist=Array.isArray(r.hist)?r.hist.filter(h=>h&&['fast','slow','fail'].includes(h.result)).slice(-CFG.recall_window):[];
    const fails=hist.filter(h=>h.result==='fail').length;
    return {fail:fails>=CFG.recall_fail_min,n:hist.length,ev:hist.length?'课末自评（只是自我感觉，不算训练通过）：最近 '+hist.length+' 次里“想不起来” '+fails+' 次':'',days:hist.map(h=>ts(h.at||(h.day&&h.day+'T00:00:00Z')))};
  }

  // input: {word, quick, listen, auto, recall, weak} — each a plain record or undefined; now: ms
  function diagnose(input,now){
    now=now||Date.now();
    const word=norm(input&&input.word),weak=obj(input&&input.weak);
    const q=quickLayer(obj(input&&input.quick),weak),l=listenLayer(obj(input&&input.listen)),a=autoLayer(obj(input&&input.auto)),r=recallLayer(obj(input&&input.recall));
    const lastMastered=ts(weak.last_mastered),lastWrong=ts(weak.last_wrong);
    const forgotten=!!(weak.status!=='mastered'&&lastMastered&&lastWrong&&lastWrong>lastMastered);
    const total=q.n+l.n+a.n;
    const days=new Set([...q.days,...l.days,...a.days,...r.days,lastWrong,lastMastered].filter(Boolean).map(jkt));
    const evidence=[q.ev,l.ev,a.ev,r.ev].filter(Boolean);
    if(forgotten)evidence.push('弱项记录：'+jkt(lastMastered)+' 达到掌握，'+jkt(lastWrong)+' 又答错');
    const untested=[];if(q.state==='unknown')untested.push('quick');if(l.state==='unknown')untested.push('listen');if(a.state==='unknown'&&!r.n)untested.push('auto');

    let type,secondary=[];
    if(total<CFG.min_records&&!forgotten)type='insufficient';
    else if(q.state==='fail'){
      type='meaning';
      if(forgotten)secondary.push('forgetting');
      if(l.state==='fail')secondary.push('listening');
    }else if(q.state==='reliable'){
      if(l.state==='fail')type='listening';
      else if(a.state==='fail'||r.fail)type='production';
      else if(forgotten)type='forgetting';
      else type=(l.state==='unknown'||a.state==='unknown')?'recognized':'ok';
      if(type==='listening'&&(a.state==='fail'||r.fail))secondary.push('production');
      if(forgotten&&type!=='forgetting')secondary.push('forgetting');
    }else{
      // Recognition is not proven: listening / production failures are not interpreted (they may just mean the word is not known yet).
      type=forgotten?'forgetting':'unclear';
    }

    let confidence=null;
    if(!['insufficient','unclear','ok'].includes(type)){
      const agree=[q.state==='fail',l.state==='fail',a.state==='fail'||r.fail,forgotten].filter(Boolean).length;
      confidence=(total>=6&&days.size>=3)||agree>=2?'high':(total>=4||days.size>=2)?'medium':'low';
    }
    const due=[q.due,l.due,a.due].filter(t=>t>now);
    const next=Object.assign({verify_at:due.length?new Date(Math.min(...due)).toISOString():null},NEXT[type]);
    let label=LABEL[type];
    if(type==='recognized'){const miss=[l.state==='unknown'?'听词':'',a.state==='unknown'?'自动训练':''].filter(Boolean).join('、');label='认得没问题，'+miss+'还没测';}
    const layers={recognition:q.state,listening:l.state,production:a.state};
    return {word,type,label,secondary,confidence,evidence,records:total,days:days.size,untested,layers,next};
  }

  // Browser/Node helper: build one snapshot of the stored records (read-only), then diagnose any word from it.
  function snapshot(storage){
    const read=(k,d)=>{try{const v=JSON.parse(storage.getItem(k)||'null');return v==null?d:v}catch(e){return d}};
    const index=m=>{const o={};Object.keys(obj(m)).forEach(k=>{o[norm(k)]=m[k]});return o};
    const recall=read('indo_lesson_recall_v1',{});
    return {quick:index(read('indo_quick_practice_state',{})),listen:index(read('indo_listen_stats_v1',{})),auto:index(read('indo_automation_training_state_v1',{})),recall:index(obj(recall).words),weak:index(read('indo_weak_pool_v1',{}))};
  }
  function diagnoseFrom(snap,word,now){
    const k=norm(word);
    return diagnose({word:k,quick:snap.quick[k],listen:snap.listen[k],auto:snap.auto[k],recall:snap.recall[k],weak:snap.weak[k]},now);
  }
  // Counts for a summary card: how many words each layer was actually tested on, and how many words fall in each type.
  // Words without any training record are not in the snapshot; the caller knows the taught total.
  function summarize(snap,now){
    const words=new Set([...Object.keys(snap.quick),...Object.keys(snap.listen),...Object.keys(snap.auto),...Object.keys(snap.recall)]);
    const out={words:words.size,types:{},tested:{recognition:0,listening:0,production:0,self_report:Object.keys(snap.recall).length}};
    words.forEach(w=>{
      const r=diagnoseFrom(snap,w,now);
      out.types[r.type]=(out.types[r.type]||0)+1;
      if(r.layers.recognition!=='unknown')out.tested.recognition++;
      if(r.layers.listening!=='unknown')out.tested.listening++;
      if(r.layers.production!=='unknown')out.tested.production++;
    });
    return out;
  }
  return {CFG,LABEL,diagnose,snapshot,diagnoseFrom,summarize};
});
