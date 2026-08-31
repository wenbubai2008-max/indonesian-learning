(function(){
  let ARTICLE_LIST=[];
  let currentIndex=0;
  const READING_START_DATE='2026-08-30';

  const titleTranslations={
    'Belajar Bahasa Indonesia':'学习印尼语',
    'Pagi yang Agak Ribet':'有点忙乱的早晨'
  };

  function rows(){return (archive.dates||[]).map(x=>typeof x==='string'?{date:x}:x)}
  function sessionRank(s){return s==='am'?0:1}
  function sourceLabel(a){return `${a.date} · ${a.session==='am'?'08:00':'19:00'}`}
  function chineseTitle(r){
    const title=(r.title||'').trim();
    if(!title)return '';
    return (r.title_cn||titleTranslations[title]||'').trim();
  }

  async function collectArticles(){
    const out=[];
    const rs=rows().filter(x=>x.date>=READING_START_DATE).slice().sort((a,b)=>a.date.localeCompare(b.date));
    for(const row of rs){
      for(const session of ['am','pm']){
        if(!row[session])continue;
        try{
          const x=await fetchJSON(`data/daily/${row.date}-${session}.json`);
          if(x&&x.reading&&x.reading.text){
            out.push({date:row.date,session,day:x.day||row.day||null,reading:x.reading});
          }
          if(Array.isArray(x&&x.additional_lessons)){
            x.additional_lessons.forEach((lesson,extraIndex)=>{
              const lessonDate=lesson.date||row.date;
              if(lessonDate>=READING_START_DATE&&lesson&&lesson.reading&&lesson.reading.text){
                out.push({date:lessonDate,session:lesson.session||session,day:lesson.day||null,reading:lesson.reading,extra:true,extraIndex});
              }
            });
          }
        }catch(e){}
      }
    }
    out.sort((a,b)=>a.date.localeCompare(b.date)||sessionRank(a.session)-sessionRank(b.session)||(a.day||0)-(b.day||0)||(a.extraIndex||0)-(b.extraIndex||0));
    return out;
  }

  function injectStyle(){
    if(document.getElementById('readingLibraryStyle'))return;
    const st=document.createElement('style');
    st.id='readingLibraryStyle';
    st.textContent=`
      #readingPage>.card>.toolbar{display:none!important}
      .rl-nav{display:grid;grid-template-columns:auto minmax(220px,1fr) auto;gap:10px;align-items:center;margin:10px auto 24px;max-width:880px}
      .rl-nav select{width:100%;border:1px solid var(--line);border-radius:11px;padding:10px 12px;background:#fff;font-weight:700}
      .rl-nav button{border:0;border-radius:11px;padding:10px 13px;background:#eef1f6;font-weight:800;cursor:pointer}.rl-nav button:disabled{opacity:.35}
      .rl-article{max-width:900px;margin:0 auto;text-align:center}
      .rl-index{display:inline-block;background:#eef3ff;color:var(--blue);font-weight:850;font-size:13px;padding:6px 10px;border-radius:999px;margin-bottom:14px}
      .rl-title{font-size:25px;font-weight:850;margin:0 0 5px;line-height:1.35;color:var(--text)}
      .rl-title-cn{font-size:17px;color:var(--muted);font-weight:700;margin-bottom:24px}
      .rl-text{text-align:left;font-size:20px;line-height:2;color:#596273;max-width:820px;margin:0 auto;white-space:pre-wrap}
      .rl-actions{display:flex;justify-content:center;margin:22px 0 18px}
      .rl-cn{text-align:left;background:#f7f8fb;border-radius:16px;padding:18px 22px;font-size:17px;line-height:1.8;color:#657084;max-width:850px;margin:0 auto}
      .rl-source{font-size:12px;color:var(--muted);margin-top:14px}
      @media(max-width:650px){.rl-nav{grid-template-columns:1fr 1fr}.rl-nav select{grid-column:1/-1;grid-row:1}.rl-text{font-size:18px;line-height:1.9}.rl-title{font-size:22px}.rl-cn{padding:15px}}
    `;
    document.head.appendChild(st);
  }

  function articleOption(a,i){
    const sameDateCount=ARTICLE_LIST.filter(x=>x.date===a.date).length;
    const time=sameDateCount>1?` · ${a.session==='am'?'08:00':'19:00'}`:'';
    return `<option value="${i}" ${i===currentIndex?'selected':''}>第${i+1}篇 · ${esc(a.date)}${time}</option>`;
  }

  function renderArticle(){
    const a=ARTICLE_LIST[currentIndex];
    if(!a){
      $('readingMeta').textContent='暂无阅读';
      $('readingBody').innerHTML='<div class="empty">2026-08-30 之后暂时还没有可读取的短文。</div>';
      return;
    }
    const r=a.reading;
    const title=(r.title||'').trim();
    const titleCn=chineseTitle(r);
    const titleHtml=title?`<h3 class="rl-title">${esc(title)}</h3>${titleCn?`<div class="rl-title-cn">${esc(titleCn)}</div>`:''}`:'';
    $('readingMeta').textContent=`第${currentIndex+1}篇 · ${sourceLabel(a)}`;
    $('readingBody').innerHTML=`
      <div class="rl-nav">
        <button ${currentIndex===0?'disabled':''} onclick="readingPrev()">← 上一篇</button>
        <select onchange="readingJump(Number(this.value))">${ARTICLE_LIST.map(articleOption).join('')}</select>
        <button ${currentIndex===ARTICLE_LIST.length-1?'disabled':''} onclick="readingNext()">下一篇 →</button>
      </div>
      <article class="rl-article">
        <div class="rl-index">第 ${currentIndex+1} 篇 / 共 ${ARTICLE_LIST.length} 篇</div>
        ${titleHtml}
        <div class="rl-text">${esc(r.text||'')}</div>
        <div class="rl-actions"><button class="secondary" onclick='speak(${JSON.stringify(r.text||'')})'>🔊 朗读全文</button></div>
        <div class="rl-cn">${esc(r.cn||'')}</div>
        <div class="rl-source">来源：${esc(sourceLabel(a))}${a.day?` · Day ${a.day}`:''}</div>
      </article>`;
  }

  async function openLibrary(){
    injectStyle();
    go('readingPage');
    $('readingBody').innerHTML='<div class="loading">正在整理每日学习中的全部阅读…</div>';
    ARTICLE_LIST=await collectArticles();
    currentIndex=Math.max(0,ARTICLE_LIST.length-1);
    renderArticle();
  }

  window.readingJump=function(i){currentIndex=Math.max(0,Math.min(ARTICLE_LIST.length-1,i));renderArticle()};
  window.readingPrev=function(){if(currentIndex>0){currentIndex--;renderArticle()}};
  window.readingNext=function(){if(currentIndex<ARTICLE_LIST.length-1){currentIndex++;renderArticle()}};
  window.goReading=openLibrary;
  window.loadReading=function(){openLibrary()};
})();
