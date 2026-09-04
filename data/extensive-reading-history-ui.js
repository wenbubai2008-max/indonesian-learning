(function(){
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});}
  function splitParas(s){return String(s||'').trim().split(/\n\s*\n+/).map(function(x){return x.trim();}).filter(Boolean);}
  var currentIndex=0;
  function allArticles(){
    var cur=(window.EXTENSIVE_READING_DB||[]).slice();
    var hist=(window.EXTENSIVE_READING_HISTORY||[]).slice();
    var seen={},out=[];
    cur.concat(hist).forEach(function(x){if(!x)return;var k=x.id||x.date||x.title;if(seen[k])return;seen[k]=1;out.push(x);});
    out.sort(function(a,b){return String(b.date||'').localeCompare(String(a.date||''));});
    return out;
  }
  function paragraphHtml(x){
    var ids=splitParas(x.text),cns=splitParas(x.cn);
    return ids.map(function(p,i){
      var cn=cns[i]||'';
      var cid='erCnPara'+i;
      return '<div class="erPara">'+
        '<div class="rl-text erParaText">'+esc(p).replace(/\n/g,'<br>')+'</div>'+
        '<div class="erParaActions">'+
          '<button class="secondary" type="button" onclick=\'speak('+JSON.stringify(p)+')\'>🔊 朗读本段</button>'+
          (cn?'<button class="secondary" type="button" onclick="toggleExtensiveParagraphCn(\''+cid+'\',this)">查看中文翻译</button>':'')+
        '</div>'+
        (cn?'<div class="erParaCn" id="'+cid+'">'+esc(cn).replace(/\n/g,'<br>')+'</div>':'')+
      '</div>';
    }).join('');
  }
  function render(){
    var body=document.getElementById('extensiveBody');if(!body)return;
    var arr=allArticles();
    if(!arr.length){body.innerHTML='<div class="empty">暂无泛读内容</div>';return;}
    currentIndex=Math.max(0,Math.min(currentIndex,arr.length-1));
    var x=arr[currentIndex];
    var meta=document.getElementById('extensiveMeta');if(meta)meta.textContent=(x.date||'历史')+' · '+(x.level||'');
    var options=arr.map(function(a,i){var label=(a.date||'历史')+' · '+(a.title_cn||a.title||'');return '<option value="'+i+'" '+(i===currentIndex?'selected':'')+'>'+esc(label)+'</option>';}).join('');
    body.innerHTML='<div class="erHistNav"><button class="secondary" type="button" '+(currentIndex>=arr.length-1?'disabled':'')+' onclick="extensiveHistoryMove(1)">← 上一篇</button><select onchange="extensiveHistorySelect(this.value)">'+options+'</select><button class="secondary" type="button" '+(currentIndex<=0?'disabled':'')+' onclick="extensiveHistoryMove(-1)">下一篇 →</button></div>'+
      '<div class="v2-rhead"><span class="tag">'+esc(x.category||'泛读')+'</span><span class="tag">约 '+esc(x.minutes||5)+' 分钟</span><h3 class="rl-text v2-title">'+esc(x.title||'')+'</h3><div class="v2-title-cn">'+esc(x.title_cn||'')+'</div></div>'+
      '<div class="v2-note">正文按段落学习：每段下面都可以单独朗读，也可以单独查看中文翻译。标题和正文仍支持划词查义。</div>'+
      '<div class="erParaList">'+paragraphHtml(x)+'</div>'+
      (x.source_name?'<div class="muted" style="margin-top:12px">改写来源：'+esc(x.source_name)+(x.source_date?' · '+esc(x.source_date):'')+'</div>':'');
  }
  window.extensiveHistoryMove=function(delta){currentIndex+=delta;render();window.scrollTo({top:0,behavior:'smooth'});};
  window.extensiveHistorySelect=function(i){currentIndex=Number(i)||0;render();};
  window.toggleExtensiveParagraphCn=function(id,btn){var e=document.getElementById(id);if(!e)return;e.classList.toggle('show');if(btn)btn.textContent=e.classList.contains('show')?'隐藏中文翻译':'查看中文翻译';};
  window.openExtensiveV2=function(){if(window.setupPages)window.setupPages();if(window.go)go('extensive');currentIndex=0;render();};
  var s=document.createElement('style');s.textContent='.erHistNav{display:grid;grid-template-columns:auto minmax(220px,1fr) auto;gap:8px;align-items:center;margin-bottom:14px}.erHistNav select{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:#fff;min-width:0}.erHistNav button:disabled{opacity:.35}.erParaList{margin-top:14px}.erPara{background:#f8faff;border-left:4px solid #91ace8;border-radius:14px;padding:20px;margin-top:14px}.erParaText{font-size:20px;line-height:2;text-align:left}.erParaActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.erParaCn{display:none;background:#fffaf4;color:#705a47;border-radius:12px;padding:15px;line-height:1.8;margin-top:10px}.erParaCn.show{display:block}@media(max-width:700px){.erHistNav{grid-template-columns:1fr 1fr}.erHistNav select{grid-column:1/-1;grid-row:1}.erHistNav button{grid-row:2}.erPara{padding:15px}.erParaText{font-size:18px}}';document.head.appendChild(s);
})();
