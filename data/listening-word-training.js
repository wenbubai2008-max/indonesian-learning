(function(){
  'use strict';

  const STATS_KEY='indo_listen_stats_v1';
  const DAILY_KEY='indo_listen_daily_v1';
  const SESSION_SIZE=10;
  const FAST_MS=3000;
  let state={pool:[],queue:[],pos:0,correct:0,fast:0,replays:0,startedAt:0,answered:false,current:null,focus:new Set()};

  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function dateJakarta(){
    try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
    catch(e){return new Date().toISOString().slice(0,10);}
  }

  function readJSON(key,fallback){
    try{const x=JSON.parse(localStorage.getItem(key)||'null');return x&&typeof x==='object'?x:fallback;}
    catch(e){return fallback;}
  }
  function writeJSON(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch(e){}}

  function allStats(){return readJSON(STATS_KEY,{});}
  function allDaily(){return readJSON(DAILY_KEY,{});}

  function taughtPool(){
    const raw=Array.isArray(window.DAILY_VOCAB_DB)?window.DAILY_VOCAB_DB:[];
    const seen=new Set(), out=[];
    raw.forEach(x=>{
      const word=String(x&&x.word||'').trim();
      const cn=String(x&&x.cn||'').trim();
      if(!word||!cn||seen.has(word.toLowerCase()))return;
      seen.add(word.toLowerCase());
      out.push({word,cn,en:String(x.en||''),root:String(x.root||'')});
    });
    return out;
  }

  async function loadFocus(){
    try{
      const r=await fetch('data/learning-runtime.json?v='+Date.now(),{cache:'no-store'});
      if(!r.ok)throw new Error('HTTP '+r.status);
      const x=await r.json();
      const focus=Array.isArray(x.focus_pool)?x.focus_pool:[];
      state.focus=new Set(focus.map(v=>Array.isArray(v)?String(v[0]||''):String(v&&v.word||'')).filter(Boolean));
    }catch(e){state.focus=new Set();}
  }

  function shuffle(a){
    const x=a.slice();
    for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]];}
    return x;
  }

  function candidateScore(item,stats){
    const s=stats[item.word]||{};
    let score=0;
    if(state.focus.has(item.word))score+=1000;
    if(!s.attempts)score+=360;
    const attempts=Number(s.attempts)||0, correct=Number(s.correct)||0;
    if(attempts){
      const rate=correct/attempts;
      score+=(1-rate)*260;
      const avg=Number(s.total_ms||0)/Math.max(1,attempts);
      if(avg>6000)score+=130; else if(avg>3000)score+=70;
      if(s.last_result==='wrong')score+=160;
    }
    const days=s.last_at?Math.min(60,(Date.now()-new Date(s.last_at).getTime())/86400000):30;
    score+=Math.max(0,days)*2;
    score+=Math.random()*45;
    return score;
  }

  function buildQueue(){
    const pool=taughtPool(), stats=allStats();
    state.pool=pool;
    const ranked=pool.map(x=>({item:x,score:candidateScore(x,stats)})).sort((a,b)=>b.score-a.score);
    const head=ranked.slice(0,Math.min(80,ranked.length)).map(x=>x.item);
    state.queue=shuffle(head).slice(0,Math.min(SESSION_SIZE,head.length));
    state.pos=0;state.correct=0;state.fast=0;
  }

  function norm(s){return String(s||'').toLowerCase().replace(/[^a-z]/g,'');}
  function lev(a,b){
    a=norm(a);b=norm(b);
    if(!a)return b.length;if(!b)return a.length;
    const row=Array.from({length:b.length+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++){
      let prev=row[0];row[0]=i;
      for(let j=1;j<=b.length;j++){
        const old=row[j];
        row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));
        prev=old;
      }
    }
    return row[b.length];
  }
  function soundSimilarity(a,b){
    const x=norm(a),y=norm(b),m=Math.max(x.length,y.length)||1;
    let score=1-lev(x,y)/m;
    if(x.slice(-3)===y.slice(-3))score+=.12;
    if(x.slice(0,2)===y.slice(0,2))score+=.08;
    return score;
  }

  function nearestUnused(word){
    const used=new Set(state.queue.slice(0,state.pos+1).map(x=>x.word));
    let best=null,bestScore=.34;
    state.pool.forEach(x=>{
      if(x.word===word||used.has(x.word))return;
      const s=soundSimilarity(word,x.word);
      if(s>bestScore){bestScore=s;best=x;}
    });
    return best;
  }

  function choicesFor(item){
    const distractors=shuffle(state.pool.filter(x=>x.word!==item.word&&x.cn!==item.cn));
    const picked=[];
    for(const x of distractors){
      if(!picked.some(p=>p.cn===x.cn))picked.push(x);
      if(picked.length===3)break;
    }
    return shuffle([item,...picked]);
  }

  function speakWord(manual){
    if(!state.current)return;
    if(manual)state.replays++;
    const btn=$('listenSpeaker');
    if(typeof window.speakIdText==='function')window.speakIdText(state.current.word,btn);
    else if(typeof window.speak==='function')window.speak(state.current.word);
  }

  function renderQuestion(){
    const body=$('listeningWordBody'); if(!body)return;
    body.classList.remove('listenAnswered');
    if(state.pos>=state.queue.length){renderSummary();return;}
    state.current=state.queue[state.pos];
    state.replays=0;state.answered=false;state.startedAt=Date.now();
    const choices=choicesFor(state.current);
    body.innerHTML=
      '<div class="listenProgress"><span>第 '+(state.pos+1)+' / '+state.queue.length+' 题</span><span>答题前不会显示拼写</span></div>'+
      '<div class="listenStage">'+
        '<button id="listenSpeaker" class="listenSpeaker" type="button" aria-label="播放单词">🔊</button>'+
        '<div class="listenHint">听声音，选择中文意思</div>'+
        '<button id="listenReplay" class="listenReplay" type="button">↻ 再听一次</button>'+
      '</div>'+
      '<div id="listenFeedback"></div>'+
      '<div class="listenOptions">'+choices.map((x,i)=>'<button class="listenOption" type="button" data-word="'+esc(x.word)+'" data-i="'+i+'">'+esc(x.cn)+'</button>').join('')+'</div>';
    $('listenSpeaker').addEventListener('click',()=>speakWord(true));
    $('listenReplay').addEventListener('click',()=>speakWord(true));
    body.querySelectorAll('.listenOption').forEach(btn=>btn.addEventListener('click',()=>answer(btn)));
    updateMeta();
    setTimeout(()=>speakWord(false),180);
  }

  function record(item,ok,elapsed,replays){
    const stats=allStats(), old=stats[item.word]||{};
    const attempts=(Number(old.attempts)||0)+1;
    const correct=(Number(old.correct)||0)+(ok?1:0);
    const fastFirst=!!(ok&&elapsed<=FAST_MS&&replays===0);
    const wrongStreak=ok?0:(Number(old.wrong_streak)||0)+1;
    const slowNow=!!(ok&&!fastFirst);
    const slowStreak=slowNow?(Number(old.slow_streak)||0)+1:0;
    const fastFirstStreak=fastFirst?(Number(old.fast_first_hear_streak)||0)+1:0;
    stats[item.word]={
      attempts,correct,
      fast_correct:(Number(old.fast_correct)||0)+(ok&&elapsed<=FAST_MS?1:0),
      first_hear_correct:(Number(old.first_hear_correct)||0)+(ok&&replays===0?1:0),
      total_ms:(Number(old.total_ms)||0)+elapsed,
      replay_total:(Number(old.replay_total)||0)+replays,
      wrong_streak:wrongStreak,
      slow_streak:slowStreak,
      fast_first_hear_streak:fastFirstStreak,
      last_ms:elapsed,
      last_replays:replays,
      last_result:ok?'correct':'wrong',
      last_at:new Date().toISOString()
    };
    writeJSON(STATS_KEY,stats);

    try{
      const wp=window.WeaknessPool;
      if(wp&&typeof wp.recordListening==='function'){
        const info={word:item.word,cn:item.cn,en:item.en||'',root:item.root||''};
        if(fastFirstStreak>=3)wp.recordListening(item.word,info,'clear_listening');
        else if(wrongStreak>=2)wp.recordListening(item.word,info,'listening_wrong');
        else if(slowStreak>=2)wp.recordListening(item.word,info,'listening_slow');
      }
    }catch(e){}

    const daily=allDaily(), d=dateJakarta(), row=daily[d]||{attempts:0,correct:0,fast:0};
    row.attempts=(Number(row.attempts)||0)+1;
    row.correct=(Number(row.correct)||0)+(ok?1:0);
    row.fast=(Number(row.fast)||0)+(ok&&elapsed<=FAST_MS?1:0);
    daily[d]=row;
    Object.keys(daily).sort().slice(0,-45).forEach(k=>delete daily[k]);
    writeJSON(DAILY_KEY,daily);
    window.dispatchEvent(new CustomEvent('listening-profile-updated',{detail:getProfileSummary()}));
    if((!ok&&wrongStreak>=2)||(slowNow&&slowStreak>=2)||fastFirstStreak>=3){
      window.dispatchEvent(new CustomEvent('listening-weakness-updated',{detail:{word:item.word,ok:ok,wrong_streak:wrongStreak,slow_streak:slowStreak,fast_streak:fastFirstStreak}}));
    }
  }

  function answer(btn){
    if(state.answered)return;
    state.answered=true;
    const item=state.current;
    const elapsed=Math.max(0,Date.now()-state.startedAt);
    const ok=btn.dataset.word===item.word;
    record(item,ok,elapsed,state.replays);
    if(ok)state.correct++;
    if(ok&&elapsed<=FAST_MS)state.fast++;
    document.querySelectorAll('#listeningWordBody .listenOption').forEach(b=>{
      b.disabled=true;
      if(b.dataset.word===item.word)b.classList.add('listenGood');
      else if(b===btn)b.classList.add('listenBad');
    });
    if(!ok){
      const contrast=nearestUnused(item.word);
      if(contrast)state.queue.splice(Math.min(state.pos+1,state.queue.length),0,contrast);
      if(state.queue.length>SESSION_SIZE)state.queue=state.queue.slice(0,SESSION_SIZE);
    }
    const headline=ok?'✓ 听懂了':'✕ 没听出来';
    const speedTag=ok?(elapsed<=FAST_MS?'3秒内':'反应偏慢'):'需要加强';
    const body=$('listeningWordBody');
    if(body)body.classList.add('listenAnswered');
    const feedback=$('listenFeedback');
    feedback.innerHTML='<div class="listenAnswer '+(ok?'ok':'bad')+'">'+
      '<div class="listenAnswerInfo">'+
        '<div class="listenAnswerHeadline"><span class="listenAnswerTop">'+esc(headline)+'</span><span class="listenSpeedTag">'+esc(speedTag)+'</span></div>'+
        '<div class="listenAnswerWordRow"><b>'+esc(item.word)+'</b><span>'+esc(item.cn)+'</span></div>'+
        '<div class="listenTiming">首次作答 '+(elapsed/1000).toFixed(1)+' 秒 · 重播 '+state.replays+' 次</div>'+
        (!ok?'<div class="listenContrastNote">下一题优先安排声音接近的已学词做对比。</div>':'')+
      '</div>'+
      '<div class="listenAnswerActions">'+
        '<button class="secondary listenAnswerReplay" type="button" id="listenAnswerSound">🔊 再听一遍</button>'+
        '<button class="primary listenNext" type="button">'+(state.pos+1>=state.queue.length?'看结果':'下一题 →')+'</button>'+
      '</div>'+
      '</div>';
    $('listenAnswerSound').addEventListener('click',function(){if(typeof window.speakIdText==='function')window.speakIdText(item.word,this);else if(typeof window.speak==='function')window.speak(item.word);});
    feedback.querySelector('.listenNext').addEventListener('click',()=>{state.pos++;renderQuestion();});
    updateCard();
    updateMeta();
  }

  function renderStart(){
    const body=$('listeningWordBody');if(!body)return;
    const sum=getProfileSummary();
    body.innerHTML='<div class="listenStart">'+
      '<div class="listenStartIcon">🔊</div>'+
      '<h3>不看单词，只靠耳朵</h3>'+
      '<p>每局 10 个已经学过的词。优先抽近期弱词和还没验证过听力的词。</p>'+
      '<div class="listenStartStats"><div><b>'+sum.accuracy+'%</b><span>历史正确率</span></div><div><b>'+sum.fastRate+'%</b><span>3秒内听懂</span></div><div><b>'+sum.verifiedWords+'</b><span>已验证词</span></div></div>'+
      '<button id="listenStartBtn" class="primary listenStartBtn" type="button">开始 10 题</button>'+
      '</div>';
    $('listenStartBtn').addEventListener('click',startSession);
    updateMeta();
  }

  async function startSession(){
    const body=$('listeningWordBody');if(body)body.innerHTML='<div class="loading">正在准备已学词…</div>';
    await loadFocus();
    buildQueue();
    if(!state.queue.length){
      if(body)body.innerHTML='<div class="empty">目前还没有可用于听词训练的已学词。</div>';
      return;
    }
    renderQuestion();
  }

  function renderSummary(){
    const body=$('listeningWordBody');if(!body)return;
    const total=state.queue.length||1;
    body.innerHTML='<div class="listenSummary">'+
      '<div class="listenSummaryIcon">✓</div><h3>这一局完成</h3>'+
      '<div class="listenSummaryGrid"><div><b>'+state.correct+' / '+total+'</b><span>答对</span></div><div><b>'+Math.round(state.correct/total*100)+'%</b><span>正确率</span></div><div><b>'+state.fast+'</b><span>3秒内听懂</span></div></div>'+
      '<p>听错不会直接改成“未掌握”，而是单独记入听觉能力；之后会提高这些词的听词优先级。</p>'+
      '<button id="listenAgainBtn" class="primary" type="button">再来 10 个</button>'+
      '</div>';
    $('listenAgainBtn').addEventListener('click',startSession);
    updateCard();updateMeta();
  }

  function getProfileSummary(){
    const stats=allStats();
    let attempts=0,correct=0,fast=0,verified=0,firstHear=0;
    Object.values(stats).forEach(s=>{
      const a=Number(s.attempts)||0;
      if(a>0)verified++;
      attempts+=a;correct+=Number(s.correct)||0;fast+=Number(s.fast_correct)||0;firstHear+=Number(s.first_hear_correct)||0;
    });
    return {
      attempts,
      accuracy:attempts?Math.round(correct/attempts*100):0,
      fastRate:attempts?Math.round(fast/attempts*100):0,
      firstHearRate:attempts?Math.round(firstHear/attempts*100):0,
      verifiedWords:verified,
      taughtWords:taughtPool().length
    };
  }

  function todayRow(){
    const x=allDaily()[dateJakarta()]||{};
    return {attempts:Number(x.attempts)||0,correct:Number(x.correct)||0,fast:Number(x.fast)||0};
  }

  function updateCard(){
    const row=todayRow(), progress=$('listenQuickProgress'), rate=$('listenQuickRate');
    if(progress)progress.textContent=row.attempts>=SESSION_SIZE?'今日已完成 · '+row.attempts+'题':'今日 '+Math.min(row.attempts,SESSION_SIZE)+' / '+SESSION_SIZE;
    if(rate){
      if(row.attempts)rate.textContent='正确率 '+Math.round(row.correct/row.attempts*100)+'%';
      else rate.textContent='只听声音 · 判断意思';
    }
  }

  function updateMeta(){
    const el=$('listeningWordMeta');if(!el)return;
    const s=getProfileSummary();
    el.textContent=s.attempts?'听音正确率 '+s.accuracy+'% · 3秒 '+s.fastRate+'%':'尚未开始';
  }

  function openListeningWords(){
    if(typeof window.go==='function')window.go('listeningWords');
    renderStart();
  }

  window.openListeningWords=openListeningWords;
  window.ListeningWordTraining={open:openListeningWords,start:startSession,getProfileSummary,refresh:updateCard};
  document.addEventListener('DOMContentLoaded',()=>{updateCard();updateMeta();});
  setTimeout(()=>{updateCard();updateMeta();},0);
})();