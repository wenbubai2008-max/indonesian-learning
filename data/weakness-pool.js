(function(){
  const KEY='indo_weak_pool_v1';
  const LEGACY_UNKNOWN='indo_unknown_words';
  const LEGACY_DISMISSED='indo_weakness_dismissed';
  const LEGACY_MEM='indo_mem';
  let legacyMigrated=false;
  let legacyMigrating=false;

  function norm(s){return String(s||'').trim().toLowerCase();}
  function parse(key){try{return JSON.parse(localStorage.getItem(key)||'{}')||{};}catch(e){return {};}}
  function load(){return parse(KEY);}
  function nowISO(){return new Date().toISOString();}
  function uniq(a){return Array.from(new Set((a||[]).filter(Boolean)));}
  function same(a,b){try{return JSON.stringify(a||null)===JSON.stringify(b||null);}catch(e){return false;}}
  function save(pool){
    localStorage.setItem(KEY,JSON.stringify(pool));
    window.dispatchEvent(new CustomEvent('weak-pool-changed'));
    return pool;
  }
  function ms(v){
    if(!v)return 0;
    if(typeof v==='number')return v;
    const n=Date.parse(v);return Number.isFinite(n)?n:0;
  }
  function mergeItem(old,item){
    const x=Object.assign({},old||{}),src=item||{};
    ['word','display','cn','en','root','root_cn','example','example_cn','source','source_date','session'].forEach(function(k){if(src[k]!==undefined&&src[k]!==null&&String(src[k]).trim()!=='')x[k]=src[k];});
    if(Array.isArray(src.contexts))x.contexts=uniq((x.contexts||[]).concat(src.contexts)).slice(-8);
    return x;
  }
  function ensureRecord(pool,word,item){
    const k=norm(word||(item||{}).word);if(!k)return [null,null];
    let x=mergeItem(pool[k]||{},item||{});
    x.word=x.word||word||k;x.display=x.display||x.word;
    x.status=x.status||'active';x.reasons=uniq(x.reasons||[]);x.reason_history=uniq(x.reason_history||[]);
    x.first_seen=x.first_seen||nowISO();x.last_seen=x.last_seen||x.first_seen;
    x.times_seen=Number(x.times_seen||0);
    x.wrong_count=Number(x.wrong_count||0);x.right_streak=Number(x.right_streak||0);
    pool[k]=x;return [k,x];
  }
  function setReason(x,reason){if(reason)x.reasons=uniq((x.reasons||[]).concat(reason));}
  function archiveReasons(x){x.reason_history=uniq((x.reason_history||[]).concat(x.reasons||[]));x.reasons=[];}
  function clearLegacyDismissed(k){const d=parse(LEGACY_DISMISSED);if(d[k]){delete d[k];localStorage.setItem(LEGACY_DISMISSED,JSON.stringify(d));}}
  function removeLegacyUnknown(k){const u=parse(LEGACY_UNKNOWN);let changed=false;Object.keys(u).forEach(function(a){if(norm(a)===k||norm((u[a]||{}).word)===k){delete u[a];changed=true;}});if(changed)localStorage.setItem(LEGACY_UNKNOWN,JSON.stringify(u));}
  function queueExampleTranslation(x){
    if(!x||!x.word||x.example_cn)return;
    const example=String(x.example||((x.contexts||[]).slice(-1)[0])||'').trim();if(!example)return;
    if(typeof window.enqueueWeakExampleTranslation==='function'){
      try{window.enqueueWeakExampleTranslation(x.word,Object.assign({},x,{example:example}));}catch(e){}
    }
  }

  function mergeCandidate(pool,word,item,reason,meta){
    const k=norm(word||(item||{}).word);if(!k)return false;
    if(pool[k]&&pool[k].status==='mastered')return false;
    const before=pool[k]?JSON.parse(JSON.stringify(pool[k])):null;
    const pair=ensureRecord(pool,word,item),x=pair[1];if(!x)return false;
    x.status='active';setReason(x,reason);
    if(meta&&meta.last_seen&&ms(meta.last_seen)>ms(x.last_seen))x.last_seen=meta.last_seen;
    if(meta&&meta.times_seen!==undefined)x.times_seen=Math.max(x.times_seen||0,Number(meta.times_seen||0));
    return !same(before,x);
  }

  function migrate(){
    if(legacyMigrated||legacyMigrating)return load();
    legacyMigrating=true;
    const pool=load();let changed=false;
    const unknown=parse(LEGACY_UNKNOWN);
    Object.keys(unknown).forEach(function(k0){
      const u=unknown[k0]||{},k=norm(u.word||k0);if(!k)return;
      if(mergeCandidate(pool,u.word||k,u,'manual_unknown',{last_seen:u.last_seen,times_seen:Number(u.times_seen||1)}))changed=true;
    });
    (window.UNFAMILIAR_VOCAB_DB||[]).forEach(function(u){
      if(!u||!u.word)return;
      if(mergeCandidate(pool,u.word,u,'seed_unfamiliar',{last_seen:u.last_seen,times_seen:Number(u.times_seen||1)}))changed=true;
    });
    const dismissed=parse(LEGACY_DISMISSED);
    Object.keys(dismissed).forEach(function(k0){
      const d=dismissed[k0]||{},k=norm(d.word||k0);if(!k)return;
      const before=pool[k]?JSON.parse(JSON.stringify(pool[k])):null;
      const pair=ensureRecord(pool,d.word||k,{}),x=pair[1];if(!x)return;
      const t=Number(d.at||0);
      if(!x.last_seen||t>=ms(x.last_seen)){
        x.status='mastered';
        if(!x.last_mastered)x.last_mastered=t?new Date(t).toISOString():nowISO();
        x.mastered_reason=x.mastered_reason||'legacy_dismiss';
        archiveReasons(x);
      }
      if(!same(before,x))changed=true;
    });
    const memory=parse(LEGACY_MEM);
    Object.keys(memory).forEach(function(k0){
      if(memory[k0]!=='know')return;
      const k=norm(k0);if(!k||pool[k])return;
      const pair=ensureRecord(pool,k,{word:k}),x=pair[1];if(!x)return;
      const n=nowISO();
      x.status='mastered';x.last_mastered=n;x.last_review=n;x.right_streak=Math.max(3,x.right_streak||0);
      x.mastered_reason='memory_know_backfill';archiveReasons(x);changed=true;
    });
    legacyMigrated=true;legacyMigrating=false;
    if(changed)save(pool);return pool;
  }

  function get(word){const pool=migrate(),k=norm(word);return pool[k]||null;}
  function all(){return Object.values(migrate());}
  function list(status){return all().filter(function(x){return x.status===status;});}
  function isActive(word){const x=get(word);return !!x&&x.status==='active';}

  function activate(word,item,reason){
    const pool=migrate(),pair=ensureRecord(pool,word,item),k=pair[0],x=pair[1];if(!x)return null;
    const n=nowISO();x.status='active';x.last_seen=n;x.times_seen=(x.times_seen||0)+1;x.mastered_reason='';setReason(x,reason||'manual_unknown');clearLegacyDismissed(k);save(pool);return x;
  }
  function markUnknown(item){
    const x=activate((item||{}).word,item,'manual_unknown');
    if(x){
      const u=parse(LEGACY_UNKNOWN),k=norm(x.word);u[k]=Object.assign({},u[k]||{},x,{status:undefined,reasons:undefined,reason_history:undefined,wrong_count:undefined,right_streak:undefined,last_wrong:undefined,last_review:undefined,last_mastered:undefined,mastered_reason:undefined});
      Object.keys(u[k]).forEach(function(a){if(u[k][a]===undefined)delete u[k][a];});localStorage.setItem(LEGACY_UNKNOWN,JSON.stringify(u));window.dispatchEvent(new CustomEvent('unknown-vocab-changed'));
      queueExampleTranslation(x);
    }
    return x;
  }
  function enrich(word,item){
    const pool=migrate(),k=norm(word);if(!pool[k])return null;const before=pool[k];const merged=mergeItem(before,item||{});if(same(before,merged))return before;pool[k]=merged;save(pool);return pool[k];
  }
  function markWeak(word,item,reason){return activate(word,item,reason||'weak');}
  function markMastered(word,reason){
    const pool=migrate(),k=norm(word);if(!k)return null;const pair=ensureRecord(pool,word,{}),x=pair[1];if(!x)return null;
    const n=nowISO();x.status='mastered';x.last_mastered=n;x.last_review=n;x.right_streak=Math.max(3,x.right_streak||0);x.mastered_reason=reason||'user_mastered';archiveReasons(x);removeLegacyUnknown(k);
    const d=parse(LEGACY_DISMISSED);d[k]={word:x.word,at:Date.now()};localStorage.setItem(LEGACY_DISMISSED,JSON.stringify(d));save(pool);window.dispatchEvent(new CustomEvent('unknown-vocab-changed'));return x;
  }
  function markKnown(word,reason){return markMastered(word,reason||'known');}
  function reactivate(word,reason){const x=get(word);return activate(word,x||{word:word},reason||'manual_reactivate');}
  function removeReasons(word,reasons,masterIfEmpty,masterReason){
    const pool=migrate(),k=norm(word),x=pool[k];if(!k||!x)return null;
    const wanted=new Set((Array.isArray(reasons)?reasons:[reasons]).filter(Boolean));if(!wanted.size)return x;
    const current=Array.isArray(x.reasons)?x.reasons:[],removed=current.filter(r=>wanted.has(r));if(!removed.length)return x;
    x.reason_history=uniq((x.reason_history||[]).concat(removed));x.reasons=current.filter(r=>!wanted.has(r));
    let becameMastered=false;
    if(masterIfEmpty&&x.status==='active'&&!x.reasons.length){
      const n=nowISO();x.status='mastered';x.last_mastered=n;x.last_review=n;x.right_streak=Math.max(3,x.right_streak||0);x.mastered_reason=masterReason||'reasons_cleared';removeLegacyUnknown(k);
      const d=parse(LEGACY_DISMISSED);d[k]={word:x.word,at:Date.now()};localStorage.setItem(LEGACY_DISMISSED,JSON.stringify(d));becameMastered=true;
    }
    save(pool);if(becameMastered)window.dispatchEvent(new CustomEvent('unknown-vocab-changed'));return x;
  }
  function importRecord(record){
    if(!record||!record.word)return null;
    const pool=migrate(),pair=ensureRecord(pool,record.word,record),k=pair[0],x=pair[1];if(!x)return null;
    x.status=record.status==='mastered'?'mastered':'active';
    x.reasons=uniq(Array.isArray(record.reasons)?record.reasons:[]);
    x.wrong_count=Math.max(0,Number(record.wrong_count||0));x.right_streak=Math.max(0,Number(record.right_streak||0));
    ['last_wrong','last_review','last_mastered'].forEach(function(a){if(record[a])x[a]=record[a];else if(a==='last_mastered'&&x.status!=='mastered')delete x[a];});
    if(x.status==='mastered'){
      x.mastered_reason=x.mastered_reason||'cloud_sync';removeLegacyUnknown(k);
      const d=parse(LEGACY_DISMISSED);d[k]={word:x.word,at:ms(x.last_mastered)||Date.now()};localStorage.setItem(LEGACY_DISMISSED,JSON.stringify(d));
    }else{x.mastered_reason='';clearLegacyDismissed(k);}
    save(pool);return x;
  }

  function recordPractice(word,ok,item){
    const pool=migrate(),k=norm(word);if(!k)return null;
    let x=pool[k]||null;
    if(!ok){
      const pair=ensureRecord(pool,word,item||{});x=pair[1];x.status='active';setReason(x,'quick_wrong');x.wrong_count=(x.wrong_count||0)+1;x.right_streak=0;x.last_wrong=nowISO();x.last_review=x.last_wrong;x.last_seen=x.last_wrong;clearLegacyDismissed(k);save(pool);queueExampleTranslation(x);return x;
    }
    if(!x)return null;
    x.last_review=nowISO();x.right_streak=(x.right_streak||0)+1;
    const hardReasons=(x.reasons||[]).filter(function(r){return r!=='quick_wrong';});
    if(x.status==='active'&&x.right_streak>=3&&!hardReasons.length){x.status='mastered';x.last_mastered=x.last_review;x.mastered_reason='3_correct';archiveReasons(x);removeLegacyUnknown(k);}
    save(pool);return x;
  }

  function syncSignals(wordMap,mem,practice){
    const pool=migrate(),mm=mem||{},ps=practice||{};let changed=false;
    Object.keys(mm).forEach(function(raw){
      const st=mm[raw],k=norm(raw);if(st!=='dont'&&st!=='fuzzy')return;
      const existing=pool[k];if(existing&&existing.status==='mastered'&&existing.last_mastered&&ms(existing.last_mastered)>=ms(existing.last_seen))return;
      const before=existing?JSON.parse(JSON.stringify(existing)):null;
      const item=(wordMap||{})[k]||{word:raw};const pair=ensureRecord(pool,item.word||raw,item),x=pair[1];
      x.status='active';setReason(x,st==='dont'?'memory_dont':'memory_fuzzy');
      if(!same(before,x))changed=true;
    });
    Object.keys(ps).forEach(function(k0){
      const p=ps[k0]||{},k=norm(k0);if(!k||!(p.wrong>0)||Number(p.streak||0)>=3)return;
      const existing=pool[k];if(existing&&existing.status==='mastered'&&ms(existing.last_mastered)>=Number(p.last_wrong||p.last||0))return;
      const before=existing?JSON.parse(JSON.stringify(existing)):null;
      const item=(wordMap||{})[k]||{word:k};const pair=ensureRecord(pool,item.word||k,item),x=pair[1];x.status='active';setReason(x,'quick_wrong');x.wrong_count=Math.max(x.wrong_count||0,Number(p.wrong||0));x.right_streak=Number(p.streak||0);
      if(p.last_wrong&&Number(p.last_wrong)>ms(x.last_wrong))x.last_wrong=new Date(Number(p.last_wrong)).toISOString();
      if(!same(before,x))changed=true;
    });
    if(changed)save(pool);return pool;
  }

  function primaryReason(x){
    const r=x&&x.reasons||[];
    if(r.includes('memory_dont'))return '不会';
    if(r.includes('memory_fuzzy'))return '模糊';
    if(r.includes('manual_unknown')||r.includes('seed_unfamiliar'))return '陌生词';
    if(r.includes('quick_wrong'))return '快速练习错题';
    if(r.includes('listening_wrong'))return '听音连续答错';
    if(r.includes('listening_slow'))return '听音反应慢';
    if(r.includes('automation_fail'))return '自动训练不稳';
    return '待强化';
  }
  function activeMap(){const out={};list('active').forEach(function(x){out[norm(x.word)]=x;});return out;}
  function hasListeningReason(x){const r=x&&x.reasons||[];return r.includes('listening_wrong')||r.includes('listening_slow');}
  function listeningWeak(){return all().filter(function(x){return hasListeningReason(x);});}
  function focusMap(){const out={};all().forEach(function(x){if(x&&x.word&&(x.status==='active'||hasListeningReason(x)))out[norm(x.word)]=x;});return out;}
  function recordListening(word,item,signal){
    const allowed=new Set(['listening_wrong','listening_slow','clear_listening']);if(!allowed.has(signal))return get(word);
    const pool=migrate(),k=norm(word||(item||{}).word);if(!k)return null;const existing=pool[k]||null;
    if(signal==='clear_listening'){
      if(!existing)return null;const before=(existing.reasons||[]).slice();existing.reason_history=uniq((existing.reason_history||[]).concat(before.filter(function(r){return r==='listening_wrong'||r==='listening_slow';})));existing.reasons=before.filter(function(r){return r!=='listening_wrong'&&r!=='listening_slow';});
      if(!same(before,existing.reasons))save(pool);return existing;
    }
    const wasMastered=!!(existing&&existing.status==='mastered'),pair=ensureRecord(pool,word,item||{}),x=pair[1];if(!x)return null;
    if(wasMastered)x.status='mastered';else x.status='active';setReason(x,signal);x.last_review=nowISO();x.last_seen=x.last_review;x.times_seen=(x.times_seen||0)+1;
    if(!wasMastered){x.mastered_reason='';clearLegacyDismissed(k);}save(pool);return x;
  }
  function restoreDismissed(onlyReasons){
    const d=parse(LEGACY_DISMISSED),pool=migrate(),wanted=Array.isArray(onlyReasons)?onlyReasons.filter(Boolean):[];
    let restored=0,changed=false;
    Object.keys(d).forEach(function(k0){
      const item=d[k0]||{},k=norm(item.word||k0),existing=pool[k];if(!k)return;
      if(wanted.length){const h=existing&&existing.reason_history||[];if(!wanted.some(function(r){return h.includes(r);}))return;}
      const pair=ensureRecord(pool,item.word||k,existing||{}),x=pair[1];if(!x)return;
      x.status='active';x.last_seen=nowISO();x.times_seen=(x.times_seen||0)+1;x.mastered_reason='';setReason(x,'manual_restore');
      delete d[k0];restored++;changed=true;
    });
    if(Object.keys(d).length)localStorage.setItem(LEGACY_DISMISSED,JSON.stringify(d));else localStorage.removeItem(LEGACY_DISMISSED);
    if(changed)save(pool);return restored;
  }
  function exportActive(){return list('active').map(function(x){return Object.assign({},x);});}

  window.WeaknessPool={KEY:KEY,norm:norm,migrate:migrate,get:get,all:all,listActive:function(){return list('active');},listMastered:function(){return list('mastered');},listListeningWeak:listeningWeak,activeMap:activeMap,focusMap:focusMap,isActive:isActive,markUnknown:markUnknown,enrich:enrich,markWeak:markWeak,markMastered:markMastered,markKnown:markKnown,reactivate:reactivate,removeReasons:removeReasons,importRecord:importRecord,recordPractice:recordPractice,recordListening:recordListening,syncSignals:syncSignals,primaryReason:primaryReason,restoreDismissed:restoreDismissed,exportActive:exportActive};
  migrate();
})();