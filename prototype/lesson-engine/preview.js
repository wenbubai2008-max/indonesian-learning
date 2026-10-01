(() => {
  'use strict';
  const $=s=>document.querySelector(s),app=$('#app');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const wc=s=>String(s||'').trim().split(/\s+/).filter(Boolean).length;
  let bundle=null,contexts={};

  async function fetchJson(url){
    const r=await fetch(url+'?ts='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw Error(url+' '+r.status);
    return r.json();
  }
  async function load(){
    app.innerHTML='<section class="hero">正在读取素材库和 AM/PM 测试 context…</section>';
    try{
      const [b,am,pm]=await Promise.all([
        fetchJson('./materials/materials-bundle.json'),
        fetchJson('./fixtures/context-2026-10-01-am.json'),
        fetchJson('./fixtures/context-2026-10-01-pm.json')
      ]);
      bundle=b;contexts={am,pm};renderCurrent();
    }catch(e){
      app.innerHTML='<section class="error">测试页读取失败：'+esc(e.message||e)+'\n\n不会影响正式课程。</section>';
    }
  }
  function speak(text){
    if(!('speechSynthesis' in window))return alert('当前浏览器不支持语音播放。');
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);u.lang='id-ID';u.rate=.86;
    speechSynthesis.speak(u);
  }
  function groupCounts(lesson){
    const v=lesson.vocab||[];
    if(lesson.session==='am')return {new:v.length,review:(lesson.review_vocab||[]).length,application:0,total:v.length+(lesson.review_vocab||[]).length};
    return {
      new:v.filter(x=>x.source_group==='new').length,
      review:v.filter(x=>x.source_group==='review').length,
      application:v.filter(x=>x.source_group==='application').length,
      total:v.length
    };
  }
  function coverageWords(lesson,kind){
    return (lesson._prototype?.[kind]||[]).map(x=>x.word);
  }
  function checks(lesson,ctx){
    const c=groupCounts(lesson),q=lesson.daily_test?.questions||[],out=[];
    const legalNew=new Set([...(ctx.candidates?.new_dont||[]),...(ctx.candidates?.new_fuzzy||[])].map(x=>String(x[0]).toLowerCase()));
    const newWords=lesson.session==='am'?(lesson.vocab||[]).map(x=>x.word):(lesson.vocab||[]).filter(x=>x.source_group==='new').map(x=>x.word);
    out.push(['新词全部来自合法池',newWords.every(x=>legalNew.has(String(x).toLowerCase())),'hard']);
    out.push(['核心词无重复',new Set((lesson.vocab||[]).map(x=>x.word)).size===(lesson.vocab||[]).length,'hard']);
    out.push(['阅读80–120词',wc(lesson.reading?.text)>=80&&wc(lesson.reading?.text)<=120,'hard']);
    if(lesson.session==='am'){
      out.push(['AM恰好10个新词',c.new===10,'hard']);
      out.push(['AM review 4–6',c.review>=4&&c.review<=6,'hard']);
      out.push(['AM 5句双语句',lesson.sentences?.length===5,'hard']);
      out.push(['AM 3题 quiz',lesson.quiz?.length===3,'hard']);
      out.push(['AM 最后3个复盘重点',Array.isArray(lesson.review)&&lesson.review.length===3,'hard']);
      out.push(['阅读自然复现≥6个新词',coverageWords(lesson,'reading_coverage').filter(w=>newWords.includes(w)).length>=6,'soft']);
    }else{
      out.push(['PM核心词10–12',c.total>=10&&c.total<=12,'hard']);
      out.push(['PM新词3–4',c.new>=3&&c.new<=4,'hard']);
      out.push(['PM review 4–6',c.review>=4&&c.review<=6,'hard']);
      out.push(['PM application 2–3',c.application>=2&&c.application<=3,'hard']);
      out.push(['PM 对话≥4句',lesson.dialogue?.lines?.length>=4,'hard']);
      out.push(['PM rewrite 3–4',lesson.rewrite?.length>=3&&lesson.rewrite?.length<=4,'hard']);
      out.push(['PM 6题=3选择+2填空+1排序',q.length===6&&q.filter(x=>x.type==='choice').length===3&&q.filter(x=>x.type==='fill').length===2&&q.filter(x=>x.type==='order').length===1,'hard']);
      const readingNew=coverageWords(lesson,'reading_coverage').filter(w=>newWords.includes(w)).length;
      const dialogueNew=coverageWords(lesson,'dialogue_coverage').filter(w=>newWords.includes(w)).length;
      out.push(['阅读覆盖全部/大部分新词',readingNew>=Math.min(3,newWords.length),'soft']);
      out.push(['对话至少复现2个新词',dialogueNew>=Math.min(2,newWords.length),'soft']);
    }
    return out;
  }
  function renderTaskList(title,items,answerKey){
    if(!items?.length)return '';
    return '<section class="card section"><h2>'+esc(title)+'</h2><div class="tasks">'+items.map((x,i)=>{
      const task=x.task||x.prompt||x.question||String(x);
      const ans=x[answerKey]||x.reference_answer||x.answer||'';
      return '<div class="task"><b>'+(i+1)+'.</b> '+esc(task)+(ans?'<div class="answer">参考：'+esc(ans)+'</div>':'')+'</div>';
    }).join('')+'</div></section>';
  }
  function render(lesson,ctx,variant){
    const c=groupCounts(lesson),checksArr=checks(lesson,ctx);
    const readingCoverage=coverageWords(lesson,'reading_coverage');
    const dialogueCoverage=coverageWords(lesson,'dialogue_coverage');
    const cards=(lesson.vocab||[]).map(v=>{
      const g=lesson.session==='am'?'new':v.source_group;
      return '<article class="word"><div class="word-head"><div class="word-title">'+esc(v.word)+
        '<button class="sound" data-audio="'+esc(v.audio_text||v.word)+'" title="播放印尼语发音">🔊</button></div><span class="group">'+esc(g)+'</span></div>'+
        '<div class="word-cn">'+esc(v.cn)+'</div>'+
        (v.root?'<div class="word-note">词根：'+esc(v.root)+(v.root_cn?' · '+esc(v.root_cn):'')+'</div>':'')+
        (v.formation?'<div class="word-note">'+esc(v.formation)+'</div>':'')+
        (v.example?'<div class="word-example">'+esc(v.example)+'<div class="cn">'+esc(v.example_cn)+'</div></div>':'')+
        (v.synonym_note?'<div class="word-note">辨析：'+esc(v.synonym_note)+'</div>':'')+
        (v.usage_note?'<div class="word-note">用法：'+esc(v.usage_note)+'</div>':'')+
        '</article>';
    }).join('');

    let extra='';
    if(lesson.session==='am'){
      extra+=renderTaskList('5句双语句',lesson.sentences,'');
      extra+=renderTaskList('3题 Quiz',lesson.quiz,'answer');
      extra+='<section class="card section"><h2>主动输出</h2><div class="task">'+esc(lesson.output?.task||'')+
        '<div class="answer">参考：'+esc(lesson.output?.reference_answer||'')+'<div class="cn">'+esc(lesson.output?.reference_cn||'')+'</div></div></div></section>';
      extra+='<section class="card section"><h2>最后复盘</h2><div class="tasks">'+(lesson.review||[]).map((x,i)=>'<div class="task">'+(i+1)+'. '+esc(x)+'</div>').join('')+'</div></section>';
    }else{
      extra+='<section class="card section"><h2>真实口语对话</h2><div class="dialogue">'+(lesson.dialogue?.lines||[]).map(x=>
        '<div class="line"><b>'+esc(x.speaker)+'</b>'+esc(x.id)+'<div class="cn">'+esc(x.cn)+'</div></div>').join('')+
        '<div class="coverage">对话核心词复现：'+(dialogueCoverage.length?esc(dialogueCoverage.join(' / ')):'—')+'</div></section>';
      extra+=renderTaskList('主动改写 / 中译印',lesson.rewrite,'reference_answer');
      extra+=renderTaskList('每日测试 6题',lesson.daily_test?.questions,'answer');
      extra+='<section class="card section"><h2>Self-check</h2><div class="tasks">'+(lesson.daily_test?.self_check||[]).map((x,i)=>'<div class="task">'+(i+1)+'. '+esc(x)+'</div>').join('')+'</div></section>';
      extra+='<section class="card section"><h2>'+esc(lesson.review?.title||'最后复盘')+'</h2><div class="tasks">'+(lesson.review?.steps||[]).map((x,i)=>'<div class="task">'+(i+1)+'. '+esc(x)+'</div>').join('')+'</div></section>';
    }

    app.innerHTML='<section class="meta">'+
      '<div class="card"><div class="k">课程</div><div class="v">'+esc(ctx.target.time)+' · '+esc(ctx.target.session.toUpperCase())+'</div></div>'+
      '<div class="card"><div class="k">Day</div><div class="v">'+esc(ctx.target.day)+'</div></div>'+
      '<div class="card"><div class="k">自动场景</div><div class="v">'+esc(lesson.title.split('｜').pop())+'</div></div>'+
      '<div class="card"><div class="k">核心词</div><div class="v">'+c.total+'</div></div>'+
      '<div class="card"><div class="k">阅读</div><div class="v">'+wc(lesson.reading?.text)+'词</div></div>'+
      '<div class="card"><div class="k">压力级别</div><div class="v">'+esc(lesson._prototype?.core_plan?.total||'—')+'</div></div>'+
      '</section>'+
      '<section class="card section"><h2>合同 / 质量检查</h2><div class="checks">'+checksArr.map(([t,ok,kind])=>
        '<span class="check '+(ok?'':kind==='soft'?'soft':'bad')+'">'+(ok?'✓':kind==='soft'?'△':'✕')+' '+esc(t)+'</span>').join('')+
        '</div><p class="hint">组合 '+(variant+1)+'。黄色是质量目标，不是正式发布硬闸门；红色才表示结构合同不合格。</p></section>'+
      '<section class="card section"><h2>核心词卡</h2><p class="hint">🔊 使用浏览器印尼语 TTS；AM词卡全部是新词，PM按 new / review / application 分组。</p><div class="word-grid">'+cards+'</div></section>'+
      '<section class="card section"><h2>阅读</h2><div class="reading">'+esc(lesson.reading?.text||'')+'</div><div class="translation">'+esc(lesson.reading?.cn||'')+'</div>'+
      '<div class="coverage">阅读核心词复现：'+(readingCoverage.length?esc(readingCoverage.join(' / ')):'—')+'</div></section>'+extra;

    app.querySelectorAll('[data-audio]').forEach(b=>b.addEventListener('click',()=>speak(b.dataset.audio)));
  }
  function renderCurrent(){
    if(!bundle)return;
    const session=$('#session').value,variant=Number($('#variant').value)||0,ctx=contexts[session];
    try{
      const lesson=window.LessonEngineCore.generate(ctx,bundle,window.DAILY_VOCAB_DB||[],{variant});
      render(lesson,ctx,variant);
    }catch(e){
      app.innerHTML='<section class="error">生成失败：'+esc(e.stack||e.message||e)+'</section>';
    }
  }
  $('#session').addEventListener('change',renderCurrent);
  $('#variant').addEventListener('change',renderCurrent);
  $('#generate').addEventListener('click',renderCurrent);
  load();
})();