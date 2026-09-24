(function(){
  'use strict';
  let PROFILE=null,activeTab='overview',activeWeak='';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const numOrPending=v=>Number.isFinite(Number(v))?String(v):'待验证';
  const signalLabel={automation_fail:'自动训练失败',quick_wrong:'快速练习答错',dont:'明确不会',fuzzy:'标记模糊',unknown:'陌生词',manual_unknown:'陌生词'};
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
      .vpActionRow{display:flex;gap:8px;flex-wrap:wrap;margin-top:13px}.vpActionRow button{border:0;border-radius:10px;padding:9px 12px;font-weight:800;cursor:pointer}.vpActionPrimary{background:#3157d5;color:#fff}.vpActionSoft{background:#eef1f6;color:#344054}
      @media(max-width:650px){.vpGrid,.vpMiniStats{grid-template-columns:repeat(2,1fr)}.vpFoot{flex-direction:column;gap:3px}.vpCoverageSummary{align-items:flex-start;flex-direction:column;gap:4px}.vpCoverageSummary span:last-child{white-space:normal}.vpAbility,.vpWeakList,.vpAdviceGrid{grid-template-columns:1fr}.vpDetailHero{flex-direction:column;gap:8px}}
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
    box.innerHTML='<div class="vpHead"><div><h3>个人词汇画像</h3><div class="muted">只统计正式学过的词，不把词库筛选或泛读路过当成掌握。</div></div><span class="pill">画像</span></div><div class="vpGrid"><div class="vpMetric"><b>'+data.taught_total+'</b><span>已正式学习</span></div><div class="vpMetric"><b>'+data.confirmed_mastered+'</b><span>已确认掌握</span></div><div class="vpMetric"><b>'+data.needs_reinforcement+'</b><span>待强化</span></div><div class="vpMetric"><b>'+data.unverified+'</b><span>尚待验证</span></div></div><div class="vpCoverageSummary"><span><b>主词库学习覆盖 '+data.primary_taught_unique+' / '+data.primary_master_total+' · '+data.primary_coverage_percent+'%</b> · 尚未正式学习 '+data.primary_unlearned_total+' 个</span><span>当前符合新词资格 '+data.primary_eligible_new_total+' 个</span></div><div class="vpProgress"><i style="width:'+Math.max(0,Math.min(100,Number(data.mastery_percent)||0))+'%"></i></div><div class="vpFoot"><span>已学词确认掌握进度 '+data.mastery_percent+'%</span><span>待强化词 '+data.needs_reinforcement+' 个</span></div>'+(focus.length?'<div class="vpFocus"><b>当前优先：</b> '+focus.map(x=>'<span class="vpChip" title="'+esc(x.cn||'')+'">'+esc(x.word)+'</span>').join('')+'</div>':'')+'<button class="vpOpen" type="button" id="openVocabProfile">查看完整词汇画像 →</button>';
    box.querySelector('#openVocabProfile').onclick=openDetail;
    ensureDetailPage();renderDetail();
  }
  function trendHTML(data){
    const rows=Array.isArray(data.history)?data.history:[];
    if(rows.length<2)return '<div class="vpEmpty"><b>趋势数据正在积累</b><br>当前只有一个可靠快照。至少形成两个不同日期的画像快照后，再显示真实的掌握增长和遗忘变化，不根据今天的数字倒推过去。</div>';
    const recent=rows.slice(-10),max=Math.max(...recent.map(x=>Number(x.taught_total||0)),1);
    return recent.map(x=>{const pct=Math.max(0,Math.min(100,Number(x.confirmed_mastered||0)/max*100));return '<div class="vpTrendRow"><span class="vpTrendDate">'+esc(x.date||'')+'</span><div class="vpTrendBar"><i style="width:'+pct+'%"></i></div><span class="vpTrendValue">'+Number(x.confirmed_mastered||0)+' 掌握</span></div>'}).join('');
  }
  function weakDetailHTML(w){
    if(!w)return '<div class="vpEmpty">点击上面的重点弱词，可以查看系统为什么把它排到前面。</div>';
    const sig=(w.signals||[]).map(x=>'<span class="vpSignal">'+esc(signalLabel[x]||x)+'</span>').join('');
    const advice=(w.signals||[]).includes('automation_fail')?'优先做主动提取和延迟验证；不要只重复看答案。':(w.signals||[]).includes('quick_wrong')?'先做短时识别练习，再回到主动提取验证。':'继续用间隔复现确认是否已经稳定。';
    return '<div class="vpWeakDetail"><b style="font-size:20px">'+esc(w.word)+'</b><div style="margin-top:4px;color:#475467">'+esc(w.cn||'')+'</div><div class="vpSignals">'+sig+'</div><div style="margin-top:11px;font-size:13px;line-height:1.6;color:#5f6c7d"><b>当前判断：</b>'+esc(advice)+'</div><div class="vpActionRow"><button class="vpActionPrimary" type="button" data-vp-action="automation">去自动训练</button><button class="vpActionSoft" type="button" data-vp-action="quick">去快速练习</button></div></div>';
  }
  function suggestions(data){
    const f=data.focus_words||[],counts={auto:0,quick:0,dont:0,fuzzy:0};
    f.forEach(w=>(w.signals||[]).forEach(s=>{if(s==='automation_fail')counts.auto++;if(s==='quick_wrong')counts.quick++;if(s==='dont')counts.dont++;if(s==='fuzzy')counts.fuzzy++;}));
    const out=[];
    if(counts.auto)out.push(['主动提取优先','当前重点弱词中有 '+counts.auto+' 个带有自动训练失败信号。接下来应优先练“看到意思就能主动调出印尼语”，而不是继续增加被动曝光。']);
    if(counts.quick)out.push(['识别稳定度仍需巩固','当前重点弱词中有 '+counts.quick+' 个近期快速练习答错。建议短时复现后再进入延迟验证。']);
    if(!out.length)out.push(['继续观察','当前证据还不足以判断主要瓶颈，先保持现有学习节奏，等待更多跨日记录。']);
    out.push(['新词数量先不自动调整','目前画像只给学习方向建议，不会擅自改变08:00或18:00的新词配额。']);
    return out;
  }
  function renderDetail(){
    const data=PROFILE,body=document.getElementById('vpDetailBody');if(!body||!data)return;
    const active=numOrPending(data.active_vocab),passive=numOrPending(data.passive_vocab);
    const focus=data.focus_words||[];if(activeWeak&&!focus.some(x=>x.word===activeWeak))activeWeak='';
    const chosen=focus.find(x=>x.word===activeWeak)||focus[0]||null;if(!activeWeak&&chosen)activeWeak=chosen.word;
    const adv=suggestions(data);
    body.innerHTML='<div class="vpDetailHero"><div><h2>个人词汇画像</h2><p>把学习结果、训练错误和后续验证汇总成一个持续更新的词汇能力档案。</p></div><span class="pill">第二版结构</span></div>'+
      '<div class="vpTabs">'+[['overview','能力总览'],['trend','学习趋势'],['weak','弱词分析'],['advice','学习建议']].map(x=>'<button class="vpTab '+(activeTab===x[0]?'active':'')+'" data-vp-tab="'+x[0]+'" type="button">'+x[1]+'</button>').join('')+'</div>'+
      '<section class="vpPanel '+(activeTab==='overview'?'active':'')+'" data-vp-panel="overview"><div class="vpAbility"><div class="vpAbilityCard"><span>主动词汇</span><b>'+active+'</b><small>需要无提示主动提取，并经过间隔验证。当前证据不足时保持“待验证”。</small></div><div class="vpAbilityCard"><span>被动识别词汇</span><b>'+passive+'</b><small>需要在词义或听觉识别中有稳定证据；单纯阅读曝光不计入。</small></div></div><div class="vpCoverageBox"><div class="vpCoverageHead"><b>主词库学习覆盖</b><span>'+data.primary_taught_unique+' / '+data.primary_master_total+' · '+data.primary_coverage_percent+'%</span></div><div class="vpCoverageTrack"><i style="width:'+Math.max(0,Math.min(100,Number(data.primary_coverage_percent)||0))+'%"></i></div><div class="vpCoverageMeta"><span>尚未正式学习 '+data.primary_unlearned_total+' 个</span><span>当前符合新词资格 '+data.primary_eligible_new_total+' 个</span></div><div class="vpCoverageNote">这里只统计977主词库的覆盖进度；“已正式学习”还可能包含口语或其他来源词，因此两个数字不强行视为同一集合。</div></div><div class="vpSection"><h3>已学习词状态</h3><div class="vpMiniStats"><div><b>'+data.taught_total+'</b><span>正式学习</span></div><div><b>'+data.confirmed_mastered+'</b><span>确认掌握</span></div><div><b>'+data.needs_reinforcement+'</b><span>待强化</span></div><div><b>'+data.unverified+'</b><span>尚待验证</span></div></div></div></section>'+
      '<section class="vpPanel '+(activeTab==='trend'?'active':'')+'" data-vp-panel="trend"><div class="vpSection"><h3>学习趋势</h3>'+trendHTML(data)+'</div><div class="vpSection"><h3>趋势原则</h3><div class="vpEmpty">只使用真实跨日快照和后续训练结果。未来会显示“新增稳定词、重新遗忘词、主动词汇增长”，不会用当前总数伪造历史曲线。</div></div></section>'+
      '<section class="vpPanel '+(activeTab==='weak'?'active':'')+'" data-vp-panel="weak"><div class="vpSection"><h3>重点弱词</h3><div class="vpWeakList">'+(focus.length?focus.map(w=>'<button type="button" class="vpWeakItem '+(w.word===activeWeak?'active':'')+'" data-vp-word="'+esc(w.word)+'"><b>'+esc(w.word)+'</b><span>'+esc(w.cn||'')+'</span></button>').join(''):'<div class="vpEmpty">暂无重点弱词。</div>')+'</div><div id="vpWeakDetail">'+weakDetailHTML(chosen)+'</div></div></section>'+
      '<section class="vpPanel '+(activeTab==='advice'?'active':'')+'" data-vp-panel="advice"><div class="vpAdviceGrid">'+adv.map(x=>'<div class="vpAdvice"><b>'+esc(x[0])+'</b><p>'+esc(x[1])+'</p></div>').join('')+'</div><div class="vpSection"><h3>判断边界</h3><div class="vpEmpty">划词查询只算弱线索；明确加入陌生词、自动训练失败、快速练习答错等是更强证据。一次答对或一次阅读曝光不会直接判为“掌握”。</div></div></section>';
    body.querySelectorAll('[data-vp-tab]').forEach(btn=>btn.onclick=()=>{activeTab=btn.dataset.vpTab;renderDetail()});
    body.querySelectorAll('[data-vp-word]').forEach(btn=>btn.onclick=()=>{activeWeak=btn.dataset.vpWord;activeTab='weak';renderDetail()});
    body.querySelectorAll('[data-vp-action]').forEach(btn=>btn.onclick=()=>{if(btn.dataset.vpAction==='automation'&&typeof window.openAutomationTraining==='function')window.openAutomationTraining();else if(btn.dataset.vpAction==='quick'&&typeof window.openQuickPracticeV2==='function')window.openQuickPracticeV2()});
  }
  function openDetail(){ensureDetailPage();renderDetail();if(typeof window.go==='function')window.go('vocabProfileDetail')}
  window.openVocabProfileDetail=openDetail;
  async function load(){ensureStyle();try{const r=await fetch('data/vocab-profile.json?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);mount(await r.json())}catch(e){console.warn('vocab profile unavailable',e);const box=document.getElementById('vocabProfile');if(box)box.innerHTML='<h3 style="margin:0 0 5px;font-size:18px">个人词汇画像</h3><p style="margin:0;color:#667085;font-size:13px">暂时无法读取统计，其他学习模块可以正常使用。</p>'}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
