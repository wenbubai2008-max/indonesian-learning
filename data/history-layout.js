(function(){
  const css=`
  .historyNav{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:2px 0 18px;padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:#fafbff}
  .historyNav button{border:0;background:#eef3ff;color:var(--blue);font-weight:800;padding:9px 12px;border-radius:10px;cursor:pointer}
  .historyNav button:disabled{opacity:.35;cursor:default}.historyDate{text-align:center}.historyDate b{display:block;font-size:17px}.historyDate span{font-size:12px;color:var(--muted)}
  .lessonSummary{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px}.lessonChip{background:#eef3ff;color:#3157d5;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:800}
  .historyNotice{background:#fff8e8;color:#805300;border:1px solid #f4ddb0;border-radius:13px;padding:12px 14px;margin-bottom:16px;font-size:13px;line-height:1.65}
  .lessonSection{border:1px solid var(--line);background:#fff;border-radius:18px;padding:18px;margin:12px 0}.lessonSection h3{margin:0 0 13px;font-size:19px}.sectionNo{display:inline-grid;place-items:center;width:29px;height:29px;border-radius:9px;background:#eef3ff;color:#3157d5;margin-right:8px;font-size:13px}
  .historyVocabGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.historyVocab{border:1px solid var(--line);border-radius:14px;padding:13px;background:#fbfcff}.historyVocab .vw{font-size:20px;font-weight:850}.historyVocab .vc{font-size:15px;margin-top:5px}.historyVocab .ve{font-size:12px;color:var(--muted);margin-top:2px}.historyVocab .vr{font-size:12px;color:#536079;margin-top:7px;line-height:1.55}
  .recoverCard{border-left:4px solid #b9c7ef;background:#f7f9ff;border-radius:12px;padding:12px 14px;margin:9px 0}.recoverCard b{display:block;margin-bottom:5px}.recoverCard div{color:var(--muted);line-height:1.65}
  .historyAnswer{display:none;background:#f6f8fc;border-radius:11px;padding:11px;margin-top:9px}.showAnswer .historyAnswer{display:block}.answerToggle{border:0;background:#eef1f6;border-radius:9px;padding:7px 10px;margin-top:9px;cursor:pointer;font-weight:700}
  @media(max-width:650px){.historyVocabGrid{grid-template-columns:1fr}.historyNav{padding:10px}.historyNav button{padding:8px 9px}.lessonSection{padding:14px}}
  `;
  const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);

  function historicalDates(){
    return (archive.dates||[]).map(x=>typeof x==='string'?{date:x}:x).filter(x=>x.am).map(x=>x.date).sort();
  }
  function navFor(d){
    const dates=historicalDates();const i=dates.indexOf(d);const prev=i>0?dates[i-1]:null;const next=i>=0&&i<dates.length-1?dates[i+1]:null;
    return `<div class="historyNav"><button ${!prev?'disabled':''} onclick="${prev?`openDaily('am','${prev}')`:''}">← 上一天</button><div class="historyDate"><b>${esc(d)}</b><span>08:00 历史课程</span></div><button ${!next?'disabled':''} onclick="${next?`openDaily('am','${next}')`:''}">下一天 →</button></div>`;
  }
  function section(no,title,body){return `<div class="lessonSection"><h3><span class="sectionNo">${String(no).padStart(2,'0')}</span>${title}</h3>${body}</div>`}
  function vocabHTML(list){
    return `<div class="historyVocabGrid">${(list||[]).map(v=>`<div class="historyVocab"><div class="vw">${esc(v.display||v.word)} <button class="sound" onclick='speak(${JSON.stringify(v.audio_text||v.word)})'>🔊</button></div><div class="vc">${esc(v.cn||'')}</div><div class="ve">${esc(v.en||'')}</div>${(v.root||v.formation||v.synonym_note)?`<div class="vr">${v.root?`词根：${esc(v.root)}<br>`:''}${esc(v.formation||'')}${v.synonym_note?`<br>${esc(v.synonym_note)}`:''}</div>`:''}</div>`).join('')}</div>`;
  }
  function recoveredHTML(list){return (list||[]).map(x=>`<div class="recoverCard"><b>${esc(x.title||x.type||'历史内容')}</b><div>${esc(x.summary||'')}</div></div>`).join('')}
  function standardSections(x){
    let n=1,h='';
    if(x.vocab?.length)h+=section(n++,'今日词汇',vocabHTML(x.vocab));
    if(x.sentences?.length)h+=section(n++,'高频句子',x.sentences.map(v=>`<div class="item"><div>${esc(v.id||v.text||'')}</div><div class="muted">${esc(v.cn||'')}</div></div>`).join(''));
    if(x.morphology?.length)h+=section(n++,'词根 / 词形训练',x.morphology.map(v=>`<div class="item">${esc(v.task||v.word||String(v))}${v.answer?`<div class="answer">${esc(v.answer)}</div>`:''}</div>`).join(''));
    if(x.reading)h+=section(n++,'阅读 · '+esc(x.reading.title||''),`<div class="reading">${esc(x.reading.text||'')}</div><div class="actions"><button class="secondary" onclick='speak(${JSON.stringify(x.reading.text||'')})'>🔊 朗读全文</button></div><div class="answer">${esc(x.reading.cn||'')}</div>`);
    if(x.quiz?.length)h+=section(n++,'今日小测',x.quiz.map((q,i)=>`<div class="item"><b>${i+1}. ${esc(q.question||'')}</b><div>${(q.options||[]).map((o,j)=>`${String.fromCharCode(65+j)}. ${esc(o)}`).join('<br>')}</div><button class="answerToggle" onclick="this.parentElement.classList.toggle('showAnswer')">查看答案</button><div class="historyAnswer">答案：${String.fromCharCode(65+(q.answer_index||0))}<br>${esc(q.explain||'')}</div></div>`).join(''));
    if(x.rewrite?.length)h+=section(n++,'造句 / 改写',x.rewrite.map(r=>`<div class="item">${esc(r.task||'')}<button class="answerToggle" onclick="this.parentElement.classList.toggle('showAnswer')">参考答案</button><div class="historyAnswer">${esc(r.reference_answer||'')}<br><span class="muted">${esc(r.reference_cn||'')}</span></div></div>`).join(''));
    if(x.dialogue?.lines)h+=section(n++,'情景对话',x.dialogue.lines.map(l=>`<div class="item"><b>${esc(l.speaker||'')}：</b>${esc(l.id||'')}<div class="muted">${esc(l.cn||'')}</div></div>`).join(''));
    if(x.output)h+=section(n++,'主动输出',`<div class="item">${esc(x.output.task||'')}<button class="answerToggle" onclick="this.parentElement.classList.toggle('showAnswer')">参考答案</button><div class="historyAnswer">${esc(x.output.reference_answer||'')}<br><span class="muted">${esc(x.output.reference_cn||'')}</span></div></div>`);
    if(x.review?.length)h+=section(n++,'今日复习',x.review.map(r=>`<div class="item">${esc(typeof r==='string'?r:(r.text||r.word||JSON.stringify(r)))}</div>`).join(''));
    if(x.recovered_sections?.length)h+=section(n++,'历史恢复内容',recoveredHTML(x.recovered_sections));
    return h;
  }
  function summaryChips(x){
    const chips=[];if(x.vocab?.length)chips.push(`词汇 ${x.vocab.length}`);if(x.sentences?.length)chips.push(`句子 ${x.sentences.length}`);if(x.reading)chips.push('阅读 1');if(x.quiz?.length)chips.push(`小测 ${x.quiz.length}`);if(x.output||x.rewrite?.length)chips.push('输出练习');if(x.recovered_sections?.length)chips.push(`恢复模块 ${x.recovered_sections.length}`);
    return `<div class="lessonSummary">${chips.map(c=>`<span class="lessonChip">${c}</span>`).join('')}</div>`;
  }

  const originalOpen=window.openDaily;
  window.openDaily=async function(s,d=TODAY){
    if(s!=='am')return originalOpen(s,d);
    go('daily');$('dailyTitle').textContent='08:00 早间学习';$('dailyMeta').textContent=d;$('dailyBody').innerHTML='<div class="loading">加载中…</div>';
    try{
      const x=await fetchJSON('data/daily/'+d+'-am.json');
      let h=navFor(d)+summaryChips(x);
      if(x.historical_reconstruction)h+=`<div class="historyNotice"><b>历史课程恢复</b><br>${esc(x.recovery_note||'该课程依据可确认的历史记录恢复。')}</div>`;
      h+=standardSections(x);
      h+=`<div class="contentSection" style="text-align:center"><button class="primary" onclick="completeSession('${d}','am')">${isDone(d,'am')?'✓ 已学完':'我学完了'}</button></div>`;
      $('dailyBody').innerHTML=h;
    }catch(e){$('dailyBody').innerHTML='<div class="error">当天内容暂未生成<div class="diag">'+esc(e.message)+'</div></div>'}
  };
})();
