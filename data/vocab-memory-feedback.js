(function(){
  const MEM_KEY='indo_mem';
  let installed=false,pending=false;
  function mem(){try{return JSON.parse(localStorage.getItem(MEM_KEY)||'{}')}catch(e){return {}}}
  function statusOf(x){if(!x||!x.word)return '';const m=mem(),k=String(x.word||'').trim().toLowerCase();return m[x.word]||m[k]||'';}
  function isKnown(x){return statusOf(x)==='know';}
  function isWeak(x){const s=statusOf(x);return s==='fuzzy'||s==='dont';}
  function currentItem(){try{return (typeof FILTER!=='undefined'&&Array.isArray(FILTER)&&FILTER.length)?FILTER[Math.max(0,Math.min(typeof idx==='number'?idx:0,FILTER.length-1))]:null;}catch(e){return null;}}
  function currentSource(){try{return (typeof DB!=='undefined'&&Array.isArray(DB))?DB:[];}catch(e){return [];}}
  function activeLabel(){const sel=document.getElementById('librarySelect');if(!sel)return '词库';const opt=sel.options&&sel.selectedIndex>=0?sel.options[sel.selectedIndex]:null;return String(opt?.textContent||'词库').replace(/（[^）]*）/g,'').trim();}
  function addStyle(){if(document.getElementById('vocabMemoryFeedbackStyle'))return;const s=document.createElement('style');s.id='vocabMemoryFeedbackStyle';s.textContent=`@keyframes memFlashKnow{0%{background:#fff}45%{background:#dff6e7;border-color:#63b879;color:#166534}100%{background:#fff}}@keyframes memFlashFuzzy{0%{background:#fff}45%{background:#fff2cc;border-color:#d6a63d;color:#8a5a00}100%{background:#fff}}@keyframes memFlashDont{0%{background:#fff}45%{background:#ffe1de;border-color:#d87870;color:#a52b22}100%{background:#fff}}.memory button.mem-flash-know{animation:memFlashKnow .18s ease}.memory button.mem-flash-fuzzy{animation:memFlashFuzzy .18s ease}.memory button.mem-flash-dont{animation:memFlashDont .18s ease}#vocab>#statsBar{margin:0 0 16px!important}`;document.head.appendChild(s);}
  function moveStatsIntoVocab(){const stats=document.getElementById('statsBar'),page=document.getElementById('vocab');if(!stats||!page)return;if(stats.parentElement!==page){const card=page.querySelector(':scope > .card');if(card)page.insertBefore(stats,card);else page.appendChild(stats);}if(page.classList.contains('active'))stats.style.display='grid';}
  function renameWeakCard(){const rc=document.getElementById('reviewCount'),card=rc?.closest('button');if(!card)return;const label=card.querySelector('span');if(label)label.textContent='不会';card.title='查看当前词库“模糊 / 不会”的词';card.style.cursor='pointer';card.onclick=function(e){e&&e.preventDefault();showWeakCurrent();};}
  function feedbackButton(v){const buttons=[...document.querySelectorAll('#vocabBox .memory button')],label=v==='know'?'会了':v==='fuzzy'?'模糊':'不会',btn=buttons.find(b=>(b.textContent||'').trim().includes(label));if(!btn)return;const cls=v==='know'?'mem-flash-know':v==='fuzzy'?'mem-flash-fuzzy':'mem-flash-dont';btn.classList.remove('mem-flash-know','mem-flash-fuzzy','mem-flash-dont');void btn.offsetWidth;btn.classList.add(cls);}
  function syncScopedStats(){
    const arr=currentSource(),total=arr.length,known=arr.filter(isKnown).length,weak=arr.filter(isWeak).length,unchecked=Math.max(0,total-known-weak);
    const vc=document.getElementById('vocabCount'),kc=document.getElementById('knownCount'),rc=document.getElementById('reviewCount');
    if(vc)vc.textContent=total;if(kc)kc.textContent=known;if(rc)rc.textContent=weak;renameWeakCard();
    const st=document.getElementById('dbStatus'),mode=localStorage.getItem('vocab_view_mode')||'';
    if(st&&document.getElementById('vocab')?.classList.contains('active')&&!['known','weak'].includes(mode))st.textContent=activeLabel()+' · '+unchecked+' 未判断 · '+weak+' 不会 · '+known+' 已掌握 · '+total+' 总词';
    return {total,known,weak,unchecked};
  }
  function showWeakCurrent(){
    const arr=currentSource();
    try{FILTER=arr.filter(isWeak);idx=0;}catch(e){return;}
    localStorage.setItem('vocab_view_mode','weak');
    const search=document.getElementById('search');if(search)search.value='';const cat=document.getElementById('cat');if(cat)cat.value='';
    syncScopedStats();const st=document.getElementById('dbStatus');if(st)st.textContent=activeLabel()+' · 不会 '+FILTER.length+' 词（模糊 + 不会）';
    if(FILTER.length&&typeof renderVocab==='function')renderVocab();else{const box=document.getElementById('vocabBox');if(box)box.innerHTML='<div class="empty">当前词库还没有标记“模糊 / 不会”的词。</div>';}
  }
  function install(){
    if(installed)return;if(typeof window.mark!=='function'||typeof window.go!=='function'){setTimeout(install,120);return;}installed=true;addStyle();moveStatsIntoVocab();renameWeakCard();
    const baseMark=window.mark;const wrappedMark=function(v){if(pending)return;const item=currentItem();if(!item)return;pending=true;feedbackButton(v);setTimeout(function(){try{baseMark(v);setTimeout(function(){syncScopedStats();if(localStorage.getItem('vocab_view_mode')==='weak')showWeakCurrent();},60);}finally{pending=false;}},120);};window.mark=wrappedMark;try{mark=wrappedMark}catch(e){}
    const baseGo=window.go;window.go=function(id){baseGo(id);moveStatsIntoVocab();if(id==='vocab')setTimeout(function(){renameWeakCard();syncScopedStats();},100);};try{go=window.go}catch(e){}
    const sel=document.getElementById('librarySelect');if(sel)sel.addEventListener('change',function(){localStorage.removeItem('vocab_view_mode');setTimeout(function(){renameWeakCard();syncScopedStats();},100);});
    document.querySelector('#vocab .toolbar')?.addEventListener('click',function(e){const t=e.target;if(t&&t.tagName==='BUTTON'&&(t.textContent||'').includes('重新加载')){localStorage.removeItem('vocab_view_mode');setTimeout(function(){renameWeakCard();syncScopedStats();},140);}});
    window.showWeakWords=showWeakCurrent;
    setTimeout(function(){renameWeakCard();syncScopedStats();},220);
  }
  if(document.readyState==='complete')setTimeout(install,120);else window.addEventListener('load',()=>setTimeout(install,120),{once:true});
})();