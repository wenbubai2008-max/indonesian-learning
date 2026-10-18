// 2026-10-18 (user-approved step 2): 带学模式. A step-by-step view over the lesson that is already on the page — it
// creates no new words, questions or answers. Opened from the 今天的重点 card (lessons with lesson_focus only); the
// full page stays as it is and the learner can go back to it at any time. The guided flow ends by sending the learner
// back to the page for the original quiz, lesson-end recall and 「我学完了」.
// AM: 重点 → 3 focus words → other words → 2 patterns → reading → back to the page.
// PM: quick check of this morning's focus → 重点 → 3 focus words → other words → dialogue practice → 2 patterns →
//     reading → back to the page (rewrite, test, review, recall).
// Progress lives only in indo_guided_lesson_v1 (this device). It never writes training results, lesson errors, recall
// answers or mastery.
(function(){
  if(window.__guidedLessonLoaded)return;
  window.__guidedLessonLoaded=true;
  const KEY='indo_guided_lesson_v1',KEEP=30;
  const norm=s=>String(s||'').trim().toLowerCase();
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cleanCn=s=>String(s||'').replace(/（[^）]*=[^）]*）/g,'').trim(); // drop "（udah = sudah）" glosses from prompts
  function jkt(t){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t))}
  function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'{}');return {version:1,lessons:x&&x.lessons&&typeof x.lessons==='object'?x.lessons:{},days:Array.isArray(x&&x.days)?x.days:[]}}catch(e){return {version:1,lessons:{},days:[]}}}
  function save(s){try{const ids=Object.keys(s.lessons).sort();ids.slice(0,Math.max(0,ids.length-KEEP)).forEach(k=>delete s.lessons[k]);s.days=[...new Set(s.days)].sort().slice(-120);localStorage.setItem(KEY,JSON.stringify(s))}catch(e){}}
  function streak(days,today){const set=new Set(days);let n=0,d=today;while(set.has(d)){n++;d=new Date(Date.parse(d+'T00:00:00Z')-86400000).toISOString().slice(0,10)}return n}

  // ---------- step plan (pure; tested in test-guided-lesson.js) ----------
  function cardFor(lesson,w){return (lesson&&lesson.vocab||[]).find(v=>norm(v&&v.word)===norm(w))||null}
  function dbFor(w){return (window.DAILY_VOCAB_DB||[]).find(v=>norm(v&&v.word)===norm(w))||null}
  function wordInfo(lesson,w){const c=cardFor(lesson,w)||dbFor(w)||{};return {w,cn:c.cn||'',ex:c.example||'',excn:c.example_cn||'',say:c.audio_text||w}}
  function sentencesOf(t){return String(t||'').match(/[^.!?]+[.!?]+["”’]?|[^.!?]+$/g)||[]}
  function buildSteps(x,am){
    const f=x&&x.lesson_focus;if(!f||!Array.isArray(f.words)||!Array.isArray(f.patterns))return [];
    const focus=new Set(f.words.map(norm)),steps=[];
    if(x.session==='pm'&&am&&am.lesson_focus&&Array.isArray(am.lesson_focus.words)&&am.lesson_focus.words.length)
      steps.push({type:'amcheck',items:am.lesson_focus.words.map(w=>wordInfo(am,w))});
    steps.push({type:'overview',words:f.words.map(w=>wordInfo(x,w)),patterns:f.patterns});
    f.words.forEach(w=>steps.push({type:'word',...wordInfo(x,w)}));
    const rest=(x.vocab||[]).filter(v=>v&&v.word&&!focus.has(norm(v.word))).map(v=>({w:v.word,cn:v.cn||''}));
    if(rest.length)steps.push({type:'rest',items:rest});
    const lines=x.dialogue&&Array.isArray(x.dialogue.lines)?x.dialogue.lines.filter(l=>l&&l.id&&l.cn):[];
    if(x.session==='pm'&&lines.length>=4){
      // The learner speaks for the character whose lines use the most focus words (ties: the second speaker).
      const speakers=[...new Set(lines.map(l=>l.speaker||''))];
      const score=sp=>lines.filter(l=>l.speaker===sp).reduce((n,l)=>n+[...focus].filter(w=>norm(l.id).includes(w)).length,0);
      const me=speakers.slice().sort((a,b)=>score(b)-score(a)||speakers.indexOf(b)-speakers.indexOf(a))[0];
      const turns=lines.slice(0,10);
      if(turns.some(l=>l.speaker===me))steps.push({type:'dialogue',title:x.dialogue.title||'',me,turns});
    }
    f.patterns.forEach(p=>steps.push({type:'pattern',...p}));
    if(x.reading&&x.reading.text){
      const text=x.reading.text,keySet=new Set(f.words.map(norm));
      const keys=[];(x.vocab||[]).forEach(v=>{const k=norm(v&&v.word);if(k&&norm(text).includes(k)&&!keys.includes(v.word))keys.push(v.word)});
      const ordered=keys.sort((a,b)=>norm(text).indexOf(norm(a))-norm(text).indexOf(norm(b))).slice(0,8);
      const sents=sentencesOf(text).map(s=>s.trim()).filter(Boolean);
      const marks=sents.filter(s=>[...keySet].some(w=>norm(s).includes(w))||f.patterns.some(p=>norm(s).includes(norm(p.example)))).slice(0,3);
      steps.push({type:'reading',text,cn:x.reading.cn||'',keys:ordered,marks});
    }
    steps.push({type:'finish'});
    return steps;
  }

  // ---------- recording (optional; hidden when the browser has no recorder) ----------
  const canRecord=()=>!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia&&window.MediaRecorder);
  let rec=null,recUrl='';
  async function recordToggle(btn){
    if(rec&&rec.state==='recording'){rec.stop();return}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true}),chunks=[];
      rec=new MediaRecorder(stream);rec.ondataavailable=e=>chunks.push(e.data);
      rec.onstop=()=>{stream.getTracks().forEach(t=>t.stop());if(recUrl)URL.revokeObjectURL(recUrl);recUrl=URL.createObjectURL(new Blob(chunks,{type:rec.mimeType||'audio/webm'}));btn.textContent='🎙 重录';const play=btn.parentElement.querySelector('[data-g-play]');if(play)play.hidden=false;rec=null};
      rec.start();btn.textContent='■ 停止录音';setTimeout(()=>{if(rec&&rec.state==='recording')rec.stop()},10000);
    }catch(e){btn.textContent='无法使用麦克风';btn.disabled=true}
  }
  function playMine(){if(recUrl){try{new Audio(recUrl).play()}catch(e){}}}

  // ---------- view ----------
  let lesson=null,steps=[],id='',state=null,timer=null;
  const $=s=>document.querySelector(s);
  function css(){
    if(document.getElementById('guidedLessonStyle'))return;
    const st=document.createElement('style');st.id='guidedLessonStyle';
    st.textContent=`
    .glOverlay{position:fixed;inset:0;z-index:2000;background:#f3f5fa;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:max(14px,env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) max(28px,env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px))}
    .glWrap{max-width:680px;margin:0 auto;display:flex;flex-direction:column;gap:12px}
    .glTop{display:flex;justify-content:space-between;align-items:center;gap:10px}.glTop b{font-size:15px;color:#172033}.glTop small{color:#667085;font-size:12.5px}
    .glExit{border:1px solid #dfe4ef;background:#fff;border-radius:10px;padding:7px 12px;font:inherit;font-size:14px;cursor:pointer;color:#344054;white-space:nowrap}
    .glRail{display:flex;gap:4px}.glRail i{flex:1;height:6px;border-radius:3px;background:#dfe4ef}.glRail i.done{background:#3157d5}.glRail i.now{background:#d48a1c}
    .glCard{background:#fff;border:1px solid #e0e5ef;border-radius:18px;padding:20px 18px;display:flex;flex-direction:column;gap:14px;text-align:left}
    .glEyebrow{font-size:12px;font-weight:800;color:#7b8598;letter-spacing:.05em}
    .glCard h2{margin:0;font-size:20px;line-height:1.35;color:#172033}
    .glBig{font-size:32px;font-weight:850;color:#172033;letter-spacing:-.01em;overflow-wrap:anywhere;line-height:1.2}
    .glCn{color:#5d6782}.glHint{font-size:14px;color:#667085;margin:0}
    .glPh{display:flex;gap:6px;flex-wrap:wrap}.glPh span{font-size:12.5px;padding:3px 10px;border-radius:999px;background:#f3f5fa;color:#667085;border:1px solid #e0e5ef}.glPh span.on{background:#fdf2e1;color:#a2610b;border-color:transparent;font-weight:700}.glPh span.ok{background:#e6f5ec;color:#1f8a57;border-color:transparent}
    .glRow{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .glBtn{font:inherit;cursor:pointer;border-radius:11px;border:1px solid #dfe4ef;background:#fff;color:#172033;padding:10px 15px}
    .glBtn.pri{background:#3157d5;border-color:#3157d5;color:#fff;font-weight:700}.glBtn.say{border:0;background:#eaf0fe;color:#3157d5;font-weight:700}
    .glBtn:disabled{opacity:.5;cursor:default}
    .glEx{border-left:3px solid #e0e5ef;padding-left:12px}.glEx .id{color:#285a94;font-weight:650}.glEx .zh{color:#786554;font-size:14.5px}
    .glCover{border:2px dashed #dfe4ef;border-radius:14px;padding:16px;text-align:center}.glCover .q{font-size:21px;font-weight:800;color:#172033}
    .glReveal{background:#e6f5ec;border-radius:12px;padding:11px 13px}.glReveal.miss{background:#fbe9e4}
    .glGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.glGrid>div{background:#fdf6ea;border-radius:12px;padding:10px;text-align:center;min-width:0}.glGrid b{display:block;font-size:18px;overflow-wrap:anywhere}.glGrid small{color:#7a6a55}
    .glPat{background:#f5f7fb;border-radius:12px;padding:10px 12px}.glPat b{color:#172033}.glPat span{color:#667085;margin-left:6px;font-size:14px}
    .glQuick{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.glQuick button{text-align:left;display:flex;flex-direction:column;gap:2px;padding:9px 11px;min-width:0;font:inherit;border:1px solid #dfe4ef;border-radius:11px;background:#fff;cursor:pointer}.glQuick b{color:#172033;overflow-wrap:anywhere}.glQuick small{color:#667085}.glQuick button.know{border-color:#1f8a57;background:#e6f5ec}.glQuick button.weak{border-color:#b4462f;background:#fbe9e4}
    .glPara{line-height:1.9;color:#26364f}.glPara mark{background:#fbeccf;color:inherit;border-radius:3px;padding:0 2px}.glPara.blur{filter:blur(6px);user-select:none}
    .glKeys{display:flex;flex-wrap:wrap;gap:6px}.glKeys span{background:#eaf0fe;color:#3157d5;border-radius:8px;padding:3px 10px;font-size:14px;font-weight:650}
    .glTimer{font-size:40px;font-weight:850;text-align:center;font-variant-numeric:tabular-nums;color:#172033}
    .glTurn{border-radius:12px;padding:10px 12px;background:#f5f7fb}.glTurn.me{background:#fdf6ea}.glTurn small{display:block;font-size:12px;color:#7b8598;font-weight:700}
    .glStats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.glStats div{background:#f5f7fb;border-radius:12px;padding:10px;text-align:center}.glStats b{display:block;font-size:22px;font-variant-numeric:tabular-nums}.glStats small{color:#667085;font-size:12px}
    .glNav{display:flex;justify-content:space-between;gap:8px}
    .lfStart{margin-top:12px;border:0;border-radius:11px;background:#3157d5;color:#fff;font:inherit;font-weight:750;padding:10px 16px;cursor:pointer}
    @media(max-width:520px){.glGrid,.glQuick{grid-template-columns:1fr}.glBig{font-size:28px}}`;
    document.head.appendChild(st);
  }
  const sayBtn=(t,label)=>'<button type="button" class="glBtn say" data-g-say="'+esc(t)+'">🔊 '+(label||'听')+'</button>';
  const recBtns=()=>canRecord()?'<span class="glRow"><button type="button" class="glBtn" data-g-rec>🎙 录下我读的</button><button type="button" class="glBtn" data-g-play hidden>▶ 听我的</button></span>':'';
  function phases(names,ph){return '<div class="glPh">'+names.map((n,i)=>'<span class="'+(i<ph?'ok':i===ph?'on':'')+'">'+(i<ph?'✓ ':'')+n+'</span>').join('')+'</div>'}
  const next=(label)=>'<button type="button" class="glBtn pri" data-g="next">'+(label||'下一步 →')+'</button>';
  const ph=(label)=>'<button type="button" class="glBtn pri" data-g="phase">'+label+'</button>';

  function viewStep(s){
    const p=state.phase,r=state.res||(state.res={});
    if(s.type==='amcheck'){
      const i=Math.min(state.sub||0,s.items.length-1),it=s.items[i],got=r['am:'+it.w];
      return '<div class="glEyebrow">先快检今天早课的重点 · '+(i+1)+' / '+s.items.length+'</div><div class="glCover"><p class="glHint">看中文，说出印尼语</p><div class="q">'+esc(cleanCn(it.cn).split('；')[0])+'</div></div>'+
        (got?'<div class="glReveal'+(got==='miss'?' miss':'')+'"><span class="glBig" style="font-size:24px">'+esc(it.w)+'</span> '+sayBtn(it.say)+'</div><div class="glRow">'+(i<s.items.length-1?'<button type="button" class="glBtn pri" data-g="sub">下一个 →</button>':next('开始晚课 →'))+'</div>'
        :'<div class="glRow"><button type="button" class="glBtn pri" data-g="got" data-k="am:'+esc(it.w)+'">想到了</button><button type="button" class="glBtn" data-g="miss" data-k="am:'+esc(it.w)+'">想不出</button></div>');
    }
    if(s.type==='overview')return '<div class="glEyebrow">今天的重点</div><h2>这节课带走 3 个词、2 个句型，其余认识就行</h2><div class="glGrid">'+s.words.map(w=>'<div><b>'+esc(w.w)+'</b><small>'+esc(cleanCn(w.cn).split('；')[0])+'</small></div>').join('')+'</div>'+
      s.patterns.map(x=>'<div class="glPat"><b>'+esc(x.pattern)+'</b><span>'+esc(x.cn)+'</span></div>').join('')+'<div class="glRow">'+next('开始 →')+'</div>';
    if(s.type==='word'){
      const names=['听','跟读','盖住说出来'];let h='<div class="glEyebrow">重点词</div>'+phases(names,p);
      if(p<2)h+='<div class="glBig">'+esc(s.w)+'</div><div class="glCn">'+esc(s.cn)+'</div>'+(s.ex?'<div class="glEx"><div class="id">'+esc(s.ex)+'</div><div class="zh">'+esc(s.excn)+'</div></div>':'');
      if(p===0)h+='<div class="glRow">'+sayBtn(s.say,'听单词')+(s.ex?sayBtn(s.ex,'听例句'):'')+ph('听过了 →')+'</div>';
      if(p===1)h+='<p class="glHint">出声跟读：单词一遍，例句一遍。可以录下来和标准读音对比。</p><div class="glRow">'+(s.ex?sayBtn(s.ex,'再听例句'):sayBtn(s.say,'再听'))+recBtns()+ph('读完了 →')+'</div>';
      if(p===2){const got=r[s.w];h+='<div class="glCover"><p class="glHint">看中文，说出印尼语</p><div class="q">'+esc(cleanCn(s.cn).split('；')[0])+'</div></div>'+
        (got?'<div class="glReveal'+(got==='miss'?' miss':'')+'"><span class="glBig" style="font-size:24px">'+esc(s.w)+'</span> '+sayBtn(s.say)+'<p class="glHint">'+(got==='miss'?'没关系，课末回想和明天的训练会再问到它。':'很好，这个词先过关。')+'</p></div><div class="glRow">'+next()+'</div>'
        :'<div class="glRow"><button type="button" class="glBtn pri" data-g="got" data-k="'+esc(s.w)+'">想到了</button><button type="button" class="glBtn" data-g="miss" data-k="'+esc(s.w)+'">想不出</button></div>');}
      return h;
    }
    if(s.type==='rest'){const m=r.rest||(r.rest={});return '<div class="glEyebrow">其余的词 · 认识就行</div><h2>扫一眼，不熟的点一下</h2><p class="glHint">点一次 = 认识（绿），再点 = 不熟（红）。只是给你自己看，不影响训练记录。</p><div class="glQuick">'+
      s.items.map(it=>'<button type="button" data-g-rest="'+esc(it.w)+'" class="'+(m[it.w]||'')+'"><b>'+esc(it.w)+'</b><small>'+esc(cleanCn(it.cn).split('；')[0])+'</small></button>').join('')+'</div><div class="glRow">'+next()+'</div>';}
    if(s.type==='dialogue'){
      const i=Math.min(state.sub||0,s.turns.length-1),t=s.turns[i],mine=t.speaker===s.me,shown=r['d'+i];
      let h='<div class="glEyebrow">对话练习 · 你来说 '+esc(s.me)+' 的台词 · '+(i+1)+' / '+s.turns.length+'</div>'+(s.title?'<h2>'+esc(s.title)+'</h2>':'');
      const prev=i>0?s.turns[i-1]:null;if(prev)h+='<div class="glTurn'+(prev.speaker===s.me?' me':'')+'"><small>'+esc(prev.speaker)+'</small>'+esc(prev.id)+' '+sayBtn(prev.id)+'<div class="glCn" style="font-size:13.5px">'+esc(cleanCn(prev.cn))+'</div></div>';
      if(!mine)h+='<div class="glTurn"><small>'+esc(t.speaker)+'</small>'+esc(t.id)+' '+sayBtn(t.id)+'<div class="glCn">'+esc(t.cn)+'</div></div><div class="glRow">'+(i<s.turns.length-1?'<button type="button" class="glBtn pri" data-g="sub">下一句 →</button>':next())+'</div>';
      else if(!shown)h+='<div class="glTurn me"><small>轮到你（'+esc(s.me)+'）：先用印尼语说出来</small><b>'+esc(cleanCn(t.cn))+'</b></div><div class="glRow"><button type="button" class="glBtn pri" data-g="show" data-k="d'+i+'">说完了，看原句</button></div>';
      else h+='<div class="glTurn me"><small>'+esc(s.me)+' 的原句</small>'+esc(t.id)+' '+sayBtn(t.id)+'<div class="glCn">'+esc(t.cn)+'</div></div><div class="glRow">'+(i<s.turns.length-1?'<button type="button" class="glBtn pri" data-g="sub">下一句 →</button>':next())+'</div>';
      return h;
    }
    if(s.type==='pattern'){
      const names=['听','跟读两遍','看中文说出来','换成你自己的话'];let h='<div class="glEyebrow">重点句型</div>'+phases(names,p)+'<div class="glPat"><b>'+esc(s.pattern)+'</b><span>'+esc(s.cn)+'</span></div>';
      if(p<2)h+='<div class="glEx"><div class="id">'+esc(s.example)+'</div><div class="zh">'+esc(s.example_cn)+'</div></div>';
      if(p===0)h+='<div class="glRow">'+sayBtn(s.example,'听句子')+ph('听过了 →')+'</div>';
      if(p===1)h+='<p class="glHint">跟着读两遍，第二遍试着不看。</p><div class="glRow">'+sayBtn(s.example,'再听')+recBtns()+ph('读完两遍 →')+'</div>';
      if(p===2)h+='<div class="glCover"><p class="glHint">看中文，说出整句印尼语</p><div class="q" style="font-size:18px">'+esc(cleanCn(s.example_cn))+'</div></div><div class="glRow"><button type="button" class="glBtn" data-g="show" data-k="pat'+state.step+'">看原句</button>'+ph('说出来了 →')+'</div>'+(r['pat'+state.step]?'<div class="glReveal">'+esc(s.example)+' '+sayBtn(s.example)+'</div>':'');
      if(p===3)h+='<p style="margin:0"><b>用「'+esc(s.pattern)+'」说一句你自己的话</b></p><p class="glHint">换掉人、地点或事情，说你生活里真实的事。说不出来就先改一个词。想确认说得对不对，可以记下来以后问老师。</p><div class="glRow">'+recBtns()+next()+'</div>';
      return h;
    }
    if(s.type==='reading'){
      const names=['先听不看','看中文大意','抓重点句','30 秒复述'];let h='<div class="glEyebrow">课文</div>'+phases(names,p);
      if(p===0)h+='<p class="glHint">先只听，不看文字。能听出几个今天的词就够了。</p><p class="glPara blur" aria-hidden="true">'+esc(s.text)+'</p><div class="glRow">'+sayBtn(s.text,'听全文')+ph('听完了 →')+'</div>';
      if(p===1)h+='<p class="glPara" style="margin:0">'+esc(s.cn)+'</p><div class="glRow">'+ph('知道大意了 →')+'</div>';
      if(p===2){let html=esc(s.text);s.marks.forEach(m=>{const e=esc(m);html=html.replace(e,'<mark>'+e+'</mark>')});h+='<p class="glHint">只抓标黄的'+(s.marks.length||'')+'句，其余看懂就行。</p><p class="glPara" style="margin:0">'+html+'</p><div class="glRow">'+sayBtn(s.text,'边看边听')+ph('开始复述 →')+'</div>';}
      if(p===3)h+='<p style="margin:0"><b>看着关键词，用 30 秒把内容讲一遍。</b>说错没关系，重点是开口。</p><div class="glKeys">'+s.keys.map(k=>'<span>'+esc(k)+'</span>').join('')+'</div><div class="glTimer" id="glTimer">30</div><div class="glRow">'+recBtns()+next('讲完了 →')+'</div>';
      return h;
    }
    // finish
    const words=steps.filter(x=>x.type==='word'),got=words.filter(w=>r[w.w]==='got').length,weak=Object.values(r.rest||{}).filter(v=>v==='weak').length;
    const st=load(),days=streak(st.days,jkt(Date.now()));
    return '<div class="glEyebrow">带学完成</div><h2>✓ 重点都过了一遍</h2><div class="glStats"><div><b>'+got+'/'+words.length+'</b><small>重点词想到了</small></div><div><b>'+weak+'</b><small>其余词标为不熟</small></div><div><b>'+days+'</b><small>连续带学天数（本机）</small></div></div>'+
      '<p class="glHint">接下来回到整页：'+(lesson.session==='pm'?'做主动改写、当日小测和复盘，':'做小测，')+'再做课末回想，最后点「我学完了」。</p><div class="glRow"><button type="button" class="glBtn pri" data-g="toPage">回到整页继续 →</button></div>';
  }
  function render(){
    clearInterval(timer);
    const s=steps[state.step];if(!s)return;
    const box=$('#glOverlay');if(!box)return;
    box.innerHTML='<div class="glWrap"><div class="glTop"><div><b>带学 · '+esc(lesson.session==='pm'?'晚课':'早课')+'</b><br><small>第 '+(state.step+1)+' / '+steps.length+' 步 · 约 15 分钟 · 随时可以回到整页</small></div><button type="button" class="glExit" data-g="exit">回到整页</button></div>'+
      '<div class="glRail">'+steps.map((_,i)=>'<i class="'+(i<state.step?'done':i===state.step?'now':'')+'"></i>').join('')+'</div>'+
      '<section class="glCard">'+viewStep(s)+'</section>'+
      '<div class="glNav"><button type="button" class="glExit" data-g="back"'+(state.step===0&&!state.phase&&!state.sub?' disabled':'')+'>← 上一步</button>'+(s.type!=='finish'?'<button type="button" class="glExit" data-g="skip">跳过这一步 →</button>':'')+'</div></div>';
    if(s.type==='reading'&&state.phase===3){let n=30;timer=setInterval(()=>{n--;const t=document.getElementById('glTimer');if(!t){clearInterval(timer);return}t.textContent=n>0?n:'时间到';if(n<=0)clearInterval(timer)},1000)}
    persist();
  }
  function persist(){const st=load();st.lessons[id]=Object.assign({},st.lessons[id]||{},{step:state.step,phase:state.phase,sub:state.sub||0,res:state.res||{},updated_at:new Date().toISOString()});save(st)}
  function go(step){state.step=Math.max(0,Math.min(steps.length-1,step));state.phase=0;state.sub=0;if(steps[state.step].type==='finish')finishLesson();render();const o=$('#glOverlay');if(o)o.scrollTop=0}
  function finishLesson(){const st=load();const l=st.lessons[id]||{};l.finished_at=l.finished_at||new Date().toISOString();st.lessons[id]=l;st.days.push(jkt(Date.now()));save(st)}
  function close(toPage){
    clearInterval(timer);const o=$('#glOverlay');if(o)o.remove();document.documentElement.style.overflow='';
    if(toPage){const body=document.getElementById('dailyBody');const h=body&&[...body.querySelectorAll('.dailyFixSec h3')].find(x=>/小测|改写/.test(x.textContent));if(h)h.closest('.dailyFixSec').scrollIntoView({behavior:'smooth',block:'start'})}
  }
  async function open(date,session){
    css();
    const fetchJ=window.fetchJSON||(p=>fetch(p).then(r=>r.json()));
    lesson=await fetchJ('data/daily/'+date+'-'+session+'.json');
    let am=null;if(session==='pm'){try{am=await fetchJ('data/daily/'+date+'-am.json')}catch(e){}}
    steps=buildSteps(lesson,am);if(!steps.length)return;
    id=date+'-'+session;
    const saved=load().lessons[id];
    state={step:0,phase:0,sub:0,res:{}};
    if(saved&&!saved.finished_at&&Number.isInteger(saved.step)&&saved.step<steps.length){state={step:saved.step,phase:saved.phase||0,sub:saved.sub||0,res:saved.res||{}}}
    let o=$('#glOverlay');if(!o){o=document.createElement('div');o.id='glOverlay';o.className='glOverlay';o.setAttribute('role','dialog');o.setAttribute('aria-label','带学模式');document.body.appendChild(o)}
    document.documentElement.style.overflow='hidden';
    render();
  }
  document.addEventListener('click',e=>{
    const start=e.target.closest&&e.target.closest('[data-guided-start]');
    if(start){const m=String(start.dataset.guidedStart||'').match(/^(\d{4}-\d{2}-\d{2})-(am|pm)$/);if(m)open(m[1],m[2]);return}
    const o=e.target.closest&&e.target.closest('#glOverlay');if(!o)return;
    const b=e.target.closest('button');if(!b||b.disabled)return;
    if(b.dataset.gSay){try{window.speak&&window.speak(b.dataset.gSay)}catch(err){}return}
    if(b.hasAttribute('data-g-rec')){recordToggle(b);return}
    if(b.hasAttribute('data-g-play')){playMine();return}
    if(b.dataset.gRest){const m=state.res.rest||(state.res.rest={}),w=b.dataset.gRest;m[w]=m[w]==='know'?'weak':m[w]==='weak'?'':'know';b.className=m[w]||'';persist();return}
    const a=b.dataset.g;if(!a)return;
    if(a==='next'||a==='skip')go(state.step+1);
    else if(a==='phase'){state.phase++;render()}
    else if(a==='sub'){state.sub=(state.sub||0)+1;render()}
    else if(a==='got'||a==='miss'||a==='show'){state.res[b.dataset.k]=a==='show'?'shown':a;render()}
    else if(a==='back'){if(state.phase>0)state.phase--;else if(state.sub>0)state.sub--;else if(state.step>0){state.step--;state.phase=0;state.sub=0}render()}
    else if(a==='exit')close(false);
    else if(a==='toPage')close(true);
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#glOverlay'))close(false)});
  css();
  window.GuidedLesson={buildSteps,open,streak};
})();
