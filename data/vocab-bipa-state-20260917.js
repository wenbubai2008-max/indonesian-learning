(function(){
  if(window.__VOCAB_BIPA_STATE_20260917__)return;
  window.__VOCAB_BIPA_STATE_20260917__=true;

  const $=id=>document.getElementById(id);
  const norm=s=>String(s||'').trim().toLowerCase();
  function libText(){const s=$('librarySelect');return s&&s.selectedIndex>=0?String(s.options[s.selectedIndex]?.textContent||''):'';}
  function level(){const m=libText().match(/BIPA\s*[（(]?\s*(A1|A2|B1|B2)/i);return m?m[1].toUpperCase():'';}
  function isBipa(){return !!level();}
  function memKey(){return 'indo_bipa_mem_'+level();}
  function mem(){try{return JSON.parse(localStorage.getItem(memKey())||'{}')}catch(e){return {};}}
  function source(){try{return Array.isArray(DB)?DB:[]}catch(e){return [];}}
  function raw(word){
    const rows=(window.BIPA_VOCAB_RAW&&window.BIPA_VOCAB_RAW[level()])||[];
    return rows.find(r=>Array.isArray(r)&&norm(r[0])===norm(word))||null;
  }
  function current(){
    try{const a=Array.isArray(FILTER)?FILTER:[];if(!a.length)return null;const i=((Number(idx||0)%a.length)+a.length)%a.length;return a[i]||null;}catch(e){return null;}
  }
  function statusOf(m,w){return m[norm(w)]||'';}

  function ensureGrade(){
    const tb=document.querySelector('#vocab .toolbar');if(!tb)return null;
    let s=$('sabFilterStable');
    if(!s){
      s=document.createElement('select');s.id='sabFilterStable';
      s.innerHTML='<option value="">全部分级</option><option value="S">S · 核心</option><option value="A">A · 常用</option><option value="B">B · 低频</option>';
      const cat=$('cat');if(cat&&cat.nextSibling)tb.insertBefore(s,cat.nextSibling);else tb.appendChild(s);
    }
    s.style.display=isBipa()?'':'none';
    s.onchange=function(){if(isBipa()&&typeof window.applyFilter==='function')window.applyFilter();};
    return s;
  }

  function syncTopics(){
    const cat=$('cat');if(!cat||!isBipa())return;
    const cur=cat.value;
    const themes=[...new Set(source().map(x=>raw(x.word)?.[5]).filter(Boolean))].sort();
    cat.innerHTML='<option value="">全部主题</option>'+themes.map(t=>'<option value="'+String(t).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))+'">'+String(t).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))+'</option>').join('');
    if(themes.includes(cur))cat.value=cur;
  }

  function updateStats(){
    if(!isBipa())return;
    const m=mem(),all=source();let known=0,review=0;
    all.forEach(x=>{const st=statusOf(m,x.word);if(st==='know')known++;else if(st==='fuzzy'||st==='dont')review++;});
    const unchecked=Math.max(0,all.length-known-review);
    if($('vocabCount'))$('vocabCount').textContent=all.length;
    if($('knownCount'))$('knownCount').textContent=known;
    if($('reviewCount'))$('reviewCount').textContent=review;
    if($('dbStatus'))$('dbStatus').textContent='BIPA（'+level()+'） · '+unchecked+' 未判断 · '+review+' 待掌握 · '+known+' 已掌握 · '+all.length+' 总词';
    if($('vocabTag'))$('vocabTag').textContent='BIPA（'+level()+'） '+all.length+' 词';
  }

  /*
   * BIPA 的可见词池必须和上方统计使用同一份 indo_bipa_mem_<level> 状态。
   * 旧通用词库切换器会先留下一个基于 indo_mem 的 FILTER；如果不重建，
   * 就会出现“0 未判断”但卡片仍显示“1 / 220”之类的矛盾数字。
   * 这里不自己渲染卡片，只要求统一 renderer 按 BIPA 独立状态重建 FILTER。
   */
  function rebuildVisiblePool(){
    if(!isBipa())return;
    if(typeof window.applyFilter==='function')window.applyFilter();
  }

  window.bipaMarkFinal=function(v){
    if(!isBipa())return;
    const x=current();if(!x||!x.word)return;
    const m=mem();m[norm(x.word)]=v;localStorage.setItem(memKey(),JSON.stringify(m));
    updateStats();
  };

  function sync(){
    ensureGrade();
    if(isBipa()){
      syncTopics();
      updateStats();
      rebuildVisiblePool();
    }
  }
  function queueSync(){
    [0,40,140].forEach(ms=>setTimeout(sync,ms));
  }
  document.addEventListener('change',function(e){
    if(e.target&&e.target.id==='librarySelect')queueSync();
  },true);
  window.addEventListener('vocab-library-ready',queueSync);
  [0,80,250,700].forEach(ms=>setTimeout(sync,ms));
})();
