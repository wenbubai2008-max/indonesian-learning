(function(){
  const style=document.createElement('style');
  style.textContent=`
    .hv-top{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;margin:0 0 12px;padding:13px;border:1px solid var(--line);border-radius:14px;background:#fafbff}
    .hv-top button{border:0;background:#eef3ff;color:var(--blue);font-weight:800;padding:9px 12px;border-radius:10px;cursor:pointer}.hv-top button:disabled{opacity:.35}
    .hv-mid{text-align:center}.hv-mid b{display:block}.hv-mid span{font-size:12px;color:var(--muted)}
    .hv-picker{display:flex;justify-content:center;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap}.hv-picker select{min-width:240px;border:1px solid var(--line);border-radius:10px;padding:9px 12px;background:#fff}
    .hv-chips{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:16px}.hv-chip{font-size:12px;font-weight:800;color:var(--blue);background:#eef3ff;border-radius:999px;padding:6px 10px}
    .hv-sec{border:1px solid var(--line);border-radius:18px;padding:18px;margin:12px 0;background:#fff}.hv-sec h3{margin:0 0 13px;font-size:19px}.hv-no{display:inline-grid;place-items:center;width:29px;height:29px;border-radius:9px;background:#eef3ff;color:var(--blue);font-size:13px;margin-right:8px}
    .hv-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.hv-vocab{border:1px solid var(--line);background:#fbfcff;border-radius:14px;padding:14px}.hv-word{font-size:20px;font-weight:850}.hv-num{font-size:12px;color:var(--muted)}.hv-cn{margin-top:5px}.hv-meta{font-size:12px;color:#59657b;line-height:1.55;margin-top:7px}.hv-ex{margin-top:10px;line-height:1.6}.hv-excn{font-size:13px;color:var(--muted);margin-top:2px}
    .hv-answer{display:none;background:#f7f8fb;border-radius:11px;padding:11px;margin-top:9px;line-height:1.65}.hv-open .hv-answer{display:block}.hv-toggle{border:0;background:#eef1f6;border-radius:9px;padding:7px 10px;margin-top:9px;font-weight:700;cursor:pointer}.hv-note{background:#fff8e8;border:1px solid #f0ddb0;color:#805300;border-radius:11px;padding:10px 12px;margin-top:8px;font-size:13px;line-height:1.6}
    @media(max-width:650px){.hv-grid{grid-template-columns:1fr}.hv-top{grid-template-columns:1fr 1fr}.hv-mid{grid-column:1/-1;grid-row:1}.hv-top button{grid-row:2}.hv-picker select{width:100%;min-width:0}}
  `;
  document.head.appendChild(style);

  function rows(){return (archive.dates||[]).map(x=>typeof x==='string'?{date:x}:x)}
  function dates(s){return rows().filter(x=>x[s]).map(x=>x.date).sort()}
  function exists(d,s){const r=rows().find(x=>x.date===d);return !!(r&&r[s])}
  function latest(s){const a=dates(s);return a.length?a[a.length-1]:null}
  function label(d){const r=rows().find(x=>x.date===d);return r&&r.day?`${d} · Day ${r.day}`:d}
  function nav(d,s){const a=dates(s),i=a.indexOf(d),p=i>0?a[i-1]:null,n=i>=0&&i<a.length-1?a[i+1]:null;return `<div class="hv-top"><button ${p?'': 'disabled'} ${p?`onclick="openDaily('${s}','${p}')"`:''}>← 上一天</button><div class="hv-mid"><b>${esc(d)}</b><span>${s==='am'?'08:00 早间课程':'19:00 晚间课程'}</span></div><button ${n?'':'disabled'} ${n?`onclick="openDaily('${s}','${n}')"`:''}>下一天 →</button></div><div class="hv-picker"><span class="muted">按日期查看</span><select onchange="openDaily('${s}',this.value)">${a.map(x=>`<option value="${x}" ${x===d?'selected':''}>${esc(label(x))}</option>`).join('')}</select></div>`}
  function sec(no,title,body){return `<div class="hv-sec"><h3><span class="hv-no">${String(no).padStart(2,'0')}</span>${title}</h3>${body}</div>`}
  function vocab(list){return `<div class="hv-grid">${(list||[]).map(v=>`<div class="hv-vocab"><div class="hv-word">${v.order?`<span class="hv-num">${v.order}. </span>`:''}${esc(v.display||v.word)} <button class="sound" onclick='speak(${JSON.stringify(v.audio_text||v.word)})'>🔊</button></div><div class="hv-cn">${esc(v.cn||'')}</div>${v.en?`<div class="muted">${esc(v.en)}</div>`:''}${(v.root||v.formation)?`<div class="hv-meta">${v.root?`词根：${esc(v.root)}<br>`:''}${esc(v.formation||'')}</div>`:''}${v.example?`<div class="hv-ex"><i>${esc(v.example)}</i></div>`:''}${v.example_cn?`<div class="hv-excn">${esc(v.example_cn)}</div>`:''}${v.source_note?`<div class="hv-meta">${esc(v.source_note)}</div>`:''}</div>`).join('')}</div>`}
  function content(x){let no=1,h='';
    if(x.vocab?.length)h+=sec(no++,'今日词汇',vocab(x.vocab));
    if(x.sentences?.length)h+=sec(no++,'高频句子',x.sentences.map(v=>`<div class="item"><b>${esc(v.id||v.text||'')}</b><div class="muted">${esc(v.cn||'')}</div></div>`).join(''));
    if(x.reading)h+=sec(no++,'阅读'+(x.reading.title?` · ${esc(x.reading.title)}`:''),`<div class="reading">${esc(x.reading.text||'')}</div><div class="actions"><button class="secondary" onclick='speak(${JSON.stringify(x.reading.text||'')})'>🔊 朗读全文</button></div><div class="answer">${esc(x.reading.cn||'')}</div>`);
    if(x.quiz?.length)h+=sec(no++,'小测',x.quiz.map((q,i)=>`<div class="item"><b>${i+1}. ${esc(q.question||'')}</b><div>${(q.options||[]).map((o,j)=>`${String.fromCharCode(65+j)}. ${esc(o)}`).join('<br>')}</div>${q.answer_unavailable?`<div class="hv-note">原始历史消息当时明确写着“先别看答案”，这条记录没有提供答案，因此网站不补写。</div>`:`<button class="hv-toggle" onclick="this.parentElement.classList.toggle('hv-open')">查看答案</button><div class="hv-answer"><b>答案：${String.fromCharCode(65+(q.answer_index||0))}</b><br>${esc(q.explain||'')}</div>`}</div>`).join(''));
    if(x.output)h+=sec(no++,'主动输出',`<div class="item">${esc(x.output.task||'')}${x.output.reference_unavailable?`<div class="hv-note">${esc(x.output.source_note||'原始历史消息未提供参考答案。')}</div>`:`<br><button class="hv-toggle" onclick="this.parentElement.classList.toggle('hv-open')">参考答案</button><div class="hv-answer"><b>自然口语</b><br>${esc(x.output.reference_answer||'')}<br><span class="muted">${esc(x.output.reference_cn||'')}</span>${x.output.standard_answer?`<br><br><b>标准版</b><br>${esc(x.output.standard_answer)}`:''}</div>`}</div>`);
    if(x.focus?.items?.length)h+=sec(no++,(x.focus.title||'今日重点'),x.focus.items.map(r=>`<div class="item">${esc(r)}</div>`).join(''));
    if(x.review?.length)h+=sec(no++,'复习',x.review.map(r=>`<div class="item">${esc(typeof r==='string'?r:(r.text||r.word||''))}</div>`).join(''));
    if(x.recovered_sections?.length)h+=sec(no++,'历史恢复摘要',x.recovered_sections.map(r=>`<div class="item"><b>${esc(r.title||'')}</b><div class="muted">${esc(r.summary||'')}</div></div>`).join(''));
    return h;
  }
  function chips(x){const a=[];if(x.progress){a.push(`今日新增 ${x.progress.new}`);a.push(`累计 ${x.progress.cumulative}`);if(x.progress.range)a.push(`编号 ${x.progress.range}`)}else if(x.new_vocab_count!=null){a.push(`今日新增 ${x.new_vocab_count}`);if(x.cumulative_vocab_count!=null)a.push(`累计 ${x.cumulative_vocab_count}`)}if(x.vocab?.length)a.push(`词汇 ${x.vocab.length}`);if(x.sentences?.length)a.push(`句子 ${x.sentences.length}`);if(x.reading)a.push('阅读 1');if(x.quiz?.length)a.push(`小测 ${x.quiz.length}`);if(x.output)a.push('输出 1');return `<div class="hv-chips">${a.map(t=>`<span class="hv-chip">${esc(t)}</span>`).join('')}</div>`}

  const previous=window.openDaily;
  window.openDaily=async function(s,d){
    if(!d||!exists(d,s))d=latest(s);
    if(!d){go('daily');$('dailyBody').innerHTML='<div class="empty">暂无课程</div>';return}
    if(s!=='am')return previous(s,d);
    go('daily');$('dailyBody').innerHTML='<div class="loading">加载中…</div>';
    try{const x=await fetchJSON(`data/daily/${d}-am.json`);$('dailyTitle').textContent=x.title||'08:00 早间学习';$('dailyMeta').textContent=d;let h=nav(d,'am')+chips(x);if(x.historical_reconstruction&&x.recovery_note)h+=`<div class="historyNotice">${esc(x.recovery_note)}</div>`;h+=content(x);h+=`<div style="text-align:center;margin-top:18px"><button class="primary" onclick="completeSession('${d}','am')">${isDone(d,'am')?'✓ 已学完':'我学完了'}</button></div>`;$('dailyBody').innerHTML=h}catch(e){$('dailyBody').innerHTML=`<div class="error">课程读取失败<div class="diag">${esc(e.message)}</div></div>`}
  };
})();
