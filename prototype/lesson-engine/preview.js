(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const app = $('#app');
  let bundle = null;
  let ctx = null;

  const norm = x => String(x ?? '').trim().toLowerCase();
  const wc = s => String(s || '').trim().split(/\s+/).filter(Boolean).length;
  const uniq = xs => [...new Set(xs)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fnv = s => {
    let h = 2166136261 >>> 0;
    for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    return h >>> 0;
  };
  const pick = (arr, key) => arr.length ? arr[fnv(key) % arr.length] : null;
  const dailyMap = () => new Map((window.DAILY_VOCAB_DB || []).map(x => [norm(x.word), x]));

  function lexMap() {
    const m = new Map();
    for (const e of bundle.materials['eligible-lexicon'].entries || []) m.set(norm(e.word), e);
    for (const [w, e] of Object.entries(bundle.materials.microcontent.entries || {})) m.set(norm(w), {word:w, ...e});
    return m;
  }

  function tagWord(word, cn, lex) {
    const k = norm(word);
    if (lex.get(k)?.tags?.length) return lex.get(k).tags;
    const cur = bundle.materials['lexical-rules'].curated?.[k];
    if (cur?.tags?.length) return cur.tags;
    const out = [];
    for (const row of bundle.materials['lexical-rules'].chinese_keyword_tags || []) {
      try { if (new RegExp(row.re).test(String(cn || ''))) out.push(...row.tags); } catch {}
    }
    return uniq(out.length ? out : ['daily']);
  }

  const generic = new Set(['action','communication','description','daily','information','time','connector','movement','problem','feeling','plan','location']);
  function sceneFit(row, scene, lex) {
    let score = 0;
    for (const t of tagWord(row.word, row.cn, lex)) {
      if (t === scene.domain) score += 6;
      else if (scene.tags.includes(t)) score += generic.has(t) ? 1 : 3;
    }
    return score;
  }

  function rowsFor(band) {
    const key = band === 'dont' ? 'new_dont' : 'new_fuzzy';
    return (ctx.candidates?.[key] || []).map((x, i) => ({word:norm(x[0]), cn:x[1], band, index:i}));
  }

  function oralMap() {
    return new Map((ctx.candidates?.oral || []).map(x => [norm(x[0]), {
      word:norm(x[0]), register:x[1], counterpart:x[2], root:x[3], rank:x[4], band:x[5]
    }]));
  }

  function chooseScene(variant, lex) {
    const oral = oralMap();
    const base = [...rowsFor('dont').slice(0, 40), ...rowsFor('fuzzy').slice(0, 40)];
    const weights = {};
    base.forEach((r, i) => weights[r.word] = Math.max(1, 4 - Math.floor(i / 12)));
    for (const [w] of oral) weights[w] = (weights[w] || 1) + 6;

    const ranked = bundle.materials.scenes.scenes.map(scene => {
      let score = 0;
      for (const r of base) score += sceneFit(r, scene, lex) * (weights[r.word] || 1);
      return {scene, score};
    }).sort((a,b) => b.score - a.score || a.scene.id.localeCompare(b.scene.id));

    const ceiling = ranked[0]?.score || 0;
    const top = ranked.filter(x => x.score >= Math.max(1, ceiling - 10)).slice(0, 8);
    const pool = top.length ? top : ranked;
    return pool[variant % pool.length]?.scene || ranked[0].scene;
  }

  function orderForScene(rows, scene, lex, variant) {
    return [...rows].sort((a,b) => {
      const af = sceneFit(a, scene, lex), bf = sceneFit(b, scene, lex);
      if (bf !== af) return bf - af;
      const ah = fnv(a.word + '|' + variant), bh = fnv(b.word + '|' + variant);
      return ah - bh || a.index - b.index;
    });
  }

  function selectNew(scene, lex, variant) {
    const D = rowsFor('dont'), F = rowsFor('fuzzy'), oral = oralMap();
    const prev = new Set((ctx.previous_pm?.new_words || []).map(norm));
    const sameAm = new Set((ctx.same_day_am?.vocab || []).map(x => norm(x[0])));
    const exclude = ctx.target.session === 'am' ? prev : sameAm;
    const d = D.filter(x => !exclude.has(x.word));
    const f = F.filter(x => !exclude.has(x.word));
    const out = [];
    const add = r => { if (r && !out.some(x => x.word === r.word)) out.push(r); };
    const legalOral = [...oral.values()].filter(o => !exclude.has(o.word) && (o.band === 'dont' || o.band === 'fuzzy'));

    if (ctx.target.session === 'am') {
      const dSlots = Math.min(10, d.length), fSlots = 10 - dSlots;
      const oralD = legalOral.filter(o => o.band === 'dont').map(o => d.find(r => r.word === o.word)).filter(Boolean);
      oralD.slice(0, Math.min(2, dSlots)).forEach(add);
      for (const r of orderForScene(d, scene, lex, variant)) if (out.filter(x => x.band === 'dont').length < dSlots) add(r);
      if (fSlots) {
        const oralF = legalOral.filter(o => o.band === 'fuzzy').map(o => f.find(r => r.word === o.word)).filter(Boolean);
        oralF.slice(0, 2).forEach(add);
        for (const r of orderForScene(f, scene, lex, variant)) if (out.length < 10) add(r);
      }
      return out.slice(0, 10);
    }

    const oralF = legalOral.filter(o => o.band === 'fuzzy').map(o => f.find(r => r.word === o.word)).filter(Boolean);
    const oralD = legalOral.filter(o => o.band === 'dont').map(o => d.find(r => r.word === o.word)).filter(Boolean);
    const fr = orderForScene(f, scene, lex, variant), dr = orderForScene(d, scene, lex, variant);
    add(oralF.find(r => sceneFit(r, scene, lex) >= 3) || oralF[variant % Math.max(1, oralF.length)]);
    for (const r of fr) if (out.filter(x => x.band === 'fuzzy').length < 2) add(r);
    add(oralD.find(r => sceneFit(r, scene, lex) >= 3) || oralD[variant % Math.max(1, oralD.length)]);
    for (const r of dr) if (out.filter(x => x.band === 'dont').length < 2) add(r);
    while (out.length < 4) add((fr.concat(dr)).find(r => !out.some(x => x.word === r.word)));
    return out.slice(0, 4);
  }

  function selectReviews(scene, lex, variant, count) {
    const focus = new Map((ctx.candidates?.focus || []).map(x => [norm(x[0]), Number(x[1]) || 0]));
    const exposure = new Map();
    for (const h of ctx.history_7d || []) {
      for (const w0 of h.review_core || []) {
        const w = norm(w0);
        exposure.set(w, (exposure.get(w) || 0) + 1);
      }
    }
    const sameAmReview = new Set((ctx.same_day_am?.review_vocab || []).map(norm));
    return (ctx.candidates?.review || []).map((x, i) => ({
      word:norm(x[0]), priority:Number(x[1]) || 9, wrong:Number(x[2]) || 0,
      cn:x[5] || '', root:x[6] || '', root_cn:x[7] || '', index:i
    })).filter(r => !(ctx.target.session === 'pm' && sameAmReview.has(r.word)))
      .map(r => ({
        ...r,
        score:(focus.get(r.word)||0)*2 + (r.priority===1?45:r.priority===2?20:5) + r.wrong*18 +
          sceneFit(r,scene,lex)*5 - (exposure.get(r.word)||0)*12 + ((fnv(r.word+'|'+variant)%7)-3)
      }))
      .sort((a,b) => b.score-a.score || a.index-b.index)
      .slice(0,count);
  }

  function selectApps(scene, lex, reviews, variant, count=2) {
    if (ctx.target.session !== 'pm') return [];
    const used = new Set(reviews.map(x => x.word));
    const amMeta = new Map((ctx.same_day_am?.vocab || []).map(x => [norm(x[0]), x]));
    const amSeen = new Set([...amMeta.keys(), ...(ctx.same_day_am?.review_vocab || []).map(norm)]);
    const rows = (ctx.candidates?.review || []).map((x,i) => {
      const a = amMeta.get(norm(x[0]));
      return {word:norm(x[0]), cn:a?.[1]||x[5]||'', en:a?.[2]||'', root:a?.[3]||x[6]||'', root_cn:a?.[4]||x[7]||'', index:i, same_day_am:amSeen.has(norm(x[0]))};
    }).filter(x => !used.has(x.word));
    return orderForScene(rows, scene, lex, variant)
      .sort((a,b) => Number(b.same_day_am)-Number(a.same_day_am) || sceneFit(b,scene,lex)-sceneFit(a,scene,lex))
      .slice(0,count);
  }

  function buildCard(row, group, lex, daily, oral) {
    const k = norm(row.word), e = lex.get(k) || {}, d = daily.get(k) || {};
    const review = (ctx.candidates?.review || []).find(x => norm(x[0]) === k);
    const cn = e.cn || row.cn || review?.[5] || d.cn || '';
    const root = e.root || row.root || review?.[6] || d.root || k;
    return {
      word:k, cn, en:e.en || row.en || d.en || '',
      root, root_cn:e.root_cn || row.root_cn || review?.[7] || '',
      example:e.example || d.example || '',
      example_cn:e.example_cn || d.example_cn || '',
      note:e.note || e.synonym_note || bundle.materials['lexical-rules'].curated?.[k]?.spoken_note || '',
      group, oral:group==='new' && oral.has(k)
    };
  }

  function makeReading(scene, cards, lex, variant) {
    const cn = bundle.materials['scene-cn'].scenes[scene.id];
    const pairs = [];
    const oi = fnv(scene.id+'|open|'+variant) % scene.openings.length;
    pairs.push([scene.openings[oi], cn.openings[oi]]);

    const inserts = cards.filter(c => c.example && c.example_cn && sceneFit(c, scene, lex) >= 3 && !/^(jangan|tolong|coba|biar)\b/i.test(c.example))
      .slice(0,4).map(c => [c.example, c.example_cn]);
    const moves = scene.moves.map((x,i) => [x, cn.moves[i]]);
    let i=0,j=0;
    while ((i<moves.length || j<inserts.length) && wc(pairs.map(x=>x[0]).join(' ')) < 94) {
      if (i<moves.length) pairs.push(moves[i++]);
      if (j<inserts.length) pairs.push(inserts[j++]);
    }
    while (i<moves.length && wc(pairs.map(x=>x[0]).join(' ')) < 88) pairs.push(moves[i++]);
    const ci = fnv(scene.id+'|close|'+variant) % scene.closing.length;
    pairs.push([scene.closing[ci], cn.closing[ci]]);
    while (wc(pairs.map(x=>x[0]).join(' ')) > 120 && pairs.length > 5) pairs.splice(-2,1);
    return {text:pairs.map(x=>x[0]).join(' '), cn:pairs.map(x=>x[1]).join(' ')};
  }

  function makeDialogue(scene, variant) {
    const lines=[]; let speaker='A';
    for (const move of scene.dialogue || []) {
      const vs = bundle.materials.language.dialogue_moves[move] || [];
      if (!vs.length) continue;
      const v = pick(vs, scene.id+'|'+move+'|'+variant);
      lines.push({speaker, id:v[0], cn:v[1]});
      speaker = speaker === 'A' ? 'B' : 'A';
    }
    return lines;
  }

  function makeTasks(cards) {
    const newCards=cards.filter(x=>x.group==='new'), review=cards.filter(x=>x.group==='review'), apps=cards.filter(x=>x.group==='application');
    const rewrite=[];
    for (const c of newCards.slice(0,2)) if (c.example) rewrite.push({task:'中译印：'+c.example_cn+'（使用 '+c.word+'）',answer:c.example});
    if (apps[0]?.example) rewrite.push({task:'主动复现：'+apps[0].example_cn+'（使用 '+apps[0].word+'）',answer:apps[0].example});
    if (review[0]?.example) rewrite.push({task:'复习输出：'+review[0].example_cn+'（使用 '+review[0].word+'）',answer:review[0].example});
    return rewrite;
  }

  function generate(variant) {
    const lex = lexMap(), daily=dailyMap(), oral=oralMap();
    const scene=chooseScene(variant,lex), n=selectNew(scene,lex,variant);
    const reviews=selectReviews(scene,lex,variant,ctx.target.session==='am'?5:4);
    const apps=selectApps(scene,lex,reviews,variant,2);
    const cards=[
      ...n.map(x=>buildCard(x,'new',lex,daily,oral)),
      ...reviews.map(x=>buildCard(x,'review',lex,daily,oral)),
      ...apps.map(x=>buildCard(x,'application',lex,daily,oral))
    ];
    return {scene,cards,new_words:n.map(x=>x.word),reading:makeReading(scene,cards,lex,variant),dialogue:makeDialogue(scene,variant),tasks:makeTasks(cards)};
  }

  function checks(course) {
    const legal=new Set([...(ctx.candidates?.new_dont||[]),...(ctx.candidates?.new_fuzzy||[])].map(x=>norm(x[0])));
    const groups={
      new:course.cards.filter(x=>x.group==='new'),
      review:course.cards.filter(x=>x.group==='review'),
      application:course.cards.filter(x=>x.group==='application')
    };
    const out=[];
    out.push(['新词全部来自合法池', groups.new.every(x=>legal.has(x.word))]);
    out.push(['核心词无重复', new Set(course.cards.map(x=>x.word)).size===course.cards.length]);
    out.push(['阅读 80–120 词', wc(course.reading.text)>=80&&wc(course.reading.text)<=120]);
    if(ctx.target.session==='am') out.push(['AM 恰好10个新词',groups.new.length===10]);
    else {
      out.push(['PM 新词 3–4',groups.new.length>=3&&groups.new.length<=4]);
      out.push(['PM review 4–6',groups.review.length>=4&&groups.review.length<=6]);
      out.push(['PM application 2–3',groups.application.length>=2&&groups.application.length<=3]);
      out.push(['对话 ≥4轮',course.dialogue.length>=4]);
    }
    return out;
  }

  function render(course, variant) {
    const cs=checks(course);
    const time=ctx.target.time || (ctx.target.session==='am'?'08:00':'18:00');
    const groups = course.cards.reduce((m,x)=>((m[x.group]??=[]).push(x),m),{});
    const cardsHtml = course.cards.map(c => `
      <article class="word">
        <div class="word-head">
          <div class="word-title">${esc(c.word)}${c.oral?' · 🗣':''}</div>
          <span class="group">${esc(c.group)}</span>
        </div>
        <div class="word-cn">${esc(c.cn)}</div>
        ${c.root?'<div class="word-note">词根：'+esc(c.root)+(c.root_cn?' · '+esc(c.root_cn):'')+'</div>':''}
        ${c.example?'<div class="word-example">'+esc(c.example)+'<div class="cn">'+esc(c.example_cn)+'</div></div>':''}
        ${c.note?'<div class="word-note">'+esc(c.note)+'</div>':''}
      </article>`).join('');

    const dialogue = course.dialogue.map(x=>`<div class="line"><b>${x.speaker}</b>${esc(x.id)}<div class="cn">${esc(x.cn)}</div></div>`).join('');
    const tasks = course.tasks.length ? course.tasks.map((x,i)=>`<div class="task"><b>${i+1}.</b> ${esc(x.task)}<div class="answer">参考：${esc(x.answer)}</div></div>`).join('') : '<div class="hint">AM 当前展示主动输出与阅读结构；详细题型在正式合同校验阶段继续测试。</div>';

    app.innerHTML=`
      <section class="meta">
        <div class="card"><div class="k">目标</div><div class="v">${esc(ctx.target.date)} · ${esc(time)}</div></div>
        <div class="card"><div class="k">Day</div><div class="v">${esc(ctx.target.day)}</div></div>
        <div class="card"><div class="k">自动场景</div><div class="v">${esc(course.scene.title)}</div></div>
        <div class="card"><div class="k">核心词</div><div class="v">${course.cards.length}</div></div>
        <div class="card"><div class="k">阅读长度</div><div class="v">${wc(course.reading.text)} 词</div></div>
      </section>

      <section class="card section">
        <h2>结构检查</h2>
        <div class="checks">${cs.map(([t,ok])=>`<span class="check ${ok?'':'bad'}">${ok?'✓':'✕'} ${esc(t)}</span>`).join('')}</div>
        <p class="hint">组合 ${variant+1} · 仅浏览器内生成；刷新或关闭页面即消失。</p>
      </section>

      <section class="card section">
        <h2>核心词卡</h2>
        <p class="hint">new：新词；review：正式复习词；application：已学词主动复现。</p>
        <div class="word-grid">${cardsHtml}</div>
      </section>

      <section class="card section">
        <h2>阅读 · ${esc(course.scene.title)}</h2>
        <div class="reading">${esc(course.reading.text)}</div>
        <div class="translation">${esc(course.reading.cn)}</div>
      </section>

      ${ctx.target.session==='pm' ? `
      <section class="card section">
        <h2>真实口语对话</h2>
        <div class="dialogue">${dialogue}</div>
      </section>
      <section class="card section">
        <h2>主动输出 / 改写</h2>
        <div class="tasks">${tasks}</div>
      </section>` : `
      <section class="card section">
        <h2>早课输出提示</h2>
        <p class="hint">当前原型重点先验证选词、词卡和阅读自然度。AM 3题 quiz 与最终 review 的正式 schema 仍由现有 validator 把关。</p>
      </section>`}
    `;
  }

  async function load() {
    app.innerHTML='<section class="hero">正在读取最新素材库和 lesson-context…</section>';
    try {
      const [b,c] = await Promise.all([
        fetch('./materials/materials-bundle.json?ts='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('materials '+r.status);return r.json()}),
        fetch('../../data/lesson-context.json?ts='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('context '+r.status);return r.json()})
      ]);
      bundle=b;ctx=c;
      render(generate(Number($('#variant').value)||0),Number($('#variant').value)||0);
    } catch (e) {
      app.innerHTML='<section class="error">测试页读取失败：'+esc(e.message||e)+'\n\n这不会影响正式课程。</section>';
    }
  }

  $('#generate').addEventListener('click',()=>bundle&&ctx&&render(generate(Number($('#variant').value)||0),Number($('#variant').value)||0));
  $('#variant').addEventListener('change',()=>bundle&&ctx&&render(generate(Number($('#variant').value)||0),Number($('#variant').value)||0));
  $('#reload').addEventListener('click',load);
  load();
})();
