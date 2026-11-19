/* Book-only selection popup: local dictionary first; translate only selected text on miss. */
(function(){
  'use strict';
  if(window.__bookSelectionTranslationLoaded)return;
  window.__bookSelectionTranslationLoaded=true;
  const bookTextSelector='#readerPage #paragraphs .idText';
  const glossaryURL='../data/vocab-data.js';
  const cache=new Map();
  const MAX_SELECTION=400;
  // Curated basic Indonesian grammar and colloquial terms. These entries are
  // intended for dictionary lookup, not as context-free sentence translations.
  const COMMON_ID_ZH={"seperti":["像；如同；和……一样；例如","例如 Seperti malam-malam lain：和其他夜晚一样。注意 sesuai konteks（根据上下文）选择意思。"],"seperti ini":["像这样；这样的","ini 是“这”，seperti ini 表示像这样。"],"seperti itu":["像那样；那样的","itu 是“那”，seperti itu 表示像那样。"],"sepertinya":["似乎；看来；好像","如 Sepertinya dia capek：看来他／她累了。"],"seolah":["好像；仿佛","常用来作比喻。"],"seolah-olah":["仿佛；好像","比喻或描述不一定真实的感觉。"],"misalnya":["例如；比方说","用于举例说明。"],"contohnya":["例如；举例来说","contoh 是“例子”。"],"bagai":["好比；像","较偏书面。"],"kayak":["像；好像（口语）","同 seperti 的口语用法之一，也有“皮划艇”的其他含义。"],"begini":["这样；如此","也可用于演示做法。"],"begitu":["那样；那么；如此","视上下文也可表示“那么、如此”。"],"meski":["尽管；即使","表示让步。"],"meskipun":["虽然；即使","与 walaupun 意思接近。"],"walau":["尽管；即使","walaupun 的简略形式。"],"walaupun":["虽然；尽管；即使","表示让步。"],"padahal":["其实；然而（事实却是……）","常强调前后实际情况与预期相反。"],"tapi":["但是；不过","tetapi 的口语形式。"],"tetapi":["但是；然而","表示转折。"],"namun":["然而；不过","较书面的转折。"],"sedangkan":["而；相比之下","常用于两种情况对比。"],"sementara":["与此同时；而；暂时","具体意思根据上下文确定。"],"karena":["因为","引出原因。"],"sebab":["因为；原因","既可作名词也可连词。"],"sehingga":["以至于；所以","表达结果。"],"kalau":["如果；要是；当……时","口语里常用于假设。"],"jika":["如果；假如","一般较正式。"],"bila":["当……时；如果","须结合上下文区分时间和条件。"],"supaya":["为了；以便","引出目的。"],"agar":["为了；以便","表示目的。"],"untuk":["为了；用于；给","注意与上下文搭配。"],"dengan":["和；用；以……方式","常表示伴随、工具或方式。"],"tanpa":["没有；不带；无需","表示缺少某物或不用某物。"],"dari":["从；来自；……的","常作来源介词。"],"di":["在（某处）","单独写的 di 是地点介词；连写的 di- 常构成被动动词。"],"ke":["到；向；往","方向介词。"],"pada":["在；对于；在……时候","与具体上下文搭配。"],"kepada":["向；给（某人）","表示对象。"],"yang":["……的；那个……（修饰连接词）","连接名词与修饰成分；不必每次都直译成“的”。"],"ini":["这个；这些","近指。"],"itu":["那个；那些","远指或指前文提到的事物。"],"tidak":["不；没有","否定动词、形容词等。"],"tak":["不；没有","tidak 的简略形式，常见于文学写作。"],"bukan":["不是","常用于否定名词或身份。"],"belum":["还没有；尚未","强调截至目前尚未发生。"],"jangan":["不要","表示禁止或劝阻。"],"sudah":["已经","表示已发生或已完成。"],"udah":["已经（口语）","sudah 的口语缩略。"],"telah":["已经（较正式）","与 sudah 意思接近。"],"masih":["仍然；还","强调状态持续。"],"lagi":["又；再；还在","具体意思受句型影响。"],"juga":["也；还；同样","表示附加。"],"bahkan":["甚至","表示程度或情况进一步加深。"],"ternyata":["原来；结果发现","强调发现事实与原先想象不同。"],"justru":["反而；恰恰","表示反转或意料之外。"],"malah":["反而；倒是","常带意外或强调语气。"],"hanya":["只有；仅仅","表示限制。"],"cuma":["只有；只是（口语）","常相当于 hanya。"],"saja":["只；仅仅；而已","常在词组末尾。"],"pun":["也；连……都；即便","具体含义看前后结构。"],"memang":["确实；本来就","强调实际如此。"],"sangat":["非常","程度副词。"],"sekali":["很；非常；一次","位置决定含义。"],"lebih":["更；比较","表示比较。"],"paling":["最","表示最高程度。"],"mungkin":["可能；也许","表示推测。"],"pasti":["肯定；一定","表示确定。"],"pernah":["曾经","强调经历过。"],"sering":["经常","表示频率。"],"selalu":["总是；一直","表示频率或持续。"],"kadang":["有时","相当于 kadang-kadang。"],"kadang-kadang":["有时候","表示偶尔。"],"kemudian":["然后；后来","表示时间或顺序。"],"lalu":["然后；接着；过去的","根据搭配判断。"],"sekarang":["现在","表示当前。"],"nanti":["稍后；将来","表示之后。"],"dulu":["以前；先","表示过去或先后顺序。"],"setelah":["在……之后","引出后续时间。"],"sesudah":["在……之后","与 setelah 相近。"],"sebelum":["在……之前","表示先后时间。"],"ketika":["当……时候","表示时间。"],"saat":["时刻；当……时","既可作名词也可引出时间。"],"hingga":["直到；以至于","可能表示时间、范围或结果。"],"sampai":["到；直到；甚至","含义由上下文决定。"],"harus":["必须；得","表示必要。"],"bisa":["能；会；可以","表示能力或可能。"],"boleh":["可以（得到许可）","表示允许。"],"ingin":["想要","偏中性／较正式。"],"pengen":["想要（口语）","ingin 的日常口语形式。"],"mau":["想要；要；准备","表达意愿或即将发生。"],"akan":["将；会；准备","表达未来或计划。"],"sedang":["正在","表示正在进行。"],"aku":["我","第一人称非正式说法。"],"saya":["我（较正式）","第一人称正式说法。"],"kamu":["你","第二人称较熟悉的说法。"],"gue":["我（雅加达口语）","常与 lo 搭配。"],"gua":["我（雅加达口语）","gue 的另一写法。"],"lo":["你（雅加达口语）","常与 gue 搭配。"],"lu":["你（雅加达口语）","lo 的另一写法。"],"dia":["他；她","印尼语不区分男女第三人称单数。"],"mereka":["他们；她们","复数第三人称。"],"kita":["我们（包含听话人）","与 kami 的区别是包含对方。"],"kami":["我们（不包含听话人）","与 kita 的区别是不包含对方。"],"nggak":["不；没有（口语）","tidak 的常见口语形式。"],"gak":["不；没有（口语）","tidak 的口语形式。"],"enggak":["不；没有（口语）","tidak 的口语形式。"],"gimana":["怎么样；怎么（口语）","bagaimana 的口语形式。"],"kenapa":["为什么","用于提问原因。"],"kok":["怎么；竟然（语气词）","常表达惊讶、质疑或强调。"],"sih":["……呢；嘛（语气词）","语气需根据对话判断。"],"dong":["……嘛；吧（语气词）","常加强请求、建议或强调。"],"deh":["……吧；就这样（语气词）","常使句子语气较轻松。"],"nih":["喏；这个（口语语气词）","常用于指示眼前的人或物。"],"apa":["什么","疑问词。"],"siapa":["谁","疑问词。"],"mana":["哪个；哪里","疑问词。"],"berapa":["多少","疑问词。"],"bagaimana":["怎么样；怎么","疑问词。"],"tak kunjung":["迟迟不；始终没有","强调动作或结果一直没有发生。"],"sesuatu":["某件事；某个东西；某种事物","sesuatu yang menyenangkan：令人愉快的事。sesuatu 表示不特指的事物，含义需要结合后面的修饰语。"],"sepotong":["一块；一片；一段","sepotong kue：一块蛋糕。se- 表示“一”，potong 表示切分的一块。"]};
  let popup=null,selected=null,seq=0,selectTimer=0,selecting=false;
  let glossaryPromise=null;
  const $=id=>document.getElementById(id);
  const css=String.raw`
    .bsel-popup{position:fixed;z-index:100000;width:min(310px,calc(100vw - 20px));max-height:min(300px,calc(100dvh - 20px));overflow:auto;background:#fff;color:#243149;border:1px solid #d7e0ee;border-radius:13px;box-shadow:0 9px 26px rgba(20,35,67,.18);padding:13px;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}
    .bsel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin:0 0 9px}
    .bsel-selected{font-size:19px;font-weight:800;overflow-wrap:anywhere;max-height:66px;overflow:auto;white-space:pre-wrap;line-height:1.5}
    .bsel-close{font-size:20px;padding:0 3px;background:transparent;border:0;color:#73819a;cursor:pointer;line-height:1.2;flex:none}
    .bsel-meaning{padding:10px 11px;margin:0;background:#f4f7fe;border-radius:9px;white-space:pre-wrap;color:#33435d;font-size:16px;line-height:1.65}
    .bsel-source{font-size:11px;color:#77869d;line-height:1.5;margin:6px 1px 0}
    .bsel-source:empty{display:none}
    .bsel-actions{display:flex;gap:7px;flex-wrap:wrap;margin:11px 0 0}
    .bsel-action{border:1px solid #d7e0f0;background:#fff;color:#345092;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;line-height:1.4;padding:7px 11px;cursor:pointer}
    .bsel-action:disabled{opacity:.55;cursor:default}
    .bsel-action[hidden]{display:none!important}
    @media(max-width:560px){.bsel-popup{padding:11px;border-radius:11px}.bsel-action{min-height:34px}}
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
    for(const w of words){
      const local=COMMON_ID_ZH[w];
      if(local)return {zh:local[0],explain:local[1]||'',source:'本地常用词释义（按语境理解）'};
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
    popup.innerHTML='<div class="bsel-head"><div class="bsel-selected" lang="id"></div><button class="bsel-close" type="button" aria-label="关闭">×</button></div>'+
      '<div class="bsel-meaning" lang="zh-CN" aria-live="polite">查询中…</div>'+
      '<div class="bsel-source"></div><div class="bsel-actions">'+
      '<button class="bsel-action bsel-speak" type="button">🔊 朗读</button>'+
      '<button class="bsel-action bsel-copy" type="button">复制</button>'+
      '<button class="bsel-action bsel-retry" type="button" hidden>重试翻译</button></div>';
    popup.querySelector('.bsel-selected').textContent=info.text;
    const box=popup;document.body.append(box);align(box,info.rect);
    const changed=()=>seq===localSeq&&popup===box;
    box.querySelector('.bsel-close').addEventListener('click',hide);
    box.querySelector('.bsel-speak').addEventListener('click',()=>{try{const u=new SpeechSynthesisUtterance(info.text);u.lang='id-ID';u.rate=.85;speechSynthesis.cancel();speechSynthesis.speak(u);}catch(e){if(changed())popupMessage('朗读不可用，请检查浏览器语音设置。','浏览器语音合成');}});
    box.querySelector('.bsel-copy').addEventListener('click',async()=>{
      try{await navigator.clipboard.writeText(info.text);if(changed())box.querySelector('.bsel-copy').textContent='✓ 已复制';}
      catch(e){if(changed())popupMessage('无法复制，请检查浏览器剪贴板权限。','');}
    });
    box.querySelector('.bsel-retry').addEventListener('click',()=>{void onlineTranslation(info.text,localSeq,box)});
    const exact=glossaryHit(info.text);
    if(exact){
      popupMessage(exact.zh,'词库释义');
      align(box,info.rect);
    }else{
      popupMessage('查询中…','');
      ensureGlossary().then(()=>{
        if(!changed())return;
        const result=glossaryHit(info.text);
        if(result)popupMessage(result.zh,'词库释义');
        else {
          // The reader requested instant lookup: after local dictionaries miss,
          // translate only the selected fragment. A stale/dismissed popup cannot trigger it.
          void onlineTranslation(info.text,localSeq,box);
        }
        align(box,info.rect);
      });
    }
  }
  function cachedOnline(text){return cache.get(text)||'';}
  function showOnlineResult(text,zh,box,localSeq){
    if(seq!==localSeq||popup!==box)return;
    const local=glossaryHit(text);
    popupMessage(local?local.zh:zh,local?'词库释义':'Google 机译');
    box.querySelector('.bsel-retry').hidden=true;
    if(selected)align(box,selected.rect);
  }
  async function onlineTranslation(text,localSeq,box){
    if(seq!==localSeq||popup!==box)return;
    const retry=box.querySelector('.bsel-retry');
    retry.hidden=true;retry.disabled=true;
    const cached=cache.get(text)||'';
    if(cached){showOnlineResult(text,cached,box,localSeq);retry.disabled=false;return;}
    popupMessage('翻译中…','');
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),9000);
    try{
      // Only text selected by the reader is submitted; no key or full book data.
      const url='https://translate.googleapis.com/translate_a/single?client=gtx&sl=id&tl=zh-CN&dt=t&q='+encodeURIComponent(text);
      const res=await fetch(url,{method:'GET',mode:'cors',signal:controller.signal,cache:'no-store',referrerPolicy:'no-referrer'});
      if(!res.ok)throw Error('HTTP '+res.status);
      const data=await res.json();
      const zh=Array.isArray(data&&data[0])
        ?data[0].map(seg=>Array.isArray(seg)?String(seg[0]||''):'').join('').trim():'';
      if(!zh || !/[\u3400-\u9fff]/.test(zh))throw Error('no usable translation');
      cache.set(text,zh);
      showOnlineResult(text,zh,box,localSeq);
    }catch(e){
      if(seq===localSeq&&popup===box){
        const local=glossaryHit(text);
        popupMessage(local?local.zh:'翻译失败，请重试',local?'词库释义':'Google 机译');
        retry.hidden=!!local;
        if(selected)align(box,selected.rect);
      }
    }finally{clearTimeout(timeout);retry.disabled=false;}
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
