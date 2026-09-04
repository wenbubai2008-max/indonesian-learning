(function(){
  const ORDER=['词汇学习','泛读','快速练习','弱项强化','前后缀'];
  let applying=false;

  function titleOf(card){
    const h=card&&card.querySelector('h3');
    return h?(h.textContent||'').trim():'';
  }

  function apply(){
    if(applying) return;
    const box=document.querySelector('#home .modules');
    if(!box) return;
    applying=true;
    try{
      box.classList.add('homeModulesCompact');
      const cards=[].slice.call(box.querySelectorAll(':scope > .module'));
      if(!cards.length) return;
      const map={};
      cards.forEach(function(card){
        const title=titleOf(card);
        map[title]=card;
        card.classList.remove('homeModVocab','homeModReading','homeModQuick','homeModWeak','homeModAffix','v2-wide');
        if(title==='词汇学习') card.classList.add('homeModVocab');
        else if(title==='泛读') card.classList.add('homeModReading');
        else if(title==='快速练习') card.classList.add('homeModQuick');
        else if(title==='弱项强化') card.classList.add('homeModWeak');
        else if(title==='前后缀') card.classList.add('homeModAffix');
      });

      const current=cards.map(titleOf).filter(Boolean);
      const desired=ORDER.filter(t=>map[t]);
      const same=current.length===desired.length&&current.every((t,i)=>t===desired[i]);
      if(!same){
        desired.forEach(function(t){box.appendChild(map[t]);});
      }
    } finally {
      applying=false;
    }
  }

  function style(){
    if(document.getElementById('homeModulesCompactStyle')) return;
    const s=document.createElement('style');
    s.id='homeModulesCompactStyle';
    s.textContent=`
      #home .modules.homeModulesCompact{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:10px!important;align-items:stretch}
      #home .homeModulesCompact .module{min-width:0!important;grid-column:auto!important;border-radius:16px!important;padding:14px 13px!important;min-height:158px!important;display:flex!important;flex-direction:column!important;align-items:flex-start!important;justify-content:flex-start!important;box-shadow:0 2px 8px rgba(23,32,51,.035)!important;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease!important}
      #home .homeModulesCompact .module:hover{transform:translateY(-2px);box-shadow:0 7px 20px rgba(23,32,51,.08)!important}
      #home .homeModulesCompact .module>div:first-child{font-size:20px!important;line-height:1!important;margin-bottom:3px!important}
      #home .homeModulesCompact .module h3{font-size:18px!important;margin:6px 0 5px!important;line-height:1.25!important}
      #home .homeModulesCompact .module p{font-size:13px!important;line-height:1.45!important;margin:0!important;color:#667085!important;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
      #home .homeModulesCompact .module .tag{font-size:11px!important;padding:4px 7px!important;margin-top:auto!important;position:relative;top:8px}
      #home .homeModVocab{background:#f8faff!important;border-color:#dbe5ff!important;border-top:3px solid #7897e8!important}
      #home .homeModReading{background:#f7fbf8!important;border-color:#d8eadf!important;border-top:3px solid #74b58a!important}
      #home .homeModQuick{background:#fffaf3!important;border-color:#f0e2c9!important;border-top:3px solid #d6a653!important}
      #home .homeModWeak{background:#fff8f8!important;border-color:#f0dcdc!important;border-top:3px solid #d98b8b!important}
      #home .homeModAffix{background:#faf8ff!important;border-color:#e5ddf4!important;border-top:3px solid #9b83ca!important}
      @media(max-width:1050px){#home .modules.homeModulesCompact{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
      @media(max-width:700px){#home .modules.homeModulesCompact{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}#home .homeModulesCompact .module{min-height:145px!important;padding:12px!important}#home .homeModulesCompact .module h3{font-size:17px!important}#home .homeModulesCompact .module p{font-size:12px!important}}
      @media(max-width:430px){#home .modules.homeModulesCompact{grid-template-columns:1fr!important}#home .homeModulesCompact .module{min-height:0!important}}
    `;
    document.head.appendChild(s);
  }

  style();
  apply();
  const box=document.querySelector('#home .modules');
  if(box){
    const observer=new MutationObserver(function(mutations){
      if(applying) return;
      const changed=mutations.some(m=>m.type==='childList'&&m.addedNodes.length);
      if(changed) requestAnimationFrame(apply);
    });
    observer.observe(box,{childList:true,subtree:false});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
})();