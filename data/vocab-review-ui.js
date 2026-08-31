(function(){
  function mem(){try{return JSON.parse(localStorage.getItem('indo_mem')||'{}')}catch(e){return {}}}
  function save(m){localStorage.setItem('indo_mem',JSON.stringify(m))}
  function reviewWords(){const m=mem();return DB.filter(x=>m[x.word]==='fuzzy'||m[x.word]==='dont')}
  function knownWords(){const m=mem();return DB.filter(x=>m[x.word]==='know')}

  function setupStats(){
    const sb=document.getElementById('statsBar');
    if(!sb)return;
    sb.style.gridTemplateColumns='repeat(3,1fr)';
    const cards=[...sb.children];
    if(cards[3])cards[3].style.display='none';

    if(cards[0]){
      cards[0].classList.add('statAction');
      cards[0].style.cursor='pointer';
      cards[0].title='查看当前词库全部词汇';
      cards[0].onclick=function(){
        go('vocab');
        FILTER=DB.slice(); idx=0;
        const s=document.getElementById('search'); if(s)s.value='';
        const c=document.getElementById('cat'); if(c)c.value='';
        renderVocab();
        const st=document.getElementById('dbStatus'); if(st)st.textContent='全部词汇 · '+FILTER.length+' 词';
      };
    }
    if(cards[1])cards[1].onclick=function(){
      go('vocab');
      FILTER=knownWords(); idx=0; renderVocab();
      const st=document.getElementById('dbStatus'); if(st)st.textContent='已掌握 · '+FILTER.length+' 词';
    };
    if(cards[2])cards[2].onclick=function(){go('review')};
  }

  const baseGo=window.go;
  window.go=function(id){
    baseGo(id);
    const sb=document.getElementById('statsBar');
    if(sb)sb.style.display=id==='vocab'?'grid':'none';
    if(id==='review')renderReviewQueue();
  };

  let reviewIndex=0;
  function renderReviewQueue(){
    const box=document.getElementById('reviewBody');
    const meta=document.getElementById('reviewMeta');
    if(!box)return;
    const arr=reviewWords();
    if(meta)meta.textContent=arr.length+' 个';
    if(!arr.length){
      box.innerHTML='<div class="empty"><b>待复习已经清空 ✓</b><div style="margin-top:8px">标记为“会了”的词会自动离开这里。</div><div style="margin-top:16px"><button class="primary" onclick="go(\'vocab\')">返回词汇学习</button></div></div>';
      return;
    }
    reviewIndex=Math.max(0,Math.min(reviewIndex,arr.length-1));
    const x=arr[reviewIndex];
    box.innerHTML=`
      <div class="flash" id="reviewFlash">
        <div class="muted" style="margin-bottom:12px">待复习 ${reviewIndex+1} / ${arr.length}</div>
        <div class="word">${esc(x.word)} <button class="sound" onclick='speak(${JSON.stringify(x.word)})'>🔊</button></div>
        <div class="meaning" style="display:block">
          <b>${esc(x.cn||'暂无中文')}</b>
          <div class="muted">${esc(x.en||'')}</div>
          ${x.root?`<div class="muted" style="margin-top:8px">词根：${esc(x.root)}</div>`:''}
        </div>
      </div>
      <div class="actions">
        <button class="secondary" onclick="reviewKeep()">继续复习</button>
        <button class="primary" onclick="reviewMaster()">会了 ✓</button>
        <button class="secondary" onclick="reviewNext()">下一个 →</button>
      </div>`;
  }

  window.renderReviewQueue=renderReviewQueue;
  window.reviewMaster=function(){
    const arr=reviewWords(); if(!arr.length)return;
    const x=arr[reviewIndex]; const m=mem(); m[x.word]='know'; save(m);
    reviewIndex=0;
    try{updateStats()}catch(e){}
    renderReviewQueue();
  };
  window.reviewKeep=function(){
    const arr=reviewWords(); if(!arr.length)return;
    const x=arr[reviewIndex]; const m=mem();
    if(m[x.word]!=='dont')m[x.word]='fuzzy'; save(m);
    try{updateStats()}catch(e){}
    reviewNext();
  };
  window.reviewNext=function(){
    const arr=reviewWords(); if(!arr.length){renderReviewQueue();return}
    reviewIndex=(reviewIndex+1)%arr.length; renderReviewQueue();
  };

  const oldRenderReview=window.renderReview;
  window.renderReview=function(){
    const active=document.getElementById('review')?.classList.contains('active');
    if(active)renderReviewQueue(); else if(oldRenderReview)oldRenderReview();
  };

  setupStats();
  const sb=document.getElementById('statsBar'); if(sb)sb.style.display='none';
})();
