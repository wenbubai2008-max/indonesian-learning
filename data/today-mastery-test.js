(function(){
  const TARGET_DATE='2026-09-02';
  const STORE='indo_mastery_2026-09-02_pm';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const test={
    quick:[
      ['趁还没太晚之前，把这件事弄完。你先快速说出“趁还没……之前”的核心词块。','sebelum keburu...','Kita beresin sekarang sebelum keburu malam.'],
      ['“告诉我一声 / 通知我一下”，今天学的自然口语怎么说？','ngabarin','Kalau ada perubahan, ngabarin aku ya.'],
      ['“忙不过来、跟不上进度”，今天学的词是什么？','keteteran','Kalau semuanya dikerjain sendiri, nanti keteteran.'],
      ['“文件一直卡着没推进”，办公室口语怎么说？','kepending','Dokumen ini masih kepending.'],
      ['“挤出时间做某事”，今天学的口语词是什么？','sempetin','Nanti sempetin baca dokumennya, ya.']
    ],
    translate:[
      ['如果时间有变化，早点告诉我一声，免得我错过消息。','Kalau waktunya berubah, ngabarin aku dari awal ya, biar aku nggak ketinggalan info.'],
      ['我先把这个工作处理完，不然等会儿会忙不过来。','Aku beresin kerjaan ini dulu, kalau nggak nanti malah keteteran.'],
      ['刚才临时有事，我现在还在赶截止时间。','Tadi ada urusan dadakan. Sekarang aku masih ngejar deadline.']
    ],
    build:[
      ['把这些词组成自然句子：aku / ini / dulu / beresin / mau','Aku mau beresin ini dulu.'],
      ['补全：Jangan sampai waktunya ______ cuma gara-gara nunggu keputusan.','kebuang']
    ],
    choose:[
      {q:'今天工作太多，一个人做已经“忙不过来”了。应该用哪个？',opts:['ketinggalan','keteteran','kepending'],a:1},
      {q:'会议改时间后，你怕自己“错过信息”。应该说？',opts:['ketinggalan info','kebuang info','keteteran info'],a:0}
    ],
    reading:[
      ['为什么文中的人不想只是等会议？','Soalnya dia lagi ngejar deadline dan nggak mau waktunya kebuang cuma buat nunggu.'],
      ['如果你今天遇到临时变化，用今晚至少两个词块说一句你会怎么处理。','Aku bakal ngabarin tim dulu, terus beresin kerjaan yang paling penting biar nggak keteteran.']
    ]
  };
  function load(){try{return JSON.parse(localStorage.getItem(STORE)||'{}')}catch(e){return {}}}
  function save(data){try{localStorage.setItem(STORE,JSON.stringify(data))}catch(e){}}
  function answerBlock(ans,extra=''){return `<button type="button" class="dailyFixToggle mt-reveal">参考答案</button><div class="dailyFixAnswer"><div class="dailyFixId">${esc(ans)}</div>${extra?`<div class="dailyFixCnLine">${esc(extra)}</div>`:''}</div>`}
  function quickHtml(){return test.quick.map((x,i)=>`<div class="mt-item" data-quick="${i}"><b>${i+1}. ${esc(x[0])}</b><div class="mt-rate"><button data-v="秒答">秒答</button><button data-v="想一下">想一下</button><button data-v="想很久">想很久</button><button data-v="不会">不会</button></div>${answerBlock(x[1],x[2])}</div>`).join('')}
  function openHtml(arr,title){return `<div class="mt-sub"><h4>${title}</h4>${arr.map((x,i)=>`<div class="mt-item"><b>${i+1}. ${esc(x[0])}</b><textarea rows="2" placeholder="先自己输入答案，再看参考答案"></textarea>${answerBlock(x[1])}</div>`).join('')}</div>`}
  function chooseHtml(){return `<div class="mt-sub"><h4>④ 情境选词 · 2题</h4>${test.choose.map((x,i)=>`<div class="mt-item mt-choice" data-a="${x.a}"><b>${i+1}. ${esc(x.q)}</b><div class="mt-options">${x.opts.map((o,j)=>`<button type="button" data-i="${j}">${esc(o)}</button>`).join('')}</div><div class="mt-choice-result muted"></div></div>`).join('')}</div>`}
  function inject(){
    const body=document.getElementById('dailyBody');
    const daily=document.getElementById('daily');
    if(!body||!daily?.classList.contains('active'))return;
    if(document.getElementById('todayMasteryTest'))return;
    const date=document.getElementById('dailyMeta')?.textContent.trim();
    const title=document.getElementById('dailyTitle')?.textContent||'';
    if(date!==TARGET_DATE||!title.includes('19:00'))return;
    const completion=[...body.querySelectorAll('button')].find(b=>b.textContent.includes('我学完了')||b.textContent.includes('已学完'));
    const sec=document.createElement('section');sec.id='todayMasteryTest';sec.className='dailyFixSec';
    sec.innerHTML=`<h3><span class="dailyFixNo">✓</span>当日掌握度测试 · 10–15分钟</h3>
      <div class="mt-intro">今天只测试一件事：<b>这些词你能不能主动调出来</b>。先答再看答案，不要求一次全对。</div>
      <div class="mt-sub"><h4>① 快速调用 · 5题</h4><div class="muted">看到情境后马上说答案，然后按真实情况选择：秒答 / 想一下 / 想很久 / 不会。</div>${quickHtml()}</div>
      ${openHtml(test.translate,'② 中文 → 印尼语 · 3题')}
      ${openHtml(test.build,'③ 句子重组 / 补全 · 2题')}
      ${chooseHtml()}
      ${openHtml(test.reading,'⑤ 阅读后主动回答 · 2题')}
      <div class="mt-summary"><h4>⑥ 今天的结果反馈</h4><div class="mt-feedback"><div><b>总体难度</b><div class="mt-rate" data-group="difficulty"><button data-v="太简单">太简单</button><button data-v="正好">正好</button><button data-v="有点难">有点难</button><button data-v="太难">太难</button></div></div><div><b>主动调用</b><div class="mt-rate" data-group="recall"><button data-v="大部分能秒答">大部分能秒答</button><button data-v="一半左右">一半左右</button><button data-v="很多调不出来">很多调不出来</button></div></div><label><b>今天最卡的 1–3 个词</b><input class="mt-hard" placeholder="例如：keteteran, sempetin"></label><div class="mt-score"></div></div></div>`;
    if(completion)completion.closest('div').before(sec);else body.appendChild(sec);
    bind(sec);restore(sec);
  }
  function bind(sec){
    sec.querySelectorAll('.mt-reveal').forEach(b=>b.addEventListener('click',()=>b.parentElement.classList.toggle('dailyFixOpen')));
    sec.querySelectorAll('[data-quick] .mt-rate button').forEach(b=>b.addEventListener('click',()=>{const row=b.closest('[data-quick]');row.querySelectorAll('.mt-rate button').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');const d=load();d.quick=d.quick||{};d.quick[row.dataset.quick]=b.dataset.v;save(d);updateScore(sec)}));
    sec.querySelectorAll('.mt-choice .mt-options button').forEach(b=>b.addEventListener('click',()=>{const row=b.closest('.mt-choice'),a=Number(row.dataset.a),i=Number(b.dataset.i);row.querySelectorAll('button').forEach(x=>x.disabled=true);b.classList.add(i===a?'correct':'wrong');if(i!==a)row.querySelector(`button[data-i="${a}"]`)?.classList.add('correct');row.querySelector('.mt-choice-result').textContent=i===a?'答对了。':'答错了，正确答案已标出。';const d=load();d.choice=d.choice||{};d.choice[[...sec.querySelectorAll('.mt-choice')].indexOf(row)]=i;save(d)}));
    sec.querySelectorAll('textarea').forEach((t,i)=>t.addEventListener('input',()=>{const d=load();d.text=d.text||{};d.text[i]=t.value;save(d)}));
    sec.querySelectorAll('.mt-rate[data-group] button').forEach(b=>b.addEventListener('click',()=>{const g=b.closest('[data-group]');g.querySelectorAll('button').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');const d=load();d[g.dataset.group]=b.dataset.v;save(d)}));
    sec.querySelector('.mt-hard')?.addEventListener('input',e=>{const d=load();d.hard=e.target.value;save(d)});
  }
  function restore(sec){const d=load();Object.entries(d.quick||{}).forEach(([i,v])=>sec.querySelector(`[data-quick="${i}"] .mt-rate button[data-v="${v}"]`)?.classList.add('selected'));Object.entries(d.text||{}).forEach(([i,v])=>{const t=sec.querySelectorAll('textarea')[Number(i)];if(t)t.value=v});['difficulty','recall'].forEach(g=>{if(d[g])sec.querySelector(`[data-group="${g}"] button[data-v="${d[g]}"]`)?.classList.add('selected')});if(d.hard)sec.querySelector('.mt-hard').value=d.hard;updateScore(sec)}
  function updateScore(sec){const d=load(),vals=Object.values(d.quick||{}),fast=vals.filter(v=>v==='秒答').length,ok=vals.filter(v=>v==='秒答'||v==='想一下').length;const box=sec.querySelector('.mt-score');if(!vals.length){box.textContent='完成快速调用后，这里会显示今天的主动调用情况。';return}box.innerHTML=`快速调用已完成 <b>${vals.length}/5</b> 题，其中 <b>${fast}</b> 题秒答，<b>${ok}</b> 题在“想一下”以内。`}
  if(!document.getElementById('todayMasteryStyle')){const st=document.createElement('style');st.id='todayMasteryStyle';st.textContent=`#todayMasteryTest .mt-intro{background:#f8faff;padding:12px 14px;border-radius:12px;line-height:1.7}.mt-sub{margin-top:18px}.mt-sub h4,.mt-summary h4{margin:0 0 9px;font-size:17px}.mt-item{border:1px solid var(--line);border-radius:12px;padding:12px 13px;margin-top:9px;line-height:1.65}.mt-item textarea{width:100%;border:1px solid var(--line);border-radius:9px;padding:9px 10px;margin-top:9px;font:inherit;resize:vertical}.mt-rate,.mt-options{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.mt-rate button,.mt-options button{border:1px solid var(--line);background:#fff;border-radius:9px;padding:7px 10px;cursor:pointer}.mt-rate button.selected{background:#eef3ff;color:#3157d5;border-color:#9ab0ee}.mt-options button.correct{background:#edf9f0;border-color:#74be86;color:#17652d}.mt-options button.wrong{background:#fff0ef;border-color:#dd8a83;color:#9d2f28}.mt-summary{margin-top:20px;background:#fbfcff;border:1px solid var(--line);border-radius:14px;padding:14px}.mt-feedback{display:grid;gap:13px}.mt-hard{display:block;width:100%;max-width:520px;margin-top:7px;border:1px solid var(--line);border-radius:9px;padding:9px 10px;font:inherit}.mt-score{margin-top:4px;color:#52627a}@media(max-width:650px){.mt-rate button,.mt-options button{flex:1;min-width:90px}}`;document.head.appendChild(st)}
  const body=document.getElementById('dailyBody');if(body)new MutationObserver(()=>setTimeout(inject,0)).observe(body,{childList:true,subtree:false});window.addEventListener('load',()=>setTimeout(inject,100));
})();
