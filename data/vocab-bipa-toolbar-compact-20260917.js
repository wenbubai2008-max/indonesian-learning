(function(){
  if(window.__BIPA_TOOLBAR_COMPACT_20260917_V3__)return;
  window.__BIPA_TOOLBAR_COMPACT_20260917_V3__=true;

  function isGradeSelect(s){
    if(!s||s.tagName!=='SELECT')return false;
    const opts=[...s.options].map(o=>String(o.textContent||'').trim());
    return opts.some(t=>t==='全部分级'||t.indexOf('全部分级')>=0);
  }

  function dedupeGradeFilter(){
    const tb=document.querySelector('#vocab .toolbar');
    if(!tb)return;
    const grades=[...tb.querySelectorAll('select')].filter(isGradeSelect);
    if(grades.length<=1)return;
    const stable=document.getElementById('sabFilterStable');
    const keep=stable&&grades.includes(stable)?stable:grades[0];
    if(!keep.id)keep.id='sabFilterStable';
    grades.forEach(s=>{if(s!==keep)s.remove();});
  }

  const st=document.createElement('style');
  st.id='bipaToolbarCompact20260917';
  st.textContent=`
    @media(min-width:901px){
      #vocab.bipaFinalV7 .toolbar{
        display:grid!important;
        grid-template-columns:160px minmax(220px,1fr) 145px 120px 100px 145px!important;
        gap:8px!important;
        align-items:center!important;
        width:100%!important;
        grid-auto-flow:row!important;
      }
      #vocab.bipaFinalV7 .toolbar>*{
        min-width:0!important;
        max-width:100%!important;
        width:100%!important;
        height:48px!important;
        margin:0!important;
        padding-left:12px!important;
        padding-right:12px!important;
        white-space:nowrap!important;
      }
      #vocab.bipaFinalV7 .toolbar button{font-weight:750!important;}
    }
    @media(max-width:900px){
      #vocab.bipaFinalV7 .toolbar{display:grid!important;grid-template-columns:1fr 1fr 1fr!important;gap:8px!important;}
      #vocab.bipaFinalV7 #search{grid-column:span 2!important;}
    }
    @media(max-width:620px){
      #vocab.bipaFinalV7 .toolbar{grid-template-columns:1fr 1fr!important;}
      #vocab.bipaFinalV7 #search{grid-column:1/-1!important;}
    }
  `;
  const old=document.getElementById('bipaToolbarCompact20260917');if(old)old.remove();
  document.head.appendChild(st);

  function queueDedupe(){requestAnimationFrame(dedupeGradeFilter)}
  dedupeGradeFilter();
  [50,150,350,800,1500].forEach(ms=>setTimeout(dedupeGradeFilter,ms));
  window.addEventListener('vocab-library-ready',()=>{
    dedupeGradeFilter();
    setTimeout(dedupeGradeFilter,50);
    setTimeout(dedupeGradeFilter,250);
  });

  const tb=document.querySelector('#vocab .toolbar');
  if(tb){
    let queued=false;
    new MutationObserver(()=>{
      if(queued)return;
      queued=true;
      requestAnimationFrame(()=>{queued=false;dedupeGradeFilter();});
    }).observe(tb,{childList:true,subtree:true,characterData:true});
  }
})();