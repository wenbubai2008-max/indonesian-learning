(function(){
  function getUnknown(){
    let m={};try{m=JSON.parse(localStorage.getItem('indo_unknown_words')||'{}')}catch(e){}
    return Object.values(m).filter(x=>x&&x.word).sort((a,b)=>{
      const ta=Date.parse(a.last_seen||a.first_seen||0)||0,tb=Date.parse(b.last_seen||b.first_seen||0)||0;
      return tb-ta;
    });
  }
  function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function removeWord(word){
    let m={};try{m=JSON.parse(localStorage.getItem('indo_unknown_words')||'{}')}catch(e){}
    const key=String(word||'').trim().toLowerCase();
    Object.keys(m).forEach(k=>{if(k===key||String(m[k]?.word||'').trim().toLowerCase()===key)delete m[k]});
    localStorage.setItem('indo_unknown_words',JSON.stringify(m));
    let mem={};try{mem=JSON.parse(localStorage.getItem('indo_mem')||'{}')}catch(e){}
    mem[word]='know';localStorage.setItem('indo_mem',JSON.stringify(mem));
    window.dispatchEvent(new CustomEvent('unknown-vocab-changed'));
    inject();
  }
  window.learnedUnknownFromDaily=removeWord;

  function inject(){
    const body=document.getElementById('dailyBody');if(!body||!document.getElementById('daily')?.classList.contains('active'))return;
    const old=body.querySelector('#unfamiliarDailyReview');if(old)old.remove();
    const words=getUnknown().slice(0,3);if(!words.length)return;
    const sec=document.createElement('section');sec.id='unfamiliarDailyReview';sec.className='dailyFixSec';
    sec.innerHTML='<h3><span class="dailyFixNum">↺</span> 陌生词复习</h3><div class="dailyUnknownGrid">'+words.map(x=>{
      const ctx=(x.contexts&&x.contexts.length)?x.contexts[x.contexts.length-1]:'';
      return '<div class="dailyUnknownCard"><div class="dailyUnknownHead"><b>'+esc(x.word)+'</b><button class="sound" onclick="speak('+JSON.stringify(x.word)+')">🔊</button></div><div class="dailyUnknownCn">'+esc(x.cn||'暂未查到释义')+'</div>'+(ctx?'<div class="dailyUnknownCtx">'+esc(ctx)+'</div>':'')+'<button class="dailyUnknownDone" onclick="learnedUnknownFromDaily('+JSON.stringify(x.word)+')">会了 ✓</button></div>';
    }).join('')+'</div>';
    const first=body.querySelector('.dailyFixSec');
    if(first)first.before(sec);else body.prepend(sec);
    if(!document.getElementById('dailyUnknownStyle')){
      const st=document.createElement('style');st.id='dailyUnknownStyle';st.textContent=`
        #unfamiliarDailyReview{margin-bottom:18px}.dailyUnknownGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.dailyUnknownCard{border:1px solid #dfe6f3;background:#fbfcff;border-radius:14px;padding:12px 14px}.dailyUnknownHead{display:flex;align-items:center;gap:7px}.dailyUnknownHead b{font-size:20px}.dailyUnknownCn{font-weight:800;margin-top:6px;color:#334155}.dailyUnknownCtx{font-size:14px;color:#64748b;line-height:1.55;margin-top:7px}.dailyUnknownDone{margin-top:9px;border:0;border-radius:9px;background:#eef3ff;color:#3157d5;padding:7px 10px;font-weight:800;cursor:pointer}@media(max-width:760px){.dailyUnknownGrid{grid-template-columns:1fr}.dailyUnknownCard{padding:11px 12px}}
      `;document.head.appendChild(st);
    }
  }

  const body=document.getElementById('dailyBody');if(body)new MutationObserver(()=>setTimeout(inject,0)).observe(body,{childList:true,subtree:false});
  window.addEventListener('unknown-vocab-changed',()=>setTimeout(inject,0));
})();
