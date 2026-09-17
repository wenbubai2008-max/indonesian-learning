(function(){
  if(window.__VOCAB_FINAL_FIX_20260913__) return;
  window.__VOCAB_FINAL_FIX_20260913__ = true;

  const norm = s => String(s || '').trim().toLowerCase();
  const escH = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
  const byId = id => document.getElementById(id);

  function selectedLibraryText(){
    const s = byId('librarySelect');
    return s && s.options && s.selectedIndex >= 0 ? String(s.options[s.selectedIndex].textContent || '') : '';
  }
  function bipaLevel(){
    const m = selectedLibraryText().match(/BIPA\s*[（(]?\s*(A1|A2|B1|B2)/i);
    return m ? m[1].toUpperCase() : '';
  }
  function isBipa(){ return !!bipaLevel(); }
  function bipaRaw(word){
    const lv = bipaLevel();
    const rows = (window.BIPA_VOCAB_RAW && window.BIPA_VOCAB_RAW[lv]) || [];
    const row = rows.find(r => Array.isArray(r) && norm(r[0]) === norm(word));
    if(!row) return null;
    return {
      word: row[0] || '', cn: row[1] || '', en: row[2] || '', root: row[3] || '',
      theme: row[5] || '', sab: String(row[8] || '').toUpperCase(), level: lv
    };
  }
  function infoFor(x){
    const r = isBipa() ? bipaRaw(x && x.word) : null;
    return {
      word: (r && r.word) || (x && x.word) || '',
      cn: (r && r.cn) || (x && x.cn) || '',
      en: (r && r.en) || (x && x.en) || '',
      root: (r && r.root) || (x && x.root) || '',
      theme: (r && r.theme) || '', sab: (r && r.sab) || '',
      scene: (x && (x.example || x.scene)) || '',
      sceneCn: (x && (x.example_cn || x.scene_cn)) || '',
      note: (x && x.note) || '', categories: (x && x.categories) || []
    };
  }

  function addFinalStyle(){
    if(byId('vocabFinalFixStyle')) return;
    const st = document.createElement('style');
    st.id = 'vocabFinalFixStyle';
    st.textContent = `
      #vocab .toolbar{
        width:100%;display:grid!important;
        grid-template-columns:190px minmax(220px,1fr) 150px 115px 95px 118px;
        gap:10px;align-items:center;margin:14px 0 18px;overflow:visible;
      }
      #vocab .toolbar input,#vocab .toolbar select,#vocab .toolbar button{
        width:100%;min-width:0;max-width:100%;height:48px;margin:0;white-space:nowrap;
      }
      #vocab .toolbar input,#vocab .toolbar select{padding:9px 12px}
      #vocab .toolbar button{padding:9px 12px}
      #vocab #sabFilterClean[hidden]{display:none!important}
      #vocab .cleanSab{
        width:50px!important;height:50px!important;font-size:18px!important;
        position:relative!important;top:-24px!important;margin:0 auto -24px!important;
        box-shadow:0 5px 16px rgba(23,32,51,.09)!important;
      }
      #vocab .cleanTopic{top:26px!important;right:32px!important}
      #vocab .cleanRoot{margin-top:22px!important}
      #vocab .finalSoundBusy{opacity:.55;transform:scale(.96)}
      @media(max-width:1050px){
        #vocab .toolbar{grid-template-columns:180px minmax(200px,1fr) 145px 110px 90px 110px;gap:8px}
      }
      @media(max-width:850px){
        #vocab .toolbar{grid-template-columns:1fr 1fr 1fr!important}
        #vocab .toolbar input{grid-column:span 2}
      }
      @media(max-width:620px){
        #vocab .toolbar{grid-template-columns:1fr 1fr!important}
        #vocab .toolbar input{grid-column:1/-1}
        #vocab .cleanSab{top:-18px!important;margin-bottom:-18px!important}
      }
    `;
    document.head.appendChild(st);
  }

  let activeAudio = null;
  let audioSeq = 0;
  function stopAudio(){
    audioSeq++;
    if(activeAudio){ try{ activeAudio.pause(); activeAudio.src = ''; }catch(e){} activeAudio = null; }
    try{ if(window.speechSynthesis) window.speechSynthesis.cancel(); }catch(e){}
  }
  function browserSpeech(text){
    try{
      const syn = window.speechSynthesis;
      if(!syn || typeof SpeechSynthesisUtterance === 'undefined') return false;
      syn.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'id-ID'; u.rate = 0.88; u.pitch = 1;
      const voices = syn.getVoices ? syn.getVoices() : [];
      const idVoice = voices.find(v => /^id(?:-|_)/i.test(v.lang || '')) || voices.find(v => /indones/i.test(v.name || ''));
      if(idVoice) u.voice = idVoice;
      syn.speak(u);
      return true;
    }catch(e){ return false; }
  }
  function playRemote(text, button){
    const seq = ++audioSeq;
    const endpoints = [
      'https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=id&q=',
      'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=id&q='
    ];
    let i = 0;
    function tryOne(){
      if(seq !== audioSeq) return;
      if(i >= endpoints.length){ browserSpeech(text); if(button) button.classList.remove('finalSoundBusy'); return; }
      try{
        const a = new Audio(); activeAudio = a; a.preload = 'auto'; a.volume = 1;
        let settled = false;
        const fail = () => { if(settled) return; settled = true; i++; tryOne(); };
        a.onerror = fail;
        a.oncanplaythrough = () => {
          if(settled || seq !== audioSeq) return;
          settled = true;
          const p = a.play();
          if(p && p.catch) p.catch(() => { i++; tryOne(); });
        };
        a.onended = () => { if(button) button.classList.remove('finalSoundBusy'); };
        a.src = endpoints[i] + encodeURIComponent(text);
        a.load();
        setTimeout(() => { if(!settled && seq === audioSeq) fail(); }, 1800);
      }catch(e){ i++; tryOne(); }
    }
    tryOne();
  }
  function speakReliable(text, button){
    text = String(text || '').trim();
    if(!text) return;
    stopAudio();
    if(button) button.classList.add('finalSoundBusy');
    playRemote(text, button);
  }
  window.speakReliable = speakReliable;
  window.speak = function(text){ speakReliable(text, null); };
  try{ speak = window.speak; }catch(e){}

  function ensureSabControl(){
    const toolbar = document.querySelector('#vocab .toolbar');
    if(!toolbar) return null;
    let s = byId('sabFilterClean');
    const cat = byId('cat');
    if(!s){
      s = document.createElement('select'); s.id = 'sabFilterClean';
      s.innerHTML = '<option value="">全部分级</option><option value="S">S · 核心</option><option value="A">A · 常用</option><option value="B">B · 低频</option>';
      if(cat && cat.nextSibling) toolbar.insertBefore(s, cat.nextSibling); else toolbar.appendChild(s);
      s.addEventListener('change', () => window.applyFilter && window.applyFilter());
    }
    return s;
  }
  function syncToolbar(){
    const b = isBipa();
    const sab = ensureSabControl();
    const cat = byId('cat');
    if(sab){ sab.hidden = !b; if(!b) sab.value = ''; }
    if(cat && cat.options && cat.options.length) cat.options[0].textContent = b ? '全部主题' : '全部分类';
    const reload = [...document.querySelectorAll('#vocab .toolbar button')].find(x => /重新加载/.test(x.textContent || ''));
    if(reload) reload.textContent = '重新加载';
  }

  function currentItem(){
    try{
      if(typeof current === 'function') return current();
      const a = window.FILTER || FILTER || [];
      const i = Number(window.idx ?? idx ?? 0);
      return a.length ? a[i % a.length] : null;
    }catch(e){ return null; }
  }
  function currentArray(){ try{ return FILTER || []; }catch(e){ return window.FILTER || []; } }
  function currentIndex(){ try{ return Number(idx || 0); }catch(e){ return Number(window.idx || 0); } }

  function renderLegacy(){
    const box = byId('vocabBox'); if(!box) return;
    const arr = currentArray();
    if(!arr.length){ box.innerHTML = '<div class="empty">没有匹配词汇</div>'; return; }
    const x = currentItem(); if(!x) return;
    const mode = byId('mode')?.value || 'flash';
    if(mode === 'quiz'){
      const others = arr.filter(y => y.word !== x.word && y.cn).sort(() => Math.random() - .5).slice(0,3);
      const opts = [x, ...others].sort(() => Math.random() - .5);
      box.innerHTML = '<div class="q">“'+escH(x.word)+'” 最接近哪个意思？ <button class="sound" type="button" data-final-speak="'+escH(x.word)+'">🔊</button></div><div class="opts">'+opts.map(o=>'<button class="opt" onclick="answerQuiz(this,'+JSON.stringify(o.word===x.word)+')">'+escH(o.cn||o.en||'—')+'</button>').join('')+'</div><div class="actions"><button class="primary" onclick="nextWord()">下一题</button></div>';
      return;
    }
    const muted = x.root ? '词根：'+x.root : (x.categories || []).join(' · ');
    box.innerHTML = '<div id="flash" class="flash"><div class="word">'+escH(x.word)+' <button class="sound" type="button" data-final-speak="'+escH(x.word)+'">🔊</button></div><div class="muted">'+escH(muted)+'</div><div class="meaning"><b>'+escH(x.cn||'暂无中文')+'</b><div class="muted">'+escH(x.en||'')+'</div><div style="margin-top:10px">'+escH(x.scene||x.example||'')+'</div><div class="muted">'+escH(x.note||'')+'</div></div></div><div class="actions"><button class="secondary" type="button" onclick="prevFinalWord()">上一个</button><button class="secondary" type="button" onclick="flipFinalCard()">翻卡</button><button class="primary" type="button" onclick="nextWord()">下一个</button></div><div class="memory"><button onclick="mark(\'know\')">会了</button><button onclick="mark(\'fuzzy\')">模糊</button><button onclick="mark(\'dont\')">不会</button></div>';
  }

  function renderBipa(){
    const box = byId('vocabBox'); if(!box) return;
    const arr = currentArray();
    if(!arr.length){ box.innerHTML = '<div class="empty">没有匹配词汇</div>'; return; }
    const x = currentItem(); if(!x) return;
    const mode = byId('mode')?.value || 'flash';
    if(mode === 'quiz'){ renderLegacy(); return; }
    const info = infoFor(x);
    const i = currentIndex();
    const pos = arr.length ? ((i % arr.length) + 1) : 1;
    const topic = info.theme ? '<div class="cleanTopic">'+escH(info.theme)+'</div>' : '';
    const sab = info.sab ? '<div class="cleanSab '+escH(info.sab)+'">'+escH(info.sab)+'</div>' : '';
    const root = info.root ? '<div class="cleanRoot">词根 · '+escH(info.root)+'</div>' : '';
    box.innerHTML = '<div id="flash" class="cleanFlash"><div class="cleanProgress">第 '+pos+' / '+arr.length+' 个</div>'+topic+'<div>'+sab+'<div class="cleanWordLine"><div class="cleanWord">'+escH(info.word)+'</div><button class="cleanSound" type="button" data-final-speak="'+escH(info.word)+'" aria-label="播放发音">🔊</button></div><div class="cleanMeaning"><div class="cleanCn">'+escH(info.cn||'暂无中文')+'</div><div class="cleanEn">'+escH(info.en||'')+'</div>'+root+'</div></div></div><div class="cleanActions"><button class="nav" type="button" onclick="prevFinalWord()">上一个</button><button class="nav" id="cleanFlipBtn" type="button" onclick="flipFinalCard()">翻卡</button><button class="next" type="button" onclick="nextWord()">下一个</button></div><div class="cleanMemory"><button class="know" type="button" onclick="mark(\'know\')">会了</button><button class="fuzzy" type="button" onclick="mark(\'fuzzy\')">模糊</button><button class="dont" type="button" onclick="mark(\'dont\')">不会</button></div>';
  }

  function finalRender(){ syncToolbar(); if(isBipa()) renderBipa(); else renderLegacy(); }
  window.prevFinalWord = function(){
    try{ const arr = currentArray(); if(!arr.length) return; idx = (currentIndex()-1+arr.length)%arr.length; finalRender(); }
    catch(e){}
  };
  window.flipFinalCard = function(){
    const f = byId('flash'); if(!f) return;
    f.classList.toggle('revealed');
    const b = byId('cleanFlipBtn'); if(b) b.textContent = f.classList.contains('revealed') ? '收起' : '翻卡';
  };

  function install(){
    addFinalStyle(); syncToolbar();
    const oldApply = window.applyFilter;
    const wrappedApply = function(){
      if(typeof oldApply === 'function') oldApply();
      if(isBipa()){
        const sab = byId('sabFilterClean')?.value || '';
        if(sab){
          try{ FILTER = (FILTER || []).filter(x => { const r = bipaRaw(x.word); return r && r.sab === sab; }); idx = 0; }catch(e){}
        }
      }
      finalRender();
    };
    window.applyFilter = wrappedApply; try{ applyFilter = wrappedApply; }catch(e){}
    window.renderVocab = finalRender; try{ renderVocab = finalRender; }catch(e){}

    const vb = byId('vocabBox');
    if(vb && !vb.dataset.finalSoundBound){
      vb.dataset.finalSoundBound = '1';
      vb.addEventListener('click', function(e){
        const btn = e.target.closest && e.target.closest('[data-final-speak]');
        if(!btn) return;
        e.preventDefault(); e.stopPropagation();
        speakReliable(btn.getAttribute('data-final-speak') || '', btn);
      }, true);
    }
    const lib = byId('librarySelect');
    if(lib) lib.addEventListener('change', () => setTimeout(() => { syncToolbar(); finalRender(); }, 30));
    byId('mode')?.addEventListener('change', () => setTimeout(finalRender, 0));
    window.addEventListener('vocab-library-ready', () => setTimeout(() => { syncToolbar(); finalRender(); }, 40));
    setTimeout(finalRender, 60);
  }

  if(document.readyState === 'complete') setTimeout(install, 0);
  else window.addEventListener('load', () => setTimeout(install, 0), {once:true});
})();
