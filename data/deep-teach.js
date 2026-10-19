(function(){
'use strict';
if(window.DeepTeach)return;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SPK='<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 6h3l4-3v10l-4-3H2z"/><path fill="none" stroke="currentColor" stroke-width="1.5" d="M11.2 5.6a3.2 3.2 0 0 1 0 4.8M12.9 3.9a5.6 5.6 0 0 1 0 8.2"/></svg>';
const inline=t=>`<span class="id">${t}<button class="spk" type="button" data-say="${t}" aria-label="朗读">${SPK}</button></span>`;
const I=t=>inline(esc(t)),W=t=>`<span class="idw">${esc(t)}</span>`;
// Escape the entire input before interpreting the three supported inline markers.
function marked(s){return s.replace(/\{\{(.+?)\}\}|\[\[(.+?)\]\]|\*\*(.+?)\*\*/g,(_,id,word,bold)=>id!=null?inline(id):word!=null?`<span class="idw">${word}</span>`:`<b>${marked(bold)}</b>`)}
function md(text){return marked(esc(text)).replace(/\n/g,'<br>')}
// at is the number of completed units when the item entered the queue.
function dueRecalls(queue,pos){return queue.filter(r=>!r.done&&r.tries<2&&pos-r.at>=2)}
function classify(log,items){
  const L=log,weak=[],good=[];
  for(const it of items){const k=it.key,r=[];const c=L.checks[k],b=L.backup[k],s=L.say[k],rc=L.recall[k]||[],f=L.final[k];
    if(c&&c!=='right')r.push('理解检查第一次'+(c==='ok'?'选了能用但不够准的':'选错')+(b?'，换一题'+(b==='right'?'答对了':'还是没对'):''));
    if(s){if(s.rate==='no')r.push('第一次开口没说出来');else if(s.rate==='part')r.push('第一次开口只说了一半');else if(s.hinted)r.push('第一次开口看了提示才说出来')}
    rc.forEach((x,i)=>{if(x.rate!=='yes'||x.hinted)r.push(`第 ${i+1} 次隔时回想`+(x.rate==='no'?'没想起来':x.rate==='part'?'只想起一半':'看了提示才说出来'))});
    if(!c||!s||!f)r.push('尚未完成独立验证');
    if(f==='no')r.push('最后一轮想不起来');else if(f==='slow')r.push('最后一轮有点慢');
    (r.length?weak:good).push({it,r})}
  return {weak,good};
}
const str=x=>typeof x==='string'&&x.trim().length>0;
const text=x=>str(x)||(Array.isArray(x)&&x.length>0&&x.every(message));
function message(x){return str(x)||!!(x&&typeof x==='object'&&!Array.isArray(x)&&(
  (x.quote&&str(x.quote.id))||(Array.isArray(x.table)&&x.table.every(r=>Array.isArray(r)&&r.length>=2))||
  (Array.isArray(x.chunks)&&x.chunks.every(r=>Array.isArray(r)&&r.length>=2))||
  (str(x.from)&&str(x.word))||str(x.tip)||str(x.scene)||str(x.tag)))}
function question(q){return !!(q&&text(q.q)&&Array.isArray(q.options)&&q.options.length>=2&&q.options.length<=4&&
 q.options.filter(o=>o&&o.v==='right').length===1&&q.options.every(o=>o&&str(o.t)&&['right','ok','wrong'].includes(o.v)&&Array.isArray(o.why)&&o.why.length&&o.why.every(str))&&(!q.backup||question(q.backup)))}
function production(p){return !!(p&&text(p.prompt)&&str(p.kw)&&str(p.ref)&&(!p.skel||str(p.skel))&&(!p.notes||text(p.notes)))}
function validateShape(teach,lesson){
 try{
  if(!teach||!Array.isArray(teach.items)||!teach.items.length||!text(teach.intro))return false;
  const keys=new Set();
  for(const it of teach.items){
   if(!it||!str(it.key)||keys.has(it.key)||!str(it.name)||!str(it.head)||!str(it.remind))return false;keys.add(it.key);
   const s=it.scene;
   if(!s||!Array.isArray(s.quotes)||!s.quotes.length||!s.quotes.every(q=>q&&str(q.id))||!text(s.ask)||!Array.isArray(s.options)||!s.options.length||!s.options.every(o=>o&&str(o.t)&&text(o.reply)))return false;
   if(!text(it.explain)||!text(it.simple)||!question(it.check)||!production(it.say)||!production(it.recall)||
    (it.recall2&&!production(it.recall2))||!it.final||!str(it.final.cn)||!str(it.final.ref))return false;
   if(it.asks&&(!Array.isArray(it.asks)||!it.asks.every(a=>a&&str(a.label)&&(text(a.reply)||(str(a.from)&&str(a.word||it.name))))))return false;
  }
  if(lesson){const f=lesson.lesson_focus;if(!f||!Array.isArray(f.words)||!Array.isArray(f.patterns))return false;
   const expected=[...f.words,...f.patterns.map(p=>p.pattern)];if(expected.length!==teach.items.length||!expected.every(n=>teach.items.some(i=>i.name===n)))return false;}
  if(teach.scan&&(!Array.isArray(teach.scan.words)||!teach.scan.words.every(str)||teach.scan.intro&&!text(teach.scan.intro)))return false;
  if(teach.reading&&(!Array.isArray(teach.reading)||!teach.reading.every(r=>r&&str(r.sentence)&&Array.isArray(r.chunks)&&r.chunks.every(c=>Array.isArray(c)&&c.length>=2)&&(!r.steal||text(r.steal))&&(!r.check||question(r.check))&&(!r.say||production(r.say)))))return false;
  if(teach.tasks&&(!Array.isArray(teach.tasks)||!teach.tasks.every(production)))return false;
  if(teach.dialogue){const d=teach.dialogue,lines=lesson&&lesson.dialogue&&lesson.dialogue.lines;
   if(!str(d.head)||!text(d.intro)||!Array.isArray(d.turns)||!lines||!d.turns.every(t=>t&&Number.isInteger(t.line)&&t.line>=0&&t.line<lines.length&&str(lines[t.line].id)&&str(lines[t.line].cn)&&str(t.kw)&&text(t.intent)&&(!t.notes||text(t.notes)))||d.tail&&!text(d.tail))return false;}
  return true;
 }catch(e){return false}
}
// Embedded data wins. Missing or invalid data → mode none (no start button; the old 带学 is paused since 2026-10-19).
async function selectTeach(lesson,fetcher){
 let teach=lesson&&lesson.lesson_focus&&lesson.lesson_focus.teach;
 if(teach===undefined||teach===null){
  if(!lesson||!/^\d{4}-\d{2}-\d{2}$/.test(lesson.date)||!['am','pm'].includes(lesson.session))return {mode:'none'};
  try{const r=await fetcher(`data/teach/${lesson.date}-${lesson.session}.json`);if(r.status===404)return {mode:'none'};if(!r.ok)throw new Error('HTTP '+r.status);teach=await r.json()}catch(e){console.warn('DeepTeach: 讲解数据不可用，不显示带学入口',e);return {mode:'none'}}
 }
 if(!validateShape(teach,lesson)){console.warn('DeepTeach: 讲解数据格式不合格，不显示带学入口');return {mode:'none'}}
 return {mode:'deep',teach};
}
let active=null,busy=false;
function close(){if(active){const session=active;active=null;session.close()}}
// 2026-10-19 (user request): the old 带学 is paused. A lesson without usable teaching data shows no start button at all;
// guided-lesson.js stays in the repo but is never opened.
async function revealStarts(root){const scope=root||document;if(!scope||typeof scope.querySelectorAll!=='function')return;const btns=[...scope.querySelectorAll('[data-guided-start][hidden]')];
 for(const b of btns){const m=String(b.dataset.guidedStart||'').match(/^(\d{4}-\d{2}-\d{2})-(am|pm)$/);if(!m)continue;
  try{const fetchJ=window.fetchJSON||(p=>fetch(p).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}));
   const lesson=await fetchJ(`data/daily/${m[1]}-${m[2]}.json`),chosen=await selectTeach(lesson,p=>fetch(p));if(chosen.mode==='deep'&&b.isConnected)b.hidden=false}
  catch(e){console.warn('DeepTeach: 无法确认讲解数据，不显示带学入口',e)}}}
