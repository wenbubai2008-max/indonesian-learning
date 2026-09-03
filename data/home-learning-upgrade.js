(function(){
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=s=>String(s||'').toLowerCase().trim();
  function ensurePages(){
    const app=document.querySelector('.app');if(!app)return;
    const defs=[
      ['quickPractice','快速练习','quickPracticeBody'],
      ['weakness','弱项强化','weaknessBody'],
      ['extensive','泛读','extensiveBody']
    ];
    defs.forEach(([id,title,bodyId])=>{
      if(document.getElementById(id))return;
      const sec=document.createElement('section');sec.id=id;sec.className='page';
      sec.innerHTML=`<button class="back" onclick="go('home')">← 返回首页</button><div class="card"><div class="sectionHead"><h2>${title}</h2><span class="pill" id="${id}Meta"></span></div><div id="${bodyId}"></div></div>`;
      app.appendChild(sec);
    });
  }
  function rewriteHome(){
    const box=document.querySelector('#home .modules');if(!box)return;
    box.innerHTML=`
      <button class="module" onclick="go('vocab')"><div>🧠</div><h3>词汇学习</h3><p>词库、闪卡、发音、例句和学习进度。</p><span class="tag" id="vocabTag">加载中...</span></button>
      <button class="module" onclick="goQuickPractice()"><div>⚡</div><h3>快速练习</h3><p>5–10分钟，把最近学过的词快速调出来。</p><span class="tag">主动调用</span></button>
      <button class="module" onclick="go('affix')"><div>🧩</div><h3>前后缀</h3><p>meN-、peN-、ber-、di-、ter-、-kan、-i 等。</p><span class="tag">词根词族</span></button>
      <button class="module" onclick="goWeakness()"><div>🎯</div><h3>弱项强化</h3><p>自动汇总“模糊 / 不会”和近期陌生词。</p><span class="tag" id="weakTag">等待数据</span></button>
      <button class="module wideModule" onclick="goExtensive()"><div>📚</div><h3>泛读</h3><p>独立于每日课程：聊天、办公室、生活和真实交流场景。</p><span class="tag">划词查义 · 可加陌生词</span></button>`;
  }
  function allRecent(){
    const a=Array.isArray(window.DAILY_VOCAB_DB)?window.DAILY_VOCAB_DB:[];
    return a.filter(x=>x&&x.word&&x.cn).slice(-60).reverse();
  }
  function shuffled(a){return a.slice().sort(()=>Math.random()-.5)}
  function distractors(word,cn,n=3){
    return shuffled(allRecent().filter(x=>norm(x.word)!==norm(word)&&x.cn&&x.cn!==cn)).slice(0,n).map(x=>x.word);
  }
  function renderQuick(){
    const body=document.getElementById('quickPracticeBody'),meta=document.getElementById('quickPracticeMeta');if(!body)return;
    const pool=allRecent().filter(x=>x.example&&x.cn).slice(0,30);
    if(meta)meta.textContent='最近学习词汇 · 10题';
    if(pool.length<5){body.innerHTML='<div class="empty">最近学习词汇还不够，先完成每日课程。</div>';return;}
    const picks=shuffled(pool).slice(0,10);
    body.innerHTML='<div class="qp-intro">不追求全对。先凭感觉作答，重点看哪些词能快速调出来。</div>'+picks.map((x,i)=>{
      const opts=shuffled([x.word,...distractors(x.word,x.cn,3)]);
      const sentence=String(x.example||'').replace(new RegExp('\\b'+x.word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i'),'______');
      return `<div class="qp-item" data-answer="${esc(x.word)}"><div class="qp-num">${i+1}</div><div class="qp-q"><b>${i%2===0?esc(x.cn):esc(sentence||x.cn)}</b><div class="muted">${i%2===0?'选出最合适的印尼语':'根据语境补出今天学过的词'}</div></div><div class="qp-options">${opts.map(o=>`<button type="button" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div><div class="qp-result"></div></div>`;
    }).join('')+'<div class="qp-score"></div>';
    let done=0,correct=0;
    body.querySelectorAll('.qp-options button').forEach(btn=>btn.onclick=function(){const row=btn.closest('.qp-item');if(row.dataset.done)return;row.dataset.done='1';done++;const good=norm(btn.dataset.v)===norm(row.dataset.answer);if(good)correct++;btn.classList.add(good?'correct':'wrong');row.querySelectorAll('.qp-options button').forEach(b=>{b.disabled=true;if(norm(b.dataset.v)===norm(row.dataset.answer))b.classList.add('correct')});row.querySelector('.qp-result').textContent=good?'答对了。':'正确答案：'+row.dataset.answer;body.querySelector('.qp-score').innerHTML=`已完成 <b>${done}/10</b> · 正确 <b>${correct}</b> 题`;};});
  }
  function mem(){try{return JSON.parse(localStorage.getItem('indo_mem')||'{}')}catch(e){return {}}}
  function unknown(){try{return Object.values(JSON.parse(localStorage.getItem('indo_unknown_words')||'{}')).filter(x=>x&&x.word)}catch(e){return []}}
  function weakWords(){
    const m=mem(),sources=[];
    const db=[...(Array.isArray(window.EMBEDDED_DB)?window.EMBEDDED_DB:[]),...(Array.isArray(window.DAILY_VOCAB_DB)?window.DAILY_VOCAB_DB:[])];
    const seen=new Set();
    db.forEach(x=>{const st=m[x.word];if((st==='fuzzy'||st==='dont')&&!seen.has(norm(x.word))){seen.add(norm(x.word));sources.push({...x,reason:st==='dont'?'不会':'模糊'});}});
    unknown().forEach(x=>{if(!seen.has(norm(x.word))){seen.add(norm(x.word));sources.push({word:x.word,cn:x.cn||'待补释义',example:(x.contexts||[]).slice(-1)[0]||'',reason:'陌生词'});}});
    return sources;
  }
  function renderWeak(){
    const body=document.getElementById('weaknessBody'),meta=document.getElementById('weaknessMeta');if(!body)return;
    const arr=weakWords();if(meta)meta.textContent=arr.length+' 个弱项';const tag=document.getElementById('weakTag');if(tag)tag.textContent=arr.length?arr.length+' 个待强化':'暂无明显弱项';
    if(!arr.length){body.innerHTML='<div class="empty"><b>暂时没有明显弱项 ✓</b><div style="margin-top:8px">词汇页标记“模糊 / 不会”，或阅读加入陌生词后，会自动进入这里。</div></div>';return;}
    body.innerHTML='<div class="weak-summary">优先处理真正卡住的词，不扩大新词量。</div><div class="weak-grid">'+arr.slice(0,20).map(x=>`<div class="weak-card"><div class="weak-head"><b>${esc(x.word)}</b><span>${esc(x.reason)}</span></div><div class="weak-cn">${esc(x.cn||'')}</div>${x.example?`<div class="weak-ex">${esc(x.example)}</div>`:''}<button class="sound" onclick='speak(${JSON.stringify(x.word)})'>🔊</button></div>`).join('')+'</div>';
  }
  let erIndex=0;
  function renderExtensive(){
    const body=document.getElementById('extensiveBody'),meta=document.getElementById('extensiveMeta');if(!body)return;
    const db=Array.isArray(window.EXTENSIVE_READING_DB)?window.EXTENSIVE_READING_DB:[];
    if(!db.length){body.innerHTML='<div class="empty">暂无泛读内容</div>';return;}
    erIndex=Math.max(0,Math.min(erIndex,db.length-1));const x=db[erIndex];if(meta)meta.textContent=`第 ${erIndex+1}/${db.length} 篇 · ${x.level}`;
    body.innerHTML=`<div class="er-nav"><button class="secondary" ${erIndex===0?'disabled':''} onclick="extensiveMove(-1)">← 上一篇</button><select onchange="extensiveSelect(this.value)">${db.map((a,i)=>`<option value="${i}" ${i===erIndex?'selected':''}>${i+1}. ${esc(a.category)} · ${esc(a.title)}</option>`).join('')}</select><button class="secondary" ${erIndex===db.length-1?'disabled':''} onclick="extensiveMove(1)">下一篇 →</button></div><div class="er-head"><span class="tag">${esc(x.category)}</span><span class="tag">约 ${esc(x.minutes)} 分钟</span><h3>${esc(x.title)}</h3><div class="muted">${esc(x.title_cn)}</div></div><div class="er-tip">泛读原则：先读懂大意，不要每个词都查。真正影响理解的词再划选查看中文并加入陌生词。</div><div class="rl-text er-text">${esc(x.text).replace(/\n/g,'<br>')}</div><div class="er-actions"><button class="secondary" onclick='speak(${JSON.stringify(x.text)})'>🔊 朗读全文</button><button class="secondary" onclick="toggleErTranslation()">显示 / 隐藏中文</button></div><div class="er-cn" id="erTranslation">${esc(x.cn).replace(/\n/g,'<br>')}</div>`;
  }
  window.goQuickPractice=function(){ensurePages();go('quickPractice');renderQuick();};
  window.goWeakness=function(){ensurePages();go('weakness');renderWeak();};
  window.goExtensive=function(){ensurePages();go('extensive');renderExtensive();};
  window.extensiveMove=function(n){erIndex+=n;renderExtensive();window.scrollTo(0,0)};
  window.extensiveSelect=function(v){erIndex=Number(v)||0;renderExtensive();window.scrollTo(0,0)};
  window.toggleErTranslation=function(){document.getElementById('erTranslation')?.classList.toggle('show')};
  function addStyle(){if(document.getElementById('homeLearningUpgradeStyle'))return;const st=document.createElement('style');st.id='homeLearningUpgradeStyle';st.textContent=`
    #home .modules .wideModule{grid-column:1/-1}.qp-intro,.weak-summary,.er-tip{background:#f8faff;border-radius:12px;padding:12px 14px;line-height:1.65;color:#4b5a70}.qp-item{border:1px solid var(--line);border-radius:14px;padding:13px;margin-top:10px}.qp-num{font-weight:850;color:var(--blue);margin-bottom:5px}.qp-options{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.qp-options button{border:1px solid var(--line);background:#fff;border-radius:9px;padding:8px 11px;cursor:pointer}.qp-options button.correct{background:#edf9f0;border-color:#74be86;color:#17652d}.qp-options button.wrong{background:#fff0ef;border-color:#dd8a83;color:#9d2f28}.qp-result{font-size:13px;color:#607087;margin-top:8px}.qp-score{margin-top:14px;background:#fbfcff;border:1px solid var(--line);border-radius:12px;padding:12px}.weak-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}.weak-card{border:1px solid var(--line);border-radius:13px;padding:12px;background:#fbfcff}.weak-head{display:flex;justify-content:space-between;gap:8px;align-items:center}.weak-head b{font-size:19px}.weak-head span{font-size:12px;color:var(--blue);background:#eef3ff;padding:4px 7px;border-radius:999px}.weak-cn{font-weight:750;margin-top:7px}.weak-ex{font-size:14px;color:#657084;line-height:1.6;margin:7px 0}.er-nav{display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;margin-bottom:15px}.er-nav select{width:100%;border:1px solid var(--line);border-radius:10px;padding:9px 10px;background:#fff}.er-head h3{font-size:25px;margin:12px 0 4px}.er-text{font-size:20px;line-height:2;background:#f8faff;border-left:4px solid #91ace8;border-radius:14px;padding:20px;margin-top:14px;text-align:left}.er-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.er-cn{display:none;background:#fffaf4;color:#705a47;border-radius:12px;padding:15px;line-height:1.8;margin-top:10px;text-align:left}.er-cn.show{display:block}@media(max-width:700px){#home .modules .wideModule{grid-column:auto}.weak-grid{grid-template-columns:1fr}.er-nav{grid-template-columns:1fr 1fr}.er-nav select{grid-column:1/-1;grid-row:1}.er-text{font-size:18px;padding:15px}.qp-options button{flex:1;min-width:90px}}
  `;document.head.appendChild(st)}
  addStyle();ensurePages();rewriteHome();setTimeout(()=>{const t=document.getElementById('weakTag');if(t){const n=weakWords().length;t.textContent=n?n+' 个待强化':'暂无明显弱项'}},200);
})();
