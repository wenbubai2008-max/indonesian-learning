// 2026-10-25 (profile redesign step B1, user-approved): the home profile card and the detail "能力诊断" section, built from
// data/word-diagnosis.js. READ-ONLY: it never writes storage and nothing that selects words, schedules reviews or judges
// mastery reads it. The HTML builders are pure (model in, string out) so they can be tested without a browser.
// Honest by construction: each layer shows how many words were actually TESTED, because "no problem found" on a layer that was
// never tested says nothing (real data 2026-10-25: recognition 917 words, listening 24, automatic training 48).
(function(root,factory){
  const m=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=m;else root.WordDiagnosisUI=m;
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const LAYERS=[{key:'recognition',type:'meaning',name:'认得',how:'快速练习：看印尼语选中文'},{key:'listening',type:'listening',name:'听得懂',how:'听词：只听声音判断词义'},{key:'production',type:'production',name:'说得出来',how:'自动训练：看中文想出印尼语'}];
  const GROUPS=[
    {type:'meaning',name:'意思记不住',hint:'先回看词义和例句，再做快速练习（看印尼语选中文）。'},
    {type:'listening',name:'听不出来',hint:'用听词训练：只听声音判断词义。'},
    {type:'production',name:'说不出来',hint:'用自动训练：看中文想出印尼语，限时作答。'},
    {type:'forgetting',name:'掌握后又答错',hint:'之前掌握过又答错了：按跨日间隔复测（快速练习 + 自动训练）。'},
    {type:'unclear',name:'原因待确认',hint:'“认得”还没验证可靠，先做快速练习，才能判断是哪一层的问题。'}
  ];
  const CONF={high:'高',medium:'中',low:'低'},CONF_RANK={high:0,medium:1,low:2};
  const LOW_COVERAGE=.5,MAX_PER_GROUP=15;

  function pct(n,d){return Math.max(0,Math.min(100,d>0?n/d*100:0))}
  function den(m){return Math.max(1,(Number(m.taught)||0)-(Number(m.excluded)||0))}
  // The note is shown only while listening / production were tested on fewer than half of the trainable words.
  function coverageNote(m){
    const d=den(m),t=m.summary.tested,low=[];
    if(t.listening/d<LOW_COVERAGE)low.push(['听',t.listening]);
    if(t.production/d<LOW_COVERAGE)low.push(['说',t.production]);
    if(!low.length)return '';
    return low.length===2?'听和说的证据很少：只测过 '+t.listening+'、'+t.production+' 个词。其余词只证明“认得”。':(low[0][0]==='听'?'听得懂':'说得出来')+'的证据很少：只测过 '+low[0][1]+' 个词。其余词在这一层没有证据。';
  }
  function rowsHTML(m){
    const d=den(m),s=m.summary;
    return LAYERS.map(L=>{
      const tested=s.tested[L.key],problems=s.types[L.type]||0;
      const meta='<b>'+tested+'</b> / '+d+(tested?(problems?'<em>'+problems+' 有问题</em>':'<span class="vdOk">没发现问题</span>'):'<span class="vdNone">还没测</span>');
      return '<div class="vdRow"><span class="vdName">'+L.name+'</span><div class="vdBar" title="'+esc(L.how)+'"><i style="width:'+pct(tested,d).toFixed(1)+'%"></i></div><span class="vdMeta">'+meta+'</span></div>';
    }).join('');
  }

  // Home card: head + three-layer coverage ladder + conditional note + open button. Same button id as before (openVocabProfile).
  function homeCardHTML(m){
    const head='<div class="vpHead"><div><h3>个人词汇画像</h3><div class="muted">已教 '+esc(m.taught)+' 个词 · 每一层测过多少</div></div><span class="pill">本机训练记录</span></div>';
    const btn='<button class="vpOpen" type="button" id="openVocabProfile">查看每个词的诊断 →</button>';
    if(!m.summary||!m.summary.words)return head+'<div class="vdEmpty">这台设备还没有训练记录。在这台设备上做快速练习、听词或自动训练后，这里会显示每一层的覆盖情况。</div>'+btn;
    const note=coverageNote(m);
    return head+'<div class="vdLadder">'+rowsHTML(m)+'</div>'+(note?'<div class="vdNote">'+esc(note)+'</div>':'')+btn;
  }

  function itemHTML(r,cnOf){
    const cn=cnOf(r.word),also=(r.secondary||[]).map(t=>({forgetting:'也有：掌握后又答错',listening:'也有：听不出来',production:'也有：说不出来'}[t])).filter(Boolean);
    return '<div class="vdItem"><div class="vdWord"><b>'+esc(r.word)+'</b>'+(cn?'<span class="vdCn">'+esc(cn)+'</span>':'')+(r.confidence?'<span class="vdConf">把握：'+CONF[r.confidence]+'</span>':'')+'</div><div class="vdEv">'+r.evidence.map(esc).join('；')+(also.length?'；'+esc(also.join('；')):'')+'</div></div>';
  }
  // Detail section for the 本周 tab: coverage table, "practice worked" count, problem words grouped by type, remaining counts.
  function detailHTML(m){
    const s=m.summary,d=den(m);
    if(!s||!s.words)return '<div class="vpSection" data-word-diagnosis><h3>能力诊断</h3><div class="vpEmpty">这台设备还没有训练记录，暂时无法诊断。</div></div>';
    const items=(m.items||[]).slice().sort((a,b)=>(CONF_RANK[a.confidence]??3)-(CONF_RANK[b.confidence]??3)||b.records-a.records||a.word.localeCompare(b.word));
    const groups=GROUPS.map(g=>{
      const list=items.filter(x=>x.type===g.type);if(!list.length)return '';
      const shown=list.slice(0,MAX_PER_GROUP).map(r=>itemHTML(r,m.cnOf)).join('');
      return '<details class="vdGroup"'+(g.type==='unclear'?'':' open')+'><summary>'+g.name+' <b>'+list.length+'</b> 个</summary><div class="vdHint">怎么练：'+g.hint+'</div>'+shown+(list.length>MAX_PER_GROUP?'<div class="vdMore">还有 '+(list.length-MAX_PER_GROUP)+' 个</div>':'')+'</details>';
    }).join('');
    const t=s.types,rest=[];
    if(t.recognized)rest.push('认得没问题、但听词或自动训练还没测：'+t.recognized+' 个');
    if(t.ok)rest.push('各层都验证过、暂无问题：'+t.ok+' 个');
    if(t.insufficient)rest.push('记录不足（少于 3 次）：'+t.insufficient+' 个');
    if(s.excluded)rest.push('已选择不再训练：'+s.excluded+' 个');
    const note=coverageNote(m);
    return '<div class="vpSection" data-word-diagnosis><h3>能力诊断（按每个词的训练记录）</h3>'+
      '<p class="vpCoverageNote" style="margin-top:0">只统计这台设备上的训练记录；“有问题”要有反复出错的证据才会判断，证据不够的词不会硬分类。每一层的分母是 '+d+' 个可训练的词。</p>'+
      '<div class="vdLadder">'+rowsHTML(m)+'</div>'+(note?'<div class="vdNote">'+esc(note)+'</div>':'')+
      '<div class="vdWin">近 30 天：之前答错过、现在已掌握 <b>'+s.recovered_30d+'</b> 个</div>'+
      (groups||'<div class="vpEmpty">目前没有发现需要单独处理的词。</div>')+
      (rest.length?'<p class="vpCoverageNote">'+rest.map(esc).join(' · ')+'</p>':'')+'</div>';
  }

  const TAG_TYPES=['meaning','listening','production','forgetting'];
  const TAG_NAME={meaning:'意思记不住',listening:'听不出来',production:'说不出来',forgetting:'掌握后又答错'};
  // Small tag for task rows: only the four problem types; anything uncertain stays untagged (no guessing).
  function tagHTML(r){return r&&TAG_TYPES.includes(r.type)?'<span class="vdTag vdTag-'+r.type+'" title="'+esc(r.evidence.join('；'))+'">'+TAG_NAME[r.type]+'</span>':''}
  function fmtDate(iso){const t=Date.parse(iso);if(!Number.isFinite(t))return '';const d=new Date(t+7*3600000);return (d.getUTCMonth()+1)+' 月 '+d.getUTCDate()+' 日'}
  // Diagnosis block for one word (word page): type, how sure, the evidence, what to practise, when it is checked next.
  function wordHTML(r){
    if(!r||r.type==='excluded')return '';
    const g=GROUPS.find(x=>x.type===r.type);
    let how;
    if(g)how=g.hint;
    else if(r.type==='insufficient')how='这个词的训练记录还少于 3 次，再练几次才能判断问题出在哪一层。';
    else if(r.type==='recognized')how='“认得”已经验证；听词和自动训练还没测，有机会时补测。';
    else how=r.next.text;
    const head=g?'<span class="vdTag vdTag-'+r.type+'">'+g.name+'</span>'+(r.confidence?'<span class="vdConf">把握：'+CONF[r.confidence]+'</span>':''):'<span class="vdTag vdTag-plain">'+esc(r.label)+'</span>';
    const ev=r.evidence.length?'<ul class="vdWordEv">'+r.evidence.map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul>':'';
    const also=(r.secondary||[]).map(t=>({forgetting:'也有：掌握后又答错',listening:'也有：听不出来',production:'也有：说不出来'}[t])).filter(Boolean);
    const verify=r.next&&r.next.verify_at?'<div class="vdWordVerify">下一次验证：'+fmtDate(r.next.verify_at)+'</div>':'';
    return '<div class="vdWordBox" data-word-diagnosis-word><div class="vdWordHead"><b>能力诊断</b>'+head+'</div>'+ev+(also.length?'<div class="vdWordHow">'+esc(also.join('；'))+'</div>':'')+'<div class="vdWordHow">'+esc(how)+'</div>'+verify+'</div>';
  }

  const CSS=`
#home .vdLadder,#vocabProfileDetail .vdLadder{margin:6px 0 2px}
.vdRow{display:grid;grid-template-columns:4.6em minmax(0,1fr) auto;gap:8px;align-items:center;padding:4px 0}
.vdName{font-size:14px;font-weight:700;color:#172033}
.vdBar{height:8px;border-radius:99px;background:#eef1f7;overflow:hidden}
.vdBar i{display:block;height:100%;border-radius:99px;background:#5b7be0;min-width:2px}
.vdMeta{font-size:12px;color:#5b667a;white-space:nowrap;text-align:right}
.vdMeta b{color:#172033}
.vdMeta em{font-style:normal;color:#a45a12;font-weight:700;margin-left:6px}
.vdOk{color:#2b6a3f;margin-left:6px}
.vdNone{color:#8a94a6;margin-left:6px}
.vdNote{margin-top:8px;font-size:13px;line-height:1.45;color:#8a4b00;background:#fff7ec;border:1px solid #f4dfbd;border-radius:10px;padding:7px 10px}
.vdEmpty{margin:8px 0;font-size:13px;line-height:1.5;color:#667085;background:#f8faff;border:1px dashed #d5def5;border-radius:10px;padding:10px 12px}
.vdWin{margin:10px 0 4px;font-size:13px;color:#2b6a3f;background:#effaf2;border-radius:10px;padding:7px 10px}
.vdGroup{margin:10px 0;border:1px solid #e5e9f1;border-radius:12px;padding:8px 12px;background:#fff}
.vdGroup>summary{cursor:pointer;font-weight:700;font-size:15px}
.vdHint{margin:6px 0;font-size:12px;color:#667085}
.vdItem{padding:7px 0;border-top:1px solid #f0f2f7}
.vdWord{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:baseline}
.vdWord b{font-size:15px}
.vdCn{font-size:13px;color:#5b667a}
.vdConf{font-size:11px;color:#6b7280;border:1px solid #e1e5ee;border-radius:99px;padding:0 7px}
.vdEv{margin-top:2px;font-size:12px;line-height:1.5;color:#667085}
.vdMore{font-size:12px;color:#8a94a6;padding-top:6px}
.vdTag{display:inline-block;font-size:11px;font-weight:700;padding:1px 8px;border-radius:99px;white-space:nowrap;vertical-align:baseline}
.vdTag-meaning{background:#ffefe0;color:#a45a12}.vdTag-listening{background:#e4f0ff;color:#2b62a8}.vdTag-production{background:#efe7ff;color:#6a45b0}.vdTag-forgetting{background:#fde8e8;color:#a13a3a}.vdTag-plain{background:#eef1f7;color:#5b667a}
.vdWordBox{margin:10px 0;border:1px solid #dfe6f7;background:#f8faff;border-radius:12px;padding:10px 12px}
.vdWordHead{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center;margin-bottom:4px}
.vdWordEv{margin:4px 0;padding-left:18px;font-size:12px;line-height:1.6;color:#5b667a}
.vdWordHow{font-size:13px;line-height:1.5;color:#3b4660;margin-top:4px}
.vdWordVerify{font-size:12px;color:#667085;margin-top:4px}
.vpObsFold{margin:12px 0;border:1px dashed #d5def5;border-radius:12px;padding:6px 12px;background:#fbfcff}
.vpObsFold>summary{cursor:pointer;font-size:14px;font-weight:700;color:#5b667a}
`;
  function ensureStyle(){
    const d=root.document;if(!d||d.getElementById('vdStyle'))return;
    const s=d.createElement('style');s.id='vdStyle';s.textContent=CSS;d.head.appendChild(s);
  }

  // Reads the stored training records once (JSON parse of the weakness pool included) and memoises for a few seconds,
  // so re-rendering the card or switching tabs never re-parses it per word.
  let memo=null,snapMemo=null;
  function getSnap(now){
    if(snapMemo&&now-snapMemo.at<3000)return snapMemo.snap;
    const D=root.WordDiagnosis;if(!D||!root.localStorage)return null;
    let snap;try{snap=D.snapshot(root.localStorage)}catch(e){return null}
    snapMemo={at:now,snap};return snap;
  }
  function model(data,now){
    now=now||Date.now();
    if(memo&&now-memo.at<3000&&memo.data===data)return memo.value;
    const D=root.WordDiagnosis,snap=getSnap(now);
    if(!D||!snap)return null;
    const taught=new Set(),cn=new Map();
    (root.DAILY_VOCAB_DB||[]).forEach(x=>{if(x&&x.word){const k=String(x.word).trim().toLowerCase();taught.add(k);if(x.cn)cn.set(k,x.cn)}});
    const summary=D.summarize(snap,now,{taught:taught.size?taught:undefined,items:true});
    const value={taught:Number(data&&data.taught_total)||taught.size,excluded:Number(data&&data.excluded_from_training)||summary.excluded||0,summary,items:summary.items,cnOf:w=>cn.get(String(w).toLowerCase())||''};
    memo={at:now,data,value};return value;
  }
  function one(word,now){
    now=now||Date.now();const D=root.WordDiagnosis,snap=getSnap(now);
    if(!D||!snap)return null;
    try{return D.diagnoseFrom(snap,word,now)}catch(e){return null}
  }
  function homeCard(data){const m=model(data);if(!m)return '';ensureStyle();return homeCardHTML(m)}
  function detail(data){const m=model(data);if(!m)return '';ensureStyle();return detailHTML(m)}
  function word(w){const r=one(w);if(!r)return '';ensureStyle();return wordHTML(r)}
  function tag(w){const r=one(w);if(!r)return '';ensureStyle();return tagHTML(r)}
  function reset(){memo=null;snapMemo=null}
  return {homeCardHTML,detailHTML,wordHTML,tagHTML,coverageNote,homeCard,detail,word,tag,reset};
});
