(function(){
  const ORDER=['词汇学习','泛读','快速练习','弱项强化','自动训练','难点解释','前后缀'];
  let applying=false;

  const HOME_MODULES=[
    {key:'vocab',title:'词汇学习',icon:'🧠',desc:'词库、闪卡、发音、例句和学习进度。',tag:'词库',tagId:'vocabTag',open:function(){if(typeof window.go==='function')window.go('vocab');}},
    {key:'reading',title:'泛读',icon:'📚',desc:'独立于每日课程：聊天、办公室、生活和真实交流场景。',tag:'划词查义 · 可加陌生词',open:function(){if(typeof window.openExtensiveV2==='function')window.openExtensiveV2();}},
    {key:'quick',title:'快速练习',icon:'⚡',desc:'5–10分钟，用最近学过的词做情境选词和补空。',tag:'间隔复现',open:function(){if(typeof window.openQuickPracticeV2==='function')window.openQuickPracticeV2();}},
    {key:'weak',title:'弱项强化',icon:'🎯',desc:'集中练快速练习错题和阅读中加入的陌生词。',tag:'针对弱项',open:function(){if(typeof window.openWeaknessV2==='function')window.openWeaknessV2();}},
    {key:'automation',title:'自动训练',icon:'⚙️',desc:'把眼熟但调不出来的词，逐步练到主动使用。',tag:'计算中',tagId:'automationTag',open:function(){if(typeof window.openAutomationTraining==='function')window.openAutomationTraining();}},
    {key:'difficulty',title:'难点解释',icon:'💡',desc:'整理中文难直译、容易混淆的词，用场景和对比帮助理解。',tag:'3 个难点',id:'difficultyModule',open:function(){showDifficultyList();if(typeof window.go==='function')window.go('difficulty');}},
    {key:'affix',title:'前后缀',icon:'🧩',desc:'meN-、peN-、ber-、di-、ter-、-kan、-i 等。',tag:'词根词族',open:function(){if(typeof window.go==='function')window.go('affix');}}
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
              <span class="pill">已整理 3 个</span>
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
                <div class="dpLang"><span>EN</span> get · obtain · can</div>
                <div class="dpLang"><span>ID</span> memperoleh · menerima · bisa</div>
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
            </div>

            <div class="compareBlock">
              <div class="compareTitle">放到句子里，多组并排看</div>
              <div class="dpSentencePairs">
                <div class="dpPairRow">
                  <div class="dpSentence dapatTint"><b>Saya dapat pekerjaan baru.</b><button class="miniSound" type="button" onclick="speakIdText('Saya dapat pekerjaan baru.',this)">🔊</button><span>我得到了一份新工作。</span><small>I got a new job.</small></div>
                  <div class="dpSentence padatTint"><b>Jadwal saya padat.</b><button class="miniSound" type="button" onclick="speakIdText('Jadwal saya padat.',this)">🔊</button><span>我的日程很满。</span><small>My schedule is packed.</small></div>
                </div>
                <div class="dpPairRow">
                  <div class="dpSentence dapatTint"><b>Aku dapat tiketnya.</b><button class="miniSound" type="button" onclick="speakIdText('Aku dapat tiketnya.',this)">🔊</button><span>我拿到票了。</span><small>I got the ticket.</small></div>
                  <div class="dpSentence padatTint"><b>Busnya padat.</b><button class="miniSound" type="button" onclick="speakIdText('Busnya padat.',this)">🔊</button><span>公交车里很挤。</span><small>The bus is packed.</small></div>
                </div>
                <div class="dpPairRow">
                  <div class="dpSentence dapatTint"><b>Saya dapat datang besok.</b><button class="miniSound" type="button" onclick="speakIdText('Saya dapat datang besok.',this)">🔊</button><span>我明天可以来。</span><small>I can come tomorrow.</small></div>
                  <div class="dpSentence padatTint"><b>Daerah ini padat penduduk.</b><button class="miniSound" type="button" onclick="speakIdText('Daerah ini padat penduduk.',this)">🔊</button><span>这个地区人口密集。</span><small>This area is densely populated.</small></div>
                </div>
              </div>
            </div>

            <div class="dpFamilyGrid">
              <div class="dpFamilyCard dapatFamily">
                <div class="dpFamilyHead"><span>🌱</span><div><h3>dapat 词族</h3><small>大多围绕“得到 / 获得 / 能够”</small></div></div>
                <div class="wordFamily audioFamily"><b>dapat</b><span>→</span><strong>mendapat</strong><button class="miniSound" type="button" onclick="speakIdText('mendapat',this)">🔊</button><small>得到、获得 · get / receive</small></div>
                <div class="wordFamily audioFamily"><b>dapat</b><span>→</span><strong>mendapatkan</strong><button class="miniSound" type="button" onclick="speakIdText('mendapatkan',this)">🔊</button><small>获得、取得 · obtain / get</small></div>
                <div class="wordFamily audioFamily"><b>dapat</b><span>→</span><strong>pendapatan</strong><button class="miniSound" type="button" onclick="speakIdText('pendapatan',this)">🔊</button><small>收入 · income / revenue</small></div>
                <div class="wordFamily audioFamily"><b>dapat</b><span>→</span><strong>terdapat</strong><button class="miniSound" type="button" onclick="speakIdText('terdapat',this)">🔊</button><small>有、存在、可见于 · there is/are · be found</small></div>
                <div class="wordFamily audioFamily"><b>dapat</b><span>→</span><strong>didapat / didapatkan</strong><button class="miniSound" type="button" onclick="speakIdText('didapatkan',this)">🔊</button><small>被获得、得到 · obtained</small></div>
              </div>
              <div class="dpFamilyCard padatFamily">
                <div class="dpFamilyHead"><span>🧱</span><div><h3>padat 词族</h3><small>大多围绕“密 / 满 / 压实”</small></div></div>
                <div class="wordFamily audioFamily"><b>padat</b><span>→</span><strong>kepadatan</strong><button class="miniSound" type="button" onclick="speakIdText('kepadatan',this)">🔊</button><small>密度、拥挤程度 · density</small></div>
                <div class="wordFamily audioFamily"><b>padat</b><span>→</span><strong>memadatkan</strong><button class="miniSound" type="button" onclick="speakIdText('memadatkan',this)">🔊</button><small>使变紧实、压实 · compact</small></div>
                <div class="wordFamily audioFamily"><b>padat</b><span>→</span><strong>pemadatan</strong><button class="miniSound" type="button" onclick="speakIdText('pemadatan',this)">🔊</button><small>压实、压密 · compaction</small></div>
                <div class="wordFamily audioFamily"><b>padat</b><span>→</span><strong>dipadatkan</strong><button class="miniSound" type="button" onclick="speakIdText('dipadatkan',this)">🔊</button><small>被压实 · compacted</small></div>
                <div class="dpCollocations"><b>高频组合</b><span>padat penduduk</span><span>lalu lintas padat</span><span>jadwal padat</span><span>makanan padat</span><span>padat karya</span></div>
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
        card.classList.remove('homeModVocab','homeModReading','homeModQuick','homeModWeak','homeModAutomation','homeModAffix','homeModDifficulty','v2-wide');
        if(title==='词汇学习')card.classList.add('homeModVocab');
        else if(title==='泛读')card.classList.add('homeModReading');
        else if(title==='快速练习')card.classList.add('homeModQuick');
        else if(title==='弱项强化')card.classList.add('homeModWeak');
        else if(title==='自动训练')card.classList.add('homeModAutomation');
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
      #home .homeModAutomation{background:#f8f6ff!important;border-color:#e4def5!important;border-top:3px solid #8d73c9!important}
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
      .dpBridge{border:1px solid #dbe5f1;border-radius:16px;background:#f9fbff;padding:16px;margin:18px 0}.dpBridgeTitle{font-size:17px;font-weight:900;color:#2d5e93}.dpBridgeFlow{display:flex;gap:9px;align-items:center;justify-content:center;margin:13px 0;flex-wrap:wrap}.dpBridgeFlow span{background:#fff;border:1px solid #d8e4f0;border-radius:9px;padding:7px 10px;font-size:12px;font-weight:800}.dpBridgeFlow b{color:#7793b0}.dpBridge p{margin:0;color:#5f6c7d;font-size:13px;line-height:1.65}
      .dpSentencePairs{display:grid;gap:9px}.dpPairRow{display:grid;grid-template-columns:1fr 1fr;gap:9px}.dpSentence{border:1px solid #e1e6ed;border-radius:14px;padding:13px;min-width:0}.dpSentence b{font-size:14px}.dpSentence>span,.dpSentence>small{display:block;margin-top:5px;color:#667085;line-height:1.45}.dpSentence>small{font-size:11px;color:#8791a0}.dapatTint{background:#f7fbff;border-color:#dceaf7}.padatTint{background:#fffaf5;border-color:#eee0cf}
      .dpFamilyGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0}.dpFamilyCard{border:1px solid #e0e6ee;border-radius:18px;padding:16px;background:#fff}.dapatFamily{background:#f8fbff;border-color:#dce9f5}.padatFamily{background:#fffaf5;border-color:#eee0cf}.dpFamilyHead{display:flex;gap:9px;align-items:center;margin-bottom:5px}.dpFamilyHead>span{font-size:24px}.dpFamilyHead h3{margin:0;font-size:19px}.dpFamilyHead small{color:#7b8795}.dpCollocations{border-top:1px solid rgba(0,0,0,.06);margin-top:8px;padding-top:10px;display:flex;gap:6px;flex-wrap:wrap}.dpCollocations b{width:100%;font-size:12px;color:#7b5b34}.dpCollocations span{background:#fff;border:1px solid #eadbc8;border-radius:999px;padding:5px 8px;font-size:11px;color:#68543d}
      .dpQuickRule{display:grid;grid-template-columns:1fr auto 1fr;gap:14px;align-items:stretch;border-radius:17px;padding:16px;background:#27364a;color:#fff;margin-top:18px}.dpQuickRule>div:not(.dpRuleDivider){display:grid;grid-template-columns:auto 1fr;gap:4px 9px;align-items:center}.dpQuickRule span{font-size:22px;grid-row:1/3}.dpQuickRule b{font-size:13px}.dpQuickRule strong{font-size:18px}.dpQuickRule>div:first-child strong{color:#9dcbff}.dpQuickRule>div:last-child strong{color:#ffd29e}.dpRuleDivider{width:1px;background:rgba(255,255,255,.2)}
      .dpQuiz{margin-top:22px}.dpQuizRow{display:grid;grid-template-columns:1fr auto minmax(95px,auto);gap:10px;align-items:center;border-top:1px solid #e8ebf0;padding:10px 0}.dpQuizRow:first-of-type{border-top:0}.dpQuizRow>span{font-size:13px;font-weight:750}.dpQuizRow>div{display:flex;gap:6px}.dpQuizRow button{border:1px solid #dfe4eb;background:#fff;border-radius:9px;padding:7px 10px;cursor:pointer}.dpQuizRow button:hover{background:#f7f9fc}.dpQuizRow button.dpQuizOk{background:#edf9f0;border-color:#76bd87;color:#17652d}.dpQuizRow button.dpQuizBad{background:#fff0ef;border-color:#dd8b84;color:#9d2f28}.dpQuizRow button:disabled{cursor:default}.dpQuizResult{font-size:11px;color:#657386}
      .dpFormula{background:linear-gradient(135deg,#244d77,#80511f)}

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