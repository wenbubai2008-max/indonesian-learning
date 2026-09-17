(function(){
  if(window.__BIPA_SECONDARY_SEED_20260917__)return;
  window.__BIPA_SECONDARY_SEED_20260917__=true;

  const LEVELS=['A1','A2','B1','B2'];
  const SIG_KEY='bipa_secondary_seed_signature_v1';
  const SUMMARY_KEY='bipa_secondary_seed_summary_v1';
  const norm=s=>String(s||'').trim().toLowerCase();
  const parse=k=>{try{return JSON.parse(localStorage.getItem(k)||'{}')||{}}catch(e){return {}}};

  function masterSet(){
    const out=new Set();
    const rows=Array.isArray(window.MASTER_VOCAB_OBJECTS)&&window.MASTER_VOCAB_OBJECTS.length?window.MASTER_VOCAB_OBJECTS:(window.MASTER_VOCAB_DB||[]);
    rows.forEach(x=>{const w=Array.isArray(x)?x[0]:(x&&x.word);const k=norm(w);if(k)out.add(k)});
    return out;
  }
  function rowMap(level){
    const m=new Map();
    ((window.BIPA_VOCAB_RAW&&window.BIPA_VOCAB_RAW[level])||[]).forEach(r=>{if(!Array.isArray(r))return;const k=norm(r[0]);if(k&&!m.has(k))m.set(k,r)});
    return m;
  }
  function eligible(level,row,primary){
    if(!row)return false;
    if(level==='B2'&&String(row[8]||'').trim().toUpperCase()!=='S')return false;
    return !primary.has(norm(row[0]));
  }
  function itemFrom(level,row){
    return {
      word:String(row[0]||'').trim(),display:String(row[0]||'').trim(),cn:String(row[1]||'').trim(),en:String(row[2]||'').trim(),
      root:String(row[3]||'').trim(),source:'BIPA secondary selection',source_date:'2026-09-17',session:'',
      bipa_level:level,sab:String(row[8]||'').trim().toUpperCase()
    };
  }
  function signature(){
    return JSON.stringify(LEVELS.map(lv=>[lv,parse('indo_bipa_mem_'+lv)]));
  }
  function hasBipaReason(x){
    return !!(x&&Array.isArray(x.reasons)&&x.reasons.some(r=>r==='bipa_secondary_dont'||r==='bipa_secondary_fuzzy'));
  }
  async function seed(force){
    const pool=window.WeaknessPool;if(!pool||typeof pool.get!=='function'||typeof pool.markWeak!=='function')return null;
    if(!window.BIPA_VOCAB_RAW)return null;
    const sig=signature();
    if(!force&&localStorage.getItem(SIG_KEY)===sig)return JSON.parse(localStorage.getItem(SUMMARY_KEY)||'null');
    const primary=masterSet();
    const seen=new Set();
    let selected=0,changed=0,skippedPrimary=0,skippedB2=0,knownRemoved=0;
    const perLevel={};
    for(const lv of LEVELS){
      const mem=parse('indo_bipa_mem_'+lv),rows=rowMap(lv);let kept=0;
      for(const [rawWord,status] of Object.entries(mem)){
        if(!['dont','fuzzy','know'].includes(status))continue;
        const row=rows.get(norm(rawWord));if(!row)continue;
        if(lv==='B2'&&String(row[8]||'').trim().toUpperCase()!=='S'){skippedB2++;continue}
        const k=norm(row[0]);if(primary.has(k)){skippedPrimary++;continue}
        if(seen.has(k))continue;
        seen.add(k);
        const existing=pool.get(row[0]);
        if(status==='know'){
          if(existing&&existing.status!=='mastered'&&hasBipaReason(existing)&&typeof pool.markMastered==='function'){
            pool.markMastered(row[0],'bipa_secondary_known');changed++;knownRemoved++;
          }
          continue;
        }
        selected++;kept++;
        const reason=status==='dont'?'bipa_secondary_dont':'bipa_secondary_fuzzy';
        const already=existing&&existing.status==='active'&&Array.isArray(existing.reasons)&&existing.reasons.includes(reason);
        if(!already){pool.markWeak(row[0],itemFrom(lv,row),reason);changed++;}
        else if(typeof pool.enrich==='function')pool.enrich(row[0],itemFrom(lv,row));
      }
      perLevel[lv]=kept;
    }
    const summary={version:1,selected,changed,known_removed:knownRemoved,skipped_primary:skippedPrimary,skipped_b2_unreviewed:skippedB2,per_level:perLevel,generated_at:new Date().toISOString()};
    localStorage.setItem(SIG_KEY,sig);localStorage.setItem(SUMMARY_KEY,JSON.stringify(summary));
    window.BIPA_SECONDARY_SEED_SUMMARY=summary;
    const sync=window.WeaknessSync;
    if(changed&&sync&&typeof sync.getConfig==='function'&&typeof sync.syncNow==='function'){
      try{const c=sync.getConfig()||{};if(c.endpoint&&c.key)setTimeout(()=>sync.syncNow(),300)}catch(e){}
    }
    return summary;
  }
  window.BipaSecondarySeed={run:()=>seed(true),summary:()=>JSON.parse(localStorage.getItem(SUMMARY_KEY)||'null')};
  setTimeout(()=>seed(false),120);
})();
