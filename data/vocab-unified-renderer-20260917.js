(function(){
  if(window.__VOCAB_UNIFIED_RENDERER_20260917__) return;
  window.__VOCAB_UNIFIED_RENDERER_20260917__ = true;

  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
  const norm = s => String(s || '').trim().toLowerCase();
  const legacyMark = window.mark;

  function arr(){ try{return (FILTER || []).slice()}catch(e){return []} }
  function source(){ try{return (DB || []).slice()}catch(e){return []} }
  function pos(){ try{return Number(idx || 0)}catch(e){return 0} }
  function currentUnified(){ const a=arr(); if(!a.length)return null; const i=((pos()%a.length)+a.length)%a.length; return a[i]||a[0]; }
  function libText(){ const s=$('librarySelect'); return s&&s.selectedIndex>=0 ? String(s.options[s.selectedIndex]?.textContent||'') : ''; }
  function libLabel(){ return libText().replace(/\s*[（(]\d+[）)]\s*$/,'').trim() || '当前词库'; }
  function bipaLevel(){ const m=libText().match(/BIPA\s*[（(]?\s*(A1|A2|B1|B2)/i); return m?m[1].toUpperCase():''; }
  function isBipa(){ return !!bipaLevel(); }

  function normalMem(){ try{return JSON.parse(localStorage.getItem('indo_mem')||'{}')}catch(e){return {}} }
  function bipaMem(){ try{return JSON.parse(localStorage.getItem('indo_bipa_mem_'+bipaLevel())||'{}')}catch(e){return {}} }
  function statusOf(word){
    if(isBipa()) return bipaMem()[norm(word)] || '';
    const m=normalMem(); return m[word] || m[norm(word)] || '';
  }

  function rawBipa(word){
    const rows=(window.BIPA_VOCAB_RAW&&window.BIPA_VOCAB_RAW[bipaLevel()])||[];
    const r=rows.find(x=>Array.isArray(x)&&norm(x[0])===norm(word));
    if(!r)return null;
    return {word:r[0]||'',cn:r[1]||'',en:r[2]||'',root:r[3]||'',theme:r[5]||'',sab:String(r[8]||'').trim().toUpperCase()};
  }
  function info(x){
    const r=isBipa()?rawBipa(x&&x.word):null;
    return {
      word:(r&&r.word)||(x&&x.word)||'',
      cn:(r&&r.cn)||(x&&x.cn)||'',
      en:(r&&r.en)||(x&&x.en)||'',
      root:(r&&r.root)||(x&&x.root)||'',
      theme:(r&&r.theme)||(x&&x.theme)||((x&&x.categories&&x.categories[0])||''),
      sab:(r&&r.sab)||String((x&&(x.sab||x.grade||x.priority))||'').toUpperCase(),
      example:(x&&(x.example||x.scene))||'',
      exampleCn:(x&&(x.example_cn||x.scene_cn))||''
    };
  }

  function gradeSelect(){
    return [...document.querySelectorAll('#vocab .toolbar select')].find(s=>[...s.options].some(o=>String(o.textContent||'').includes('全部分级'))) || null;
  }

  function installStyle(){
    ['vocabCleanStyle','vocabFinalFixStyle','bipaStableStyle','bipaFinalV7Style','bipaV8BadgeStyle','bipaFlipLayoutFix20260913','bipaSwitchPolishStyle'].forEach(id=>{const n=$(id);if(n)n.remove()});
    let st=$('vocabUnifiedStyle20260917'); if(st)st.remove();
    st=document.createElement('style'); st.id='vocabUnifiedStyle20260917'; st.textContent=`
      #vocab .vocabUnifiedCard{min-height:510px;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:#fbfcff;border:1px solid #dfe5f1;border-radius:24px;padding:66px 38px 54px;overflow:hidden}
      #vocab .vocabUnifiedProgress{position:absolute;left:38px;top:30px;color:#8a94a8;font-size:16px;font-weight:800}
      #vocab .vocabUnifiedTopic{position:absolute;right:32px;top:26px;background:#eef3ff;color:#3157d5;border-radius:999px;padding:8px 13px;font-size:14px;font-weight:800;max-width:42%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #vocab .vocabUnifiedBadge{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;font-size:16px;font-weight:900;border:1px solid transparent;box-shadow:0 4px 14px rgba(23,32,51,.08)}
      #vocab .vocabUnifiedBadge.S{background:#e8f7ed;color:#17743a;border-color:#bfe8cb}#vocab .vocabUnifiedBadge.A{background:#fff5dd;color:#9a6500;border-color:#f4dda1}#vocab .vocabUnifiedBadge.B{background:#eef1f6;color:#647084;border-color:#dfe4ec}
      #vocab .vocabUnifiedWordLine{display:flex;align-items:center;justify-content:center;gap:18px;max-width:100%}
      #vocab .vocabUnifiedWord{font-size:52px;line-height:1.12;font-weight:880;color:#626d83;overflow-wrap:anywhere}
      #vocab .vocabUnifiedSound{width:58px!important;height:58px!important;min-width:58px!important;border-radius:16px;border:1px solid #dde3ee;background:#fff;box-shadow:0 6px 18px rgba(23,32,51,.06);cursor:pointer;font-size:26px;display:flex;align-items:center;justify-content:center;padding:0!important}
      #vocab .vocabUnifiedMeaning{display:none;margin-top:34px;max-width:760px}.vocabUnifiedCard.revealed .vocabUnifiedMeaning{display:block}
      #vocab .vocabUnifiedCn{font-size:27px;font-weight:850;color:#5d687e;line-height:1.45}.vocabUnifiedEn{font-size:20px;color:#778197;margin-top:11px;line-height:1.45}.vocabUnifiedRoot{font-size:16px;color:#8a94a8;font-weight:750;margin-top:20px}
      #vocab .vocabUnifiedExample{font-size:17px;color:#566174;line-height:1.65;margin-top:18px}.vocabUnifiedExampleCn{font-size:14px;color:#8a94a8;line-height:1.6;margin-top:4px}
      #vocab .vocabUnifiedActions,#vocab .vocabUnifiedMemory{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:18px}
      #vocab .vocabUnifiedActions button,#vocab .vocabUnifiedMemory button{border-radius:14px;padding:12px 22px;font-weight:800;cursor:pointer}.vocabUnifiedActions .nav{border:0;background:#eef1f6;color:#172033}.vocabUnifiedActions .next{border:0;background:#3157d5;color:#fff}.vocabUnifiedMemory{border-top:1px solid #e5e9f1;padding-top:17px}.vocabUnifiedMemory button{background:#fff;border:1px solid #e0e5ee;color:#283246}
      #vocab .vocabUnifiedMemory .know{border-color:#bfe8cb}#vocab .vocabUnifiedMemory .fuzzy{border-color:#f2d89c}#vocab .vocabUnifiedMemory .dont{border-color:#efc8c4}
      #vocabBox>.flash,#vocabBox>.cleanFlash,#vocabBox>.bipaV7Card{display:none!important}
      @media(max-width:700px){#vocab .vocabUnifiedCard{min-height:430px;padding:68px 20px 36px}#vocab .vocabUnifiedProgress{left:20px;top:24px;font-size:14px}#vocab .vocabUnifiedTopic{right:18px;top:19px;max-width:55%;font-size:12px;padding:7px 10px}#vocab .vocabUnifiedWord{font-size:38px}#vocab .vocabUnifiedSound{width:50px!important;height:50px!important;min-width:50px!important}#vocab .vocabUnifiedCn{font-size:23px}}
    `; document.head.appendChild(st);
  }

  let audio=null;
  window.vocabUnifiedSpeak=function(text){
    text=String(text||'').trim(); if(!text)return;
    try{if(audio){audio.pause();audio=null}}catch(e){}
    try{if(window.speechSynthesis)window.speechSynthesis.cancel()}catch(e){}
    try{
      if(window.speechSynthesis&&typeof SpeechSynthesisUtterance!=='undefined'){
        const u=new SpeechSynthesisUtterance(text); u.lang='id-ID'; u.rate=.88;
        const vs=window.speechSynthesis.getVoices?window.speechSynthesis.getVoices():[];
        const v=vs.find(v=>/^id(?:-|_)/i.test(v.lang||''))||vs.find(v=>/indones/i.test((v.name||'')+' '+(v.lang||''))); if(v)u.voice=v;
        window.speechSynthesis.speak(u); return;
      }
    }catch(e){}
    try{audio=new Audio('https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=id&q='+encodeURIComponent(text));audio.play().catch(()=>{})}catch(e){}
  };

  function render(){
    installStyle();
    const box=$('vocabBox'); if(!box)return;
    const a=arr(),x=currentUnified(); if(!a.length||!x){box.innerHTML='<div class="empty">没有匹配词汇</div>';return;}
    if(($('mode')?.value||'flash')==='quiz'){
      const others=a.filter(y=>y.word!==x.word&&(y.cn||y.en)).sort(()=>Math.random()-.5).slice(0,3), opts=[x,...others].sort(()=>Math.random()-.5);
      box.innerHTML='<div class="q">“'+esc(x.word)+'” 最接近哪个意思？ <button class="sound" type="button" onclick="vocabUnifiedSpeak('+JSON.stringify(x.word).replace(/"/g,'&quot;')+')">🔊</button></div><div class="opts">'+opts.map(o=>'<button class="opt" onclick="answerQuiz(this,'+JSON.stringify(o.word===x.word)+')">'+esc(o.cn||o.en||'—')+'</button>').join('')+'</div><div class="actions"><button class="primary" onclick="vocabUnifiedNext()">下一题</button></div>';
      return;
    }
    const d=info(x), p=((pos()%a.length)+a.length)%a.length+1;
    const topic=d.theme?'<div class="vocabUnifiedTopic">'+esc(d.theme)+'</div>':'';
    const badge=isBipa()&&['S','A','B'].includes(d.sab)?'<div class="vocabUnifiedBadge '+d.sab+'">'+d.sab+'</div>':'';
    const root=d.root?'<div class="vocabUnifiedRoot">词根 · '+esc(d.root)+'</div>':'';
    const example=d.example?'<div class="vocabUnifiedExample">'+esc(d.example)+'</div>':'';
    const exampleCn=d.exampleCn?'<div class="vocabUnifiedExampleCn">'+esc(d.exampleCn)+'</div>':'';
    box.innerHTML='<div id="vocabUnifiedCard" class="vocabUnifiedCard"><div class="vocabUnifiedProgress">第 '+p+' / '+a.length+' 个</div>'+topic+'<div>'+badge+'<div class="vocabUnifiedWordLine"><div class="vocabUnifiedWord">'+esc(d.word)+'</div><button class="vocabUnifiedSound" type="button" onclick="event.preventDefault();event.stopPropagation();vocabUnifiedSpeak('+JSON.stringify(d.word).replace(/"/g,'&quot;')+')">🔊</button></div><div class="vocabUnifiedMeaning"><div class="vocabUnifiedCn">'+esc(d.cn||'暂无中文')+'</div><div class="vocabUnifiedEn">'+esc(d.en||'')+'</div>'+root+example+exampleCn+'</div></div></div><div class="vocabUnifiedActions"><button class="nav" type="button" onclick="vocabUnifiedPrev()">上一个</button><button class="nav" id="vocabUnifiedFlipBtn" type="button" onclick="vocabUnifiedFlip()">翻卡</button><button class="next" type="button" onclick="vocabUnifiedNext()">下一个</button></div><div class="vocabUnifiedMemory"><button class="know" type="button" onclick="vocabUnifiedMark(\'know\')">会了</button><button class="fuzzy" type="button" onclick="vocabUnifiedMark(\'fuzzy\')">模糊</button><button class="dont" type="button" onclick="vocabUnifiedMark(\'dont\')">不会</button></div>';
  }

  function filterByView(reset){
    const q=String($('search')?.value||'').trim().toLowerCase();
    const cat=String($('cat')?.value||'');
    const sab=isBipa()?String(gradeSelect()?.value||''):'';
    const view=localStorage.getItem('vocab_view_mode')||'';
    let out=source().filter(x=>{
      if(!x||!x.word)return false;
      if((x.categories||[]).includes('粗口/俚语'))return false;
      const st=statusOf(x.word),d=info(x);
      if(view==='known'){if(st!=='know')return false;}
      else if(view==='review'){if(st!=='fuzzy'&&st!=='dont')return false;}
      else if(st)return false;
      if(cat){
        if(isBipa()){if(d.theme!==cat)return false;}
        else if(!(x.categories||[]).includes(cat))return false;
      }
      if(sab&&d.sab!==sab)return false;
      if(q&&!([x.word,d.cn,d.en,d.root,d.theme].join(' ').toLowerCase().includes(q)))return false;
      return true;
    });
    try{FILTER=out;if(reset)idx=0;else if(out.length)idx=Math.min(Math.max(0,pos()),out.length-1);else idx=0}catch(e){}
    render();
    return out;
  }

  function setView(mode){
    if(mode)localStorage.setItem('vocab_view_mode',mode);else localStorage.removeItem('vocab_view_mode');
    const s=$('search');if(s)s.value='';const c=$('cat');if(c)c.value='';const g=gradeSelect();if(g)g.value='';
    const out=filterByView(true);
    const st=$('dbStatus');if(st){
      if(mode==='known')st.textContent=libLabel()+' · 已掌握 '+out.length+' 词（查看中）';
      else if(mode==='review')st.textContent=libLabel()+' · 待掌握 '+out.length+' 词（查看中）';
    }
  }

  window.vocabUnifiedFlip=function(){const c=$('vocabUnifiedCard'),b=$('vocabUnifiedFlipBtn');if(!c)return;c.classList.toggle('revealed');if(b)b.textContent=c.classList.contains('revealed')?'收起':'翻卡'};
  window.vocabUnifiedPrev=function(){const a=arr();if(!a.length)return;try{idx=(pos()-1+a.length)%a.length}catch(e){}render()};
  window.vocabUnifiedNext=function(){const a=arr();if(!a.length)return;try{idx=(pos()+1)%a.length}catch(e){}render()};
  window.vocabUnifiedMark=function(v){
    const x=currentUnified(); if(!x)return;
    try{
      if(isBipa()&&typeof window.bipaMarkFinal==='function'){window.bipaMarkFinal(v);setTimeout(()=>filterByView(false),0);return;}
      if(typeof legacyMark==='function'){legacyMark(v);setTimeout(()=>filterByView(false),0);return;}
      if(typeof window.mark==='function'&&window.mark!==window.vocabUnifiedMark){window.mark(v);setTimeout(()=>filterByView(false),0);return;}
    }catch(e){}
    try{const m=normalMem();m[x.word]=v;m[norm(x.word)]=v;localStorage.setItem('indo_mem',JSON.stringify(m));}catch(e){}
    filterByView(false);
  };

  function bindStats(){
    const known=$('knownCount')?.closest('button');if(known){known.onclick=e=>{e&&e.preventDefault();setView('known')};known.title='查看当前词库已掌握词汇';}
    const review=$('reviewCount')?.closest('button');if(review){review.onclick=e=>{e&&e.preventDefault();setView('review')};review.title='查看当前词库待掌握词汇（模糊 / 不会）';}
  }

  function enforce(){
    installStyle();bindStats();
    window.renderVocab=render; try{renderVocab=render}catch(e){}
    window.nextWord=window.vocabUnifiedNext; try{nextWord=window.vocabUnifiedNext}catch(e){}
    window.applyFilter=function(){return filterByView(true)}; try{applyFilter=window.applyFilter}catch(e){}
    window.showKnownWords=function(){setView('known')}; try{showKnownWords=window.showKnownWords}catch(e){}
    window.showReviewWords=function(){setView('review')};
    const sec=$('vocab'); if(sec){sec.classList.remove('bipaStable','bipaFinalV7','bipaSwitching');}
    document.querySelectorAll('#vocabBox>.flash,#vocabBox>.cleanFlash,#vocabBox>.bipaV7Card').forEach(n=>n.remove());
  }

  let fixing=false;
  const obs=new MutationObserver(()=>{
    if(fixing)return;
    const box=$('vocabBox');if(!box)return;
    if(box.querySelector(':scope>.flash,:scope>.cleanFlash,:scope>.bipaV7Card')){
      fixing=true;render();queueMicrotask(()=>{fixing=false});
    }
  });

  function bindDynamicControls(){
    const g=gradeSelect();if(g&&!g.dataset.unifiedBound){g.dataset.unifiedBound='1';g.addEventListener('change',()=>setTimeout(()=>filterByView(true),0));}
  }
  function boot(){
    enforce();bindDynamicControls();
    const box=$('vocabBox');if(box)obs.observe(box,{childList:true,subtree:false});
    [80,220,600,1500].forEach(ms=>setTimeout(()=>{enforce();bindDynamicControls();const box=$('vocabBox');if(box&&!box.querySelector('.vocabUnifiedCard')&&arr().length)render();},ms));
  }

  if(document.readyState==='complete')setTimeout(boot,0);else window.addEventListener('load',()=>setTimeout(boot,0),{once:true});
  window.addEventListener('vocab-library-ready',()=>setTimeout(()=>{enforce();bindDynamicControls();render()},30));
  $('librarySelect')?.addEventListener('change',()=>setTimeout(()=>{enforce();bindDynamicControls();render()},380));
  $('mode')?.addEventListener('change',()=>setTimeout(render,0));
})();
