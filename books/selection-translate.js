/* Book reading: mouse/touch Indonesian selection => inline Chinese lookup.
   Public word lists and on-device translation are preferred. Online translation is
   strictly opt-in: only the selected fragment is sent to a third party. */
(function(){
  'use strict';
  if(window.__bookSelectionTranslationLoaded)return;
  window.__bookSelectionTranslationLoaded=true;
  const bookTextSelector='#readerPage #paragraphs .idText';
  const glossaryURL='../data/vocab-data.js';
  const cache=new Map();
  const MAX_SELECTION=400;
  let popup=null,selected=null,seq=0,selectTimer=0,selecting=false;
  let glossaryPromise=null,deviceTranslator=null,deviceCreate=null,deviceAvailability=null;
  const $=id=>document.getElementById(id);
  const css=String.raw`
    .bsel-popup{position:fixed;z-index:100000;width:min(360px,calc(100vw - 20px));max-height:min(420px,calc(100dvh - 20px));overflow:auto;background:#fff;color:#243149;border:1px solid #d7e0ee;border-radius:14px;box-shadow:0 12px 38px rgba(20,35,67,.22);padding:14px;font:14px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}
    .bsel-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:0 0 6px}
    .bsel-label{font-weight:800;color:#4564a4;font-size:12px}
    .bsel-close{font-size:19px;padding:0 5px;background:transparent;border:0;color:#61728a;cursor:pointer}
    .bsel-selected{font-size:16px;font-weight:700;overflow-wrap:anywhere;max-height:95px;overflow:auto;white-space:pre-wrap;line-height:1.55}
    .bsel-meaning{border-left:3px solid #91addb;padding:9px 11px;margin:10px 0;background:#f4f7fe;border-radius:7px;white-space:pre-wrap;color:#33435d}
    .bsel-source{font-size:11px;color:#68768b;line-height:1.5}
    .bsel-actions{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 2px}
    .bsel-action{border:1px solid #d7e0f0;background:#fff;color:#345092;border-radius:9px;font:700 12px/1.4 inherit;padding:8px 10px;cursor:pointer}
    .bsel-action.primary{border-color:#3157d5;background:#3157d5;color:#fff}
    .bsel-action:disabled{opacity:.55;cursor:default}
    .bsel-note{font-size:11px;color:#78859a;line-height:1.5;margin-top:9px}
    @media(max-width:560px){.bsel-popup{padding:12px;border-radius:12px}.bsel-actions{gap:7px}.bsel-action{padding:9px 10px}}
  `;
  function installStyle(){
    if($('bookSelectionTranslateStyles'))return;
    const style=document.createElement('style');style.id='bookSelectionTranslateStyles';
    style.textContent=css;document.head.appendChild(style);
  }
  function textNorm(s){return String(s||'').normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('id');}
  function wordVariants(raw){
    const w=textNorm(raw).replace(/^[^a-zÀ-ÿ]+|[^a-zÀ-ÿ]+$/gi,'');
    if(!w)return[];
    const a=[w];
    if(/(?:-?ku|-?mu|-?nya|-?lah|-?kah)$/.test(w)&&w.length>5){
      const v=w.replace(/(?:-?ku|-?mu|-?nya|-?lah|-?kah)$/,'');
      if(v.length>=3)a.push(v);
    }
    return a;
  }
  function glossaryHit(raw){
    const words=wordVariants(raw);
    if(!words.length || String(raw).trim().split(/\s+/).length>6)return null;
    const lists=window.__bookReadingAids;
    const current=Number((location.hash||'').match(/^#chapter-(\d+)$/)?.[1]||1);
    if(Array.isArray(lists)){
      const chapter=lists[current-1]||[];
      for(const w of words){
        const hit=chapter.find(p=>textNorm(p[0])===w);
        if(hit)return {zh:hit[1],explain:hit[2],source:'本章精选词汇'+(w===textNorm(raw)?'':' · 基础词形：'+w)};
      }
    }
    const data=Array.isArray(window.EMBEDDED_DB)?window.EMBEDDED_DB:[];
    for(const w of words){
      const item=data.find(x=>x&&((x.word&&textNorm(x.word)===w)||(x.display&&textNorm(x.display)===w)));
      if(item&&item.cn)return {zh:String(item.cn),explain:'',source:'网站主词库'+(w===textNorm(raw)?'':' · 基础词形：'+w)};
    }
    return null;
  }
  function ensureGlossary(){
    if(Array.isArray(window.EMBEDDED_DB))return Promise.resolve();
    if(glossaryPromise)return glossaryPromise;
    glossaryPromise=new Promise(resolve=>{
      const script=document.createElement('script');script.src=glossaryURL;
      script.onload=()=>resolve();script.onerror=()=>resolve();document.head.appendChild(script);
    });
    return glossaryPromise;
  }
  function hide(){
    seq++;selected=null;
    if(popup){popup.remove();popup=null;}
  }
  function selectionInfo(){
    const sel=window.getSelection&&window.getSelection();
    if(!sel||sel.isCollapsed||sel.rangeCount<1)return null;
    const text=sel.toString().replace(/\s+/g,' ').trim();
    if(!text||text.length>MAX_SELECTION)return null;
    const range=sel.getRangeAt(0);
    const from=range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement;
    const to=range.endContainer.nodeType===1?range.endContainer:range.endContainer.parentElement;
    const parent=from&&from.closest&&from.closest(bookTextSelector);
    if(!parent||!to||!to.closest||to.closest(bookTextSelector)!==parent)return null;
    if(!$('readerPage')||$('readerPage').hidden)return null;
    const rect=range.getBoundingClientRect();
    if(!rect||(!rect.width&&!rect.height))return null;
    return {text,rect};
  }
  function align(box,rect){
    const margin=10,vw=window.innerWidth,vh=window.innerHeight;
    const w=box.offsetWidth,h=box.offsetHeight;
    const left=Math.max(margin,Math.min(vw-w-margin,rect.left+rect.width/2-w/2));
    let top=rect.top-h-12;
    if(top<margin)top=rect.bottom+12;
    if(top+h>vh-margin)top=Math.max(margin,vh-h-margin);
    box.style.left=left+'px';box.style.top=top+'px';
  }
  function popupMessage(msg,source){
    if(!popup)return;
    popup.querySelector('.bsel-meaning').textContent=msg;
    popup.querySelector('.bsel-source').textContent=source||'';
  }
  function show(info){
    hide();installStyle();
    const localSeq=seq;
    selected={text:info.text,rect:info.rect};
    popup=document.createElement('div');popup.className='bsel-popup';
    popup.setAttribute('role','dialog');popup.setAttribute('aria-label','印尼语划词翻译');
    popup.innerHTML='<div class="bsel-head"><span class="bsel-label">印尼语划词翻译</span><button class="bsel-close" type="button" aria-label="关闭">×</button></div>'+
      '<div class="bsel-selected" lang="id"></div><div class="bsel-meaning" lang="zh-CN" aria-live="polite">查询词义…</div>'+
      '<div class="bsel-source"></div><div class="bsel-actions">'+
      '<button class="bsel-action primary bsel-device" type="button">本机翻译</button>'+
      '<button class="bsel-action bsel-online" type="button">在线翻译</button>'+
      '<button class="bsel-action bsel-speak" type="button">🔊 朗读</button>'+
      '<button class="bsel-action bsel-copy" type="button">复制</button></div>'+
      '<div class="bsel-note">词库释义优先；本机翻译需浏览器支持。点击“在线翻译”才会把选中文字发送给 MyMemory，不会传整章。</div>';
    popup.querySelector('.bsel-selected').textContent=info.text;
    const box=popup;document.body.append(box);align(box,info.rect);
    const changed=()=>seq===localSeq&&popup===box;
    box.querySelector('.bsel-close').addEventListener('click',hide);
    box.querySelector('.bsel-speak').addEventListener('click',()=>{const u=new SpeechSynthesisUtterance(info.text);u.lang='id-ID';u.rate=.85;try{speechSynthesis.cancel();speechSynthesis.speak(u);}catch(e){if(changed())popupMessage('朗读不可用，请检查浏览器语音设置。','浏览器语音合成');}});
    box.querySelector('.bsel-copy').addEventListener('click',async()=>{
      try{await navigator.clipboard.writeText(info.text);if(changed())box.querySelector('.bsel-copy').textContent='✓ 已复制';}
      catch(e){if(changed())popupMessage('无法复制，请检查浏览器剪贴板权限。','');}
    });
    box.querySelector('.bsel-device').addEventListener('click',async()=>{await deviceTranslation(info.text,localSeq,box)});
    box.querySelector('.bsel-online').addEventListener('click',async()=>{await onlineTranslation(info.text,localSeq,box)});
    const exact=glossaryHit(info.text);
    if(exact){
      popupMessage(exact.zh+(exact.explain?'\n'+exact.explain:''),exact.source+' · 词义需结合上下文');
      align(box,info.rect);
    }else{
      popupMessage('正在查找本站词库…','词库之外可选“本机翻译”或“在线翻译”');
      ensureGlossary().then(()=>{
        if(!changed())return;
        const result=glossaryHit(info.text);
        if(result)popupMessage(result.zh+(result.explain?'\n'+result.explain:''),result.source+' · 词义需结合上下文');
        else popupMessage('未找到现成词义。可使用下方按钮翻译选中的单词、短语或句子。','机器译文可能有误，请结合本段已校对的中文判断。');
        align(box,info.rect);
      });
    }
  }
  async function getDeviceTranslator(){
    if(deviceTranslator)return deviceTranslator;
    if(deviceCreate)return deviceCreate;
    if(!('Translator' in window)||typeof window.Translator.create!=='function')
      throw Error('当前浏览器不提供本机翻译。可以点击“在线翻译”。');
    deviceCreate=(async()=>{
      if(typeof window.Translator.availability==='function'){
        const status=await window.Translator.availability({sourceLanguage:'id',targetLanguage:'zh'});
        deviceAvailability=status;
        if(status==='unavailable')throw Error('设备不支持印尼语→中文的本机翻译；可选择在线翻译。');
      }
      const t=await window.Translator.create({sourceLanguage:'id',targetLanguage:'zh'});
      deviceTranslator=t;return t;
    })();
    try{return await deviceCreate;}finally{deviceCreate=null;}
  }
  async function deviceTranslation(text,localSeq,box){
    if(seq!==localSeq||popup!==box)return;
    const b=box.querySelector('.bsel-device');b.disabled=true;
    popupMessage('正在使用浏览器本机翻译…','首次使用可能需要下载语言包');
    try{
      const translator=await getDeviceTranslator();
      const zh=await translator.translate(text);
      if(seq===localSeq&&popup===box){popupMessage(zh||'没有得到译文','浏览器设备端机器翻译 · 不是人工校对');align(box,selected.rect);}
    }catch(e){
      if(seq===localSeq&&popup===box)popupMessage('本机翻译不可用：'+String(e.message||e),'你可以点击“在线翻译”，仅发送选中文字。');
    }finally{b.disabled=false;}
  }
  function cachedOnline(text){
    const row=cache.get(text);
    return row||'';
  }
  async function onlineTranslation(text,localSeq,box){
    if(seq!==localSeq||popup!==box)return;
    const b=box.querySelector('.bsel-online');b.disabled=true;
    if(cachedOnline(text)){popupMessage(cachedOnline(text),'在线机器翻译缓存 · 需结合上下文');b.disabled=false;return;}
    popupMessage('正在翻译所选文字…','仅发送本次选中的文字 · MyMemory');
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),9000);
    try{
      const url='https://api.mymemory.translated.net/get?q='+encodeURIComponent(text)+'&langpair=id%7Czh-CN';
      const res=await fetch(url,{mode:'cors',signal:controller.signal,cache:'no-store',referrerPolicy:'no-referrer'});
      if(!res.ok)throw Error('HTTP '+res.status);
      const data=await res.json(),zh=String(data?.responseData?.translatedText||'').trim();
      if(Number(data?.responseStatus||0)!==200||!zh||/^MYMEMORY WARNING/i.test(zh))throw Error('服务暂时没有可用译文');
      cache.set(text,zh);
      if(seq===localSeq&&popup===box){popupMessage(zh,'MyMemory 在线机器翻译 · 仅所选文字已发送');align(box,selected.rect);}
    }catch(e){
      if(seq===localSeq&&popup===box)popupMessage('在线翻译失败：'+String(e.message||e)+'。你也可以复制选中文字到其他翻译工具。','未发送任何整章内容');
    }finally{clearTimeout(timeout);b.disabled=false;}
  }
  function scan(){
    if(selecting)return;
    const info=selectionInfo();if(!info)return;
    if(selected&&textNorm(selected.text)===textNorm(info.text)){
      const a=selected.rect,b=info.rect;
      if(Math.abs(a.left-b.left)<2&&Math.abs(a.top-b.top)<2)return;
    }
    show(info);
  }
  function later(delay){
    clearTimeout(selectTimer);
    selectTimer=setTimeout(scan,delay);
  }
  document.addEventListener('pointerdown',e=>{
    if(e.target.closest('.bsel-popup'))return;
    selecting=!!e.target.closest(bookTextSelector);
    if(popup)hide();
  },true);
  document.addEventListener('pointerup',e=>{
    selecting=false;if(e.target.closest('.bsel-popup'))return;
    later(50);
  });
  document.addEventListener('touchend',e=>{
    selecting=false;if(e.target.closest('.bsel-popup'))return;
    later(240);
  },{passive:true});
  document.addEventListener('selectionchange',()=>{if(!selecting)later(200)});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')hide()});
  document.addEventListener('scroll',e=>{if(popup&&!e.target.closest?.('.bsel-popup'))hide()},true);
  window.addEventListener('resize',hide);
  installStyle();
})();
