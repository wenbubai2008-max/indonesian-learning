(function(){
  const STATE_KEY='indo_automation_training_state_v1';
  const PLAN_KEY='indo_automation_training_plan_v1';
  const MAX_DAILY=8;
  const HOUR=3600000;
  const DAY=86400000;

  function norm(s){return String(s||'').trim().toLowerCase();}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});}
  function parse(key,fallback){try{const x=JSON.parse(localStorage.getItem(key)||'');return x&&typeof x==='object'?x:fallback;}catch(e){return fallback;}}
  function write(key,value){localStorage.setItem(key,JSON.stringify(value));}
  function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
  function ts(v){if(!v)return 0;if(typeof v==='number')return v;const n=Date.parse(String(v).replace(' ','T'));return Number.isFinite(n)?n:0;}
  function daysSince(v){const t=ts(v);return t?Math.max(0,Math.floor((Date.now()-t)/DAY)):999;}
  function stateMap(){return parse(STATE_KEY,{});}
  function saveState(s){write(STATE_KEY,s);}
  function quickState(){return parse('indo_quick_practice_state',{});}
  function memory(){return parse('indo_mem',{});}
  function weakMap(){try{return window.WeaknessPool?(typeof window.WeaknessPool.focusMap==='function'?window.WeaknessPool.focusMap():(typeof window.WeaknessPool.activeMap==='function'?window.WeaknessPool.activeMap():{})):{};}catch(e){return {};}}
  function allSources(){return [].concat(window.DAILY_VOCAB_DB||[],window.UNFAMILIAR_VOCAB_DB||[],window.MASTER_VOCAB_OBJECTS||[],window.EMBEDDED_DB||[]);}
  function wordMap(){
    const out={};
    allSources().forEach(function(x){
      if(!x||!x.word)return;
      const k=norm(x.word),old=out[k]||{};
      out[k]=Object.assign({},old,x);
      if(!out[k].cn)out[k].cn=old.cn||'';
      if(!out[k].example)out[k].example=x.example||old.example||'';
      if(!out[k].example_cn)out[k].example_cn=x.example_cn||old.example_cn||'';
      if(Array.isArray(old.contexts)||Array.isArray(x.contexts))out[k].contexts=[].concat(old.contexts||[],x.contexts||[]).filter(Boolean).slice(-8);
    });
    try{
      if(window.WeaknessPool&&typeof window.WeaknessPool.all==='function'){
        window.WeaknessPool.all().forEach(function(x){
          if(!x||!x.word)return;
          const k=norm(x.word),old=out[k]||{};
          out[k]=Object.assign({},old,x);
          if(!out[k].cn)out[k].cn=old.cn||'';
          if(!out[k].example)out[k].example=((x.contexts||[]).slice(-1)[0])||old.example||'';
          if(!out[k].example_cn)out[k].example_cn=old.example_cn||'';
        });
      }
    }catch(e){}
    return out;
  }
  function dailyWords(){
    const seen={},out=[];
    (window.DAILY_VOCAB_DB||[]).forEach(function(x){
      if(!x||!x.word||!x.cn)return;
      const k=norm(x.word);if(!k)return;
      if(!seen[k]){seen[k]=Object.assign({},x);out.push(seen[k]);}
      else{
        const old=seen[k];
        if(ts(x.last_seen)>ts(old.last_seen))Object.assign(old,x);
        old.times_seen=Math.max(Number(old.times_seen||0),Number(x.times_seen||0));
      }
    });
    return out;
  }
  function memState(mm,word){return mm[word]||mm[norm(word)]||'';}
  function completedLesson(x){
    const dates=[];
    (x&&x.dates||[]).forEach(function(d){d=String(d||'').slice(0,10);if(d&&!dates.includes(d))dates.push(d);});
    [x&&x.first_seen,x&&x.last_seen].forEach(function(v){const d=String(v||'').slice(0,10);if(d&&!dates.includes(d))dates.push(d);});
    const sessions=(x&&x.sessions||[]).map(String);
    return dates.some(function(d){
      if(!sessions.length)return localStorage.getItem('done_'+d+'_am')==='1'||localStorage.getItem('done_'+d+'_pm')==='1';
      return sessions.some(function(s){const key=/08:00|早间/.test(s)?'am':(/18:00|19:00|晚间/.test(s)?'pm':'');return key&&localStorage.getItem('done_'+d+'_'+key)==='1';});
    });
  }
  function candidateList(){
    const now=Date.now(),states=stateMap(),qs=quickState(),mm=memory(),wm=weakMap(),out=[];
    dailyWords().forEach(function(x){
      const k=norm(x.word),p=qs[k]||{},st=states[k]||null,w=wm[k]||null;
      const age=daysSince(x.last_seen||x.first_seen),m=memState(mm,x.word);
      const lastWrong=Number(p.last_wrong||((p.last_result==='wrong')?p.last:0)||0),autoLast=Number(st&&st.last_at||0);
      const hardWrong=!!lastWrong&&(!autoLast||lastWrong>autoLast);
      const weak=!!w;
      const weakSignal=w?Math.max(ts(w.last_wrong),ts(w.last_seen),ts(w.last_review)):0;
      const freshFailure=hardWrong||!!(weakSignal&&(!autoLast||weakSignal>autoLast));
      const fuzzy=m==='fuzzy',dont=m==='dont';
      const strong=hardWrong||weak||fuzzy||dont;
      const learned=completedLesson(x)||!!p.last||!!w||!!m||!!st;
      if(!learned)return;
      if(m==='know'&&!strong&&(!st||st.status==='stable'))return;
      if(st&&st.status==='stable'&&!strong)return;
      if(age===0&&!strong&&!st)return;
      if(st&&Number(st.next_due||0)>now&&!freshFailure)return;
      let score=0,reasons=[];
      if(hardWrong){score+=24;reasons.push('快速练习刚答错');}
      if(weak){
        score+=18;reasons.push('当前弱项');
        const wr=Array.isArray(w.reasons)?w.reasons:[];
        if(wr.includes('listening_wrong')){score+=12;reasons.push('听音连续答错');}
        else if(wr.includes('listening_slow')){score+=6;reasons.push('听音反应慢');}
      }
      if(dont){score+=18;reasons.push('标记不会');}
      else if(fuzzy){score+=13;reasons.push('标记模糊');}
      if(st){
        if(st.last_result==='fail'||st.last_result==='hinted'||st.last_result==='slow'){score+=14;reasons.push('自动训练仍不稳');}
        if(Number(st.next_due||0)<=now){score+=10;reasons.push('到了验证时间');}
        score+=Math.min(8,Number(st.failures||0)*2);
      }else{
        score+=8;reasons.push('已学但尚未验证稳定');
      }
      if(age<=3)score+=5;else if(age<=7)score+=3;else if(age<=14)score+=1;
      score+=Math.min(3,Number(x.times_seen||1));
      if(Number(p.streak||0)>=3&&!strong)score-=6;
      if(score<=0)return;
      let stage=Number(st&&st.stage||1);
      if(strong&&st&&st.status==='stable')stage=1;
      out.push({word:x.word,cn:x.cn||'',score:score,stage:Math.max(1,Math.min(4,stage)),reasons:reasons,item:x,last_seen:x.last_seen||x.first_seen||''});
    });
    out.sort(function(a,b){return b.score-a.score||ts(b.last_seen)-ts(a.last_seen)||a.word.localeCompare(b.word);});
    return out;
  }
  function loadPlan(){return parse(PLAN_KEY,{});}
  function buildPlan(force){
    const d=today(),old=loadPlan();
    if(!force&&old.date===d&&Array.isArray(old.words))return old;
    const list=candidateList().slice(0,MAX_DAILY);
    const plan={date:d,generated_at:Date.now(),words:list.map(function(x){return {word:x.word,stage:x.stage,score:x.score,reasons:x.reasons};}),results:{}};
    write(PLAN_KEY,plan);return plan;
  }
  function savePlan(plan){write(PLAN_KEY,plan);}
  function stageName(n){return n===1?'快速主动提取':n===2?'语境补词':n===3?'主动表达':'延迟验证';}
  function reasonText(list){return (list||[]).slice(0,2).join(' · ');}
  function examplesFor(item){
    const arr=[];
    if(item&&item.example)arr.push(item.example);
    (item&&item.contexts||[]).forEach(function(x){if(x)arr.push(x);});
    return Array.from(new Set(arr.map(String).map(function(x){return x.trim();}).filter(Boolean)));
  }
  function blankSentence(sentence,word){
    if(!sentence)return '';
    const escaped=String(word).replace(/[.*+?^$()|[\]\\{}]/g,'\\$&');
    try{
      const re=new RegExp('\\b'+escaped+'\\b','i');
      if(re.test(sentence))return sentence.replace(re,'______');
    }catch(e){}
    return '';
  }
  function contextFor(word,item,state){
    const arr=examplesFor(item),idx=Number(state&&state.context_index||0);
    for(let i=0;i<arr.length;i++){
      const s=arr[(idx+i)%arr.length],blank=blankSentence(s,word);
      if(blank)return {text:blank,index:(idx+i)%arr.length,total:arr.length};
    }
    return {text:'',index:0,total:0};
  }
  function record(word,stage,result,item){
    const states=stateMap(),k=norm(word),old=states[k]||{},now=Date.now();
    const st=Object.assign({word:word,stage:stage,status:'active',attempts:0,successes:0,failures:0,fail_streak:0,verify_streak:0,context_index:0},old);
    st.word=word;st.attempts=Number(st.attempts||0)+1;st.last_at=now;st.last_stage=stage;
    if(result.ok){
      st.status='active';
      st.successes=Number(st.successes||0)+1;
      st.fail_streak=0;
      st.last_result=result.kind||'right';
      if(stage===1){
        if(Number.isFinite(Number(result.recall_ms)))st.last_recall_ms=Math.max(0,Number(result.recall_ms));
        st.stage=2;
        st.next_due=now+(result.kind==='direct'?20*HOUR:12*HOUR);
      }else if(stage===2){
        st.context_index=Number(st.context_index||0)+1;
        if(Number(result.hints||0)===0){st.stage=3;st.next_due=now+30*HOUR;st.last_result='right';}
        else{st.stage=2;st.next_due=now+20*HOUR;st.last_result='hinted';}
      }else if(stage===3){
        st.stage=4;st.next_due=now+48*HOUR;st.last_result='right';
      }else{
        st.verify_streak=Number(st.verify_streak||0)+1;
        if(st.verify_streak>=3){st.status='stable';st.stage=4;st.next_due=now+14*DAY;st.last_result='stable';}
        else{const gaps=[2*DAY,4*DAY,7*DAY];st.stage=4;st.next_due=now+gaps[Math.min(st.verify_streak-1,gaps.length-1)];st.last_result='right';}
      }
    }else{
      st.failures=Number(st.failures||0)+1;st.fail_streak=Number(st.fail_streak||0)+1;st.status='active';st.verify_streak=0;st.last_result='fail';
      st.next_due=now+(st.fail_streak>=3?1*HOUR:(st.fail_streak===2?3*HOUR:6*HOUR));
      if(stage>=3)st.stage=2;else if(stage===2)st.stage=1;else st.stage=1;
    }
    states[k]=st;saveState(states);
    try{
      const wp=window.WeaknessPool;
      if(wp){
        if(!result.ok&&typeof wp.markWeak==='function')wp.markWeak(word,item||{word:word},'automation_fail');
        else if(st.status==='stable'&&typeof wp.removeReasons==='function')wp.removeReasons(word,'automation_fail',true,'automation_stable');
      }
    }catch(e){}
    window.dispatchEvent(new CustomEvent('automation-training-updated',{detail:{word:word,state:st}}));
    return st;
  }
  function markPlanDone(word,result){
    const plan=loadPlan();if(plan.date!==today())return;
    plan.results=plan.results||{};plan.results[norm(word)]={at:Date.now(),result:result};savePlan(plan);
  }
  function releaseDueRetries(plan,states){
    if(!plan||plan.date!==today()||!Array.isArray(plan.words))return false;
    plan.results=plan.results||{};let changed=false,now=Date.now();
    plan.words.forEach(function(p){
      const k=norm(p.word),r=plan.results[k],st=states[k]||{};
      if(r&&r.result==='fail'&&Number(st.next_due||0)>0&&Number(st.next_due)<=now){
        delete plan.results[k];
        p.stage=Math.max(1,Math.min(4,Number(st.stage||p.stage||1)));
        changed=true;
      }
    });
    if(changed)savePlan(plan);
    return changed;
  }
  function resultBox(card,text,ok){const box=card.querySelector('.autoResult');if(box){box.textContent=text;box.className='autoResult '+(ok?'ok':'bad');}}
  function clearResult(card){const box=card.querySelector('.autoResult');if(box){box.textContent='';box.className='autoResult';}}
  function finishCard(card,word,stage,result,item,message){
    if(card.dataset.done)return;card.dataset.done='1';
    card.querySelectorAll('input,textarea,button').forEach(function(el){if(!el.classList.contains('autoSound'))el.disabled=true;});
    const newState=record(word,stage,result,item);markPlanDone(word,result.ok?(result.kind||'right'):'fail');if(message)resultBox(card,message,result.ok);else clearResult(card);refreshMeta();refreshTag();return newState;
  }
  function failureHelp(card,word,item,newState,wrongAnswer){
    const box=card.querySelector('.autoRescue');if(!box)return;
    const streak=Number(newState&&newState.fail_streak||1),parts=[];
    parts.push('<div class="autoRescueTop"><span>答案</span><b>'+esc(word)+'</b></div>');
    if(item&&item.cn)parts.push('<div class="autoRescueRow"><span>意思</span><strong>'+esc(item.cn)+'</strong></div>');
    if(item&&item.root&&norm(item.root)!==norm(word)){
      parts.push('<div class="autoRescueRow"><span>词根</span><strong>'+esc(item.root)+(item.root_cn?' = '+esc(item.root_cn):'')+'</strong></div>');
    }else if(item&&item.root_cn&&norm(item.root_cn)!==norm(item.cn||'')){
      parts.push('<div class="autoRescueRow"><span>相关义</span><strong>'+esc(item.root_cn)+'</strong></div>');
    }
    const wrong=norm(wrongAnswer);
    if(wrong&&wrong!==norm(word)){
      const other=wordMap()[wrong];
      if(other&&other.cn)parts.push('<div class="autoRescueCompare"><span>你刚写的</span><b>'+esc(wrongAnswer)+'</b> = '+esc(other.cn)+'<br><span>目标词</span><b>'+esc(word)+'</b> = '+esc(item&&item.cn||'')+'</div>');
    }
    if(item&&item.example)parts.push('<div class="autoRescueExample"><span>例句</span>'+esc(item.example)+(item.example_cn?'<small>'+esc(item.example_cn)+'</small>':'')+'</div>');
    if(streak===2)parts.push('<div class="autoRescueNote">这个词已经连续 2 次没提取出来。先看清“意思 + 用法”，下次不要只认答案。</div>');
    else if(streak>=3)parts.push('<div class="autoRescueNote strong">顽固词 · 连续 '+streak+' 次没提取出来。系统会缩短再次训练的间隔。</div>');
    box.innerHTML=parts.join('');
  }
  function renderStage1(card,word,item,state){
    let start=0,firstInputAt=0;
    card.innerHTML+='<div class="autoRecallBox"><div class="autoRecallWord">'+esc(item.cn||'看中文，想印尼语')+'</div><div class="autoRecallTip">尽量在 3–5 秒内想起答案；输入长短不作为主要判断。</div></div><div class="autoInputRow"><input class="autoAnswer" autocomplete="off" placeholder="输入印尼语"><button class="primary autoSubmit" type="button">确认</button><button class="secondary autoGiveUp" type="button">想不出</button></div><div class="autoResult"></div><div class="autoRescue"></div>';
    const input=card.querySelector('.autoAnswer');
    function begin(){if(!start)start=Date.now();}
    function recallMs(){return firstInputAt&&start?Math.max(0,firstInputAt-start):0;}
    input.addEventListener('focus',begin);
    input.addEventListener('input',function(){begin();if(!firstInputAt&&input.value.trim())firstInputAt=Date.now();clearResult(card);});
    function finishCorrect(){
      const ms=recallMs(),kind=ms>0&&ms<=5000?'direct':'slow';
      const msg=kind==='direct'?'✓ 主动提取成功':'✓ 答对了；想到答案稍慢，但输入时长不影响升级，下一次进入语境补词';
      finishCard(card,word,1,{ok:true,kind:kind,recall_ms:ms},item,msg);
    }
    function submit(){if(card.dataset.done)return;begin();if(norm(input.value)!==norm(word)){resultBox(card,'还不对，再想一下；也可以点“想不出”。',false);return;}finishCorrect();}
    card.querySelector('.autoSubmit').onclick=submit;
    card.querySelector('.autoGiveUp').onclick=function(){if(card.dataset.done)return;begin();if(norm(input.value)===norm(word)){finishCorrect();return;}const wrong=input.value.trim(),newState=finishCard(card,word,1,{ok:false,kind:'fail'},item,'');failureHelp(card,word,item,newState,wrong);};
  }
  function renderStage2(card,word,item,state){
    const ctx=contextFor(word,item,state);
    const sentence=ctx.text||'请用 ______ 表达：「'+(item.cn||'这个意思')+'」';
    card.innerHTML+='<div class="autoPrompt"><b>'+esc(sentence)+'</b><small>中文提示：'+esc(item.cn||'')+'。没有选项，先自己提取；需要时再逐级看提示。</small></div><div class="autoHintLine" data-level="0"></div><div class="autoInputRow"><input class="autoAnswer" autocomplete="off" placeholder="填入目标词"><button class="primary autoSubmit" type="button">确认</button><button class="secondary autoHint" type="button">提示</button></div><div class="autoResult"></div>';
    const input=card.querySelector('.autoAnswer'),hint=card.querySelector('.autoHintLine');
    card.querySelector('.autoHint').onclick=function(){let level=Number(hint.dataset.level||0)+1;hint.dataset.level=String(Math.min(level,3));if(level===1)hint.textContent='提示 1：'+word.slice(0,1)+'…';else if(level===2)hint.textContent='提示 2：'+word.slice(0,Math.min(3,word.length))+'…';else{hint.textContent='答案：'+word;this.disabled=true;let rescue=card.querySelector('.autoRescue');if(!rescue){rescue=document.createElement('div');rescue.className='autoRescue';card.appendChild(rescue);}failureHelp(card,word,item,Object.assign({},state,{fail_streak:Number(state&&state.fail_streak||0)}),'');}};
    function submit(){if(card.dataset.done)return;const good=norm(input.value)===norm(word);if(!good){resultBox(card,'还不对，可以继续想或点“提示”。',false);return;}const hints=Number(hint.dataset.level||0);finishCard(card,word,2,{ok:true,kind:hints?'hinted':'right',hints:hints},item,hints?'✓ 借助提示答出，暂时不升级，隔一段时间再测':'✓ 无提示完成，下一次进入主动表达');}
    input.addEventListener('input',function(){clearResult(card);});
    card.querySelector('.autoSubmit').onclick=submit;
  }
  function renderStage3(card,word,item,state){
    const sample=examplesFor(item)[0]||'';
    card.innerHTML+='<div class="autoPrompt"><b>用 '+esc(word)+' 说一句和你自己的工作、生活或聊天有关的话。</b><small>这一关不是背标准答案，而是把词真正放进自己的表达里。</small></div><textarea class="autoSentence" rows="3" placeholder="自己写一句印尼语"></textarea><div class="autoInputRow"><button class="primary autoSubmit" type="button">完成表达</button></div><div class="autoResult"></div><div class="autoSample"></div>';
    card.querySelector('.autoSubmit').onclick=function(){const val=card.querySelector('.autoSentence').value||'';if(!val.trim()){resultBox(card,'先写一句自己的话。',false);return;}if(norm(val).indexOf(norm(word))<0){resultBox(card,'这句话里还没有用到 '+word+'，再写一次。',false);return;}finishCard(card,word,3,{ok:true,kind:'right'},item,'✓ 已完成主动表达；下一次会隔开时间做验证');const sampleBox=card.querySelector('.autoSample');if(sample&&sampleBox)sampleBox.textContent='参考例句：'+sample;};
  }
  function renderStage4(card,word,item,state){
    const ctx=contextFor(word,item,state),prompt=ctx.text||('中文：'+(item.cn||''));
    card.innerHTML+='<div class="autoPrompt"><b>'+esc(prompt)+'</b><small>这是延迟验证：隔了一段时间再看还能不能主动调出来。不给选项。</small></div><div class="autoInputRow"><input class="autoAnswer" autocomplete="off" placeholder="输入印尼语"><button class="primary autoSubmit" type="button">确认</button><button class="secondary autoGiveUp" type="button">想不出</button></div><div class="autoResult"></div><div class="autoRescue"></div>';
    const input=card.querySelector('.autoAnswer');
    function submit(){const good=norm(input.value)===norm(word);if(!good){resultBox(card,'还不对。想不出来就点“想不出”，系统会重新提高这个词的优先级。',false);return;}finishCard(card,word,4,{ok:true,kind:'right'},item,'✓ 延迟验证通过');}
    input.addEventListener('input',function(){clearResult(card);});
    card.querySelector('.autoSubmit').onclick=submit;card.querySelector('.autoGiveUp').onclick=function(){if(card.dataset.done)return;if(norm(input.value)===norm(word)){finishCard(card,word,4,{ok:true,kind:'right'},item,'✓ 延迟验证通过');return;}const wrong=input.value.trim(),newState=finishCard(card,word,4,{ok:false,kind:'fail'},item,'');failureHelp(card,word,item,newState,wrong);};
  }
  function ensurePage(){
    if(document.getElementById('automationTraining'))return;
    const app=document.querySelector('.app');if(!app)return;
    const sec=document.createElement('section');sec.id='automationTraining';sec.className='page';
    sec.innerHTML='<button class="back" onclick="go(\'home\')">← 返回首页</button><div class="card"><div class="sectionHead"><div><h2>自动训练</h2><div class="muted">把“看着眼熟”练成“需要时能主动说出来”。</div></div><span class="pill" id="automationTrainingMeta"></span></div><div id="automationTrainingBody"></div></div>';
    app.appendChild(sec);
    if(typeof window.installSiteNavBars==='function')window.installSiteNavBars();
  }
  function refreshMeta(){
    const meta=document.getElementById('automationTrainingMeta');if(!meta)return;
    const plan=loadPlan(),total=Array.isArray(plan.words)?plan.words.length:0,done=plan.results?Object.keys(plan.results).length:0;
    meta.textContent='今日 '+done+'/'+total;
  }
  function render(){
    ensurePage();const body=document.getElementById('automationTrainingBody');if(!body)return;
    const plan=buildPlan(false),map=wordMap(),states=stateMap();releaseDueRetries(plan,states);const done=plan.results||{};
    refreshMeta();
    let html='<div class="autoIntro"><b>每天只练真正需要自动化的词。</b><span>新学词默认是“待稳定”，不是“已掌握”。快速练习答错、模糊/不会、弱项、到期验证都会提高优先级；同一天的计划不会因为普通刷新而乱变。</span><button class="secondary" type="button" id="autoRebuildPlan">更新今日训练</button></div>';
    html+='<div class="autoStages"><span>1 快速主动提取</span><span>2 语境补词</span><span>3 主动表达</span><span>4 延迟验证</span></div>';
    if(!plan.words.length){html+='<div class="empty"><b>今天没有到期的自动化词。</b><div style="margin-top:8px">如果今天没学习，也会继续检查以前的到期词；没有真正需要练的就不硬凑数量。</div></div>';body.innerHTML=html;body.querySelector('#autoRebuildPlan').onclick=function(){buildPlan(true);render();};return;}
    html+='<div class="autoList">';
    plan.words.forEach(function(p,i){const item=map[norm(p.word)]||{word:p.word,cn:''};html+='<div class="autoCard" data-word="'+esc(p.word)+'" data-stage="'+p.stage+'"><div class="autoHead"><div><span class="autoNo">'+(i+1)+'</span><b>'+esc(stageName(p.stage))+'</b></div><small>'+esc(reasonText(p.reasons))+'</small></div><div class="autoTask"></div></div>';});
    html+='</div>';body.innerHTML=html;
    body.querySelector('#autoRebuildPlan').onclick=function(){buildPlan(true);render();};
    body.querySelectorAll('.autoCard').forEach(function(card){
      const word=card.dataset.word,stage=Number(card.dataset.stage||1),item=map[norm(word)]||{word:word,cn:''},st=states[norm(word)]||{};
      const task=card.querySelector('.autoTask');
      if(done[norm(word)]){task.innerHTML='<div class="autoDone">✓ 今天这一词已经完成，明天或到期后再出现。</div>';card.dataset.done='1';return;}
      if(stage===1)renderStage1(task,word,item,st);else if(stage===2)renderStage2(task,word,item,st);else if(stage===3)renderStage3(task,word,item,st);else renderStage4(task,word,item,st);
    });
  }
  function dueCount(){const p=loadPlan();if(p.date===today()&&Array.isArray(p.words)){const states=stateMap();releaseDueRetries(p,states);return Math.max(0,p.words.length-Object.keys(p.results||{}).length);}return Math.min(MAX_DAILY,candidateList().length);}
  function refreshTag(){const tag=document.getElementById('automationTag');if(tag){const n=dueCount();tag.textContent=n?n+' 个待训练':'暂无到期词';}}
  function open(){ensurePage();if(typeof window.go==='function')window.go('automationTraining');render();}
  function rebuildPlan(){buildPlan(true);render();refreshTag();}
  function style(){
    if(document.getElementById('automationTrainingStyle'))return;
    const s=document.createElement('style');s.id='automationTrainingStyle';s.textContent='.autoIntro{display:grid;grid-template-columns:1fr auto;gap:6px 12px;align-items:center;background:#f8f6ff;border:1px solid #e4def5;border-radius:14px;padding:14px 15px}.autoIntro>b{font-size:16px}.autoIntro>span{grid-column:1/2;color:#667085;font-size:13px;line-height:1.6}.autoIntro>button{grid-column:2;grid-row:1/3}.autoStages{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:13px 0}.autoStages span{background:#fff;border:1px solid #e2e6ee;border-radius:10px;padding:9px 8px;text-align:center;font-size:12px;font-weight:800;color:#596579}.autoList{display:grid;gap:11px}.autoCard{border:1px solid #e1e6ef;border-radius:15px;background:#fff;padding:14px}.autoHead{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:11px}.autoHead>div{display:flex;align-items:center;gap:8px}.autoNo{display:inline-flex;width:25px;height:25px;border-radius:8px;background:#eee9ff;color:#6549a3;align-items:center;justify-content:center;font-size:12px;font-weight:900}.autoHead small{color:#7a8493;text-align:right}.autoPrompt{background:#f8faff;border-radius:12px;padding:13px 14px;line-height:1.65}.autoPrompt b{display:block;font-size:17px}.autoPrompt small{display:block;color:#667085;margin-top:4px}.autoRecallBox{padding:4px 0 2px}.autoRecallWord{display:inline-block;background:#fff4cf;border:1px solid #f2df96;border-radius:12px;padding:10px 14px;font-size:22px;line-height:1.35;font-weight:900;color:#1f2937;letter-spacing:.01em}.autoRecallTip{margin-top:8px;color:#98a2b3;font-size:12px;line-height:1.45}.autoCard[data-stage="1"] .autoHead b{font-size:15px;font-weight:800;color:#667085}.autoCard[data-stage="1"] .autoHead{margin-bottom:8px}.autoInputRow{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.autoInputRow input,.autoSentence{border:1px solid #dfe4ec;border-radius:10px;padding:10px 11px;background:#fff}.autoInputRow input{flex:1;min-width:180px}.autoSentence{width:100%;resize:vertical}.autoHintLine{min-height:23px;color:#6b4fa4;font-weight:800;font-size:13px;margin-top:8px}.autoResult{min-height:22px;font-size:13px;margin-top:8px;color:#64748b}.autoResult.ok{color:#17652d}.autoResult.bad{color:#9d2f28}.autoRescue{margin-top:10px}.autoRescue:empty{display:none}.autoRescueTop{display:flex;align-items:center;gap:10px;background:#fff8df;border:1px solid #f1df9b;border-radius:12px;padding:10px 12px}.autoRescueTop span,.autoRescueRow span,.autoRescueExample>span,.autoRescueCompare span{font-size:11px;font-weight:800;color:#8a6d1d;margin-right:8px}.autoRescueTop b{font-size:20px;color:#1f2937}.autoRescueRow{padding:8px 12px 0;font-size:13px;color:#475467}.autoRescueRow strong{color:#1f2937}.autoRescueExample{margin-top:8px;background:#f8faff;border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.55;color:#344054}.autoRescueExample small{display:block;margin-top:3px;color:#7a8493}.autoRescueCompare{margin-top:8px;border-left:3px solid #d8cdf8;background:#faf8ff;border-radius:8px;padding:9px 11px;font-size:13px;line-height:1.6;color:#475467}.autoRescueCompare b{color:#2d3748}.autoRescueNote{margin-top:8px;font-size:12px;color:#667085;padding:7px 10px;background:#f7f8fa;border-radius:8px}.autoRescueNote.strong{color:#7a4b00;background:#fff4e5}.autoDone{background:#f3faf5;color:#287341;border-radius:10px;padding:11px 12px;font-size:13px}.autoSample{font-size:13px;color:#667085;margin-top:8px}.autoCard[data-done="1"]{opacity:.72}@media(max-width:700px){.autoIntro{grid-template-columns:1fr}.autoIntro>span,.autoIntro>button{grid-column:1;grid-row:auto}.autoStages{grid-template-columns:repeat(2,1fr)}.autoHead{align-items:flex-start;flex-direction:column}.autoHead small{text-align:left}}';document.head.appendChild(s);
  }
  window.openAutomationTraining=open;
  window.AutomationTraining={open:open,render:render,rebuildPlan:rebuildPlan,refreshTag:refreshTag,candidates:candidateList};
  window.addEventListener('quick-practice-updated',function(){refreshTag();});
  window.addEventListener('weak-pool-changed',function(){refreshTag();});
  window.addEventListener('listening-weakness-updated',function(){
    buildPlan(true);refreshTag();
    const page=document.getElementById('automationTraining');
    if(page&&page.classList.contains('active'))render();
  });
  ensurePage();
  style();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(refreshTag,250);},{once:true});else setTimeout(refreshTag,250);
})();