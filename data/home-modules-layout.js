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
      if(!same)desired.forEach(function(t){box.appendChild(map[t]);});
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
      .siteNav{display:flex;align-items:center;gap:8px;margin:0 0 12px;min-height:38px}
      .siteNav button{appearance:none;border:1px solid #dfe4ee;background:#fff;color:#3157d5;border-radius:10px;padding:8px 12px;font-weight:750;cursor:pointer;box-shadow:0 1px 2px rgba(23,32,51,.03)}
      .siteNav button:hover{background:#f5f7ff;border-color:#b9c7f1}
      .siteNav button:active{transform:translateY(1px)}
      .siteNav .navHome{color:#4b5563}
      .page>.back{display:none!important}
      @media(max-width:1050px){#home .modules.homeModulesCompact{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
      @media(max-width:700px){#home .modules.homeModulesCompact{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}#home .homeModulesCompact .module{min-height:145px!important;padding:12px!important}#home .homeModulesCompact .module h3{font-size:17px!important}#home .homeModulesCompact .module p{font-size:12px!important}.siteNav{position:sticky;top:0;z-index:50;background:rgba(245,247,251,.94);backdrop-filter:blur(10px);padding:8px 0;margin-top:-8px}.siteNav button{padding:8px 10px}}
      @media(max-width:430px){#home .modules.homeModulesCompact{grid-template-columns:1fr!important}#home .homeModulesCompact .module{min-height:0!important}}
    `;
    document.head.appendChild(s);
  }

  function currentPage(){
    const el=document.querySelector('.page.active');
    return el?el.id:'home';
  }

  function renderPage(id){
    const el=document.getElementById(id)||document.getElementById('home');
    if(!el) return;
    document.querySelectorAll('.page').forEach(function(x){x.classList.remove('active');});
    el.classList.add('active');
    const actual=el.id;
    const sb=document.getElementById('statsBar');
    if(sb) sb.style.display=actual==='home'?'none':'grid';
    window.scrollTo(0,0);
    if(actual==='calendar'&&typeof window.renderCalendar==='function')window.renderCalendar();
    if(actual==='review'&&typeof window.renderReview==='function')window.renderReview();
  }

  function installHistoryNavigation(){
    if(window.__indoHistoryNavInstalled||typeof window.go!=='function')return;
    window.__indoHistoryNavInstalled=true;

    const initial=currentPage();
    const hashPage=(location.hash||'').replace(/^#/,'');
    const wanted=document.getElementById(hashPage)&&document.getElementById(hashPage).classList.contains('page')?hashPage:initial;
    const initialState={__indoSite:true,page:wanted,depth:0};
    history.replaceState(initialState,'',wanted==='home'?location.pathname+location.search:'#'+wanted);
    if(wanted!==initial)renderPage(wanted);

    window.go=function(id,options){
      options=options||{};
      if(!document.getElementById(id))id='home';
      const from=currentPage();
      if(from===id){
        renderPage(id);
        return;
      }
      renderPage(id);
      if(options.history===false)return;
      const prevDepth=(history.state&&history.state.__indoSite)?Number(history.state.depth||0):0;
      history.pushState({__indoSite:true,page:id,depth:prevDepth+1},'',id==='home'?location.pathname+location.search:'#'+id);
    };

    window.siteBack=function(){
      const st=history.state;
      if(st&&st.__indoSite&&Number(st.depth||0)>0){
        history.back();
      }else if(currentPage()!=='home'){
        window.go('home');
      }
    };

    window.addEventListener('popstate',function(e){
      const st=e.state;
      if(st&&st.__indoSite&&st.page){
        renderPage(st.page);
      }else{
        const hp=(location.hash||'').replace(/^#/,'');
        renderPage(document.getElementById(hp)?hp:'home');
      }
    });
  }

  function installNavBars(){
    document.querySelectorAll('.page').forEach(function(page){
      if(page.id==='home'||page.querySelector(':scope > .siteNav'))return;
      const nav=document.createElement('div');
      nav.className='siteNav';
      nav.setAttribute('aria-label','页面导航');
      nav.innerHTML='<button type="button" class="navBack" title="返回上一页">← 上一页</button><button type="button" class="navHome" title="返回首页">⌂ 首页</button>';
      nav.querySelector('.navBack').addEventListener('click',function(){window.siteBack?window.siteBack():window.go('home');});
      nav.querySelector('.navHome').addEventListener('click',function(){window.go('home');});
      page.insertBefore(nav,page.firstChild);
    });
  }

  function boot(){
    style();
    apply();
    installHistoryNavigation();
    installNavBars();
    setTimeout(function(){apply();installNavBars();},180);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else setTimeout(boot,0);
})();