(function(){
  if(window.__BIPA_STABLE_20260913_V2__)return;
  window.__BIPA_STABLE_20260913_V2__=true;

  const norm=s=>String(s||'').trim().toLowerCase();
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
  const $=id=>document.getElementById(id);

  function libText(){const s=$('librarySelect');return s&&s.options&&s.selectedIndex>=0?String(s.options[s.selectedIndex].textContent||''):''}
  function level(){const m=libText().match(/BIPA\s*[（(]?\s*(A1|A2|B1|B2)/i);return m?m[1].toUpperCase():''}
  function isBipa(){return !!level()}
  function raw(word){const lv=level(),rows=(window.BIPA_VOCAB_RAW&&window.BIPA_VOCAB_RAW[lv])||[];const r=rows.find(x=>Array.isArray(x)&&norm(x[0])===norm(word));if(!r)return null;return {word:r[0]||'',cn:r[1]||'',en:r[2]||'',root:r[3]||'',theme:r[5]||'',sab:String(r[8]||'').toUpperCase()}}
  function info(x){const r=isBipa()?raw(x&&x.word):null;return {word:(r&&r.word)||(x&&x.word)||'',cn:(r&&r.cn)||(x&&x.cn)||'',en:(r&&r.en)||(x&&x.en)||'',root:(r&&r.root)||(x&&x.root)||'',theme:(r&&r.theme)||'',sab:(r&&r.sab)||'',scene:(x&&(x.example||x.scene))||'',note:(x&&x.note)||'',categories:(x&&x.categories)||[]}}
  function arr(){try{return FILTER||[]}catch(e){return []}}
  function ix(){try{return Number(idx||0)}catch(e){return 0}}
  function item(){const a=arr();if(!a.length)return null;return a[((ix()%a.length)+a.length)%a.length]||a[0]}

  function cleanupOld(){
    ['vocabCleanStyle','vocabFinalFixStyle','vocabViewStateStyle'].forEach(id=>{const el=$(id);if(el)el.remove()});
    document.querySelectorAll('#vocab select').forEach(s=>{if(s.id==='sabFilterStable'||s.id==='librarySelect'||s.id==='cat'||s.id==='mode')return;const t=[...s.options].map(o=>o.textContent).join(' ');if(/全部分级|S\s*[·级]|A\s*[·级]|B\s*[·级]/.test(t))s.remove()});
  }

  function addStyle(){
    let old=$('bipaStableStyle');if(old)old.remove();
    const st=document.createElement('style');st.id='bipaStableStyle';st.textContent=`
      #vocab.bipaStable .toolbar{display:grid!important;grid-template-columns:180px minmax(180px,1fr) 150px 115px 90px 115px;gap:8px!important;align-items:center!important;width:100%!important;overflow:visible!important}
      #vocab.bipaStable .toolbar input,#vocab.bipaStable .toolbar select,#vocab.bipaStable .toolbar button{width:100%!important;min-width:0!important;max-width:100%!important;height:48px!important;margin:0!important;padding-left:12px!important;padding-right:12px!important;white-space:nowrap!important}
      #sabFilterStable[hidden]{display:none!important}
      #vocab .bipaStableCard{min-height:330px;height:330px;position:relative;display:grid;place-items:center;text-align:center;background:#fbfcff;border:1px solid #dfe5f1;border-radius:24px;padding:44px 32px 34px;overflow:hidden}
      #vocab .bipaProgress{position:absolute;left:34px;top:24px;color:#8a94a8;font-size:16px;font-weight:800}
      #vocab .bipaTopic{position:absolute;right:28px;top:20px;background:#eef3ff;color:#3157d5;border-radius:999px;padding:7px 12px;font-size:14px;font-weight:800;max-width:45%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #vocab .bipaCore{position:relative;min-width:0;max-width:820px;transform:translateY(-8px)}
      #vocab .bipaSab{position:absolute;left:50%;top:-68px;transform:translateX(-50%);width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;border:1px solid transparent;box-shadow:0 5px 16px rgba(23,32,51,.09)}
      #vocab .bipaSab.S{background:#e8f7ed;color:#17743a;border-color:#bfe8cb}#vocab .bipaSab.A{background:#fff5dd;color:#9a6500;border-color:#f4dda1}#vocab .bipaSab.B{background:#eef1f6;color:#647084;border-color:#dfe4ec}
      #vocab .bipaWordLine{display:flex;align-items:center;justify-content:center;gap:16px;max-width:100%}
      #vocab .bipaWord{font-size:50px;line-height:1.1;font-weight:880;color:#626d83;overflow-wrap:anywhere}
      #vocab .bipaSound{width:56px;height:56px;min-width:56px;border-radius:16px;border:1px solid #dde3ee;background:#fff;box-shadow:0 6px 18px rgba(23,32,51,.06);font-size:25px;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0!important}
      #vocab .bipaMeaning{position:absolute;left:50%;top:82px;transform:translateX(-50%);width:min(720px,82vw);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .12s ease}
      #vocab .bipaStableCard.revealed .bipaMeaning{opacity:1;visibility:visible;pointer-events:auto}
      #vocab .bipaCn{font-size:25px;font-weight:850;color:#5d687e;line-height:1.4}
      #vocab .bipaEn{font-size:19px;color:#778197;margin-top:8px;line-height:1.4}
      #vocab .bipaRoot{font-size:15px;color:#8a94a8;font-weight:750;margin-top:14px}
      #vocab .bipaActions,#vocab .bipaMemory{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:16px}
      #vocab .bipaActions button,#vocab .bipaMemory button{border:0;border-radius:14px;padding:11px 22px;font-weight:800;cursor:pointer}
      #vocab .bipaActions .nav{background:#eef1f6;color:#172033}.bipaActions .next{background:#3157d5;color:#fff}
      #vocab .bipaMemory{border-top:1px solid #e5e9f1;padding-top:16px}.bipaMemory button{background:#fff;border:1px solid #e0e5ee!important;color:#283246}
      @media(max-width:900px){#vocab.bipaStable .toolbar{grid-template-columns:1fr 1fr 1fr!important}#vocab.bipaStable .toolbar>#search{grid-column:span 2}}
      @media(max-width:620px){#vocab.bipaStable .toolbar{grid-template-columns:1fr 1fr!important}#vocab.bipaStable .toolbar>#search{grid-column:1/-1}#vocab .bipaStableCard{height:320px;min-height:320px;padding:48px 18px 28px}#vocab .bipaProgress{left:18px;top:18px;font-size:14px}#vocab .bipaTopic{right:16px;top:15px;max-width:55%;font-size:12px;padding:6px 9px}#vocab .bipaSab{top:-62px;width:52px;height:52px}#vocab .bipaWord{font-size:38px}#vocab .bipaSound{width:48px;height:48px;min-width:48px}#vocab .bipaMeaning{top:72px;width:88vw}#vocab .bipaCn{font-size:22px}#vocab .bipaEn{font-size:17px}}
    `;document.head.appendChild(st)
  }

  function ensureSab(){const tb=document.querySelector('#vocab .toolbar'),cat=$('cat');if(!tb)return null;let s=$('sabFilterStable');if(!s){s=document.createElement('select');s.id='sabFilterStable';s.innerHTML='<option value="">全部分级</option><option value="S">S · 核心</option><option value="A">A · 常用</option><option value="B">B · 低频</option>';if(cat&&cat.nextSibling)tb.insertBefore(s,cat.nextSibling);else tb.appendChild(s);s.addEventListener('change',stableFilter)}return s}
  function syncUi(){cleanupOld();addStyle();const sec=$('vocab');if(sec)sec.classList.toggle('bipaStable',isBipa());const sab=ensureSab(),cat=$('cat');if(sab){sab.hidden=!isBipa();if(!isBipa())sab.value=''}if(cat&&cat.options.length)cat.options[0].textContent=isBipa()?'全部主题':'全部分类'}

  function mem(){try{return JSON.parse(localStorage.getItem('indo_mem')||'{}')}catch(e){return {}}}
  function stat(m,w){return m[w]||m[norm(w)]||''}
  function stableFilter(){
    const q=String($('search')?.value||'').trim().toLowerCase(),c=$('cat')?.value||'',sab=$('sabFilterStable')?.value||'',m=mem(),mode=localStorage.getItem('vocab_view_mode')||'';
    let src=[];try{src=(DB||[]).slice()}catch(e){}
    src=src.filter(x=>{
      const st=stat(m,x.word);
      if(mode==='known'&&st!=='know')return false;if(mode==='review'&&st!=='fuzzy'&&st!=='dont')return false;if(!mode&&['know','fuzzy','dont'].includes(st))return false;
      if(c&&!(x.categories||[]).includes(c))return false;
      const r=isBipa()?raw(x.word):null;if(sab&&(!r||r.sab!==sab))return false;
      if(q){const hay=[x.word,x.cn,x.en,x.root,r&&r.theme].join(' ').toLowerCase();if(!hay.includes(q))return false}
      return !(x.categories||[]).includes('粗口/俚语');
    });
    try{FILTER=src;idx=0}catch(e){}stableRender();
  }
  window.stableBipaFilter=stableFilter;

  function renderLegacy(){
    const box=$('vocabBox'),a=arr(),x=item();if(!box)return;if(!a.length||!x){box.innerHTML='<div class="empty">没有匹配词汇</div>';return}
    const mode=$('mode')?.value||'flash';
    if(mode==='quiz'){
      const others=a.filter(y=>y.word!==x.word&&y.cn).sort(()=>Math.random()-.5).slice(0,3),opts=[x,...others].sort(()=>Math.random()-.5);
      box.innerHTML='<div class="q">“'+esc(x.word)+'” 最接近哪个意思？ <button class="sound" data-tts-text="'+esc(x.word)+'" type="button">🔊</button></div><div class="opts">'+opts.map(o=>'<button class="opt" onclick="answerQuiz(this,'+JSON.stringify(o.word===x.word)+')">'+esc(o.cn||o.en||'—')+'</button>').join('')+'</div><div class="actions"><button class="primary" onclick="stableNext()">下一题</button></div>';return
    }
    const muted=x.root?'词根：'+x.root:(x.categories||[]).join(' · ');
    box.innerHTML='<div id="flash" class="flash"><div class="word">'+esc(x.word)+' <button class="sound" data-tts-text="'+esc(x.word)+'" type="button">🔊</button></div><div class="muted">'+esc(muted)+'</div><div class="meaning"><b>'+esc(x.cn||'暂无中文')+'</b><div class="muted">'+esc(x.en||'')+'</div><div style="margin-top:10px">'+esc(x.scene||x.example||'')+'</div><div class="muted">'+esc(x.note||'')+'</div></div></div><div class="actions"><button class="secondary" onclick="stablePrev()">上一个</button><button class="secondary" onclick="stableFlip()">翻卡</button><button class="primary" onclick="stableNext()">下一个</button></div><div class="memory"><button onclick="mark(\'know\')">会了</button><button onclick="mark(\'fuzzy\')">模糊</button><button onclick="mark(\'dont\')">不会</button></div>'
  }

  function renderBipa(){
    const box=$('vocabBox'),a=arr(),x=item();if(!box)return;if(!a.length||!x){box.innerHTML='<div class="empty">没有匹配词汇</div>';return}
    if(($('mode')?.value||'flash')==='quiz'){renderLegacy();return}
    const d=info(x),p=((ix()%a.length)+a.length)%a.length+1,topic=d.theme?'<div class="bipaTopic">'+esc(d.theme)+'</div>':'',badge=d.sab?'<div class="bipaSab '+esc(d.sab)+'">'+esc(d.sab)+'</div>':'',root=d.root?'<div class="bipaRoot">词根 · '+esc(d.root)+'</div>':'';
    box.innerHTML='<div id="bipaStableCard" class="bipaStableCard"><div class="bipaProgress">第 '+p+' / '+a.length+' 个</div>'+topic+'<div class="bipaCore">'+badge+'<div class="bipaWordLine"><div class="bipaWord">'+esc(d.word)+'</div><button class="sound bipaSound" data-tts-text="'+esc(d.word)+'" type="button" aria-label="播放发音">🔊</button></div><div id="bipaStableMeaning" class="bipaMeaning"><div class="bipaCn">'+esc(d.cn||'暂无中文')+'</div><div class="bipaEn">'+esc(d.en||'')+'</div>'+root+'</div></div></div><div class="bipaActions"><button class="nav" onclick="stablePrev()">上一个</button><button class="nav" id="stableFlipBtn" onclick="stableFlip()">翻卡</button><button class="next" onclick="stableNext()">下一个</button></div><div class="bipaMemory"><button onclick="mark(\'know\')">会了</button><button onclick="mark(\'fuzzy\')">模糊</button><button onclick="mark(\'dont\')">不会</button></div>'
  }

  function saveProgress(){try{const x=item(),key=$('librarySelect')?.value||'';if(x&&x.word&&key)localStorage.setItem('vocab_progress_'+key,norm(x.word))}catch(e){}}
  function stableRender(){syncUi();isBipa()?renderBipa():renderLegacy();saveProgress()}
  window.stablePrev=function(){const a=arr();if(!a.length)return;try{idx=(ix()-1+a.length)%a.length}catch(e){}stableRender()};
  window.stableNext=function(){const a=arr();if(!a.length)return;try{idx=(ix()+1)%a.length}catch(e){}stableRender()};
  window.stableFlip=function(){
    if(isBipa()){
      const card=$('bipaStableCard'),b=$('stableFlipBtn');if(!card)return;card.classList.toggle('revealed');if(b)b.textContent=card.classList.contains('revealed')?'收起':'翻卡';
    }else{const f=$('flash');if(f)f.classList.toggle('revealed')}
  };

  function install(){
    syncUi();
    window.renderVocab=stableRender;try{renderVocab=stableRender}catch(e){}
    window.applyFilter=stableFilter;try{applyFilter=stableFilter}catch(e){}
    window.nextWord=window.stableNext;try{nextWord=window.stableNext}catch(e){}
    const lib=$('librarySelect');if(lib)lib.addEventListener('change',()=>setTimeout(()=>{syncUi();stableRender()},120));
    $('mode')?.addEventListener('change',()=>setTimeout(stableRender,80));
    window.addEventListener('vocab-library-ready',()=>setTimeout(()=>{syncUi();stableRender()},150));
    setTimeout(()=>{syncUi();stableRender()},180)
  }
  if(document.readyState==='complete')setTimeout(install,0);else window.addEventListener('load',()=>setTimeout(install,0),{once:true});
})();