(function(){
  if(document.getElementById('dailyDensityFixStyle')) return;
  const st=document.createElement('style');
  st.id='dailyDensityFixStyle';
  st.textContent=`
    /* Prevent two cards in the same grid row from being forced to equal height */
    #daily .dailyFixGrid{align-items:start!important}
    #daily .dailyFixVocab{align-self:start!important;padding:16px 18px!important}

    /* Word + Chinese meaning on the same headline row */
    #daily .dailyFixWord{row-gap:5px!important}
    #daily .dailyFixCnInline{font-size:17px;font-weight:800;color:#334155;margin-left:4px;line-height:1.35}
    #daily .dailyFixCnInline::before{content:'·';margin-right:7px;color:#9aa4b5}
    #daily .dailyFixEn{margin-top:5px!important}

    /* Compress secondary information without shrinking the important text */
    #daily .dailyFixMeta{margin-top:8px!important;padding:7px 10px!important;line-height:1.55!important}
    #daily .dailyFixMeta + .dailyFixMeta{margin-top:5px!important}
    #daily .dailyFixEx{margin-top:10px!important;padding-top:10px!important;line-height:1.55!important}
    #daily .dailyFixExCn{margin-top:3px!important;line-height:1.5!important}

    /* Use the empty right half of desktop sentence sections */
    #daily .dailySentenceGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;align-items:start}
    #daily .dailySentenceGrid>.dailyFixItem{margin:0!important;padding:12px 15px!important;min-width:0}
    #daily .dailySentenceGrid>.dailyFixItem:last-child:nth-child(odd){grid-column:1/-1}

    @media(max-width:760px){
      #daily .dailySentenceGrid{grid-template-columns:1fr}
      #daily .dailySentenceGrid>.dailyFixItem:last-child:nth-child(odd){grid-column:auto}
      #daily .dailyFixVocab{padding:14px 12px!important}
      #daily .dailyFixCnInline{font-size:18px;margin-left:0}
      #daily .dailyFixWord{column-gap:7px!important}
    }
  `;
  document.head.appendChild(st);

  function enhance(){
    const body=document.getElementById('dailyBody');
    if(!body) return;

    body.querySelectorAll('.dailyFixVocab:not([data-density-fixed])').forEach(card=>{
      card.dataset.densityFixed='1';
      const row=card.querySelector('.dailyFixWord');
      const cn=card.querySelector(':scope > .dailyFixCn');
      if(row && cn && cn.textContent.trim()){
        const inline=document.createElement('span');
        inline.className='dailyFixCnInline';
        inline.textContent=cn.textContent.trim();
        const sound=row.querySelector('.sound');
        if(sound) row.insertBefore(inline,sound); else row.appendChild(inline);
        cn.remove();
      }
    });

    body.querySelectorAll('.dailyFixSec:not([data-sentence-fixed])').forEach(sec=>{
      const h=sec.querySelector(':scope > h3');
      if(!h || !h.textContent.includes('高频句子')) return;
      sec.dataset.sentenceFixed='1';
      const items=[...sec.children].filter(el=>el.classList && el.classList.contains('dailyFixItem'));
      if(!items.length) return;
      const grid=document.createElement('div');
      grid.className='dailySentenceGrid';
      items[0].before(grid);
      items.forEach(item=>grid.appendChild(item));
    });
  }

  const body=document.getElementById('dailyBody');
  if(body){
    new MutationObserver(enhance).observe(body,{childList:true,subtree:true});
    enhance();
  }
})();
