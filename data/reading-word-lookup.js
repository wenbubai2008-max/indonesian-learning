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
    `;
    document.head.appendChild(st);
  }

  function hide(){if(popup){popup.remove();popup=null;}}
  function norm(s){return String(s||'').trim().toLowerCase().replace(/^[^a-zA-ZÀ-ÿ]+|[^a-zA-ZÀ-ÿ-]+$/g,'');}
  function allWords(){const a=Array.isArray(window.EMBEDDED_DB)?window.EMBEDDED_DB:[];const b=Array.isArray(window.DAILY_VOCAB_DB)?window.DAILY_VOCAB_DB:[];return a.concat(b);}

  function lookup(raw){
    const w=norm(raw);if(!w)return null;const variants=[w];
    if(/-(ku|mu|nya)$/.test(w))variants.push(w.replace(/-(ku|mu|nya)$/,''));
    if(/(ku|mu|nya)$/.test(w)&&w.length>5)variants.push(w.replace(/(ku|mu|nya)$/,''));
    const words=allWords();
    for(const v of variants){const hit=words.find(x=>norm(x.word)===v||norm(x.display)===v||norm(x.audio_text)===v);if(hit)return {word:raw.trim(),base:hit.word||v,cn:String(hit.cn||hit.zh||'').trim(),en:String(hit.en||'').trim(),root:String(hit.root||'').trim()};}
    return {word:raw.trim(),base:w,cn:'',en:'',root:''};
  }

  function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function sentenceFrom(node,raw){const box=node.closest('.rl-text,.dailyFixReading');const text=(box?.innerText||box?.textContent||'').replace(/\s+/g,' ').trim();if(!text)return '';const p=text.toLowerCase().indexOf(String(raw).toLowerCase());if(p<0)return text.slice(0,220);let a=Math.max(0,p-120),b=Math.min(text.length,p+String(raw).length+120);const left=text.slice(0,p).search(/[.!?。！？][^.!?。！？]*$/);if(left>=0)a=left+1;const rest=text.slice(p+String(raw).length);const m=rest.match(/[.!?。！？]/);if(m)b=p+String(raw).length+m.index+1;return text.slice(a,b).trim();}
  function sourceInfo(node){const daily=node.closest('#daily');if(daily)return {date:(document.getElementById('dailyMeta')?.textContent||'').trim(),session:(document.getElementById('dailyTitle')?.textContent||'').includes('19:00')?'19:00':'08:00',source:'每日学习阅读'};return {date:'',session:'',source:'阅读短文'};}
  function unknownMap(){try{return JSON.parse(localStorage.getItem('indo_unknown_words')||'{}')}catch(e){return {}}}
  function isUnknown(word){return !!unknownMap()[norm(word)];}

  async function translateZh(text){
    const w=String(text||'').trim();if(!w)return '';
    try{const url='https://translate.googleapis.com/translate_a/single?client=gtx&sl=id&tl=zh-CN&dt=t&q='+encodeURIComponent(w);const r=await fetch(url,{method:'GET',mode:'cors',cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const data=await r.json();return Array.isArray(data?.[0])?data[0].map(x=>Array.isArray(x)?x[0]:'').join('').trim():'';}catch(e){return '';}
  }

  function backfillExisting(hit){
    const key=norm(hit.base||hit.word);if(!key||!hit.cn)return;
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

  function saveUnknown(hit,node){
    const key=norm(hit.base||hit.word);if(!key)return;const now=new Date().toISOString(),m=unknownMap(),src=sourceInfo(node),context=sentenceFrom(node,hit.word);
    if(m[key]){m[key].last_seen=now;m[key].times_seen=(m[key].times_seen||1)+1;if(hit.cn&&(!m[key].cn||m[key].cn==='暂无释义'||m[key].cn==='暂未查到释义'))m[key].cn=hit.cn;if(context&&!m[key].contexts?.includes(context))m[key].contexts=(m[key].contexts||[]).concat(context).slice(-5);}else{m[key]={word:hit.base||key,display:hit.word,cn:hit.cn||'暂未查到释义',en:hit.en||'',root:hit.root||'',first_seen:now,last_seen:now,times_seen:1,source:src.source,source_date:src.date,session:src.session,contexts:context?[context]:[]};}
    localStorage.setItem('indo_unknown_words',JSON.stringify(m));window.dispatchEvent(new CustomEvent('unknown-vocab-changed'));
  }

  function show(raw,rect,node){
    const hit=lookup(raw);if(!hit)return;hide();ensureStyle();popup=document.createElement('div');popup.className='rw-popup';const added=isUnknown(hit.base||hit.word);
    popup.innerHTML=`<div class="rw-word">${escapeHtml(hit.word)}</div><div class="${hit.cn?'rw-cn':'rw-empty'}">${escapeHtml(hit.cn||'查询中文释义…')}</div><div class="rw-actions"><button class="rw-add ${added?'added':''}" type="button">${added?'✓ 已加入':'＋ 加入陌生词'}</button></div>`;
    const cnEl=popup.children[1],btn=popup.querySelector('.rw-add');btn.addEventListener('mousedown',e=>e.stopPropagation());btn.addEventListener('click',async e=>{e.stopPropagation();if(isUnknown(hit.base||hit.word))return;btn.disabled=true;btn.textContent='正在加入…';await ensureMeaning(hit,cnEl);saveUnknown(hit,node);btn.disabled=false;btn.textContent='✓ 已加入';btn.classList.add('added');});document.body.appendChild(popup);if(!hit.cn)ensureMeaning(hit,cnEl);else backfillExisting(hit);
    const pw=popup.offsetWidth,ph=popup.offsetHeight;let left=Math.max(8,Math.min(window.innerWidth-pw-8,rect.left)),top=rect.top-ph-10;if(top<8)top=Math.min(window.innerHeight-ph-8,rect.bottom+10);popup.style.left=left+'px';popup.style.top=top+'px';
  }

  function handleSelection(){const sel=window.getSelection&&window.getSelection();if(!sel||sel.rangeCount===0||sel.isCollapsed)return;const txt=sel.toString().trim();if(!txt||txt.length>40||/\s/.test(txt))return;const range=sel.getRangeAt(0),node=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer.parentElement;if(!node||!node.closest||!node.closest('.rl-text,.dailyFixReading'))return;const rect=range.getBoundingClientRect();if(!rect||(!rect.width&&!rect.height))return;show(txt,rect,node);}

  document.addEventListener('mouseup',()=>setTimeout(handleSelection,0));document.addEventListener('touchend',()=>setTimeout(handleSelection,80));document.addEventListener('mousedown',e=>{if(!e.target.closest('.rw-popup'))hide();});document.addEventListener('scroll',hide,true);
})();
