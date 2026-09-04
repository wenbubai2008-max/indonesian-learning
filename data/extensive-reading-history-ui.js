(function(){
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});}
  var currentIndex=0;
  function allArticles(){
    var cur=(window.EXTENSIVE_READING_DB||[]).slice();
    var hist=(window.EXTENSIVE_READING_HISTORY||[]).slice();
    var seen={},out=[];
    cur.concat(hist).forEach(function(x){if(!x)return;var k=x.id||x.date||x.title;if(seen[k])return;seen[k]=1;out.push(x);});
    out.sort(function(a,b){return String(b.date||'').localeCompare(String(a.date||''));});
    return out;
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
      '<div class="v2-note">默认显示今日泛读；可以用上面的日期/文章列表查看历史内容。标题和正文都支持划词查义。</div>'+
      '<div class="rl-text v2-reading">'+esc(x.text||'').replace(/\n/g,'<br>')+'</div>'+
      '<div class="v2-actions"><button class="secondary" onclick=\'speak('+JSON.stringify(x.text||'')+')\'>🔊 朗读全文</button><button class="secondary" onclick="toggleExtensiveHistoryCn()">显示 / 隐藏中文</button></div>'+
      '<div class="v2-cn" id="extensiveHistoryCn">'+esc(x.cn||'').replace(/\n/g,'<br>')+'</div>'+
      (x.source_name?'<div class="muted" style="margin-top:12px">改写来源：'+esc(x.source_name)+(x.source_date?' · '+esc(x.source_date):'')+'</div>':'');
  }
  window.extensiveHistoryMove=function(delta){currentIndex+=delta;render();window.scrollTo({top:0,behavior:'smooth'});};
  window.extensiveHistorySelect=function(i){currentIndex=Number(i)||0;render();};
  window.toggleExtensiveHistoryCn=function(){var e=document.getElementById('extensiveHistoryCn');if(e)e.classList.toggle('show');};
  window.openExtensiveV2=function(){if(window.setupPages)window.setupPages();if(window.go)go('extensive');currentIndex=0;render();};
  var s=document.createElement('style');s.textContent='.erHistNav{display:grid;grid-template-columns:auto minmax(220px,1fr) auto;gap:8px;align-items:center;margin-bottom:14px}.erHistNav select{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:#fff;min-width:0}.erHistNav button:disabled{opacity:.35}@media(max-width:700px){.erHistNav{grid-template-columns:1fr 1fr}.erHistNav select{grid-column:1/-1;grid-row:1}.erHistNav button{grid-row:2}}';document.head.appendChild(s);
})();
