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
      if(!card.querySelector('.weakDoneBtn')){
        const btn=document.createElement('button');
        btn.type='button'; btn.className='weakDoneBtn'; btn.textContent='✓ 会了';
        btn.title='移出弱项强化';
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
  function style(){
    if(document.getElementById('weakDismissStyle'))return;
    const s=document.createElement('style');s.id='weakDismissStyle';
    s.textContent='.weakDoneBtn{margin-top:10px;border:1px solid #cfe5d6;background:#f1faf4;color:#17652d;border-radius:9px;padding:7px 11px;font-weight:700;cursor:pointer}.weakDoneBtn:hover{background:#e7f7ec}.weakRestoreWrap{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:10px 0 2px;color:#667085;font-size:13px}.weakRestoreBtn{border:0;background:transparent;color:var(--blue);cursor:pointer;padding:6px}.v2-card .sound{margin-right:6px}@media(max-width:700px){.weakRestoreWrap{align-items:flex-start;flex-direction:column}}';
    document.head.appendChild(s);
  }
  const obs=new MutationObserver(function(){apply();});
  function boot(){style();const box=document.getElementById('weaknessBody');if(box)obs.observe(box,{childList:true,subtree:true});apply();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.dismissWeaknessWord=dismiss;
})();