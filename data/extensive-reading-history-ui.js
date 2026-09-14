(function(){
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});}
  function splitParas(s){return String(s||'').trim().split(/\n\s*\n+/).map(function(x){return x.trim();}).filter(Boolean);}
  function norm(s){return String(s||'').trim().toLowerCase();}
  var currentIndex=0,currentParagraphs=[],activeUtterance=null,archiveCache={};
  function base(){try{return typeof BASE!=='undefined'?BASE:'/indonesian-learning/';}catch(e){return '/indonesian-learning/';}}
  function records(){
    var cur=(window.EXTENSIVE_READING_DB||[])[0]||null;
    var arr=[];
    if(cur)arr.push({id:cur.id,date:cur.date,title:cur.title,title_cn:cur.title_cn,current:true,article:cur});
    (window.EXTENSIVE_READING_HISTORY_INDEX||[]).forEach(function(x){if(!x)return;if(cur&&(x.id===cur.id||x.date===cur.date))return;arr.push(x);});
    arr.sort(function(a,b){var d=String(b.date||'').localeCompare(String(a.date||''));if(d)return d;return String(b.id||'').localeCompare(String(a.id||''));});
    return arr;
  }
  function loadArchive(meta){
    if(meta.current&&meta.article)return Promise.resolve(meta.article);
    if(archiveCache[meta.path])return Promise.resolve(archiveCache[meta.path]);
    return new Promise(function(resolve,reject){
      window.EXTENSIVE_READING_ARCHIVE_ITEM=null;
      var s=document.createElement('script');
      s.src=base()+meta.path+'?v='+Date.now();
      s.onload=function(){var x=window.EXTENSIVE_READING_ARCHIVE_ITEM;s.remove();if(x){archiveCache[meta.path]=x;resolve(x);}else reject(new Error('历史文章加载为空'));};
      s.onerror=function(){s.remove();reject(new Error('历史文章加载失败'));};
      document.head.appendChild(s);
    });
  }
  function learnedMap(){var m={};[].concat(window.EMBEDDED_DB||[],window.DAILY_VOCAB_DB||[]).forEach(function(x){if(x&&x.word)m[norm(x.word)]=1;});return m;}
  function mem(){try{return JSON.parse(localStorage.getItem('indo_mem')||'{}');}catch(e){return {};}}
  function shouldHint(h){if(!h||!h.term)return false;var learned=learnedMap(),mm=mem(),k=norm(h.term);if(mm[h.term]==='dont'||mm[h.term]==='fuzzy')return true;if(mm[h.term]==='know')return false;if(learned[k]&&!h.force)return false;return true;}
  function markHints(text,hints){var hs=(hints||[]).filter(shouldHint).sort(function(a,b){return b.term.length-a.term.length;});if(!hs.length)return esc(text);var low=text.toLowerCase(),ranges=[];hs.forEach(function(h){var needle=h.term.toLowerCase(),pos=0;while((pos=low.indexOf(needle,pos))!==-1){var end=pos+needle.length,over=ranges.some(function(r){return pos<r.end&&end>r.start;});if(!over)ranges.push({start:pos,end:end,h:h});pos=end;}});ranges.sort(function(a,b){return a.start-b.start;});var out='',last=0;ranges.forEach(function(r){out+=esc(text.slice(last,r.start));out+='<span class="erHint"><span class="erHintWord">'+esc(text.slice(r.start,r.end))+'</span><span class="erTip"><b>'+esc(r.h.cn||'')+'</b>'+(r.h.root?'<span>词根：'+esc(r.h.root)+'</span>':'')+(r.h.formation?'<span>'+esc(r.h.formation)+'</span>':'')+'</span></span>';last=r.end;});out+=esc(text.slice(last));return out;}
  function getIndonesianVoice(){if(!('speechSynthesis' in window))return null;var voices=window.speechSynthesis.getVoices()||[];return voices.find(function(v){return /^id([-_]|$)/i.test(v.lang||'');})||voices.find(function(v){return /indonesia|bahasa/i.test((v.name||'')+' '+(v.lang||''));})||null;}
  function doSpeak(text,btn){if(!('speechSynthesis' in window)||!window.SpeechSynthesisUtterance){alert('当前浏览器不支持网页朗读，请用 Chrome / Edge / Safari 最新版打开。');return;}var synth=window.speechSynthesis;try{synth.cancel();}catch(e){}var u=new SpeechSynthesisUtterance(text);u.lang='id-ID';u.rate=.92;u.pitch=1;u.volume=1;var v=getIndonesianVoice();if(v)u.voice=v;activeUtterance=u;var old=btn?btn.textContent:'';if(btn){btn.textContent='⏹ 停止朗读';btn.dataset.speaking='1';}u.onend=u.onerror=function(){if(btn){btn.textContent=old||'🔊 朗读本段';delete btn.dataset.speaking;}activeUtterance=null;};try{synth.speak(u);if(synth.paused)synth.resume();}catch(e){if(btn){btn.textContent=old||'🔊 朗读本段';delete btn.dataset.speaking;}alert('朗读启动失败，请刷新页面后再试。');}}
  window.speakExtensiveParagraph=function(i,btn){if(btn&&btn.dataset.speaking==='1'){try{window.speechSynthesis.cancel();}catch(e){}btn.textContent='🔊 朗读本段';delete btn.dataset.speaking;activeUtterance=null;return;}var text=currentParagraphs[Number(i)]||'';if(text)doSpeak(text,btn);};
  function paragraphHtml(x){var ids=splitParas(x.text),cns=splitParas(x.cn);currentParagraphs=ids.slice();return ids.map(function(p,i){var cn=cns[i]||'',cid='erCnPara'+i;return '<div class="erPara"><div class="rl-text erParaText">'+markHints(p,x.hints||[])+'</div><div class="erParaActions"><button class="secondary" type="button" onclick="speakExtensiveParagraph('+i+',this)">🔊 朗读本段</button>'+(cn?'<button class="secondary" type="button" onclick="toggleExtensiveParagraphCn(\''+cid+'\',this)">查看中文翻译</button>':'')+'</div>'+(cn?'<div class="erParaCn" id="'+cid+'">'+esc(cn)+'</div>':'')+'</div>';}).join('');}
  async function render(){
    var body=document.getElementById('extensiveBody');if(!body)return;
    var arr=records();if(!arr.length){body.innerHTML='<div class="empty">暂无泛读内容</div>';return;}
    currentIndex=Math.max(0,Math.min(currentIndex,arr.length-1));var meta=arr[currentIndex];
    body.innerHTML='<div class="loading">正在读取泛读…</div>';
    try{
      var x=await loadArchive(meta),pill=document.getElementById('extensiveMeta');if(pill)pill.textContent=(x.date||'历史')+' · '+(x.level||'');
      var options=arr.map(function(a,i){return '<option value="'+i+'" '+(i===currentIndex?'selected':'')+'>'+esc((a.date||'历史')+' · '+(a.title_cn||a.title||''))+'</option>';}).join('');
      body.innerHTML='<div class="erHistNav"><button class="secondary" type="button" '+(currentIndex>=arr.length-1?'disabled':'')+' onclick="extensiveHistoryMove(1)">← 上一篇</button><select onchange="extensiveHistorySelect(this.value)">'+options+'</select><button class="secondary" type="button" '+(currentIndex<=0?'disabled':'')+' onclick="extensiveHistoryMove(-1)">下一篇 →</button></div><div class="v2-rhead"><span class="tag">'+esc(x.category||'泛读')+'</span><span class="tag">约 '+esc(x.minutes||5)+' 分钟</span><h3 class="rl-text v2-title">'+esc(x.title||'')+'</h3><div class="v2-title-cn">'+esc(x.title_cn||'')+'</div></div><div class="v2-note">历史泛读已改为按篇独立保存。正文淡虚线是预测陌生词；电脑鼠标停留可看中文、词根和构词。</div><div class="erParaList">'+paragraphHtml(x)+'</div>'+(x.source_name?'<div class="muted" style="margin-top:12px">改写来源：'+esc(x.source_name)+(x.source_date?' · '+esc(x.source_date):'')+'</div>':'');
    }catch(e){body.innerHTML='<div class="error">泛读加载失败<div class="diag">'+esc(e.message)+'</div></div>';}
  }
  window.extensiveHistoryMove=function(delta){try{window.speechSynthesis.cancel();}catch(e){}currentIndex+=delta;render();window.scrollTo({top:0,behavior:'smooth'});};
  window.extensiveHistorySelect=function(i){try{window.speechSynthesis.cancel();}catch(e){}currentIndex=Number(i)||0;render();};
  window.toggleExtensiveParagraphCn=function(id,btn){var e=document.getElementById(id);if(!e)return;e.classList.toggle('show');if(btn)btn.textContent=e.classList.contains('show')?'隐藏中文翻译':'查看中文翻译';};
  window.openExtensiveV2=function(){if(window.setupPages)window.setupPages();if(window.go)go('extensive');currentIndex=0;render();};
  var s=document.createElement('style');s.textContent='.erHistNav{display:grid;grid-template-columns:auto minmax(220px,1fr) auto;gap:8px;align-items:center;margin-bottom:14px}.erHistNav select{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:#fff;min-width:0}.erHistNav button:disabled{opacity:.35}.erParaList{margin-top:14px}.erPara{background:#f8faff;border-left:4px solid #91ace8;border-radius:14px;padding:20px;margin-top:14px}.erParaText{font-size:20px;line-height:2;text-align:left}.erParaActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.erParaCn{display:none;background:#fffaf4;color:#705a47;border-radius:12px;padding:15px;line-height:1.8;margin-top:10px}.erParaCn.show{display:block}.erHint{position:relative;display:inline}.erHintWord{border-bottom:1.5px dotted #8da0bd;cursor:help}.erTip{display:none;position:absolute;z-index:50;left:50%;bottom:calc(100% + 9px);transform:translateX(-50%);min-width:180px;max-width:280px;background:#182235;color:#fff;border-radius:10px;padding:10px 12px;box-shadow:0 8px 24px rgba(20,30,50,.18);font-size:14px;line-height:1.5;white-space:normal}.erTip b{display:block;font-size:15px;margin-bottom:3px}.erTip span{display:block;color:#dbe4f2;font-size:12px;margin-top:2px}.erTip:after{content:"";position:absolute;top:100%;left:50%;margin-left:-6px;border:6px solid transparent;border-top-color:#182235}.erHint:hover .erTip{display:block}@media(max-width:700px){.erHintWord{border-bottom:none;cursor:text}.erTip{display:none!important}.erHistNav{grid-template-columns:1fr 1fr}.erHistNav select{grid-column:1/-1;grid-row:1}.erHistNav button{grid-row:2}.erPara{padding:15px}.erParaText{font-size:18px}}';document.head.appendChild(s);
})();
