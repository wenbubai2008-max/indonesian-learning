(function(){
  if(window.__BIPA_FINAL_20260913_V7__)return;
  window.__BIPA_FINAL_20260913_V7__=true;

  const $=id=>document.getElementById(id);
  const norm=s=>String(s||'').trim().toLowerCase();
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
  const oldRender=window.renderVocab;
  const oldApply=window.applyFilter;
  const oldMark=window.mark;
  const oldStats=window.updateStats;
  const oldShowKnown=window.showKnownWords;

  function libText(){const s=$('librarySelect');return s&&s.selectedIndex>=0?String(s.options[s.selectedIndex]?.textContent||''):''}
  function level(){const m=libText().match(/BIPA\s*[（(]?\s*(A1|A2|B1|B2)/i);return m?m[1].toUpperCase():''}
  function isBipa(){return !!level()}
  function memKey(){return 'indo_bipa_mem_'+level()}
  function getMem(){try{return JSON.parse(localStorage.getItem(memKey())||'{}')}catch(e){return {}}}
  function saveMem(m){localStorage.setItem(memKey(),JSON.stringify(m||{}))}
  function statusOf(m,w){return m[norm(w)]||''}
  function raw(word){
    const rows=(window.BIPA_VOCAB_RAW&&window.BIPA_VOCAB_RAW[level()])||[];
    const r=rows.find(x=>Array.isArray(x)&&norm(x[0])===norm(word));
    if(!r)return null;
    return {word:r[0]||'',cn:r[1]||'',en:r[2]||'',root:r[3]||'',theme:r[5]||'',sab:String(r[8]||'').trim().toUpperCase()};
  }
  function info(x){
    const r=raw(x&&x.word);
    return {
      word:(r&&r.word)||(x&&x.word)||'',
      cn:(r&&r.cn)||(x&&x.cn)||'',
      en:(r&&r.en)||(x&&x.en)||'',
      root:(r&&r.root)||(x&&x.root)||'',
      theme:(r&&r.theme)||(x&&x.theme)||'',
      sab:(r&&r.sab)||String((x&&(x.sab||x.grade||x.priority))||'').toUpperCase()
    };
  }
  function src(){try{return (DB||[]).slice()}catch(e){return []}}
  function list(){try{return FILTER||[]}catch(e){return []}}
  function pos(){try{return Number(idx||0)}catch(e){return 0}}
  function currentFinal(){const a=list();if(!a.length)return null;const i=((pos()%a.length)+a.length)%a.length;return a[i]||a[0]}

  function resetTestProgressOnce(){
    const key='bipa_progress_reset_v7';
    if(localStorage.getItem(key)==='1')return;
    ['A1','A2','B1','B2'].forEach(l=>localStorage.removeItem('indo_bipa_mem_'+l));
    localStorage.setItem(key,'1');
  }

  function installStyle(){
    let st=$('bipaFinalV7Style');if(st)st.remove();
    st=document.createElement('style');st.id='bipaFinalV7Style';st.textContent=`
      #vocab.bipaFinalV7 .toolbar{display:grid!important;grid-template-columns:180px minmax(170px,1fr) 145px 110px 88px 120px;gap:8px!important;align-items:center!important;width:100%!important}
      #vocab.bipaFinalV7 .toolbar>*{min-width:0!important;max-width:100%!important;width:100%!important;height:48px!important;margin:0!important}
      #vocab.bipaFinalV7 #sabFilterStable{display:block}
      #vocab .bipaV7Card{height:330px;min-height:330px;position:relative;display:flex;align-items:center;justify-content:center;text-align:center;background:#fbfcff;border:1px solid #dfe5f1;border-radius:24px;padding:40px 30px 30px;overflow:hidden}
      #vocab .bipaV7Progress{position:absolute;left:34px;top:24px;color:#8a94a8;font-size:16px;font-weight:800}
      #vocab .bipaV7Topic{position:absolute;right:28px;top:20px;background:#eef3ff;color:#3157d5;border-radius:999px;padding:7px 12px;font-size:14px;font-weight:800;max-width:46%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #vocab .bipaV7Core{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:0;transform:translateY(-2px)}
      #vocab .bipaV7Badge{width:58px;height:58px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:24px;font-size:21px;font-weight:900;border:1px solid transparent;box-shadow:0 5px 16px rgba(23,32,51,.09)}
      #vocab .bipaV7Badge.S{background:#e8f7ed;color:#17743a;border-color:#bfe8cb}#vocab .bipaV7Badge.A{background:#fff5dd;color:#9a6500;border-color:#f4dda1}#vocab .bipaV7Badge.B{background:#eef1f6;color:#647084;border-color:#dfe4ec}
      #vocab .bipaV7WordLine{display:flex;align-items:center;justify-content:center;gap:16px}
      #vocab .bipaV7Word{font-size:50px;line-height:1.1;font-weight:880;color:#626d83;overflow-wrap:anywhere}
      #vocab .bipaV7Sound{width:56px!important;height:56px!important;min-width:56px!important;border-radius:16px;border:1px solid #dde3ee;background:#fff;box-shadow:0 6px 18px rgba(23,32,51,.06);font-size:25px;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0!important}
      #vocab .bipaV7Meaning{position:absolute;left:50%;top:188px;transform:translateX(-50%);width:min(720px,82vw);opacity:0;visibility:hidden;pointer-events:none}
      #vocab .bipaV7Card.revealed .bipaV7Meaning{opacity:1;visibility:visible;pointer-events:auto}
      #vocab .bipaV7Cn{font-size:24px;font-weight:850;color:#5d687e;line-height:1.35}.bipaV7En{font-size:18px;color:#778197;margin-top:7px;line-height:1.35}.bipaV7Root{font-size:15px;color:#8a94a8;font-weight:750;margin-top:12px}
      #vocab .bipaV7Actions,#vocab .bipaV7Memory{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:16px}
      #vocab .bipaV7Actions button,#vocab .bipaV7Memory button{border-radius:14px;padding:11px 22px;font-weight:800;cursor:pointer}
      #vocab .bipaV7Actions .prev,#vocab .bipaV7Actions .flip{border:0;background:#eef1f6;color:#172033}.bipaV7Actions .next{border:0;background:#3157d5;color:#fff}
      #vocab .bipaV7Memory{border-top:1px solid #e5e9f1;padding-top:16px}.bipaV7Memory button{background:#fff;border:1px solid #e0e5ee;color:#283246}
      @media(max-width:900px){#vocab.bipaFinalV7 .toolbar{grid-template-columns:1fr 1fr 1fr!important}#vocab.bipaFinalV7 #search{grid-column:span 2}}
      @media(max-width:620px){#vocab.bipaFinalV7 .toolbar{grid-template-columns:1fr 1fr!important}#vocab.bipaFinalV7 #search{grid-column:1/-1}#vocab .bipaV7Card{height:320px;min-height:320px;padding:38px 16px 24px}#vocab .bipaV7Progress{left:18px;top:18px;font-size:14px}#vocab .bipaV7Topic{right:16px;top:15px;max-width:55%;font-size:12px;padding:6px 9px}#vocab .bipaV7Badge{width:52px;height:52px;margin-bottom:20px}#vocab .bipaV7Word{font-size:38px}#vocab .bipaV7Sound{width:48px!important;height:48px!important;min-width:48px!important}#vocab .bipaV7Meaning{top:180px;width:88vw}}
    `;document.head.appendChild(st);
  }

  function ensureSab(){
    const tb=document.querySelector('#vocab .toolbar'),cat=$('cat');if(!tb)return null;
    let s=$('sabFilterStable');
    if(!s){s=document.createElement('select');s.id='sabFilterStable';s.innerHTML='<option value="">全部分级</option><option value="S">S · 核心</option><option value="A">A · 常用</option><option value="B">B · 低频</option>';if(cat&&cat.nextSibling)tb.insertBefore(s,cat.nextSibling);else tb.appendChild(s)}
    s.onchange=()=>rebuild(true);
    return s;
  }
  function rebuildTopics(){
    const cat=$('cat');if(!cat||!isBipa())return;
    const cur=cat.value;
    const themes=[...new Set(src().map(x=>raw(x.word)?.theme).filter(Boolean))].sort();
    cat.innerHTML='<option value="">全部主题</option>'+themes.map(t=>'<option value="'+esc(t)+'">'+esc(t)+'</option>').join('');
    if(themes.includes(cur))cat.value=cur;
  }
  function syncUi(){
    installStyle();
    const sec=$('vocab');if(sec){sec.classList.toggle('bipaFinalV7',isBipa());sec.classList.remove('bipaStable')}
    const sab=ensureSab();if(sab)sab.style.display=isBipa()?'':'none';
    if(isBipa())rebuildTopics();
  }

  function updateStatsFinal(){
    if(!isBipa()){if(typeof oldStats==='function')return oldStats();return}
    const m=getMem(),all=src();let known=0,review=0;
    all.forEach(x=>{const st=statusOf(m,x.word);if(st==='know')known++;else if(st==='fuzzy'||st==='dont')review++});
    const unchecked=Math.max(0,all.length-known-review);
    if($('vocabCount'))$('vocabCount').textContent=all.length;
    if($('knownCount'))$('knownCount').textContent=known;
    if($('reviewCount'))$('reviewCount').textContent=review;
    if($('dbStatus'))$('dbStatus').textContent='BIPA（'+level()+'） · '+unchecked+' 未判断 · '+review+' 待复习 · '+known+' 已掌握 · '+all.length+' 总词';
  }

  function rebuild(reset){
    if(!isBipa())return false;
    const q=String($('search')?.value||'').trim().toLowerCase();
    const theme=$('cat')?.value||'';
    const sab=$('sabFilterStable')?.value||'';
    const mode=localStorage.getItem('vocab_view_mode')||'';
    const m=getMem();
    let a=src().filter(x=>{
      const st=statusOf(m,x.word),r=raw(x.word);
      if(mode==='known'){if(st!=='know')return false}else if(mode==='review'){if(st!=='fuzzy'&&st!=='dont')return false}else if(st)return false;
      if(theme&&(!r||r.theme!==theme))return false;
      if(sab&&(!r||r.sab!==sab))return false;
      if(q){const h=[x.word,x.cn,x.en,x.root,r&&r.theme].join(' ').toLowerCase();if(!h.includes(q))return false}
      return true;
    });
    try{FILTER=a;if(reset)idx=0;else if(a.length)idx=Math.min(Math.max(0,pos()),a.length-1);else idx=0}catch(e){}
    updateStatsFinal();renderFinal();return true;
  }

  let activeAudio=null;
  window.bipaSpeakFinal=function(text){
    text=String(text||'').trim();if(!text)return;
    try{if(activeAudio){activeAudio.pause();activeAudio=null}}catch(e){}
    try{if(window.speechSynthesis)window.speechSynthesis.cancel()}catch(e){}
    let started=false;
    try{
      if(window.speechSynthesis&&typeof SpeechSynthesisUtterance!=='undefined'){
        const u=new SpeechSynthesisUtterance(text);u.lang='id-ID';u.rate=.88;u.pitch=1;u.volume=1;
        const vs=speechSynthesis.getVoices()||[];const v=vs.find(v=>/^id[-_]/i.test(v.lang||''))||vs.find(v=>/indones/i.test((v.name||'')+' '+(v.lang||'')));if(v)u.voice=v;
        u.onstart=()=>{started=true};
        u.onerror=()=>{if(!started)fallbackAudio(text)};
        speechSynthesis.resume();speechSynthesis.speak(u);
        setTimeout(()=>{if(!started&&!speechSynthesis.speaking)fallbackAudio(text)},700);
        return;
      }
    }catch(e){}
    fallbackAudio(text);
  };
  function fallbackAudio(text){
    try{const a=new Audio('https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=id&q='+encodeURIComponent(text));activeAudio=a;a.preload='auto';a.play().catch(()=>{})}catch(e){}
  }

  function renderFinal(){
    if(!isBipa()){if(typeof oldRender==='function')return oldRender();return}
    syncUi();
    const box=$('vocabBox'),a=list(),x=currentFinal();if(!box)return;
    if(!a.length||!x){box.innerHTML='<div class="empty">没有匹配词汇</div>';return}
    if(($('mode')?.value||'flash')==='quiz'){if(typeof oldRender==='function')return oldRender();return}
    const d=info(x),p=((pos()%a.length)+a.length)%a.length+1;
    const sab=['S','A','B'].includes(d.sab)?d.sab:'A';
    const topic=d.theme?'<div class="bipaV7Topic">'+esc(d.theme)+'</div>':'';
    const root=d.root?'<div class="bipaV7Root">词根 · '+esc(d.root)+'</div>':'';
    box.innerHTML='<div id="bipaV7Card" class="bipaV7Card"><div class="bipaV7Progress">第 '+p+' / '+a.length+' 个</div>'+topic+'<div class="bipaV7Core"><div class="bipaV7Badge '+sab+'">'+sab+'</div><div class="bipaV7WordLine"><div class="bipaV7Word">'+esc(d.word)+'</div><button class="bipaV7Sound" type="button" onclick="event.preventDefault();event.stopPropagation();bipaSpeakFinal('+JSON.stringify(d.word).replace(/"/g,'&quot;')+')">🔊</button></div></div><div class="bipaV7Meaning"><div class="bipaV7Cn">'+esc(d.cn||'暂无中文')+'</div><div class="bipaV7En">'+esc(d.en||'')+'</div>'+root+'</div></div><div class="bipaV7Actions"><button class="prev" onclick="bipaPrevFinal()">上一个</button><button class="flip" id="bipaV7Flip" onclick="bipaFlipFinal()">翻卡</button><button class="next" onclick="bipaNextFinal()">下一个</button></div><div class="bipaV7Memory"><button onclick="bipaMarkFinal(\'know\')">会了</button><button onclick="bipaMarkFinal(\'fuzzy\')">模糊</button><button onclick="bipaMarkFinal(\'dont\')">不会</button></div>';
  }

  window.bipaPrevFinal=function(){const a=list();if(!a.length)return;try{idx=(pos()-1+a.length)%a.length}catch(e){}renderFinal()};
  window.bipaNextFinal=function(){const a=list();if(!a.length)return;try{idx=(pos()+1)%a.length}catch(e){}renderFinal()};
  window.bipaFlipFinal=function(){const c=$('bipaV7Card'),b=$('bipaV7Flip');if(!c)return;c.classList.toggle('revealed');if(b)b.textContent=c.classList.contains('revealed')?'收起':'翻卡'};
  window.bipaMarkFinal=function(v){
    if(!isBipa()){if(typeof oldMark==='function')return oldMark(v);return}
    const x=currentFinal();if(!x)return;const m=getMem();m[norm(x.word)]=v;saveMem(m);rebuild(false);
  };

  function applyFinal(){if(isBipa())return rebuild(true);if(typeof oldApply==='function')return oldApply()}
  function renderWrapper(){if(isBipa())return renderFinal();if(typeof oldRender==='function')return oldRender()}
  function markWrapper(v){if(isBipa())return window.bipaMarkFinal(v);if(typeof oldMark==='function')return oldMark(v)}
  function showKnownWrapper(){if(!isBipa())return typeof oldShowKnown==='function'?oldShowKnown():undefined;localStorage.setItem('vocab_view_mode','known');rebuild(true)}

  function install(){
    resetTestProgressOnce();syncUi();
    window.renderVocab=renderWrapper;try{renderVocab=renderWrapper}catch(e){}
    window.applyFilter=applyFinal;try{applyFilter=applyFinal}catch(e){}
    window.mark=markWrapper;try{mark=markWrapper}catch(e){}
    window.updateStats=updateStatsFinal;try{updateStats=updateStatsFinal}catch(e){}
    window.showKnownWords=showKnownWrapper;try{showKnownWords=showKnownWrapper}catch(e){}
    window.nextWord=function(){if(isBipa())return window.bipaNextFinal();try{return oldRender&&typeof nextWord==='function'?undefined:undefined}catch(e){}};
    const lib=$('librarySelect');if(lib)lib.addEventListener('change',()=>setTimeout(()=>{if(isBipa()){localStorage.removeItem('vocab_view_mode');syncUi();rebuildTopics();rebuild(true)}else syncUi()},300));
    $('search')?.addEventListener('input',()=>{if(isBipa())setTimeout(()=>rebuild(true),0)});
    $('cat')?.addEventListener('change',()=>{if(isBipa())setTimeout(()=>rebuild(true),0)});
    $('mode')?.addEventListener('change',()=>{if(isBipa())setTimeout(()=>renderFinal(),0)});
    window.addEventListener('vocab-library-ready',()=>setTimeout(()=>{if(isBipa()){syncUi();rebuildTopics();rebuild(true)}},350));
    setTimeout(()=>{if(isBipa()){syncUi();rebuildTopics();rebuild(true)}},420);
  }
  if(document.readyState==='complete')setTimeout(install,0);else window.addEventListener('load',()=>setTimeout(install,0),{once:true});
})();