(function(){
  const ORDER=['词汇学习','泛读','快速练习','弱项强化','自动训练','难点解释'];
  let applying=false;

  const HOME_MODULES=[
    {key:'vocab',title:'词汇学习',icon:'🧠',desc:'词库、闪卡、发音、例句和学习进度。',tag:'词库',tagId:'vocabTag',open:function(){if(typeof window.go==='function')window.go('vocab');}},
    {key:'reading',title:'泛读',icon:'📚',desc:'独立于每日课程：聊天、办公室、生活和真实交流场景。',tag:'划词查义 · 可加陌生词',open:function(){if(typeof window.openExtensiveV2==='function')window.openExtensiveV2();}},
    {key:'quick',title:'快速练习',icon:'⚡',desc:'5–10分钟，用最近学过的词做情境选词和补空。',tag:'间隔复现',open:function(){if(typeof window.openQuickPracticeV2==='function')window.openQuickPracticeV2();}},
    {key:'weak',title:'弱项强化',icon:'🎯',desc:'集中练快速练习错题和阅读中加入的陌生词。',tag:'针对弱项',open:function(){if(typeof window.openWeaknessV2==='function')window.openWeaknessV2();}},
    {key:'automation',title:'自动训练',icon:'⚙️',desc:'把眼熟但调不出来的词，逐步练到主动使用。',tag:'计算中',tagId:'automationTag',open:function(){if(typeof window.openAutomationTraining==='function')window.openAutomationTraining();}},
    {key:'difficulty',title:'难点解释',icon:'💡',desc:'整理中文难直译、容易混淆的词，用场景和对比帮助理解。',tag:'6 个难点',id:'difficultyModule',open:function(){showDifficultyList();if(typeof window.go==='function')window.go('difficulty');}},
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
    if(vt&&count)vt.textContent=count+' 个词';
    if(window.AutomationTraining&&typeof window.AutomationTraining.refreshTag==='function')setTimeout(window.AutomationTraining.refreshTag,0);
  }
  window.renderHomeModules=renderHomeModules;

  function titleOf(card){
    const h=card&&card.querySelector('h3');
    return h?(h.textContent||'').trim():'';
  }

  function hideDifficultyLessons(){
    document.querySelectorAll('#difficulty .difficultyLesson').forEach(function(x){x.style.display='none';});
  }

  function showDifficultyList(){
    const list=document.getElementById('difficultyListView');
    if(list)list.style.display='block';
    hideDifficultyLessons();
    window.scrollTo(0,0);
  }
  window.showDifficultyList=showDifficultyList;

  function openDifficulty(id){
    const list=document.getElementById('difficultyListView');
    if(list)list.style.display='none';
    hideDifficultyLessons();
    const detail=document.getElementById(id);
    if(detail)detail.style.display='block';
    window.scrollTo(0,0);
  }
  window.openDifficulty01=function(){openDifficulty('difficulty01');};
  window.openDifficulty02=function(){openDifficulty('difficulty02');};
  window.openDifficulty03=function(){openDifficulty('difficulty03');};
  window.openDifficulty04=function(){openDifficulty('difficulty04');};
  window.openDifficulty05=function(){openDifficulty('difficulty05');};
  window.openDifficulty06=function(){openDifficulty('difficulty06');};

  window.answerAffixQuiz=function(btn,choice,answer){
    const row=btn&&btn.closest('.affixQuizRow');
    if(!row||row.dataset.done)return;
    row.dataset.done='1';
    row.querySelectorAll('button').forEach(function(b){b.disabled=true;b.classList.remove('affixQuizOk','affixQuizBad');});
    const ok=choice===answer;
    btn.classList.add(ok?'affixQuizOk':'affixQuizBad');
    row.querySelectorAll('button').forEach(function(b){if(b.dataset.choice===answer)b.classList.add('affixQuizOk');});
    const result=row.querySelector('.affixQuizResult');
    if(result)result.textContent=ok?'✓ 对，就是 '+answer:'正确是 '+answer;
  };

  window.answerNasalQuiz=function(btn,choice,answer){
    const row=btn&&btn.closest('.nasalQuizRow');
    if(!row||row.dataset.done)return;
    row.dataset.done='1';
    row.querySelectorAll('button').forEach(function(b){b.disabled=true;b.classList.remove('nasalQuizOk','nasalQuizBad');});
    const ok=choice===answer;
    btn.classList.add(ok?'nasalQuizOk':'nasalQuizBad');
    row.querySelectorAll('button').forEach(function(b){if(b.dataset.choice===answer)b.classList.add('nasalQuizOk');});
    const result=row.querySelector('.nasalQuizResult');
    if(result)result.textContent=ok?'✓ 对，就是 '+answer:'正确是 '+answer;
  };

  window.answerSimilarQuiz=function(btn,choice,answer){
    const row=btn&&btn.closest('.simQuizRow');
    if(!row||row.dataset.done)return;
    row.dataset.done='1';
    row.querySelectorAll('button').forEach(function(b){b.disabled=true;b.classList.remove('simQuizOk','simQuizBad');});
    const ok=choice===answer;
    btn.classList.add(ok?'simQuizOk':'simQuizBad');
    row.querySelectorAll('button').forEach(function(b){if(b.dataset.choice===answer)b.classList.add('simQuizOk');});
    const result=row.querySelector('.simQuizResult');
    if(result)result.textContent=ok?'✓ 对，就是 '+answer:'正确是 '+answer;
  };

  window.answerDpQuiz=function(btn,choice,answer){
    const row=btn&&btn.closest('.dpQuizRow');
    if(!row||row.dataset.done)return;
    row.dataset.done='1';
    row.querySelectorAll('button').forEach(function(b){b.disabled=true;b.classList.remove('dpQuizOk','dpQuizBad');});
    const ok=choice===answer;
    btn.classList.add(ok?'dpQuizOk':'dpQuizBad');
    row.querySelectorAll('button').forEach(function(b){if(b.dataset.choice===answer)b.classList.add('dpQuizOk');});
    const result=row.querySelector('.dpQuizResult');
    if(result)result.textContent=ok?'✓ 对，就是 '+answer:'正确是 '+answer;
  };

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

  function ensureDifficulty(){
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
              <span class="pill">已整理 6 个</span>
            </div>

            <div class="difficultyIndex">
              <button class="difficultyIndexItem" type="button" onclick="openDifficulty01()">
                <span class="difficultyNo">01</span>
                <span class="difficultyIndexText"><b>sempat</b><small>时间 / 机会 / 阶段窗口</small></span>
                <span class="difficultyArrow">→</span>
              </button>
              <button class="difficultyIndexItem" type="button" onclick="openDifficulty02()">
                <span class="difficultyNo keanNo">02</span>
                <span class="difficultyIndexText"><b>ke-…-an</b><small>状态 / 遭遇 / 非主动结果</small></span>
                <span class="difficultyArrow">→</span>
              </button>
              <button class="difficultyIndexItem" type="button" onclick="openDifficulty03()">
                <span class="difficultyNo dpNo">03</span>
                <span class="difficultyIndexText"><b>dapat vs padat</b><small>长得像、听着像，但思路完全不同</small></span>
                <span class="difficultyArrow">→</span>
              </button>
              <button class="difficultyIndexItem" type="button" onclick="openDifficulty04()">
                <span class="difficultyNo simNo">04</span>
                <span class="difficultyIndexText"><b>音形易混词</b><small>只差一个音 / 一个字母，意思完全不同</small></span>
                <span class="difficultyArrow">→</span>
              </button>
              <button class="difficultyIndexItem" type="button" onclick="openDifficulty05()">
                <span class="difficultyNo nasalNo">05</span>
                <span class="difficultyIndexText"><b>meN- / peN- 为什么会变形？</b><small>鼻音同化 · 发音位置 · 主动动作 vs 人/工具</small></span>
                <span class="difficultyArrow">→</span>
              </button>
              <button class="difficultyIndexItem" type="button" onclick="openDifficulty06()">
                <span class="difficultyNo affixNo">06</span>
                <span class="difficultyIndexText"><b>前后缀总地图</b><small>别背十张表：先看“角色”，再看“动作落点”</small></span>
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

          <article id="difficulty02" class="difficultyLesson" style="display:none">
            <button class="difficultyInnerBack" type="button" onclick="showDifficultyList()">← 返回难点列表</button>

            <div class="difficultyWordHero keanHero">
              <div class="difficultyWordTop"><span class="difficultyNo big keanNo">02</span><span class="difficultyType keanType">构词 · 状态与遭遇</span></div>
              <div class="difficultyWordLine"><strong>ke-…-an</strong></div>
              <div class="difficultyMemory">先不要死记“ke-…-an = 某一个中文意思”。先抓一个总感觉：<b>和词根 X 有关的“状态、遭遇或结果”。</b></div>
            </div>

            <div class="triExplain">
              <div class="triExplainRow"><span class="langBadge cnBadge">中</span><div><b>最简单理解</b><p>ke- + X + -an → 把 X 包进一个“状态框”里。这个状态有时只是一个概念；有时是某件事发生到人身上。</p></div></div>
              <div class="triExplainRow"><span class="langBadge enBadge">EN</span><div><b>English</b><p>ke-…-an often means a <strong>state/condition related to X</strong>; in many everyday words it also means <strong>to get/be affected by X</strong> or <strong>end up in an X-related result</strong>.</p></div></div>
              <div class="triExplainRow"><span class="langBadge idBadge">ID</span><div><b>Bahasa Indonesia</b><p>ke-…-an biasanya menunjukkan <strong>keadaan, kondisi, atau hasil</strong> yang berhubungan dengan kata dasar. Kadang keadaan itu dialami seseorang dan bukan terjadi karena sengaja.</p></div></div>
            </div>

            <div class="keanFlow" aria-label="ke-an 核心结构">
              <div class="keanFlowNode rootNode"><span>词根 X</span><small>kata dasar</small></div>
              <div class="keanFlowArrow">→</div>
              <div class="keanFlowNode affixNode"><span>ke- X -an</span><small>进入 X 相关框架</small></div>
              <div class="keanFlowArrow">→</div>
              <div class="keanFlowNode resultNode"><span>状态 / 遭遇 / 结果</span><small>state · experience · result</small></div>
            </div>

            <div class="senseBridge keanBridge" aria-label="ke-an 三类常见表现">
              <div class="senseBridgeStem"></div>
              <div class="senseBridgeLabel"><b>ke-…-an</b> 最常见的 3 种表现</div>
              <div class="senseBridgeFork"><span></span><span></span><span></span></div>
            </div>

            <div class="difficultyThree keanThree">
              <div class="senseCard senseBlue">
                <div class="senseIcon">📦</div><h3>① X 这种状态 / 概念</h3>
                <div class="senseEn">the state / condition of X</div>
                <div class="wordFamily"><b>bahagia</b><span>→</span><strong>kebahagiaan</strong><small>开心 → 幸福 / happiness</small></div>
                <div class="wordFamily"><b>sulit</b><span>→</span><strong>kesulitan</strong><small>困难 → 困难、难处 / difficulty</small></div>
                <div class="wordFamily"><b>kurang</b><span>→</span><strong>kekurangan</strong><small>不足 → 缺乏、不足 / lack</small></div>
                <div class="senseTip">这里最像英语的 <b>-ness / state of...</b>。它主要是在“说一种状态或概念”。</div>
              </div>

              <div class="senseCard sensePurple">
                <div class="senseIcon">🌧️</div><h3>② 受到 X 的影响</h3>
                <div class="senseEn">get / be affected by X</div>
                <div class="wordFamily audioFamily"><b>hujan</b><span>→</span><strong>kehujanan</strong><button class="miniSound" type="button" onclick="speakIdText('kehujanan',this)">🔊</button><small>被雨淋 / get caught in the rain</small></div>
                <div class="wordFamily audioFamily"><b>panas</b><span>→</span><strong>kepanasan</strong><button class="miniSound" type="button" onclick="speakIdText('kepanasan',this)">🔊</button><small>热得难受 / feel too hot</small></div>
                <div class="wordFamily audioFamily"><b>dingin</b><span>→</span><strong>kedinginan</strong><button class="miniSound" type="button" onclick="speakIdText('kedinginan',this)">🔊</button><small>冷得难受 / feel too cold</small></div>
                <div class="senseTip">这里不是普通“名词化”。更像：<b>某个环境或状态作用到你身上。</b></div>
              </div>

              <div class="senseCard senseRed">
                <div class="senseIcon">⚡</div><h3>③ 非主动结果 / 有“被”的感觉</h3>
                <div class="senseEn">get / end up / happen to</div>
                <div class="wordFamily audioFamily"><b>tahu</b><span>→</span><strong>ketahuan</strong><button class="miniSound" type="button" onclick="speakIdText('ketahuan',this)">🔊</button><small>结果被发现 / get found out</small></div>
                <div class="wordFamily audioFamily"><b>dulu</b><span>→</span><strong>keduluan</strong><button class="miniSound" type="button" onclick="speakIdText('keduluan',this)">🔊</button><small>结果被抢先 / get beaten to it</small></div>
                <div class="wordFamily audioFamily"><b>tidur</b><span>→</span><strong>ketiduran</strong><button class="miniSound" type="button" onclick="speakIdText('ketiduran',this)">🔊</button><small>不小心睡着 / fall asleep unintentionally</small></div>
                <div class="wordFamily audioFamily"><b>curi</b><span>→</span><strong>kecurian</strong><button class="miniSound" type="button" onclick="speakIdText('kecurian',this)">🔊</button><small>遭窃 / have something stolen</small></div>
                <div class="senseTip">这类最重要的感觉：<b>不是“我主动做 X”，而是“一个结果发生到我身上”。</b></div>
              </div>
            </div>

            <div class="keanBigRule">
              <div class="keanBigRuleTitle">② + ③ 可以合在一起理解</div>
              <div class="keanBigRuleFlow"><span>我</span><b>← 事情 / 状态发生到我身上</b><span>外部情况</span></div>
              <p>所以中文经常会翻译成“被……了 / 遭……了 / 不小心……了 / 结果……了”。这就是为什么 <b>ketahuan、keduluan、kecurian</b> 会让你感觉有“被动”。</p>
            </div>

            <div class="compareBlock">
              <div class="compareTitle">有“被动感”，但不等于 di- 被动语态</div>
              <div class="compareGrid keanCompareGrid">
                <div class="compareCard pernahCard">
                  <div class="compareWord">di-</div>
                  <div class="compareQuestion">重点：<b>动作本身的被动关系</b></div>
                  <div class="compareEn">grammatical passive</div>
                  <div class="compareExample">Barang saya dicuri.</div>
                  <div class="compareCn">我的东西被偷了。→ 焦点是“东西遭到偷窃这个动作”。</div>
                  <div class="compareExample">Masalah itu diketahui bos.</div>
                  <div class="compareCn">那个问题被老板知道了。→ 中性地描述被动关系。</div>
                </div>
                <div class="compareVs">VS</div>
                <div class="compareCard sempatCard keanCompareCard">
                  <div class="compareWord">ke-…-an</div>
                  <div class="compareQuestion">重点：<b>主体遭遇了什么结果 / 状态</b></div>
                  <div class="compareEn">affected person / resulting state</div>
                  <div class="compareExample">Saya kecurian.</div>
                  <div class="compareCn">我遭窃了。→ 焦点是“我受到了这件事影响”。</div>
                  <div class="compareExample">Akhirnya ketahuan bos.</div>
                  <div class="compareCn">最后还是让老板发现了。→ 更强调“露馅这个结果发生了”。</div>
                </div>
              </div>
            </div>

            <div class="exampleStrip">
              <div><b>Aku kehujanan tadi.</b><button class="miniSound" type="button" onclick="speakIdText('Aku kehujanan tadi.',this)">🔊</button><span>我刚才淋雨了。</span></div>
              <div><b>Aku ketiduran di sofa.</b><button class="miniSound" type="button" onclick="speakIdText('Aku ketiduran di sofa.',this)">🔊</button><span>我不小心在沙发上睡着了。</span></div>
              <div><b>Aku mau beli, tapi keduluan orang lain.</b><button class="miniSound" type="button" onclick="speakIdText('Aku mau beli, tapi keduluan orang lain.',this)">🔊</button><span>我本来想买，但被别人抢先了。</span></div>
              <div><b>Jangan sampai ketahuan bos.</b><button class="miniSound" type="button" onclick="speakIdText('Jangan sampai ketahuan bos.',this)">🔊</button><span>别让老板发现。</span></div>
            </div>

            <div class="difficultyFormula keanFormula">
              <span>一句话记忆</span>
              <b>ke-…-an = “和 X 有关的状态”；如果这个状态发生到人身上，就会有“遭遇 / 受影响 / 结果落到我身上”的感觉。</b>
              <small>看到新词时先判断：① 它是在说一种状态/概念？还是 ②③ 某种情况发生到了主体身上？不要机械翻译成固定的“被”。</small>
            </div>
          </article>

          <article id="difficulty03" class="difficultyLesson" style="display:none">
            <button class="difficultyInnerBack" type="button" onclick="showDifficultyList()">← 返回难点列表</button>

            <div class="difficultyWordHero dpHero">
              <div class="difficultyWordTop"><span class="difficultyNo big dpNo">03</span><span class="difficultyType dpType">易混音词 · 核心概念对比</span></div>
              <div class="dpWordPair"><strong class="dpDapat">dapat</strong><span>↔</span><strong class="dpPadat">padat</strong></div>
              <div class="difficultyMemory">不要靠中文释义硬背。先固定两个画面：<b>dapat = 手里“拿到 / 能做到”</b>；<b>padat = 一个空间“塞得满 / 很密”</b>。</div>
              <div class="dpSoundRow">
                <button class="dpSoundButton" type="button" onclick="speakIdText('dapat',this)">🔊 dapat</button>
                <button class="dpSoundButton" type="button" onclick="speakIdText('padat',this)">🔊 padat</button>
                <button class="dpSoundButton compare" type="button" onclick="speakIdText('dapat. padat. dapat. padat.',this)">🔁 连续对比听</button>
              </div>
            </div>

            <div class="dpPronounce">
              <div><b><span class="dpSyllableHot">da</span> · pat</b><small>dapat：先听开头 <strong>DA-</strong></small></div>
              <span class="dpSwap">⇄</span>
              <div><b><span class="dpSyllableHot alt">pa</span> · dat</b><small>padat：先听开头 <strong>PA-</strong></small></div>
            </div>

            <div class="dpCoreGrid">
              <div class="dpCoreCard dapatCard">
                <div class="dpCoreIcon">🤲</div>
                <h3>dapat</h3>
                <div class="dpCoreBig">GET / CAN</div>
                <p class="dpCoreCn">核心画面：<b>得到、拿到；有条件做到 → 可以</b></p>
                <div class="dpLang"><span>EN</span> get · receive · obtain · can</div>
                <div class="dpLang"><span>ID</span> mendapat / memperoleh · bisa</div>
              </div>
              <div class="dpCoreVs">VS</div>
              <div class="dpCoreCard padatCard">
                <div class="dpCoreIcon">📦</div>
                <h3>padat</h3>
                <div class="dpCoreBig">DENSE / PACKED</div>
                <p class="dpCoreCn">核心画面：<b>空间里东西很多 → 满、密、挤、紧实</b></p>
                <div class="dpLang"><span>EN</span> dense · packed · compact · solid</div>
                <div class="dpLang"><span>ID</span> penuh · rapat · tidak renggang</div>
              </div>
            </div>

            <div class="dpBridge">
              <div class="dpBridgeTitle">为什么 dapat 既能“得到”，又能“可以”？</div>
              <div class="dpBridgeFlow"><span>得到机会 / 条件</span><b>→</b><span>有能力或条件做</span><b>→</b><span>dapat = can</span></div>
              <p>所以不要把这两个意思完全拆开。可以先把它们连成：<b>“拿得到 / 条件允许” → “能够”。</b></p>
              <div class="dpSpeechNote"><b>雅加达口语提醒：</b><span>表示“得到”时常听到 <strong>dapet</strong>；表示“能够”时，日常聊天通常更爱说 <strong>bisa</strong>。<strong>dapat = can</strong> 更偏正式、书面或较正式表达。</span></div>
            </div>

            <div class="compareBlock">
              <div class="compareTitle">放到句子里，多组并排看</div>
              <div class="dpSentencePairs">
                <div class="dpPairRow">
                  <div class="dpSentence dapatTint"><b>Aku dapat kerjaan baru.</b><button class="miniSound" type="button" onclick="speakIdText('Aku dapat kerjaan baru.',this)">🔊</button><span>我找到 / 得到了一份新工作。</span><small>Jakarta口语常听到：Aku <b>dapet</b> kerjaan baru.</small></div>
                  <div class="dpSentence padatTint"><b>Jadwal saya padat.</b><button class="miniSound" type="button" onclick="speakIdText('Jadwal saya padat.',this)">🔊</button><span>我的日程很满。</span><small>My schedule is packed.</small></div>
                </div>
                <div class="dpPairRow">
                  <div class="dpSentence dapatTint"><b>Aku dapat tiketnya.</b><button class="miniSound" type="button" onclick="speakIdText('Aku dapat tiketnya.',this)">🔊</button><span>我拿到票了。</span><small>I got the ticket.</small></div>
                  <div class="dpSentence padatTint"><b>Jalanan lagi padat.</b><button class="miniSound" type="button" onclick="speakIdText('Jalanan lagi padat.',this)">🔊</button><span>现在路上很堵。</span><small>Traffic is heavy right now.</small></div>
                </div>
                <div class="dpPairRow">
                  <div class="dpSentence dapatTint"><b>Saya dapat datang besok.</b><button class="miniSound" type="button" onclick="speakIdText('Saya dapat datang besok.',this)">🔊</button><span>我明天可以来。</span><small>正确但偏正式；口语更常：Aku bisa datang besok.</small></div>
                  <div class="dpSentence padatTint"><b>Daerah ini padat penduduk.</b><button class="miniSound" type="button" onclick="speakIdText('Daerah ini padat penduduk.',this)">🔊</button><span>这个地区人口密集。</span><small>This area is densely populated.</small></div>
                </div>
              </div>
            </div>

            <div class="dpFamilyGrid">
              <div class="dpFamilyCard dapatFamily">
                <div class="dpFamilyHead"><span>🌱</span><div><h3>dapat 词族</h3><small>大多围绕“得到 / 获得 / 能够”</small></div></div>
                <div class="wordFamily audioFamily"><b>dapat</b><span>→</span><strong>mendapat</strong><button class="miniSound" type="button" onclick="speakIdText('mendapat',this)">🔊</button><small>得到、获得 · get / receive</small></div>
                <div class="wordFamily audioFamily"><b>dapat</b><span>→</span><strong>mendapatkan</strong><button class="miniSound" type="button" onclick="speakIdText('mendapatkan',this)">🔊</button><small>获得、取得 · get / obtain</small></div>
                <div class="wordFamily audioFamily"><b>dapat</b><span>→</span><strong>pendapat</strong><button class="miniSound" type="button" onclick="speakIdText('pendapat',this)">🔊</button><small>意见、看法 · opinion / view（高频固定词义）</small></div>
                <div class="wordFamily audioFamily"><b>pendapat</b><span>→</span><strong>berpendapat</strong><button class="miniSound" type="button" onclick="speakIdText('berpendapat',this)">🔊</button><small>认为、持某种看法 · be of the opinion</small></div>
                <div class="wordFamily audioFamily"><b>pendapat</b><span>→</span><strong>sependapat</strong><button class="miniSound" type="button" onclick="speakIdText('sependapat',this)">🔊</button><small>意见一致 · agree / share the same view</small></div>
                <div class="wordFamily audioFamily"><b>dapat</b><span>→</span><strong>pendapatan</strong><button class="miniSound" type="button" onclick="speakIdText('pendapatan',this)">🔊</button><small>收入 · income / revenue</small></div>
                <div class="wordFamily audioFamily"><b>dapat</b><span>→</span><strong>terdapat</strong><button class="miniSound" type="button" onclick="speakIdText('terdapat',this)">🔊</button><small>有、存在于 · there is/are / be found（书面、正式很常见）</small></div>
                <div class="dpFamilyNote"><b>优先掌握这 7 个：</b><span>日常和常见书面语已经够用，不再把透明的被动形式和低频派生词单独堆进来。</span></div>
                <div class="dpFamilyNote"><b>特别注意：</b><span><strong>pendapat</strong> = 意见 / 看法；<strong>pendapatan</strong> = 收入。只差 <b>-an</b>，意思已经完全不同。</span></div>
              </div>
              <div class="dpFamilyCard padatFamily">
                <div class="dpFamilyHead"><span>🧱</span><div><h3>padat 词族</h3><small>大多围绕“密 / 满 / 压实”</small></div></div>
                <div class="wordFamily audioFamily"><b>padat</b><span>→</span><strong>kepadatan</strong><button class="miniSound" type="button" onclick="speakIdText('kepadatan',this)">🔊</button><small>密度、拥挤程度 · density</small></div>
                <div class="wordFamily audioFamily"><b>padat</b><span>→</span><strong>terpadat</strong><button class="miniSound" type="button" onclick="speakIdText('terpadat',this)">🔊</button><small>最密集、最拥挤 · densest / most crowded</small></div>
                <div class="dpFamilyNote"><b>词族不用背太多：</b><span><strong>pemadatan / pemadat / dipadatkan</strong> 等更多出现在施工、技术语境，这里先不作为重点。</span></div>
                <div class="dpCollocations"><b>真正高频的 padat 组合</b><span>padat penduduk</span><span>lalu lintas padat</span><span>jalanan padat</span><span>jadwal padat</span><span>padat merayap</span><span>zat / benda padat</span><span>padat karya</span></div>
              </div>
            </div>

            <div class="dpQuickRule">
              <div><span>🤲</span><b>“能不能 / 得到没有？”</b><strong>→ dapat</strong></div>
              <div class="dpRuleDivider"></div>
              <div><span>📦</span><b>“满不满 / 密不密 / 挤不挤？”</b><strong>→ padat</strong></div>
            </div>

            <div class="dpQuiz">
              <div class="compareTitle">马上判断：你脑子里应该跳出哪个词？</div>
              <div class="dpQuizRow"><span>① “我拿到票了。”</span><div><button data-choice="dapat" onclick="answerDpQuiz(this,'dapat','dapat')">dapat</button><button data-choice="padat" onclick="answerDpQuiz(this,'padat','dapat')">padat</button></div><small class="dpQuizResult"></small></div>
              <div class="dpQuizRow"><span>② “今天日程很满。”</span><div><button data-choice="dapat" onclick="answerDpQuiz(this,'dapat','padat')">dapat</button><button data-choice="padat" onclick="answerDpQuiz(this,'padat','padat')">padat</button></div><small class="dpQuizResult"></small></div>
              <div class="dpQuizRow"><span>③ “这个地区人口密集。”</span><div><button data-choice="dapat" onclick="answerDpQuiz(this,'dapat','padat')">dapat</button><button data-choice="padat" onclick="answerDpQuiz(this,'padat','padat')">padat</button></div><small class="dpQuizResult"></small></div>
              <div class="dpQuizRow"><span>④ “我明天可以来。”</span><div><button data-choice="dapat" onclick="answerDpQuiz(this,'dapat','dapat')">dapat</button><button data-choice="padat" onclick="answerDpQuiz(this,'padat','dapat')">padat</button></div><small class="dpQuizResult"></small></div>
            </div>

            <div class="difficultyFormula dpFormula">
              <span>一句话记忆</span>
              <b>dapat = “拿到 / 能做到”；padat = “塞满 / 很密”。</b>
              <small>先听第一个音节：DA-pat vs PA-dat；再看句子是在说“获得/能够”，还是“密/满/挤”。</small>
            </div>
          </article>

          <article id="difficulty04" class="difficultyLesson" style="display:none">
            <button class="difficultyInnerBack" type="button" onclick="showDifficultyList()">← 返回难点列表</button>

            <div class="difficultyWordHero simHero">
              <div class="difficultyWordTop"><span class="difficultyNo big simNo">04</span><span class="difficultyType simType">音形易混词 · 最小区别音</span></div>
              <div class="simHeroTitle">看起来差不多，听起来也很像，为什么总串词？</div>
              <div class="difficultyMemory">这类词多数<b>不是同一个词根</b>。不要把它们绑成一个“词族”背；真正有效的方法是：<b>找到最小的区别音，再把每个词绑定到完全不同的场景。</b></div>
              <div class="simMethod">
                <div><span>1</span><b>先看共同骨架</b><small>例如 m-rah</small></div>
                <div><span>2</span><b>只盯区别音</b><small>a / e / u</small></div>
                <div><span>3</span><b>绑定场景</b><small>生气 / 红色 / 便宜</small></div>
              </div>
              <div class="simAlready"><b>dapat / padat</b> 已在第 03 个难点单独讲，这里不重复。</div>
            </div>

            <div class="simSectionTitle">A. 最容易混的一大组：tang-</div>
            <div class="simGroup simWide">
              <div class="simGroupHead">
                <div><b>tang- 密集区</b><small>重点先分清 ng / ngg / ngk</small></div>
                <button class="simListen" type="button" onclick="speakIdText('tangan. tangga. tanggal. tanggap. tangkap. tanggung. tangguh.',this)">🔁 连续听</button>
              </div>
              <div class="simNgRule">
                <span><b>ng</b><small>/ŋ/</small></span>
                <span><b>ngg</b><small>/ŋg/</small></span>
                <span><b>ngk</b><small>/ŋk/</small></span>
                <p>中文耳朵容易把这三种都听成“ng”。但印尼语里后面有没有 <b>g / k</b> 会直接换成另一个词。</p>
              </div>
              <div class="simWordGrid tangGrid">
                <div class="simWord"><button onclick="speakIdText('tangan',this)">🔊</button><strong>ta<span>ng</span>an</strong><b>手</b><small>body · 手这个场景</small></div>
                <div class="simWord"><button onclick="speakIdText('tangga',this)">🔊</button><strong>ta<span>ngg</span>a</strong><b>楼梯 / 梯子</b><small>stairs / ladder</small></div>
                <div class="simWord"><button onclick="speakIdText('tanggal',this)">🔊</button><strong>ta<span>ngg</span>al</strong><b>日期；脱落</b><small>tanggal lahir = 出生日期</small></div>
                <div class="simWord"><button onclick="speakIdText('tanggap',this)">🔊</button><strong>ta<span>ngg</span>ap</strong><b>反应快、善于回应</b><small>responsive</small></div>
                <div class="simWord"><button onclick="speakIdText('tangkap',this)">🔊</button><strong>ta<span>ngk</span>ap</strong><b>抓住、捕捉</b><small>catch / capture</small></div>
                <div class="simWord"><button onclick="speakIdText('tanggung',this)">🔊</button><strong>ta<span>ngg</span>ung</strong><b>承担；不上不下</b><small>tanggung jawab = 责任</small></div>
                <div class="simWord"><button onclick="speakIdText('tangguh',this)">🔊</button><strong>ta<span>ngg</span>uh</strong><b>坚韧、强悍</b><small>tough / resilient</small></div>
              </div>
              <div class="simCue"><b>识别诀窍：</b>先不要猜整个词。听到 <strong>tang-</strong> 后，马上把注意力放到后半段：<strong>-an / -ga / -gal / -gap / -kap / -gung / -guh</strong>。</div>
            </div>

            <div class="simSectionTitle">B. 高频“最小差异”组</div>
            <div class="simGroups">

              <div class="simGroup">
                <div class="simGroupHead"><div><b>marah / merah / murah</b><small>只换中间元音</small></div><button class="simListen" onclick="speakIdText('marah. merah. murah.',this)">🔁</button></div>
                <div class="simPattern"><span>m<strong>a</strong>rah</span><span>m<strong>e</strong>rah</span><span>m<strong>u</strong>rah</span></div>
                <div class="simMiniRows">
                  <div><b>marah</b><span>生气</span><small>情绪</small></div>
                  <div><b>merah</b><span>红色</span><small>颜色</small></div>
                  <div><b>murah</b><span>便宜</span><small>价格</small></div>
                </div>
                <div class="simCue"><b>不要看整词：</b>只听第二个元音。<strong>a = angry，e = red，u = cheap</strong>。</div>
              </div>

              <div class="simGroup">
                <div class="simGroupHead"><div><b>malam / malah / malas / malu</b><small>mala- 周围的高频词</small></div><button class="simListen" onclick="speakIdText('malam. malah. malas. malu.',this)">🔁</button></div>
                <div class="simMiniRows">
                  <div><b>malam</b><span>夜晚</span><small>时间</small></div>
                  <div><b>malah</b><span>反而、却</span><small>转折结果</small></div>
                  <div><b>malas</b><span>懒、不想做</span><small>状态</small></div>
                  <div><b>malu</b><span>害羞、丢脸</span><small>情绪</small></div>
                </div>
                <div class="simCue"><b>前三个只看尾音：</b><strong>-m 夜晚 / -h 反而 / -s 懒</strong>；malu 则直接绑定“害羞”。</div>
              </div>

              <div class="simGroup">
                <div class="simGroupHead"><div><b>singkat / tingkat</b><small>只差开头 s / t</small></div><button class="simListen" onclick="speakIdText('singkat. tingkat.',this)">🔁</button></div>
                <div class="simPattern"><span><strong>s</strong>ingkat</span><span><strong>t</strong>ingkat</span></div>
                <div class="simMiniRows">
                  <div><b>singkat</b><span>简短、短暂</span><small>short / brief</small></div>
                  <div><b>tingkat</b><span>层、等级、程度</span><small>level / floor</small></div>
                </div>
                <div class="simCue"><b>场景切开：</b><strong>singkat</strong> 说“长短”；<strong>tingkat</strong> 说“层级、高低”。</div>
              </div>

              <div class="simGroup">
                <div class="simGroupHead"><div><b>kepala / kelapa</b><small>pa / la 位置互换</small></div><button class="simListen" onclick="speakIdText('kepala. kelapa.',this)">🔁</button></div>
                <div class="simPattern swapPattern"><span>ke-<strong>pa-la</strong></span><span>ke-<strong>la-pa</strong></span></div>
                <div class="simMiniRows">
                  <div><b>kepala</b><span>头</span><small>body</small></div>
                  <div><b>kelapa</b><span>椰子</span><small>food / plant</small></div>
                </div>
                <div class="simCue"><b>这是“位置互换型”：</b>不是多一个字母，而是 <strong>pa-la ↔ la-pa</strong>。</div>
              </div>

              <div class="simGroup">
                <div class="simGroupHead"><div><b>kurang / kurung / karung</b><small>元音位置决定词义</small></div><button class="simListen" onclick="speakIdText('kurang. kurung. karung.',this)">🔁</button></div>
                <div class="simMiniRows">
                  <div><b>kurang</b><span>少、不足、不够</span><small>quantity</small></div>
                  <div><b>kurung</b><span>关起来、圈住</span><small>confine</small></div>
                  <div><b>karung</b><span>大袋子、麻袋</span><small>sack</small></div>
                </div>
                <div class="simCue"><b>场景法：</b>钱不够 = <strong>kurang</strong>；把动物关起来 = <strong>kurung</strong>；一麻袋米 = <strong>karung</strong>。</div>
              </div>

              <div class="simGroup">
                <div class="simGroupHead"><div><b>tinggal / tinggi / tingkat / tingkah</b><small>共同开头 ting-</small></div><button class="simListen" onclick="speakIdText('tinggal. tinggi. tingkat. tingkah.',this)">🔁</button></div>
                <div class="simMiniRows">
                  <div><b>tinggal</b><span>住；剩下</span><small>live / remain</small></div>
                  <div><b>tinggi</b><span>高</span><small>high / tall</small></div>
                  <div><b>tingkat</b><span>层、等级、程度</span><small>level</small></div>
                  <div><b>tingkah</b><span>举止、行为</span><small>behavior</small></div>
                </div>
                <div class="simCue"><b>只抓后半段：</b><strong>-gal 住 / -gi 高 / -kat 层级 / -kah 行为</strong>。</div>
              </div>

              <div class="simGroup">
                <div class="simGroupHead"><div><b>langkah / langka / lengkap</b><small>ngkah / ngka / ngkap</small></div><button class="simListen" onclick="speakIdText('langkah. langka. lengkap.',this)">🔁</button></div>
                <div class="simMiniRows">
                  <div><b>langkah</b><span>步、步骤</span><small>step</small></div>
                  <div><b>langka</b><span>稀有、罕见</span><small>rare</small></div>
                  <div><b>lengkap</b><span>完整、齐全</span><small>complete</small></div>
                </div>
                <div class="simCue"><b>视觉上很像，但骨架不同：</b><strong>langkah</strong> 有 h；<strong>langka</strong> 到 a 就结束；<strong>lengkap</strong> 是 leng-kap。</div>
              </div>

              <div class="simGroup">
                <div class="simGroupHead"><div><b>rasa / rata / rapat / rawat</b><small>ra- 开头的常用词</small></div><button class="simListen" onclick="speakIdText('rasa. rata. rapat. rawat.',this)">🔁</button></div>
                <div class="simMiniRows">
                  <div><b>rasa</b><span>感觉、味道</span><small>feel / taste</small></div>
                  <div><b>rata</b><span>平、平均</span><small>flat / even</small></div>
                  <div><b>rapat</b><span>紧密；会议</span><small>tight / meeting</small></div>
                  <div><b>rawat</b><span>照顾、护理</span><small>care / treat</small></div>
                </div>
                <div class="simCue"><b>把它们放进四个场景：</b>舌头/感觉 → rasa；表面 → rata；会议室 → rapat；医院/照顾 → rawat。</div>
              </div>

            </div>

            <div class="simRuleBox">
              <div class="simRuleTitle">真正有效的辨析方式</div>
              <div class="simRuleGrid">
                <div><b>不要：</b><span>把一组相似词从头到尾反复看中文。</span></div>
                <div><b>要：</b><span>先圈出“唯一不同的音”，再给每个词放一个完全不同的场景。</span></div>
                <div><b>听到时：</b><span>不要等整词结束才猜；一出现区别音，就立即切到对应意思。</span></div>
                <div><b>复习时：</b><span>连续对比读，比把这些词分开背更容易建立边界。</span></div>
              </div>
            </div>

            <div class="simQuiz">
              <div class="compareTitle">快速辨析</div>
              <div class="simQuizRow"><span>① “便宜”</span><div><button data-choice="marah" onclick="answerSimilarQuiz(this,'marah','murah')">marah</button><button data-choice="merah" onclick="answerSimilarQuiz(this,'merah','murah')">merah</button><button data-choice="murah" onclick="answerSimilarQuiz(this,'murah','murah')">murah</button></div><small class="simQuizResult"></small></div>
              <div class="simQuizRow"><span>② “楼梯”</span><div><button data-choice="tangan" onclick="answerSimilarQuiz(this,'tangan','tangga')">tangan</button><button data-choice="tangga" onclick="answerSimilarQuiz(this,'tangga','tangga')">tangga</button><button data-choice="tanggal" onclick="answerSimilarQuiz(this,'tanggal','tangga')">tanggal</button></div><small class="simQuizResult"></small></div>
              <div class="simQuizRow"><span>③ “简短”</span><div><button data-choice="singkat" onclick="answerSimilarQuiz(this,'singkat','singkat')">singkat</button><button data-choice="tingkat" onclick="answerSimilarQuiz(this,'tingkat','singkat')">tingkat</button></div><small class="simQuizResult"></small></div>
              <div class="simQuizRow"><span>④ “椰子”</span><div><button data-choice="kepala" onclick="answerSimilarQuiz(this,'kepala','kelapa')">kepala</button><button data-choice="kelapa" onclick="answerSimilarQuiz(this,'kelapa','kelapa')">kelapa</button></div><small class="simQuizResult"></small></div>
              <div class="simQuizRow"><span>⑤ “不够”</span><div><button data-choice="kurang" onclick="answerSimilarQuiz(this,'kurang','kurang')">kurang</button><button data-choice="kurung" onclick="answerSimilarQuiz(this,'kurung','kurang')">kurung</button><button data-choice="karung" onclick="answerSimilarQuiz(this,'karung','kurang')">karung</button></div><small class="simQuizResult"></small></div>
              <div class="simQuizRow"><span>⑥ “举止、行为”</span><div><button data-choice="tinggal" onclick="answerSimilarQuiz(this,'tinggal','tingkah')">tinggal</button><button data-choice="tingkat" onclick="answerSimilarQuiz(this,'tingkat','tingkah')">tingkat</button><button data-choice="tingkah" onclick="answerSimilarQuiz(this,'tingkah','tingkah')">tingkah</button></div><small class="simQuizResult"></small></div>
            </div>

            <div class="difficultyFormula simFormula">
              <span>一句话记忆</span>
              <b>相似词不要“整词硬背”，要抓最小区别音：一个音变了，就是另一个场景、另一个词。</b>
              <small>先建立边界，再扩大词汇量。这样比把相似词混在一起反复背更稳。</small>
            </div>
          </article>

          <article id="difficulty05" class="difficultyLesson" style="display:none">
            <button class="difficultyInnerBack" type="button" onclick="showDifficultyList()">← 返回难点列表</button>

            <div class="difficultyWordHero nasalHero">
              <div class="difficultyWordTop"><span class="difficultyNo big nasalNo">05</span><span class="difficultyType nasalType">前缀 · 鼻音同化</span></div>
              <div class="nasalHeroTitle"><span class="meNColor">meN-</span> 和 <span class="peNColor">peN-</span> 为什么总在变？</div>
              <div class="difficultyMemory">先不要背一大张字母表。真正的核心只有一句：<b>前缀里的鼻音会“迁就”后面的第一个音，跑到更接近的发音位置，让连接更顺。</b></div>
              <div class="nasalHeroRule">
                <span>嘴唇附近 → m</span><i>→</i>
                <span>舌尖附近 → n</span><i>→</i>
                <span>舌面附近 → ny</span><i>→</i>
                <span>舌根附近 → ng</span>
              </div>
              <div class="nasalHeroNote">可以把“省劲”当作记忆法；语言学上更准确叫 <b>鼻音同化（nasal assimilation）</b>。它已经是固定构词规则，不是临时偷懒。</div>
            </div>

            <div class="nasalSectionTitle">① 先看一张“发音位置地图”</div>
            <div class="nasalMouthCard">
              <div class="nasalMapIntro"><b>从嘴巴前面一路往后看</b><span>这不是精细解剖图，而是帮助记住“鼻音为什么会换位置”的学习图。</span></div>
              <svg class="nasalMouthSvg" viewBox="0 0 760 235" role="img" aria-label="meN 和 peN 鼻音发音位置示意图">
                <defs>
                  <linearGradient id="mouthGrad" x1="0" x2="1">
                    <stop offset="0%" stop-color="#fff4f1"/>
                    <stop offset="100%" stop-color="#f5f8ff"/>
                  </linearGradient>
                  <marker id="nasalArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                    <path d="M0,0 L8,4 L0,8 Z" fill="#98a2b3"></path>
                  </marker>
                </defs>
                <path d="M65 106 C115 62, 188 43, 292 48 C402 53, 520 43, 672 83 C704 92, 707 139, 675 151 C530 204, 383 197, 271 186 C173 177, 105 160, 65 132 Z" fill="url(#mouthGrad)" stroke="#d9e1ea" stroke-width="3"/>
                <path d="M117 121 C206 102, 307 105, 408 128 C469 142, 530 146, 604 129" fill="none" stroke="#d7a8a1" stroke-width="9" stroke-linecap="round"/>
                <path d="M138 87 C247 71, 378 74, 598 98" fill="none" stroke="#c7d3e2" stroke-width="5" stroke-linecap="round"/>
                <circle cx="94" cy="119" r="13" fill="#e8f4ff" stroke="#4b88c8" stroke-width="3"/>
                <circle cx="245" cy="111" r="13" fill="#eef8f1" stroke="#4e9d67" stroke-width="3"/>
                <circle cx="409" cy="128" r="13" fill="#fff6df" stroke="#c49a37" stroke-width="3"/>
                <circle cx="588" cy="119" r="13" fill="#f5efff" stroke="#7d62b3" stroke-width="3"/>
                <line x1="108" y1="119" x2="229" y2="112" stroke="#98a2b3" stroke-width="2" marker-end="url(#nasalArrow)"/>
                <line x1="259" y1="113" x2="393" y2="126" stroke="#98a2b3" stroke-width="2" marker-end="url(#nasalArrow)"/>
                <line x1="423" y1="128" x2="572" y2="120" stroke="#98a2b3" stroke-width="2" marker-end="url(#nasalArrow)"/>
                <text x="94" y="29" text-anchor="middle" class="nasalSvgMain">m</text>
                <text x="94" y="48" text-anchor="middle" class="nasalSvgSub">双唇</text>
                <text x="245" y="29" text-anchor="middle" class="nasalSvgMain">n</text>
                <text x="245" y="48" text-anchor="middle" class="nasalSvgSub">舌尖 / 舌前</text>
                <text x="409" y="29" text-anchor="middle" class="nasalSvgMain">ny</text>
                <text x="409" y="48" text-anchor="middle" class="nasalSvgSub">舌面</text>
                <text x="588" y="29" text-anchor="middle" class="nasalSvgMain">ng</text>
                <text x="588" y="48" text-anchor="middle" class="nasalSvgSub">舌根 / 后部</text>
                <text x="94" y="218" text-anchor="middle" class="nasalSvgPair">mem- / pem-</text>
                <text x="245" y="218" text-anchor="middle" class="nasalSvgPair">men- / pen-</text>
                <text x="409" y="218" text-anchor="middle" class="nasalSvgPair">meny- / peny-</text>
                <text x="588" y="218" text-anchor="middle" class="nasalSvgPair">meng- / peng-</text>
              </svg>
              <div class="nasalMapBottom">
                <div><b>双唇区</b><span>b / p / f / v 附近 → m</span></div>
                <div><b>舌尖区</b><span>d / t / c / j / z 附近 → n</span></div>
                <div><b>s 这一支</b><span>s 常消失 → ny</span></div>
                <div><b>舌根区</b><span>g / k / h / 元音（a / i / u / e / o）→ ng</span></div>
              </div>
            </div>

            <div class="nasalSectionTitle">② meN-：重点是“做动作”</div>
            <div class="nasalPrefixPanel meNPanel">
              <div class="nasalPanelHead">
                <div><span class="nasalPanelBadge">meN-</span><h3>把词根变成主动动作</h3><small>大致可以先理解成：do / perform the action</small></div>
                <button class="nasalListenAll" onclick="speakIdText('membaca. menulis. menyapu. mengirim. melihat. mengecat.',this)">🔊 连续听一遍</button>
              </div>
              <div class="nasalRuleGrid">
                <div class="nasalRuleCard mZone"><div class="nasalRuleTop"><b>m → mem-</b><span>嘴唇区</span></div><p><strong>b / f / v</strong> 保留；<strong>p</strong> 常消失。</p><div class="nasalExample"><span>baca</span><i>→</i><b>membaca</b><button onclick="speakIdText('membaca',this)">🔊</button></div><div class="nasalExample"><span>pakai</span><i>→</i><b>memakai</b><button onclick="speakIdText('memakai',this)">🔊</button></div></div>
                <div class="nasalRuleCard nZone"><div class="nasalRuleTop"><b>n → men-</b><span>舌尖区</span></div><p><strong>d / c / j / z</strong> 保留；<strong>t</strong> 常消失。</p><div class="nasalExample"><span>dengar</span><i>→</i><b>mendengar</b><button onclick="speakIdText('mendengar',this)">🔊</button></div><div class="nasalExample"><span>tulis</span><i>→</i><b>menulis</b><button onclick="speakIdText('menulis',this)">🔊</button></div></div>
                <div class="nasalRuleCard nyZone"><div class="nasalRuleTop"><b>ny → meny-</b><span>s 这一支</span></div><p><strong>s</strong> 通常消失，鼻音变成 <strong>ny</strong>。</p><div class="nasalExample"><span>sapu</span><i>→</i><b>menyapu</b><button onclick="speakIdText('menyapu',this)">🔊</button></div></div>
                <div class="nasalRuleCard ngZone"><div class="nasalRuleTop"><b>ng → meng-</b><span>舌根区</span></div><p><strong>元音（a / i / u / e / o）/ g / h</strong> 保留；<strong>k</strong> 常消失。</p><div class="nasalExample"><span>ambil</span><i>→</i><b>mengambil</b><button onclick="speakIdText('mengambil',this)">🔊</button></div><div class="nasalExample"><span>kirim</span><i>→</i><b>mengirim</b><button onclick="speakIdText('mengirim',this)">🔊</button></div></div>
              </div>
              <div class="nasalSpecialRow">
                <div><b>顺滑音 → me-</b><span>l / m / n / r / w / y 前通常不需要额外鼻音</span><small>lihat → <strong>melihat</strong> · rasa → <strong>merasa</strong> · warna → <strong>mewarnai</strong> · yakin → <strong>meyakinkan</strong></small></div>
                <div><b>单音节 → menge-</b><span>为了不让结构太挤，多一个过渡音节</span><small>cat → <strong>mengecat</strong></small></div>
              </div>
              <div class="nasalSurfaceNote"><b>一个容易看错的例子：</b><span><strong>masak → memasak</strong> 表面看起来像 “mem-”，但更适合按 <strong>me- + masak</strong> 理解；不要只靠字面硬切前缀。</span></div>
            </div>

            <div class="nasalSectionTitle">③ peN-：同一套发音规则，但更常指“人 / 工具 / 施事者”</div>
            <div class="nasalPrefixPanel peNPanel">
              <div class="nasalPanelHead">
                <div><span class="nasalPanelBadge">peN-</span><h3>把动作变成执行者、人物或工具</h3><small>大致可以先理解成：the doer / person / tool</small></div>
                <button class="nasalListenAll" onclick="speakIdText('pembaca. penulis. penyapu. pengirim. pelari. pengecat.',this)">🔊 连续听一遍</button>
              </div>
              <div class="nasalRuleGrid">
                <div class="nasalRuleCard mZone"><div class="nasalRuleTop"><b>m → pem-</b><span>嘴唇区</span></div><p><strong>b / f / v</strong> 保留；<strong>p</strong> 常消失。</p><div class="nasalExample"><span>baca</span><i>→</i><b>pembaca</b><button onclick="speakIdText('pembaca',this)">🔊</button></div><div class="nasalExample"><span>pakai</span><i>→</i><b>pemakai</b><button onclick="speakIdText('pemakai',this)">🔊</button></div></div>
                <div class="nasalRuleCard nZone"><div class="nasalRuleTop"><b>n → pen-</b><span>舌尖区</span></div><p><strong>d / c / j / z</strong> 保留；<strong>t</strong> 常消失。</p><div class="nasalExample"><span>dengar</span><i>→</i><b>pendengar</b><button onclick="speakIdText('pendengar',this)">🔊</button></div><div class="nasalExample"><span>tulis</span><i>→</i><b>penulis</b><button onclick="speakIdText('penulis',this)">🔊</button></div></div>
                <div class="nasalRuleCard nyZone"><div class="nasalRuleTop"><b>ny → peny-</b><span>s 这一支</span></div><p><strong>s</strong> 通常消失，鼻音变成 <strong>ny</strong>。</p><div class="nasalExample"><span>sapu</span><i>→</i><b>penyapu</b><button onclick="speakIdText('penyapu',this)">🔊</button></div></div>
                <div class="nasalRuleCard ngZone"><div class="nasalRuleTop"><b>ng → peng-</b><span>舌根区</span></div><p><strong>元音（a / i / u / e / o）/ g / h</strong> 保留；<strong>k</strong> 常消失。</p><div class="nasalExample"><span>ajar</span><i>→</i><b>pengajar</b><button onclick="speakIdText('pengajar',this)">🔊</button></div><div class="nasalExample"><span>kirim</span><i>→</i><b>pengirim</b><button onclick="speakIdText('pengirim',this)">🔊</button></div></div>
              </div>
              <div class="nasalSpecialRow">
                <div><b>顺滑音 → pe-</b><span>l / m / n / r / w / y 前通常不需要额外鼻音</span><small>lari → <strong>pelari</strong> · rawat → <strong>perawat</strong> · warna → <strong>pewarna</strong></small></div>
                <div><b>单音节 → penge-</b><span>和 menge- 平行</span><small>cat → <strong>pengecat</strong></small></div>
              </div>
            </div>

            <div class="nasalSectionTitle">④ 最值得背的不是整张表，而是这 4 个“镜像对”</div>
            <div class="nasalMirrorGrid">
              <div class="nasalMirrorCard"><div class="rootChip">baca</div><div class="mirrorPair"><span class="meNColor">membaca<small>读</small></span><i>↔</i><span class="peNColor">pembaca<small>读者</small></span></div><button onclick="speakIdText('membaca. pembaca.',this)">🔊 对比听</button></div>
              <div class="nasalMirrorCard"><div class="rootChip">tulis</div><div class="mirrorPair"><span class="meNColor">menulis<small>写</small></span><i>↔</i><span class="peNColor">penulis<small>作者 / 写作者</small></span></div><button onclick="speakIdText('menulis. penulis.',this)">🔊 对比听</button></div>
              <div class="nasalMirrorCard"><div class="rootChip">sapu</div><div class="mirrorPair"><span class="meNColor">menyapu<small>扫</small></span><i>↔</i><span class="peNColor">penyapu<small>扫的人 / 扫具</small></span></div><button onclick="speakIdText('menyapu. penyapu.',this)">🔊 对比听</button></div>
              <div class="nasalMirrorCard"><div class="rootChip">kirim</div><div class="mirrorPair"><span class="meNColor">mengirim<small>发送</small></span><i>↔</i><span class="peNColor">pengirim<small>发送者 / 寄件人</small></span></div><button onclick="speakIdText('mengirim. pengirim.',this)">🔊 对比听</button></div>
            </div>

            <div class="nasalDropBox">
              <div class="nasalDropTitle">⑤ 为什么 P / T / S / K 经常“消失”？</div>
              <p>把它先理解成：前面的鼻音已经占住了相近的发音位置，后面的清辅音再完整发出来会更费动作，所以在常规构词里经常被吸收掉。</p>
              <div class="nasalDropGrid">
                <div><b>P</b><span>pakai</span><i>→</i><strong>memakai / pemakai</strong><small>p 消失，留下 m</small></div>
                <div><b>T</b><span>tulis</span><i>→</i><strong>menulis / penulis</strong><small>t 消失，留下 n</small></div>
                <div><b>S</b><span>sapu</span><i>→</i><strong>menyapu / penyapu</strong><small>s 消失，变 ny</small></div>
                <div><b>K</b><span>kirim</span><i>→</i><strong>mengirim / pengirim</strong><small>k 消失，留下 ng</small></div>
              </div>
              <div class="nasalDropCaveat">记忆口诀：<b>P · T · S · K 常被鼻音“吃掉”</b>。这是最常见规则；外来词、辅音群和部分固定词会有例外，不要把口诀当成百分之百机械公式。</div>
            </div>

            <div class="nasalSummary">
              <div class="nasalSummaryTitle">把整套系统压缩成两句话</div>
              <div class="nasalSummaryGrid">
                <div><span class="meNColor">meN-</span><b>做这个动作</b><small>membaca · menulis · menyapu · mengirim</small></div>
                <div><span class="peNColor">peN-</span><b>做这个动作的人 / 工具</b><small>pembaca · penulis · penyapu · pengirim</small></div>
              </div>
              <p>两者<b>语法功能不同</b>，但<b>鼻音为什么变成 m / n / ny / ng</b>，背后基本是同一套发音位置逻辑。</p>
            </div>

            <div class="nasalQuiz">
              <div class="compareTitle">快速判断：动作还是“人 / 工具”？</div>
              <div class="nasalQuizRow"><span>① “写”</span><div><button data-choice="menulis" onclick="answerNasalQuiz(this,'menulis','menulis')">menulis</button><button data-choice="penulis" onclick="answerNasalQuiz(this,'penulis','menulis')">penulis</button></div><small class="nasalQuizResult"></small></div>
              <div class="nasalQuizRow"><span>② “作者 / 写作者”</span><div><button data-choice="menulis" onclick="answerNasalQuiz(this,'menulis','penulis')">menulis</button><button data-choice="penulis" onclick="answerNasalQuiz(this,'penulis','penulis')">penulis</button></div><small class="nasalQuizResult"></small></div>
              <div class="nasalQuizRow"><span>③ “发送”</span><div><button data-choice="mengirim" onclick="answerNasalQuiz(this,'mengirim','mengirim')">mengirim</button><button data-choice="pengirim" onclick="answerNasalQuiz(this,'pengirim','mengirim')">pengirim</button></div><small class="nasalQuizResult"></small></div>
              <div class="nasalQuizRow"><span>④ “寄件人 / 发送者”</span><div><button data-choice="mengirim" onclick="answerNasalQuiz(this,'mengirim','pengirim')">mengirim</button><button data-choice="pengirim" onclick="answerNasalQuiz(this,'pengirim','pengirim')">pengirim</button></div><small class="nasalQuizResult"></small></div>
            </div>

            <div class="difficultyFormula nasalFormula">
              <span>一句话记忆</span>
              <b>后面的音在哪里发，鼻音就尽量往哪里靠；meN- 负责“做”，peN- 常负责“做的人 / 工具”。</b>
              <small>先理解发音位置，再记变体；这样比死背 mem-/men-/meny-/meng- 与 pem-/pen-/peny-/peng- 两张表更稳。</small>
            </div>
          </article>

          <article id="difficulty06" class="difficultyLesson" style="display:none">
            <button class="difficultyInnerBack" type="button" onclick="showDifficultyList()">← 返回难点列表</button>

            <div class="difficultyWordHero affixHero">
              <div class="difficultyWordTop"><span class="difficultyNo big affixNo">06</span><span class="difficultyType affixType">构词总览 · 前缀 + 后缀</span></div>
              <div class="affixHeroTitle">不要背十张表：先看“这个词根被加工成什么角色”</div>
              <div class="difficultyMemory">印尼语词根像一块积木。<b>前缀常先决定“谁在做 / 处于什么状态 / 以什么方式发生”</b>；<b>后缀再决定动作往哪里去、产生什么结果。</b></div>
              <div class="affixHeroFlow">
                <span>词根<br><b>ROOT</b></span><i>→</i>
                <span>前缀<br><b>谁 / 怎么发生</b></span><i>→</i>
                <span>后缀<br><b>落到哪里 / 变成什么</b></span><i>→</i>
                <span>完整词<br><b>真正意思</b></span>
              </div>
              <div class="affixHeroNote">第 05 个难点解决的是 <b>meN-/peN- 为什么变成 mem-/men-/meny-/meng-</b>；这一页解决的是：<b>看到前后缀时，到底应该先想到什么意义。</b></div>
            </div>

            <div class="affixCorrection">
              <div class="affixCorrectionTitle">先把表格里两个容易误解的地方理顺</div>
              <div>
                <b>keindahan</b><span>不是“ke- 单独 + indah + an”的普通前缀例子，更适合整体看成 <strong>ke-…-an</strong>：indah → keindahan（美丽 → 美 / 美丽这种状态）。</span>
              </div>
              <div>
                <b>membersihkan</b><span>核心后缀是 <strong>-kan</strong>：bersih → membersihkan（使……干净 / 清洁）。它不是一个合适的 <strong>-i</strong> 示例。</span>
              </div>
            </div>

            <div class="affixSectionTitle">① 第一层：先判断“谁在做 / 谁承受”</div>
            <div class="affixRoleGrid">
              <div class="affixRoleCard activeRole">
                <div class="affixRoleTop"><span>meN-</span><b>主动做</b></div>
                <p>主体主动执行一个动作。</p>
                <div class="affixPair"><small>tulis</small><i>→</i><strong>menulis</strong><em>写</em><button onclick="speakIdText('menulis',this)">🔊</button></div>
                <div class="affixPair"><small>baca</small><i>→</i><strong>membaca</strong><em>读</em><button onclick="speakIdText('membaca',this)">🔊</button></div>
                <div class="affixThought">脑内问题：<b>“谁在做这个动作？”</b></div>
              </div>

              <div class="affixRoleCard doerRole">
                <div class="affixRoleTop"><span>peN-</span><b>做的人 / 工具</b></div>
                <p>把动作变成执行者、职业、人物或工具等。</p>
                <div class="affixPair"><small>tulis</small><i>→</i><strong>penulis</strong><em>作者</em><button onclick="speakIdText('penulis',this)">🔊</button></div>
                <div class="affixPair"><small>kirim</small><i>→</i><strong>pengirim</strong><em>寄件人</em><button onclick="speakIdText('pengirim',this)">🔊</button></div>
                <div class="affixThought">脑内问题：<b>“做这件事的是谁 / 什么工具？”</b></div>
              </div>

              <div class="affixRoleCard passiveRole">
                <div class="affixRoleTop"><span>di-</span><b>被做</b></div>
                <p>重点转到承受动作的人或东西。</p>
                <div class="affixPair"><small>buka</small><i>→</i><strong>dibuka</strong><em>被打开</em><button onclick="speakIdText('dibuka',this)">🔊</button></div>
                <div class="affixPair"><small>tulis</small><i>→</i><strong>ditulis</strong><em>被写</em><button onclick="speakIdText('ditulis',this)">🔊</button></div>
                <div class="affixThought">脑内问题：<b>“谁 / 什么东西承受这个动作？”</b></div>
              </div>
            </div>

            <div class="affixDiNote">
              <b>别把两个 di 搞混：</b>
              <span><strong>dibuka</strong> 连写 = 被打开（前缀）；<strong>di rumah</strong> 分开写 = 在家（介词）。</span>
            </div>

            <div class="affixSectionTitle">② 七张统一卡片：看到它，先想到这一句话</div>
            <div class="affixUnifiedGrid">

              <div class="affixUnifiedCard berUnified">
                <div class="affixUnifiedHead"><span class="affixCircle">①</span><div><b>ber-</b><small>活动 / 状态 / 拥有</small></div></div>
                <div class="affixOneLine">主体自己在做，或处于一个和词根有关的状态。</div>
                <div class="affixUnifiedExamples">
                  <span><strong>bermain</strong><small>玩、在玩</small></span>
                  <span><strong>bekerja</strong><small>工作</small></span>
                  <span><strong>berumur</strong><small>有……岁</small></span>
                </div>
                <div class="affixBrain"><b>先想到：</b>“主语自己进入了一个活动 / 状态。”</div>
              </div>

              <div class="affixUnifiedCard terUnified">
                <div class="affixUnifiedHead"><span class="affixCircle">②</span><div><b>ter-</b><small>三个高频分支</small></div></div>
                <div class="affixOneLine">不要固定翻译；先判断它走的是哪一条路。</div>
                <div class="terBranches">
                  <div><span>①</span><strong>terbuka</strong><b>结果状态</b><small>开着、处于打开状态</small></div>
                  <div><span>②</span><strong>tertidur</strong><b>偶然发生</b><small>不知不觉睡着</small></div>
                  <div><span>③</span><strong>terbaik</strong><b>最高级</b><small>最好的</small></div>
                </div>
                <div class="affixBrain"><b>先想到：</b>“这是状态？偶然？还是最……？”</div>
              </div>

              <div class="affixUnifiedCard seUnified">
                <div class="affixUnifiedHead"><span class="affixCircle">③</span><div><b>se-</b><small>一个 / 同样 / 同一程度</small></div></div>
                <div class="affixOneLine">把数量、单位或程度拉到“同一个框”里。</div>
                <div class="affixUnifiedExamples twoCol">
                  <span><strong>seorang</strong><small>一个人</small></span>
                  <span><strong>sehari</strong><small>一天</small></span>
                  <span><strong>sependapat</strong><small>意见一致</small></span>
                  <span><strong>sebesar</strong><small>一样大 / 那么大</small></span>
                </div>
                <div class="affixBrain"><b>先想到：</b>“一个、一样、同一程度。”</div>
              </div>

              <div class="affixUnifiedCard keanUnified">
                <div class="affixUnifiedHead"><span class="affixCircle">④</span><div><b>ke-…-an</b><small>状态 / 概念 / 遭遇</small></div></div>
                <div class="affixOneLine">进入一种状态，或者某种情况“落到主体身上”。</div>
                <div class="affixUnifiedExamples twoCol">
                  <span><strong>keindahan</strong><small>美 / 美丽这种状态</small></span>
                  <span><strong>kesulitan</strong><small>困难、难处</small></span>
                  <span><strong>kehujanan</strong><small>淋雨</small></span>
                  <span><strong>ketahuan</strong><small>结果被发现</small></span>
                </div>
                <div class="affixBrain"><b>先想到：</b>“状态，还是遭遇 / 结果？”</div>
                <button class="affixDeepBtn unifiedDeep" onclick="openDifficulty02()">去看 02：ke-…-an 详细解释 →</button>
              </div>

              <div class="affixUnifiedCard kanUnified">
                <div class="affixUnifiedHead"><span class="affixCircle">⑤</span><div><b>-kan</b><small>把动作往外推</small></div></div>
                <div class="affixOneLine">常有“使……、把……弄到某处、替别人做”的感觉。</div>
                <div class="affixUnifiedExamples">
                  <span><strong>membesarkan</strong><small>使变大 / 养大</small></span>
                  <span><strong>bukakan</strong><small>替某人打开</small></span>
                  <span><strong>memasukkan</strong><small>把某物放进去</small></span>
                </div>
                <div class="affixBrain"><b>先想到：</b>“动作被推出去，造成一个结果。”</div>
              </div>

              <div class="affixUnifiedCard iUnified">
                <div class="affixUnifiedHead"><span class="affixCircle">⑥</span><div><b>-i</b><small>动作落在目标 / 地点</small></div></div>
                <div class="affixOneLine">把地点、对象或接受者当作动作落点。</div>
                <div class="affixUnifiedExamples">
                  <span><strong>memasuki</strong><small>进入某个地方</small></span>
                  <span><strong>mengunjungi</strong><small>拜访某人 / 某地</small></span>
                  <span><strong>mengisi</strong><small>填写 / 填入</small></span>
                </div>
                <div class="affixBrain"><b>先想到：</b>“这个动作落到哪里？”</div>
              </div>

              <div class="affixUnifiedCard anUnified">
                <div class="affixUnifiedHead"><span class="affixCircle">⑦</span><div><b>-an</b><small>名词 / 东西 / 结果</small></div></div>
                <div class="affixOneLine">把动作或状态变成一个可以指称的“东西、结果或集合”。</div>
                <div class="affixUnifiedExamples">
                  <span><strong>makanan</strong><small>食物</small></span>
                  <span><strong>minuman</strong><small>饮料</small></span>
                  <span><strong>tulisan</strong><small>文字 / 写的东西</small></span>
                </div>
                <div class="affixBrain"><b>先想到：</b>“这个动作最后变成了什么东西？”</div>
              </div>

            </div>

            <div class="affixSectionTitle">⑤ 最容易真正看懂的一张图：同一个词根 buka 怎么变</div>
            <div class="affixFactory">
              <div class="affixRoot"><span>词根</span><b>buka</b><small>开</small></div>
              <div class="affixFactoryArrow">→</div>
              <div class="affixFactoryBranches">
                <div class="factoryItem activeRole"><span>meN-</span><b>membuka</b><small>打开（主动做）</small><button onclick="speakIdText('membuka',this)">🔊</button></div>
                <div class="factoryItem doerRole"><span>peN-</span><b>pembuka</b><small>开场者 / 开启物 / 开端</small><button onclick="speakIdText('pembuka',this)">🔊</button></div>
                <div class="factoryItem passiveRole"><span>di-</span><b>dibuka</b><small>被打开</small><button onclick="speakIdText('dibuka',this)">🔊</button></div>
                <div class="factoryItem terMini"><span>ter-</span><b>terbuka</b><small>开着 / 开放的状态</small><button onclick="speakIdText('terbuka',this)">🔊</button></div>
                <div class="factoryItem kanMini"><span>-kan</span><b>bukakan</b><small>替某人打开</small><button onclick="speakIdText('bukakan',this)">🔊</button></div>
              </div>
            </div>

            <div class="affixCompareBox">
              <div class="affixCompareTitle">一个特别值得建立的对比：di- vs ter-</div>
              <div class="affixCompareGrid">
                <div><b>Pintunya dibuka.</b><button onclick="speakIdText('Pintunya dibuka.',this)">🔊</button><span>门被打开了。→ 强调“有人 / 某种力量做了打开这个动作”。</span></div>
                <div><b>Pintunya terbuka.</b><button onclick="speakIdText('Pintunya terbuka.',this)">🔊</button><span>门开着。→ 强调现在处于“打开”的状态。</span></div>
              </div>
            </div>

            <div class="affixKanIBox">
              <div class="affixCompareTitle">-kan vs -i：不要翻译成固定中文，想“方向”</div>
              <div class="affixKanIFlow">
                <div class="kanFlow"><span>memasukkan</span><b>把“东西”推进去</b><small>Dia memasukkan buku ke tas. → 他把书放进包里。</small></div>
                <div class="affixVs">VS</div>
                <div class="iFlow"><span>memasuki</span><b>主体进入“地点”</b><small>Dia memasuki ruangan. → 他进入房间。</small></div>
              </div>
              <div class="affixMiniTip">同一个 <b>masuk</b>，加 -kan 后更像“让别的东西进去”；加 -i 后更像“动作落到这个地点上”。这比死背中文释义更稳。</div>
            </div>

            <div class="affixDecision">
              <div class="affixDecisionTitle">看到一个派生词，按这个顺序判断</div>
              <div class="affixDecisionSteps">
                <div><span>1</span><b>先找词根</b><small>这个词最原始的概念是什么？</small></div>
                <div><span>2</span><b>看前缀</b><small>主动？施事者？被动？状态？</small></div>
                <div><span>3</span><b>再看后缀</b><small>动作推向结果？落在地点？变成名词？</small></div>
                <div><span>4</span><b>最后看语境</b><small>不要把任何前后缀机械翻成唯一中文。</small></div>
              </div>
            </div>

            <div class="affixQuiz">
              <div class="compareTitle">快速判断：你应该先想到哪一种功能？</div>
              <div class="affixQuizRow"><span>① penulis（作者）</span><div><button data-choice="主动做" onclick="answerAffixQuiz(this,'主动做','做的人/工具')">主动做</button><button data-choice="做的人/工具" onclick="answerAffixQuiz(this,'做的人/工具','做的人/工具')">做的人/工具</button><button data-choice="被动" onclick="answerAffixQuiz(this,'被动','做的人/工具')">被动</button></div><small class="affixQuizResult"></small></div>
              <div class="affixQuizRow"><span>② dibuka（被打开）</span><div><button data-choice="主动做" onclick="answerAffixQuiz(this,'主动做','被动')">主动做</button><button data-choice="状态" onclick="answerAffixQuiz(this,'状态','被动')">状态</button><button data-choice="被动" onclick="answerAffixQuiz(this,'被动','被动')">被动</button></div><small class="affixQuizResult"></small></div>
              <div class="affixQuizRow"><span>③ terbuka（开着）</span><div><button data-choice="状态" onclick="answerAffixQuiz(this,'状态','状态')">状态</button><button data-choice="被动" onclick="answerAffixQuiz(this,'被动','状态')">被动</button><button data-choice="人/工具" onclick="answerAffixQuiz(this,'人/工具','状态')">人/工具</button></div><small class="affixQuizResult"></small></div>
              <div class="affixQuizRow"><span>④ makanan（食物）</span><div><button data-choice="名词/结果" onclick="answerAffixQuiz(this,'名词/结果','名词/结果')">名词/结果</button><button data-choice="主动做" onclick="answerAffixQuiz(this,'主动做','名词/结果')">主动做</button><button data-choice="被动" onclick="answerAffixQuiz(this,'被动','名词/结果')">被动</button></div><small class="affixQuizResult"></small></div>
            </div>

            <div class="difficultyFormula affixFormula">
              <span>一句话记忆</span>
              <b>前缀先决定“角色和状态”，后缀再决定“方向和结果”；先找词根，再看前缀，最后看后缀。</b>
              <small>你不需要先把所有规则背完。只要先能判断“主动 / 人或工具 / 被动 / 状态 / 方向 / 名词化”，大部分新词就已经能猜出七八成。</small>
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
        card.classList.remove('homeModVocab','homeModReading','homeModQuick','homeModWeak','homeModAutomation','homeModDifficulty','v2-wide');
        if(title==='词汇学习')card.classList.add('homeModVocab');
        else if(title==='泛读')card.classList.add('homeModReading');
        else if(title==='快速练习')card.classList.add('homeModQuick');
        else if(title==='弱项强化')card.classList.add('homeModWeak');
        else if(title==='自动训练')card.classList.add('homeModAutomation');
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
      #home .homeModAutomation{background:#f8f6ff!important;border-color:#e4def5!important;border-top:3px solid #8d73c9!important}
      #home 
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
      .difficultyIndex{margin:20px 0 2px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}
      .difficultyIndexItem{width:100%;min-width:0;min-height:108px;border:1px solid #dfe7f0;background:#fbfdff;border-radius:15px;padding:15px 42px 15px 15px;display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:center;text-align:left;cursor:pointer;color:#172033;transition:.16s ease;position:relative}
      .difficultyIndexItem:hover{border-color:#9ac5df;background:#f6fbff;transform:translateY(-2px);box-shadow:0 6px 16px rgba(23,32,51,.05)}
      .difficultyIndexText{min-width:0}.difficultyIndexText b{font-size:18px;line-height:1.25}.difficultyIndexItem small{display:block;color:#6b7280;margin-top:5px;font-size:12px;line-height:1.45}
      .difficultyNo{display:inline-flex;align-items:center;justify-content:center;min-width:34px;height:34px;border-radius:10px;background:#e9f5fc;color:#277ba6;font-weight:900;font-size:13px;letter-spacing:.04em}
      .difficultyNo.big{min-width:42px;height:42px;border-radius:12px;font-size:15px}
      .keanNo{background:#f0ebff;color:#6d51a7}
      .difficultyArrow{font-size:20px;color:#7a8ba3;position:absolute;right:15px;top:50%;transform:translateY(-50%)}
      .difficultyInnerBack{border:0;background:transparent;color:#3157d5;font-weight:800;cursor:pointer;padding:4px 0 13px}
      .difficultyWordHero{border-radius:20px;padding:22px;background:linear-gradient(135deg,#f1f8ff,#f8fbff);border:1px solid #dcecf7}
      .difficultyWordHero.keanHero{background:linear-gradient(135deg,#f8f5ff,#fcfbff);border-color:#e6ddf6}
      .difficultyWordTop{display:flex;align-items:center;gap:9px}
      .difficultyType{font-size:12px;font-weight:800;color:#276f97;background:#e8f4fb;border-radius:999px;padding:5px 9px}
      .difficultyType.keanType{color:#6b4fa4;background:#f0eaff}
      .difficultyWordLine{display:flex;align-items:center;gap:10px;margin:12px 0 7px}
      .difficultyWordLine strong{font-size:42px;line-height:1;color:#173f5c;letter-spacing:-.02em}
      .keanHero .difficultyWordLine strong{color:#513c7c}
      .difficultyMemory{font-size:17px;line-height:1.7;color:#3f5265}.difficultyMemory b{color:#173f5c}.keanHero .difficultyMemory b{color:#513c7c}
      .difficultyCore{margin:15px 0;border-left:4px solid #4c9bc7;background:#f6fbff;border-radius:12px;padding:15px 17px}
      .difficultyCoreLabel{font-size:12px;font-weight:850;color:#287ca8;margin-bottom:6px}
      .difficultyCoreId{font-size:18px;font-weight:850;line-height:1.55;color:#173f5c}.difficultyCoreCn{font-size:14px;color:#667085;margin-top:5px}

      .triExplain{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:15px 0}
      .triExplainRow{border:1px solid #e2e7ef;border-radius:14px;padding:14px;background:#fff;display:flex;gap:10px;align-items:flex-start;min-width:0}
      .triExplainRow b{font-size:13px}.triExplainRow p{font-size:12px;line-height:1.65;color:#5f6c7d;margin:5px 0 0}.triExplainRow strong{color:#38465a}
      .langBadge{width:31px;height:31px;flex:0 0 31px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:900}
      .cnBadge{background:#fff2e7;color:#a55a1d}.enBadge{background:#edf4ff;color:#3967a7}.idBadge{background:#edf9f1;color:#277447}

      .timeWindowDiagram{display:grid;grid-template-columns:1fr 36px 1.35fr 36px 1fr;align-items:center;margin:20px 0 0;padding:15px;border:1px dashed #ced9e5;border-radius:16px;background:#fcfdff}
      .timeNode{text-align:center;border-radius:13px;padding:12px 8px;border:1px solid #e4e9f0;background:#fff}.timeNode span{display:block;font-weight:850;font-size:14px}.timeNode small{display:block;color:#7b8796;font-size:11px;margin-top:4px;line-height:1.35}
      .mutedNode{opacity:.72}.windowNode{border-color:#9ed0eb;background:#eef9ff;color:#226f99}.happenNode{border-color:#a8d9b6;background:#f1fbf4;color:#24743d}
      .timeLine{height:2px;background:#d8e0e8;position:relative}.timeLine:after{content:'›';position:absolute;right:-3px;top:50%;transform:translateY(-56%);font-size:22px;color:#a4b0bf}.activeLine{background:#8fc7a0}.activeLine:after{color:#5aaf73}

      .keanFlow{display:grid;grid-template-columns:1fr 42px 1.2fr 42px 1.25fr;align-items:center;margin:18px 0 0;padding:15px;border:1px dashed #d8cee9;border-radius:16px;background:#fdfcff}
      .keanFlowNode{text-align:center;border-radius:13px;padding:12px 8px;border:1px solid #e5dfef;background:#fff}.keanFlowNode span{display:block;font-weight:850;font-size:14px}.keanFlowNode small{display:block;color:#7b7390;font-size:11px;margin-top:4px}
      .rootNode{color:#5e6a7b}.affixNode{background:#f4efff;color:#684da0;border-color:#d8c8f2}.resultNode{background:#f6faf7;color:#37754d;border-color:#cfe3d5}.keanFlowArrow{text-align:center;color:#9b8db5;font-size:23px;font-weight:800}

      .senseBridge{display:flex;flex-direction:column;align-items:center;margin:0 4% 3px;position:relative;color:#64748b}
      .senseBridgeStem{width:2px;height:20px;background:#b8c8d8}
      .senseBridgeLabel{font-size:12px;line-height:1.3;background:#fff;padding:3px 10px;border:1px solid #dbe5ee;border-radius:999px;position:relative;z-index:2}
      .senseBridgeLabel b{color:#277ba6}.keanBridge .senseBridgeLabel b{color:#6b4fa4}.keanBridge .senseBridgeStem,.keanBridge .senseBridgeFork:before,.keanBridge .senseBridgeFork span{background:#c5b8dc}
      .senseBridgeFork{width:100%;height:22px;display:grid;grid-template-columns:repeat(3,1fr);position:relative;margin-top:1px}
      .senseBridgeFork:before{content:'';position:absolute;left:16.666%;right:16.666%;top:6px;height:2px;background:#b8c8d8}
      .senseBridgeFork span{justify-self:center;width:2px;height:16px;background:#b8c8d8;margin-top:6px}

      .difficultyThree{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:0 0 16px}.senseCard{border:1px solid #e2e7ef;border-radius:17px;padding:16px;background:#fff;min-width:0}.senseCard h3{font-size:16px;margin:7px 0}.senseIcon{font-size:22px}.senseEn{font-size:12px;font-weight:800;color:#667085;margin-bottom:12px}.exampleId{font-size:15px;font-weight:800;line-height:1.55;color:#243246}.exampleCn{font-size:13px;color:#596579;margin-top:4px}.senseTip{font-size:12px;line-height:1.55;color:#6b7280;margin-top:11px;padding-top:10px;border-top:1px solid rgba(0,0,0,.06)}
      .senseBlue{background:#f8fbff;border-color:#d9e9f7}.sensePurple{background:#fbf9ff;border-color:#e5ddf3}.senseRed{background:#fff9f8;border-color:#f0dfdc}
      .wordFamily{display:grid;grid-template-columns:auto auto 1fr;gap:5px 7px;align-items:center;padding:8px 0;border-top:1px solid rgba(0,0,0,.055);font-size:12px}.wordFamily:first-of-type{border-top:0}.wordFamily>b{color:#667085}.wordFamily>span{color:#98a2b3}.wordFamily>strong{font-size:14px;color:#27364a}.wordFamily>small{grid-column:1/-1;color:#687588;line-height:1.4}.audioFamily{grid-template-columns:auto auto 1fr auto}
      .miniSound,.difficultyWordLine .sound{appearance:none;border:1px solid #dbe4ed;background:#fff;border-radius:8px;min-width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;padding:0 7px;cursor:pointer;vertical-align:middle;line-height:1;transition:.15s ease}
      .miniSound{margin-left:5px;font-size:14px}.miniSound:hover,.difficultyWordLine .sound:hover{background:#f1f8ff;border-color:#a8cde3}.miniSound.isSpeaking,.difficultyWordLine .sound.isSpeaking{background:#e9f6ff;border-color:#78b7dc;box-shadow:0 0 0 2px rgba(120,183,220,.15)}
      .miniSound:disabled,.difficultyWordLine .sound:disabled{cursor:default;opacity:.75}

      .keanBigRule{border:1px solid #dcd4e9;border-radius:17px;background:#faf8ff;padding:17px;margin:18px 0}.keanBigRuleTitle{font-size:17px;font-weight:900;color:#513c7c}.keanBigRuleFlow{display:flex;align-items:center;justify-content:center;gap:12px;margin:14px 0;padding:11px;border-radius:12px;background:#fff}.keanBigRuleFlow span{background:#f1ecfa;border-radius:9px;padding:7px 11px;font-weight:850;color:#5f497f}.keanBigRuleFlow b{font-size:13px;color:#6e6280}.keanBigRule p{font-size:13px;color:#5e6675;line-height:1.7;margin:0}
      .compareBlock{margin-top:22px}.compareTitle{font-size:18px;font-weight:900;margin-bottom:11px}.compareGrid{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:stretch}.compareVs{align-self:center;font-size:12px;font-weight:900;color:#8a94a3;background:#eef1f5;border-radius:999px;padding:7px}.compareCard{border:1px solid #e0e6ee;border-radius:17px;padding:17px}.pernahCard{background:#fafafa}.sempatCard{background:#f4faff;border-color:#cfe6f5}.keanCompareCard{background:#faf8ff;border-color:#e1d8ef}.compareWord{font-size:24px;font-weight:900}.compareQuestion{font-size:13px;line-height:1.55;margin:7px 0}.compareEn{font-size:12px;color:#728096}.compareExample{font-size:14px;font-weight:800;margin-top:13px}.compareCn{font-size:12px;color:#667085;line-height:1.55;margin-top:5px}
      .exampleStrip{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:18px}.exampleStrip>div{border:1px solid #e1e6ed;border-radius:13px;padding:12px;background:#fff}.exampleStrip b{font-size:14px;color:#27364a}.exampleStrip span{display:block;color:#667085;font-size:12px;margin-top:5px;line-height:1.5}
      .difficultyFormula{margin-top:18px;border-radius:16px;padding:16px 18px;background:#173f5c;color:#fff;display:flex;flex-direction:column;gap:5px}.difficultyFormula span{font-size:12px;opacity:.78}.difficultyFormula b{font-size:18px;line-height:1.55}.difficultyFormula small{opacity:.78;line-height:1.5}.keanFormula{background:#513c7c}

      .dpNo{background:#fff0df;color:#a45d13}
      .difficultyWordHero.dpHero{background:linear-gradient(135deg,#fff8ee,#fffdf8);border-color:#f1dec5}
      .dpType{color:#9a5b1c!important;background:#fff0dc!important}
      .dpWordPair{display:flex;align-items:center;gap:14px;margin:14px 0 8px}.dpWordPair strong{font-size:42px;line-height:1}.dpWordPair>span{color:#9aa4b2;font-size:22px}.dpDapat{color:#2d67a5}.dpPadat{color:#9a5b1c}
      .dpSoundRow{display:flex;gap:8px;flex-wrap:wrap;margin-top:13px}.dpSoundButton{border:1px solid #e2d8ca;background:#fff;border-radius:10px;padding:8px 11px;font-weight:800;color:#4c5969;cursor:pointer}.dpSoundButton:hover{background:#fff8ee;border-color:#d8b98f}.dpSoundButton.compare{color:#8c551d;background:#fffaf2}
      .dpPronounce{display:grid;grid-template-columns:1fr auto 1fr;gap:14px;align-items:center;margin:15px 0;padding:15px;border:1px dashed #dfd6ca;border-radius:16px;background:#fffdf9}.dpPronounce>div{text-align:center}.dpPronounce b{font-size:25px;letter-spacing:.04em}.dpPronounce small{display:block;color:#6d7786;font-size:12px;margin-top:5px}.dpSyllableHot{color:#2d67a5;background:#edf5ff;border-radius:7px;padding:2px 6px}.dpSyllableHot.alt{color:#9a5b1c;background:#fff0df}.dpSwap{font-size:21px;color:#9aa4b2}
      .dpCoreGrid{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:stretch;margin:16px 0}.dpCoreCard{border:1px solid #e0e6ee;border-radius:18px;padding:18px;background:#fff}.dpCoreCard h3{font-size:27px;margin:5px 0}.dpCoreIcon{font-size:25px}.dpCoreBig{font-size:13px;font-weight:900;letter-spacing:.08em;color:#667085}.dpCoreCn{font-size:14px;line-height:1.65;color:#4e5b6d}.dapatCard{background:#f6faff;border-color:#d6e6f7}.dapatCard h3{color:#2d67a5}.padatCard{background:#fffaf4;border-color:#efdfca}.padatCard h3{color:#9a5b1c}.dpCoreVs{align-self:center;font-size:12px;font-weight:900;color:#8b95a5;background:#eef1f5;border-radius:999px;padding:7px}.dpLang{margin-top:7px;font-size:12px;color:#667085}.dpLang span{display:inline-flex;min-width:27px;justify-content:center;margin-right:6px;border-radius:6px;padding:2px 5px;background:#fff;font-weight:900;color:#475467}
      .dpBridge{border:1px solid #dbe5f1;border-radius:16px;background:#f9fbff;padding:16px;margin:18px 0}.dpBridgeTitle{font-size:17px;font-weight:900;color:#2d5e93}.dpBridgeFlow{display:flex;gap:9px;align-items:center;justify-content:center;margin:13px 0;flex-wrap:wrap}.dpBridgeFlow span{background:#fff;border:1px solid #d8e4f0;border-radius:9px;padding:7px 10px;font-size:12px;font-weight:800}.dpBridgeFlow b{color:#7793b0}.dpBridge p{margin:0;color:#5f6c7d;font-size:13px;line-height:1.65}.dpSpeechNote{margin-top:12px;padding:10px 11px;border-radius:10px;background:#eef6ff;border:1px solid #d5e5f5;font-size:12px;line-height:1.6;color:#52647a}.dpSpeechNote b{color:#2d67a5}.dpSpeechNote strong{color:#263c55}
      .dpSentencePairs{display:grid;gap:9px}.dpPairRow{display:grid;grid-template-columns:1fr 1fr;gap:9px}.dpSentence{border:1px solid #e1e6ed;border-radius:14px;padding:13px;min-width:0}.dpSentence b{font-size:14px}.dpSentence>span,.dpSentence>small{display:block;margin-top:5px;color:#667085;line-height:1.45}.dpSentence>small{font-size:11px;color:#8791a0}.dapatTint{background:#f7fbff;border-color:#dceaf7}.padatTint{background:#fffaf5;border-color:#eee0cf}
      .dpFamilyGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0}.dpFamilyCard{border:1px solid #e0e6ee;border-radius:18px;padding:16px;background:#fff}.dapatFamily{background:#f8fbff;border-color:#dce9f5}.padatFamily{background:#fffaf5;border-color:#eee0cf}.dpFamilyHead{display:flex;gap:9px;align-items:center;margin-bottom:5px}.dpFamilyHead>span{font-size:24px}.dpFamilyHead h3{margin:0;font-size:19px}.dpFamilyHead small{color:#7b8795}.dpFamilyNote{margin-top:10px;padding:10px 11px;border-radius:11px;background:#fff;border:1px solid #d9e7f4;font-size:12px;line-height:1.55;color:#5d6b7c}.dpFamilyNote b{color:#2d67a5}.dpFamilyNote strong{color:#24364c}.dpCollocations{border-top:1px solid rgba(0,0,0,.06);margin-top:8px;padding-top:10px;display:flex;gap:6px;flex-wrap:wrap}.dpCollocations b{width:100%;font-size:12px;color:#7b5b34}.dpCollocations span{background:#fff;border:1px solid #eadbc8;border-radius:999px;padding:5px 8px;font-size:11px;color:#68543d}
      .dpQuickRule{display:grid;grid-template-columns:1fr auto 1fr;gap:14px;align-items:stretch;border-radius:17px;padding:16px;background:#27364a;color:#fff;margin-top:18px}.dpQuickRule>div:not(.dpRuleDivider){display:grid;grid-template-columns:auto 1fr;gap:4px 9px;align-items:center}.dpQuickRule span{font-size:22px;grid-row:1/3}.dpQuickRule b{font-size:13px}.dpQuickRule strong{font-size:18px}.dpQuickRule>div:first-child strong{color:#9dcbff}.dpQuickRule>div:last-child strong{color:#ffd29e}.dpRuleDivider{width:1px;background:rgba(255,255,255,.2)}
      .dpQuiz{margin-top:22px}.dpQuizRow{display:grid;grid-template-columns:1fr auto minmax(95px,auto);gap:10px;align-items:center;border-top:1px solid #e8ebf0;padding:10px 0}.dpQuizRow:first-of-type{border-top:0}.dpQuizRow>span{font-size:13px;font-weight:750}.dpQuizRow>div{display:flex;gap:6px}.dpQuizRow button{border:1px solid #dfe4eb;background:#fff;border-radius:9px;padding:7px 10px;cursor:pointer}.dpQuizRow button:hover{background:#f7f9fc}.dpQuizRow button.dpQuizOk{background:#edf9f0;border-color:#76bd87;color:#17652d}.dpQuizRow button.dpQuizBad{background:#fff0ef;border-color:#dd8b84;color:#9d2f28}.dpQuizRow button:disabled{cursor:default}.dpQuizResult{font-size:11px;color:#657386}
      .dpFormula{background:linear-gradient(135deg,#244d77,#80511f)}

      .simNo{background:#e9f8ef;color:#2e7d4a}
      .difficultyWordHero.simHero{background:linear-gradient(135deg,#f3fbf6,#fbfefc);border-color:#d6ebdd}
      .simType{color:#2f7b4a!important;background:#e9f7ee!important}
      .simHeroTitle{font-size:28px;font-weight:900;color:#284f37;margin:14px 0 8px;line-height:1.25}
      .simMethod{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:15px}.simMethod>div{background:#fff;border:1px solid #dcebe1;border-radius:12px;padding:11px;display:grid;grid-template-columns:auto 1fr;gap:2px 8px;align-items:center}.simMethod span{grid-row:1/3;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#e7f5ec;color:#277245;font-weight:900}.simMethod b{font-size:12px;color:#334b3c}.simMethod small{font-size:11px;color:#758177}.simAlready{margin-top:11px;font-size:12px;color:#6d7a70}
      .simSectionTitle{font-size:18px;font-weight:900;color:#2f3e35;margin:22px 0 10px}
      .simGroups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.simGroup{border:1px solid #e0e7e2;border-radius:17px;background:#fff;padding:15px;min-width:0}.simWide{background:#fbfefc}
      .simGroupHead{display:flex;align-items:flex-start;justify-content:space-between;gap:9px;margin-bottom:10px}.simGroupHead>div b{display:block;font-size:16px;color:#263b2e}.simGroupHead>div small{display:block;font-size:11px;color:#78857c;margin-top:3px}
      .simListen,.simWord button{border:1px solid #dce7df;background:#fff;border-radius:8px;cursor:pointer;color:#41624e}.simListen{padding:6px 8px;font-size:11px;white-space:nowrap}.simListen:hover,.simWord button:hover{background:#eff8f2}
      .simNgRule{display:grid;grid-template-columns:auto auto auto 1fr;gap:8px;align-items:center;margin-bottom:12px;padding:10px;background:#f3faf5;border-radius:12px}.simNgRule>span{min-width:55px;text-align:center;background:#fff;border:1px solid #d9e9de;border-radius:9px;padding:6px}.simNgRule>span b{display:block;font-size:15px;color:#2b7144}.simNgRule>span small{font-size:10px;color:#7a887f}.simNgRule p{margin:0;font-size:12px;line-height:1.55;color:#5f6d63}
      .simWordGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.simWord{position:relative;border:1px solid #e4e9e5;border-radius:12px;padding:11px;background:#fff;min-width:0}.simWord button{position:absolute;right:7px;top:7px;width:28px;height:28px}.simWord strong{display:block;font-size:16px;color:#26372c;padding-right:30px}.simWord strong span{color:#2d8a52;background:#e9f8ef;border-radius:4px;padding:0 2px}.simWord>b{display:block;font-size:13px;margin-top:7px;color:#344b3c}.simWord small{display:block;font-size:10px;color:#7c8780;margin-top:3px;line-height:1.35}
      .simPattern{display:flex;gap:7px;flex-wrap:wrap;margin:8px 0 10px}.simPattern span{background:#f5f8f6;border:1px solid #e1e7e3;border-radius:8px;padding:6px 9px;font-size:14px;font-weight:800}.simPattern strong{color:#27804a;background:#e6f5eb;padding:0 2px;border-radius:3px}.swapPattern strong{color:#7a5a23;background:#fff3d7}
      .simMiniRows{display:grid;gap:5px}.simMiniRows>div{display:grid;grid-template-columns:minmax(72px,.8fr) 1.2fr auto;gap:7px;align-items:center;padding:6px 0;border-top:1px solid #eef1ef}.simMiniRows>div:first-child{border-top:0}.simMiniRows b{font-size:13px;color:#2d3e33}.simMiniRows span{font-size:12px;color:#45574b}.simMiniRows small{font-size:10px;color:#8a948d}
      .simCue{margin-top:10px;padding:9px 10px;border-radius:10px;background:#f7faf8;font-size:11px;line-height:1.55;color:#657269}.simCue b{color:#2f6e45}.simCue strong{color:#263e30}
      .simRuleBox{margin-top:20px;border:1px solid #d6e6db;border-radius:17px;background:#f7fcf9;padding:16px}.simRuleTitle{font-size:17px;font-weight:900;color:#2c6540;margin-bottom:10px}.simRuleGrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.simRuleGrid>div{background:#fff;border:1px solid #e0ebe3;border-radius:10px;padding:10px;font-size:12px;line-height:1.5}.simRuleGrid b{color:#2f7046}.simRuleGrid span{color:#5f6d64}
      .simQuiz{margin-top:22px}.simQuizRow{display:grid;grid-template-columns:1fr auto minmax(90px,auto);gap:10px;align-items:center;border-top:1px solid #e8ece9;padding:10px 0}.simQuizRow:first-of-type{border-top:0}.simQuizRow>span{font-size:13px;font-weight:750}.simQuizRow>div{display:flex;gap:6px;flex-wrap:wrap}.simQuizRow button{border:1px solid #dfe6e1;background:#fff;border-radius:9px;padding:7px 10px;cursor:pointer}.simQuizRow button:hover{background:#f6faf7}.simQuizRow button.simQuizOk{background:#edf9f0;border-color:#76bd87;color:#17652d}.simQuizRow button.simQuizBad{background:#fff0ef;border-color:#dd8b84;color:#9d2f28}.simQuizRow button:disabled{cursor:default}.simQuizResult{font-size:11px;color:#657386}.simFormula{background:linear-gradient(135deg,#24543a,#496f5a)}

      .nasalNo{background:#eaf3ff;color:#315f9b}
      .difficultyWordHero.nasalHero{background:linear-gradient(135deg,#f1f7ff,#fff8f1);border-color:#d9e5f4}
      .nasalType{color:#395f92!important;background:#e7f0fc!important}.nasalHeroTitle{font-size:34px;font-weight:950;color:#1f334d;margin:16px 0 10px;line-height:1.18;letter-spacing:-.02em}
      .meNColor{color:#2f6fb2!important}.peNColor{color:#b66b28!important}
      .nasalHeroRule{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:17px}.nasalHeroRule span{background:#fff;border:1.5px solid #c7d5e4;border-radius:999px;padding:10px 14px;font-size:15px;font-weight:950;color:#203951;box-shadow:0 1px 3px rgba(35,52,75,.05)}.nasalHeroRule i{font-style:normal;color:#7e8da0;font-weight:900}.nasalHeroNote{margin-top:14px;font-size:15px;line-height:1.75;color:#334a63;font-weight:650}
      .nasalSectionTitle{font-size:22px;font-weight:950;color:#20344d;margin:27px 0 12px;letter-spacing:-.01em}
      .nasalMouthCard{border:1px solid #dfe6ef;border-radius:18px;background:#fff;padding:16px;overflow:hidden}.nasalMapIntro{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.nasalMapIntro b{font-size:20px;color:#1d3148;font-weight:950}.nasalMapIntro span{font-size:14px;color:#40536b;font-weight:650}.nasalMouthSvg{width:100%;height:auto;display:block;margin-top:6px}.nasalSvgMain{font-size:30px;font-weight:950;fill:#172d46}.nasalSvgSub{font-size:15px;font-weight:800;fill:#354a61}.nasalSvgPair{font-size:16px;font-weight:950;fill:#243f60}.nasalMapBottom{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.nasalMapBottom>div{border:1px solid #e3e8ee;border-radius:11px;background:#fafcff;padding:9px}.nasalMapBottom b{display:block;font-size:16px;color:#1c334d;font-weight:950}.nasalMapBottom span{display:block;font-size:14px;color:#3f536a;margin-top:5px;line-height:1.55;font-weight:650}
      .nasalPrefixPanel{border:1.5px solid #d7e1eb;border-radius:20px;padding:20px;background:#fff}.meNPanel{background:#f6faff;border-color:#c9dff5}.peNPanel{background:#fff8f1;border-color:#ead2b5}.nasalPanelHead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:13px}.nasalPanelHead>div{display:grid;grid-template-columns:auto 1fr;gap:2px 9px;align-items:center}.nasalPanelBadge{grid-row:1/3;display:flex;align-items:center;justify-content:center;min-width:64px;height:48px;border-radius:12px;background:#fff;font-size:19px;font-weight:950}.meNPanel .nasalPanelBadge{color:#2f6fb2;border:1px solid #cfe0f4}.peNPanel .nasalPanelBadge{color:#b66b28;border:1px solid #ead5bd}.nasalPanelHead h3{margin:0;font-size:24px;color:#1d3148;font-weight:950}.nasalPanelHead small{color:#40536b;font-size:15px;font-weight:650}.nasalListenAll{border:1.5px solid #cbd8e5;background:#fff;border-radius:10px;padding:10px 13px;font-size:14px;font-weight:900;color:#29415d;cursor:pointer;white-space:nowrap}
      .nasalRuleGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.nasalRuleCard{border:1.5px solid #d8e2ec;border-radius:16px;padding:16px;background:#fff;min-width:0;box-shadow:0 2px 8px rgba(34,53,75,.035)}.nasalRuleTop{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px}.nasalRuleTop b{font-size:20px;color:#172b42;font-weight:950;letter-spacing:-.01em;white-space:nowrap}.nasalRuleTop span{font-size:13px;border-radius:999px;padding:5px 10px;background:#e8eef5;color:#3e536b;font-weight:900;white-space:nowrap;line-height:1.2}.nasalRuleCard p{font-size:15px;color:#334a63;line-height:1.7;min-height:50px;font-weight:650}.mZone{border-top:6px solid #2f73bd;background:#f1f7ff}.nZone{border-top:6px solid #2f8d51;background:#f1faf4}.nyZone{border-top:6px solid #bc7d14;background:#fff7e8}.ngZone{border-top:6px solid #6d4ca8;background:#f7f2ff}.nasalExample{display:grid;grid-template-columns:max-content 18px max-content 30px;column-gap:8px;align-items:center;justify-content:start;padding:12px 0;border-top:1px solid #dce4ec;font-size:15px;min-width:0}.nasalExample:first-of-type{border-top:0}.nasalExample span{color:#314861;font-weight:800;white-space:nowrap}.nasalExample i{font-style:normal;color:#6d7f92;font-weight:950;font-size:17px;text-align:center}.nasalExample b{font-size:16px;color:#152b43;font-weight:950;white-space:nowrap}.nasalExample button{position:static;transform:none;border:1.5px solid #cfd9e4;background:#fff;border-radius:8px;cursor:pointer;font-size:11px;padding:0;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box}.nasalMirrorCard>button{border:1.5px solid #cfd9e4;background:#fff;border-radius:9px;cursor:pointer;font-size:12px;padding:6px 8px}
      .nasalSpecialRow{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}.nasalSpecialRow>div{background:#fff;border:1.5px dashed #cfdbe8;border-radius:14px;padding:14px}.nasalSpecialRow b{font-size:17px;color:#21364e;font-weight:950}.nasalSpecialRow span{display:block;font-size:14px;color:#40536b;margin-top:5px;font-weight:650}.nasalSpecialRow small{display:block;font-size:15px;color:#263c54;margin-top:8px;line-height:1.65}.nasalSurfaceNote{margin-top:14px;padding:14px 16px;border-radius:13px;background:#fff;border:1.5px solid #cfdce9;font-size:15px;line-height:1.7;color:#2f435b;font-weight:650}.nasalSurfaceNote b{color:#1f5b9b;font-weight:950}
      .nasalMirrorGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.nasalMirrorCard{border:1px solid #e0e6ed;border-radius:15px;background:#fff;padding:12px;text-align:center}.rootChip{display:inline-block;border-radius:999px;background:#f1f4f8;color:#536174;padding:4px 8px;font-size:11px;font-weight:800}.mirrorPair{display:grid;grid-template-columns:1fr auto 1fr;gap:6px;align-items:center;margin:11px 0}.mirrorPair>span{font-size:15px;font-weight:950}.mirrorPair>span small{display:block;font-size:11px;font-weight:700;color:#667587;margin-top:4px}.mirrorPair i{font-style:normal;color:#8794a3;font-weight:900}
      .nasalDropBox{margin-top:20px;border:1px solid #eadcc9;border-radius:17px;background:#fffaf4;padding:16px}.nasalDropTitle{font-size:20px;font-weight:950;color:#7a4517}.nasalDropBox>p{font-size:14px;line-height:1.7;color:#5f564d}.nasalDropGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.nasalDropGrid>div{border:1px solid #eadfce;background:#fff;border-radius:12px;padding:10px;display:grid;grid-template-columns:auto 1fr;gap:3px 7px;align-items:center}.nasalDropGrid b{grid-row:1/4;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#fff0dc;color:#a96523}.nasalDropGrid span{font-size:13px;color:#5d554d;font-weight:700}.nasalDropGrid i{display:none}.nasalDropGrid strong{font-size:13px;color:#304154}.nasalDropGrid small{font-size:11px;color:#7f7468}.nasalDropCaveat{margin-top:12px;font-size:13px;line-height:1.65;color:#655d55}
      .nasalSummary{margin-top:20px;border:1px solid #dce5ee;border-radius:17px;background:#f9fbfd;padding:16px}.nasalSummaryTitle{font-size:20px;font-weight:950;color:#263c56}.nasalSummaryGrid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:10px 0}.nasalSummaryGrid>div{background:#fff;border:1px solid #e0e6ec;border-radius:12px;padding:11px;display:grid;grid-template-columns:auto 1fr;gap:2px 10px;align-items:center}.nasalSummaryGrid span{grid-row:1/3;font-size:18px;font-weight:900}.nasalSummaryGrid b{font-size:15px;color:#25384d}.nasalSummaryGrid small{font-size:12px;color:#667587}.nasalSummary p{margin:0;font-size:14px;color:#53657a;line-height:1.7}
      .nasalQuiz{margin-top:22px}.nasalQuizRow{display:grid;grid-template-columns:1fr auto minmax(90px,auto);gap:10px;align-items:center;border-top:1px solid #e7ebef;padding:10px 0}.nasalQuizRow:first-of-type{border-top:0}.nasalQuizRow>span{font-size:15px;font-weight:850;color:#2d4058}.nasalQuizRow>div{display:flex;gap:6px;flex-wrap:wrap}.nasalQuizRow button{border:1.5px solid #d8e1ea;background:#fff;border-radius:10px;padding:9px 12px;font-size:13px;font-weight:800;color:#354a63;cursor:pointer}.nasalQuizRow button.nasalQuizOk{background:#edf9f0;border-color:#76bd87;color:#17652d}.nasalQuizRow button.nasalQuizBad{background:#fff0ef;border-color:#dd8b84;color:#9d2f28}.nasalQuizRow button:disabled{cursor:default}.nasalQuizResult{font-size:11px;color:#657386}.nasalFormula{background:linear-gradient(135deg,#2c5d91,#9a5f29)}

      .affixNo{background:#eaf8f6;color:#277a72}.difficultyWordHero.affixHero{background:linear-gradient(135deg,#f0fbf9,#f7f6ff);border-color:#d4ebe7}.affixType{color:#26756d!important;background:#e4f6f2!important}.affixHeroTitle{font-size:32px;font-weight:950;line-height:1.2;color:#193c42;margin:15px 0 9px;letter-spacing:-.02em}
      .affixHeroFlow{display:grid;grid-template-columns:1fr auto 1.2fr auto 1.2fr auto 1fr;gap:8px;align-items:center;margin-top:16px}.affixHeroFlow span{background:#fff;border:1.5px solid #d3e5e4;border-radius:13px;padding:11px;text-align:center;font-size:12px;color:#52646b}.affixHeroFlow b{font-size:14px;color:#25464c}.affixHeroFlow i{font-style:normal;color:#82969a;font-weight:900}.affixHeroNote{margin-top:12px;font-size:14px;line-height:1.7;color:#476068}
      .affixCorrection{margin-top:18px;border:1.5px solid #ead7b7;background:#fffaf1;border-radius:17px;padding:16px}.affixCorrectionTitle{font-size:18px;font-weight:950;color:#7a4c12;margin-bottom:9px}.affixCorrection>div:not(.affixCorrectionTitle){display:grid;grid-template-columns:130px 1fr;gap:10px;padding:8px 0;border-top:1px solid #efe2cf}.affixCorrection>div:nth-child(2){border-top:0}.affixCorrection b{font-size:15px;color:#825016}.affixCorrection span{font-size:14px;color:#554d44;line-height:1.65}.affixCorrection strong{color:#2c4e6a}
      .affixSectionTitle{font-size:22px;font-weight:950;color:#203d48;margin:26px 0 11px}
      .affixRoleGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.affixRoleCard{border:1.5px solid #dce5e8;border-radius:17px;padding:16px;background:#fff;min-width:0}.activeRole{border-top:6px solid #367cc3;background:#f5f9ff}.doerRole{border-top:6px solid #d18737;background:#fff9f2}.passiveRole{border-top:6px solid #b75959;background:#fff7f7}.affixRoleTop{display:flex;align-items:center;justify-content:space-between;gap:8px}.affixRoleTop span{font-size:20px;font-weight:950;color:#263e54}.affixRoleTop b{font-size:14px;color:#516478}.affixRoleCard p{font-size:14px;color:#465a6c;line-height:1.65}.affixPair{display:grid;grid-template-columns:.8fr auto 1.1fr auto auto;gap:7px;align-items:center;padding:9px 0;border-top:1px solid #dfe6eb}.affixPair small{font-size:13px;color:#52677a;font-weight:750}.affixPair i{font-style:normal;color:#8291a0}.affixPair strong{font-size:16px;color:#17324b}.affixPair em{font-style:normal;font-size:12px;color:#647789}.affixPair button,.factoryItem button,.affixCompareGrid button{border:1.5px solid #d6e0e6;background:#fff;border-radius:8px;padding:5px 7px;cursor:pointer}.affixThought{margin-top:10px;border-radius:10px;background:rgba(255,255,255,.82);padding:9px;font-size:12px;color:#506273;line-height:1.5}.affixThought b{color:#243d54}
      .affixDiNote{margin-top:11px;padding:12px 14px;border-radius:12px;background:#fff4f4;border:1px solid #efd1d1;font-size:14px;line-height:1.6;color:#5c4949}.affixDiNote b{color:#9e3f3f}.affixDiNote strong{color:#733333}
      .affixStateGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.affixStateCard{border:1.5px solid #dce6e2;border-radius:17px;padding:16px;background:#fff}.berCard{background:#f4fbf7;border-top:6px solid #4c9b69}.terCard{background:#f8f5ff;border-top:6px solid #7558b1}.affixStateHead{display:flex;justify-content:space-between;gap:10px;align-items:center}.affixStateHead span{font-size:21px;font-weight:950;color:#273d50}.affixStateHead b{font-size:14px;color:#506276}.affixStateCard p{font-size:14px;line-height:1.65;color:#485c6d}.affixExamples{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.affixExamples span{background:#fff;border:1px solid #dfe7e4;border-radius:10px;padding:9px;text-align:center}.affixExamples b{display:block;font-size:15px;color:#233b4f}.affixExamples small{display:block;font-size:11px;color:#687989;margin-top:3px}.affixMiniTip{margin-top:10px;font-size:12px;line-height:1.55;color:#586b7b;background:rgba(255,255,255,.8);border-radius:9px;padding:9px}
      .affixRelationGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.affixRelationCard{border:1.5px solid #dce6e7;border-radius:17px;padding:16px;background:#fff}.seCard{background:#f3fbfc;border-top:6px solid #3a929b}.keanCard{background:#faf6ff;border-top:6px solid #835db5}.affixRelationHead{display:flex;justify-content:space-between;gap:10px}.affixRelationHead span{font-size:21px;font-weight:950;color:#233f50}.affixRelationHead b{font-size:14px;color:#576a7b}.affixRelExamples{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:11px}.affixRelExamples>div{border:1px solid #e0e7e8;border-radius:10px;background:#fff;padding:9px}.affixRelExamples strong{display:block;font-size:15px;color:#2b4050}.affixRelExamples span{font-size:11px;color:#6d7c87}.affixDeepBtn{margin-top:10px;border:1px solid #d9cceb;background:#fff;border-radius:9px;padding:8px 10px;color:#684692;font-weight:850;cursor:pointer}
      .affixSuffixGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.affixSuffixCard{border:1.5px solid #dfe5ea;border-radius:17px;padding:16px;background:#fff}.kanCard{background:#fff8f1;border-top:6px solid #d37b30}.iCard{background:#f3f9ff;border-top:6px solid #3d7fb8}.anCard{background:#f7f8fa;border-top:6px solid #68768a}.affixSuffixHead{display:flex;justify-content:space-between;gap:10px;align-items:center}.affixSuffixHead span{font-size:22px;font-weight:950;color:#233a4e}.affixSuffixHead b{font-size:14px;color:#546777}.affixSuffixCard p{font-size:14px;line-height:1.65;color:#475b6d;min-height:48px}.affixSuffixExample{padding:8px 0;border-top:1px solid #dfe5e9}.affixSuffixExample b{display:block;font-size:14px;color:#233d52}.affixSuffixExample span{font-size:12px;color:#657787}.affixDirection{margin-top:9px;border-radius:9px;padding:9px;background:#fff;font-size:12px;color:#5b6d7a}.affixDirection strong{color:#2d4355}
      .affixFactory{display:grid;grid-template-columns:180px 42px 1fr;gap:10px;align-items:center;border:1.5px solid #dce4ea;border-radius:18px;background:#fbfcfe;padding:16px}.affixRoot{height:140px;border-radius:16px;background:#203d52;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center}.affixRoot span{font-size:11px;opacity:.75}.affixRoot b{font-size:28px}.affixRoot small{font-size:13px;opacity:.82}.affixFactoryArrow{text-align:center;font-size:28px;color:#82909d}.affixFactoryBranches{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.factoryItem{border:1px solid #dfe5e9;border-top-width:5px;border-radius:12px;background:#fff;padding:10px;text-align:center;min-width:0}.factoryItem>span{display:block;font-size:11px;font-weight:900;color:#6b7b88}.factoryItem b{display:block;font-size:14px;color:#253d50;margin-top:4px}.factoryItem small{display:block;font-size:10px;color:#74828e;min-height:28px;margin:4px 0}.terMini{border-top-color:#7558b1}.kanMini{border-top-color:#d37b30}
      .affixCompareBox,.affixKanIBox{margin-top:18px;border:1.5px solid #dce5eb;border-radius:17px;background:#fff;padding:16px}.affixCompareTitle{font-size:18px;font-weight:950;color:#263f52;margin-bottom:10px}.affixCompareGrid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.affixCompareGrid>div{border:1px solid #e1e7eb;border-radius:11px;padding:11px}.affixCompareGrid b{font-size:15px;color:#263c50}.affixCompareGrid span{display:block;font-size:12px;line-height:1.55;color:#647482;margin-top:5px}.affixKanIFlow{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:stretch}.affixKanIFlow>div:not(.affixVs){border-radius:12px;padding:12px}.kanFlow{background:#fff7ed;border:1px solid #f0d8bd}.iFlow{background:#f2f8ff;border:1px solid #d4e4f3}.affixKanIFlow span{display:block;font-size:17px;font-weight:950;color:#223c52}.affixKanIFlow b{display:block;font-size:13px;color:#4a6072;margin-top:4px}.affixKanIFlow small{display:block;font-size:12px;color:#657786;margin-top:8px;line-height:1.5}.affixVs{align-self:center;font-size:11px;font-weight:950;color:#87929b}
      .affixDecision{margin-top:20px;border-radius:17px;background:#203d52;color:#fff;padding:16px}.affixDecisionTitle{font-size:18px;font-weight:950}.affixDecisionSteps{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:11px}.affixDecisionSteps>div{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:11px;padding:10px;display:grid;grid-template-columns:auto 1fr;gap:2px 8px;align-items:center}.affixDecisionSteps span{grid-row:1/3;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#fff;color:#203d52;font-weight:950}.affixDecisionSteps b{font-size:13px}.affixDecisionSteps small{font-size:10px;opacity:.74;line-height:1.4}
      .affixQuiz{margin-top:22px}.affixQuizRow{display:grid;grid-template-columns:1fr auto minmax(90px,auto);gap:10px;align-items:center;border-top:1px solid #e5eaed;padding:10px 0}.affixQuizRow:first-of-type{border-top:0}.affixQuizRow>span{font-size:14px;font-weight:850;color:#2c4254}.affixQuizRow>div{display:flex;gap:6px;flex-wrap:wrap}.affixQuizRow button{border:1.5px solid #d8e1e7;background:#fff;border-radius:9px;padding:8px 10px;font-weight:800;color:#344b5e;cursor:pointer}.affixQuizRow button.affixQuizOk{background:#edf9f0;border-color:#76bd87;color:#17652d}.affixQuizRow button.affixQuizBad{background:#fff0ef;border-color:#dd8b84;color:#9d2f28}.affixQuizRow button:disabled{cursor:default}.affixQuizResult{font-size:11px;color:#657386}.affixFormula{background:linear-gradient(135deg,#1f5555,#5b4f91)}

      .affixUnifiedGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.affixUnifiedCard{border:1.5px solid #dce5e8;border-radius:18px;padding:17px;background:#fff;min-width:0;box-shadow:0 2px 8px rgba(35,52,70,.025)}.berUnified{border-top:6px solid #4c9b69;background:#f5fbf7}.terUnified{border-top:6px solid #7558b1;background:#faf7ff}.seUnified{border-top:6px solid #3a929b;background:#f4fbfc}.keanUnified{border-top:6px solid #835db5;background:#fbf7ff}.kanUnified{border-top:6px solid #d37b30;background:#fff8f1}.iUnified{border-top:6px solid #3d7fb8;background:#f4f9ff}.anUnified{border-top:6px solid #68768a;background:#f7f8fa}
      .affixUnifiedHead{display:flex;align-items:center;gap:10px}.affixCircle{display:none}.affixUnifiedHead>div{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.affixUnifiedHead b{font-size:23px;color:#1e354a}.affixUnifiedHead small{font-size:13px;color:#5d6f80;font-weight:800}
      .affixOneLine{margin-top:11px;font-size:15px;line-height:1.65;color:#394f63;font-weight:700}.affixUnifiedExamples{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.affixUnifiedExamples.twoCol{grid-template-columns:repeat(2,minmax(0,1fr))}.affixUnifiedExamples>span{background:#fff;border:1px solid #dfe7e9;border-radius:11px;padding:10px;text-align:center;min-width:0}.affixUnifiedExamples strong{display:block;font-size:15px;color:#233c50;word-break:break-word}.affixUnifiedExamples small{display:block;font-size:12px;color:#607383;margin-top:4px;line-height:1.4}.affixBrain{margin-top:11px;padding:10px 11px;border-radius:10px;background:rgba(255,255,255,.86);font-size:13px;line-height:1.55;color:#4d6070}.affixBrain b{color:#223d52}.unifiedDeep{margin-top:9px}
      .terBranches{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.terBranches>div{position:relative;background:#fff;border:1px solid #ded7ed;border-radius:12px;padding:11px 9px 10px 36px;min-width:0}.terBranches>div>span{position:absolute;left:10px;top:11px;width:auto;height:auto;border-radius:0;display:block;background:transparent;color:#6a4aa0;font-size:13px;font-weight:950;line-height:1}.terBranches strong{display:block;font-size:15px;color:#342952}.terBranches b{display:block;font-size:12px;color:#6b4ea0;margin-top:4px}.terBranches small{display:block;font-size:11px;color:#6b7280;margin-top:3px;line-height:1.4}

      @media(max-width:1500px){.nasalRuleGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:1050px){#home .modules.homeModulesCompact{grid-template-columns:repeat(3,minmax(0,1fr))!important}.triExplain{grid-template-columns:1fr}.difficultyIndex{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:620px){.difficultyIndex{grid-template-columns:1fr}.difficultyIndexItem{min-height:92px}}
      @media(max-width:760px){
        .difficultyThree{grid-template-columns:1fr}
        .compareGrid{grid-template-columns:1fr}.compareVs{justify-self:center}
        .timeWindowDiagram,.keanFlow{grid-template-columns:1fr;gap:7px}.timeLine{width:2px;height:20px;justify-self:center}.timeLine:after{content:'⌄';right:auto;left:50%;top:auto;bottom:-8px;transform:translateX(-50%)}.keanFlowArrow{transform:rotate(90deg);line-height:1}
        .difficultyWordLine strong{font-size:36px}
        .senseBridge{margin:0 12% 5px}.senseBridgeFork{height:16px}.senseBridgeFork:before{left:50%;right:auto;width:2px;height:10px;top:2px}.senseBridgeFork span{display:none}.senseBridgeFork span:first-child{display:block;width:2px;height:12px;margin-top:2px;grid-column:2}
        .exampleStrip{grid-template-columns:1fr}.keanBigRuleFlow{flex-direction:column}.keanBigRuleFlow b{text-align:center}
        .dpCoreGrid{grid-template-columns:1fr}.dpCoreVs{justify-self:center}.dpPairRow,.dpFamilyGrid{grid-template-columns:1fr}.dpPronounce{grid-template-columns:1fr}.dpSwap{transform:rotate(90deg)}.dpQuickRule{grid-template-columns:1fr}.dpRuleDivider{width:100%;height:1px}.dpQuizRow{grid-template-columns:1fr}.dpQuizResult{min-height:14px}
        .simGroups{grid-template-columns:1fr}.simWordGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.simNgRule{grid-template-columns:repeat(3,1fr)}.simNgRule p{grid-column:1/-1}.simMethod{grid-template-columns:1fr}.simRuleGrid{grid-template-columns:1fr}.simQuizRow{grid-template-columns:1fr}.simHeroTitle{font-size:23px}
        .nasalHeroTitle{font-size:29px}.nasalMapBottom{grid-template-columns:repeat(2,1fr)}.nasalRuleGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.nasalMirrorGrid,.nasalDropGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.nasalPanelHead{flex-direction:column}.nasalSpecialRow,.nasalSummaryGrid{grid-template-columns:1fr}.nasalQuizRow{grid-template-columns:1fr}
        .affixHeroTitle{font-size:27px}.affixHeroFlow{grid-template-columns:1fr}.affixHeroFlow i{transform:rotate(90deg);text-align:center}.affixRoleGrid,.affixSuffixGrid{grid-template-columns:1fr}.affixStateGrid,.affixRelationGrid{grid-template-columns:1fr}.affixFactory{grid-template-columns:1fr}.affixFactoryArrow{transform:rotate(90deg)}.affixFactoryBranches{grid-template-columns:repeat(2,minmax(0,1fr))}.affixCompareGrid{grid-template-columns:1fr}.affixKanIFlow{grid-template-columns:1fr}.affixVs{text-align:center}.affixDecisionSteps{grid-template-columns:1fr 1fr}.affixQuizRow{grid-template-columns:1fr}.affixCorrection>div:not(.affixCorrectionTitle){grid-template-columns:1fr}
        .affixUnifiedGrid{grid-template-columns:1fr}.terBranches{grid-template-columns:1fr}.affixUnifiedExamples,.affixUnifiedExamples.twoCol{grid-template-columns:1fr 1fr}
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
    ensureDifficulty();
    apply();
    installHistoryNavigation();
    installNavBars();
    setTimeout(function(){renderHomeModules();ensureDifficulty();apply();installNavBars();},180);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else setTimeout(boot,0);
})();