(function(){
  const MEM_KEY='indo_mem';
  let installed=false,pending=false;

  function mem(){try{return JSON.parse(localStorage.getItem(MEM_KEY)||'{}')}catch(e){return {}}}
  function isKnown(x){if(!x||!x.word)return false;return mem()[x.word]==='know';}

  function addStyle(){
    if(document.getElementById('vocabMemoryFeedbackStyle'))return;
    const s=document.createElement('style');
    s.id='vocabMemoryFeedbackStyle';
    s.textContent=`
      @keyframes memFlashKnow{0%{transform:scale(1);background:#fff}35%{transform:scale(1.08);background:#dff6e7;border-color:#63b879;color:#166534;box-shadow:0 0 0 6px rgba(34,197,94,.10)}100%{transform:scale(1);background:#fff}}
      @keyframes memFlashFuzzy{0%{transform:scale(1);background:#fff}35%{transform:scale(1.08);background:#fff2cc;border-color:#d6a63d;color:#8a5a00;box-shadow:0 0 0 6px rgba(245,158,11,.10)}100%{transform:scale(1);background:#fff}}
      @keyframes memFlashDont{0%{transform:scale(1);background:#fff}35%{transform:scale(1.08);background:#ffe1de;border-color:#d87870;color:#a52b22;box-shadow:0 0 0 6px rgba(239,68,68,.10)}100%{transform:scale(1);background:#fff}}
      .memory button.mem-flash-know{animation:memFlashKnow .34s ease}
      .memory button.mem-flash-fuzzy{animation:memFlashFuzzy .34s ease}
      .memory button.mem-flash-dont{animation:memFlashDont .34s ease}
      #vocab>#statsBar{margin:0 0 16px!important}
    `;
    document.head.appendChild(s);
  }

  function moveStatsIntoVocab(){
    const stats=document.getElementById('statsBar');
    const page=document.getElementById('vocab');
    if(!stats||!page)return;
    if(stats.parentElement!==page){
      const card=page.querySelector(':scope > .card');
      if(card)page.insertBefore(stats,card);
      else page.appendChild(stats);
    }
    if(page.classList.contains('active'))stats.style.display='grid';
  }

  function feedbackButton(v){
    const buttons=[...document.querySelectorAll('#vocabBox .memory button')];
    const label=v==='know'?'会了':v==='fuzzy'?'模糊':'不会';
    const btn=buttons.find(b=>(b.textContent||'').trim().includes(label));
    if(!btn)return;
    const cls=v==='know'?'mem-flash-know':v==='fuzzy'?'mem-flash-fuzzy':'mem-flash-dont';
    btn.classList.remove('mem-flash-know','mem-flash-fuzzy','mem-flash-dont');
    void btn.offsetWidth;
    btn.classList.add(cls);
    setTimeout(()=>btn.classList.remove(cls),380);
  }

  function renderEmpty(){
    const box=document.getElementById('vocabBox');
    if(box)box.innerHTML='<div class="empty"><b>这一词库当前没有待学习词 ✓</b><div style="margin-top:8px">点过“会了”的词仍保留在总词汇和“已掌握”中。</div></div>';
  }

  function pruneKnown(force){
    try{
      if(typeof FILTER==='undefined'||typeof DB==='undefined'||!Array.isArray(DB))return;
      const status=(document.getElementById('dbStatus')?.textContent||'').trim();
      if(!force&&(/已掌握|全部词汇/.test(status)))return;
      FILTER=(DB||[]).filter(x=>!isKnown(x));
      if(typeof idx!=='undefined')idx=Math.max(0,Math.min(idx||0,Math.max(0,FILTER.length-1)));
      if(!FILTER.length){renderEmpty();return;}
      if(typeof renderVocab==='function')renderVocab();
    }catch(e){console.warn('pruneKnown failed',e)}
  }

  function install(){
    if(installed)return;
    if(typeof window.mark!=='function'||typeof window.go!=='function'){setTimeout(install,120);return;}
    installed=true;addStyle();moveStatsIntoVocab();

    const baseMark=window.mark;
    const wrappedMark=function(v){
      if(pending)return;
      pending=true;
      feedbackButton(v);
      setTimeout(function(){
        try{baseMark(v);}finally{
          if(v==='know')setTimeout(()=>pruneKnown(true),20);
          pending=false;
        }
      },190);
    };
    window.mark=wrappedMark;
    try{mark=wrappedMark}catch(e){}

    const baseGo=window.go;
    window.go=function(id){
      const fromHome=!!document.getElementById('home')?.classList.contains('active');
      baseGo(id);
      moveStatsIntoVocab();
      if(id==='vocab'&&fromHome)setTimeout(()=>pruneKnown(true),30);
    };
    try{go=window.go}catch(e){}

    const sel=document.getElementById('librarySelect');
    if(sel)sel.addEventListener('change',()=>setTimeout(()=>pruneKnown(true),30));
    document.querySelector('#vocab .toolbar')?.addEventListener('click',function(e){
      const t=e.target;if(t&&t.tagName==='BUTTON'&&(t.textContent||'').includes('重新加载'))setTimeout(()=>pruneKnown(true),80);
    });

    setTimeout(moveStatsIntoVocab,180);
    if(document.getElementById('vocab')?.classList.contains('active'))pruneKnown(true);
  }

  if(document.readyState==='complete')setTimeout(install,120);
  else window.addEventListener('load',()=>setTimeout(install,120),{once:true});
})();
