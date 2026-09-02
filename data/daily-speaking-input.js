(function(){
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  let recognition=null,timer=null,startAt=0,finalText='',running=false;
  let mediaRecorder=null,mediaStream=null,audioChunks=[],audioUrl='';
  let recognitionFailed=false;

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
    return targetWords().filter(w=>{const n=norm(w);return n&&t.includes(' '+n+' ');});
  }
  function currentKey(){
    const d=document.getElementById('dailyMeta')?.textContent.trim()||'';
    const title=document.getElementById('dailyTitle')?.textContent||'';
    const s=title.includes('19:00')?'pm':'am';
    return 'indo_speaking_'+d+'_'+s;
  }
  function transcriptValue(box){return box?.querySelector('.ds-transcript')?.value||'';}
  function save(){
    const box=document.getElementById('dailySpeakingBox');if(!box)return;
    const text=transcriptValue(box);
    const data={text,seconds:Number(box.dataset.seconds||0),used:usedTargets(text),saved_at:new Date().toISOString()};
    try{localStorage.setItem(currentKey(),JSON.stringify(data));}catch(e){}
  }
  function restore(){
    const box=document.getElementById('dailySpeakingBox');if(!box)return;
    let data=null;try{data=JSON.parse(localStorage.getItem(currentKey())||'null')}catch(e){}
    if(!data)return;
    box.querySelector('.ds-transcript').value=data.text||'';
    box.dataset.seconds=String(data.seconds||0);
    updateStats(box,data.seconds||0,data.text||'');
  }
  function updateStats(box,seconds,text){
    const used=usedTargets(text),targets=targetWords();
    box.querySelector('.ds-time').textContent=Math.round(seconds)+' 秒';
    box.querySelector('.ds-hit').textContent=used.length+' / '+Math.min(4,targets.length||4);
    const tags=box.querySelector('.ds-tags');
    tags.innerHTML=used.length?used.map(w=>'<span class="ds-tag ok">'+esc(w)+' ✓</span>').join(''):'<span class="ds-tag">还没有识别/填写到今日词汇</span>';
  }
  function stopTracks(){if(mediaStream){mediaStream.getTracks().forEach(t=>{try{t.stop()}catch(e){}});mediaStream=null;}}
  function stopRecognition(){if(recognition){try{recognition.onend=null;recognition.stop();}catch(e){}recognition=null;}}
  function makePlayback(){
    const box=document.getElementById('dailySpeakingBox');if(!box||!audioChunks.length)return;
    try{
      const type=mediaRecorder&&mediaRecorder.mimeType?mediaRecorder.mimeType:'audio/webm';
      const blob=new Blob(audioChunks,{type});
      if(audioUrl)URL.revokeObjectURL(audioUrl);
      audioUrl=URL.createObjectURL(blob);
      const wrap=box.querySelector('.ds-playback');wrap.innerHTML='<div class="muted" style="margin-bottom:5px">本次录音回放</div><audio controls preload="metadata" src="'+audioUrl+'"></audio>';
    }catch(e){}
  }
  function stop(){
    if(timer){clearInterval(timer);timer=null;}
    running=false;
    stopRecognition();
    if(mediaRecorder&&mediaRecorder.state!=='inactive'){try{mediaRecorder.stop()}catch(e){stopTracks();}}
    else stopTracks();
    const box=document.getElementById('dailySpeakingBox');if(box){
      const btn=box.querySelector('.ds-start');btn.textContent='🎙️ 开始口语';btn.classList.remove('recording');
      save();
    }
  }
  function startRecognition(box){
    if(!SpeechRecognition){
      box.querySelector('.ds-status').textContent='正在录音。当前浏览器不支持自动转文字，你仍可说满60秒并回放；说完后可在下方填写/修正文字。';
      return;
    }
    recognitionFailed=false;
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
      const ta=box.querySelector('.ds-transcript');
      ta.value=shown;
      updateStats(box,(Date.now()-startAt)/1000,shown);
    };
    recognition.onerror=e=>{
      if(e.error==='network'){
        recognitionFailed=true;
        box.querySelector('.ds-status').textContent='在线转文字服务连接失败，但录音和计时仍在继续。说完后可回放录音，并在下方手动填写/修正文字。';
        stopRecognition();
        return;
      }
      if(e.error==='not-allowed'){
        box.querySelector('.ds-status').textContent='语音转文字权限被拒绝；如果麦克风录音权限已允许，录音仍会继续。';
        stopRecognition();return;
      }
      box.querySelector('.ds-status').textContent='自动转文字暂不可用（'+e.error+'），录音和计时仍继续。';
      stopRecognition();
    };
    recognition.onend=()=>{
      if(running&&!recognitionFailed&&recognition){try{recognition.start()}catch(e){}}
    };
    try{recognition.start();}catch(e){
      box.querySelector('.ds-status').textContent='自动转文字启动失败，但录音和计时仍继续。';
      recognition=null;
    }
  }
  async function start(){
    const box=document.getElementById('dailySpeakingBox');if(!box)return;
    if(running){stop();return;}
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
      box.querySelector('.ds-status').textContent='当前浏览器无法访问麦克风。请用最新版 Chrome / Edge，并确认网站麦克风权限。';return;
    }
    try{
      mediaStream=await navigator.mediaDevices.getUserMedia({audio:true});
    }catch(e){
      box.querySelector('.ds-status').textContent=e&&e.name==='NotAllowedError'?'请允许这个网站使用麦克风后再试。':'麦克风启动失败：'+(e?.name||'unknown');return;
    }
    audioChunks=[];recognitionFailed=false;
    try{
      mediaRecorder=new MediaRecorder(mediaStream);
      mediaRecorder.ondataavailable=e=>{if(e.data&&e.data.size)audioChunks.push(e.data)};
      mediaRecorder.onstop=()=>{makePlayback();stopTracks();};
      mediaRecorder.start(500);
    }catch(e){
      mediaRecorder=null;
      box.querySelector('.ds-status').textContent='录音组件启动失败。';stopTracks();return;
    }
    running=true;startAt=Date.now();box.dataset.seconds='0';
    box.querySelector('.ds-start').textContent='⏹ 停止';box.querySelector('.ds-start').classList.add('recording');
    box.querySelector('.ds-status').textContent='正在录音并尝试自动识别印尼语。即使转文字失败，录音和计时也不会中断。';
    box.querySelector('.ds-playback').innerHTML='';
    startRecognition(box);
    timer=setInterval(()=>{
      if(!running)return;
      const sec=(Date.now()-startAt)/1000;box.dataset.seconds=String(sec);updateStats(box,sec,transcriptValue(box));
      if(sec>=60)stop();
    },250);
  }
  function reset(){
    stop();const box=document.getElementById('dailySpeakingBox');if(!box)return;
    box.querySelector('.ds-transcript').value='';box.querySelector('.ds-playback').innerHTML='';box.dataset.seconds='0';updateStats(box,0,'');
    if(audioUrl){try{URL.revokeObjectURL(audioUrl)}catch(e){}audioUrl='';}
    try{localStorage.removeItem(currentKey())}catch(e){}
  }
  function inject(){
    const body=document.getElementById('dailyBody');if(!body||!document.getElementById('daily')?.classList.contains('active'))return;
    const old=document.getElementById('dailySpeakingBox');if(old)return;
    const vocab=targetWords();if(!vocab.length)return;
    const completion=[...body.querySelectorAll('button')].find(b=>b.textContent.includes('我学完了')||b.textContent.includes('已学完'));
    const sec=document.createElement('section');sec.id='dailySpeakingBox';sec.className='dailyFixSec';sec.dataset.seconds='0';
    sec.innerHTML='<h3><span class="dailyFixNo">🎙</span>口语输入 · 60秒</h3>'+
      '<div class="ds-prompt">围绕今天的工作、生活或行程变化连续说 30–60 秒。尽量自然使用 <b>至少4个</b> 今日词汇。</div>'+
      '<div class="ds-actions"><button type="button" class="primary ds-start">🎙️ 开始口语</button><button type="button" class="secondary ds-reset">重新录入</button></div>'+
      '<div class="ds-status muted">点击开始后会先启动本地录音，再尝试在线转文字。</div>'+
      '<div class="ds-result"><div><span>时长</span><b class="ds-time">0 秒</b></div><div><span>目标词命中</span><b class="ds-hit">0 / 4</b></div></div>'+
      '<div class="ds-playback"></div>'+
      '<label class="ds-label" for="dsTranscript">自动转写 / 手动修正</label><textarea id="dsTranscript" class="ds-transcript" rows="4" placeholder="自动识别成功时会显示在这里；如果网络识别失败，可以听回放后自己补写。"></textarea><div class="ds-tags"></div>'+
      '<div class="ds-self"><span>说完后自评：</span><button type="button" data-v="很顺">很顺</button><button type="button" data-v="有点卡">有点卡</button><button type="button" data-v="很难说出来">很难说出来</button></div>';
    if(completion)completion.closest('div').before(sec);else body.appendChild(sec);
    sec.querySelector('.ds-start').addEventListener('click',start);sec.querySelector('.ds-reset').addEventListener('click',reset);
    sec.querySelector('.ds-transcript').addEventListener('input',()=>{updateStats(sec,Number(sec.dataset.seconds||0),transcriptValue(sec));save();});
    sec.querySelectorAll('.ds-self button').forEach(b=>b.addEventListener('click',()=>{sec.querySelectorAll('.ds-self button').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');try{localStorage.setItem(currentKey()+'_self',b.dataset.v)}catch(e){}}));
    let self='';try{self=localStorage.getItem(currentKey()+'_self')||''}catch(e){};if(self)sec.querySelector('.ds-self button[data-v="'+self+'"]')?.classList.add('selected');
    updateStats(sec,0,'');restore();
  }
  if(!document.getElementById('dailySpeakingStyle')){
    const st=document.createElement('style');st.id='dailySpeakingStyle';st.textContent=`
      #dailySpeakingBox .ds-prompt{line-height:1.7;color:#46546a;background:#f8faff;border-radius:12px;padding:12px 14px}.ds-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:12px}.ds-start.recording{background:#b42318}.ds-status{margin-top:9px}.ds-result{display:flex;gap:12px;margin-top:12px;flex-wrap:wrap}.ds-result>div{border:1px solid var(--line);border-radius:11px;padding:9px 12px;min-width:130px}.ds-result span{display:block;font-size:12px;color:var(--muted)}.ds-result b{font-size:18px}.ds-playback{margin-top:12px;text-align:left}.ds-playback audio{width:100%;max-width:520px}.ds-label{display:block;text-align:left;font-size:13px;color:var(--muted);margin:12px 0 5px}.ds-transcript{width:100%;min-height:92px;border:1px solid var(--line);border-radius:12px;padding:12px 14px;line-height:1.75;background:#fff;text-align:left;resize:vertical;font:inherit;color:inherit}.ds-tags{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.ds-tag{font-size:12px;border-radius:999px;background:#f1f3f7;color:#657084;padding:5px 8px}.ds-tag.ok{background:#eaf7ee;color:#19703a}.ds-self{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:13px}.ds-self button{border:1px solid var(--line);background:#fff;border-radius:9px;padding:7px 10px;cursor:pointer}.ds-self button.selected{background:#eef3ff;color:#3157d5;border-color:#9ab0ee}@media(max-width:650px){.ds-result>div{flex:1;min-width:120px}.ds-actions button{flex:1}}
    `;document.head.appendChild(st);
  }
  const body=document.getElementById('dailyBody');if(body)new MutationObserver(()=>setTimeout(inject,0)).observe(body,{childList:true,subtree:false});
  window.addEventListener('load',()=>setTimeout(inject,100));
})();