async function launch(date,session){
 if(busy)return;busy=true;
 try{const fetchJ=window.fetchJSON||(p=>fetch(p).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}));
  const lesson=await fetchJ(`data/daily/${date}-${session}.json`),chosen=await selectTeach(lesson,p=>fetch(p));
  if(chosen.mode==='deep')open(lesson,chosen.teach);else console.warn('DeepTeach: 这节课没有讲解数据（旧版带学已暂停）');
 }catch(e){console.warn('DeepTeach: 无法打开深讲版',e)}finally{busy=false}
}
function css(){if(document.getElementById('deepTeachStyle'))return;const style=document.createElement('style');style.id='deepTeachStyle';style.textContent=`
.dt{
  --bg:#f2f3f7; --surface:#ffffff; --ink:#1c2233; --muted:#5f6880; --line:#dde1eb;
  --accent:#2c3a8a; --accent-soft:#e6e9f7; --silver:#c9ced9;
  --good:#1d7449; --good-soft:#e2f2e9; --warn:#8a5c00; --warn-soft:#f9efd9; --bad:#ad352d; --bad-soft:#f9e5e3;
  --f-id:Georgia,"Times New Roman",serif;
  --f-ui:-apple-system,"PingFang SC","Noto Sans SC","Microsoft YaHei",system-ui,sans-serif;
}

@media (prefers-color-scheme: dark){.dt:not([data-theme="light"]){
  --bg:#11131a; --surface:#1a1d27; --ink:#e7e9f1; --muted:#9aa1b6; --line:#2b3040;
  --accent:#a3adff; --accent-soft:#252a4b; --silver:#3a4052;
  --good:#71d19d; --good-soft:#16301f; --warn:#e7b858; --warn-soft:#33290f; --bad:#ff8f86; --bad-soft:#3b1d1b; color-scheme:dark}
}
.dt[data-theme="dark"]{
  --bg:#11131a; --surface:#1a1d27; --ink:#e7e9f1; --muted:#9aa1b6; --line:#2b3040;
  --accent:#a3adff; --accent-soft:#252a4b; --silver:#3a4052;
  --good:#71d19d; --good-soft:#16301f; --warn:#e7b858; --warn-soft:#33290f; --bad:#ff8f86; --bad-soft:#3b1d1b; color-scheme:dark}
.dt *{box-sizing:border-box}
.dt{background:var(--bg);color:var(--ink)}
.dt{font-family:var(--f-ui);font-size:16px;line-height:1.65}
.dt::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:10;background:var(--surface)}
.dt .wrap{max-width:720px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.dt header{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:var(--surface);border-bottom:1px solid var(--line)}
.dt .hrow{display:flex;align-items:center;gap:12px;padding-block:10px 6px;flex-wrap:wrap}
.dt .htitle{display:flex;flex-direction:column;min-width:0;flex:1}
.dt .htitle b{font-size:17px;letter-spacing:.01em}
.dt .htitle span{font-size:12.5px;color:var(--muted)}
.dt .toggles{display:flex;gap:12px;flex-wrap:wrap}
.dt .tg{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--muted);cursor:pointer;user-select:none}
.dt .tg input{accent-color:var(--accent);width:16px;height:16px}
.dt nav{display:flex;gap:6px;overflow-x:auto;padding-block:4px 10px;scrollbar-width:none}
.dt nav::-webkit-scrollbar{display:none}
.dt nav button{flex:none;border:1px solid var(--line);background:transparent;color:var(--muted);border-radius:999px;padding:3px 11px;font:inherit;font-size:12.5px;cursor:pointer;white-space:nowrap}
.dt nav button.done{color:var(--ink);border-color:var(--silver)}
.dt nav button.on{background:var(--accent);border-color:var(--accent);color:var(--surface)}
.dt nav button:focus-visible,.dt .bar button:focus-visible,.dt .spk:focus-visible,.dt .cnbtn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.dt .notice{font-size:12.5px;color:var(--muted);padding-block:12px 0}
.dt #dtThread{display:flex;flex-direction:column;gap:10px;padding-block:14px 24px}
.dt .msg{max-width:92%;min-width:0;overflow-wrap:anywhere}
.dt .msg p{margin:0}
.dt .msg p+p{margin-top:8px}
.dt .t{align-self:flex-start;background:var(--surface);border:1px solid var(--line);border-radius:4px 16px 16px 16px;padding:10px 14px}
.dt .who{align-self:flex-start;font-size:12px;font-weight:700;color:var(--accent);letter-spacing:.06em;margin-top:6px;margin-bottom:-6px}
.dt .l{align-self:flex-end;background:var(--accent-soft);border-radius:16px 4px 16px 16px;padding:8px 14px;color:var(--ink)}
.dt .sys{align-self:stretch;max-width:none;display:flex;align-items:center;gap:10px;margin-top:18px;color:var(--muted);font-size:13px;font-weight:700;letter-spacing:.04em}
.dt .sys::before,.dt .sys::after{content:"";flex:1;height:1px;background:var(--line)}
.dt .tag{align-self:flex-start;font-size:12px;font-weight:700;letter-spacing:.05em;color:var(--muted);text-transform:none;margin-top:4px;background:transparent;padding:0;border-radius:0;display:block}
.dt .q{align-self:stretch;max-width:none;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.dt .qhead{font-size:12px;font-weight:700;color:var(--muted);letter-spacing:.06em;margin-bottom:2px}
.dt .qid .id{font-size:18px;line-height:1.55}
.dt .qcn{color:var(--muted);font-size:14.5px;margin-top:4px}
.dt .cnbtn{margin-top:6px;border:0;background:none;color:var(--accent);font:inherit;font-size:13px;padding:0;cursor:pointer}
.dt .scene{align-self:stretch;max-width:none;color:var(--muted);font-size:14.5px;padding:2px 2px}
.dt .tip{align-self:flex-start;font-size:14px;color:var(--muted);background:transparent;border:1px dashed var(--silver);border-radius:12px;padding:8px 12px}
.dt .fb{align-self:flex-start;border-radius:4px 16px 16px 16px;padding:10px 14px}
.dt .fb .pill{display:inline-block;font-size:12px;font-weight:700;border-radius:999px;padding:1px 9px;margin-bottom:6px}
.dt .fb.right{background:var(--good-soft)}
.dt .fb.right .pill{background:var(--good);color:var(--surface)}
.dt .fb.ok{background:var(--warn-soft)}
.dt .fb.ok .pill{background:var(--warn);color:var(--surface)}
.dt .fb.wrong{background:var(--bad-soft)}
.dt .fb.wrong .pill{background:var(--bad);color:var(--surface)}
.dt .hint{align-self:flex-start;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 14px}
.dt .hint .lab,.dt .ref .lab{font-size:12px;font-weight:700;color:var(--muted);letter-spacing:.05em;display:block;margin-bottom:4px}
.dt .chips{display:flex;flex-wrap:wrap;gap:6px}
.dt .chip{font-family:var(--f-id);background:var(--accent-soft);border-radius:8px;padding:1px 9px}
.dt .skel{font-family:var(--f-id);font-size:17px}
.dt .skel u{text-decoration:none;display:inline-block;min-width:3.2em;border-bottom:2px solid var(--accent);margin:0 2px}
.dt .ref{align-self:stretch;max-width:none;background:var(--surface);border:1.5px solid var(--accent);border-radius:12px;padding:10px 14px}
.dt .ref .id{font-size:18px}
.dt .id{font-family:var(--f-id);font-weight:600;color:var(--ink)}
.dt .idw{font-family:var(--f-id);font-weight:600}
.dt .spk{display:inline-flex;vertical-align:-2px;margin-left:4px;width:22px;height:22px;align-items:center;justify-content:center;border:0;border-radius:50%;background:var(--accent-soft);color:var(--accent);cursor:pointer;padding:0}
.dt .spk svg{width:12px;height:12px}
.dt table.cmp{border-collapse:collapse;margin:6px 0 2px;width:100%;font-size:14.5px}
.dt table.cmp td{border-top:1px solid var(--line);padding:6px 8px 6px 0;vertical-align:top}
.dt table.cmp tr:first-child td{border-top:0}
.dt table.cmp td:first-child{width:38%}
.dt .chunks{display:flex;flex-direction:column;gap:8px;margin:2px 0}
.dt .ck{display:grid;grid-template-columns:minmax(0,1fr);gap:1px;border-top:1px solid var(--line);padding-top:8px}
.dt .ck:first-child{border-top:0;padding-top:0}
.dt .ck .a{font-family:var(--f-id);font-weight:600}
.dt .ck .b{font-size:14.5px}
.dt .ck .c{font-size:13.5px;color:var(--muted)}
.dt .src{display:none;font-size:11px;font-weight:700;border-radius:6px;padding:0 6px;margin-left:6px;vertical-align:1px;letter-spacing:.03em}
.dt.showsrc .src{display:inline-block}
.dt .src.card{background:var(--good-soft);color:var(--good)}
.dt .src.mix{background:var(--warn-soft);color:var(--warn)}
.dt .src.new{background:var(--accent-soft);color:var(--accent)}
.dt .sum{align-self:stretch;max-width:none;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.dt .sum h3{margin:0 0 6px;font-size:16px}
.dt .sum h4{margin:14px 0 4px;font-size:14px;color:var(--muted);letter-spacing:.04em}
.dt .sum ul{margin:0;padding-left:18px}
.dt .sum li+li{margin-top:6px}
.dt .sum small{color:var(--muted)}
.dt .stats{display:flex;gap:18px;flex-wrap:wrap;font-variant-numeric:tabular-nums}
.dt .stats div b{font-size:22px;display:block;line-height:1.2}
.dt .stats div span{font-size:12.5px;color:var(--muted)}
.dt .bar{position:sticky;bottom:0;z-index:4;background:var(--surface);border-top:1px solid var(--line);padding-bottom:env(safe-area-inset-bottom,0px)}
.dt .bar .wrap{display:flex;flex-wrap:wrap;gap:8px;padding-block:10px;min-height:58px;align-items:center}
.dt .bar button{font:inherit;font-size:15px;border-radius:12px;padding:8px 14px;cursor:pointer;border:1px solid var(--line);background:var(--bg);color:var(--ink);text-align:left;max-width:100%}
.dt .bar button.primary{background:var(--accent);border-color:var(--accent);color:var(--surface);font-weight:600;margin-left:auto}
.dt .bar button.ask{border-style:dashed;color:var(--accent);background:transparent}
.dt .bar button.opt{flex:1 1 100%}
.dt .bar button.idopt{font-family:var(--f-id)}
.dt .bar button:disabled{opacity:.55;cursor:default}
.dt .bar .waiting{color:var(--muted);font-size:14px}

@media (min-width:560px){.dt .bar button.opt{flex:1 1 auto}
}

@media (prefers-reduced-motion:no-preference){.dt .msg{animation:dt-in .22s ease-out}
@keyframes dt-in{from{opacity:.0;transform:translateY(4px)}
to{opacity:1;transform:none}
}
}
.dt .fromlab{font-size:12px;font-weight:700;color:var(--good);letter-spacing:.04em;margin-bottom:4px!important}
.dt .bar button.scanb{font-family:var(--f-id);padding:6px 11px;font-size:14.5px}
.dt .bar button.scanb.sel{background:var(--warn-soft);border-color:var(--warn);color:var(--ink)}



.dt{position:fixed;inset:0;z-index:2100;display:flex;flex-direction:column;overflow:hidden;background:var(--bg);color:var(--ink);font-family:var(--f-ui);font-size:16px;line-height:1.65;text-align:left}

.dt header{position:relative;top:0;flex:none}
.dt main.wrap{flex:1;min-height:0;overflow-y:auto;width:100%;overscroll-behavior:contain}
.dt .wrap{width:100%}
.dt .bar{position:relative;flex:none;bottom:auto}
.dt header nav{max-width:100%}
.dt .exit,.dt .legacy{font:inherit;font-size:13px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--accent);padding:5px 10px;cursor:pointer}
.dt .legacy{border:0;text-decoration:underline;margin-left:auto}
.dt button{touch-action:manipulation}
.dt .bar{max-height:50dvh;overflow-y:auto}
.dt .bar .wrap{flex-shrink:0}
.dt [hidden]{display:none!important}

`;document.head.appendChild(style)}
function open(lesson,teach){
 if(!validateShape(teach,lesson))return false;
 close();
 // Do not stack over a legacy session opened by another caller.
 if(document.getElementById('glOverlay'))return false;
 const previousFocus=document.activeElement,overflow=document.documentElement.style.overflow;
 const overlay=document.createElement('div');overlay.id='dtOverlay';overlay.className='dt';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','深讲版带学');
 const theme=document.documentElement.dataset.theme||document.body.dataset.theme;if(theme)overlay.dataset.theme=theme;
 overlay.innerHTML=`<header><div class="wrap"><div class="hrow"><div class="htitle"><b>${esc(teach.title||'深讲版带学')}</b><span>${esc(lesson.date)} ${lesson.session==='am'?'早课':'晚课'}</span></div><button type="button" class="exit" data-dt-close>回到整页</button></div><div class="hrow toggles"><label class="tg"><input type="checkbox" id="dtSimple">简明讲解</label><label class="tg"><input type="checkbox" id="dtSource">标出内容来源</label></div><nav id="dtNav" aria-label="课程环节"></nav></div></header><main class="wrap"><div class="notice">深讲版 · 不保存任何结果，随时可以回到整页。</div><div id="dtThread" aria-live="polite"></div></main><div class="bar"><div class="wrap" id="dtBar"></div></div>`;
 css();document.body.appendChild(overlay);document.documentElement.style.overflow='hidden';
 const hiddenSiblings=[...document.body.children].filter(n=>n!==overlay).map(n=>[n,n.inert]);hiddenSiblings.forEach(([n])=>{n.inert=true});
 const LESSON=lesson,TEACH=JSON.parse(JSON.stringify(teach));
 const $=s=>overlay.querySelector(s);
 const thread=$('#dtThread'),bar=$('#dtBar'),nav=$('#dtNav');
 const RM=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SRC={card:'课程已有',mix:'部分已有',new:'新写'};
const vocabOf=w=>(LESSON.vocab||[]).find(v=>String(v.word).toLowerCase()===String(w).toLowerCase());
function sentences(t){const s=String(t||''),out=[];let d=0,cur='';for(const ch of s){if(ch==='（'||ch==='(')d++;if(ch==='）'||ch===')')d=Math.max(0,d-1);cur+=ch;if(ch==='。'&&!d){out.push(cur);cur=''}}out.push(cur);return out.map(x=>x.trim()).filter(Boolean)}
/* message item → [kind, html] */
function render(it){
  if(typeof it==='string')return['t','<p>'+md(it)+'</p>'];
  if(it.quote){const q=it.quote;return['q',`<div class="qhead">${esc(q.speaker||'课文')}</div><div class="qid">${I(q.id)}</div>`+(q.cn?`<button class="cnbtn" type="button">看中文</button><div class="qcn" hidden>${esc(q.cn)}</div>`:'')]}
  if(it.table)return['t','<table class="cmp">'+it.table.map(r=>`<tr><td>${W(r[0])}</td><td>${md(r[1])}</td></tr>`).join('')+'</table>'];
  if(it.chunks)return['t','<div class="chunks">'+it.chunks.map(r=>`<div class="ck"><span class="a">${esc(r[0])}</span><span class="b">${md(r[1])}</span>${r[2]?`<span class="c">${md(r[2])}</span>`:''}</div>`).join('')+'</div>'];
  if(it.from){/* reuse an existing lesson field verbatim */const v=vocabOf(it.word)||{};const txt=v[it.from]||'';
    return['t','<p class="fromlab">词卡原文 · '+esc({synonym_note:'辨析',usage_note:'怎么用',formation:'构词与搭配'}[it.from]||it.from)+'</p>'+sentences(txt).map(x=>'<p>'+md(x)+'</p>').join('')]}
  if(it.tip)return['tip',md(it.tip)];
  if(it.scene)return['scene',md(it.scene)];
  if(it.tag)return['tag',md(it.tag)];

  return['t',md(JSON.stringify(it))];
}

/* ---------------- state ---------------- */
let S,gen=0,lastWho='';
function fresh(){return{simple:$('#dtSimple').checked,t0:Date.now(),pos:0,taught:{},queue:[],
  log:{guess:{},checks:{},backup:{},say:{},recall:{},final:{},scan:[],skipped:{},spoke:0,hints:0}}}
class Abort extends Error{}
const timers=new Set(),intervals=new Set();
function clearTimers(){timers.forEach(([id,resolve])=>{clearTimeout(id);resolve()});timers.clear();intervals.forEach(clearInterval);intervals.clear()}
const wait=ms=>new Promise(resolve=>{const entry=[setTimeout(()=>{timers.delete(entry);resolve()},RM?0:ms),resolve];timers.add(entry)});
function guard(g){if(g!==gen)throw new Abort()}
function scrollEnd(){const main=$('main');main.scrollTo({top:main.scrollHeight,behavior:RM?'auto':'smooth'})}
function add(k,html,src){
  if(k==='t'&&lastWho!=='teacher'){const w=document.createElement('div');w.className='who';w.textContent='老师';thread.appendChild(w)}
  const d=document.createElement('div');d.className='msg '+k;
  d.innerHTML=html+(src&&SRC[src]&&k!=='l'&&k!=='sys'?`<span class="src ${src}">${SRC[src]}</span>`:'');
  thread.appendChild(d);if(k==='t')lastWho='teacher';else if(!/^(fb|hint|ref|tip|q|scene|tag)/.test(k))lastWho=k;return d}
async function say(items,src){const g=gen;for(const it of [].concat(items||[])){await wait(230);guard(g);const [k,h]=render(it);add(k,h,k==='q'||k==='scene'||k==='tag'?null:src);scrollEnd()}}
async function learner(t){const g=gen;add('l',esc(t));scrollEnd();await wait(150);guard(g)}
function sys(t){add('sys',esc(t));lastWho='';scrollEnd()}
/* show buttons, resolve with the chosen button's value */
function ask(btns){const g=gen;return new Promise(res=>{bar.innerHTML='';btns.forEach(b=>{const e=document.createElement('button');e.type='button';e.className=b.cls||'';
  if((b.cls||'').includes('opt')&&/[A-Za-z]{3}/.test(b.label)&&!/[一-鿿]/.test(b.label))e.classList.add('idopt');e.textContent=b.label;
  if(b.wait){e.disabled=true;let n=b.wait;e.textContent=b.waitLabel(n);const iv=setInterval(()=>{if(g!==gen)return clearInterval(iv);n--;if(n<=0){clearInterval(iv);e.disabled=false;e.textContent=b.label}else e.textContent=b.waitLabel(n)},1000);intervals.add(iv)}
  e.onclick=()=>{if(e.disabled||g!==gen)return;bar.innerHTML='<span class="waiting">…</span>';res(b.v===undefined?b.label:b.v)};bar.appendChild(e)})})}
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
const mins=t=>Math.max(1,Math.round((Date.now()-t)/60000));

/* ---------------- units ---------------- */
const ITEMS=TEACH.items||[];const byKey=Object.fromEntries(ITEMS.map(x=>[x.key,x]));
const UNITS=[{type:'intro',label:'开场'}];
ITEMS.forEach(it=>UNITS.push({type:'item',label:it.name,it}));
if(TEACH.scan)UNITS.push({type:'scan',label:'其他新词'});
if(TEACH.reading&&TEACH.reading.length)UNITS.push({type:'reading',label:'课文'});
if(TEACH.dialogue)UNITS.push({type:'dialogue',label:'对话'});
if(TEACH.tasks&&TEACH.tasks.length)UNITS.push({type:'tasks',label:'开口任务'});
UNITS.push({type:'final',label:'收尾'});
UNITS.forEach((u,i)=>{const b=document.createElement('button');b.type='button';b.textContent=u.label;b.onclick=()=>start(i);nav.appendChild(b)});
function navOn(i){[...nav.children].forEach((b,j)=>{b.classList.toggle('on',j===i);b.classList.toggle('done',j<i)});const on=nav.children[i];if(on)nav.scrollLeft=on.offsetLeft-nav.offsetLeft-nav.clientWidth/2+on.clientWidth/2}

async function start(from){gen++;clearTimers();S=fresh();thread.innerHTML='';lastWho='';ITEMS.forEach(it=>(it.asks||[]).forEach(a=>delete a.used));
  try{for(let i=from||0;i<UNITS.length;i++){navOn(i);const u=UNITS[i];
      if(u.type==='final'){await finalUnit();break}
      await RUN[u.type](u);S.pos++;await runDueRecalls()}}
  catch(e){if(!(e instanceof Abort)){console.warn('DeepTeach: 讲解无法继续，回到整页',e);if(overlay.isConnected)close()}}}

/* explanation with optional side questions; returns when the learner asks to be tested */
async function explain(it,nextLabel){
  const simple=S.simple&&it.simple;await say(simple?it.simple:it.explain,'mix');
  const asks=(it.asks||[]).filter(a=>!a.remedy_only);let mode=simple?'simple':'full';
  for(;;){const b=asks.filter(a=>!a.used).map(a=>({label:a.label,cls:'ask',v:a}));
    if(it.simple)b.unshift(mode==='full'?{label:'讲简单一点',cls:'ask',v:'simple'}:{label:'讲详细一点',cls:'ask',v:'full'});
    b.push({label:nextLabel||'懂了，考考我',cls:'primary',v:'go'});
    const c=await ask(b);if(c==='go')return;
    if(c==='simple'||c==='full'){mode=c;await learner(c==='simple'?'讲简单一点':'讲详细一点');await say(c==='simple'?it.simple:it.explain,'mix');continue}
    c.used=true;await learner(c.label);await say(c.from?[{from:c.from,word:c.word||it.word||it.name}]:c.reply,c.from?'card':(c.src||'new'))}
}
/* one multiple-choice check; returns 'right' | 'ok' | 'wrong' */
async function check(q,{tag,first,key}){
  if(tag)await say([{tag}]);await say(q.q,'new');
  const o=await ask(shuffle(q.options).map(o=>({label:o.t,cls:'opt',v:o})));await learner(o.t);
  if(first)S.log.checks[key]=o.v;else S.log.backup[key]=o.v;
  const lab={right:'选对了',ok:'能用，但这里不是最好',wrong:'这里不对'}[o.v];
  add('fb '+o.v,`<span class="pill">${lab}</span>`+o.why.map(w=>'<p>'+md(w)+'</p>').join(''));scrollEnd();
  await ask([{label:o.v==='right'?'继续':'明白了',cls:'primary'}]);return o.v}
/* speaking with graded hints; returns {rate:'yes'|'part'|'no', hinted:bool} */
async function produce(p,{tag,context}){
  if(tag)await say([{tag}]);if(context)await say(context);await say(p.prompt,'new');
  const st={kw:false,skel:false};
  for(;;){const b=[];if(!st.kw)b.push({label:'给我关键词',cls:'ask',v:'kw'});if(!st.skel&&p.skel)b.push({label:'给我句子骨架',cls:'ask',v:'skel'});b.push({label:'我说完了，看参考',cls:'primary',v:'done'});
    const c=await ask(b);if(c==='done')break;st[c]=true;S.log.hints++;
    await learner(c==='kw'?'给我关键词':'给我句子骨架');
    if(c==='kw')add('hint','<span class="lab">关键词</span><div class="chips">'+p.kw.split(' · ').map(x=>`<span class="chip">${esc(x)}</span>`).join('')+'</div>');
    else add('hint','<span class="lab">句子骨架</span><div class="skel">'+esc(p.skel).replace(/_{2,}/g,'<u>&nbsp;</u>')+'</div>');scrollEnd()}
  S.log.spoke++;await learner('我说完了');add('ref','<span class="lab">参考说法</span>'+I(p.ref)+(p.ref_cn?`<div class="qcn">${esc(p.ref_cn)}</div>`:''));scrollEnd();
  if(p.notes&&p.notes.length)await say(p.notes,'new');
  const hinted=st.kw||st.skel;
  const rate=await ask([{label:hinted?'看了提示说出来了':'自己说出来了',v:'yes'},{label:'说了一半',v:'part'},{label:'没说出来',v:'no'}]);
  await learner({yes:hinted?'看了提示说出来了':'自己说出来了',part:'说了一半',no:'没说出来'}[rate]);
  return {rate,hinted}}

const RUN={
 async intro(){sys(LESSON.session==='am'?'今天早上的课':'今晚的课');await say(TEACH.intro);
   await say([{tip:'每个重点先问你，再讲，再考，再让你开口。已经会的点「这个我会，直接考我」就能快进；没听懂就点「讲简单一点」。讲过的东西隔两个环节会换个场景再问你。'}]);
   await ask([{label:'开始上课',cls:'primary'}])},
 async item({it}){
  S.taught[it.key]={pos:S.pos,t:Date.now()};sys(it.head);
  await say((it.scene.quotes||[]).map(q=>({quote:q})));await say(it.scene.ask,'new');
  const c=await ask([...it.scene.options.map(o=>({label:o.t,cls:'opt',v:o})),{label:'这个我会，直接考我',cls:'ask',v:'skip'}]);
  let fast=false;
  if(c==='skip'){fast=true;S.log.skipped[it.key]=true;await learner('这个我会，直接考我');await say(['好，直接考。答对就不多讲。'])}
  else{await learner(c.t);S.log.guess[it.key]=!!c.ok;await say(c.reply,'new');await explain(it)}
  const r=await check(it.check,{tag:'理解检查 · 不计入正式题目和掌握记录',first:true,key:it.key});
  if(r!=='right'){
    if(fast){await say(['那我还是讲一下。'],'new');await explain(it,'懂了，再考一次')}
    else{const rem=(it.asks||[]).find(a=>a.remedy);if(rem){await say(['我换个角度再讲一次。'],'new');rem.used=true;await say(rem.from?[{from:rem.from,word:rem.word||it.name}]:rem.reply,rem.from?'card':(rem.src||'new'))}}
    if(it.check.backup){const r2=await check(it.check.backup,{tag:'换一题',first:false,key:it.key});
      if(r2!=='right')await say(['先记住这一句就够了：',...[].concat(it.simple||[])],'new')}
  }else if(fast){await say(['确实会了。'],'new')}
  const s=await produce(it.say,{tag:'轮到你说'});S.log.say[it.key]=s;
  const independent=s.rate==='yes'&&!s.hinted&&r==='right';
  if(independent){await say([fast?'这个你已经掌握了，中间不再单独考，最后一轮再见。':'很好，没看提示就说出来了。中间不再单独考它，最后一轮再见。'])}
  else{S.queue.push({key:it.key,at:S.pos+1,tries:0});
    await say([s.rate==='yes'?'说出来了，但'+(s.hinted?'看了提示':'前面的题选错了')+'。隔两个环节我会换个场景再问你一次。':'没关系，这正是要练的地方。把参考大声读两遍，隔两个环节我会换个场景再问你。'])}
  await ask([{label:'下一个',cls:'primary'}])},
 async scan(){sys(TEACH.scan.head||'其他新词 · 扫一眼');await say(TEACH.scan.intro||['今天其他的新词，词卡里都有完整讲解。这里只扫一眼：不熟的点一下，标出来给你自己看。']);
  const words=TEACH.scan.words.map(w=>vocabOf(w)).filter(Boolean);
  add('t','<table class="cmp">'+words.map(v=>`<tr><td>${I(v.word)}</td><td>${esc(v.cn)}</td></tr>`).join('')+'</table>');scrollEnd();
  const sel=new Set();
  for(;;){const c=await ask([...words.map(v=>({label:(sel.has(v.word)?'✓ 不熟：':'')+v.word,cls:'scanb'+(sel.has(v.word)?' sel':''),v:v.word})),{label:'扫完了',cls:'primary',v:'done'}]);
    if(c==='done')break;sel.has(c)?sel.delete(c):sel.add(c)}
  S.log.scan=[...sel];await learner(sel.size?'不熟：'+[...sel].join('、'):'都认识');
  await say([sel.size?'好。这几个先记在心里，整页的词卡里有例句和辨析。':'好，继续。'])},
 async reading(){sys(TEACH.reading_head||'课文 · 挑两句拆开讲');
  for(const [i,r] of TEACH.reading.entries()){
   await say([i===0?'先听这一句，试着自己理解，再往下。':'下一句：',{quote:{speaker:'课文',id:r.sentence,cn:r.cn}}]);
   await ask([{label:'我听完了，拆开讲吧',cls:'primary'}]);
   await say([{chunks:r.chunks},...(r.steal||[])],'new');
   if(r.check)await check(r.check,{tag:'理解检查',first:true,key:r.key});
   if(r.say){const s=await produce(r.say,{tag:'轮到你说'});S.log.say[r.key]=s}
   else await ask([{label:'继续',cls:'primary'}])}},
 async dialogue(){const D=TEACH.dialogue,lines=LESSON.dialogue.lines;sys(D.head);await say(D.intro);await ask([{label:'开始',cls:'primary'}]);
  let shown=-1;
  for(const t of D.turns){const ctx=[];for(let i=shown+1;i<t.line;i++)ctx.push({quote:{speaker:lines[i].speaker,id:lines[i].id,cn:lines[i].cn}});
   const line=lines[t.line];shown=t.line;
   const cn=String(line.cn).replace(/（[^（）]*=[^（）]*）/g,'').trim();
   const s=await produce({prompt:[...(t.scene?[{scene:t.scene}]:[]),t.intent,`${line.speaker} 要说：**"${cn}"**`],kw:t.kw,skel:t.skel,ref:line.id,notes:t.notes},{tag:`对话 · 你是 ${line.speaker}`,context:ctx});
   S.log.say['dlg'+t.line]=s}
  const rest=[];for(let i=shown+1;i<lines.length;i++)rest.push({quote:{speaker:lines[i].speaker,id:lines[i].id,cn:lines[i].cn}});
  await say(rest);if(D.tail)await say(D.tail,'new');await ask([{label:'继续',cls:'primary'}])},
 async tasks(){sys('开口任务');for(const t of TEACH.tasks){const s=await produce(t,{tag:'轮到你说'});S.log.say[t.key||'task']=s}}
};

async function runDueRecalls(){
  for(const r of dueRecalls(S.queue,S.pos)){r.done=true;const it=byKey[r.key],t=S.taught[r.key];
    const gap=S.pos-r.at;
    const s=await produce(r.tries?it.recall2||it.recall:it.recall,{tag:`隔时回想 · ${it.name} · ${t?mins(t.t)+' 分钟前讲的，':''}中间隔了 ${gap} 个环节`});
    (S.log.recall[r.key]=S.log.recall[r.key]||[]).push(s);
    if((s.rate!=='yes'||s.hinted)&&r.tries<1){S.queue.push({key:r.key,at:S.pos,tries:1});await say(['这个还不稳，过两个环节再来一次。'])}
    else await say([s.rate==='yes'&&!s.hinted?'好，这次是自己想出来的。':'先这样，最后一轮还会再见。'])}
}
async function finalUnit(){sys('收尾 · 最后一轮');
  await say(['最后一轮，'+ITEMS.length+' 个重点都来。看中文，心里数 3 秒说出来，再看答案。这一轮没有提示。']);
  for(const [i,it] of ITEMS.entries()){await say([{tag:`第 ${i+1}/${ITEMS.length} 题 · ${it.name}`},'**'+it.final.cn+'**']);
    await ask([{label:'想好了，看答案',cls:'primary',wait:3,waitLabel:n=>`想一想… ${n}`}]);
    add('ref',I(it.final.ref));scrollEnd();
    const v=await ask([{label:'马上想到',v:'fast'},{label:'有点慢',v:'slow'},{label:'想不起来',v:'no'}]);
    await learner({fast:'马上想到',slow:'有点慢',no:'想不起来'}[v]);S.log.final[it.key]=v}
  summary()}
function summary(){
  const L=S.log,{weak,good}=classify(L,ITEMS);
  const vals=Object.values(L.say),indep=vals.filter(s=>s.rate==='yes'&&!s.hinted).length,hinted=vals.filter(s=>s.rate==='yes'&&s.hinted).length;
  const nC=Object.keys(L.checks).length,nR=Object.values(L.checks).filter(v=>v==='right').length;
  const h=`<h3>${LESSON.session==='am'?'今天早上':'今晚'}这节课</h3>
  <div class="stats"><div><b>${mins(S.t0)}</b><span>分钟</span></div><div><b>${nR}/${nC}</b><span>理解检查一次就对</span></div><div><b>${indep}</b><span>次独立说出</span></div><div><b>${hinted}</b><span>次看提示后说出</span></div></div>
  ${weak.length?`<h4>下次课前再看一眼</h4><ul>${weak.map(w=>`<li><b>${esc(w.it.name)}</b>：${md(w.it.remind)}<br><small>${esc(w.r.join('；'))}</small></li>`).join('')}</ul>`:''}
  ${good.length?`<h4>已经稳了</h4><p>${good.map(g=>esc(g.it.name)).join('、')}${Object.keys(L.skipped).length?`<br><small>其中快进的：${Object.keys(L.skipped).map(k=>esc(byKey[k].name)).join('、')}</small>`:''}</p>`:''}
  ${L.scan.length?`<h4>扫词时标了不熟</h4><p>${L.scan.map(esc).join('、')}</p>`:''}
  <h4>接下来</h4><p>${esc(TEACH.next||'回到整页做小测、课末回想和「我学完了」。这些都不变。')}</p>
  <p><small>深讲版不保存任何结果，关闭后清空。</small></p>`;
  add('sum',h);scrollEnd();ask([{label:'从头再上一遍',cls:'primary'}]).then(()=>start(0))}

function speak(t){try{const content=t.replace(/_{2,}/g,'…');if(typeof window.speak==='function'){window.speak(content);return}const u=new SpeechSynthesisUtterance(content);u.lang='id-ID';const v=speechSynthesis.getVoices().find(x=>/^id/i.test(x.lang));if(v)u.voice=v;u.rate=.9;speechSynthesis.cancel();speechSynthesis.speak(u)}catch(e){}}
overlay.addEventListener('click',e=>{const b=e.target.closest('.spk');if(b){speak(b.dataset.say);return}
  const c=e.target.closest('.cnbtn');if(c){const d=c.nextElementSibling;d.hidden=!d.hidden;c.textContent=d.hidden?'看中文':'收起中文'}});
$('#dtSimple').onchange=e=>{if(S)S.simple=e.target.checked};
$('#dtSource').onchange=e=>{overlay.classList.toggle('showsrc',e.target.checked)};


function teardown(){gen++;clearTimers();document.removeEventListener('keydown',onKey);hiddenSiblings.forEach(([n,value])=>{n.inert=value});overlay.remove();document.documentElement.style.overflow=overflow;if(previousFocus&&previousFocus.isConnected)previousFocus.focus({preventScroll:true})}
function onKey(e){if(e.key==='Escape'){e.preventDefault();close()}else if(e.key==='Tab'){const controls=[...overlay.querySelectorAll('button,input')].filter(n=>!n.disabled&&n.getClientRects().length);const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}}
document.addEventListener('keydown',onKey);
overlay.querySelector('[data-dt-close]').onclick=()=>close();
active={close:teardown};overlay.querySelector('[data-dt-close]').focus({preventScroll:true});
start(0);return true;
}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-guided-start]');if(!b)return;const m=String(b.dataset.guidedStart||'').match(/^(\d{4}-\d{2}-\d{2})-(am|pm)$/);if(!m)return;e.preventDefault();e.stopImmediatePropagation();launch(m[1],m[2])},true);
if(typeof window.openDaily==='function'){const base=window.openDaily;window.openDaily=async function(){const r=await base.apply(this,arguments);revealStarts().catch(()=>{});return r}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>revealStarts().catch(()=>{}));else revealStarts().catch(()=>{});
window.DeepTeach={open,close,launch,selectTeach,validateShape,dueRecalls,classify,md,revealStarts};
})();
