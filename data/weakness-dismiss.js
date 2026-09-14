(function(){
  const KEY='indo_weakness_dismissed';
  const PAGE_SIZE=30;
  let sessionItems=[];
  let currentPage=0;
  let originalOpen=null;

  function norm(s){return String(s||'').trim().toLowerCase();}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});}
  function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{}');}catch(e){return {};}}
  function save(x){localStorage.setItem(KEY,JSON.stringify(x));}
  function pool(){return window.WeaknessPool||null;}

  function sourceMap(){
    const out={};
    [].concat(window.DAILY_VOCAB_DB||[],window.EMBEDDED_DB||[],window.UNFAMILIAR_VOCAB_DB||[]).forEach(function(x){
      if(!x||!x.word)return;
      const k=norm(x.word),old=out[k]||{};
      out[k]=Object.assign({},old,x);
      if(!out[k].cn&&old.cn)out[k].cn=old.cn;
      if(!out[k].example)out[k].example=x.example||((x.contexts||[]).slice(-1)[0])||old.example||'';
      if(!out[k].example_cn)out[k].example_cn=x.example_cn||old.example_cn||'';
    });
    return out;
  }

  function allowedSource(x){
    if(!x||x.status!=='active')return false;
    const r=x.reasons||[];
    if(r.includes('quick_wrong')||r.includes('manual_unknown'))return true;
    if(r.includes('manual_restore')){
      const h=x.reason_history||[];
      return h.includes('quick_wrong')||h.includes('manual_unknown');
    }
    return false;
  }

  function reasonLabel(x){
    const r=x.reasons||[],h=x.reason_history||[];
    if(r.includes('quick_wrong')||h.includes('quick_wrong'))return '快速练习错题';
    if(r.includes('manual_unknown')||h.includes('manual_unknown'))return '阅读陌生词';
    return '待强化';
  }

  function eligibleItems(){
    const wp=pool();
    if(!wp)return [];
    const map=sourceMap();
    return wp.listActive().filter(allowedSource).map(function(x){
      const k=norm(x.word),base=map[k]||{},contexts=x.contexts||[];
      return {
        key:k,
        word:x.word||base.word||k,
        cn:x.cn||base.cn||'待补释义',
        example:x.example||contexts.slice(-1)[0]||base.example||'',
        example_cn:x.example_cn||base.example_cn||'',
        reason:reasonLabel(x)
      };
    });
  }

  function makeSession(){
    sessionItems=eligibleItems();
    currentPage=0;
  }

  function itemStillActive(item){
    const wp=pool(),x=wp&&wp.get(item.word);
    return !!x&&allowedSource(x);
  }

  function pageItems(page){
    const start=page*PAGE_SIZE;
    return sessionItems.slice(start,start+PAGE_SIZE);
  }

  function remainingOnCurrentPage(){
    return pageItems(currentPage).filter(itemStillActive).length;
  }

  function dismiss(word){
    const k=norm(word);if(!k)return;
    const wp=pool();
    if(wp)wp.markMastered(word,'weakness_done');
    else{
      const d=load();d[k]={word:word,at:Date.now()};save(d);
      try{
        const u=JSON.parse(localStorage.getItem('indo_unknown_words')||'{}');
        Object.keys(u).forEach(function(x){if(norm(x)===k||norm((u[x]||{}).word)===k)delete u[x];});
        localStorage.setItem('indo_unknown_words',JSON.stringify(u));
      }catch(e){}
    }
    try{
      const m=JSON.parse(localStorage.getItem('indo_mem')||'{}');
      m[word]='know';localStorage.setItem('indo_mem',JSON.stringify(m));
    }catch(e){}
    updateVisibleCards();
    setTimeout(renderFiltered,30);
  }

  function restoreAll(){
    const wp=pool();
    if(wp)wp.restoreDismissed();
    else localStorage.removeItem(KEY);
    makeSession();
    renderFiltered();
  }

  function cardHtml(x){
    return '<div class="v2-card weakCardHasDone" data-weak-word="'+esc(x.word)+'">'
      +'<div><b>'+esc(x.word)+'</b><span>'+esc(x.reason)+'</span></div>'
      +'<strong>'+esc(x.cn)+'</strong>'
      +(x.example?'<p class="v2-ex">'+esc(x.example)+'</p>':'')
      +(x.example_cn?'<p class="v2-excn">'+esc(x.example_cn)+'</p>':'')
      +'<button class="sound" type="button" onclick=\'speak('+JSON.stringify(x.word)+')\'>🔊</button>'
      +'<button class="weakDoneBtn" type="button" data-done-word="'+esc(x.word)+'" title="标记已掌握并退出弱项强化">✓ 会了</button>'
      +'</div>';
  }

  function navHtml(totalPages){
    if(totalPages<=1)return '';
    return '<div class="weakPager">'
      +'<button class="secondary" type="button" '+(currentPage===0?'disabled':'')+' onclick="weaknessPageMove(-1)">← 上一页</button>'
      +'<span>第 '+(currentPage+1)+' / '+totalPages+' 页</span>'
      +'<button class="secondary" type="button" '+(currentPage>=totalPages-1?'disabled':'')+' onclick="weaknessPageMove(1)">下一页 →</button>'
      +'</div>';
  }

  function renderFiltered(){
    const body=document.getElementById('weaknessBody');
    if(!body||!document.getElementById('weakness')?.classList.contains('active'))return;
    if(!sessionItems.length){
      const fresh=eligibleItems();
      if(fresh.length)sessionItems=fresh;
    }
    const totalPages=Math.max(1,Math.ceil(sessionItems.length/PAGE_SIZE));
    if(currentPage>=totalPages)currentPage=totalPages-1;
    const page=pageItems(currentPage);
    const remaining=page.filter(itemStillActive);
    const meta=document.getElementById('weaknessMeta');
    if(meta)meta.textContent=remaining.length+' 个';

    if(!sessionItems.length){
      body.innerHTML='<div class="v2-note">这里现在只显示两类词：快速练习答错的词，以及阅读中你主动加入的陌生词。977词库里单纯标记为“不会 / 模糊”的词不在这里展示。</div><div class="empty"><b>目前没有这两类待强化词 ✓</b></div>';
      return;
    }

    body.innerHTML='<div class="v2-note">这里只强化两类词：① 快速练习答错；② 阅读中主动加入的陌生词。977词库里单纯标记为“不会 / 模糊”的词继续保留在原学习体系中，但不在这里展示。每页最多 30 个，右上角数字表示当前页还剩多少个。</div>'
      +'<div class="weakRestoreWrap"><span>点“会了”后，本页数量会立即减 1；以后再次答错仍可重新进入。</span><button type="button" class="weakRestoreBtn">恢复已移出</button></div>'
      +navHtml(totalPages)
      +'<div class="v2-weak">'+page.map(cardHtml).join('')+'</div>'
      +navHtml(totalPages);

    body.querySelectorAll('.weakDoneBtn').forEach(function(btn){
      btn.onclick=function(){dismiss(btn.getAttribute('data-done-word')||'');};
    });
    body.querySelectorAll('.weakRestoreBtn').forEach(function(btn){btn.onclick=restoreAll;});
    updateVisibleCards();
  }

  function updateVisibleCards(){
    const body=document.getElementById('weaknessBody');if(!body)return;
    body.querySelectorAll('[data-weak-word]').forEach(function(card){
      const word=card.getAttribute('data-weak-word')||'';
      card.style.display=itemStillActive({word:word})?'':'none';
    });
    const meta=document.getElementById('weaknessMeta');
    if(meta)meta.textContent=remainingOnCurrentPage()+' 个';
  }

  function quickMeaningMap(){
    const out={};
    [].concat(window.DAILY_VOCAB_DB||[],window.EMBEDDED_DB||[],window.UNFAMILIAR_VOCAB_DB||[]).forEach(function(x){
      if(!x||!x.word)return;
      const k=norm(x.word),cn=String(x.cn||x.meaning_cn||x.zh||'').trim();
      if(cn&&!out[k])out[k]=cn;
    });
    return out;
  }

  function decorateQuickAnswers(){
    const box=document.getElementById('quickPracticeBody');if(!box)return;
    const meanings=quickMeaningMap();
    box.querySelectorAll('.v2-q[data-done="1"]').forEach(function(row){
      row.querySelectorAll('.v2-opts button').forEach(function(btn){
        if(btn.querySelector('.quickMeaning'))return;
        const word=btn.getAttribute('data-v')||btn.textContent||'',meaning=meanings[norm(word)];
        if(!meaning)return;
        const span=document.createElement('span');span.className='quickMeaning';span.textContent=meaning;btn.appendChild(span);
      });
    });
  }

  function style(){
    if(document.getElementById('weakDismissStyle'))return;
    const s=document.createElement('style');s.id='weakDismissStyle';
    s.textContent='.v2-card.weakCardHasDone,.weak-card.weakCardHasDone{position:relative;padding-bottom:54px}.weakDoneBtn{position:absolute;right:12px;bottom:12px;margin:0;border:1px solid #cfe5d6;background:#f1faf4;color:#17652d;border-radius:9px;padding:7px 11px;font-weight:700;cursor:pointer;line-height:1.2}.weakDoneBtn:hover{background:#e7f7ec}.weakDoneBtn:focus-visible{outline:2px solid #6ba97b;outline-offset:2px}.weakRestoreWrap{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:10px 0 2px;color:#667085;font-size:13px}.weakRestoreBtn{border:0;background:transparent;color:var(--blue);cursor:pointer;padding:6px}.weakPager{display:flex;justify-content:center;align-items:center;gap:12px;margin:14px 0}.weakPager span{color:#667085;font-size:13px}.weakPager button:disabled{opacity:.35}.v2-card .sound,.weak-card .sound{margin-right:6px}.v2-q[data-done="1"] .v2-opts button{min-width:128px;text-align:left;display:flex;flex-direction:column;align-items:flex-start;gap:3px}.quickMeaning{display:block;font-size:12px;line-height:1.35;font-weight:500;color:#6b7280;white-space:normal}.v2-opts .v2-ok .quickMeaning{color:#3f7650}.v2-opts .v2-bad .quickMeaning{color:#a05049}@media(max-width:700px){.weakRestoreWrap{align-items:flex-start;flex-direction:column}.v2-card.weakCardHasDone,.weak-card.weakCardHasDone{padding-bottom:56px}.weakDoneBtn{right:10px;bottom:10px}.v2-q[data-done="1"] .v2-opts button{min-width:0;flex:1 1 45%}.weakPager{gap:7px}}';
    document.head.appendChild(s);
  }

  function installOpenOverride(){
    if(window.openWeaknessV2&&window.openWeaknessV2.__sourceFiltered)return;
    originalOpen=window.openWeaknessV2;
    const wrapped=function(){
      let r;
      if(typeof originalOpen==='function')r=originalOpen.apply(this,arguments);
      else if(typeof window.go==='function')window.go('weakness');
      makeSession();
      setTimeout(renderFiltered,0);
      return r;
    };
    wrapped.__sourceFiltered=true;
    window.openWeaknessV2=wrapped;
  }

  window.weaknessPageMove=function(delta){
    const total=Math.max(1,Math.ceil(sessionItems.length/PAGE_SIZE));
    currentPage=Math.max(0,Math.min(total-1,currentPage+Number(delta||0)));
    renderFiltered();
    window.scrollTo({top:0,behavior:'smooth'});
  };

  function boot(){
    style();installOpenOverride();
    const quick=document.getElementById('quickPracticeBody');
    if(quick)new MutationObserver(decorateQuickAnswers).observe(quick,{childList:true,subtree:true,attributes:true,attributeFilter:['data-done']});
    document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('#quickPracticeBody .v2-opts button'))setTimeout(decorateQuickAnswers,0);},true);
    window.addEventListener('weak-pool-changed',function(){
      updateVisibleCards();
      if(document.getElementById('weakness')?.classList.contains('active'))setTimeout(renderFiltered,30);
    });
    decorateQuickAnswers();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.dismissWeaknessWord=dismiss;
})();