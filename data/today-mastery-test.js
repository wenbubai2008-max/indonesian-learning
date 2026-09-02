(function(){
  const TARGET_DATE='2026-09-02';
  const STORE='indo_mastery_2026-09-02_pm_v2';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const test={
    choose:[
      {q:'会议时间变了，同事应该早点“告诉你一声”。最自然的是？',opts:['ngabarin aku','ketinggalan aku','keteteran aku'],a:0},
      {q:'今天事情太多，一个人已经“忙不过来”。应该用？',opts:['kepending','keteteran','kebuang'],a:1},
      {q:'文件一直搁着没有推进。办公室口语更接近？',opts:['kepending','ketinggalan','keburu'],a:0},
      {q:'会议临时改了，你怕“错过消息”。应该说？',opts:['kebuang info','ketinggalan info','keteteran info'],a:1},
      {q:'“趁还没太晚之前先处理完。”核心结构是？',opts:['sebelum keburu...','malah...','sempat...'],a:0}
    ],
    fill:[
      {q:'Kalau jadwalnya berubah, ____ aku dari awal ya.',opts:['ngabarin','kebuang','keteteran'],a:0,cn:'如果时间有变化，早点告诉我一声。'},
      {q:'Aku mau ____ kerjaan ini dulu sebelum meeting berikutnya.',opts:['beresin','ketinggalan','kepending'],a:0,cn:'我想先把这个工作处理完。'},
      {q:'Kalau semuanya aku kerjain sendiri, nanti bisa ____.',opts:['keteteran','ngabarin','keburu'],a:0,cn:'如果全部自己做，可能会忙不过来。'},
      {q:'Aku nggak mau waktunya ____ cuma buat nunggu.',opts:['kebuang','sempetin','ketinggalan'],a:0,cn:'我不想只是等着把时间浪费掉。'},
      {q:'Nanti ____ baca dokumennya sebelum pulang, ya.',opts:['sempetin','kepending','kebuang'],a:0,cn:'等会儿下班前挤点时间看文件。'}
    ],
    hint:[
      {q:'“赶截止时间” → n_____ deadline',a:'ngejar deadline',hint:'n… deadline'},
      {q:'“临时冒出来的事” → u_____ dadakan',a:'urusan dadakan',hint:'u… dadakan'},
      {q:'“挤时间做一下” → s_____',a:'sempetin',hint:'s…'}
    ],
    order:[
      {q:'把词块按自然顺序排成一句：',parts:['aku','mau','beresin','ini','dulu'],a:'Aku mau beresin ini dulu.'},
      {q:'把词块按自然顺序排成一句：',parts:['jangan sampai','waktunya','kebuang','cuma buat nunggu'],a:'Jangan sampai waktunya kebuang cuma buat nunggu.'}
    ],
    free:{q:'最后只写一句：今天如果工作突然有变化，你会怎么处理？尽量用 1–2 个今晚词块就够了。',a:'Aku bakal ngabarin tim dulu, terus beresin kerjaan yang paling penting.'}
  };
  function load(){try{return JSON.parse(localStorage.getItem(STORE)||'{}')}catch(e){return {}}}
  function save(d){try{localStorage.setItem(STORE,JSON.stringify(d))}catch(e){}}
  function ans(a){return `<button type="button" class="dailyFixToggle mt-reveal">参考答案</button><div class="dailyFixAnswer"><div class="dailyFixId">${esc(a)}</div></div>`}
  function mcBlock(items,title){return `<div class="mt-sub"><h4>${title}</h4>${items.map((x,i)=>`<div class="mt-item mt-choice" data-a="${x.a}"><b>${i+1}. ${esc(x.q)}</b>${x.cn?`<div class="muted">${esc(x.cn)}</div>`:''}<div class="mt-options">${x.opts.map((o,j)=>`<button type="button" data-i="${j}">${esc(o)}</button>`).join('')}</div><div class="mt-choice-result muted"></div></div>`).join('')}</div>`}
  function hintBlock(){return `<div class="mt-sub"><h4>③ 首字母提示 · 3题</h4><div class="muted">只补核心词，不需要写完整句子。</div>${test.hint.map((x,i)=>`<div class="mt-item"><b>${i+1}. ${esc(x.q)}</b><div class="mt-shortrow"><input class="mt-short" data-hint="${i}" placeholder="输入核心词"><button type="button" class="secondary mt-check" data-hint-check="${i}">检查</button></div><div class="mt-inline-result muted"></div>${ans(x.a)}</div>`).join('')}</div>`}
  function orderBlock(){return `<div class="mt-sub"><h4>④ 句子排序 · 2题</h4><div class="muted">按顺序点击词块，组成自然句子。</div>${test.order.map((x,i)=>`<div class="mt-item mt-order" data-order="${i}"><b>${i+1}. ${esc(x.q)}</b><div class="mt-order-answer"></div><div class="mt-parts">${x.parts.map((p,j)=>`<button type="button" data-p="${j}">${esc(p)}</button>`).join('')}</div><button type="button" class="secondary mt-order-reset">重排</button>${ans(x.a)}</div>`).join('')}</div>`}
  function inject(){
    const body=document.getElementById('dailyBody'),daily=document.getElementById('daily');
    if(!body||!daily?.classList.contains('active')||document.getElementById('todayMasteryTest'))return;
    const date=document.getElementById('dailyMeta')?.textContent.trim(),title=document.getElementById('dailyTitle')?.textContent||'';
    if(date!==TARGET_DATE||!title.includes('19:00'))return;
    const completion=[...body.querySelectorAll('button')].find(b=>b.textContent.includes('我学完了')||b.textContent.includes('已学完'));
    const sec=document.createElement('section');sec.id='todayMasteryTest';sec.className='dailyFixSec';
    sec.innerHTML=`<h3><span class="dailyFixNo">✓</span>当日掌握度测试 · 10–15分钟</h3>
      <div class="mt-intro">今晚先用<b>半主动测试</b>：大部分只需要判断、补一个词或点词排序，不要求你写很多完整句子。</div>
      ${mcBlock(test.choose,'① 情境选词 · 5题')}
      ${mcBlock(test.fill,'② 句子补空 · 5题')}
      ${hintBlock()}
      ${orderBlock()}
      <div class="mt-sub"><h4>⑤ 自由短句 · 1题</h4><div class="mt-item"><b>${esc(test.free.q)}</b><textarea class="mt-free" rows="2" placeholder="一句就够，不要求完美"></textarea>${ans(test.free.a)}</div></div>
      <div class="mt-summary"><h4>⑥ 今天的反馈</h4><div class="mt-feedback"><div><b>整体感觉</b><div class="mt-rate" data-group="difficulty"><button data-v="太简单">太简单</button><button data-v="正好">正好</button><button data-v="有点难">有点难</button><button data-v="太难">太难</button></div></div><div><b>今天这些词</b><div class="mt-rate" data-group="recall"><button data-v="大部分能认出并调用">大部分能认出并调用</button><button data-v="一半左右">一半左右</button><button data-v="很多还是模糊">很多还是模糊</button></div></div><label><b>最卡的 1–3 个词</b><input class="mt-hard" placeholder="例如：keteteran, sempetin"></label><div class="mt-score"></div></div></div>`;
    if(completion)completion.closest('div').before(sec);else body.appendChild(sec);
    bind(sec);restore(sec);
  }
  function bind(sec){
    sec.querySelectorAll('.mt-reveal').forEach(b=>b.addEventListener('click',()=>b.parentElement.classList.toggle('dailyFixOpen')));
    sec.querySelectorAll('.mt-choice .mt-options button').forEach(b=>b.addEventListener('click',()=>{
      const row=b.closest('.mt-choice');if(row.dataset.done==='1')return;row.dataset.done='1';const a=Number(row.dataset.a),i=Number(b.dataset.i);row.querySelectorAll('.mt-options button').forEach(x=>x.disabled=true);b.classList.add(i===a?'correct':'wrong');if(i!==a)row.querySelector(`button[data-i="${a}"]`)?.classList.add('correct');row.querySelector('.mt-choice-result').textContent=i===a?'答对了。':'正确答案已标出。';const d=load();d.mc=d.mc||[];d.mc.push(i===a?1:0);save(d);updateScore(sec);
    }));
    sec.querySelectorAll('[data-hint-check]').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.hintCheck),input=sec.querySelector(`[data-hint="${i}"]`),row=b.closest('.mt-item'),ok=input.value.trim().toLowerCase()===test.hint[i].a.toLowerCase();row.querySelector('.mt-inline-result').textContent=ok?'答对了。':'再看一下提示或展开参考答案。';const d=load();d.hint=d.hint||{};d.hint[i]=input.value;save(d)}));
    sec.querySelectorAll('.mt-order').forEach(row=>{
      const i=Number(row.dataset.order),out=row.querySelector('.mt-order-answer');
      row.querySelectorAll('.mt-parts button').forEach(b=>b.addEventListener('click',()=>{if(b.disabled)return;b.disabled=true;const span=document.createElement('span');span.textContent=b.textContent;out.appendChild(span);const d=load();d.order=d.order||{};d.order[i]=[...(d.order[i]||[]),Number(b.dataset.p)];save(d)}));
      row.querySelector('.mt-order-reset').addEventListener('click',()=>{out.innerHTML='';row.querySelectorAll('.mt-parts button').forEach(b=>b.disabled=false);const d=load();d.order=d.order||{};d.order[i]=[];save(d)});
    });
    sec.querySelector('.mt-free').addEventListener('input',e=>{const d=load();d.free=e.target.value;save(d)});
    sec.querySelectorAll('.mt-rate[data-group] button').forEach(b=>b.addEventListener('click',()=>{const g=b.closest('[data-group]');g.querySelectorAll('button').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');const d=load();d[g.dataset.group]=b.dataset.v;save(d)}));
    sec.querySelector('.mt-hard').addEventListener('input',e=>{const d=load();d.hard=e.target.value;save(d)});
  }
  function restore(sec){const d=load();if(d.free)sec.querySelector('.mt-free').value=d.free;Object.entries(d.hint||{}).forEach(([i,v])=>{const x=sec.querySelector(`[data-hint="${i}"]`);if(x)x.value=v});['difficulty','recall'].forEach(g=>{if(d[g])sec.querySelector(`[data-group="${g}"] button[data-v="${d[g]}"]`)?.classList.add('selected')});if(d.hard)sec.querySelector('.mt-hard').value=d.hard;updateScore(sec)}
  function updateScore(sec){const d=load(),a=d.mc||[],correct=a.filter(Boolean).length;sec.querySelector('.mt-score').innerHTML=a.length?`目前已完成选择/补空 <b>${a.length}/10</b> 题，答对 <b>${correct}</b> 题。重点看哪些词反复卡住，不追求一次全对。`:'做完前两部分后，这里会显示当前结果。'}
  if(!document.getElementById('todayMasteryStyle')){const st=document.createElement('style');st.id='todayMasteryStyle';st.textContent=`#todayMasteryTest .mt-intro{background:#f8faff;padding:12px 14px;border-radius:12px;line-height:1.7}.mt-sub{margin-top:18px}.mt-sub h4,.mt-summary h4{margin:0 0 9px;font-size:17px}.mt-item{border:1px solid var(--line);border-radius:12px;padding:12px 13px;margin-top:9px;line-height:1.65}.mt-options,.mt-rate,.mt-parts,.mt-shortrow{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.mt-options button,.mt-rate button,.mt-parts button{border:1px solid var(--line);background:#fff;border-radius:9px;padding:8px 11px;cursor:pointer}.mt-options button.correct{background:#edf9f0;border-color:#74be86;color:#17652d}.mt-options button.wrong{background:#fff0ef;border-color:#dd8a83;color:#9d2f28}.mt-rate button.selected{background:#eef3ff;color:#3157d5;border-color:#9ab0ee}.mt-short,.mt-hard,.mt-free{border:1px solid var(--line);border-radius:9px;padding:9px 10px;font:inherit}.mt-short{min-width:220px}.mt-free{display:block;width:100%;margin-top:9px;resize:vertical}.mt-order-answer{min-height:44px;background:#f8faff;border-radius:9px;padding:8px;margin-top:9px}.mt-order-answer span{display:inline-block;background:#eef3ff;color:#3157d5;border-radius:8px;padding:6px 9px;margin:3px}.mt-summary{margin-top:20px;background:#fbfcff;border:1px solid var(--line);border-radius:14px;padding:14px}.mt-feedback{display:grid;gap:13px}.mt-hard{display:block;width:100%;max-width:520px;margin-top:7px}.mt-score{color:#52627a}@media(max-width:650px){.mt-options button,.mt-rate button{flex:1;min-width:90px}.mt-short{width:100%}}`;document.head.appendChild(st)}
  const body=document.getElementById('dailyBody');if(body)new MutationObserver(()=>setTimeout(inject,0)).observe(body,{childList:true,subtree:false});window.addEventListener('load',()=>setTimeout(inject,100));
})();
