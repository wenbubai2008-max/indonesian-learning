(function(){
  const KEY='indo_weakness_dismissed';
  function norm(s){return String(s||'').trim().toLowerCase();}
  function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{}');}catch(e){return {};}}
  function save(x){localStorage.setItem(KEY,JSON.stringify(x));}
  function dismiss(word){
    const k=norm(word); if(!k)return;
    const d=load(); d[k]={word:word,at:Date.now()}; save(d);
    try{
      const m=JSON.parse(localStorage.getItem('indo_mem')||'{}');
      m[word]='know'; localStorage.setItem('indo_mem',JSON.stringify(m));
    }catch(e){}
    try{
      const u=JSON.parse(localStorage.getItem('indo_unknown_words')||'{}');
      Object.keys(u).forEach(function(x){if(norm(x)===k||norm((u[x]||{}).word)===k)delete u[x];});
      localStorage.setItem('indo_unknown_words',JSON.stringify(u));
    }catch(e){}
    apply();
  }
  function restoreAll(){localStorage.removeItem(KEY);apply();}
  function apply(){
    const box=document.getElementById('weaknessBody'); if(!box)return;
    const dismissed=load(); let visible=0;
    box.querySelectorAll('.v2-card').forEach(function(card){
      const b=card.querySelector('b'); if(!b)return;
      const word=(b.textContent||'').trim(), k=norm(word);
      if(dismissed[k]){card.style.display='none';return;}
      visible++;
      card.classList.add('weakCardHasDone');
      if(!card.querySelector('.weakDoneBtn')){
        const btn=document.createElement('button');
        btn.type='button'; btn.className='weakDoneBtn'; btn.textContent='✓ 会了';
        btn.title='移出弱项强化';
        btn.setAttribute('aria-label','会了，移出弱项强化');
        btn.addEventListener('click',function(){dismiss(word);});
        card.appendChild(btn);
      }
    });
    const meta=document.getElementById('weaknessMeta'); if(meta)meta.textContent=visible+' 个';
    const note=box.querySelector('.v2-note');
    if(note&&!box.querySelector('.weakRestoreWrap')){
      const wrap=document.createElement('div');wrap.className='weakRestoreWrap';
      wrap.innerHTML='<span>会了的词可直接移出弱项。</span><button type="button" class="weakRestoreBtn">恢复已移出</button>';
      wrap.querySelector('button').onclick=restoreAll;
      note.insertAdjacentElement('afterend',wrap);
    }
  }

  function quickMeaningMap(){
    const out={};
    [].concat(window.DAILY_VOCAB_DB||[],window.EMBEDDED_DB||[],window.UNFAMILIAR_VOCAB_DB||[]).forEach(function(x){
      if(!x||!x.word)return;
      const k=norm(x.word);
      const cn=String(x.cn||x.meaning_cn||x.zh||'').trim();
      if(cn&&!out[k])out[k]=cn;
    });
    return out;
  }
  function decorateQuickAnswers(){
    const box=document.getElementById('quickPracticeBody');
    if(!box)return;
    const meanings=quickMeaningMap();
    box.querySelectorAll('.v2-q[data-done="1"]').forEach(function(row){
      row.querySelectorAll('.v2-opts button').forEach(function(btn){
        if(btn.querySelector('.quickMeaning'))return;
        const word=btn.getAttribute('data-v')||btn.textContent||'';
        const meaning=meanings[norm(word)];
        if(!meaning)return;
        const span=document.createElement('span');
        span.className='quickMeaning';
        span.textContent=meaning;
        btn.appendChild(span);
      });
    });
  }

  function style(){
    if(document.getElementById('weakDismissStyle'))return;
    const s=document.createElement('style');s.id='weakDismissStyle';
    s.textContent='.v2-card.weakCardHasDone{position:relative;padding-bottom:54px}.weakDoneBtn{position:absolute;right:12px;bottom:12px;margin:0;border:1px solid #cfe5d6;background:#f1faf4;color:#17652d;border-radius:9px;padding:7px 11px;font-weight:700;cursor:pointer;line-height:1.2}.weakDoneBtn:hover{background:#e7f7ec}.weakDoneBtn:focus-visible{outline:2px solid #6ba97b;outline-offset:2px}.weakRestoreWrap{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:10px 0 2px;color:#667085;font-size:13px}.weakRestoreBtn{border:0;background:transparent;color:var(--blue);cursor:pointer;padding:6px}.v2-card .sound{margin-right:6px}.v2-q[data-done="1"] .v2-opts button{min-width:128px;text-align:left;display:flex;flex-direction:column;align-items:flex-start;gap:3px}.quickMeaning{display:block;font-size:12px;line-height:1.35;font-weight:500;color:#6b7280;white-space:normal}.v2-opts .v2-ok .quickMeaning{color:#3f7650}.v2-opts .v2-bad .quickMeaning{color:#a05049}@media(max-width:700px){.weakRestoreWrap{align-items:flex-start;flex-direction:column}.v2-card.weakCardHasDone{padding-bottom:56px}.weakDoneBtn{right:10px;bottom:10px}.v2-q[data-done="1"] .v2-opts button{min-width:0;flex:1 1 45%}}';
    document.head.appendChild(s);
  }
  const obs=new MutationObserver(function(){apply();decorateQuickAnswers();});
  function boot(){
    style();
    const weak=document.getElementById('weaknessBody');if(weak)obs.observe(weak,{childList:true,subtree:true});
    const quick=document.getElementById('quickPracticeBody');if(quick)obs.observe(quick,{childList:true,subtree:true,attributes:true,attributeFilter:['data-done']});
    document.addEventListener('click',function(e){
      if(e.target&&e.target.closest&&e.target.closest('#quickPracticeBody .v2-opts button'))setTimeout(decorateQuickAnswers,0);
    },true);
    apply();decorateQuickAnswers();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.dismissWeaknessWord=dismiss;
})();