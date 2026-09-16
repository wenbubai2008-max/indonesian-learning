(function(){
  const base=window.openDaily;if(typeof base!=='function')return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=s=>String(s||'').toLowerCase().trim().replace(/[.,!?;:，。！？；：]/g,'').replace(/\s+/g,' ');

  if(!document.getElementById('dailyLightPatchStyle')){
    const st=document.createElement('style');
    st.id='dailyLightPatchStyle';
    st.textContent='.dailyAmTaught{display:block;margin:0 0 6px;color:#3157d5;font-weight:800}.dailyLightToken{width:auto!important;min-width:72px!important}.dailyLightOrderOut{display:flex;gap:7px;flex-wrap:wrap;align-items:center}.dailyLightExtra .dailyFixAnswer{margin-top:8px}.dailyLightSelf{margin-top:12px;padding:10px 12px;background:#f8faff;border-radius:10px}.dailyLightSelf ul{margin:7px 0 0;padding-left:20px}.dailyLightSelf li{margin:4px 0}';
    document.head.appendChild(st);
  }

  function sec(title,body,extraClass=''){return `<div class="dailyFixSec ${extraClass}"><h3><span class="dailyFixNo">✓</span>${esc(title)}</h3>${body}</div>`}
  function choiceAnswerIndex(it){
    if(Number.isInteger(it.answer_index)&&it.answer_index>=0&&it.answer_index<(it.options||[]).length)return it.answer_index;
    if(it.answer!=null){const a=norm(it.answer),idx=(it.options||[]).findIndex(o=>norm(o)===a);if(idx>=0)return idx;}
    return -1;
  }
  function choice(it,i){const ai=choiceAnswerIndex(it);return `<div class="dailyFixItem"><b>${i+1}. ${esc(it.prompt||'')}</b><div class="dailyFixChoiceWrap">${(it.options||[]).map((o,j)=>`<button class="dailyFixChoice" data-correct="${j===ai?1:0}" onclick='dailyLightChoice(this,${j===ai},${JSON.stringify(it.explain||'')})'>${String.fromCharCode(65+j)}. ${esc(o)}</button>`).join('')}</div><div class="dailyFixFeedback"></div></div>`}

  const fillHintFallback={
    'aku ___ waktu sebentar buat cek arahnya':'需要',
    'jangan sampai ___ emosi waktu bicara':'被情绪带着走'
  };
  function fillHint(it){
    const explicit=String(it.hint_cn||'').trim();
    if(explicit)return explicit;
    const p=String(it.prompt||'').trim();
    const pm=p.match(/[（(]([^（）()]+)[）)]\s*$/);if(pm&&pm[1])return pm[1].trim();
    const ex=String(it.explain||'').trim();
    const m=ex.match(/=\s*([^。；;]+)[。；;]?$/);if(m&&m[1])return m[1].trim();
    return fillHintFallback[norm(p)]||'';
  }
  function fillPrompt(it){
    const p=String(it.prompt||'').trim(),hint=fillHint(it);
    if(/^填空\s*[：:]/.test(p))return p;
    return `填空： ${p}${hint?`（${hint}）`:''}`;
  }
  function fill(it,i){
    return `<div class="dailyFixItem"><b>${i+1}. ${esc(fillPrompt(it))}</b><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><input class="dailyLightFill" autocomplete="off" style="flex:1;min-width:180px;border:1px solid #dce3ef;border-radius:10px;padding:9px 11px" placeholder="只补一个词或短词块"><button class="dailyFixToggle" style="margin-top:0" onclick='dailyLightFillCheck(this,${JSON.stringify(it.answer||'')},${JSON.stringify(it.answer_cn||'')})'>检查</button></div><div class="dailyFixFeedback"></div></div>`;
  }

  function shuffleTokens(tokens){
    const src=(tokens||[]).slice(),out=src.slice();
    for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}
    if(out.length>1&&out.every((x,i)=>x===src[i]))[out[0],out[1]]=[out[1],out[0]];
    return out;
  }
  function orderTokens(it){
    if(Array.isArray(it.tokens)&&it.tokens.length)return it.tokens.map(x=>String(x).trim()).filter(Boolean);
    const p=String(it.prompt||'').trim();
    let tail=p;
    if(p.includes('：'))tail=p.split('：').slice(1).join('：');
    else if(p.includes(':'))tail=p.split(':').slice(1).join(':');
    if(tail.includes('/'))return tail.split('/').map(x=>x.trim()).filter(Boolean);
    return [];
  }
  const orderCnFallback={'sebaiknya kita cek arah lagi dulu':'我们最好先再确认一下方向。'};
  function orderCn(it){const explicit=String(it.answer_cn||'').trim();if(explicit)return explicit;return orderCnFallback[norm(it.answer||'')]||'';}
  function tokenButtons(tokens){return shuffleTokens(tokens).map(t=>`<button type="button" class="dailyFixChoice dailyLightToken" data-token="${esc(t)}" onclick="dailyLightPick(this)">${esc(t)}</button>`).join('')}
  function orderPrompt(it){
    const p=String(it.prompt||'').trim();
    if(/按照中文|根据中文/.test(p)&&!p.includes('/'))return p;
    const cn=orderCn(it);
    return cn?`按照中文排成自然的印尼语句子：${cn}`:'按照中文排成自然的印尼语句子';
  }
  function order(it,i){
    const tokens=orderTokens(it),cn=orderCn(it);
    return `<div class="dailyFixItem dailyLightOrder" data-order="[]"><b>${i+1}. ${esc(orderPrompt(it))}</b><div class="dailyLightTokenWrap" data-tokens='${esc(JSON.stringify(tokens))}' style="display:flex;gap:7px;flex-wrap:wrap;margin-top:10px">${tokenButtons(tokens)}</div><div class="dailyLightOrderOut" style="min-height:42px;margin-top:10px;padding:9px 11px;background:#f8faff;border-radius:9px"></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="dailyFixToggle" onclick='dailyLightOrderCheck(this,${JSON.stringify(it.answer||'')},${JSON.stringify(cn)})'>检查顺序</button><button type="button" class="dailyFixToggle" onclick="dailyLightOrderReset(this)">重排</button></div><div class="dailyFixFeedback"></div></div>`;
  }

  function selfCheckHtml(items){
    if(!Array.isArray(items)||!items.length)return '';
    return `<div class="dailyLightSelf"><b>自检</b><ul>${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`;
  }
  function renderTest(t,x){
    let h='<div class="dailyFixMeta" style="margin-bottom:10px">轻量检测今天刚学的内容，不追求全对，也不用写长句。</div>';
    (t.items||[]).forEach((it,i)=>{if(it.type==='choice')h+=choice(it,i);else if(it.type==='fill')h+=fill(it,i);else if(it.type==='order')h+=order(it,i)});
    h+=selfCheckHtml(t.self_check,x);
    return sec(t.title||'当日小测 · 5–8分钟',h,'dailyLightTest');
  }

  function taskHtml(it,i){
    const task=it.task||it.prompt||'';
    const ans=it.reference_answer||it.answer||'';
    const cn=it.reference_cn||it.answer_cn||'';
    return `<div class="dailyFixItem"><b>${i+1}. ${esc(task)}</b>${ans?`<br><button class="dailyFixToggle" onclick="this.parentElement.classList.toggle('dailyFixOpen')">参考答案</button><div class="dailyFixAnswer"><div class="dailyFixId">${esc(ans)}</div>${cn?`<div class="dailyFixCnLine">${esc(cn)}</div>`:''}</div>`:''}</div>`;
  }
  function rewriteHtml(x){
    if(!Array.isArray(x.rewrite)||!x.rewrite.length)return '';
    return sec('主动改写 · 应用练习',x.rewrite.map(taskHtml).join(''),'dailyLightExtra dailyRewritePatch');
  }
  function finalReviewHtml(x){
    if(!x.review||Array.isArray(x.review))return '';
    const steps=Array.isArray(x.review.steps)?x.review.steps:(Array.isArray(x.review.items)?x.review.items:[]);if(!steps.length)return '';
    return sec(x.review.title||'最后 5 分钟复盘',steps.map(s=>`<div class="dailyFixItem">${esc(typeof s==='string'?s:(s.text||''))}</div>`).join(''),'dailyLightExtra dailyReviewPatch');
  }

  async function markSameDayAm(x,date,s){
    if(s!=='pm'||!Array.isArray(x.vocab))return;
    let am;try{am=await fetchJSON(`data/daily/${date}-am.json`)}catch(e){return}
    const amSet=new Set([...(am.vocab||[]).map(v=>norm(v.word)),...(am.review_vocab||[]).map(v=>norm(typeof v==='string'?v:v.word))]);
    const cards=[...document.querySelectorAll('#dailyBody .dailyFixVocab')];
    x.vocab.forEach((v,i)=>{
      if(v.source_group!=='application'||!amSet.has(norm(v.word)))return;
      const card=cards[i];if(!card||card.querySelector('.dailyAmTaught'))return;
      if(/今天\s*08:00\s*已教/.test(card.textContent||''))return;
      const tag=document.createElement('span');tag.className='dailyAmTaught';tag.textContent='今天 08:00 已教';
      const meta=card.querySelector('.dailyFixMeta');
      if(meta)meta.insertBefore(tag,meta.firstChild);else{const cn=card.querySelector('.dailyFixCn');if(cn)cn.insertAdjacentElement('afterend',tag);else card.prepend(tag)}
    });
  }

  window.dailyLightChoice=function(btn,ok,explain){const box=btn.closest('.dailyFixItem');if(!box||box.dataset.done)return;box.dataset.done='1';box.querySelectorAll('.dailyFixChoice').forEach(b=>{b.disabled=true;if(b.dataset.correct==='1')b.classList.add('correct')});if(!ok)btn.classList.add('wrong');const fb=box.querySelector('.dailyFixFeedback');if(fb){fb.textContent=(ok?'答对了。':'答错了。')+(explain||'');fb.classList.add('show')}};
  window.dailyLightFillCheck=function(btn,answer,cn){const box=btn.closest('.dailyFixItem'),inp=box.querySelector('.dailyLightFill'),fb=box.querySelector('.dailyFixFeedback');if(!inp||!fb)return;const ok=norm(inp.value)===norm(answer);inp.disabled=true;btn.disabled=true;fb.innerHTML=ok?'答对了。':`参考答案：<b>${esc(answer)}</b>${cn?`<div class="dailyFixCnLine">${esc(cn)}</div>`:''}`;fb.classList.add('show')};
  window.dailyLightPick=function(btn){const box=btn.closest('.dailyLightOrder'),out=box.querySelector('.dailyLightOrderOut'),arr=JSON.parse(box.dataset.order||'[]');arr.push(btn.dataset.token||'');box.dataset.order=JSON.stringify(arr);btn.disabled=true;out.textContent=arr.join(' ')};
  window.dailyLightOrderReset=function(btn){const box=btn.closest('.dailyLightOrder');box.dataset.order='[]';box.querySelector('.dailyLightOrderOut').textContent='';const wrap=box.querySelector('.dailyLightTokenWrap');if(wrap){let tokens=[];try{tokens=JSON.parse(wrap.dataset.tokens||'[]')}catch(e){}wrap.innerHTML=tokenButtons(tokens)}const fb=box.querySelector('.dailyFixFeedback');if(fb){fb.classList.remove('show');fb.textContent=''}};
  window.dailyLightOrderCheck=function(btn,answer,cn){const box=btn.closest('.dailyLightOrder'),arr=JSON.parse(box.dataset.order||'[]'),fb=box.querySelector('.dailyFixFeedback'),ok=norm(arr.join(' '))===norm(answer);fb.innerHTML=ok?'顺序正确。':`参考答案：<b>${esc(answer)}</b>${cn?`<div class="dailyFixCnLine">${esc(cn)}</div>`:''}`;fb.classList.add('show')};
  window.dailyLightSelf=function(btn,key,val){try{localStorage.setItem('daily_light_self_'+key,val)}catch(e){}btn.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('correct'));btn.classList.add('correct')};

  window.openDaily=async function(s,d){
    await base(s,d);
    const date=(document.getElementById('dailyMeta')?.textContent||d||'').trim();if(!date)return;
    try{
      const x=await fetchJSON(`data/daily/${date}-${s}.json`);
      await markSameDayAm(x,date,s);
      const body=document.getElementById('dailyBody');if(!body)return;
      const done=body.lastElementChild;
      if(Array.isArray(x.rewrite)&&x.rewrite.length&&!body.querySelector('.dailyRewritePatch')){
        const wrap=document.createElement('div');wrap.innerHTML=rewriteHtml(x);const node=wrap.firstElementChild;if(node){if(done)body.insertBefore(node,done);else body.appendChild(node)}
      }
      if(x.daily_test&&!body.querySelector('.dailyLightTest')){
        const wrap=document.createElement('div');wrap.innerHTML=renderTest(x.daily_test,x);const node=wrap.firstElementChild;if(node){if(done)body.insertBefore(node,done);else body.appendChild(node)}
      }
      if(x.review&&!Array.isArray(x.review)&&!body.querySelector('.dailyReviewPatch')){
        const wrap=document.createElement('div');wrap.innerHTML=finalReviewHtml(x);const node=wrap.firstElementChild;if(node){if(done)body.insertBefore(node,done);else body.appendChild(node)}
      }
    }catch(e){}
  };
})();
