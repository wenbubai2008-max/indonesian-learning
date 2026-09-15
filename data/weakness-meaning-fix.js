(function(){
  if(window.__weaknessMeaningFixLoaded)return;
  window.__weaknessMeaningFixLoaded=true;

  const FIXED_CN='催；催款；讨要欠款（口语）';
  const FIXED_ROOT='tagih';
  const FIXED_ROOT_CN='催；索取应付款项';
  let fixing=false;

  function norm(s){return String(s||'').trim().toLowerCase();}

  function isDebtCollectionContext(text){
    const s=norm(text);
    return s.includes('nggak enakan buat nagih')||
      s.includes('tidak enakan buat nagih')||
      /\b(buat|harus|tetap|mau|perlu|bisa)\s+nagih\b/.test(s)||
      /\bnagih\s+(dia|orang|utang|tagihan|pembayaran|vendor|klien)\b/.test(s);
  }

  function fixPoolRecord(){
    if(fixing)return;
    const p=window.WeaknessPool;
    if(!p||typeof p.get!=='function'||typeof p.enrich!=='function')return;
    const x=p.get('nagih');
    if(!x)return;
    const knownReading=x.source_date==='2026-09-07'&&String(x.session||'')==='08:00';
    const ctx=[x.example,x.example_cn].concat(x.contexts||[]).join(' ');
    if((knownReading||isDebtCollectionContext(ctx))&&(x.cn!==FIXED_CN||x.root!==FIXED_ROOT||x.root_cn!==FIXED_ROOT_CN)){
      fixing=true;
      try{p.enrich('nagih',{cn:FIXED_CN,root:FIXED_ROOT,root_cn:FIXED_ROOT_CN});}
      finally{fixing=false;}
    }
  }

  function boot(){
    fixPoolRecord();
    window.addEventListener('weak-pool-changed',function(){setTimeout(fixPoolRecord,0);});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
