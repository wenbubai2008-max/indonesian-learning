(function(){
  const KEY='indo_weak_pool_v1';
  const LEGACY_UNKNOWN='indo_unknown_words';
  const LEGACY_DISMISSED='indo_weakness_dismissed';

  function norm(s){return String(s||'').trim().toLowerCase();}
  function parse(key){try{return JSON.parse(localStorage.getItem(key)||'{}')||{};}catch(e){return {};}}
  function load(){return parse(KEY);}
  function nowISO(){return new Date().toISOString();}
  function uniq(a){return Array.from(new Set((a||[]).filter(Boolean)));}
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
    x.status=x.status||'active';x.reasons=uniq(x.reasons||[]);
    x.first_seen=x.first_seen||nowISO();x.last_seen=x.last_seen||x.first_seen;
    x.times_seen=Number(x.times_seen||0);
    x.wrong_count=Number(x.wrong_count||0);x.right_streak=Number(x.right_streak||0);
    pool[k]=x;return [k,x];
  }
  function setReason(x,reason){if(reason)x.reasons=uniq((x.reasons||[]).concat(reason));}
  function clearLegacyDismissed(k){const d=parse(LEGACY_DISMISSED);if(d[k]){delete d[k];localStorage.setItem(LEGACY_DISMISSED,JSON.stringify(d));}}
  function removeLegacyUnknown(k){const u=parse(LEGACY_UNKNOWN);let changed=false;Object.keys(u).forEach(function(a){if(norm(a)===k||norm((u[a]||{}).word)===k){delete u[a];changed=true;}});if(changed)localStorage.setItem(LEGACY_UNKNOWN,JSON.stringify(u));}

  function migrate(){
    const pool=load();let changed=false;
    const unknown=parse(LEGACY_UNKNOWN);
    Object.keys(unknown).forEach(function(k0){
      const u=unknown[k0]||{},k=norm(u.word||k0);if(!k)return;
      if(pool[k]&&pool[k].status==='mastered')return;
      const pair=ensureRecord(pool,u.word||k,u),x=pair[1];if(!x)return;
      x.status='active';setReason(x,'manual_unknown');x.last_seen=u.last_seen||x.last_seen;x.times_seen=Math.max(x.times_seen||0,Number(u.times_seen||1));changed=true;
    });
    (window.UNFAMILIAR_VOCAB_DB||[]).forEach(function(u){
      if(!u||!u.word)return;const k=norm(u.word);if(pool[k]&&pool[k].status==='mastered')return;
      const pair=ensureRecord(pool,u.word,u),x=pair[1];if(!x)return;
      x.status='active';setReason(x,'seed_unfamiliar');x.last_seen=u.last_seen||x.last_seen;x.times_seen=Math.max(x.times_seen||0,Number(u.times_seen||1));changed=true;
    });
    const dismissed=parse(LEGACY_DISMISSED);
    Object.keys(dismissed).forEach(function(k0){
      const d=dismissed[k0]||{},k=norm(d.word||k0);if(!k)return;
      const pair=ensureRecord(pool,d.word||k,{}),x=pair[1];if(!x)return;
      const t=Number(d.at||0);if(!x.last_seen||t>=ms(x.last_seen)){x.status='mastered';x.last_mastered=t?new Date(t).toISOString():nowISO();x.mastered_reason=x.mastered_reason||'legacy_dismiss';changed=true;}
    });
    if(changed)save(pool);return pool;
  }

  function get(word){const pool=migrate(),k=norm(word);return pool[k]||null;}
  function all(){return Object.values(migrate());}
  function list(status){return all().filter(function(x){return x.status===status;});}
  function isActive(word){const x=get(word);return !!x&&x.status==='active';}

  function activate(word,item,reason){
    const pool=migrate(),pair=ensureRecord(pool,word,item),k=pair[0],x=pair[1];if(!x)return null;
    const n=nowISO();x.status='active';x.last_seen=n;x.times_seen=(x.times_seen||0)+1;x.last_mastered=x.last_mastered||'';x.mastered_reason='';setReason(x,reason||'manual_unknown');clearLegacyDismissed(k);save(pool);return x;
  }
  function markUnknown(item){
    const x=activate((item||{}).word,item,'manual_unknown');
    if(x){
      const u=parse(LEGACY_UNKNOWN),k=norm(x.word);u[k]=Object.assign({},u[k]||{},x,{status:undefined,reasons:undefined,wrong_count:undefined,right_streak:undefined,last_wrong:undefined,last_review:undefined,last_mastered:undefined,mastered_reason:undefined});
      Object.keys(u[k]).forEach(function(a){if(u[k][a]===undefined)delete u[k][a];});localStorage.setItem(LEGACY_UNKNOWN,JSON.stringify(u));window.dispatchEvent(new CustomEvent('unknown-vocab-changed'));
    }
    return x;
  }
  function enrich(word,item){
    const pool=migrate(),k=norm(word);if(!pool[k])return null;pool[k]=mergeItem(pool[k],item||{});save(pool);return pool[k];
  }
  function markWeak(word,item,reason){return activate(word,item,reason||'weak');}
  function markMastered(word,reason){
    const pool=migrate(),k=norm(word);if(!k)return null;const pair=ensureRecord(pool,word,{}),x=pair[1];if(!x)return null;
    const n=nowISO();x.status='mastered';x.last_mastered=n;x.last_review=n;x.right_streak=Math.max(3,x.right_streak||0);x.mastered_reason=reason||'user_mastered';removeLegacyUnknown(k);
    const d=parse(LEGACY_DISMISSED);d[k]={word:x.word,at:Date.now()};localStorage.setItem(LEGACY_DISMISSED,JSON.stringify(d));save(pool);window.dispatchEvent(new CustomEvent('unknown-vocab-changed'));return x;
  }
  function markKnown(word,reason){const x=get(word);if(!x)return null;return markMastered(word,reason||'known');}
  function reactivate(word,reason){const x=get(word);return activate(word,x||{word:word},reason||'manual_reactivate');}

  function recordPractice(word,ok,item){
    const pool=migrate(),k=norm(word);if(!k)return null;
    let x=pool[k]||null;
    if(!ok){
      const pair=ensureRecord(pool,word,item||{});x=pair[1];x.status='active';setReason(x,'quick_wrong');x.wrong_count=(x.wrong_count||0)+1;x.right_streak=0;x.last_wrong=nowISO();x.last_review=x.last_wrong;clearLegacyDismissed(k);save(pool);return x;
    }
    if(!x)return null;
    x.last_review=nowISO();x.right_streak=(x.right_streak||0)+1;
    const hardReasons=(x.reasons||[]).filter(function(r){return r!=='quick_wrong';});
    if(x.status==='active'&&x.right_streak>=3&&!hardReasons.length){x.status='mastered';x.last_mastered=x.last_review;x.mastered_reason='3_correct';removeLegacyUnknown(k);}
    save(pool);return x;
  }

  function syncSignals(wordMap,mem,practice){
    const pool=migrate(),mm=mem||{},ps=practice||{};let changed=false;
    Object.keys(mm).forEach(function(raw){
      const st=mm[raw],k=norm(raw);if(st!=='dont'&&st!=='fuzzy')return;
      const item=(wordMap||{})[k]||{word:raw};const pair=ensureRecord(pool,item.word||raw,item),x=pair[1];
      if(x.status==='mastered'&&x.last_mastered&&ms(x.last_mastered)>=ms(x.last_seen))return;
      x.status='active';setReason(x,st==='dont'?'memory_dont':'memory_fuzzy');changed=true;
    });
    Object.keys(ps).forEach(function(k0){
      const p=ps[k0]||{},k=norm(k0);if(!k||!(p.wrong>0)||Number(p.streak||0)>=3)return;
      const existing=pool[k];if(existing&&existing.status==='mastered'&&ms(existing.last_mastered)>=Number(p.last_wrong||p.last||0))return;
      const item=(wordMap||{})[k]||{word:k};const pair=ensureRecord(pool,item.word||k,item),x=pair[1];x.status='active';setReason(x,'quick_wrong');x.wrong_count=Math.max(x.wrong_count||0,Number(p.wrong||0));x.right_streak=Number(p.streak||0);changed=true;
    });
    if(changed)save(pool);return pool;
  }

  function primaryReason(x){
    const r=x&&x.reasons||[];
    if(r.includes('memory_dont'))return '不会';
    if(r.includes('memory_fuzzy'))return '模糊';
    if(r.includes('manual_unknown')||r.includes('seed_unfamiliar'))return '陌生词';
    if(r.includes('quick_wrong'))return '快速练习错题';
    return '待强化';
  }
  function activeMap(){const out={};list('active').forEach(function(x){out[norm(x.word)]=x;});return out;}
  function restoreDismissed(){
    const d=parse(LEGACY_DISMISSED),keys=Object.keys(d);keys.forEach(function(k){reactivate((d[k]||{}).word||k,'manual_restore');});localStorage.removeItem(LEGACY_DISMISSED);return keys.length;
  }
  function exportActive(){return list('active').map(function(x){return Object.assign({},x);});}

  window.WeaknessPool={KEY:KEY,norm:norm,migrate:migrate,get:get,all:all,listActive:function(){return list('active');},listMastered:function(){return list('mastered');},activeMap:activeMap,isActive:isActive,markUnknown:markUnknown,enrich:enrich,markWeak:markWeak,markMastered:markMastered,markKnown:markKnown,reactivate:reactivate,recordPractice:recordPractice,syncSignals:syncSignals,primaryReason:primaryReason,restoreDismissed:restoreDismissed,exportActive:exportActive};
  migrate();
})();
