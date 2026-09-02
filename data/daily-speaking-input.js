(function(){
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  let recognition=null,timer=null,startAt=0,finalText='',running=false;

  function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function norm(s){return String(s||'').toLowerCase().replace(/[^a-zà-ÿ\s-]/g,' ').replace(/\s+/g,' ').trim();}
  function targetWords(){
    const out=[];
    document.querySelectorAll('#dailyBody .dailyFixWord').forEach(el=>{
      const spans=[...el.querySelectorAll('span')].map(x=>x.textContent.trim()).filter(Boolean);
      const w=spans.find(t=>!/^[0-9]+\.$/.test(t));
      if(w&&!out.includes(w))out.push(w);
    });
    return out.slice(0,12);
  }
  function usedTargets(text){
    const t=' '+norm(text)+' ';
    return targetWords().filter(w=>{
      const n=norm(w);return n&&t.includes(' '+n+' ');
    });
  }
  function currentKey(){
    const d=document.getElementById('dailyMeta')?.textContent.trim()||'';
    const title=document.getElementById('dailyTitle')?.textContent||'';
    const s=title.includes('19:00')?'pm':'am';
    return 'indo_speaking_'+d+'_'+s;
  }
  function save(){
    const box=document.getElementById('dailySpeakingBox');if(!box)return;
    const data={text:box.querySelector('.ds-transcript')?.textContent||'',seconds:Number(box.dataset.seconds||0),used:usedTargets(box.querySelector('.ds-transcript')?.textContent||''),saved_at:new Date().toISOString()};
    try{localStorage.setItem(currentKey(),JSON.stringify(data));}catch(e){}
  }
  function restore(){
    const box=document.getElementById('dailySpeakingBox');if(!box)return;
    let data=null;try{data=JSON.parse(localStorage.getItem(currentKey())||'null')}catch(e){}
    if(!data)return;
    box.querySelector('.ds-transcript').textContent=data.text||'';
    box.dataset.seconds=String(data.seconds||0);
    updateStats(box,data.seconds||0,data.text||'');
  }
  function updateStats(box,seconds,text){
    const used=usedTargets(text),targets=targetWords();
    box.querySelector('.ds-time').textContent=Math.round(seconds)+' 秒';
    box.querySelector('.ds-hit').textContent=used.length+' / '+Math.min(4,targets.length||4);
    const tags=box.querySelector('.ds-tags');
    tags.innerHTML=used.length?used.map(w=>'<span class="ds-tag ok">'+esc(w)+' ✓</span>').join(''):'<span class="ds-tag">还没有识别到今日词汇</span>';
  }
  function stop(){
    if(timer){clearInterval(timer);timer=null;}
    if(recognition&&running){try{recognition.stop();}catch(e){}}
    running=false;
    const box=document.getElementById('dailySpeakingBox');if(box){
      const btn=box.querySelector('.ds-start');btn.textContent='🎙️ 开始口语';btn.classList.remove('recording');
      save();
    }
  }
  function start(){
    const box=document.getElementById('dailySpeakingBox');if(!box)return;
    if(!SpeechRecognition){box.querySelector('.ds-status').textContent='当前浏览器不支持语音转文字。建议电脑端使用 Chrome 或 Edge。';return;}
    if(running){stop();return;}
    recognition=new SpeechRecognition();
    recognition.lang='id-ID';recognition.continuous=true;recognition.interimResults=true;
    finalText='';
    recognition.onresult=e=>{
      let interim='';
      for(let i=e.resultIndex;i<e.results.length;i++){
        const tx=e.results[i][0].transcript;
        if(e.results[i].isFinal)finalText+=(finalText?' ':'')+tx;else interim+=tx;
      }
      const shown=(finalText+(interim?' '+interim:'')).trim();
      box.querySelector('.ds-transcript').textContent=shown||'正在听…';
      updateStats(box,(Date.now()-startAt)/1000,shown);
    };
    recognition.onerror=e=>{box.querySelector('.ds-status').textContent=e.error==='not-allowed'?'请允许浏览器使用麦克风后再试。':'语音识别暂时中断：'+e.error;stop();};
    recognition.onend=()=>{if(running){try{recognition.start();}catch(e){stop();}}};
    try{recognition.start();}catch(e){box.querySelector('.ds-status').textContent='麦克风启动失败，请重新点击。';return;}
    running=true;startAt=Date.now();
    box.querySelector('.ds-start').textContent='⏹ 停止';box.querySelector('.ds-start').classList.add('recording');
    box.querySelector('.ds-status').textContent='请直接说印尼语。卡住时先继续说，不用追求语法完美。';
    timer=setInterval(()=>{
      const sec=(Date.now()-startAt)/1000;box.dataset.seconds=String(sec);updateStats(box,sec,box.querySelector('.ds-transcript').textContent||'');
      if(sec>=60)stop();
    },500);
  }
  function reset(){
    stop();const box=document.getElementById('dailySpeakingBox');if(!box)return;
    box.querySelector('.ds-transcript').textContent='';box.dataset.seconds='0';updateStats(box,0,'');
    try{localStorage.removeItem(currentKey())}catch(e){}
  }
  function inject(){
    const body=document.getElementById('dailyBody');if(!body||!document.getElementById('daily')?.classList.contains('active'))return;
    const old=document.getElementById('dailySpeakingBox');if(old)return;
    const vocab=targetWords();if(!vocab.length)return;
    const completion=[...body.querySelectorAll('button')].find(b=>b.textContent.includes('我学完了')||b.textContent.includes('已学完'));
    const sec=document.createElement('section');sec.id='dailySpeakingBox';sec.className='dailyFixSec';sec.dataset.seconds='0';
    sec.innerHTML='<h3><span class="dailyFixNo">🎙</span>口语输入 · 60秒</h3>'+
      '<div class="ds-prompt">围绕今天的工作、生活或行程变化连续说 30–60 秒。尽量自然使用 <b>至少4个</b> 今日词汇，不看答案也可以。</div>'+
      '<div class="ds-actions"><button type="button" class="primary ds-start">🎙️ 开始口语</button><button type="button" class="secondary ds-reset">重新录入</button></div>'+
      '<div class="ds-status muted">点击“开始口语”后，浏览器会请求麦克风权限，并把印尼语转成文字。</div>'+
      '<div class="ds-result"><div><span>时长</span><b class="ds-time">0 秒</b></div><div><span>目标词命中</span><b class="ds-hit">0 / 4</b></div></div>'+
      '<div class="ds-transcript" aria-live="polite"></div><div class="ds-tags"></div>'+
      '<div class="ds-self"><span>说完后自评：</span><button type="button" data-v="很顺">很顺</button><button type="button" data-v="有点卡">有点卡</button><button type="button" data-v="很难说出来">很难说出来</button></div>';
    if(completion)completion.closest('div').before(sec);else body.appendChild(sec);
    sec.querySelector('.ds-start').addEventListener('click',start);sec.querySelector('.ds-reset').addEventListener('click',reset);
    sec.querySelectorAll('.ds-self button').forEach(b=>b.addEventListener('click',()=>{sec.querySelectorAll('.ds-self button').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');try{localStorage.setItem(currentKey()+'_self',b.dataset.v)}catch(e){}}));
    let self='';try{self=localStorage.getItem(currentKey()+'_self')||''}catch(e){};if(self)sec.querySelector('.ds-self button[data-v="'+self+'"]')?.classList.add('selected');
    updateStats(sec,0,'');restore();
  }
  if(!document.getElementById('dailySpeakingStyle')){
    const st=document.createElement('style');st.id='dailySpeakingStyle';st.textContent=`
      #dailySpeakingBox .ds-prompt{line-height:1.7;color:#46546a;background:#f8faff;border-radius:12px;padding:12px 14px}.ds-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:12px}.ds-start.recording{background:#b42318}.ds-status{margin-top:9px}.ds-result{display:flex;gap:12px;margin-top:12px;flex-wrap:wrap}.ds-result>div{border:1px solid var(--line);border-radius:11px;padding:9px 12px;min-width:130px}.ds-result span{display:block;font-size:12px;color:var(--muted)}.ds-result b{font-size:18px}.ds-transcript{min-height:78px;margin-top:12px;border:1px solid var(--line);border-radius:12px;padding:12px 14px;line-height:1.75;background:#fff;text-align:left}.ds-tags{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.ds-tag{font-size:12px;border-radius:999px;background:#f1f3f7;color:#657084;padding:5px 8px}.ds-tag.ok{background:#eaf7ee;color:#19703a}.ds-self{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:13px}.ds-self button{border:1px solid var(--line);background:#fff;border-radius:9px;padding:7px 10px;cursor:pointer}.ds-self button.selected{background:#eef3ff;color:#3157d5;border-color:#9ab0ee}@media(max-width:650px){.ds-result>div{flex:1;min-width:120px}.ds-actions button{flex:1}}
    `;document.head.appendChild(st);
  }
  const body=document.getElementById('dailyBody');if(body)new MutationObserver(()=>setTimeout(inject,0)).observe(body,{childList:true,subtree:false});
  window.addEventListener('load',()=>setTimeout(inject,100));
})();
