(function(){
  const HOME_MODULES=[
    {key:'reading',title:'泛读',icon:'📚',desc:'今日短文 · 自然复现 · 划词查义。',tag:'划词查义 · 可加陌生词',open:function(){if(typeof window.openExtensiveV2==='function')window.openExtensiveV2();}},
    {key:'vocab',title:'词汇学习',icon:'🧠',desc:'按词库学习，结合闪卡、例句和发音。',tag:'词库',tagId:'vocabTag',open:function(){if(typeof window.go==='function')window.go('vocab');}},
    {key:'roots',title:'词根家族',icon:'🌱',desc:'从一个词根，理解同根表达与口语变体。',tag:'词根资料库',tagId:'rootFamilyTag',open:function(){window.location.href='root-families/index.html';}},
    {key:'weak',title:'弱项强化',icon:'🎯',desc:'只看快练错题与阅读陌生词；掌握另需验证。',tag:'专项错词',open:function(){if(typeof window.openWeaknessV2==='function')window.openWeaknessV2();}},
    {key:'difficulty',title:'难点解释',icon:'💡',desc:'辨析易混词，理解构词和真实用法。',tag:'7 个难点',id:'difficultyModule',open:function(){showDifficultyList();if(typeof window.go==='function')window.go('difficulty');}},
    {key:'quick',title:'快速练习',icon:'⚡',desc:'短时练习到期词和容易答错的词。',tag:'间隔复现',open:function(){if(typeof window.openQuickPracticeV2==='function')window.openQuickPracticeV2();}},
    {key:'automation',title:'自动训练',icon:'⚙️',desc:'主动提取 · 语境补词 · 延迟验证。',tag:'计算中',tagId:'automationTag',open:function(){if(typeof window.openAutomationTraining==='function')window.openAutomationTraining();}},

  ];

  function renderHomeModules(){
    const box=document.querySelector('#home .modules');if(!box)return;
    box.replaceChildren();
    HOME_MODULES.forEach(function(def){
      const card=document.createElement('button');
      card.type='button';card.className='module';
      if(def.id)card.id=def.id;
      card.setAttribute('data-home-module',def.key);
      card.innerHTML='<div>'+def.icon+'</div><h3>'+def.title+'</h3><p>'+def.desc+'</p><span class="tag"'+(def.tagId?' id="'+def.tagId+'"':'')+'>'+def.tag+'</span>';
      card.addEventListener('click',def.open);box.appendChild(card);
    });
    const vt=document.getElementById('vocabTag'),count=(window.DAILY_VOCAB_DB||[]).length||(window.EMBEDDED_DB||[]).length||0;
    // The library-aware VocabController owns this label once loaded; re-rendering the card must not replace it.
    if(vt&&window.VocabController&&typeof window.VocabController.updateStats==='function')window.VocabController.updateStats();
    else if(vt&&count)vt.textContent=count+' 个词';
    if(window.AutomationTraining&&typeof window.AutomationTraining.refreshTag==='function')setTimeout(window.AutomationTraining.refreshTag,0);
  }
  window.renderHomeModules=renderHomeModules;

  // 难点解释的 7 篇课文及其样式在 difficulty-lessons.js 里，点进"难点解释"时才加载。
  let difficultyQueue=null;
  function loadDifficulty(done){
    if(window.__difficultyLessons){if(done)done();return;}
    if(done)(difficultyQueue=difficultyQueue||[]).push(done);
    if(document.getElementById('difficultyLessonsScript'))return;
    const sc=document.createElement('script');
    sc.id='difficultyLessonsScript';
    sc.src='data/difficulty-lessons.js?v=20261014-lazy1';
    sc.onload=function(){
      const q=difficultyQueue||[];difficultyQueue=null;
      q.forEach(function(fn){fn();});
    };
    sc.onerror=function(){
      sc.remove();difficultyQueue=null;
      const box=document.querySelector('#difficulty .card');
      if(box)box.innerHTML='<div class="muted">难点解释加载失败，请检查网络后刷新重试。</div>';
    };
    document.head.appendChild(sc);
  }

  function showDifficultyList(){
    loadDifficulty(function(){window.__difficultyLessons.showList();});
  }
  window.showDifficultyList=showDifficultyList;

  function pickIndoVoice(){
    if(!window.speechSynthesis)return null;
    const voices=window.speechSynthesis.getVoices()||[];
    // Bahasa Melayu (ms) is not Bahasa Indonesia (id).
    return voices.find(function(v){return /^id(?:[-_]|$)/i.test(v.lang||'');})||null;
  }

  window.speakIdText=function(text,btn){
    if(!text)return;
    // Use the site's guarded Indonesian-only online fallback if local TTS is absent.
    if(!window.speechSynthesis){
      if(typeof window.speak==='function')window.speak(text);
      return;
    }
    const synth=window.speechSynthesis;
    let finished=false;
    function restore(){
      if(finished)return;
      finished=true;
      if(btn){btn.disabled=false;btn.classList.remove('isSpeaking');}
    }
    function run(){
      try{
        synth.cancel();
        const u=new SpeechSynthesisUtterance(text);
        u.lang='id-ID';
        u.rate=.88;
        u.pitch=1;
        const voice=pickIndoVoice();
        if(!voice){
          restore();
          if(typeof window.speak==='function')window.speak(text);
          return;
        }
        u.voice=voice;
        if(btn){btn.disabled=true;btn.classList.add('isSpeaking');}
        u.onend=restore;
        u.onerror=restore;
        synth.speak(u);
        setTimeout(function(){if(synth.paused)try{synth.resume();}catch(e){}},120);
        setTimeout(restore,15000);
      }catch(e){restore();}
    }
    const voices=synth.getVoices()||[];
    if(voices.length){run();return;}
    let started=false;
    const startOnce=function(){if(started)return;started=true;run();};
    if('onvoiceschanged' in synth)synth.onvoiceschanged=startOnce;
    setTimeout(startOnce,350);
  };

  function style(){
    if(document.getElementById('siteNavStyle'))return;
    const s=document.createElement('style');
    s.id='siteNavStyle';
    s.textContent=`
      .siteNav{display:flex;align-items:center;gap:8px;margin:0 0 12px;min-height:38px}
      .siteNav button{appearance:none;border:1px solid #dfe4ee;background:#fff;color:#3157d5;border-radius:10px;padding:8px 12px;font-weight:750;cursor:pointer;box-shadow:0 1px 2px rgba(23,32,51,.03)}
      .siteNav button:hover{background:#f5f7ff;border-color:#b9c7f1}
      .siteNav button:active{transform:translateY(1px)}
      .siteNav .navHome{color:#4b5563}
      .page>.back{display:none!important}
      @media(max-width:700px){.siteNav{position:sticky;top:0;z-index:50;background:rgba(245,247,251,.94);backdrop-filter:blur(10px);padding:8px 0;margin-top:-8px}.siteNav button{padding:8px 10px}}
    `;
    document.head.appendChild(s);
  }

  function currentPage(){
    const el=document.querySelector('.page.active');
    return el?el.id:'home';
  }

  function renderPage(id){
    const el=document.getElementById(id)||document.getElementById('home');
    if(!el)return;
    document.querySelectorAll('.page').forEach(function(x){x.classList.remove('active');});
    el.classList.add('active');
    const actual=el.id;
    const sb=document.getElementById('statsBar');
    if(sb)sb.style.display=actual==='home'?'none':'grid';
    if(actual==='difficulty')showDifficultyList();
    window.scrollTo(0,0);
    if(actual==='calendar'&&typeof window.renderCalendar==='function')window.renderCalendar();
    if(actual==='review'&&typeof window.renderReview==='function')window.renderReview();
  }

  function refreshHistoryPage(id){
    if(id==='weakness'&&typeof window.openWeaknessV2==='function'){
      setTimeout(function(){
        if(currentPage()==='weakness')window.openWeaknessV2();
      },0);
    }
  }

  function installHistoryNavigation(){
    if(window.__indoHistoryNavInstalled||typeof window.go!=='function')return;
    window.__indoHistoryNavInstalled=true;
    const initial=currentPage();
    const hashPage=(location.hash||'').replace(/^#/,'');
    const wanted=document.getElementById(hashPage)&&document.getElementById(hashPage).classList.contains('page')?hashPage:initial;
    history.replaceState({__indoSite:true,page:wanted,depth:0},'',wanted==='home'?location.pathname+location.search:'#'+wanted);
    if(wanted!==initial)renderPage(wanted);
    if(wanted!==initial)refreshHistoryPage(wanted);

    window.go=function(id,options){
      options=options||{};
      if(!document.getElementById(id))id='home';
      const from=currentPage();
      if(from===id){renderPage(id);return;}
      renderPage(id);
      if(options.history===false)return;
      const prevDepth=(history.state&&history.state.__indoSite)?Number(history.state.depth||0):0;
      history.pushState({__indoSite:true,page:id,depth:prevDepth+1},'',id==='home'?location.pathname+location.search:'#'+id);
    };

    window.siteBack=function(){
      const st=history.state;
      if(st&&st.__indoSite&&Number(st.depth||0)>0)history.back();
      else if(currentPage()!=='home')window.go('home');
    };

    window.addEventListener('popstate',function(e){
      const st=e.state;
      let target='home';
      if(st&&st.__indoSite&&st.page)target=st.page;
      else{
        const hp=(location.hash||'').replace(/^#/,'');
        target=document.getElementById(hp)?hp:'home';
      }
      renderPage(target);
      refreshHistoryPage(target);
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

  window.installSiteNavBars=installNavBars;

  function boot(){
    renderHomeModules();
    style();
    installHistoryNavigation();
    installNavBars();
    setTimeout(function(){renderHomeModules();installNavBars();},180);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else setTimeout(boot,0);
})();