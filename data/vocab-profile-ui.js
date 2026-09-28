(function(){
  'use strict';
  let PROFILE=null,activeTab='today',activeWeak='',historyState='idle',selectedWord='',wordQuery='';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m]));
  const signalLabel={automation_fail:'自动训练失败',quick_wrong:'快速练习答错',dont:'明确不会',fuzzy:'标记模糊',unknown:'陌生词',manual_unknown:'陌生词'};
  function evidenceData(){
    return window.VocabProfileEvidence?window.VocabProfileEvidence.summarize():{attempts:0,observed:0,active:0,passive:0,forgotten:0,relearned:0};
  }
  function evidenceHTML(){
    const api=window.VocabProfileEvidence,rows=api?api.records().slice(-8).reverse():[];
    const names={auto:'自动训练',quick:'快速练习',listen:'听词训练'};
    const labels={direct:'无提示快速提取',slow:'正确但不符合快速标准',right:'无提示完成',hinted:'使用提示',fail:'未能提取',stable:'多轮延迟验证通过',self_checked:'用户自我核对表达',wrong:'答错',fast_first:'首次听音快速答对'};
    const summary=evidenceData();
    const stats=summary.attempts?'<div class="vpMiniStats"><div><b>'+summary.observed+'</b><span>有记录的词</span></div><div><b>'+summary.attempts+'</b><span>已捕获答题事件</span></div><div><b>'+summary.forgotten+'</b><span>验证后又出现提取失败</span></div><div><b>'+summary.relearned+'</b><span>再次通过验证</span></div></div>':'';
    return '<div class="vpSection"><h3>本设备近期训练证据</h3>'+stats+(rows.length?rows.map(x=>'<div style="padding:8px 0;border-bottom:1px solid #eef0f4;font-size:13px"><b>'+esc(x.word)+'</b> · '+esc(names[x.source]||x.source)+' · '+esc(labels[x.result]||x.result)+'<small style="display:block;color:#667085">'+esc(x.at.slice(0,16).replace('T',' '))+' UTC</small></div>').join(''):'<div class="vpEmpty">从现在开始记录新答题结果。原有自动训练的已保存事件可以沿用；没有证据的旧成绩不会补造。</div>')+'<p class="vpCoverageNote">本机仅保留最近1500条有效事件，并按正式学过的词去重；不与手机、云端混算。单次答对不算稳定掌握，听音正确不等于会主动表达。</p></div>';
  }
  const localCoach=()=>window.VocabStudyCoach||null;
  const modeNames={auto:'主动提取',quick:'快速识别',listen:'听词验证'};
  const normWord=s=>String(s||'').trim().toLowerCase();
  function jakartaTime(ms){
    if(!ms||!Number.isFinite(Number(ms)))return '尚未安排';
    return new Date(ms).toLocaleString('zh-CN',{timeZone:'Asia/Jakarta',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
  }
  function taskListHTML(rows){
    if(!rows.length)return '<div class="vpCoachEmpty">当前没有到期的重点任务。先正常上课；到时间后才会再安排，不为凑题重复出现。</div>';
    return '<div class="vpCoachList">'+rows.map(x=>'<div class="vpCoachRow"><div><b>'+esc(x.word)+' · '+esc(x.cn)+'</b><small>'+esc(x.note)+' · '+esc(modeNames[x.mode]||'针对训练')+'</small></div><button type="button" data-coach-start="'+esc(x.word)+'" data-coach-mode="'+esc(x.mode)+'">练这个</button></div>').join('')+'</div>';
  }
  function openCoachTask(word,mode){
    const api=localCoach(),item=api&&(mode?api.status(mode,word):api.detail(word));
    if(!item||!item.ready)return;
    if(item.mode==='listen'&&typeof window.openListeningWordTarget==='function')window.openListeningWordTarget(item.word);
    else if(item.mode==='quick'&&typeof window.openQuickPracticeWordV2==='function')window.openQuickPracticeWordV2(item.word);
    else if(typeof window.openAutomationTrainingWord==='function')window.openAutomationTrainingWord(item.word);
  }
  function bindCoachActions(root){
    root.querySelectorAll('[data-coach-start]').forEach(b=>b.onclick=()=>openCoachTask(b.dataset.coachStart,b.dataset.coachMode));
    root.querySelectorAll('[data-coach-known]').forEach(b=>b.onclick=()=>{
      const api=localCoach();if(api&&api.requestVerification(b.dataset.coachKnown)){renderHomeCoach();renderDetail();}
    });
  }
  function renderHomeCoach(){
    const home=document.getElementById('home'),profile=document.getElementById('vocabProfile'),api=localCoach();
    if(!home||!profile||!api)return;
    let el=document.getElementById('vocabCoachHome');
    if(!el){el=document.createElement('section');el.id='vocabCoachHome';el.className='vpCoachHome';profile.insertAdjacentElement('beforebegin',el)}
    const rows=api.plan(),progress=api.dailyProgress();
    const next=rows[0]||null,ratio=progress.total?Math.round(progress.done/progress.total*100):0;
    el.innerHTML='<div class="vpCoachTop"><div><h3>今天最该练什么</h3><p>已作答 '+progress.done+'/'+progress.total+' · 建议任务待练 '+rows.length+' 个'+(progress.waiting?' · 等待验证 '+progress.waiting+' 个':'')+'</p></div><button type="button" id="vpCoachStart" '+(!next?'disabled':'')+'>开始今日训练 →</button></div><div class="vpHomeProgress" aria-label="今日任务进度"><span style="width:'+Math.max(0,Math.min(100,ratio))+'%"></span></div>'+(next?'<div class="vpHomeNext"><small>下一个建议训练 · '+esc(modeNames[next.mode]||'专项训练')+'</small><b>'+esc(next.word)+'</b><span>'+esc(next.cn)+'</span></div>':'<div class="vpHomeDone">'+(progress.waiting?'当前任务均在等待验证时间，到期后再练。':'今日建议任务已作答；各专项仍可继续练习其他到期词。')+'</div>')+'<button class="vpHomeMore" type="button" id="vpCoachAll">查看全部任务 →</button>';
    el.querySelector('#vpCoachStart').onclick=()=>{if(next)openCoachTask(next.word,next.mode)};
    el.querySelector('#vpCoachAll').onclick=()=>openDetail('today');
  }
  function todayHTML(){
    const api=localCoach(),rows=api?api.plan():[],progress=api?api.dailyProgress():{total:0,done:0,waiting:0};
    return '<div class="vpSection"><h3>今日针对性建议 · 已作答 '+progress.done+'/'+progress.total+'</h3><p class="vpCoverageNote">这里只推荐优先任务；三个专项独立判定到期，同一个词可接受不同能力的交叉验证。作答完成不等于已经掌握。'+(progress.waiting?'另有 '+progress.waiting+' 个词正在等待约定的验证时间。':'')+'</p>'+taskListHTML(rows)+'</div>';
  }
  function wordCandidates(){
    const api=localCoach();return new Map((api?api.words():[]).map(x=>[normWord(x.word),x]));
  }
  function wordSearchHTML(q){
    const items=wordCandidates(),needle=normWord(q),api=localCoach(),preferred=new Set();
    if(!needle){
      if(api)api.plan().forEach(x=>preferred.add(normWord(x.word)));
      if(window.VocabProfileEvidence)window.VocabProfileEvidence.records().slice(-16).forEach(x=>preferred.add(normWord(x.word)));
    }
    const rows=[...items.values()].filter(x=>needle?normWord(x.word).includes(needle)||String(x.cn).includes(q):preferred.has(normWord(x.word))).slice(0,30);
    return rows.length?rows.map(x=>'<button type="button" data-coach-select="'+esc(x.word)+'"><b>'+esc(x.word)+'</b><small>'+esc(x.cn)+'</small></button>').join(''):'<div class="vpEmpty">没有匹配的正式已学词。可输入印尼语或中文搜索。</div>';
  }
  function wordProfileHTML(word){
    const api=localCoach(),detail=api&&api.detail(word);
    if(!detail)return '<div class="vpEmpty">选择一个正式学过的词，查看下一步训练和实际记录。</div>';
    const ev=detail.events.slice(-12).reverse(),ability=detail.ability||{};
    const status=ability.forgotten?'曾通过验证，后来又遗忘':ability.active?'本机主动验证通过':ability.passive?'本机稳定识别':detail.requested?'已预约跨日确认':'继续积累证据';
    const skillModes=[['quick','视觉识别'],['listen','听觉识别'],['auto','主动提取']];
    const skillInfo='<div class="vpMiniStats vpSkillStats">'+skillModes.map(([m,label])=>{
      const x=api&&api.status(m,word);if(!x)return '';
      const state=x.last_today?'今日已作答':x.stable?'专项稳定／低频抽查':x.ready?'现在到期':x.kind==='new'?'等待首次验证':'尚未到期';
      return '<div><b style="font-size:15px">'+esc(label)+'</b><span>'+esc(state)+'</span><small style="display:block;color:#667085;margin-top:4px">'+esc(x.due_at&&Number.isFinite(x.due_at)?jakartaTime(x.due_at):'按当前状态安排')+'</small></div>';
    }).join('')+'</div>';
    const names={auto:'自动训练',quick:'快速练习',listen:'听词训练'};
    const resultNames={direct:'快速提取',slow:'提取较慢',right:'正确',self_checked:'本人核对表达',stable:'延迟通过',hinted:'使用提示',fail:'未能提取',wrong:'答错',fast_first:'首次听懂'};
    return '<div class="vpSection"><h3>'+esc(detail.word)+' · '+esc(detail.cn)+'</h3><span class="vpSignal">'+esc(status)+'</span><div class="vpCoverageNote">下一次建议：'+esc(detail.due_at?jakartaTime(detail.due_at):'尚无近期作答记录')+'（雅加达） · '+esc(detail.note)+'</div><div class="vpCoachButtons"><button type="button" data-coach-start="'+esc(detail.word)+'" data-coach-mode="'+esc(detail.mode)+'" '+(!detail.ready?'disabled':'')+'>到期后练这个 · '+esc(modeNames[detail.mode])+'</button><button type="button" class="secondary" data-coach-known="'+esc(detail.word)+'">我会了 · 明天验证</button></div>'+skillInfo+'<h3 style="margin-top:15px">真实学习轨迹</h3>'+(ev.length?'<div class="vpWordTrail">'+ev.map(e=>'<div><b>'+esc(e.at.slice(0,16).replace('T',' '))+' UTC</b> · '+esc(names[e.source]||e.source)+' · '+esc(resultNames[e.result]||e.result)+'</div>').join('')+'</div>':'<div class="vpEmpty">还没有本机答题事件。正式学过不等于已经掌握，也不补造旧记录。</div>')+'</div>';
  }
  function wordsHTML(){
    return '<div class="vpSection"><h3>逐词能力档案</h3><p class="vpCoverageNote">输入单词或中文，查看真实记录、冷却时间与针对性训练。默认只列出当前任务及最近有训练记录的词。</p><input class="vpWordSearch" id="vpWordSearch" type="search" placeholder="搜索已学印尼语 / 中文" value="'+esc(wordQuery)+'"><div class="vpWordRows" id="vpSearchResults">'+wordSearchHTML(wordQuery)+'</div></div><div id="vpSelectedWord">'+wordProfileHTML(selectedWord)+'</div>';
  }
  function wireWordSearch(body){
    body.querySelectorAll('[data-coach-select]').forEach(b=>b.onclick=()=>{selectedWord=b.dataset.coachSelect;activeTab='words';renderDetail()});
    const search=body.querySelector('#vpWordSearch');
    if(search)search.oninput=()=>{wordQuery=search.value;const list=body.querySelector('#vpSearchResults');if(list){list.innerHTML=wordSearchHTML(wordQuery);list.querySelectorAll('[data-coach-select]').forEach(b=>b.onclick=()=>{selectedWord=b.dataset.coachSelect;activeTab='words';renderDetail()})}};
  }
  function ensureStyle(){
    if(document.getElementById('vocabProfileStyle'))return;
    const s=document.createElement('style');s.id='vocabProfileStyle';
    s.textContent=`
      .vocabProfile{background:#fff;border:1px solid var(--line,#e5e9f1);border-radius:20px;padding:18px;margin:0 0 14px}
      .vpHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.vpHead h3{margin:0 0 4px;font-size:20px}
      .vpGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin:14px 0}.vpMetric{background:#f7f9fc;border-radius:13px;padding:11px}.vpMetric b{display:block;font-size:22px}.vpMetric span{font-size:12px;color:var(--muted,#6b7280)}
      .vpCoverageSummary{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:2px 0 12px;padding:10px 12px;border-radius:12px;background:#fafbfe;color:#475467;font-size:12px}.vpCoverageSummary b{color:#172033}.vpCoverageSummary span:last-child{white-space:nowrap}
      .vpCoverageBox{margin-top:12px;border:1px solid #e6eaf1;border-radius:15px;padding:14px;background:#fbfcff}.vpCoverageHead{display:flex;justify-content:space-between;gap:12px;align-items:baseline}.vpCoverageHead b{font-size:18px}.vpCoverageHead span{font-size:12px;color:#667085}.vpCoverageTrack{height:8px;background:#e9edf4;border-radius:999px;overflow:hidden;margin:10px 0 8px}.vpCoverageTrack i{display:block;height:100%;background:#3157d5;border-radius:999px}.vpCoverageMeta{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:12px;color:#667085}.vpCoverageNote{font-size:12px;color:#667085;line-height:1.55;margin-top:8px}
      .vpProgress{height:9px;background:#edf0f5;border-radius:999px;overflow:hidden}.vpProgress i{display:block;height:100%;background:#3157d5;border-radius:999px}
      .vpFoot{display:flex;justify-content:space-between;gap:12px;margin-top:8px;font-size:12px;color:var(--muted,#6b7280)}
      .vpFocus{margin-top:12px;font-size:13px;line-height:1.8}.vpFocus b{color:#172033}.vpChip{display:inline-block;background:#eef3ff;color:#3157d5;border-radius:999px;padding:3px 8px;margin:2px 4px 2px 0}
      .vpOpen{width:100%;margin-top:12px;border:1px solid #dbe5ff;background:#f8faff;color:#3157d5;border-radius:11px;padding:9px 12px;font-weight:800;cursor:pointer;text-align:center}.vpOpen:hover{background:#eef3ff}
      .vpDetailCard{max-width:920px;margin:0 auto}.vpDetailHero{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.vpDetailHero h2{margin:0 0 5px}.vpDetailHero p{margin:0;color:#667085;line-height:1.55}
      .vpTabs{display:flex;gap:7px;flex-wrap:wrap;margin:18px 0 14px}.vpTab{border:1px solid #e1e6ef;background:#fff;border-radius:999px;padding:8px 12px;font-weight:750;color:#566275;cursor:pointer}.vpTab.active{background:#3157d5;color:#fff;border-color:#3157d5}
      .vpPanel{display:none}.vpPanel.active{display:block}.vpSection{border:1px solid #e6eaf1;border-radius:16px;background:#fff;padding:16px;margin-top:12px}.vpSection h3{margin:0 0 10px;font-size:18px}
      .vpAbility{display:grid;grid-template-columns:1fr 1fr;gap:10px}.vpAbilityCard{border-radius:15px;padding:15px;background:#f7f9fc}.vpAbilityCard b{display:block;font-size:25px;margin:5px 0 3px}.vpAbilityCard small{color:#667085;line-height:1.45}
      .vpMiniStats{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:10px}.vpMiniStats>div{background:#f8fafc;border-radius:12px;padding:11px}.vpMiniStats b{display:block;font-size:20px}.vpMiniStats span{font-size:12px;color:#667085}
      .vpEmpty{background:#f8faff;border:1px dashed #cfd9ef;border-radius:14px;padding:18px;color:#667085;line-height:1.65}
      .vpTrendRow{display:flex;align-items:center;gap:10px;margin:9px 0}.vpTrendDate{width:76px;font-size:12px;color:#667085}.vpTrendBar{height:9px;background:#e9edf4;border-radius:999px;flex:1;overflow:hidden}.vpTrendBar i{display:block;height:100%;background:#3157d5}.vpTrendValue{width:70px;text-align:right;font-size:12px;color:#475467}
      .vpWeakList{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.vpWeakItem{border:1px solid #e3e8f0;background:#fff;border-radius:13px;padding:12px;text-align:left;cursor:pointer;color:#172033}.vpWeakItem:hover,.vpWeakItem.active{border-color:#9fb4ef;background:#f8faff}.vpWeakItem b{font-size:17px}.vpWeakItem span{display:block;color:#667085;font-size:12px;margin-top:4px}.vpWeakDetail{margin-top:11px;background:#fafbfe;border-radius:14px;padding:14px}.vpSignals{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.vpSignal{font-size:11px;background:#eef3ff;color:#3157d5;border-radius:999px;padding:5px 8px}
      .vpAdviceGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.vpAdvice{border-radius:15px;padding:15px;border:1px solid #e5e9f1;background:#fbfcff}.vpAdvice b{display:block;margin-bottom:6px}.vpAdvice p{margin:0;color:#5f6c7d;line-height:1.55;font-size:13px}
      .vpCoachHome{margin:0 0 14px;padding:18px;border-radius:18px;border:1px solid #dce6fa;background:#f9fbff}.vpCoachTop{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.vpCoachTop h3{margin:0 0 3px;font-size:19px}.vpCoachTop p{margin:0;color:#65748b;font-size:12px;line-height:1.5}.vpCoachList{display:grid;gap:8px;margin-top:12px}.vpCoachRow{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid #e1e9f6;background:#fff;padding:10px 12px;border-radius:12px}.vpCoachRow b{display:block}.vpCoachRow small{display:block;color:#667085;line-height:1.5}.vpCoachRow button,.vpCoachTop button{flex-shrink:0;border:0;border-radius:9px;background:#3157d5;color:white;padding:8px 11px;cursor:pointer;font-weight:750}.vpCoachRow button:disabled{background:#d8dce4;color:#687184;cursor:default}.vpCoachIntro{font-size:12px;color:#667085;margin-top:8px;line-height:1.55}.vpCoachEmpty{background:#eef7f0;padding:12px;border-radius:12px;margin-top:10px;color:#276646;font-size:13px}.vpWordSearch{width:100%;padding:12px;border:1px solid #dce3ef;border-radius:10px;margin:8px 0 12px;font:inherit}.vpWordRows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.vpWordRows button{border:1px solid #e4e9f3;background:#fff;border-radius:10px;padding:9px;text-align:left;cursor:pointer}.vpWordRows button small{display:block;color:#667085}.vpWordTrail{display:grid;gap:8px;margin-top:10px}.vpWordTrail div{padding:9px 11px;background:#f7f9fc;border-radius:10px;font-size:12px;color:#526071}.vpWordTrail b{color:#1d2e4f}.vpCoachButtons{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.vpCoachButtons button{padding:9px 13px;border:0;border-radius:9px;background:#3157d5;color:#fff;font-weight:700;cursor:pointer}.vpCoachButtons button.secondary{background:#edf3ff;color:#3157d5}.vpCoachButtons button:disabled{background:#dce1e9;color:#687184;cursor:default}
      /* Compact dashboard only; the full task list and evidence stay in the detail page. */
      #home .vpHomeProgress{height:6px;background:#e8eef9;border-radius:20px;overflow:hidden;margin:12px 0 9px}#home .vpHomeProgress span{display:block;height:100%;background:#3157d5;border-radius:20px}
      #home .vpHomeNext{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;min-width:0}#home .vpHomeNext small{font-size:12px;color:#667085;flex-basis:100%}#home .vpHomeNext b{font-size:19px;color:#172033;overflow-wrap:anywhere}#home .vpHomeNext span{font-size:12px;color:#667085}
      #home .vpHomeDone{font-size:13px;color:#54705b;line-height:1.5;margin-top:8px}#home .vpHomeMore{border:0;background:transparent;color:#3157d5;padding:5px 0;font-size:12px;font-weight:750;cursor:pointer;margin-top:7px}
      #home .homeLearningGrid .vpCoachTop{align-items:flex-start;gap:8px}#home .homeLearningGrid .vpCoachTop h3{font-size:19px;margin:0 0 3px}#home .homeLearningGrid .vpCoachTop button{font-size:13px;padding:10px 12px;white-space:nowrap}#home .homeLearningGrid .vpCoachTop button:disabled{background:#d8dce4;color:#687184;cursor:default}
      #home .vpHomeNumbers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px 12px;margin:10px 0}#home .vpHomeNumbers>div{display:flex;align-items:baseline;justify-content:space-between;gap:5px;padding:3px 0;border-bottom:1px solid #edf0f6}#home .vpHomeNumbers span{font-size:12px;color:#667085;white-space:nowrap}#home .vpHomeNumbers b{font-size:16px;color:#172033}#home .vpHomeNumbers .vpHomeNumbersLast{grid-column:1/-1}#home .homeLearningGrid .vocabProfile .vpOpen{padding:8px 10px;font-size:12px;margin-top:6px}
      @media(max-width:760px){#home .homeLearningGrid .vpCoachTop button{white-space:normal}#home .homeLearningGrid .vpCoachTop{flex-direction:row}#home .vpHomeNumbers{grid-template-columns:repeat(2,minmax(0,1fr))}}
      .vpActionRow{display:flex;gap:8px;flex-wrap:wrap;margin-top:13px}.vpActionRow button{border:0;border-radius:10px;padding:9px 12px;font-weight:800;cursor:pointer}.vpActionPrimary{background:#3157d5;color:#fff}.vpActionSoft{background:#eef1f6;color:#344054}
      @media(max-width:650px){.vpGrid,.vpMiniStats{grid-template-columns:repeat(2,1fr)}.vpFoot{flex-direction:column;gap:3px}.vpCoverageSummary{align-items:flex-start;flex-direction:column;gap:4px}.vpCoverageSummary span:last-child{white-space:normal}.vpAbility,.vpWeakList,.vpAdviceGrid,.vpWordRows{grid-template-columns:1fr}.vpCoachTop{flex-direction:column}.vpCoachRow{align-items:flex-start}.vpDetailHero{flex-direction:column;gap:8px}}
    `;
    document.head.appendChild(s);
  }
  function ensureDetailPage(){
    let page=document.getElementById('vocabProfileDetail');if(page)return page;
    const app=document.querySelector('.app');if(!app)return null;
    page=document.createElement('section');page.id='vocabProfileDetail';page.className='page';
    page.innerHTML='<button class="back" onclick="go(\'home\')">← 返回首页</button><div class="card vpDetailCard"><div id="vpDetailBody"></div></div>';
    app.appendChild(page);
    if(typeof window.installSiteNavBars==='function')window.installSiteNavBars();
    return page;
  }
  function mount(data){
    PROFILE=data;const home=document.getElementById('home');if(!home)return;
    let box=document.getElementById('vocabProfile');
    if(!box){box=document.createElement('section');box.id='vocabProfile';box.className='vocabProfile';const hero=home.querySelector(':scope > .hero'),mods=document.getElementById('homeModules');if(hero)hero.insertAdjacentElement('afterend',box);else if(mods&&mods.parentNode)mods.parentNode.insertBefore(box,mods);else home.appendChild(box)}
    const focus=(data.focus_words||[]).slice(0,6);
    box.innerHTML='<div class="vpHead"><div><h3>个人词汇画像</h3><div class="muted">真实学习与验证状态</div></div><span class="pill">网站快照</span></div><div class="vpHomeNumbers"><div><span>正式学习</span><b>'+data.taught_total+'</b></div><div><span>确认掌握</span><b>'+data.confirmed_mastered+'</b></div><div><span>待强化</span><b>'+data.needs_reinforcement+'</b></div><div><span>待验证</span><b>'+data.unverified+'</b></div><div class="vpHomeNumbersLast"><span>主词库待学习</span><b>'+data.primary_eligible_new_total+'</b></div></div><button class="vpOpen" type="button" id="openVocabProfile">查看能力与逐词档案 →</button>';
    box.querySelector('#openVocabProfile').onclick=openDetail;
    ensureDetailPage();renderDetail();renderHomeCoach();
  }
  function trendHTML(data){
    if(historyState==='idle'||historyState==='loading')return '<div class="vpEmpty">正在读取历史快照…</div>';
    if(historyState==='error')return '<div class="vpEmpty">历史快照读取失败；不会用当前数据冒充历史。重新打开详情页可重试。</div>';
    const rows=Array.isArray(data.history)?data.history:[];
    if(rows.length<2)return '<div class="vpEmpty"><b>趋势数据正在积累</b><br>目前有 '+rows.length+' 个可靠的日期快照。至少需要两个不同日期的真实快照，才会绘制学习趋势。</div>';
    const recent=rows.slice(-10),max=Math.max(...recent.map(x=>Number(x.taught_total||0)),1);
    return recent.map(x=>{const pct=Math.max(0,Math.min(100,Number(x.confirmed_mastered||0)/max*100));return '<div class="vpTrendRow"><span class="vpTrendDate">'+esc(x.date||'')+'</span><div class="vpTrendBar"><i style="width:'+pct+'%"></i></div><span class="vpTrendValue">'+Number(x.confirmed_mastered||0)+' 掌握</span></div>'}).join('');
  }
  function weakDetailHTML(w){
    if(!w)return '<div class="vpEmpty">点击上面的重点弱词，可以查看系统为什么把它排到前面。</div>';
    const sig=(w.signals||[]).map(x=>'<span class="vpSignal">'+esc(signalLabel[x]||x)+'</span>').join('');
    const advice=(w.signals||[]).includes('automation_fail')?'优先做主动提取和延迟验证；不要只重复看答案。':(w.signals||[]).includes('quick_wrong')?'先做短时识别练习，再回到主动提取验证。':'继续用间隔复现确认是否已经稳定。';
    const details=[];if(Number.isSafeInteger(w.wrong_count)&&w.wrong_count>0)details.push('累计答错 '+w.wrong_count+' 次');if(w.last_wrong)details.push('最近答错 '+w.last_wrong.slice(0,10));if(w.last_review)details.push('最近复习 '+w.last_review.slice(0,10));
    return '<div class="vpWeakDetail"><b style="font-size:20px">'+esc(w.word)+'</b><div style="margin-top:4px;color:#475467">'+esc(w.cn||'')+'</div><div class="vpSignals">'+sig+'</div>'+(details.length?'<div style="font-size:12px;color:#667085;margin-top:8px">'+details.map(esc).join(' · ')+'</div>':'')+'<div style="margin-top:11px;font-size:13px;line-height:1.6;color:#5f6c7d"><b>当前判断：</b>'+esc(advice)+'</div><div class="vpActionRow"><button class="vpActionPrimary" type="button" data-vp-action="automation">去自动训练</button><button class="vpActionSoft" type="button" data-vp-action="quick">去快速练习</button></div></div>';
  }
  function suggestions(data){
    const f=data.focus_words||[],counts={auto:0,quick:0,dont:0,fuzzy:0};
    const records=window.VocabProfileEvidence?window.VocabProfileEvidence.records():[];
    const cutoff=Date.now()-7*86400000,recent=records.filter(x=>Date.parse(x.at)>=cutoff);
    const local={auto:recent.filter(x=>x.source==='auto'&&x.result==='fail').length,quick:recent.filter(x=>x.source==='quick'&&x.result==='wrong').length,listen:recent.filter(x=>x.source==='listen'&&['wrong','slow'].includes(x.result)).length};
    f.forEach(w=>(w.signals||[]).forEach(s=>{if(s==='automation_fail')counts.auto++;if(s==='quick_wrong')counts.quick++;if(s==='dont')counts.dont++;if(s==='fuzzy')counts.fuzzy++;}));
    const out=[];
    if(recent.length){
      if(local.auto)out.push(['无提示提取','最近7天自动训练有 '+local.auto+' 次提取失败。到期后优先进行对应词的无提示提取。']);
      if(local.listen)out.push(['听觉识别','最近7天听词有 '+local.listen+' 次答错或反应较慢，优先练对应声音，不把这类错误直接改写为未掌握。']);
      if(local.quick)out.push(['识别到表达','最近7天快速练习有 '+local.quick+' 次答错。冷却后用主动提取确认，而不是马上重复相同选择题。']);
      if(!out.length)out.push(['保持间隔','最近7天已有 '+recent.length+' 次本机答题，没有记录到上述失败；按到期任务训练，不必额外加量。']);
    }
    if(!recent.length&&counts.auto)out.push(['主动提取优先','当前重点弱词中有 '+counts.auto+' 个带有自动训练失败信号。接下来应优先练“看到意思就能主动调出印尼语”，而不是继续增加被动曝光。']);
    if(!recent.length&&counts.quick)out.push(['识别稳定度仍需巩固','当前重点弱词中有 '+counts.quick+' 个近期快速练习答错。建议短时复现后再进入延迟验证。']);
    if(!out.length)out.push(['继续观察','当前证据还不足以判断主要瓶颈，先保持现有学习节奏，等待更多跨日记录。']);
    out.push(['新词数量先不自动调整','目前画像只给学习方向建议，不会擅自改变08:00或18:00的新词配额。']);
    return out;
  }
  function renderDetail(){
    const data=PROFILE,body=document.getElementById('vpDetailBody');if(!body||!data)return;
    const ev=evidenceData(),active=ev.attempts?String(ev.active):'待积累',passive=ev.attempts?String(ev.passive):'待积累';
    const focus=data.focus_words||[];if(activeWeak&&!focus.some(x=>x.word===activeWeak))activeWeak='';
    const chosen=focus.find(x=>x.word===activeWeak)||focus[0]||null;if(!activeWeak&&chosen)activeWeak=chosen.word;
    const adv=suggestions(data);
    body.innerHTML='<div class="vpDetailHero"><div><h2>个人词汇画像</h2><p>把学习结果、训练错误和后续验证汇总成一个持续更新的词汇能力档案。</p></div><span class="pill">网站快照＋本机训练</span></div>'+
      '<div class="vpTabs">'+[['today','今日任务'],['overview','能力总览'],['words','逐词档案'],['trend','学习趋势'],['weak','弱词分析'],['advice','学习建议']].map(x=>'<button class="vpTab '+(activeTab===x[0]?'active':'')+'" data-vp-tab="'+x[0]+'" type="button">'+x[1]+'</button>').join('')+'</div>'+
      '<section class="vpPanel '+(activeTab==='today'?'active':'')+'" data-vp-panel="today">'+todayHTML()+'</section>'+ 
      '<section class="vpPanel '+(activeTab==='overview'?'active':'')+'" data-vp-panel="overview"><div class="vpSection"><h3>三个专项的本机到期状态</h3><div class="vpMiniStats">'+[['quick','视觉识别'],['listen','听觉识别'],['auto','主动提取']].map(([mode,label])=>{const api=localCoach(),s=api?api.statistics(mode):null;return '<div><b>'+esc(s?s.due:'—')+'</b><span>'+esc(label)+' · 当前到期</span><small style="display:block;color:#667085">'+esc(s?'今日已练 '+s.today+' · 稳定或历史掌握 '+s.stable:'尚无记录')+'</small></div>'}).join('')+'</div><p class="vpCoverageNote">仅基于本机的逐词专项记录；不与GitHub的正式掌握总数混算。</p></div><div class="vpAbility"><div class="vpAbilityCard"><span>本机验证的主动词汇</span><b>'+active+'</b><small>必须记录无提示提取、语境补词、自我表达，并在至少两个不同日期通过延迟验证；表达环节由本人核对，系统不自动评判整句语法；不把原有 mastered 自动算入。</small></div><div class="vpAbilityCard"><span>本机稳定识别词汇</span><b>'+passive+'</b><small>选择识别或首次听音快速识别，最近一次错误后至少三次正确，覆盖两个不同日期；不与主动词汇重复统计。</small></div></div><div class="vpCoverageBox"><div class="vpCoverageHead"><b>主词库当前待学习</b><span>'+data.primary_eligible_new_total+' 个</span></div><div class="vpCoverageNote">这里显示当前仍会进入后续新词学习流程的主词库词数。</div></div><div class="vpSection"><h3>已学习词状态</h3><div class="vpMiniStats"><div><b>'+data.taught_total+'</b><span>正式学习</span></div><div><b>'+data.confirmed_mastered+'</b><span>确认掌握</span></div><div><b>'+data.needs_reinforcement+'</b><span>待强化</span></div><div><b>'+data.unverified+'</b><span>尚待验证</span></div></div></div>'+evidenceHTML()+'</section>'+
      '<section class="vpPanel '+(activeTab==='words'?'active':'')+'" data-vp-panel="words">'+wordsHTML()+'</section>'+ 
      '<section class="vpPanel '+(activeTab==='trend'?'active':'')+'" data-vp-panel="trend"><div class="vpSection"><h3>学习趋势</h3>'+trendHTML(data)+'</div><div class="vpSection"><h3>趋势原则</h3><div class="vpEmpty">只使用真实跨日快照和后续训练结果。只有后续获取到可靠的事件和日期快照，才会显示新增稳定词与遗忘变化；不会用当前总数伪造历史曲线。</div></div></section>'+
      '<section class="vpPanel '+(activeTab==='weak'?'active':'')+'" data-vp-panel="weak"><div class="vpSection"><h3>重点弱词</h3><div class="vpWeakList">'+(focus.length?focus.map(w=>'<button type="button" class="vpWeakItem '+(w.word===activeWeak?'active':'')+'" data-vp-word="'+esc(w.word)+'"><b>'+esc(w.word)+'</b><span>'+esc(w.cn||'')+'</span></button>').join(''):'<div class="vpEmpty">暂无重点弱词。</div>')+'</div><div id="vpWeakDetail">'+weakDetailHTML(chosen)+'</div></div></section>'+
      '<section class="vpPanel '+(activeTab==='advice'?'active':'')+'" data-vp-panel="advice"><div class="vpAdviceGrid">'+adv.map(x=>'<div class="vpAdvice"><b>'+esc(x[0])+'</b><p>'+esc(x[1])+'</p></div>').join('')+'</div><div class="vpSection"><h3>判断边界</h3><div class="vpEmpty">划词查询只算弱线索；明确加入陌生词、自动训练失败、快速练习答错等是更强证据。一次答对或一次阅读曝光不会直接判为“掌握”。</div></div></section>';
    body.querySelectorAll('[data-vp-tab]').forEach(btn=>btn.onclick=()=>{activeTab=btn.dataset.vpTab;renderDetail()});
    body.querySelectorAll('[data-vp-word]').forEach(btn=>btn.onclick=()=>{activeWeak=btn.dataset.vpWord;activeTab='weak';renderDetail()});
    bindCoachActions(body);wireWordSearch(body);
    body.querySelectorAll('[data-vp-action]').forEach(btn=>btn.onclick=()=>{const word=activeWeak;if(btn.dataset.vpAction==='automation'&&typeof window.openAutomationTrainingWord==='function')window.openAutomationTrainingWord(word);else if(btn.dataset.vpAction==='quick'&&typeof window.openQuickPracticeWordV2==='function')window.openQuickPracticeWordV2(word)});
  }
  async function loadHistory(){
    if(historyState==='loading'||historyState==='ready')return;
    historyState='loading';renderDetail();
    try{
      const res=await fetch('data/vocab-profile-history.json?v='+Date.now(),{cache:'no-store'});
      if(!res.ok)throw new Error('HTTP '+res.status);
      const doc=await res.json();
      if(!doc||doc.version!==1||doc.timezone!=='Asia/Jakarta'||!Array.isArray(doc.snapshots))throw new Error('Invalid history schema');
      const seen=new Set(),rows=[];
      doc.snapshots.forEach(x=>{
        if(!x||typeof x.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x.date)||seen.has(x.date))throw new Error('Invalid/duplicate history date');
        if(['taught_total','confirmed_mastered','needs_reinforcement','unverified'].some(k=>!Number.isSafeInteger(x[k])||x[k]<0))throw new Error('Invalid history count');
        if(x.confirmed_mastered+x.needs_reinforcement+x.unverified!==x.taught_total)throw new Error('History partition mismatch');
        seen.add(x.date);rows.push(x);
      });
      if(PROFILE)PROFILE.history=rows.sort((a,b)=>a.date.localeCompare(b.date));
      historyState='ready';
    }catch(e){historyState='error';console.warn('vocab profile history unavailable',e)}
    renderDetail();
  }
  function openDetail(tab){if(typeof tab==='string'&&['today','overview','words','trend','weak','advice'].includes(tab))activeTab=tab;ensureDetailPage();renderDetail();if(typeof window.go==='function')window.go('vocabProfileDetail');loadHistory()}
  window.openVocabProfileDetail=openDetail;
  function refreshCoachView(){renderHomeCoach();const page=document.getElementById('vocabProfileDetail');if(page&&page.classList.contains('active'))renderDetail()}
  window.addEventListener('vocab-coach-updated',refreshCoachView);
  window.addEventListener('vocab-profile-evidence-updated',refreshCoachView);
  async function load(){ensureStyle();try{const r=await fetch('data/vocab-profile.json?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);mount(await r.json())}catch(e){console.warn('vocab profile unavailable',e);const box=document.getElementById('vocabProfile');if(box)box.innerHTML='<h3 style="margin:0 0 5px;font-size:18px">个人词汇画像</h3><p style="margin:0;color:#667085;font-size:13px">暂时无法读取统计，其他学习模块可以正常使用。</p>';renderHomeCoach()}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
