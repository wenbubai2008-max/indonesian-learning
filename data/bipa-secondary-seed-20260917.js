(function(){
  if(window.__BIPA_SECONDARY_SEED_20260917__)return;
  window.__BIPA_SECONDARY_SEED_20260917__=true;

  const LEVELS=['A1','A2','B1','B2'];
  const BIPA_REASONS=['bipa_secondary_dont','bipa_secondary_fuzzy'];
  const SIG_KEY='bipa_secondary_seed_signature_v3';
  const SUMMARY_KEY='bipa_secondary_seed_summary_v3';
  const STATUS_RANK={know:1,fuzzy:2,dont:3};
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
  function itemFrom(level,row,levels){
    return {
      word:String(row[0]||'').trim(),display:String(row[0]||'').trim(),cn:String(row[1]||'').trim(),en:String(row[2]||'').trim(),
      root:String(row[3]||'').trim(),source:'BIPA secondary selection',source_date:'2026-09-17',session:'',
      bipa_level:level,bipa_levels:(levels||[]).slice(),sab:String(row[8]||'').trim().toUpperCase()
    };
  }
  function signature(){
    const primary=[...masterSet()].sort();
    return JSON.stringify({version:3,primary,mem:LEVELS.map(lv=>[lv,parse('indo_bipa_mem_'+lv)])});
  }
  function bipaReasonsOf(x){return x&&Array.isArray(x.reasons)?x.reasons.filter(r=>BIPA_REASONS.includes(r)):[]}
  function hasBipaReason(x){return bipaReasonsOf(x).length>0}
  function sameOnlyReason(x,reason){const r=bipaReasonsOf(x);return r.length===1&&r[0]===reason}

  function aggregateSelections(primary){
    const merged=new Map();
    let skippedPrimary=0,skippedB2=0,reviewed=0;
    const perLevelReviewed={A1:0,A2:0,B1:0,B2:0};
    for(const lv of LEVELS){
      const mem=parse('indo_bipa_mem_'+lv),rows=rowMap(lv);
      for(const [rawWord,status] of Object.entries(mem)){
        if(!Object.prototype.hasOwnProperty.call(STATUS_RANK,status))continue;
        const row=rows.get(norm(rawWord));if(!row)continue;
        if(lv==='B2'&&String(row[8]||'').trim().toUpperCase()!=='S'){skippedB2++;continue}
        const k=norm(row[0]);if(!k)continue;
        if(primary.has(k)){skippedPrimary++;continue}
        reviewed++;perLevelReviewed[lv]++;
        let x=merged.get(k);
        if(!x){
          x={key:k,status,row,level:lv,levels:[lv],statuses:[status]};
          merged.set(k,x);
        }else{
          if(!x.levels.includes(lv))x.levels.push(lv);
          x.statuses.push(status);
          if(STATUS_RANK[status]>STATUS_RANK[x.status]){
            x.status=status;x.row=row;x.level=lv;
          }
        }
      }
    }
    let duplicateWords=0,conflicts=0;
    for(const x of merged.values()){
      if(x.levels.length>1)duplicateWords++;
      if(new Set(x.statuses).size>1)conflicts++;
    }
    return {merged,skippedPrimary,skippedB2,reviewed,perLevelReviewed,duplicateWords,conflicts};
  }

  async function seed(force){
    const pool=window.WeaknessPool;if(!pool||typeof pool.get!=='function'||typeof pool.markWeak!=='function')return null;
    if(!window.BIPA_VOCAB_RAW)return null;
    const sig=signature();
    if(!force&&localStorage.getItem(SIG_KEY)===sig)return JSON.parse(localStorage.getItem(SUMMARY_KEY)||'null');

    const primary=masterSet();
    const agg=aggregateSelections(primary);
    let selected=0,changed=0,knownRemoved=0,reclassified=0;
    const selectedPerLevel={A1:0,A2:0,B1:0,B2:0};

    for(const x of agg.merged.values()){
      const row=x.row,status=x.status,word=row[0];
      let existing=pool.get(word);
      if(status==='know'){
        if(existing&&existing.status!=='mastered'&&hasBipaReason(existing)){
          if(typeof pool.removeReasons==='function'){
            pool.removeReasons(word,BIPA_REASONS,true,'bipa_secondary_known');changed++;knownRemoved++;
          }else{
            const nonBipa=(existing.reasons||[]).filter(r=>!BIPA_REASONS.includes(r));
            if(!nonBipa.length&&typeof pool.markMastered==='function'){pool.markMastered(word,'bipa_secondary_known');changed++;knownRemoved++;}
          }
        }
        continue;
      }

      selected++;selectedPerLevel[x.level]=(selectedPerLevel[x.level]||0)+1;
      const reason=status==='dont'?'bipa_secondary_dont':'bipa_secondary_fuzzy';
      if(existing&&existing.status==='active'&&hasBipaReason(existing)&&!sameOnlyReason(existing,reason)&&typeof pool.removeReasons==='function'){
        pool.removeReasons(word,BIPA_REASONS,false);existing=pool.get(word);reclassified++;
      }
      const already=existing&&existing.status==='active'&&Array.isArray(existing.reasons)&&existing.reasons.includes(reason)&&sameOnlyReason(existing,reason);
      const item=itemFrom(x.level,row,x.levels);
      if(!already){pool.markWeak(word,item,reason);changed++;}
      else if(typeof pool.enrich==='function')pool.enrich(word,item);
    }

    const summary={
      version:3,
      duplicate_resolution:'dont > fuzzy > know',
      reviewed_entries:agg.reviewed,
      unique_reviewed_words:agg.merged.size,
      duplicate_words:agg.duplicateWords,
      conflicting_duplicate_words:agg.conflicts,
      selected,changed,reclassified,known_removed:knownRemoved,
      skipped_primary:agg.skippedPrimary,
      skipped_b2_unreviewed:agg.skippedB2,
      per_level_reviewed:agg.perLevelReviewed,
      per_level_selected:selectedPerLevel,
      generated_at:new Date().toISOString()
    };
    localStorage.setItem(SIG_KEY,sig);localStorage.setItem(SUMMARY_KEY,JSON.stringify(summary));
    window.BIPA_SECONDARY_SEED_SUMMARY=summary;
    const sync=window.WeaknessSync;
    if(changed&&sync&&typeof sync.getConfig==='function'&&typeof sync.syncNow==='function'){
      try{const c=sync.getConfig()||{};if(c.endpoint&&c.key)setTimeout(()=>sync.syncNow(),300)}catch(e){}
    }
    return summary;
  }

  let queued=false;
  function queueSeed(){
    if(queued)return;queued=true;
    queueMicrotask(()=>{queued=false;seed(true).catch(()=>{})});
  }
  window.BipaSecondarySeed={run:()=>seed(true),summary:()=>JSON.parse(localStorage.getItem(SUMMARY_KEY)||'null')};
  window.addEventListener('bipa-memory-changed',queueSeed);
  window.addEventListener('master-core-locked',queueSeed);
  setTimeout(()=>seed(false),120);
})();
