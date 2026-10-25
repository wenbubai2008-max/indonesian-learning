(function(){
  'use strict';
  let PROFILE=null,homeDirty=false,homeSeen=false,activeTab='today',historyState='idle',selectedWord='',wordQuery='',wordFilter='weak';
  // 2026-10-16: seven tabs merged into three (今天 / 本周 / 查词). Old tab names still open the tab that now holds them.
  const TAB_ALIAS={today:'today',overview:'week',trend:'week',weekly:'week',advice:'week',week:'week',words:'words',weak:'words'};
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m]));
  const signalLabel={automation_fail:'自动训练失败',quick_wrong:'快速练习答错',lesson_wrong:'课程中答错或卡住',dont:'明确不会',fuzzy:'标记模糊',unknown:'陌生词',manual_unknown:'陌生词'};
  function evidenceData(){
    return window.VocabProfileEvidence?window.VocabProfileEvidence.summarize():{attempts:0,observed:0,active:0,passive:0,forgotten:0,relearned:0};
  }
  const localCoach=()=>window.VocabStudyCoach||null;
  const modeNames={auto:'主动提取',quick:'快速识别',listen:'听词验证'};
  const normWord=s=>String(s||'').trim().toLowerCase();
  function jakartaTime(ms){
    if(!ms||!Number.isFinite(Number(ms)))return '尚未安排';
    if(Number(ms)<1e12)return '现在可练'; // never practised: the scheduler's due time is only a placeholder near 1970
    return new Date(ms).toLocaleString('zh-CN',{timeZone:'Asia/Jakarta',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
  }
  // Diagnosis tag for a word (data/word-diagnosis-ui.js); '' when the module is missing or the word has no clear problem.
  function diagTag(w){return window.WordDiagnosisUI?window.WordDiagnosisUI.tag(w):''}
  function taskListHTML(rows){
    if(!rows.length)return '<div class="vpCoachEmpty">当前没有到期的重点任务。先正常上课；到时间后才会再安排，不为凑题重复出现。</div>';
    return '<div class="vpCoachList">'+rows.map(x=>'<div class="vpCoachRow"><div><b>'+esc(x.word)+' · '+esc(x.cn)+'</b> '+diagTag(x.word)+'<small>'+esc(x.note)+' · '+esc(modeNames[x.mode]||'针对训练')+'</small></div><button type="button" data-coach-start="'+esc(x.word)+'" data-coach-mode="'+esc(x.mode)+'">练这个</button></div>').join('')+'</div>';
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
    const next=rows[0]||null,ratio=progress.total?Math.round(progress.done/progress.total*100):0,homeOn=home.classList.contains('active');
    el.innerHTML='<div class="vpCoachTop"><div><h3>今天最该练什么</h3><p>已作答 '+progress.done+'/'+progress.total+' · 建议任务待练 '+rows.length+' 个'+(progress.waiting?' · 等待验证 '+progress.waiting+' 个':'')+'</p></div><button type="button" id="vpCoachStart" '+(!next?'disabled':'')+'>开始今日训练 →</button></div><div class="vpHomeProgress" aria-label="今日任务进度"><span style="width:'+Math.max(0,Math.min(100,ratio))+'%"></span></div>'+(next?'<div class="vpHomeNext"><small>下一个建议训练 · '+esc(modeNames[next.mode]||'专项训练')+'</small><b>'+esc(next.word)+'</b><span>'+esc(next.cn)+'</span>'+(homeOn?diagTag(next.word):'')+'</div>':'<div class="vpHomeDone">'+(progress.waiting?'当前任务均在等待验证时间，到期后再练。':'今日建议任务已作答；各专项仍可继续练习其他到期词。')+'</div>')+'<button class="vpHomeMore" type="button" id="vpCoachAll">查看全部任务 →</button>';
    el.querySelector('#vpCoachStart').onclick=()=>{if(next)openCoachTask(next.word,next.mode)};
    el.querySelector('#vpCoachAll').onclick=()=>openDetail('today');
  }
  function todayHTML(){
    const api=localCoach(),rows=api?api.plan():[],progress=api?api.dailyProgress():{total:0,done:0,waiting:0};
    const cov=api&&api.newWordCoverage?api.newWordCoverage():null;
    const covLine=cov&&cov.total?'<p class="vpCoverageNote" data-new-word-coverage>最近 7 天新学 '+cov.total+' 个词，已做过主动提取 '+cov.auto+' 个、快速练习 '+cov.quick+' 个（本机记录）。新词会按上限优先进入训练：快速练习每轮最多 4 个、自动训练最多 3 个。</p>':'';
    const due='<div class="vpMiniStats vpDue">'+[['quick','视觉识别'],['listen','听觉识别'],['auto','主动提取']].map(([mode,label])=>{const s=api?api.statistics(mode):null;return '<div><b>'+esc(s?s.due:'—')+'</b><span>'+esc(label)+' · 当前到期</span><small style="display:block;color:#667085">'+esc(s?'今日已练 '+s.today:'尚无记录')+'</small></div>'}).join('')+'</div>';
    return '<div class="vpSection"><h3>三个专项的到期情况</h3>'+due+'<p class="vpCoverageNote">仅基于本机的逐词专项记录；三项各自独立到期，互不覆盖。</p></div><div class="vpSection"><h3>今日针对性建议 · 已作答 '+progress.done+'/'+progress.total+'</h3><p class="vpCoverageNote">这里只推荐优先任务；三个专项独立判定到期，同一个词可接受不同能力的交叉验证。作答完成不等于已经掌握。'+(progress.waiting?'另有 '+progress.waiting+' 个词正在等待约定的验证时间。':'')+'</p>'+covLine+taskListHTML(rows)+'</div>';
  }
  function wordCandidates(){
    const api=localCoach();return new Map((api?api.words():[]).map(x=>[normWord(x.word),x]));
  }
  // Default list by filter: 弱词 (snapshot focus words + words forgotten on >= 2 days), 到期 (due in any skill), 最近练过.
  function filterWords(filter){
    const api=localCoach(),out=[],seen=new Set(),add=(w,tag)=>{const k=normWord(w);if(!k||seen.has(k))return;seen.add(k);out.push({k,tag})};
    if(filter==='weak'){
      let wk=null;try{wk=window.WeeklyMemoryReport&&window.WeeklyMemoryReport.compute()}catch(e){}
      (wk&&wk.forgotten||[]).forEach(x=>add(x.word,x.days+' 天出错'));
      ((PROFILE&&PROFILE.focus_words)||[]).forEach(w=>add(w.word,((w.signals||[]).map(s=>signalLabel[s]||s)[0])||'重点弱词'));
    }else if(filter==='due'){
      if(api)['auto','quick','listen'].forEach(m=>api.candidates(m).filter(x=>x.ready).slice(0,15).forEach(x=>add(x.word,modeNames[m]+'到期')));
    }else if(window.VocabProfileEvidence){
      const names={auto:'自动训练',quick:'快速练习',listen:'听词训练'};
      window.VocabProfileEvidence.records().slice(-80).reverse().forEach(x=>add(x.word,names[x.source]||''));
    }
    return out.slice(0,30);
  }
  function wordSearchHTML(q){
    const items=wordCandidates(),needle=normWord(q);
    const rows=needle?[...items.values()].filter(x=>normWord(x.word).includes(needle)||String(x.cn).includes(q)).slice(0,30).map(x=>({x,tag:''}))
      :filterWords(wordFilter).map(r=>({x:items.get(r.k),tag:r.tag})).filter(r=>r.x);
    const empty=needle?'没有匹配的正式已学词。可输入印尼语或中文搜索。':wordFilter==='weak'?'目前没有重点弱词。':wordFilter==='due'?'现在没有到期的词。':'本机还没有训练记录。';
    return rows.length?rows.map(({x,tag})=>'<button type="button" data-coach-select="'+esc(x.word)+'"'+(normWord(x.word)===normWord(selectedWord)?' class="active"':'')+'><b>'+esc(x.word)+'</b><small>'+esc(x.cn)+(tag?' · '+esc(tag):'')+'</small></button>').join(''):'<div class="vpEmpty">'+empty+'</div>';
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
    const fw=((PROFILE&&PROFILE.focus_words)||[]).find(w=>normWord(w.word)===normWord(detail.word));
    const weakLine=fw?weakDetailHTML(fw):'';
    return '<div class="vpSection"><h3>'+esc(detail.word)+' · '+esc(detail.cn)+'</h3><span class="vpSignal">'+esc(status)+'</span>'+(window.WordDiagnosisUI?window.WordDiagnosisUI.word(detail.word):'')+weakLine+'<div class="vpCoverageNote">下一次建议：'+esc(Number.isFinite(detail.due_at)?jakartaTime(detail.due_at):'常规训练暂停或尚未安排')+'（雅加达） · '+esc(detail.note)+'</div><div class="vpCoachButtons"><button type="button" data-coach-start="'+esc(detail.word)+'" data-coach-mode="'+esc(detail.mode)+'" '+(!detail.ready?'disabled':'')+'>到期后练这个 · '+esc(modeNames[detail.mode])+'</button><button type="button" class="secondary" data-coach-known="'+esc(detail.word)+'">我会了 · 明天验证</button></div>'+skillInfo+'<h3 style="margin-top:15px">真实学习轨迹</h3>'+(ev.length?'<div class="vpWordTrail">'+ev.map(e=>'<div><b>'+esc(e.at.slice(0,16).replace('T',' '))+' UTC</b> · '+esc(names[e.source]||e.source)+' · '+esc(resultNames[e.result]||e.result)+'</div>').join('')+'</div>':'<div class="vpEmpty">还没有本机答题事件。正式学过不等于已经掌握，也不补造旧记录。</div>')+'</div>';
  }
  function wordsHTML(){
    const chips=[['weak','弱词'],['due','到期'],['recent','最近练过']].map(f=>'<button type="button" class="vpFilter'+(wordFilter===f[0]?' active':'')+'" data-vp-filter="'+f[0]+'">'+f[1]+'</button>').join('');
    return '<div class="vpSection"><h3>逐词能力档案</h3><p class="vpCoverageNote">输入印尼语或中文，或按下面的分类看词；点开可看识别、听音、主动提取三项各练到哪一步、下次什么时候练。</p><input class="vpWordSearch" id="vpWordSearch" type="search" placeholder="搜索已学印尼语 / 中文" value="'+esc(wordQuery)+'"><div class="vpFilters">'+chips+'</div><div class="vpWordRows" id="vpSearchResults">'+wordSearchHTML(wordQuery)+'</div></div><div id="vpSelectedWord">'+wordProfileHTML(selectedWord)+'</div>';
  }
  function wireWordSearch(body){
    body.querySelectorAll('[data-coach-select]').forEach(b=>b.onclick=()=>{selectedWord=b.dataset.coachSelect;activeTab='words';renderDetail();const el=document.getElementById('vpSelectedWord');if(el&&el.scrollIntoView)el.scrollIntoView({behavior:'smooth',block:'start'})});
    body.querySelectorAll('[data-vp-filter]').forEach(b=>b.onclick=()=>{wordFilter=b.dataset.vpFilter;wordQuery='';renderDetail()});
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
      .vpChart{display:block;width:100%;max-width:560px;height:auto}.vpTrendNote{font-size:12px;color:#667085;line-height:1.6;margin:8px 0}.vpTrendNote b{color:#344054}
      .vpTrendRow{display:flex;align-items:center;gap:10px;margin:9px 0}.vpTrendDate{width:76px;font-size:12px;color:#667085}.vpTrendBar{height:9px;background:#e9edf4;border-radius:999px;flex:1;overflow:hidden}.vpTrendBar i{display:block;height:100%;background:#3157d5}.vpTrendValue{width:70px;text-align:right;font-size:12px;color:#475467}
      .vpWeakList{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.vpWeakItem{border:1px solid #e3e8f0;background:#fff;border-radius:13px;padding:12px;text-align:left;cursor:pointer;color:#172033}.vpWeakItem:hover,.vpWeakItem.active{border-color:#9fb4ef;background:#f8faff}.vpWeakItem b{font-size:17px}.vpWeakItem span{display:block;color:#667085;font-size:12px;margin-top:4px}.vpWeakDetail{margin-top:11px;background:#fafbfe;border-radius:14px;padding:14px}.vpSignals{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.vpSignal{font-size:11px;background:#eef3ff;color:#3157d5;border-radius:999px;padding:5px 8px}
      .vpAdviceGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.vpAdvice{border-radius:15px;padding:15px;border:1px solid #e5e9f1;background:#fbfcff}.vpAdvice b{display:block;margin-bottom:6px}.vpAdvice p{margin:0;color:#5f6c7d;line-height:1.55;font-size:13px}
      .vpCoachHome{margin:0 0 14px;padding:18px;border-radius:18px;border:1px solid #dce6fa;background:#f9fbff}.vpCoachTop{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.vpCoachTop h3{margin:0 0 3px;font-size:19px}.vpCoachTop p{margin:0;color:#65748b;font-size:12px;line-height:1.5}.vpCoachList{display:grid;gap:8px;margin-top:12px}.vpCoachRow{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid #e1e9f6;background:#fff;padding:10px 12px;border-radius:12px}.vpCoachRow b{display:block}.vpCoachRow small{display:block;color:#667085;line-height:1.5}.vpCoachRow button,.vpCoachTop button{flex-shrink:0;border:0;border-radius:9px;background:#3157d5;color:white;padding:8px 11px;cursor:pointer;font-weight:750}.vpCoachRow button:disabled{background:#d8dce4;color:#687184;cursor:default}.vpCoachIntro{font-size:12px;color:#667085;margin-top:8px;line-height:1.55}.vpCoachEmpty{background:#eef7f0;padding:12px;border-radius:12px;margin-top:10px;color:#276646;font-size:13px}.vpWordSearch{width:100%;padding:12px;border:1px solid #dce3ef;border-radius:10px;margin:8px 0 12px;font:inherit}.vpWordRows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.vpWordRows button{border:1px solid #e4e9f3;background:#fff;border-radius:10px;padding:9px;text-align:left;cursor:pointer}.vpWordRows button small{display:block;color:#667085}.vpWordRows button.active{border-color:#9fb4ef;background:#f8faff}.vpFilters{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}.vpFilter{border:1px solid #dfe5ef;background:#fff;border-radius:999px;padding:5px 12px;font-size:13px;color:#566275;cursor:pointer}.vpFilter.active{background:#eef3ff;border-color:#9fb4ef;color:#3157d5;font-weight:700}.vpConclusion{border-radius:14px;background:#f4f7ff;border:1px solid #dbe5ff;padding:13px 15px;margin-top:12px;line-height:1.65;color:#243150;font-size:14px}.vpWordTrail{display:grid;gap:8px;margin-top:10px}.vpWordTrail div{padding:9px 11px;background:#f7f9fc;border-radius:10px;font-size:12px;color:#526071}.vpWordTrail b{color:#1d2e4f}.vpCoachButtons{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.vpCoachButtons button{padding:9px 13px;border:0;border-radius:9px;background:#3157d5;color:#fff;font-weight:700;cursor:pointer}.vpCoachButtons button.secondary{background:#edf3ff;color:#3157d5}.vpCoachButtons button:disabled{background:#dce1e9;color:#687184;cursor:default}
      /* Compact dashboard only; the full task list and evidence stay in the detail page. */
      #home .vpHomeProgress{height:6px;background:#e8eef9;border-radius:20px;overflow:hidden;margin:12px 0 9px}#home .vpHomeProgress span{display:block;height:100%;background:#3157d5;border-radius:20px}
      #home .vpHomeNext{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;min-width:0}#home .vpHomeNext small{font-size:12px;color:#667085;flex-basis:100%}#home .vpHomeNext b{font-size:19px;color:#172033;overflow-wrap:anywhere}#home .vpHomeNext span{font-size:12px;color:#667085}
      #home .vpHomeDone{font-size:13px;color:#54705b;line-height:1.5;margin-top:8px}#home .vpHomeMore{border:0;background:transparent;color:#3157d5;padding:5px 0;font-size:12px;font-weight:750;cursor:pointer;margin-top:7px}
      #home .homeLearningGrid .vpCoachTop{align-items:flex-start;gap:8px}#home .homeLearningGrid .vpCoachTop h3{font-size:19px;margin:0 0 3px}#home .homeLearningGrid .vpCoachTop button{font-size:13px;padding:10px 12px;white-space:nowrap}#home .homeLearningGrid .vpCoachTop button:disabled{background:#d8dce4;color:#687184;cursor:default}
      #home .vpWeekDelta:empty{display:none}#home .vpWeekDelta{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;font-size:12px;color:#667085;margin:0 0 10px}#home .vpWeekDelta b{font-weight:700;color:#344054}#home .vpWeekDelta b.vpWarn{color:#c2410c}
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
  // 2026-10-25 profile redesign B1: the home card is built by data/word-diagnosis-ui.js (per-layer coverage); the old numbers card is the fallback.
  function legacyHomeCard(data){return '<div class="vpHead"><div><h3>个人词汇画像</h3><div class="muted">真实学习与验证状态</div></div><span class="pill">网站快照</span></div><div class="vpHomeNumbers"><div><span>正式学习</span><b>'+data.taught_total+'</b></div><div><span>确认掌握</span><b>'+data.confirmed_mastered+'</b></div><div><span>待强化</span><b>'+data.needs_reinforcement+'</b></div><div><span>待验证</span><b>'+data.unverified+'</b></div><div class="vpHomeNumbersLast"><span>主词库待学习</span><b>'+data.primary_eligible_new_total+'</b></div></div><div class="vpWeekDelta" id="vpWeekDelta"></div><button class="vpOpen" type="button" id="openVocabProfile">查看本周情况与查词 →</button>';}
  function renderHomeCard(){
    const box=document.getElementById('vocabProfile');if(!box||!PROFILE)return;
    const diag=window.WordDiagnosisUI?window.WordDiagnosisUI.homeCard(PROFILE):'';
    box.innerHTML=diag||legacyHomeCard(PROFILE);
    const open=box.querySelector('#openVocabProfile');if(open)open.onclick=()=>openDetail('week');
    renderWeekDelta();
  }
  // Practice events only mark the card dirty; it is rebuilt when the home page is on screen, never per answer on a training page.
  function flushHome(){if(!homeDirty)return;homeDirty=false;if(window.WordDiagnosisUI)window.WordDiagnosisUI.reset();renderHomeCard();renderHomeCoach()}
  function markHomeDirty(){homeDirty=true;const h=document.getElementById('home');if(h&&h.classList.contains('active'))flushHome()}
  function mount(data){
    PROFILE=data;const home=document.getElementById('home');if(!home)return;
    let box=document.getElementById('vocabProfile');
    if(!box){box=document.createElement('section');box.id='vocabProfile';box.className='vocabProfile';const hero=home.querySelector(':scope > .hero'),mods=document.getElementById('homeModules');if(hero)hero.insertAdjacentElement('afterend',box);else if(mods&&mods.parentNode)mods.parentNode.insertBefore(box,mods);else home.appendChild(box)}
    if(window.IntersectionObserver&&!homeSeen){homeSeen=true;new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting))flushHome()}).observe(box)}
    renderHomeCard();
    ensureDetailPage();renderDetail();renderHomeCoach();
  }
  function trendHTML(data){
    if(historyState==='idle'||historyState==='loading')return '<div class="vpEmpty">正在读取历史快照…</div>';
    if(historyState==='error')return '<div class="vpEmpty">历史快照读取失败；不会用当前数据冒充历史。重新打开详情页可重试。</div>';
    const rows=Array.isArray(data.history)?data.history:[];
    if(rows.length<2)return '<div class="vpEmpty"><b>趋势数据正在积累</b><br>目前有 '+rows.length+' 个可靠的日期快照。至少需要两个不同日期的真实快照，才会绘制学习趋势。</div>';
    return trendChartsHTML(rows.slice(-30));
  }
  // Inline-SVG trend: three lines (taught / confirmed mastered / needs reinforcement) + daily net change of needs_reinforcement.
  function trendChartsHTML(rows){
    const W=460,H=200,L=32,R=90,T=12,B=22,pw=W-L-R,ph=H-T-B,n=rows.length;
    const top=Math.max(50,Math.ceil(Math.max(...rows.map(x=>x.taught_total))/50)*50);
    const X=i=>L+i/(n-1)*pw,Y=v=>T+ph-v/top*ph;
    const series=[['taught_total','已教','#667085'],['confirmed_mastered','确认掌握','#15803d'],['needs_reinforcement','需要加强','#c2410c']];
    let g='';
    for(let k=0;k<=4;k++){const v=top/4*k,y=Y(v);g+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="#e5e9f1"/><text x="'+(L-6)+'" y="'+(y+4).toFixed(1)+'" text-anchor="end" font-size="11" fill="#667085">'+Math.round(v)+'</text>'}
    const labels=[];
    series.forEach(s=>{
      const pts=rows.map((x,i)=>X(i).toFixed(1)+','+Y(x[s[0]]).toFixed(1)).join(' ');
      g+='<polyline fill="none" stroke="'+s[2]+'" stroke-width="2" stroke-linejoin="round" points="'+pts+'"/>';
      labels.push({y:Y(rows[n-1][s[0]]),text:s[1]+' '+rows[n-1][s[0]],color:s[2]});
    });
    labels.sort((a,b)=>a.y-b.y);for(let i=1;i<labels.length;i++)if(labels[i].y-labels[i-1].y<13)labels[i].y=labels[i-1].y+13;
    labels.forEach(l=>{g+='<text x="'+(W-R+6)+'" y="'+(l.y+4).toFixed(1)+'" font-size="12" fill="'+l.color+'">'+esc(l.text)+'</text>'});
    g+='<text x="'+L+'" y="'+(H-6)+'" font-size="11" fill="#667085">'+esc(rows[0].date.slice(5))+'</text><text x="'+(W-R)+'" y="'+(H-6)+'" text-anchor="end" font-size="11" fill="#667085">'+esc(rows[n-1].date.slice(5))+'</text>';
    const d=k=>rows[n-1][k]-rows[0][k],sign=v=>(v>0?'+':'')+v;
    const summary='自 '+rows[0].date+' 起：已教 '+sign(d('taught_total'))+'，确认掌握 '+sign(d('confirmed_mastered'))+'，需要加强 '+sign(d('needs_reinforcement'));
    const line='<svg class="vpChart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(summary)+'">'+g+'</svg>';
    // daily net change of needs_reinforcement (positive = backlog grows)
    const ch=rows.slice(1).map((x,i)=>x.needs_reinforcement-rows[i].needs_reinforcement),hasNeg=ch.some(v=>v<0),BH=hasNeg?104:80,mid=hasNeg?BH/2:BH-6,upRoom=mid-16,downRoom=hasNeg?BH-mid-14:0,amp=Math.max(10,...ch.map(Math.abs)); // baseline sits at the bottom while nothing is negative
    const bw=pw/ch.length;let b='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+mid+'" y2="'+mid+'" stroke="#cfd6e4"/>';
    ch.forEach((v,i)=>{const h=Math.abs(v)/amp*(v>=0?upRoom:downRoom),y=v>=0?mid-h:mid;b+='<rect x="'+(L+i*bw+bw*0.15).toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+(bw*0.7).toFixed(1)+'" height="'+Math.max(h,v?1:0).toFixed(1)+'" fill="'+(v>0?'#c2410c':v<0?'#15803d':'#cfd6e4')+'"><title>'+esc(rows[i+1].date+'：'+sign(v))+'</title></rect>'+(v&&(i===ch.findIndex(z=>Math.abs(z)===amp)||i===ch.length-1)?'<text x="'+(L+i*bw+bw/2).toFixed(1)+'" y="'+(v>0?y-3:y+h+10).toFixed(1)+'" text-anchor="middle" font-size="11" fill="#667085">'+sign(v)+'</text>':'')});
    const bars='<svg class="vpChart" viewBox="0 0 '+W+' '+BH+'" role="img" aria-label="每天“需要加强”的净增减">'+b+'</svg>';
    return '<div class="vpTrendNote"><b>'+esc(summary)+'</b></div>'+line+
      '<div class="vpTrendNote" style="margin-top:14px"><b>每天“需要加强”净增减</b>（橙色向上=积压增加，绿色向下=清账；只标出最大和最近一天，指向柱子可看每天的数）</div>'+bars+
      '<div class="vpTrendNote">口径：“确认掌握”只统计你在练习中标记为已掌握的词，不是客观测验；“需要加强”是已教但仍需复习的词。</div>';
  }
  function weakDetailHTML(w){
    if(!w)return '';
    const sig=(w.signals||[]).map(x=>'<span class="vpSignal">'+esc(signalLabel[x]||x)+'</span>').join('');
    const advice=(w.signals||[]).includes('automation_fail')?'优先做主动提取和延迟验证；不要只重复看答案。':(w.signals||[]).includes('quick_wrong')?'先做短时识别练习，再回到主动提取验证。':'继续用间隔复现确认是否已经稳定。';
    const details=[];if(Number.isSafeInteger(w.wrong_count)&&w.wrong_count>0)details.push('累计答错 '+w.wrong_count+' 次');if(w.last_wrong)details.push('最近答错 '+w.last_wrong.slice(0,10));if(w.last_review)details.push('最近复习 '+w.last_review.slice(0,10));
    return '<div class="vpWeakDetail"><b>为什么算弱词</b><div class="vpSignals">'+sig+'</div>'+(details.length?'<div style="font-size:12px;color:#667085;margin-top:8px">'+details.map(esc).join(' · ')+'</div>':'')+'<div style="margin-top:11px;font-size:13px;line-height:1.6;color:#5f6c7d"><b>当前判断：</b>'+esc(advice)+'</div><div class="vpActionRow"><button class="vpActionPrimary" type="button" data-vp-action="automation" data-vp-word="'+esc(w.word)+'">去自动训练</button><button class="vpActionSoft" type="button" data-vp-action="quick" data-vp-word="'+esc(w.word)+'">去快速练习</button></div></div>';
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
  // 2026-10-16 (PR 4): weekly memory report, computed on this device by data/weekly-memory-report.js. Read-only.
  function weeklyHTML(){
    const api=window.WeeklyMemoryReport;let r=null;try{r=api&&api.compute()}catch(e){}
    if(!r)return '<div class="vpSection"><div class="vpEmpty">本周报告暂时无法计算。</div></div>';
    const pct=(a,b)=>b?Math.round(a*100/b)+'%':'—',s=r.recall.split;
    const card=(v,label,note)=>'<div><b>'+esc(v)+'</b><span>'+esc(label)+'</span>'+(note?'<small style="display:block;color:#667085">'+esc(note)+'</small>':'')+'</div>';
    const ret=r.retention.enough?r.retention.rate+'%':'样本不足';
    const retNote=r.retention.enough?r.retention.right+'/'+r.retention.n+' 次正式作答答对':'只有 '+r.retention.n+' 次正式作答，至少 '+r.retention.min+' 次才计算';
    const max=Math.max(1,...r.days.map(x=>x.formal));
    const strip='<div style="display:grid;grid-template-columns:repeat(14,1fr);gap:3px;align-items:end;height:56px;margin:8px 0 4px">'+r.days.map(x=>'<div title="'+esc(x.day+' 正式作答 '+x.formal+' 次，课末回想 '+x.recall+' 个')+'" style="background:'+(x.formal?'#6d5bd0':'#e6e8ef')+';height:'+(x.formal?Math.max(12,Math.round(x.formal*100/max)):8)+'%;border-radius:3px"></div>').join('')+'</div><div style="display:flex;justify-content:space-between;font-size:12px;color:#7a8396"><span>'+esc(r.days[0].day.slice(5))+'</span><span>今天</span></div>';
    return '<div class="vpSection"><h3>本周（'+esc(r.weekStart.slice(5))+' 至 '+esc(r.today.slice(5))+'）</h3><div class="vpMiniStats">'+
      card(r.newThisWeek,'本周新学的词','早课和晚课首次学习')+
      card(r.mastered,'本周新增确认掌握','按掌握记录日期')+
      card(r.verified+'/'+r.recentTotal,'近 7 天新词已正式验证',pct(r.verified,r.recentTotal)+' 做过快速练习、听词或自动训练')+
      card(ret,'学后 7–30 天的词 · 正式测试正确率',retNote)+
      '</div></div>'+
      '<div class="vpSection"><h3>课末回想（自评，单独统计）</h3><p class="vpCoverageNote">近 7 天新学 '+r.recentTotal+' 个词，课末回想过 '+r.recall.covered+' 个（'+pct(r.recall.covered,r.recentTotal)+'）。第一次回想：马上想到 '+s.fast+' · 想得慢 '+s.slow+' · 没想起来 '+s.fail+'。自评不计入上面的正确率，也不计入掌握。</p></div>'+
      '<div class="vpSection"><h3>反复遗忘的词（近 14 天至少 2 天出错）</h3>'+(r.forgotten.length?'<div class="vpWeakList">'+r.forgotten.slice(0,12).map(x=>'<button type="button" class="vpWeakItem" data-coach-select="'+esc(x.word)+'"><b>'+esc(x.word)+'</b><span>'+esc(x.cn)+' · '+x.days+' 天出错</span></button>').join('')+'</div>':'<div class="vpEmpty">近 14 天没有在两天以上出错的词。</div>')+'</div>'+
      '<div class="vpSection"><h3>近 14 天练习</h3><p class="vpCoverageNote">练了 '+r.activeDays+' 天，正式作答 '+r.formalTotal+' 次（快速练习、听词、自动训练）。</p>'+strip+'</div>'+
      '<div class="vpSection"><div class="vpEmpty">只统计本机记录。没有测试过的词不算掌握，也不算遗忘；正确率只用正式训练的作答，课末自评单独列出。</div></div>';
  }
  // 本周: one-sentence conclusion, the long-term numbers (old 能力总览), this week's report, then the snapshot trend.
  function weekHTML(data){
    const ev=evidenceData(),active=ev.attempts?String(ev.active):'待积累',passive=ev.attempts?String(ev.passive):'待积累';
    let r=null;try{r=window.WeeklyMemoryReport&&window.WeeklyMemoryReport.compute()}catch(e){}
    const parts=[];
    if(r){parts.push('本周新学 '+r.newThisWeek+' 个词');if(r.recentTotal)parts.push('近 7 天新词已正式验证 '+r.verified+'/'+r.recentTotal);parts.push(r.retention.enough?'学后 7–30 天正确率 '+r.retention.rate+'%':'正确率样本不足');if(r.forgotten.length)parts.push('反复遗忘 '+r.forgotten.length+' 个');}
    if(weekDelta)parts.push('确认掌握近 '+weekDelta.days+' 天 '+(weekDelta.mastered>0?'+':'')+weekDelta.mastered);
    const adv=suggestions(data)[0];
    const conclusion='<div class="vpConclusion"><b>本周结论：</b>'+esc(parts.join('，'))+'。'+(adv&&adv[0]!=='继续观察'?'<br><b>'+esc(adv[0])+'：</b>'+esc(adv[1]):'')+'</div>';
    const totals='<div class="vpSection"><h3>总体情况</h3><div class="vpMiniStats"><div><b>'+data.taught_total+'</b><span>正式学习</span></div><div><b>'+data.confirmed_mastered+'</b><span>确认掌握</span></div><div><b>'+data.needs_reinforcement+'</b><span>待强化</span></div><div><b>'+data.unverified+'</b><span>尚待验证</span></div></div><div class="vpMiniStats"><div><b>'+active+'</b><span>本机验证的主动词汇</span></div><div><b>'+passive+'</b><span>本机稳定识别词汇</span></div><div><b>'+data.primary_eligible_new_total+'</b><span>主词库当前待学习</span></div><div><b>'+(ev.relearned||0)+'/'+(ev.forgotten||0)+'</b><span>再次通过 / 验证后又忘</span></div></div><p class="vpCoverageNote">主动词汇：无提示提取、语境补词、自我表达都完成，并在两个不同日期通过延迟验证。稳定识别：最近一次错误后至少三次正确、覆盖两个日期。两者不重复统计，也不把原有 mastered 自动算入。</p></div>';
    // 2026-10-25 phase-1 observation panel (read-only, data/ability-observation.js).
    const obsRaw=window.AbilityObservation?window.AbilityObservation.html():'';
    const obs=obsRaw?'<details class="vpObsFold"><summary>观察数据（两周观察期，不影响学习）</summary>'+obsRaw+'</details>':'';
    const diagnosis=window.WordDiagnosisUI?window.WordDiagnosisUI.detail(data):'';
    return conclusion+diagnosis+totals+weeklyHTML()+obs+'<div class="vpSection"><h3>掌握数趋势</h3>'+trendHTML(data)+'</div>';
  }
  function renderDetail(){
    const data=PROFILE,body=document.getElementById('vpDetailBody');if(!body||!data)return;
    activeTab=TAB_ALIAS[activeTab]||'today';
    body.innerHTML='<div class="vpDetailHero"><div><h2>个人词汇画像</h2><p>把学习结果、训练错误和后续验证汇总成一个持续更新的词汇能力档案。</p></div><span class="pill">网站快照＋本机训练</span></div>'+
      '<div class="vpTabs">'+[['today','今天'],['week','本周'],['words','查词']].map(x=>'<button class="vpTab '+(activeTab===x[0]?'active':'')+'" data-vp-tab="'+x[0]+'" type="button">'+x[1]+'</button>').join('')+'</div>'+
      '<section class="vpPanel '+(activeTab==='today'?'active':'')+'" data-vp-panel="today">'+(activeTab==='today'?todayHTML():'')+'</section>'+
      '<section class="vpPanel '+(activeTab==='week'?'active':'')+'" data-vp-panel="week">'+(activeTab==='week'?weekHTML(data):'')+'</section>'+
      '<section class="vpPanel '+(activeTab==='words'?'active':'')+'" data-vp-panel="words">'+(activeTab==='words'?wordsHTML():'')+'</section>';
    body.querySelectorAll('[data-vp-tab]').forEach(btn=>btn.onclick=()=>{activeTab=btn.dataset.vpTab;renderDetail()});
    bindCoachActions(body);wireWordSearch(body);
    if(activeTab==='week'&&window.AbilityObservation)window.AbilityObservation.refreshGoals();
    body.querySelectorAll('[data-vp-action]').forEach(btn=>btn.onclick=()=>{const word=btn.dataset.vpWord;if(btn.dataset.vpAction==='automation'&&typeof window.openAutomationTrainingWord==='function')window.openAutomationTrainingWord(word);else if(btn.dataset.vpAction==='quick'&&typeof window.openQuickPracticeWordV2==='function')window.openQuickPracticeWordV2(word)});
  }
  // 2026-10-14: a one-line 7-day change on the home card, so a stalled mastery count is visible without opening the trend tab.
  let weekDelta=null,weekDeltaLoading=false;
  function weekDeltaHTML(x){
    if(!x)return '';
    const sign=n=>(n>0?'+':'')+n,warn=x.taught>0&&x.mastered<=0;
    return '<span>近 '+x.days+' 天</span><b>正式学习 '+sign(x.taught)+'</b><b class="'+(warn?'vpWarn':'')+'">确认掌握 '+sign(x.mastered)+'</b><b>待强化 '+sign(x.needs)+'</b>';
  }
  async function renderWeekDelta(){
    const el=document.getElementById('vpWeekDelta');
    if(weekDelta){if(el)el.innerHTML=weekDeltaHTML(weekDelta);return}
    if(weekDeltaLoading)return;weekDeltaLoading=true;
    try{
      const res=await fetch('data/vocab-profile-history.json?v='+Date.now(),{cache:'no-store'});if(!res.ok)return;
      const rows=((await res.json()).snapshots||[]).filter(x=>x&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)).sort((a,b)=>a.date.localeCompare(b.date));
      if(rows.length<2)return;
      const last=rows[rows.length-1],cut=new Date(Date.parse(last.date+'T00:00:00Z')-7*86400000).toISOString().slice(0,10);
      const base=rows.filter(x=>x.date<=cut).pop()||rows[0];
      const days=Math.round((Date.parse(last.date)-Date.parse(base.date))/86400000);if(days<1)return;
      weekDelta={days,taught:last.taught_total-base.taught_total,mastered:last.confirmed_mastered-base.confirmed_mastered,needs:last.needs_reinforcement-base.needs_reinforcement};
      const now=document.getElementById('vpWeekDelta');if(now)now.innerHTML=weekDeltaHTML(weekDelta);
      const page=document.getElementById('vocabProfileDetail');if(activeTab==='week'&&page&&page.classList.contains('active'))renderDetail();
    }catch(e){}finally{weekDeltaLoading=false}
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
        const ex=Object.hasOwn(x,'excluded_from_training')?x.excluded_from_training:0; // snapshots before 2026-10-24 lack this field
        if(!Number.isSafeInteger(ex)||ex<0)throw new Error('Invalid history excluded count');
        if(x.confirmed_mastered+x.needs_reinforcement+x.unverified+ex!==x.taught_total)throw new Error('History partition mismatch');
        seen.add(x.date);rows.push(x);
      });
      if(PROFILE)PROFILE.history=rows.sort((a,b)=>a.date.localeCompare(b.date));
      historyState='ready';
    }catch(e){historyState='error';console.warn('vocab profile history unavailable',e)}
    renderDetail();
  }
  function openDetail(tab){if(typeof tab==='string'&&TAB_ALIAS[tab])activeTab=TAB_ALIAS[tab];ensureDetailPage();renderDetail();if(typeof window.go==='function')window.go('vocabProfileDetail');loadHistory()}
  window.openVocabProfileDetail=openDetail;
  function refreshCoachView(){markHomeDirty();renderHomeCoach();const page=document.getElementById('vocabProfileDetail');if(page&&page.classList.contains('active'))renderDetail()}
  window.addEventListener('vocab-coach-updated',refreshCoachView);
  window.addEventListener('vocab-profile-evidence-updated',refreshCoachView);
  async function load(){ensureStyle();try{const r=await fetch('data/vocab-profile.json?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);mount(await r.json())}catch(e){console.warn('vocab profile unavailable',e);const box=document.getElementById('vocabProfile');if(box)box.innerHTML='<h3 style="margin:0 0 5px;font-size:18px">个人词汇画像</h3><p style="margin:0;color:#667085;font-size:13px">暂时无法读取统计，其他学习模块可以正常使用。</p>';renderHomeCoach()}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
