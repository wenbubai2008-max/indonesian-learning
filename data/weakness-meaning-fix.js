(function(){
  if(window.__weaknessMeaningFixLoaded)return;
  window.__weaknessMeaningFixLoaded=true;

  const FIXED_CN='催；催款；讨要欠款（口语）';
  const FIXED_ROOT='tagih';
  const FIXED_ROOT_CN='催；索取应付款项';

  function norm(s){return String(s||'').trim().toLowerCase();}

  function isDebtCollectionContext(text){
    const s=norm(text);
    return s.includes('nggak enakan buat nagih')||
      s.includes('tidak enakan buat nagih')||
      /\b(buat|harus|tetap|mau|perlu|bisa)\s+nagih\b/.test(s)||
      /\bnagih\s+(dia|orang|utang|tagihan|pembayaran|vendor|klien)\b/.test(s);
  }

  function fixPoolRecord(){
    const p=window.WeaknessPool;
    if(!p||typeof p.get!=='function'||typeof p.enrich!=='function')return;
    const x=p.get('nagih');
    if(!x)return;
    const knownReading=x.source_date==='2026-09-07'&&String(x.session||'')==='08:00';
    const ctx=[x.example,x.example_cn].concat(x.contexts||[]).join(' ');
    if((knownReading||isDebtCollectionContext(ctx))&&x.cn!==FIXED_CN){
      p.enrich('nagih',{cn:FIXED_CN,root:FIXED_ROOT,root_cn:FIXED_ROOT_CN});
    }
  }

  function fixVisibleCards(){
    const body=document.getElementById('weaknessBody');
    if(!body)return;
    body.querySelectorAll('[data-weak-word],.v2-card,.weak-card').forEach(function(card){
      const word=norm(card.getAttribute('data-weak-word')||card.querySelector('b')?.textContent||'');
      if(word!=='nagih')return;
      const text=card.textContent||'';
      if(!isDebtCollectionContext(text))return;
      const meaning=card.querySelector('strong');
      if(meaning&&meaning.textContent.trim()!==FIXED_CN)meaning.textContent=FIXED_CN;
    });
  }

  function run(){fixPoolRecord();fixVisibleCards();}

  function boot(){
    run();
    const body=document.getElementById('weaknessBody');
    if(body)new MutationObserver(function(){fixVisibleCards();}).observe(body,{childList:true,subtree:true,characterData:true});
    window.addEventListener('weak-pool-changed',function(){setTimeout(run,0);});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
