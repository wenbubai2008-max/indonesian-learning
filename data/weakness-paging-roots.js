(function(){
  if(window.__weaknessPagingRootsLoaded)return;
  window.__weaknessPagingRootsLoaded=true;

  const PAGE_SIZE=30;
  let currentPage=0;
  let renderTimer=null;
  let decorateTimer=null;
  let sourceCache=null;
  let sourceCacheSig='';
  let sessionWords=[];
  let didInitialQuickSync=false;

  const ROOT_CN_FALLBACK={
    berat:'重；沉重；严重',tagih:'催；索取应付款项',tangan:'手',gantung:'挂；悬挂',bawa:'带；拿；携带',
    batas:'界限；边界',atur:'安排；整理',keluh:'抱怨；诉苦',atas:'上；上面',
    selesai:'完成；结束',pasti:'确定；肯定',hindar:'躲避；避开',sadar:'意识；清醒',
    timbang:'称重；权衡',buang:'扔掉；丢弃',gilir:'轮换；轮流',ikut:'跟；参加',
    sesuai:'合适；符合',lanjur:'继续往前',cadang:'预留；准备备用'
  };

  const ROOT_WORD_FALLBACK={
    menangani:'tangan',tergantung:'gantung',kebawa:'bawa',keberatan:'berat',nagih:'tagih',
    dibatasi:'batas',batasan:'batas',mengatur:'atur',ngatur:'atur',mengeluh:'keluh',ngeluh:'keluh',
    mengatasi:'atas',ngatasin:'atas',menyelesaikan:'selesai',memastikan:'pasti',menghindari:'hindar',
    menyadari:'sadar',mempertimbangkan:'timbang',kebuang:'buang',bergiliran:'gilir',mengikuti:'ikut',
    menyesuaikan:'sesuai',terlanjur:'lanjur',cadangan:'cadang'
  };

  function norm(s){return String(s||'').trim().toLowerCase();}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m];});}
  function pool(){return window.WeaknessPool||null;}
  function practiceState(){try{return JSON.parse(localStorage.getItem('indo_quick_practice_state')||'{}')||{};}catch(e){return {};}}

  function mapSignature(){
    return [(window.DAILY_VOCAB_DB||[]).length,(window.EMBEDDED_DB||[]).length,(window.UNFAMILIAR_VOCAB_DB||[]).length,(window.MASTER_VOCAB_OBJECTS||[]).length].join('|');
  }

  function sourceMap(){
    const sig=mapSignature();
    if(sourceCache&&sig===sourceCacheSig)return sourceCache;
    const out={};
    [].concat(window.DAILY_VOCAB_DB||[],window.EMBEDDED_DB||[],window.UNFAMILIAR_VOCAB_DB||[],window.MASTER_VOCAB_OBJECTS||[]).forEach(function(x){
      if(!x||!x.word)return;
      const k=norm(x.word),old=out[k]||{};
      out[k]=Object.assign({},old,x);
      if(!out[k].cn&&old.cn)out[k].cn=old.cn;
      if(!out[k].root&&old.root)out[k].root=old.root;
      if(!out[k].root_cn&&old.root_cn)out[k].root_cn=old.root_cn;
      if(!out[k].example)out[k].example=x.example||((x.contexts||[]).slice(-1)[0])||old.example||'';
      if(!out[k].example_cn)out[k].example_cn=x.example_cn||old.example_cn||'';
    });
    sourceCache=out;sourceCacheSig=sig;return out;
  }

  function invalidateSourceMap(){sourceCache=null;sourceCacheSig='';}

  function allowedSource(x){
    if(!x||x.status!=='active')return false;
    const r=x.reasons||[];
    if(r.includes('quick_wrong')||r.includes('manual_unknown'))return true;
    if(r.includes('manual_restore')){
      const h=x.reason_history||[];
      return h.includes('quick_wrong')||h.includes('manual_unknown');
    }
    return false;
  }

  function reasonLabel(x){
    const r=x&&x.reasons||[],h=x&&x.reason_history||[];
    if(r.includes('quick_wrong')||h.includes('quick_wrong'))return '快速练习错题';
    if(r.includes('manual_unknown')||h.includes('manual_unknown'))return '阅读陌生词';
    return '待强化';
  }

  function inferRoot(word,base,x,map){
    const k=norm(word);
    let root=String((x&&x.root)||(base&&base.root)||ROOT_WORD_FALLBACK[k]||'').trim();
    if(root)return root;
    const candidates=[];
    if(/^ter.+/.test(k))candidates.push(k.replace(/^ter/,''));
    if(/^ber.+/.test(k))candidates.push(k.replace(/^ber/,''));
    if(/^ke.+/.test(k))candidates.push(k.replace(/^ke/,''));
    if(/^di.+/.test(k))candidates.push(k.replace(/^di/,''));
    for(const c0 of candidates){
      const forms=[c0,c0.replace(/(kan|i|an)$/,'')];
      for(const c of forms){if(c&&c!==k&&(map[c]||ROOT_CN_FALLBACK[c]))return c;}
    }
    return '';
  }

  function itemFromRecord(x){
    if(!x)return null;
    const map=sourceMap(),k=norm(x.word),base=map[k]||{},contexts=x.contexts||[];
    const word=x.word||base.word||k;
    const root=inferRoot(word,base,x,map);
    const rootBase=root?(map[norm(root)]||{}):{};
    const rootCn=String(x.root_cn||base.root_cn||rootBase.cn||ROOT_CN_FALLBACK[norm(root)]||'').trim();
    return {word:word,cn:x.cn||base.cn||'待补释义',root:root&&norm(root)!==norm(word)?root:'',root_cn:root&&norm(root)!==norm(word)?rootCn:'',example:x.example||contexts.slice(-1)[0]||base.example||'',example_cn:x.example_cn||base.example_cn||'',reason:reasonLabel(x)};
  }

  function eligibleRecords(){const wp=pool();if(!wp)return [];return wp.listActive().filter(allowedSource);}

  function activeMapSnapshot(){
    const out={};eligibleRecords().forEach(function(x){const k=norm(x.word);if(k)out[k]=x;});return out;
  }

  function makeSession(){
    const seen={};
    sessionWords=eligibleRecords().map(function(x){return norm(x.word);}).filter(function(k){if(!k||seen[k])return false;seen[k]=1;return true;});
    currentPage=0;
  }

  function remainingTotal(active){let n=0;sessionWords.forEach(function(w){if(active[w])n++;});return n;}
  function pageWords(page){return sessionWords.slice(page*PAGE_SIZE,page*PAGE_SIZE+PAGE_SIZE);}
  function pageItems(page,active){return pageWords(page).map(function(w){return active[w]||null;}).filter(Boolean).map(itemFromRecord).filter(Boolean);}

  function rootHtml(x){if(!x.root)return '';return '<div class="weakRootLine"><span>词根：</span><b>'+esc(x.root)+'</b>'+(x.root_cn?'<em> · '+esc(x.root_cn)+'</em>':'')+'</div>';}

  function cardHtml(x){
    return '<div class="v2-card weakCardHasDone" data-weak-word="'+esc(x.word)+'">'
      +'<div class="weakCardHead"><b>'+esc(x.word)+'</b><span>'+esc(x.reason)+'</span></div>'
      +'<strong>'+esc(x.cn)+'</strong>'+rootHtml(x)
      +(x.example?'<p class="v2-ex">'+esc(x.example)+'</p>':'')
      +(x.example_cn?'<p class="v2-excn">'+esc(x.example_cn)+'</p>':'')
      +'<button class="sound" type="button" data-tts-text="'+esc(x.word)+'">🔊</button>'
      +'<button class="weakDoneBtn" type="button" data-done-word="'+esc(x.word)+'" title="标记已掌握并退出弱项强化">✓ 会了</button>'
      +'</div>';
  }

  function navHtml(totalPages){
    if(totalPages<=1)return '';
    return '<div class="weakPager"><button class="secondary" type="button" '+(currentPage===0?'disabled':'')+' data-page-move="-1">← 上一页</button><span>第 '+(currentPage+1)+' / '+totalPages+' 页</span><button class="secondary" type="button" '+(currentPage>=totalPages-1?'disabled':'')+' data-page-move="1">下一页 →</button></div>';
  }

  function updateRootLine(card,item){
    let line=card.querySelector('.weakRootLine');
    if(!item.root){if(line)line.remove();return;}
    if(!line){line=document.createElement('div');line.className='weakRootLine';const strong=card.querySelector('strong');if(strong)strong.insertAdjacentElement('afterend',line);else card.prepend(line);}
    line.innerHTML='<span>词根：</span><b>'+esc(item.root)+'</b>'+(item.root_cn?'<em> · '+esc(item.root_cn)+'</em>':'');
  }

  function refreshVisibleDetails(){
    const body=document.getElementById('weaknessBody');if(!body)return;
    const active=activeMapSnapshot();
    body.querySelectorAll('[data-weak-word]').forEach(function(card){
      const word=norm(card.getAttribute('data-weak-word')||''),rec=active[word];
      if(!rec){card.style.display='none';return;}
      card.style.display='';const item=itemFromRecord(rec);if(!item)return;
      const strong=card.querySelector('strong');if(strong&&strong.textContent!==item.cn)strong.textContent=item.cn;
      const head=card.querySelector('.weakCardHead')||card.firstElementChild,tag=head&&head.querySelector('span');if(tag&&tag.textContent!==item.reason)tag.textContent=item.reason;
      updateRootLine(card,item);
      let ex=card.querySelector('.v2-ex');
      if(item.example){if(!ex){ex=document.createElement('p');ex.className='v2-ex';const anchor=card.querySelector('.weakRootLine')||strong;if(anchor)anchor.insertAdjacentElement('afterend',ex);}if(ex&&ex.textContent!==item.example)ex.textContent=item.example;}
      let excn=card.querySelector('.v2-excn');
      if(item.example_cn){if(!excn){excn=document.createElement('p');excn.className='v2-excn';const anchor=ex||card.querySelector('.weakRootLine')||strong;if(anchor)anchor.insertAdjacentElement('afterend',excn);}if(excn&&excn.textContent!==item.example_cn)excn.textContent=item.example_cn;}
    });
    const meta=document.getElementById('weaknessMeta');if(meta)meta.textContent=remainingTotal(active)+' 个';
  }

  function scheduleDecorate(){clearTimeout(decorateTimer);decorateTimer=setTimeout(refreshVisibleDetails,0);}

  function render(){
    const body=document.getElementById('weaknessBody'),page=document.getElementById('weakness');
    if(!body||!page||!page.classList.contains('active'))return;
    if(!sessionWords.length)makeSession();
    const active=activeMapSnapshot(),total=remainingTotal(active),totalPages=Math.max(1,Math.ceil(sessionWords.length/PAGE_SIZE));
    if(currentPage>=totalPages)currentPage=totalPages-1;if(currentPage<0)currentPage=0;
    const visible=pageItems(currentPage,active),meta=document.getElementById('weaknessMeta');if(meta)meta.textContent=total+' 个';
    if(!sessionWords.length||!total){body.innerHTML='<div class="v2-note">这里现在只显示两类词：快速练习答错的词，以及阅读中你主动加入的陌生词。</div><div class="empty"><b>目前没有这两类待强化词 ✓</b></div>';return;}
    body.innerHTML='<div class="v2-note">这里只强化两类词：① 快速练习答错；② 阅读中主动加入的陌生词。977词库里单纯标记为“不会 / 模糊”的词不在这里展示。每页最多 30 个，右上角显示所有页剩余总数。派生词显示词根和词根中文；点“会了”后本页不会从下一页自动补词。</div>'
      +'<div class="weakRestoreWrap"><span>点“会了”后，总数立即减 1；以后再次答错仍可重新进入。</span><button type="button" class="weakRestoreBtn">恢复已移出</button></div>'
      +navHtml(totalPages)+'<div class="v2-weak">'+visible.map(cardHtml).join('')+'</div>'+navHtml(totalPages);
    refreshVisibleDetails();
  }

  function scheduleRender(delay){clearTimeout(renderTimer);renderTimer=setTimeout(render,delay==null?20:delay);}

  function dismiss(word){
    const wp=pool();if(!wp||!word)return;
    wp.markMastered(word,'weakness_done');
    try{const m=JSON.parse(localStorage.getItem('indo_mem')||'{}');m[word]='know';m[norm(word)]='know';localStorage.setItem('indo_mem',JSON.stringify(m));}catch(e){}
    const s=practiceState(),k=norm(word);if(s[k]){s[k].streak=Math.max(3,Number(s[k].streak||0));s[k].last_result='mastered';s[k].last=Date.now();localStorage.setItem('indo_quick_practice_state',JSON.stringify(s));}
    render();
  }

  function restoreAll(){const wp=pool();if(!wp)return;wp.restoreDismissed();makeSession();render();}

  function installStyle(){
    if(document.getElementById('weakPagingRootsStyle'))return;
    const s=document.createElement('style');s.id='weakPagingRootsStyle';
    s.textContent='.v2-card>.weakRootLine{display:flex!important;justify-content:flex-start!important;align-items:baseline!important;gap:6px!important;text-align:left!important;margin-top:6px;font-size:13px;line-height:1.45;color:#667085}.v2-card>.weakRootLine span{color:#7a8495!important;background:transparent!important;padding:0!important;font-size:13px!important;flex:0 0 auto!important}.v2-card>.weakRootLine b{font-size:14px!important;color:#354052;flex:0 0 auto!important}.v2-card>.weakRootLine em{font-style:normal;color:#667085;flex:0 1 auto!important}.v2-card .weakRootLine+.v2-ex{margin-top:8px}.weakPager{display:flex;justify-content:center;align-items:center;gap:12px;margin:14px 0}.weakPager span{color:#667085;font-size:13px}.weakPager button:disabled{opacity:.35}.weakRestoreWrap{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:10px 0 2px;color:#667085;font-size:13px}.weakRestoreBtn{border:0;background:transparent;color:var(--blue);cursor:pointer;padding:6px}.v2-card.weakCardHasDone{position:relative;padding-bottom:54px}.weakDoneBtn{position:absolute;right:12px;bottom:12px;margin:0;border:1px solid #cfe5d6;background:#f1faf4;color:#17652d;border-radius:9px;padding:7px 11px;font-weight:700;cursor:pointer;line-height:1.2}@media(max-width:700px){.weakRestoreWrap{align-items:flex-start;flex-direction:column}.weakPager{gap:7px}.v2-card.weakCardHasDone{padding-bottom:56px}.weakDoneBtn{right:10px;bottom:10px}}';
    document.head.appendChild(s);
  }

  function initialQuickSync(){
    if(didInitialQuickSync)return;didInitialQuickSync=true;
    const wp=pool();if(!wp||typeof wp.syncSignals!=='function')return;
    try{wp.syncSignals(sourceMap(),{},practiceState());}catch(e){}
  }

  function openWeak(){if(typeof window.go==='function')window.go('weakness');makeSession();render();}

  function takeOver(){
    window.openWeaknessV2=openWeak;
    window.weaknessPageMove=function(delta){const totalPages=Math.max(1,Math.ceil(sessionWords.length/PAGE_SIZE));currentPage=Math.max(0,Math.min(totalPages-1,currentPage+Number(delta||0)));render();window.scrollTo({top:0,behavior:'smooth'});};
    window.dismissWeaknessWord=dismiss;window.renderWeaknessPagedRoots=render;
  }

  function install(){
    if(!pool()){setTimeout(install,80);return;}
    installStyle();initialQuickSync();takeOver();
    const body=document.getElementById('weaknessBody');
    if(body&&!body.__weakRootObserver){body.__weakRootObserver=true;new MutationObserver(function(){scheduleDecorate();}).observe(body,{childList:true,subtree:true});}
    document.addEventListener('click',function(e){
      const openBtn=e.target&&e.target.closest?e.target.closest('button[onclick*="openWeaknessV2"]'):null;if(openBtn){e.preventDefault();e.stopImmediatePropagation();openWeak();return;}
      const done=e.target&&e.target.closest?e.target.closest('#weaknessBody .weakDoneBtn'):null;if(done){e.preventDefault();dismiss(done.getAttribute('data-done-word')||'');return;}
      const restore=e.target&&e.target.closest?e.target.closest('#weaknessBody .weakRestoreBtn'):null;if(restore){e.preventDefault();restoreAll();return;}
      const move=e.target&&e.target.closest?e.target.closest('#weaknessBody [data-page-move]'):null;if(move){e.preventDefault();window.weaknessPageMove(Number(move.getAttribute('data-page-move')||0));}
    },true);
    window.addEventListener('weak-pool-changed',function(){if(document.getElementById('weakness')?.classList.contains('active'))scheduleDecorate();});
    window.addEventListener('master-vocab-ready',function(){invalidateSourceMap();scheduleDecorate();});
    window.addEventListener('vocab-library-ready',function(){invalidateSourceMap();scheduleDecorate();});
    if(document.getElementById('weakness')?.classList.contains('active')){makeSession();scheduleRender(0);}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();