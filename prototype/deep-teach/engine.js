(function(){
'use strict';
/* Deep-teach lesson engine (demo). Reads LESSON (the published lesson JSON) and TEACH (the teaching layer).
   Adaptive: "这个我会" fast path; a wrong check triggers remediation + a second question; items said
   independently skip the mid-lesson recall; recalls come back only after >= 2 other sections. Nothing is stored. */
const LESSON=window.__LESSON,TEACH=window.__TEACH;
const $=s=>document.querySelector(s);
const thread=$('#thread'),bar=$('#bar'),nav=$('#nav');
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const SPK='<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 6h3l4-3v10l-4-3H2z"/><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M11.2 5.6a3.2 3.2 0 0 1 0 4.8M12.9 3.9a5.6 5.6 0 0 1 0 8.2"/></svg>';
const I=t=>`<span class="id">${esc(t)}<button class="spk" type="button" data-say="${esc(t)}" aria-label="朗读">${SPK}</button></span>`;
const W=t=>`<span class="idw">${esc(t)}</span>`;
/* inline markup: {{印尼语，可朗读}}  [[印尼语，加粗不朗读]]  **加粗**  换行 \n */
function md(s){s=String(s==null?'':s);let out='',last=0,m;const re=/\{\{(.+?)\}\}|\[\[(.+?)\]\]|\*\*(.+?)\*\*/g;
  while((m=re.exec(s))){out+=esc(s.slice(last,m.index)).replace(/\n/g,'<br>');out+=m[1]!=null?I(m[1]):m[2]!=null?W(m[2]):'<b>'+md(m[3])+'</b>';last=re.lastIndex}
  return out+esc(s.slice(last)).replace(/\n/g,'<br>')}
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
  if(it.html)return[it.k||'t',it.html];
  return['t',md(JSON.stringify(it))];
}

/* ---------------- state ---------------- */
let S,gen=0,lastWho='';
function fresh(){return{simple:$('#simpleT').checked,t0:Date.now(),pos:0,taught:{},queue:[],
  log:{guess:{},checks:{},backup:{},say:{},recall:{},final:{},scan:[],skipped:{},spoke:0,hints:0}}}
class Abort extends Error{}
const wait=ms=>new Promise(r=>setTimeout(r,RM?0:ms));
function guard(g){if(g!==gen)throw new Abort()}
function scrollEnd(){window.scrollTo({top:document.documentElement.scrollHeight,behavior:RM?'auto':'smooth'})}
function add(k,html,src){
  if(k==='t'&&lastWho!=='teacher'){const w=document.createElement('div');w.className='who';w.textContent='老师';thread.appendChild(w)}
  const d=document.createElement('div');d.className='msg '+k;
  d.innerHTML=html+(src&&SRC[src]&&k!=='l'&&k!=='sys'?`<span class="src ${src}">${SRC[src]}</span>`:'');
  thread.appendChild(d);if(k==='t')lastWho='teacher';else if(!/^(fb|hint|ref|tip|q|scene|tag)/.test(k))lastWho=k;return d}
async function say(items,src){const g=gen;for(const it of [].concat(items||[])){await wait(230);guard(g);const [k,h]=render(it);add(k,h,k==='q'||k==='scene'||k==='tag'?null:src);scrollEnd()}}
async function learner(t){add('l',esc(t));scrollEnd();await wait(150)}
function sys(t){add('sys',esc(t));lastWho='';scrollEnd()}
/* show buttons, resolve with the chosen button's value */
function ask(btns){const g=gen;return new Promise(res=>{bar.innerHTML='';btns.forEach(b=>{const e=document.createElement('button');e.type='button';e.className=b.cls||'';
  if((b.cls||'').includes('opt')&&/[A-Za-z]{3}/.test(b.label)&&!/[一-鿿]/.test(b.label))e.classList.add('idopt');e.textContent=b.label;
  if(b.wait){e.disabled=true;let n=b.wait;e.textContent=b.waitLabel(n);const iv=setInterval(()=>{if(g!==gen)return clearInterval(iv);n--;if(n<=0){clearInterval(iv);e.disabled=false;e.textContent=b.label}else e.textContent=b.waitLabel(n)},1000)}
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
function navOn(i){[...nav.children].forEach((b,j)=>{b.classList.toggle('on',j===i);b.classList.toggle('done',j<i)});const on=nav.children[i];if(on&&on.scrollIntoView)on.scrollIntoView({block:'nearest',inline:'center'})}

async function start(from){gen++;S=fresh();thread.innerHTML='';lastWho='';ITEMS.forEach(it=>(it.asks||[]).forEach(a=>delete a.used));
  try{for(let i=from||0;i<UNITS.length;i++){navOn(i);const u=UNITS[i];
      if(u.type==='final'){await finalUnit();break}
      await RUN[u.type](u);S.pos++;await dueRecalls()}}
  catch(e){if(!(e instanceof Abort))throw e}}

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
  else{S.queue.push({key:it.key,at:S.pos,tries:0});
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

async function dueRecalls(){
  for(const r of S.queue.filter(r=>!r.done&&S.pos-r.at>=2)){r.done=true;const it=byKey[r.key],t=S.taught[r.key];
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
  const L=S.log,weak=[],good=[];
  for(const it of ITEMS){const k=it.key,r=[];const c=L.checks[k],b=L.backup[k],s=L.say[k],rc=L.recall[k]||[],f=L.final[k];
    if(c&&c!=='right')r.push('理解检查第一次'+(c==='ok'?'选了能用但不够准的':'选错')+(b?'，换一题'+(b==='right'?'答对了':'还是没对'):''));
    if(s){if(s.rate==='no')r.push('第一次开口没说出来');else if(s.rate==='part')r.push('第一次开口只说了一半');else if(s.hinted)r.push('第一次开口看了提示才说出来')}
    rc.forEach((x,i)=>{if(x.rate!=='yes'||x.hinted)r.push(`第 ${i+1} 次隔时回想`+(x.rate==='no'?'没想起来':x.rate==='part'?'只想起一半':'看了提示才说出来'))});
    if(f==='no')r.push('最后一轮想不起来');else if(f==='slow')r.push('最后一轮有点慢');
    (r.length?weak:good).push({it,r})}
  const vals=Object.values(L.say),indep=vals.filter(s=>s.rate==='yes'&&!s.hinted).length,hinted=vals.filter(s=>s.rate==='yes'&&s.hinted).length;
  const nC=Object.keys(L.checks).length,nR=Object.values(L.checks).filter(v=>v==='right').length;
  const h=`<h3>${LESSON.session==='am'?'今天早上':'今晚'}这节课</h3>
  <div class="stats"><div><b>${mins(S.t0)}</b><span>分钟</span></div><div><b>${nR}/${nC}</b><span>理解检查一次就对</span></div><div><b>${indep}</b><span>次独立说出</span></div><div><b>${hinted}</b><span>次看提示后说出</span></div></div>
  ${weak.length?`<h4>下次课前再看一眼</h4><ul>${weak.map(w=>`<li><b>${esc(w.it.name)}</b>：${md(w.it.remind)}<br><small>${esc(w.r.join('；'))}</small></li>`).join('')}</ul>`:''}
  ${good.length?`<h4>已经稳了</h4><p>${good.map(g=>esc(g.it.name)).join('、')}${Object.keys(L.skipped).length?`<br><small>其中快进的：${Object.keys(L.skipped).map(k=>esc(byKey[k].name)).join('、')}</small>`:''}</p>`:''}
  ${L.scan.length?`<h4>扫词时标了不熟</h4><p>${L.scan.map(esc).join('、')}</p>`:''}
  <h4>接下来</h4><p>${esc(TEACH.next||'回到整页做小测、课末回想和「我学完了」。这些都不变。')}</p>
  <p><small>Demo 不保存任何结果，关掉页面就清空。</small></p>`;
  add('sum',h);scrollEnd();ask([{label:'从头再上一遍',cls:'primary'}]).then(()=>start(0))}

function speak(t){try{const u=new SpeechSynthesisUtterance(t.replace(/_{2,}/g,'…'));u.lang='id-ID';const v=speechSynthesis.getVoices().find(x=>/^id/i.test(x.lang));if(v)u.voice=v;u.rate=.9;speechSynthesis.cancel();speechSynthesis.speak(u)}catch(e){}}
document.addEventListener('click',e=>{const b=e.target.closest('.spk');if(b){speak(b.dataset.say);return}
  const c=e.target.closest('.cnbtn');if(c){const d=c.nextElementSibling;d.hidden=!d.hidden;c.textContent=d.hidden?'看中文':'收起中文'}});
$('#simpleT').onchange=e=>{if(S)S.simple=e.target.checked};
$('#srcT').onchange=e=>{document.body.classList.toggle('showsrc',e.target.checked)};
window.__deep={get S(){return S},start};
start(0);
})();
