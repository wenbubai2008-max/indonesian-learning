(function(){
  if(window.__weaknessPagingRootsLoaded)return;
  window.__weaknessPagingRootsLoaded=true;

  const PAGE_SIZE=30;
  let currentPage=0;
  let renderTimer=null;

  function norm(s){return String(s||'').trim().toLowerCase();}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});}
  function pool(){return window.WeaknessPool||null;}

  function sourceMap(){
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
    return out;
  }

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
    const r=x.reasons||[],h=x.reason_history||[];
    if(r.includes('quick_wrong')||h.includes('quick_wrong'))return '快速练习错题';
    if(r.includes('manual_unknown')||h.includes('manual_unknown'))return '阅读陌生词';
    return '待强化';
  }

  function items(){
    const wp=pool();if(!wp)return [];
    const map=sourceMap();
    return wp.listActive().filter(allowedSource).map(function(x){
      const k=norm(x.word),base=map[k]||{},contexts=x.contexts||[];
      const word=x.word||base.word||k;
      const root=String(x.root||base.root||'').trim();
      const rootBase=root?(map[norm(root)]||{}):{};
      const rootCn=String(x.root_cn||base.root_cn||rootBase.cn||'').trim();
      return {
        key:k,
        word:word,
        cn:x.cn||base.cn||'待补释义',
        root:root&&norm(root)!==norm(word)?root:'',
        root_cn:root&&norm(root)!==norm(word)?rootCn:'',
        example:x.example||contexts.slice(-1)[0]||base.example||'',
        example_cn:x.example_cn||base.example_cn||'',
        reason:reasonLabel(x)
      };
    });
  }

  function rootHtml(x){
    if(!x.root)return '';
    return '<div class="weakRootLine"><span>词根：</span><b>'+esc(x.root)+'</b>'+(x.root_cn?'<em> · '+esc(x.root_cn)+'</em>':'')+'</div>';
  }

  function cardHtml(x){
    return '<div class="v2-card weakCardHasDone" data-weak-word="'+esc(x.word)+'">'
      +'<div><b>'+esc(x.word)+'</b><span>'+esc(x.reason)+'</span></div>'
      +'<strong>'+esc(x.cn)+'</strong>'
      +rootHtml(x)
      +(x.example?'<p class="v2-ex">'+esc(x.example)+'</p>':'')
      +(x.example_cn?'<p class="v2-excn">'+esc(x.example_cn)+'</p>':'')
      +'<button class="sound" type="button" onclick=\'speak('+JSON.stringify(x.word)+')\'>🔊</button>'
      +'<button class="weakDoneBtn" type="button" data-done-word="'+esc(x.word)+'" title="标记已掌握并退出弱项强化">✓ 会了</button>'
      +'</div>';
  }

  function navHtml(totalPages){
    if(totalPages<=1)return '';
    return '<div class="weakPager">'
      +'<button class="secondary" type="button" '+(currentPage===0?'disabled':'')+' onclick="weaknessPageMove(-1)">← 上一页</button>'
      +'<span>第 '+(currentPage+1)+' / '+totalPages+' 页</span>'
      +'<button class="secondary" type="button" '+(currentPage>=totalPages-1?'disabled':'')+' onclick="weaknessPageMove(1)">下一页 →</button>'
      +'</div>';
  }

  function dismiss(word){
    const wp=pool();if(!wp||!word)return;
    wp.markMastered(word,'weakness_done');
    try{
      const m=JSON.parse(localStorage.getItem('indo_mem')||'{}');
      m[word]='know';m[norm(word)]='know';localStorage.setItem('indo_mem',JSON.stringify(m));
    }catch(e){}
    scheduleRender(0);
  }

  function restoreAll(){
    const wp=pool();if(!wp)return;
    wp.restoreDismissed();
    currentPage=0;
    scheduleRender(0);
  }

  function render(){
    const body=document.getElementById('weaknessBody');
    const page=document.getElementById('weakness');
    if(!body||!page||!page.classList.contains('active'))return;

    const arr=items();
    const total=arr.length;
    const totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE));
    if(currentPage>=totalPages)currentPage=totalPages-1;
    if(currentPage<0)currentPage=0;
    const start=currentPage*PAGE_SIZE;
    const visible=arr.slice(start,start+PAGE_SIZE);
    const meta=document.getElementById('weaknessMeta');if(meta)meta.textContent=total+' 个';

    if(!total){
      body.innerHTML='<div class="v2-note">这里现在只显示两类词：快速练习答错的词，以及阅读中你主动加入的陌生词。977词库里单纯标记为“不会 / 模糊”的词不在这里展示。</div><div class="empty"><b>目前没有这两类待强化词 ✓</b></div>';
      return;
    }

    body.innerHTML='<div class="v2-note">这里只强化两类词：① 快速练习答错；② 阅读中主动加入的陌生词。每页最多 30 个；点“会了”后，后面的词会自动向前补位，剩余不足 31 个时第二页会自动消失。</div>'
      +'<div class="weakRestoreWrap"><span>点“会了”后，总数立即减 1；以后再次答错仍可重新进入。</span><button type="button" class="weakRestoreBtn">恢复已移出</button></div>'
      +navHtml(totalPages)
      +'<div class="v2-weak">'+visible.map(cardHtml).join('')+'</div>'
      +navHtml(totalPages);

    body.querySelectorAll('.weakDoneBtn').forEach(function(btn){btn.onclick=function(){dismiss(btn.getAttribute('data-done-word')||'');};});
    body.querySelectorAll('.weakRestoreBtn').forEach(function(btn){btn.onclick=restoreAll;});
  }

  function scheduleRender(delay){
    clearTimeout(renderTimer);
    renderTimer=setTimeout(render,delay==null?60:delay);
  }

  function installStyle(){
    if(document.getElementById('weakPagingRootsStyle'))return;
    const s=document.createElement('style');s.id='weakPagingRootsStyle';
    s.textContent='.weakRootLine{margin-top:6px;font-size:13px;line-height:1.45;color:#667085}.weakRootLine span{color:#7a8495;background:transparent;padding:0;font-size:13px}.weakRootLine b{font-size:14px;color:#354052}.weakRootLine em{font-style:normal;color:#667085}.v2-card .weakRootLine+ .v2-ex{margin-top:8px}';
    document.head.appendChild(s);
  }

  function install(){
    if(!pool()){setTimeout(install,80);return;}
    installStyle();
    window.openWeaknessV2=function(){if(typeof window.go==='function')window.go('weakness');currentPage=0;scheduleRender(0);};
    window.weaknessPageMove=function(delta){
      const totalPages=Math.max(1,Math.ceil(items().length/PAGE_SIZE));
      currentPage=Math.max(0,Math.min(totalPages-1,currentPage+Number(delta||0)));
      render();window.scrollTo({top:0,behavior:'smooth'});
    };
    window.dismissWeaknessWord=dismiss;
    window.addEventListener('weak-pool-changed',function(){if(document.getElementById('weakness')?.classList.contains('active'))scheduleRender(80);});
    if(document.getElementById('weakness')?.classList.contains('active'))scheduleRender(0);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
