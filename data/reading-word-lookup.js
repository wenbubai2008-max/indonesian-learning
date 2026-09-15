(function(){
  let popup=null;

  function ensureStyle(){
    if(document.getElementById('readingWordLookupStyle'))return;
    const st=document.createElement('style');
    st.id='readingWordLookupStyle';
    st.textContent=`
      .rw-popup{position:fixed;z-index:99999;min-width:180px;max-width:320px;background:#172033;color:#fff;border-radius:12px;padding:10px 13px;box-shadow:0 8px 28px rgba(0,0,0,.22);font-size:14px;line-height:1.45}
      .rw-word{font-weight:850;font-size:15px;margin-bottom:3px}.rw-cn{color:#f4f6fb}.rw-empty{color:#cbd2df}
      .rw-actions{display:flex;gap:7px;margin-top:9px}.rw-add{border:0;border-radius:8px;padding:6px 9px;background:#eef3ff;color:#3157d5;font-weight:800;cursor:pointer;font-size:12px}.rw-add.added{background:#e8f7ed;color:#18733a}.rw-add:disabled{opacity:.65;cursor:default}
      .rw-popup:after{content:"";position:absolute;left:18px;bottom:-6px;border-width:6px 6px 0;border-style:solid;border-color:#172033 transparent transparent}
      #weaknessBody .v2-excn,#weaknessBody .weak-card .v2-excn{color:#826a57;line-height:1.55;margin:3px 0 9px}
    `;
    document.head.appendChild(st);
  }

  function hide(){if(popup){popup.remove();popup=null;}}
  function norm(s){return String(s||'').trim().toLowerCase().replace(/^[^a-zA-ZÀ-ÿ]+|[^a-zA-ZÀ-ÿ-]+$/g,'');}
  function allWords(){const a=Array.isArray(window.EMBEDDED_DB)?window.EMBEDDED_DB:[];const b=Array.isArray(window.DAILY_VOCAB_DB)?window.DAILY_VOCAB_DB:[];return a.concat(b);}
  function weakPool(){return window.WeaknessPool||null;}

  function lookup(raw){
    const w=norm(raw);if(!w)return null;const variants=[w];
    if(/-(ku|mu|nya)$/.test(w))variants.push(w.replace(/-(ku|mu|nya)$/,''));
    if(/(ku|mu|nya)$/.test(w)&&w.length>5)variants.push(w.replace(/(ku|mu|nya)$/,''));
    const words=allWords();
    for(const v of variants){const hit=words.find(x=>norm(x.word)===v||norm(x.display)===v||norm(x.audio_text)===v);if(hit)return {word:raw.trim(),base:hit.word||v,cn:String(hit.cn||hit.zh||'').trim(),en:String(hit.en||'').trim(),root:String(hit.root||'').trim(),root_cn:String(hit.root_cn||'').trim(),example:String(hit.example||'').trim(),example_cn:String(hit.example_cn||'').trim()};}
    return {word:raw.trim(),base:w,cn:'',en:'',root:'',root_cn:'',example:'',example_cn:''};
  }

  function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function sentenceFrom(node,raw){const box=node.closest('.rl-text,.dailyFixReading');const text=(box?.innerText||box?.textContent||'').replace(/\s+/g,' ').trim();if(!text)return '';const p=text.toLowerCase().indexOf(String(raw).toLowerCase());if(p<0)return text.slice(0,220);let a=Math.max(0,p-120),b=Math.min(text.length,p+String(raw).length+120);const left=text.slice(0,p).search(/[.!?。！？][^.!?。！？]*$/);if(left>=0)a=left+1;const rest=text.slice(p+String(raw).length);const m=rest.match(/[.!?。！？]/);if(m)b=p+String(raw).length+m.index+1;return text.slice(a,b).trim();}
  function sourceInfo(node){const daily=node.closest('#daily');if(daily)return {date:(document.getElementById('dailyMeta')?.textContent||'').trim(),session:(document.getElementById('dailyTitle')?.textContent||'').includes('19:00')?'19:00':'08:00',source:'每日学习阅读'};return {date:'',session:'',source:'阅读短文'};}
  function unknownMap(){try{return JSON.parse(localStorage.getItem('indo_unknown_words')||'{}')}catch(e){return {}}}
  function isUnknown(word){const p=weakPool();if(p)return p.isActive(word);return !!unknownMap()[norm(word)];}

  const translateCache=new Map();
  const translatePending=new Map();
  async function translateZh(text){
    const w=String(text||'').trim();if(!w)return '';
    if(translateCache.has(w))return translateCache.get(w);
    if(translatePending.has(w))return translatePending.get(w);
    const task=(async function(){
      const controller=typeof AbortController!=='undefined'?new AbortController():null;
      const timer=controller?setTimeout(function(){try{controller.abort();}catch(e){}},5000):null;
      try{
        const url='https://translate.googleapis.com/translate_a/single?client=gtx&sl=id&tl=zh-CN&dt=t&q='+encodeURIComponent(w);
        const opt={method:'GET',mode:'cors',cache:'no-store'};
        if(controller)opt.signal=controller.signal;
        const r=await fetch(url,opt);if(!r.ok)throw new Error('HTTP '+r.status);
        const data=await r.json();
        const zh=Array.isArray(data?.[0])?data[0].map(x=>Array.isArray(x)?x[0]:'').join('').trim():'';
        if(zh)translateCache.set(w,zh);
        return zh;
      }catch(e){return '';}
      finally{if(timer)clearTimeout(timer);translatePending.delete(w);}
    })();
    translatePending.set(w,task);
    return task;
  }

  const WEAK_EXAMPLE_CN_OVERRIDES={
    'Buatku, kalau rencana tiba-tiba berubah, yang penting bukan panik, tapi cepat tentuin mana yang memang harus diberesin dulu.':'对我来说，计划突然改变时，重点不是慌，而是赶紧判断什么事情确实必须先处理完。',
    'Aku sebenarnya nggak enakan buat nagih, bahkan kadang nggak tega kalau orangnya lagi susah.':'其实我不太好意思去催别人，有时候对方正处在困难中，我甚至会觉得不忍心。',
    'Dampak abu vulkanik Gunung Anak Krakatau masih memengaruhi perjalanan udara di sekitar Jakarta.':'阿纳克喀拉喀托火山的火山灰影响仍在影响雅加达周边的航空出行。',
    'Walaupun pagi ini padat, aku tetap nyempetin follow up vendor yang prosesnya masih nyangkut.':'虽然今天早上很忙，我还是挤出时间跟进了流程还卡着的供应商。'
  };
  const weakExampleCnCache=new Map();
  function sentenceKey(s){return String(s||'').replace(/\s+/g,' ').trim();}
  function overrideExampleCn(text){return WEAK_EXAMPLE_CN_OVERRIDES[sentenceKey(text)]||'';}
  function setWeakExampleCn(el,cn){
    const zh=String(cn||'').trim();if(!el||!zh)return;
    el.textContent=zh.replace(/^中文[：:]\s*/, '');
    el.dataset.weakCnReady='1';
  }
  async function ensureWeakExampleCn(card){
    if(!card||card.dataset.weakCnDone==='1'||card.dataset.weakCnLoading==='1')return;
    const exEl=card.querySelector('.v2-ex');if(!exEl){card.dataset.weakCnDone='1';return;}
    const example=sentenceKey(exEl.textContent||'');if(!example){card.dataset.weakCnDone='1';return;}
    let cnEl=card.querySelector('.v2-excn');
    if(cnEl){
      const raw=String(cnEl.textContent||'').trim();
      if(cnEl.dataset.weakCnReady==='1'){
        if(/^中文[：:]/.test(raw))cnEl.textContent=raw.replace(/^中文[：:]\s*/,'');
        card.dataset.weakCnDone='1';
        return;
      }
      if(raw&&!/翻译中|加载失败/.test(raw)){
        setWeakExampleCn(cnEl,raw);
        card.dataset.weakCnDone='1';
        return;
      }
    }else{
      cnEl=document.createElement('p');cnEl.className='v2-excn';exEl.insertAdjacentElement('afterend',cnEl);
    }
    if(card.dataset.weakCnAttempted==='1')return;
    card.dataset.weakCnAttempted='1';
    card.dataset.weakCnLoading='1';
    cnEl.textContent='翻译中…';
    const word=String(card.getAttribute('data-weak-word')||card.querySelector('b')?.textContent||'').trim();
    const cacheKey=(word.toLowerCase()+'\n'+example);
    let zh=overrideExampleCn(example)||weakExampleCnCache.get(cacheKey)||'';
    if(!zh)zh=await translateZh(example);
    if(zh){
      weakExampleCnCache.set(cacheKey,zh);
      if(card.isConnected)setWeakExampleCn(cnEl,zh);
      const p=weakPool();
      if(p&&word&&typeof p.enrich==='function')p.enrich(word,{example:example,example_cn:zh});
      card.dataset.weakCnDone='1';
    }else if(card.isConnected){
      cnEl.textContent='暂时加载失败';
    }
    delete card.dataset.weakCnLoading;
  }
  function decorateWeakExamples(root){
    const box=document.getElementById('weaknessBody');if(!box)return;
    const scope=root&&root.nodeType===1?root:box;
    if(scope.matches&&scope.matches('.v2-card,.weak-card'))ensureWeakExampleCn(scope);
    if(scope.querySelectorAll)scope.querySelectorAll('.v2-card,.weak-card').forEach(function(card){ensureWeakExampleCn(card);});
  }
  function installWeakExampleObserver(){
    const box=document.getElementById('weaknessBody');if(!box||box.dataset.weakCnObserver==='1')return;
    box.dataset.weakCnObserver='1';
    decorateWeakExamples(box);
    new MutationObserver(function(mutations){
      mutations.forEach(function(m){
        Array.from(m.addedNodes||[]).forEach(function(node){
          if(node&&node.nodeType===1)decorateWeakExamples(node);
        });
      });
    }).observe(box,{childList:true,subtree:true});
  }

  function backfillExisting(hit){
    const key=norm(hit.base||hit.word);if(!key||!hit.cn)return;
    const p=weakPool();
    if(p&&p.get(key))p.enrich(key,{cn:hit.cn,en:hit.en,root:hit.root,root_cn:hit.root_cn,example:hit.example,example_cn:hit.example_cn});
    const m=unknownMap();
    if(m[key]&&(!m[key].cn||m[key].cn==='暂无释义'||m[key].cn==='暂未查到释义')){
      m[key].cn=hit.cn;m[key].last_seen=new Date().toISOString();localStorage.setItem('indo_unknown_words',JSON.stringify(m));window.dispatchEvent(new CustomEvent('unknown-vocab-changed'));
    }
  }

  async function ensureMeaning(hit,cnEl){
    if(hit.cn){backfillExisting(hit);return hit.cn;}
    if(cnEl){cnEl.textContent='查询中文释义…';cnEl.className='rw-empty';}
    const zh=await translateZh(hit.base||hit.word);
    if(zh){hit.cn=zh;if(cnEl){cnEl.textContent=zh;cnEl.className='rw-cn';}backfillExisting(hit);}
    else if(cnEl){cnEl.textContent='暂未查到释义';cnEl.className='rw-empty';}
    return hit.cn||'';
  }

  async function saveUnknown(hit,node){
    const key=norm(hit.base||hit.word);if(!key)return;const now=new Date().toISOString(),src=sourceInfo(node),context=sentenceFrom(node,hit.word);
    const contextCn=context?(overrideExampleCn(context)||await translateZh(context)):'';
    const item={word:hit.base||key,display:hit.word,cn:hit.cn||'暂未查到释义',en:hit.en||'',root:hit.root||'',root_cn:hit.root_cn||'',example:context||hit.example||'',example_cn:contextCn||(!context?hit.example_cn:'')||'',first_seen:now,last_seen:now,times_seen:1,source:src.source,source_date:src.date,session:src.session,contexts:context?[context]:[]};
    const p=weakPool();if(p){p.markUnknown(item);return;}
    const m=unknownMap();
    if(m[key]){m[key].last_seen=now;m[key].times_seen=(m[key].times_seen||1)+1;if(hit.cn&&(!m[key].cn||m[key].cn==='暂无释义'||m[key].cn==='暂未查到释义'))m[key].cn=hit.cn;if(context&&!m[key].contexts?.includes(context))m[key].contexts=(m[key].contexts||[]).concat(context).slice(-5);if(item.example&&!m[key].example)m[key].example=item.example;if(item.example_cn&&!m[key].example_cn)m[key].example_cn=item.example_cn;}else m[key]=item;
    localStorage.setItem('indo_unknown_words',JSON.stringify(m));window.dispatchEvent(new CustomEvent('unknown-vocab-changed'));
  }

  function show(raw,rect,node){
    const hit=lookup(raw);if(!hit)return;hide();ensureStyle();popup=document.createElement('div');popup.className='rw-popup';const added=isUnknown(hit.base||hit.word);
    popup.innerHTML=`<div class="rw-word">${escapeHtml(hit.word)}</div><div class="${hit.cn?'rw-cn':'rw-empty'}">${escapeHtml(hit.cn||'查询中文释义…')}</div><div class="rw-actions"><button class="rw-add ${added?'added':''}" type="button">${added?'✓ 已在弱项':'＋ 加入陌生词'}</button></div>`;
    const cnEl=popup.children[1],btn=popup.querySelector('.rw-add');btn.addEventListener('mousedown',e=>e.stopPropagation());btn.addEventListener('click',async e=>{e.stopPropagation();if(isUnknown(hit.base||hit.word))return;btn.disabled=true;btn.textContent='正在加入…';await ensureMeaning(hit,cnEl);await saveUnknown(hit,node);btn.disabled=false;btn.textContent='✓ 已在弱项';btn.classList.add('added');});document.body.appendChild(popup);if(!hit.cn)ensureMeaning(hit,cnEl);else backfillExisting(hit);
    const pw=popup.offsetWidth,ph=popup.offsetHeight;let left=Math.max(8,Math.min(window.innerWidth-pw-8,rect.left)),top=rect.top-ph-10;if(top<8)top=Math.min(window.innerHeight-ph-8,rect.bottom+10);popup.style.left=left+'px';popup.style.top=top+'px';
  }

  function handleSelection(){const sel=window.getSelection&&window.getSelection();if(!sel||sel.rangeCount===0||sel.isCollapsed)return;const txt=sel.toString().trim();if(!txt||txt.length>40||/\s/.test(txt))return;const range=sel.getRangeAt(0),node=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer.parentElement;if(!node||!node.closest||!node.closest('.rl-text,.dailyFixReading'))return;const rect=range.getBoundingClientRect();if(!rect||(!rect.width&&!rect.height))return;show(txt,rect,node);}

  document.addEventListener('mouseup',()=>setTimeout(handleSelection,0));document.addEventListener('touchend',()=>setTimeout(handleSelection,80));document.addEventListener('mousedown',e=>{if(!e.target.closest('.rw-popup'))hide();});document.addEventListener('scroll',hide,true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){ensureStyle();installWeakExampleObserver();},{once:true});else{ensureStyle();installWeakExampleObserver();}
})();