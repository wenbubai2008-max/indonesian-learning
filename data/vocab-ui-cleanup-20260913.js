(function(){
  if(window.__VOCAB_UI_CLEANUP_20260913__)return;window.__VOCAB_UI_CLEANUP_20260913__=true;
  const norm=s=>String(s||'').trim().toLowerCase();
  const html=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
  function libSelect(){return document.getElementById('librarySelect')}
  function bipaLevel(){const s=libSelect(),t=s&&s.options[s.selectedIndex]?s.options[s.selectedIndex].textContent:'';const m=String(t).match(/BIPA\s*[（(]?\s*(A1|A2|B1|B2)/i);return m?m[1].toUpperCase():''}
  function isBipa(){return !!bipaLevel()}
  function rawInfo(word){const lv=bipaLevel(),rows=(window.BIPA_VOCAB_RAW&&window.BIPA_VOCAB_RAW[lv])||[];const r=rows.find(x=>Array.isArray(x)&&norm(x[0])===norm(word));if(!r)return null;return {word:r[0]||'',cn:r[1]||'',en:r[2]||'',root:r[3]||'',formation:r[4]||'',theme:r[5]||'',unit:r[6]||'',pages:r[7]||'',sab:String(r[8]||'').toUpperCase(),source:r[9]||'',level:lv}}
  function infoFor(x){const r=isBipa()?rawInfo(x&&x.word):null;return {word:(r&&r.word)||(x&&x.word)||'',cn:(r&&r.cn)||(x&&x.cn)||'',en:(r&&r.en)||(x&&x.en)||'',root:(r&&r.root)||(x&&x.root)||'',theme:(r&&r.theme)||'',sab:(r&&r.sab)||'',level:(r&&r.level)||'',scene:(x&&(x.example||x.scene))||'',sceneCn:(x&&(x.example_cn||x.scene_cn))||''}}

  function addStyle(){if(document.getElementById('vocabCleanStyle'))return;const s=document.createElement('style');s.id='vocabCleanStyle';s.textContent=`
  #vocab .cleanFlash{min-height:510px;position:relative;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;background:#fbfcff;border:1px solid #dfe5f1;border-radius:24px;padding:58px 44px 46px;overflow:hidden}
  #vocab .cleanProgress{position:absolute;left:38px;top:30px;color:#8a94a8;font-size:16px;font-weight:800}
  #vocab .cleanTopic{position:absolute;right:32px;top:26px;background:#eef3ff;color:#3157d5;border-radius:999px;padding:8px 13px;font-size:14px;font-weight:800;max-width:42%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #vocab .cleanSab{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-weight:900;font-size:16px;border:1px solid transparent;box-shadow:0 4px 14px rgba(23,32,51,.08)}
  #vocab .cleanSab.S{background:#e8f7ed;color:#17743a;border-color:#bfe8cb}#vocab .cleanSab.A{background:#fff5dd;color:#9a6500;border-color:#f4dda1}#vocab .cleanSab.B{background:#eef1f6;color:#647084;border-color:#dfe4ec}
  #vocab .cleanWordLine{display:flex;align-items:center;justify-content:center;gap:18px;max-width:100%}
  #vocab .cleanWord{font-size:52px;line-height:1.12;font-weight:880;color:#626d83;overflow-wrap:anywhere}
  #vocab .cleanSound{width:58px;height:58px;min-width:58px;border-radius:16px;border:1px solid #dde3ee;background:#fff;box-shadow:0 6px 18px rgba(23,32,51,.06);cursor:pointer;font-size:26px;display:flex;align-items:center;justify-content:center}
  #vocab .cleanMeaning{display:none;margin-top:34px;max-width:760px}.cleanFlash.revealed .cleanMeaning{display:block}
  #vocab .cleanCn{font-size:27px;font-weight:850;color:#5d687e;line-height:1.45}.cleanEn{font-size:20px;color:#778197;margin-top:11px;line-height:1.45}
  #vocab .cleanRoot{font-size:16px;color:#8a94a8;font-weight:750;margin-top:22px}.cleanExample{font-size:17px;color:#566174;line-height:1.7;margin-top:18px}.cleanExampleCn{font-size:14px;color:#8a94a8;margin-top:4px}
  #vocab .cleanActions,#vocab .cleanMemory{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:18px}
  #vocab .cleanActions button,#vocab .cleanMemory button{border:0;border-radius:14px;padding:12px 22px;font-weight:800;cursor:pointer}.cleanActions .nav{background:#eef1f6;color:#172033}.cleanActions .next{background:#3157d5;color:#fff}.cleanMemory{border-top:1px solid #e5e9f1;padding-top:17px}.cleanMemory button{background:#fff;border:1px solid #e0e5ee!important;color:#283246}.cleanMemory .know{border-color:#bfe8cb!important}.cleanMemory .fuzzy{border-color:#f2d89c!important}.cleanMemory .dont{border-color:#efc8c4!important}
  #sabFilterClean{min-width:120px}#sabFilterClean[hidden]{display:none!important}
  @media(max-width:700px){#vocab .cleanFlash{min-height:430px;padding:68px 20px 36px}#vocab .cleanProgress{left:20px;top:24px;font-size:14px}#vocab .cleanTopic{right:18px;top:19px;max-width:55%;font-size:12px;padding:7px 10px}#vocab .cleanWord{font-size:38px}#vocab .cleanSound{width:50px;height:50px;min-width:50px}#vocab .cleanCn{font-size:23px}}
  `;document.head.appendChild(s)}

  let audio=null;
  function fallbackAudio(text){try{if(audio){audio.pause();audio=null}const u='https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=id&q='+encodeURIComponent(text);audio=new Audio(u);audio.play().catch(()=>{});}catch(e){}}
  function speakID(text){text=String(text||'').trim();if(!text)return;try{if(audio){audio.pause();audio=null}const syn=window.speechSynthesis;if(!syn){fallbackAudio(text);return}syn.cancel();syn.resume();const u=new SpeechSynthesisUtterance(text);u.lang='id-ID';u.rate=.9;u.pitch=1;const vs=syn.getVoices&&syn.getVoices()||[];const v=vs.find(v=>/^id(-|_)/i.test(v.lang||''))||vs.find(v=>/indones/i.test(v.name||''));if(v)u.voice=v;let failed=false;u.onerror=function(){if(!failed){failed=true;fallbackAudio(text)}};syn.speak(u);setTimeout(()=>{if(!failed&&!syn.speaking&&!syn.pending)fallbackAudio(text)},500);}catch(e){fallbackAudio(text)}}
  window.cleanSpeak=speakID;window.speak=speakID;try{speak=speakID}catch(e){}

  function ensureSabFilter(){const tb=document.querySelector('#vocab .toolbar'),cat=document.getElementById('cat');if(!tb)return null;let s=document.getElementById('sabFilterClean');if(!s){s=document.createElement('select');s.id='sabFilterClean';s.innerHTML='<option value="">全部分级</option><option value="S">S · 核心</option><option value="A">A · 常用</option><option value="B">B · 低频</option>';s.addEventListener('change',()=>window.applyFilter&&window.applyFilter());if(cat&&cat.nextSibling)tb.insertBefore(s,cat.nextSibling);else tb.appendChild(s)}return s}
  function syncControls(){const b=isBipa(),sab=ensureSabFilter(),cat=document.getElementById('cat');if(sab)sab.hidden=!b;if(!b&&sab)sab.value='';if(cat&&cat.options.length)cat.options[0].textContent=b?'全部主题':'全部分类';document.querySelectorAll('#vocab .toolbar select').forEach(s=>{if(s===sab||s===cat||s.id==='librarySelect'||s.id==='mode')return;const txt=[...s.options].map(o=>o.textContent).join(' ');if(/全部分级|S\s*[·级]|A\s*[·级]|B\s*[·级]/.test(txt))s.style.display='none';});}

  function statusFilter(){if(!isBipa())return;const sab=document.getElementById('sabFilterClean')?.value||'';if(!sab)return;try{FILTER=(FILTER||[]).filter(x=>{const r=rawInfo(x.word);return r&&r.sab===sab});idx=0;}catch(e){}}

  function renderClean(){const box=document.getElementById('vocabBox');if(!box)return;syncControls();let arr=[];try{arr=FILTER||[]}catch(e){}if(!arr.length){box.innerHTML='<div class="empty">没有匹配词汇</div>';return}let x=null;try{x=typeof current==='function'?current():arr[(idx||0)%arr.length]}catch(e){x=arr[0]}if(!x){box.innerHTML='<div class="empty">没有匹配词汇</div>';return}const info=infoFor(x),b=isBipa();let pos=1;try{pos=(idx%arr.length)+1}catch(e){}const sab=b&&info.sab?`<div class="cleanSab ${html(info.sab)}" title="${info.sab==='S'?'核心必须掌握':info.sab==='A'?'常用建议掌握':'低频主题词'}">${html(info.sab)}</div>`:'';const topic=b&&info.theme?`<div class="cleanTopic">${html(info.theme)}</div>`:'';const root=info.root?`<div class="cleanRoot">词根 · ${html(info.root)}</div>`:'';const ex=(!b&&info.scene)?`<div class="cleanExample">${html(info.scene)}</div>${info.sceneCn?`<div class="cleanExampleCn">${html(info.sceneCn)}</div>`:''}`:'';
    box.innerHTML=`<div id="flash" class="cleanFlash"><div class="cleanProgress">第 ${pos} / ${arr.length} 个</div>${topic}<div>${sab}<div class="cleanWordLine"><div class="cleanWord">${html(info.word)}</div><button class="cleanSound" type="button" onclick='cleanSpeak(${JSON.stringify(info.word)})' aria-label="播放发音">🔊</button></div><div class="cleanMeaning"><div class="cleanCn">${html(info.cn||'暂无中文')}</div><div class="cleanEn">${html(info.en||'')}</div>${root}${ex}</div></div></div><div class="cleanActions"><button class="nav" type="button" onclick="prevCleanWord()">上一个</button><button class="nav" id="cleanFlipBtn" type="button" onclick="toggleCleanFlash()">翻卡</button><button class="next" type="button" onclick="nextWord()">下一个</button></div><div class="cleanMemory"><button class="know" type="button" onclick="mark('know')">会了</button><button class="fuzzy" type="button" onclick="mark('fuzzy')">模糊</button><button class="dont" type="button" onclick="mark('dont')">不会</button></div>`;
  }
  window.prevCleanWord=function(){try{if(!FILTER||!FILTER.length)return;idx=(idx-1+FILTER.length)%FILTER.length;window.renderVocab();}catch(e){}};
  window.toggleCleanFlash=function(){const f=document.getElementById('flash'),b=document.getElementById('cleanFlipBtn');if(!f)return;f.classList.toggle('revealed');if(b)b.textContent=f.classList.contains('revealed')?'收起':'翻卡'};

  function install(){addStyle();syncControls();
    const oldRender=window.renderVocab;if(!oldRender)return setTimeout(install,80);
    const cleanRender=function(){const mode=document.getElementById('mode')?.value||'flash';if(mode==='quiz'){oldRender();return}renderClean()};window.renderVocab=cleanRender;try{renderVocab=cleanRender}catch(e){}
    const oldApply=window.applyFilter;const cleanApply=function(){if(typeof oldApply==='function')oldApply();statusFilter();cleanRender()};window.applyFilter=cleanApply;try{applyFilter=cleanApply}catch(e){}
    const ls=libSelect();if(ls)ls.addEventListener('change',()=>setTimeout(()=>{syncControls();cleanRender()},0));
    document.getElementById('mode')?.addEventListener('change',()=>setTimeout(cleanRender,0));
    window.addEventListener('vocab-library-ready',()=>setTimeout(()=>{syncControls();cleanRender()},30));
    setTimeout(()=>{syncControls();cleanRender()},40);
  }
  if(document.readyState==='complete')setTimeout(install,0);else window.addEventListener('load',()=>setTimeout(install,0),{once:true});
})();