(function(){
  const ORDER=['词汇学习','泛读','快速练习','弱项强化','前后缀','难点解释'];
  let applying=false;

  function titleOf(card){
    const h=card&&card.querySelector('h3');
    return h?(h.textContent||'').trim():'';
  }

  function showDifficultyList(){
    const list=document.getElementById('difficultyListView');
    const detail=document.getElementById('difficulty01');
    if(list)list.style.display='block';
    if(detail)detail.style.display='none';
    window.scrollTo(0,0);
  }
  window.showDifficultyList=showDifficultyList;

  function openDifficulty01(){
    const list=document.getElementById('difficultyListView');
    const detail=document.getElementById('difficulty01');
    if(list)list.style.display='none';
    if(detail)detail.style.display='block';
    window.scrollTo(0,0);
  }
  window.openDifficulty01=openDifficulty01;

  function pickIndoVoice(){
    if(!window.speechSynthesis)return null;
    const voices=window.speechSynthesis.getVoices()||[];
    return voices.find(function(v){return /^id(?:-|$)/i.test(v.lang||'');})||
      voices.find(function(v){return /indonesia|bahasa indonesia/i.test(v.name||'');})||
      voices.find(function(v){return /^ms(?:-|$)/i.test(v.lang||'');})||null;
  }

  window.speakIdText=function(text,btn){
    if(!text||!window.speechSynthesis)return;
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
        if(voice)u.voice=voice;
        if(btn){btn.disabled=true;btn.classList.add('isSpeaking');}
        u.onend=restore;
        u.onerror=restore;
        synth.speak(u);
        setTimeout(function(){
          if(synth.paused)try{synth.resume();}catch(e){}
        },120);
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

  function ensureDifficulty(){
    const box=document.querySelector('#home .modules');
    if(box&&!document.getElementById('difficultyModule')){
      const card=document.createElement('button');
      card.id='difficultyModule';
      card.className='module';
      card.type='button';
      card.innerHTML='<div class="difficultyIconWrap"><span>💡</span><b class="difficultyCount">1</b></div><h3>难点解释</h3><p>整理中文难直译、容易混淆的词，用场景和对比帮助理解。</p><span class="tag">1 个难点</span>';
      card.addEventListener('click',function(){showDifficultyList();window.go('difficulty');});
      box.appendChild(card);
    }

    if(!document.getElementById('difficulty')){
      const app=document.querySelector('.app');
      if(!app)return;
      const page=document.createElement('section');
      page.id='difficulty';
      page.className='page';
      page.innerHTML=`
        <button class="back" onclick="go('home')">← 返回首页</button>
        <div class="card difficultyPageCard">
          <div id="difficultyListView">
            <div class="sectionHead difficultyHead">
              <div><h2>难点解释</h2><div class="muted">专门整理难直译、容易混淆的印尼语词。</div></div>
              <span class="pill">已整理 1 个</span>
            </div>

            <div class="difficultyIndex">
              <button class="difficultyIndexItem" type="button" onclick="openDifficulty01()">
                <span class="difficultyNo">01</span>
                <span class="difficultyIndexText"><b>sempat</b><small>时间 / 机会 / 阶段窗口</small></span>
                <span class="difficultyArrow">→</span>
              </button>
            </div>
          </div>

          <article id="difficulty01" class="difficultyLesson" style="display:none">
            <button class="difficultyInnerBack" type="button" onclick="showDifficultyList()">← 返回难点列表</button>

            <div class="difficultyWordHero">
              <div class="difficultyWordTop"><span class="difficultyNo big">01</span><span class="difficultyType">时间窗口词</span></div>
              <div class="difficultyWordLine"><strong>sempat</strong><button class="sound" type="button" title="播放 sempat" onclick="speakIdText('sempat',this)">🔊</button></div>
              <div class="difficultyMemory">先不要直接翻译成“曾经”。先想：<b>有过这么一个时间 / 机会 / 阶段。</b></div>
            </div>

            <div class="difficultyCore">
              <div class="difficultyCoreLabel">最核心的印尼语解释</div>
              <div class="difficultyCoreId">Ada waktu / kesempatan / momen → sesuatu benar-benar terjadi.</div>
              <div class="difficultyCoreCn">有一个时间、机会或阶段 → 这件事确实发生了。</div>
            </div>

            <div class="timeWindowDiagram" aria-label="sempat 时间窗口示意">
              <div class="timeNode mutedNode"><span>平时</span><small>belum terjadi</small></div>
              <div class="timeLine"></div>
              <div class="timeNode windowNode"><span>出现一个窗口</span><small>waktu / kesempatan / momen</small></div>
              <div class="timeLine activeLine"></div>
              <div class="timeNode happenNode"><span>事情发生了</span><small>jadi dilakukan / terjadi</small></div>
            </div>

            <div class="senseBridge" aria-label="下面三个卡片都是 sempat 的常见用法">
              <div class="senseBridgeStem"></div>
              <div class="senseBridgeLabel"><b>sempat</b> 在不同场景里的常见表现</div>
              <div class="senseBridgeFork"><span></span><span></span><span></span></div>
            </div>

            <div class="difficultyThree">
              <div class="senseCard senseBlue">
                <div class="senseIcon">⏱️</div><h3>① 有时间 / 有机会</h3>
                <div class="senseEn">got the chance to / had time to</div>
                <div class="exampleId">Aku sempat makan sebelum pergi. <button class="miniSound" type="button" title="播放例句" onclick="speakIdText('Aku sempat makan sebelum pergi.',this)">🔊</button></div>
                <div class="exampleCn">我出发前还来得及吃了饭。</div>
                <div class="senseTip">重点不是“吃过”，而是当时<b>有那个时间窗口</b>。</div>
              </div>

              <div class="senseCard sensePurple">
                <div class="senseIcon">🕰️</div><h3>② 有那么一个阶段</h3>
                <div class="senseEn">at one point / for a while</div>
                <div class="exampleId">Aku sempat tinggal di Semarang. <button class="miniSound" type="button" title="播放例句" onclick="speakIdText('Aku sempat tinggal di Semarang.',this)">🔊</button></div>
                <div class="exampleCn">我有一阵子住在三宝垄。</div>
                <div class="senseTip">强调过去<b>出现过一段时期</b>，通常暗示后来变了。</div>
              </div>

              <div class="senseCard senseRed">
                <div class="senseIcon">🚫</div><h3>③ nggak sempat</h3>
                <div class="senseEn">didn't have time / didn't get the chance</div>
                <div class="exampleId">Aku nggak sempat balas chat. <button class="miniSound" type="button" title="播放例句" onclick="speakIdText('Aku nggak sempat balas chat.',this)">🔊</button></div>
                <div class="exampleCn">我没来得及回消息。</div>
                <div class="senseTip">这个最直观：<b>那个时间 / 机会窗口没有出现。</b></div>
              </div>
            </div>

            <div class="compareBlock">
              <div class="compareTitle">sempat 和 pernah 到底差在哪？</div>
              <div class="compareGrid">
                <div class="compareCard pernahCard">
                  <div class="compareWord">pernah</div>
                  <div class="compareQuestion">关注：<b>“这件事发生过吗？”</b></div>
                  <div class="compareEn">have ever / have done before</div>
                  <div class="compareExample">Aku pernah tinggal di Semarang.</div>
                  <div class="compareCn">我住过三宝垄。→ 强调“人生经历里有这件事”。</div>
                </div>
                <div class="compareVs">VS</div>
                <div class="compareCard sempatCard">
                  <div class="compareWord">sempat</div>
                  <div class="compareQuestion">关注：<b>“当时有没有一个窗口 / 阶段？”</b></div>
                  <div class="compareEn">got the chance / at one point</div>
                  <div class="compareExample">Aku sempat tinggal di Semarang.</div>
                  <div class="compareCn">我有一阵子住在三宝垄。→ 强调“那段时期曾经存在”。</div>
                </div>
              </div>
            </div>

            <div class="difficultyFormula">
              <span>一句话记忆</span>
              <b>sempat = “当时有一个窗口，所以这件事发生了。”</b>
              <small>根据语境，这个“窗口”可以是时间、机会，也可以是一段时期。</small>
            </div>
          </article>
        </div>`;
      app.appendChild(page);
    }
  }

  function apply(){
    if(applying)return;
    const box=document.querySelector('#home .modules');
    if(!box)return;
    applying=true;
    try{
      box.classList.add('homeModulesCompact');
      const cards=[].slice.call(box.querySelectorAll(':scope > .module'));
      if(!cards.length)return;
      const map={};
      cards.forEach(function(card){
        const title=titleOf(card);
        map[title]=card;
        card.classList.remove('homeModVocab','homeModReading','homeModQuick','homeModWeak','homeModAffix','homeModDifficulty','v2-wide');
        if(title==='词汇学习')card.classList.add('homeModVocab');
        else if(title==='泛读')card.classList.add('homeModReading');
        else if(title==='快速练习')card.classList.add('homeModQuick');
        else if(title==='弱项强化')card.classList.add('homeModWeak');
        else if(title==='前后缀')card.classList.add('homeModAffix');
        else if(title==='难点解释')card.classList.add('homeModDifficulty');
      });
      const desired=ORDER.filter(function(t){return map[t];});
      desired.forEach(function(t){box.appendChild(map[t]);});
    }finally{applying=false;}
  }

  function style(){
    if(document.getElementById('homeModulesCompactStyle'))return;
    const s=document.createElement('style');
    s.id='homeModulesCompactStyle';
    s.textContent=`
      #home .modules.homeModulesCompact{display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:10px!important;align-items:stretch}
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
      #home .homeModDifficulty{background:#f7fbff!important;border-color:#d8e8f5!important;border-top:3px solid #63a6cf!important;position:relative}
      #home .difficultyIconWrap{display:flex!important;align-items:center!important;gap:7px!important;width:100%!important}
      #home .difficultyCount{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#e4f3ff;color:#24749f;font-size:11px;line-height:1}

      .siteNav{display:flex;align-items:center;gap:8px;margin:0 0 12px;min-height:38px}
      .siteNav button{appearance:none;border:1px solid #dfe4ee;background:#fff;color:#3157d5;border-radius:10px;padding:8px 12px;font-weight:750;cursor:pointer;box-shadow:0 1px 2px rgba(23,32,51,.03)}
      .siteNav button:hover{background:#f5f7ff;border-color:#b9c7f1}
      .siteNav button:active{transform:translateY(1px)}
      .siteNav .navHome{color:#4b5563}
      .page>.back{display:none!important}

      .difficultyPageCard{overflow:hidden}
      .difficultyHead{align-items:flex-start!important;gap:14px}
      .difficultyHead h2{margin:0 0 5px}
      .difficultyIndex{margin:20px 0 2px}
      .difficultyIndexItem{width:100%;border:1px solid #dfe7f0;background:#fbfdff;border-radius:15px;padding:15px 16px;display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;text-align:left;cursor:pointer;color:#172033;transition:.16s ease}
      .difficultyIndexItem:hover{border-color:#9ac5df;background:#f6fbff;transform:translateY(-1px)}
      .difficultyIndexText b{font-size:19px}.difficultyIndexItem small{display:block;color:#6b7280;margin-top:4px;font-size:12px}
      .difficultyNo{display:inline-flex;align-items:center;justify-content:center;min-width:34px;height:34px;border-radius:10px;background:#e9f5fc;color:#277ba6;font-weight:900;font-size:13px;letter-spacing:.04em}
      .difficultyNo.big{min-width:42px;height:42px;border-radius:12px;font-size:15px}
      .difficultyArrow{font-size:20px;color:#7a8ba3}
      .difficultyInnerBack{border:0;background:transparent;color:#3157d5;font-weight:800;cursor:pointer;padding:4px 0 13px}
      .difficultyWordHero{border-radius:20px;padding:22px;background:linear-gradient(135deg,#f1f8ff,#f8fbff);border:1px solid #dcecf7}
      .difficultyWordTop{display:flex;align-items:center;gap:9px}
      .difficultyType{font-size:12px;font-weight:800;color:#276f97;background:#e8f4fb;border-radius:999px;padding:5px 9px}
      .difficultyWordLine{display:flex;align-items:center;gap:10px;margin:12px 0 7px}
      .difficultyWordLine strong{font-size:42px;line-height:1;color:#173f5c;letter-spacing:-.02em}
      .difficultyMemory{font-size:17px;line-height:1.7;color:#3f5265}.difficultyMemory b{color:#173f5c}
      .difficultyCore{margin:15px 0;border-left:4px solid #4c9bc7;background:#f6fbff;border-radius:12px;padding:15px 17px}
      .difficultyCoreLabel{font-size:12px;font-weight:850;color:#287ca8;margin-bottom:6px}
      .difficultyCoreId{font-size:18px;font-weight:850;line-height:1.55;color:#173f5c}.difficultyCoreCn{font-size:14px;color:#667085;margin-top:5px}
      .timeWindowDiagram{display:grid;grid-template-columns:1fr 36px 1.35fr 36px 1fr;align-items:center;margin:20px 0 0;padding:15px;border:1px dashed #ced9e5;border-radius:16px;background:#fcfdff}
      .timeNode{text-align:center;border-radius:13px;padding:12px 8px;border:1px solid #e4e9f0;background:#fff}.timeNode span{display:block;font-weight:850;font-size:14px}.timeNode small{display:block;color:#7b8796;font-size:11px;margin-top:4px;line-height:1.35}
      .mutedNode{opacity:.72}.windowNode{border-color:#9ed0eb;background:#eef9ff;color:#226f99}.happenNode{border-color:#a8d9b6;background:#f1fbf4;color:#24743d}
      .timeLine{height:2px;background:#d8e0e8;position:relative}.timeLine:after{content:'›';position:absolute;right:-3px;top:50%;transform:translateY(-56%);font-size:22px;color:#a4b0bf}.activeLine{background:#8fc7a0}.activeLine:after{color:#5aaf73}

      .senseBridge{display:flex;flex-direction:column;align-items:center;margin:0 4% 3px;position:relative;color:#64748b}
      .senseBridgeStem{width:2px;height:20px;background:#b8c8d8}
      .senseBridgeLabel{font-size:12px;line-height:1.3;background:#fff;padding:3px 10px;border:1px solid #dbe5ee;border-radius:999px;position:relative;z-index:2}
      .senseBridgeLabel b{color:#277ba6}
      .senseBridgeFork{width:100%;height:22px;display:grid;grid-template-columns:repeat(3,1fr);position:relative;margin-top:1px}
      .senseBridgeFork:before{content:'';position:absolute;left:16.666%;right:16.666%;top:6px;height:2px;background:#b8c8d8}
      .senseBridgeFork span{justify-self:center;width:2px;height:16px;background:#b8c8d8;margin-top:6px}

      .difficultyThree{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:0 0 16px}.senseCard{border:1px solid #e2e7ef;border-radius:17px;padding:16px;background:#fff;min-width:0}.senseCard h3{font-size:16px;margin:7px 0}.senseIcon{font-size:22px}.senseEn{font-size:12px;font-weight:800;color:#667085;margin-bottom:12px}.exampleId{font-size:15px;font-weight:800;line-height:1.55;color:#243246}.exampleCn{font-size:13px;color:#596579;margin-top:4px}.senseTip{font-size:12px;line-height:1.55;color:#6b7280;margin-top:11px;padding-top:10px;border-top:1px solid rgba(0,0,0,.06)}
      .senseBlue{background:#f8fbff;border-color:#d9e9f7}.sensePurple{background:#fbf9ff;border-color:#e5ddf3}.senseRed{background:#fff9f8;border-color:#f0dfdc}
      .miniSound,.difficultyWordLine .sound{appearance:none;border:1px solid #dbe4ed;background:#fff;border-radius:8px;min-width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;padding:0 7px;cursor:pointer;vertical-align:middle;line-height:1;transition:.15s ease}
      .miniSound{margin-left:5px;font-size:14px}.miniSound:hover,.difficultyWordLine .sound:hover{background:#f1f8ff;border-color:#a8cde3}.miniSound.isSpeaking,.difficultyWordLine .sound.isSpeaking{background:#e9f6ff;border-color:#78b7dc;box-shadow:0 0 0 2px rgba(120,183,220,.15)}
      .miniSound:disabled,.difficultyWordLine .sound:disabled{cursor:default;opacity:.75}
      .compareBlock{margin-top:22px}.compareTitle{font-size:18px;font-weight:900;margin-bottom:11px}.compareGrid{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:stretch}.compareVs{align-self:center;font-size:12px;font-weight:900;color:#8a94a3;background:#eef1f5;border-radius:999px;padding:7px}.compareCard{border:1px solid #e0e6ee;border-radius:17px;padding:17px}.pernahCard{background:#fafafa}.sempatCard{background:#f4faff;border-color:#cfe6f5}.compareWord{font-size:24px;font-weight:900}.compareQuestion{font-size:13px;line-height:1.55;margin:7px 0}.compareEn{font-size:12px;color:#728096}.compareExample{font-size:14px;font-weight:800;margin-top:13px}.compareCn{font-size:12px;color:#667085;line-height:1.55;margin-top:5px}
      .difficultyFormula{margin-top:18px;border-radius:16px;padding:16px 18px;background:#173f5c;color:#fff;display:flex;flex-direction:column;gap:5px}.difficultyFormula span{font-size:12px;opacity:.78}.difficultyFormula b{font-size:18px;line-height:1.55}.difficultyFormula small{opacity:.78;line-height:1.5}

      @media(max-width:1050px){#home .modules.homeModulesCompact{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
      @media(max-width:760px){
        .difficultyThree{grid-template-columns:1fr}
        .compareGrid{grid-template-columns:1fr}.compareVs{justify-self:center}
        .timeWindowDiagram{grid-template-columns:1fr;gap:7px}.timeLine{width:2px;height:20px;justify-self:center}.timeLine:after{content:'⌄';right:auto;left:50%;top:auto;bottom:-8px;transform:translateX(-50%)}
        .difficultyWordLine strong{font-size:36px}
        .senseBridge{margin:0 12% 5px}.senseBridgeFork{height:16px}.senseBridgeFork:before{left:50%;right:auto;width:2px;height:10px;top:2px}.senseBridgeFork span{display:none}.senseBridgeFork span:first-child{display:block;width:2px;height:12px;margin-top:2px;grid-column:2}
      }
      @media(max-width:700px){#home .modules.homeModulesCompact{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}#home .homeModulesCompact .module{min-height:145px!important;padding:12px!important}#home .homeModulesCompact .module h3{font-size:17px!important}#home .homeModulesCompact .module p{font-size:12px!important}.siteNav{position:sticky;top:0;z-index:50;background:rgba(245,247,251,.94);backdrop-filter:blur(10px);padding:8px 0;margin-top:-8px}.siteNav button{padding:8px 10px}.difficultyPageCard{padding:16px!important}}
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

  function installHistoryNavigation(){
    if(window.__indoHistoryNavInstalled||typeof window.go!=='function')return;
    window.__indoHistoryNavInstalled=true;
    const initial=currentPage();
    const hashPage=(location.hash||'').replace(/^#/,'');
    const wanted=document.getElementById(hashPage)&&document.getElementById(hashPage).classList.contains('page')?hashPage:initial;
    history.replaceState({__indoSite:true,page:wanted,depth:0},'',wanted==='home'?location.pathname+location.search:'#'+wanted);
    if(wanted!==initial)renderPage(wanted);

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
      if(st&&st.__indoSite&&st.page)renderPage(st.page);
      else{
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
    ensureDifficulty();
    apply();
    installHistoryNavigation();
    installNavBars();
    setTimeout(function(){ensureDifficulty();apply();installNavBars();},180);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else setTimeout(boot,0);
})();