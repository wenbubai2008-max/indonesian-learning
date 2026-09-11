(function(){
  if(document.getElementById('dailyUiPolishStyle'))return;
  const st=document.createElement('style');
  st.id='dailyUiPolishStyle';
  st.textContent=`
    /* Daily lesson only — compact, wide, readable */
    #daily>.card{max-width:none;margin:0 auto;padding:0;background:transparent;border:0;border-radius:0}
    #daily .sectionHead{margin:0 4px 12px;padding:0}
    #daily #dailyTitle{font-size:30px;line-height:1.2;margin:0;font-weight:850;letter-spacing:-.02em}
    #daily #dailyMeta{font-size:13px;padding:6px 10px}
    #daily .dailyFixNav{padding:10px 12px;margin:0 0 9px;border-radius:13px}
    #daily .dailyFixMid b{font-size:16px}
    #daily .dailyFixMid span{font-size:12px;margin-top:1px;display:block}
    #daily .dailyFixPicker{margin:0 0 11px}
    #daily .dailyFixPicker select{font-size:14px;padding:8px 11px}
    #daily .dailyFixChips{gap:6px;margin-bottom:11px}
    #daily .dailyFixChip{font-size:12px;padding:5px 9px}
    #daily .dailyFixSec{border-radius:17px;padding:15px 17px;margin:10px 0;background:#fff;border-color:#dfe5ef}
    #daily .dailyFixSec h3{display:flex;align-items:center;justify-content:center;gap:7px;margin:0 0 13px;font-size:24px;line-height:1.2;font-weight:850;color:#273248}
    #daily .dailyFixNo{width:34px;height:34px;border-radius:10px;font-size:15px;margin-right:1px}
    #daily .dailyFixGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    #daily .dailyFixVocab{border-radius:15px;padding:15px 16px 14px;background:#fbfcff;border-color:#dfe5ef;box-shadow:none}
    #daily .dailyFixWord{gap:8px;font-size:30px;line-height:1.15;font-weight:850;letter-spacing:-.01em}
    #daily .dailyFixNum{font-size:16px;min-width:38px;color:#4265c7}
    #daily .dailyFixWord .sound{padding:6px 8px;border-radius:10px;font-size:16px;margin-left:1px}
    #daily .dailyFixCn{font-size:20px;line-height:1.35;margin-top:10px;color:#26364f;font-weight:800}
    #daily .dailyFixEn{font-size:14px;line-height:1.4;color:#7b8598;margin-top:2px}
    #daily .dailyFixMeta{font-size:14px;line-height:1.55;color:#52627a;margin-top:8px;background:#f4f6fa;border-radius:9px;padding:7px 9px}
    #daily .dailyFixMeta+.dailyFixMeta{margin-top:5px}
    #daily .dailyFixEx{font-size:18px;line-height:1.5;color:#285a94;margin-top:11px;padding-top:10px;border-top:1px solid #e5eaf2;font-weight:650}
    #daily .dailyFixExCn{font-size:15px;line-height:1.5;color:#786554;margin-top:4px}
    #daily .dailyFixItem{font-size:17px;line-height:1.65;border-radius:13px;padding:12px 14px;margin-bottom:8px}
    #daily .dailyFixId{font-size:18px;line-height:1.55}
    #daily .dailyFixCnLine{font-size:15px;line-height:1.5;margin-top:4px}
    #daily .dailyFixReading{font-size:19px;line-height:1.75;padding:15px 17px;border-radius:13px}
    #daily .dailyFixTranslation{font-size:16px;line-height:1.65;padding:13px 15px;border-radius:12px;margin-top:9px}
    #daily .dailyFixActions{margin-top:9px}
    #daily .dailyFixChoice{font-size:16px;line-height:1.45;padding:10px 12px;border-radius:10px}
    #daily .dailyFixChoiceWrap{gap:7px;margin-top:9px}
    #daily .dailyFixFeedback{font-size:14px;line-height:1.55;padding:9px 11px;margin-top:7px}
    #daily .dailyFixAnswer{font-size:16px;line-height:1.6;padding:11px 13px}
    #daily .dailyFixToggle{font-size:14px;padding:7px 10px}
    #daily .dailyCompleteDone{background:#eaf8ef!important;color:#17652d!important;border:1px solid #b9dfc4!important;cursor:default!important;transform:scale(1.02);box-shadow:0 5px 16px rgba(23,101,45,.12);transition:.18s ease}
    .dailyCompleteToast{position:fixed;left:50%;bottom:30px;transform:translate(-50%,18px);z-index:9999;background:#173b25;color:#fff;padding:12px 18px;border-radius:12px;font-weight:750;box-shadow:0 10px 28px rgba(0,0,0,.18);opacity:0;pointer-events:none;transition:.22s ease}
    .dailyCompleteToast.show{opacity:1;transform:translate(-50%,0)}
    .dailyNotReady{max-width:620px;margin:70px auto;text-align:center;background:#fff;border:1px solid #e2e7f0;border-radius:18px;padding:28px 24px;color:#5f6b7d;line-height:1.7}
    .dailyNotReady b{display:block;color:#273248;font-size:21px;margin-bottom:7px}
    @media(max-width:820px){#daily .dailyFixGrid{grid-template-columns:1fr}#daily .dailyFixSec{padding:11px 10px;margin:8px 0;border-radius:14px}#daily .dailyFixVocab{padding:13px 12px}#daily .dailyFixSec h3{margin-bottom:11px}}
    @media(max-width:520px){#daily .sectionHead{margin:0 2px 9px}#daily #dailyTitle{font-size:24px}#daily #dailyMeta{font-size:12px;padding:5px 8px}#daily .dailyFixNav{padding:8px;margin-bottom:7px}#daily .dailyFixPicker{margin-bottom:8px}#daily .dailyFixChips{margin-bottom:8px}#daily .dailyFixSec{padding:9px 6px;border-radius:12px}#daily .dailyFixSec h3{font-size:21px;margin-bottom:9px}#daily .dailyFixNo{width:31px;height:31px;font-size:13px}#daily .dailyFixGrid{gap:8px}#daily .dailyFixVocab{padding:12px 11px;border-radius:12px}#daily .dailyFixWord{font-size:27px}#daily .dailyFixNum{font-size:15px;min-width:34px}#daily .dailyFixCn{font-size:19px;margin-top:8px}#daily .dailyFixEn{font-size:14px}#daily .dailyFixMeta{font-size:14px;line-height:1.5;padding:6px 8px;margin-top:6px}#daily .dailyFixEx{font-size:17px;line-height:1.5;margin-top:9px;padding-top:8px}#daily .dailyFixExCn{font-size:15px;line-height:1.45}#daily .dailyFixReading{font-size:18px;line-height:1.7;padding:12px}#daily .dailyFixTranslation{padding:11px 12px}.dailyCompleteToast{bottom:18px;max-width:calc(100vw - 28px);text-align:center}.dailyNotReady{margin:36px auto;padding:22px 16px}}
  `;
  document.head.appendChild(st);

  function showCompleteToast(text){
    let t=document.getElementById('dailyCompleteToast');
    if(!t){t=document.createElement('div');t.id='dailyCompleteToast';t.className='dailyCompleteToast';document.body.appendChild(t);}
    t.textContent=text||'✓ 已记录完成';
    requestAnimationFrame(function(){t.classList.add('show');});
    clearTimeout(t._timer);
    t._timer=setTimeout(function(){t.classList.remove('show');},1500);
  }

  function parseCompleteButton(btn){
    const code=btn&&btn.getAttribute('onclick')||'';
    const m=code.match(/completeSession\(\s*['\"]([^'\"]+)['\"]\s*,\s*['\"](am|pm)['\"]\s*\)/i);
    return m?{date:m[1],session:m[2].toLowerCase()}:null;
  }

  function markButtonDone(btn){
    if(!btn||btn.classList.contains('dailyCompleteDone'))return;
    btn.textContent='✓ 已完成';
    btn.disabled=true;
    btn.classList.add('dailyCompleteDone');
    btn.setAttribute('aria-disabled','true');
  }

  function jakartaToday(){
    return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  }

  function syncHomeStatus(date,session){
    if(String(date)!==jakartaToday())return;
    const el=document.getElementById(session==='am'?'amStatus':'pmStatus');
    if(el){el.textContent='已完成';el.classList.add('done');el.classList.remove('ready');}
    const am=localStorage.getItem('done_'+date+'_am')==='1';
    const pm=localStorage.getItem('done_'+date+'_pm')==='1';
    const count=document.getElementById('sessionCount');
    if(count)count.textContent=(Number(am)+Number(pm))+' / 2';
  }

  function syncCompletionButtons(){
    document.querySelectorAll('#daily button[onclick*="completeSession"]').forEach(function(btn){
      const info=parseCompleteButton(btn);if(!info)return;
      if(localStorage.getItem('done_'+info.date+'_'+info.session)==='1'){
        markButtonDone(btn);
        syncHomeStatus(info.date,info.session);
      }
    });
  }

  function handleCompleteClick(e){
    const btn=e.target&&e.target.closest?e.target.closest('#daily button[onclick*="completeSession"]'):null;
    if(!btn||btn.disabled)return;
    const info=parseCompleteButton(btn);if(!info)return;
    e.preventDefault();
    e.stopPropagation();
    if(typeof e.stopImmediatePropagation==='function')e.stopImmediatePropagation();
    localStorage.setItem('done_'+info.date+'_'+info.session,'1');
    markButtonDone(btn);
    syncHomeStatus(info.date,info.session);
    showCompleteToast((info.session==='am'?'08:00 早间学习':'19:00 晚间学习')+' · 已记录完成');
  }

  function installOpenDailyGuard(){
    const original=window.openDaily;
    if(typeof original!=='function'||original.__notReadyGuard)return;
    const guarded=function(session,date){
      const d=date||jakartaToday();
      const exists=typeof window.hasSession==='function'?window.hasSession(d,session):true;
      if(!exists){
        if(typeof window.go==='function')window.go('daily');
        const title=document.getElementById('dailyTitle');
        const meta=document.getElementById('dailyMeta');
        const body=document.getElementById('dailyBody');
        if(title)title.textContent=session==='am'?'08:00 早间学习':'19:00 晚间学习';
        if(meta)meta.textContent=d;
        if(body)body.innerHTML='<div class="dailyNotReady"><b>'+((session==='am')?'08:00':'19:00')+' 课程尚未生成</b><div>课程生成后这里会自动可用，不需要反复刷新。</div></div>';
        return Promise.resolve(false);
      }
      return original(session,d);
    };
    guarded.__notReadyGuard=true;
    guarded.__original=original;
    window.openDaily=guarded;
  }

  function bootCompletionFix(){
    document.addEventListener('click',handleCompleteClick,true);
    syncCompletionButtons();
    installOpenDailyGuard();
    const daily=document.getElementById('daily');
    if(daily){
      let queued=false;
      new MutationObserver(function(){
        if(queued)return;
        queued=true;
        requestAnimationFrame(function(){queued=false;syncCompletionButtons();});
      }).observe(daily,{childList:true,subtree:true});
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootCompletionFix,{once:true});
  else bootCompletionFix();
})();
