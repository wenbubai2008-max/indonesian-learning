(function(){
  const ORDER=['词汇学习','快速练习','弱项强化','泛读','难点解释','前后缀'];
  let scheduled=false;
  let applying=false;

  function titleOf(card){
    const h=card&&card.querySelector('h3');
    return h?(h.textContent||'').trim():'';
  }

  function makeDifficultyCard(){
    const card=document.createElement('button');
    card.id='difficultyModule';
    card.className='module homeModDifficulty';
    card.type='button';
    card.innerHTML='<div class="difficultyIconWrap"><span>💡</span><b class="difficultyCount">2</b></div><h3>难点解释</h3><p>整理中文难直译、容易混淆的词，用场景和对比帮助理解。</p><span class="tag">2 个难点</span>';
    card.addEventListener('click',function(){
      if(typeof window.showDifficultyList==='function')window.showDifficultyList();
      if(typeof window.go==='function')window.go('difficulty');
    });
    return card;
  }

  function ensureAndOrder(){
    if(applying)return;
    const box=document.querySelector('#home .modules');
    if(!box)return;
    applying=true;
    try{
      let difficulty=document.getElementById('difficultyModule');
      if(!difficulty||difficulty.parentElement!==box){
        difficulty=makeDifficultyCard();
        box.appendChild(difficulty);
      }

      const cards=[].slice.call(box.querySelectorAll(':scope > .module'));
      const map={};
      cards.forEach(function(card){
        const title=titleOf(card);
        if(title)map[title]=card;
      });
      ORDER.forEach(function(title){
        if(map[title])box.appendChild(map[title]);
      });
    }finally{
      applying=false;
    }
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(function(){
      scheduled=false;
      ensureAndOrder();
    });
  }

  function boot(){
    ensureAndOrder();
    const home=document.getElementById('home');
    if(home&&!home.__moduleStabilityObserver){
      home.__moduleStabilityObserver=true;
      new MutationObserver(function(mutations){
        if(applying)return;
        for(const m of mutations){
          if(m.type==='childList'){
            schedule();
            break;
          }
        }
      }).observe(home,{childList:true,subtree:true});
    }
    setTimeout(ensureAndOrder,250);
    setTimeout(ensureAndOrder,800);
    setTimeout(ensureAndOrder,1800);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();