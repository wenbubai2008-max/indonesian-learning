(function(){
  function rows(){return (archive.dates||[]).map(x=>typeof x==='string'?{date:x}:x)}
  function lessonDates(){return rows().filter(x=>x.am||x.pm).map(x=>x.date).sort()}
  function latestDate(){const a=lessonDates();return a.length?a[a.length-1]:TODAY}
  function optionLabel(d){const r=rows().find(x=>x.date===d);return r&&r.day?`${d} · Day ${r.day}`:d}

  async function fetchReading(date,session){
    try{
      const x=await fetchJSON(`data/daily/${date}-${session}.json`);
      return x&&x.reading?{reading:x.reading,title:x.title||'',date,session}:null;
    }catch(e){return null}
  }

  async function findBestReading(preferredDate,preferredSession){
    const dates=lessonDates();
    const order=[];
    if(preferredDate)order.push(preferredDate);
    for(let i=dates.length-1;i>=0;i--)if(!order.includes(dates[i]))order.push(dates[i]);
    const sessions=preferredSession?[preferredSession,preferredSession==='am'?'pm':'am']:['am','pm'];
    for(const d of order){
      for(const s of sessions){
        const r=await fetchReading(d,s);
        if(r)return r;
      }
    }
    return null;
  }

  function renderToolbar(date,session){
    const dates=lessonDates();
    return `<div class="toolbar" style="align-items:center">
      <select id="readingDateSelect" onchange="loadReadingSynced(this.value,document.getElementById('readingSessionSelect').value)">
        ${dates.map(d=>`<option value="${d}" ${d===date?'selected':''}>${esc(optionLabel(d))}</option>`).join('')}
      </select>
      <select id="readingSessionSelect" onchange="loadReadingSynced(document.getElementById('readingDateSelect').value,this.value)">
        <option value="am" ${session==='am'?'selected':''}>08:00 早间阅读</option>
        <option value="pm" ${session==='pm'?'selected':''}>19:00 晚间阅读</option>
      </select>
    </div>`;
  }

  async function loadReadingSynced(date,session){
    $('readingBody').innerHTML='<div class="loading">正在同步每日学习中的阅读…</div>';
    let found=await fetchReading(date,session);
    if(!found)found=await findBestReading(date,session);
    if(!found){
      $('readingMeta').textContent='暂无阅读';
      $('readingBody').innerHTML='<div class="empty">目前历史课程里还没有可读取的短文。</div>';
      return;
    }
    const r=found.reading;
    $('readingMeta').textContent=`${found.date} · ${found.session==='am'?'08:00':'19:00'}`;
    $('readingBody').innerHTML=renderToolbar(found.date,found.session)+
      `<div class="contentSection"><h3>${esc(r.title||'每日学习阅读')}</h3>`+
      `<div class="reading">${esc(r.text||'')}</div>`+
      `<div class="actions"><button class="secondary" onclick='speak(${JSON.stringify(r.text||'')})'>🔊 朗读全文</button></div>`+
      `<div class="answer">${esc(r.cn||'')}</div></div>`;
  }

  window.loadReadingSynced=loadReadingSynced;
  window.goReading=function(){
    go('readingPage');
    loadReadingSynced(hasSession(TODAY,'am')||hasSession(TODAY,'pm')?TODAY:latestDate(),hasSession(TODAY,'am')?'am':'pm');
  };
  window.loadReading=function(session){
    const selected=document.getElementById('readingDateSelect');
    loadReadingSynced(selected?selected.value:(hasSession(TODAY,session)?TODAY:latestDate()),session);
  };
})();
