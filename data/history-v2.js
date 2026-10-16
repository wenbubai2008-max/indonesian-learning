(function(){
  const css=`
    .app.learningMode>.stats{display:none!important}
    .dailyFixNav{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;margin:0 0 12px;padding:13px;border:1px solid var(--line);border-radius:14px;background:#fafbff}
    .dailyFixNav button{border:0;background:#eef3ff;color:var(--blue);font-weight:800;padding:9px 12px;border-radius:10px;cursor:pointer}.dailyFixNav button:disabled{opacity:.35}.dailyFixMid{text-align:center}.dailyFixMid b{display:block}.dailyFixMid span{font-size:12px;color:var(--muted)}
    .dailyFixPicker{display:flex;justify-content:center;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap}.dailyFixPicker select{min-width:240px;border:1px solid var(--line);border-radius:10px;padding:9px 12px;background:#fff}
    .dailyFixChips{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:16px}.dailyFixChip{font-size:12px;font-weight:800;color:var(--blue);background:#eef3ff;border-radius:999px;padding:6px 10px}
    .dailyFixSec{border:1px solid var(--line);border-radius:18px;padding:18px;margin:12px 0;background:#fff}.dailyFixSec h3{margin:0 0 13px;font-size:19px}.dailyFixNo{display:inline-grid;place-items:center;width:29px;height:29px;border-radius:9px;background:#eef3ff;color:var(--blue);font-size:13px;margin-right:8px}
    .dailyFixGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.dailyFixVocab{border:1px solid var(--line);background:#fbfcff;border-radius:14px;padding:14px;text-align:left}.dailyFixWord{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:20px;font-weight:850;color:#202b42}.dailyFixNum{font-size:14px;color:#4e6fca;font-weight:850}.dailyFixCn{margin-top:7px;color:#334155;font-weight:700}.dailyFixEn{font-size:13px;color:#7a8496;margin-top:2px}.dailyFixMeta{font-size:12px;color:#52627a;line-height:1.65;margin-top:7px}.dailyFixEx{margin-top:11px;line-height:1.7;color:#315b93}.dailyFixExCn{font-size:13px;color:#7b6757;margin-top:3px;line-height:1.6}
    .rvItem .rvTitle{font-weight:800;color:#1f2a44;margin-bottom:4px}.rvItem .rvLine{padding:5px 0;color:#475467}.rvItem .rvLine+.rvLine{border-top:1px dashed #e6eaf1}.rvItem .rvId{color:#1e3a8a;font-weight:650}.rvItem .rvVs{color:#98a2b3;font-size:.82em;margin:0 5px;font-weight:600}.rvItem .rvChips{display:flex;flex-wrap:wrap;gap:6px;margin-top:5px}.rvItem .rvChip{background:#f2f5fb;border:1px solid #e3e8f1;border-radius:8px;padding:1px 9px;color:#344054}
    .rcBlock{text-align:left;border:1px solid var(--line);border-radius:13px;padding:12px 13px;margin-bottom:9px}.rcBlock>h4{margin:0 0 8px;font-size:15px;color:#1f2a44}.rcHint{font-size:13px;color:#667085;margin:-2px 0 8px}
    .rcGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}@media(min-width:640px){.rcGrid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(min-width:900px){.rcGrid{grid-template-columns:repeat(4,minmax(0,1fr))}}
    .rcCard{border:1px solid #e3e8f0;border-radius:10px;background:#fbfcfe;padding:9px 8px;text-align:center;cursor:pointer;min-width:0;font:inherit;color:#344054}.rcCard .rcCn{font-weight:650;font-size:14px;line-height:1.35}.rcCard .rcAns{display:none;margin-top:5px;color:#1e3a8a;font-weight:700;overflow-wrap:anywhere}.rcCard.open .rcAns{display:block}.rcCard .rcTap{display:block;margin-top:4px;font-size:11px;color:#98a2b3}.rcCard.open .rcTap{display:none}
    .rcFrames{margin-top:8px;font-size:14px;color:#475467}.rcFrames span{display:inline-block;background:#f2f5fb;border-radius:8px;padding:2px 9px;margin:3px 5px 0 0;color:#1e3a8a;font-weight:600}
    .rcPair{border-top:1px dashed #e6eaf1;padding:8px 0}.rcPair:first-of-type{border-top:0;padding-top:0}.rcWords{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 6px}.rcWords b{color:#1e3a8a}.rcWords small{color:#667085}.rcWords i{font-style:normal;color:#98a2b3;font-size:12px;margin:0 2px}.rcNote{font-size:13.5px;color:#475467;margin-top:3px}
    .rcApply{border-top:1px dashed #e6eaf1;padding:8px 0}.rcApply:first-of-type{border-top:0;padding-top:0}.rcApply>div:first-child b{color:#1e3a8a;font-size:16px}.rcApply>div:first-child span{color:#667085;font-size:13.5px;margin-left:6px}.rcEx{margin-top:5px}.rcEx .rcId{color:#1f2a44;font-weight:600}.rcEx .rcExCn{color:#7b6757;font-size:13.5px}.rcSay{border:0;background:none;cursor:pointer;font-size:14px;padding:0 3px}
    .dailyFixItem{text-align:left;border:1px solid var(--line);border-radius:13px;padding:13px;margin-bottom:9px;line-height:1.75}.dailyFixId{color:#284f83;font-weight:700}.dailyFixCnLine{color:#7b6757;margin-top:4px}.dailyFixReading{text-align:left!important;color:#26364f;background:#f7faff;border-left:4px solid #91ace8;border-radius:12px;padding:16px;line-height:1.9}.dailyFixTranslation{text-align:left;color:#6f5a48;background:#fffaf4;border-radius:11px;padding:13px;margin-top:10px;line-height:1.75}.dailyFixActions{display:flex;justify-content:flex-start;margin-top:10px}
    .dailyFixChoiceWrap{display:grid;gap:9px;margin-top:12px}.dailyFixChoice{width:100%;border:1px solid #dce3ef;background:#fff;border-radius:11px;padding:11px 13px;text-align:left;cursor:pointer;color:#3b465b;font-weight:650}.dailyFixChoice.correct{background:#edf9f0;border-color:#74be86;color:#17652d}.dailyFixChoice.wrong{background:#fff0ef;border-color:#dd8a83;color:#9d2f28}.dailyFixChoice:disabled{opacity:1;cursor:default}.dailyFixFeedback{display:none;margin-top:10px;padding:10px 12px;border-radius:10px;background:#f5f7fb;color:#586579;font-size:13px;line-height:1.6}.dailyFixFeedback.show{display:block}
    .dailyFixAnswer{display:none;background:#f7f8fb;border-radius:11px;padding:11px;margin-top:9px;line-height:1.65;text-align:left}.dailyFixOpen .dailyFixAnswer{display:block}.dailyFixToggle{border:0;background:#eef1f6;border-radius:9px;padding:7px 10px;margin-top:9px;font-weight:700;cursor:pointer}
    @media(max-width:650px){.dailyFixGrid{grid-template-columns:1fr}.dailyFixNav{grid-template-columns:1fr 1fr}.dailyFixMid{grid-column:1/-1;grid-row:1}.dailyFixNav button{grid-row:2}.dailyFixPicker select{width:100%;min-width:0}.dailyFixSec{padding:14px}.dailyFixVocab{padding:13px}.dailyFixReading{padding:13px}}
  `;
  const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);

  const PM_SWITCH_DATE='2026-09-16';
  function pmTimeForDate(d){return String(d||'')>=PM_SWITCH_DATE?'18:00':'19:00';}

  const baseGo=window.go;
  window.go=function(id){const app=document.querySelector('.app');if(app)app.classList.toggle('learningMode',id==='daily');return baseGo(id)};

  function esc2(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]))}
  function rows(){return (archive.dates||[]).map(x=>typeof x==='string'?{date:x}:x)}
  function dates(s){return rows().filter(x=>x[s]).map(x=>x.date).sort()}
  function exists(d,s){const r=rows().find(x=>x.date===d);return !!(r&&r[s])}
  function latest(s){const a=dates(s);return a.length?a[a.length-1]:null}
  function dayOf(d,s){const r=rows().find(x=>x.date===d);return r?(r[s+'_day']??r.day):null}
  function titleLabel(d,s){const day=dayOf(d,s);return day?d+' · Day '+day:d}
  function nav(d,s){const a=dates(s),i=a.indexOf(d),p=i>0?a[i-1]:null,n=i>=0&&i<a.length-1?a[i+1]:null;return `<div class="dailyFixNav"><button ${p?'':'disabled'} ${p?`onclick="openDaily('${s}','${p}')"`:''}>← 上一天</button><div class="dailyFixMid"><b>${esc2(d)}</b><span>${s==='am'?'08:00 早间学习':pmTimeForDate(d)+' 晚间学习'}</span></div><button ${n?'':'disabled'} ${n?`onclick="openDaily('${s}','${n}')"`:''}>下一天 →</button></div><div class="dailyFixPicker"><span class="muted">按日期查看</span><select onchange="openDaily('${s}',this.value)">${a.map(x=>`<option value="${x}" ${x===d?'selected':''}>${esc2(titleLabel(x,s))}</option>`).join('')}</select></div>`}
  function chips(x){const a=[];if(x.day)a.push('Day '+x.day);a.push(x.session==='pm'?pmTimeForDate(x.date)+' 晚间学习':'08:00 早间学习');if(x.vocab?.length)a.push('词汇 '+x.vocab.length);if(x.sentences?.length)a.push('句子 '+x.sentences.length);if(x.reading)a.push('阅读 1');if(x.quiz?.length)a.push('小测 '+x.quiz.length);return `<div class="dailyFixChips">${a.map(t=>`<span class="dailyFixChip">${esc2(t)}</span>`).join('')}</div>`}
  function sec(no,title,body){return `<div class="dailyFixSec"><h3><span class="dailyFixNo">${String(no).padStart(2,'0')}</span>${esc2(title)}</h3>${body}</div>`}
  // 2026-10-16 (user-approved): review points are long single strings. Display only, never guesses answers:
  // "标题：" becomes a heading, top-level "；" starts a new line, a "——" lead-in followed by a short 、-list becomes
  // chips, Indonesian runs are highlighted and "vs" is set apart. Text content is unchanged.
  function rvSplit(t){const out=[];let depth=0,cur='';for(const ch of t){if('（(“"'.includes(ch)&&!(ch==='"'&&depth))depth++;else if('）)”'.includes(ch)||(ch==='"'&&depth))depth=Math.max(0,depth-1);if((ch==='；'||ch===';')&&!depth){if(cur.trim())out.push(cur.trim());cur='';}else cur+=ch;}if(cur.trim())out.push(cur.trim());return out;}
  function rvInline(t){
    return String(t).split(/\s*\bvs\.?\s+/).map(part=>{
      const re=/[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ0-9'’\-]*(?:[ ,]+[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ0-9'’\-]*)*[.!?…]*/g;let h='',last=0,m;
      while((m=re.exec(part))){h+=esc2(part.slice(last,m.index))+'<span class="rvId">'+esc2(m[0])+'</span>';last=m.index+m[0].length;}
      return h+esc2(part.slice(last));
    }).join('<span class="rvVs">vs</span>');
  }
  function rvLine(t){
    const k=t.indexOf('——');
    if(k>0){const items=t.slice(k+2).split('、').map(x=>x.trim()).filter(Boolean);
      if(items.length>=3&&items.every(x=>x.length<=14))return '<div class="rvLine">'+rvInline(t.slice(0,k))+'<div class="rvChips">'+items.map(x=>'<span class="rvChip">'+rvInline(x)+'</span>').join('')+'</div></div>';}
    return '<div class="rvLine">'+rvInline(t)+'</div>';
  }
  // 2026-10-16 (user-approved): optional structured review (lesson.review_cards). Recall cards show Chinese and reveal the
  // Indonesian answer on tap (no storage, no scoring); contrast groups and usage examples are laid out per word. Items
  // missing a field are skipped; with nothing usable the page falls back to the three review strings.
  function reviewCardsHtml(rc,vocab){
    if(!rc||typeof rc!=='object'||Array.isArray(rc))return '';
    const ok=x=>x&&typeof x.id==='string'&&x.id.trim()&&typeof x.cn==='string'&&x.cn.trim(),say=t=>'<button type="button" class="rcSay" data-rc-say="'+esc2(displayText(t,vocab))+'" aria-label="发音">🔊</button>';
    const recall=(Array.isArray(rc.recall)?rc.recall:[]).filter(ok),frames=(Array.isArray(rc.frames)?rc.frames:[]).filter(x=>typeof x==='string'&&x.trim());
    const groups=(Array.isArray(rc.contrasts)?rc.contrasts:[]).map(g=>({items:(g&&Array.isArray(g.items)?g.items:[]).filter(ok),note:g&&typeof g.note==='string'?g.note:''})).filter(g=>g.items.length>=2);
    const apply=(Array.isArray(rc.apply)?rc.apply:[]).filter(a=>a&&typeof a.word==='string'&&a.word.trim()).map(a=>({word:a.word,usage:typeof a.usage==='string'?a.usage:'',ex:(Array.isArray(a.examples)?a.examples:[]).filter(ok)})).filter(a=>a.ex.length);
    if(!recall.length&&!groups.length&&!apply.length)return '';
    let h='';
    if(recall.length)h+='<div class="rcBlock"><h4>3 秒主动提取</h4><div class="rcHint">看中文，先在心里说出印尼语，再点卡片看答案。</div><div class="rcGrid">'+recall.map(x=>'<div class="rcCard" role="button" tabindex="0" data-rc-card><div class="rcCn">'+esc2(x.cn)+'</div><div class="rcAns">'+esc2(displayText(x.id,vocab))+' '+say(x.id)+'</div><span class="rcTap">点开看答案</span></div>').join('')+'</div>'+(frames.length?'<div class="rcFrames">再各补半句：'+frames.map(f=>'<span>'+esc2(displayText(f,vocab))+'</span>').join('')+'</div>':'')+'</div>';
    if(groups.length)h+='<div class="rcBlock"><h4>易混词与搭配</h4>'+groups.map(g=>'<div class="rcPair"><div class="rcWords">'+g.items.map(x=>'<span><b>'+esc2(displayText(x.id,vocab))+'</b> <small>'+esc2(x.cn)+'</small></span>').join('<i>vs</i>')+'</div>'+(g.note?'<div class="rcNote">'+esc2(g.note)+'</div>':'')+'</div>').join('')+'</div>';
    if(apply.length)h+='<div class="rcBlock"><h4>重点复习词应用</h4>'+apply.map(a=>'<div class="rcApply"><div><b>'+esc2(displayText(a.word,vocab))+'</b>'+(a.usage?'<span>'+esc2(a.usage)+'</span>':'')+'</div>'+a.ex.map(e=>'<div class="rcEx"><span class="rcId">'+esc2(displayText(e.id,vocab))+'</span>'+say(e.id)+'<div class="rcExCn">'+esc2(e.cn)+'</div></div>').join('')+'</div>').join('')+'</div>';
    return h;
  }
  if(!window.__rcBound){window.__rcBound=true;document.addEventListener('click',e=>{
    const sayBtn=e.target.closest&&e.target.closest('[data-rc-say]');if(sayBtn){e.stopPropagation();try{window.speak&&window.speak(sayBtn.dataset.rcSay)}catch(err){}return}
    const card=e.target.closest&&e.target.closest('[data-rc-card]');if(card)card.classList.toggle('open');
  });}
  window.reviewReadableHtml=function(raw,vocab){
    const text=displayText(String(raw||''),vocab),m=text.match(/^([^：:\n]{2,26})[：:]\s*([\s\S]+)$/);
    const title=m?m[1]:'',body=m?m[2]:text,lines=rvSplit(body);
    return '<div class="dailyFixItem rvItem">'+(title?'<div class="rvTitle">'+rvInline(title)+'</div>':'')+lines.map(rvLine).join('')+'</div>';
  };
  function displayText(text,list){let out=String(text??'');const map={pantes:'pantés',ngaret:'ngarét',beres:'bérés',ngerepotin:'ngerépotin',rekening:'rékening',hemat:'hémat'};(list||[]).forEach(v=>{if(v.word&&v.display)map[String(v.word).toLowerCase()]=v.display});Object.keys(map).sort((a,b)=>b.length-a.length).forEach(k=>{const re=new RegExp('(^|[^A-Za-zÀ-ÿ])('+k+')(?=$|[^A-Za-zÀ-ÿ])','gi');out=out.replace(re,(m,p,w)=>p+(w[0]===w[0].toUpperCase()?map[k][0].toUpperCase()+map[k].slice(1):map[k]))});return out}
  function vocabHtml(list){return `<div class="dailyFixGrid">${(list||[]).map((v,i)=>`<div class="dailyFixVocab"><div class="dailyFixWord"><span class="dailyFixNum">${esc2(v.order??(i+1))}.</span><span>${esc2(v.display||v.word)}</span><button class="sound" onclick='speak(${JSON.stringify(v.audio_text||v.word)})'>🔊</button></div><div class="dailyFixCn">${esc2(v.cn||'')}</div>${v.en?`<div class="dailyFixEn">${esc2(v.en)}</div>`:''}${(v.root||v.formation)?`<div class="dailyFixMeta">${v.root?`词根：${esc2(v.root)}${v.root_cn?`（${esc2(v.root_cn)}）`:''}<br>`:''}${esc2(v.formation||'')}</div>`:''}${v.synonym_note?`<div class="dailyFixMeta">辨析：${esc2(v.synonym_note)}</div>`:''}${v.example?`<div class="dailyFixEx">${esc2(displayText(v.example,list))}</div>`:''}${v.example_cn?`<div class="dailyFixExCn">${esc2(v.example_cn)}</div>`:''}</div>`).join('')}</div>`}
  window.dailyFixGrade=function(btn,correct,explain){const box=btn.closest('.dailyFixItem');if(!box||box.dataset.done==='1')return;box.dataset.done='1';const all=[...box.querySelectorAll('.dailyFixChoice')];all.forEach(b=>b.disabled=true);if(correct)btn.classList.add('correct');else{btn.classList.add('wrong');const right=box.querySelector('[data-correct="1"]');if(right)right.classList.add('correct')}const fb=box.querySelector('.dailyFixFeedback');if(fb){fb.textContent=(correct?'答对了。':'答错了。')+(explain||'');fb.classList.add('show')}};
  function quizHtml(q,i,list){if(q.answer_unavailable)return `<div class="dailyFixItem"><b>${i+1}. ${esc2(displayText(q.question||'',list))}</b><div class="dailyFixMeta">原始记录未提供答案</div></div>`;const opts=q.options||[];return `<div class="dailyFixItem"><b>${i+1}. ${esc2(displayText(q.question||'',list))}</b><div class="dailyFixChoiceWrap">${opts.map((o,j)=>`<button class="dailyFixChoice" data-correct="${j===q.answer_index?1:0}" onclick='dailyFixGrade(this,${j===q.answer_index},${JSON.stringify(q.explain||'')})'>${String.fromCharCode(65+j)}. ${esc2(displayText(o,list))}</button>`).join('')}</div><div class="dailyFixFeedback"></div></div>`}
  function outputHtml(o,list){if(!o)return '';if(o.reference_unavailable)return `<div class="dailyFixItem">${esc2(o.task||'')}<div class="dailyFixMeta">原记录未提供参考答案</div></div>`;return `<div class="dailyFixItem">${esc2(o.task||'')}<br><button class="dailyFixToggle" onclick="this.parentElement.classList.toggle('dailyFixOpen')">参考答案</button><div class="dailyFixAnswer"><div class="dailyFixId">${esc2(displayText(o.reference_answer||'',list))}</div>${o.reference_cn?`<div class="dailyFixCnLine">${esc2(o.reference_cn)}</div>`:''}${o.standard_answer?`<br><b>标准版</b><br>${esc2(o.standard_answer)}`:''}</div></div>`}
  function content(x){let no=1,h='';if(x.vocab?.length)h+=sec(no++,'今日词汇',vocabHtml(x.vocab));if(x.sentences?.length)h+=sec(no++,'高频句子',x.sentences.map(v=>`<div class="dailyFixItem"><div class="dailyFixId">${esc2(displayText(v.id||v.text||'',x.vocab))}</div><div class="dailyFixCnLine">${esc2(v.cn||'')}</div></div>`).join(''));if(x.reading)h+=sec(no++,'阅读'+(x.reading.title?' · '+x.reading.title:''),`<div class="dailyFixReading">${esc2(displayText(x.reading.text||'',x.vocab)).replace(/\n/g,'<br>')}</div><div class="dailyFixActions"><button class="secondary" onclick='speak(${JSON.stringify(x.reading.text||'')})'>🔊 朗读全文</button></div><div class="dailyFixTranslation">${esc2(x.reading.cn||'').replace(/\n/g,'<br>')}</div>`);if(x.quiz?.length)h+=sec(no++,'小测',x.quiz.map((q,i)=>quizHtml(q,i,x.vocab)).join(''));if(x.output)h+=sec(no++,'主动输出',outputHtml(x.output,x.vocab));{const rc=reviewCardsHtml(x.review_cards,x.vocab);if(rc)h+=sec(no++,'复习',rc);else if(x.review?.length)h+=sec(no++,'复习',x.review.map(r=>window.reviewReadableHtml(typeof r==='string'?r:(r.text||''),x.vocab)).join(''));}if(x.dialogue?.lines)h+=sec(no++,x.dialogue.title||'情景对话',x.dialogue.lines.map(l=>`<div class="dailyFixItem"><div class="dailyFixId"><b>${esc2(l.speaker||'')}</b>${l.speaker?': ':''}${esc2(displayText(l.id||'',x.vocab))}</div><div class="dailyFixCnLine">${esc2(l.cn||'')}</div></div>`).join(''));return h}
  // One-day side-by-side classroom. The official AM stays the single index/runtime source.
  const COMPARE_DATE='2026-10-02';
  const COMPARE_FILE='data/comparison/2026-10-02-am-chatgpt.json';
  const COMPARE_DONE='done_2026-10-02_am_chatgpt';
  function comparisonTabs(extra){
    return `<div class="dailyFixPicker" role="group" aria-label="10月2日两份早课对照">
      <button type="button" class="${extra?'secondary':'primary'}" onclick="openDaily('am','2026-10-02')">备用 V2 · 正式早课</button>
      <button type="button" class="${extra?'primary':'secondary'}" onclick="openDailyCompare()">ChatGPT · 临时加课</button>
    </div>`;
  }
  window.openDailyCompare=async function(){
    go('daily');
    $('dailyTitle').textContent='08:00 早课｜ChatGPT 对照版';
    $('dailyMeta').textContent=COMPARE_DATE;
    $('dailyBody').innerHTML='<div class="loading">加载对照课…</div>';
    try{
      const x=await fetchJSON(COMPARE_FILE);
      if(x.date!==COMPARE_DATE||x.session!=='am'||x.vocab?.length!==10)throw Error('对照课身份或词卡不完整');
      const done=localStorage.getItem(COMPARE_DONE)==='1';
      let h=nav(COMPARE_DATE,'am')+comparisonTabs(true)+
        '<div class="historyNotice">这是10月2日临时 ChatGPT 对照课：与正式课共用网站的词卡、朗读、阅读和小测展示，完成记录单独保存。正式 AM 仍为备用 V2；本加课不改动 daily-vocab、runtime 或18:00选词。</div>'+
        chips(x)+content(x);
      h+=`<div style="text-align:center;margin-top:18px"><button type="button" class="primary" onclick="completeComparisonAm()" ${done?'disabled':''}>${done?'✓ 对照课已学完':'我学完了 · ChatGPT 对照课'}</button></div>`;
      $('dailyBody').innerHTML=h;
    }catch(e){$('dailyBody').innerHTML=`<div class="error">对照课程读取失败<div class="diag">${esc2(e.message)}</div></div>`;}
  };
  window.completeComparisonAm=function(){
    localStorage.setItem(COMPARE_DONE,'1');
    window.openDailyCompare();
  };
  async function refreshDailyArchiveOnOpen(){try{archive=await fetchJSON('data/daily/index.json');if(typeof updateHome==='function')updateHome();return true}catch(e){return false}}
  window.openDaily=async function(s,d){const app=document.querySelector('.app');if(app)app.classList.add('learningMode');if(!d||d===TODAY){await refreshDailyArchiveOnOpen();d=exists(TODAY,s)?TODAY:latest(s)}else if(!exists(d,s))d=latest(s);if(!d){go('daily');$('dailyBody').innerHTML='<div class="empty">暂无课程</div>';return}go('daily');$('dailyBody').innerHTML='<div class="loading">加载中…</div>';try{const x=await fetchJSON(`data/daily/${d}-${s}.json`);$('dailyTitle').textContent=x.title||(s==='am'?'08:00 早间学习':pmTimeForDate(d)+' 晚间学习');$('dailyMeta').textContent=d;let h=nav(d,s)+(s==='am'&&d===COMPARE_DATE?comparisonTabs(false):'')+chips(x);if(x.source_note)h+=`<div class="historyNotice">${esc2(x.source_note)}</div>`;if(x.history_complete===false||x.historical_reconstruction)h+=`<div class="historyNotice">历史记录不完整：仅展示可确认的原始内容。</div>`;h+=content(x);h+=`<div style="text-align:center;margin-top:18px"><button class="primary" onclick="completeSession('${d}','${s}')">${isDone(d,s)?'✓ 已学完':'我学完了'}</button></div>`;$('dailyBody').innerHTML=h}catch(e){$('dailyBody').innerHTML=`<div class="error">课程读取失败<div class="diag">${esc2(e.message)}</div></div>`}}
})();
