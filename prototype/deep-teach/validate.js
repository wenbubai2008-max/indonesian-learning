// Draft validator for the teaching layer (what PR 2 would add to validate-lesson-candidate.js).
// node validate.js lesson.json teach.json   → exit 1 on errors; warnings are printed but do not fail.
const fs=require('fs');
const [,,lp,tp]=process.argv;const L=JSON.parse(fs.readFileSync(lp,'utf8')),T=JSON.parse(fs.readFileSync(tp,'utf8'));
const errs=[],warns=[];const E=(c,m)=>errs.push(c+' '+m),Wn=(c,m)=>warns.push(c+' '+m);
const plain=s=>String(s||'').replace(/\{\{|\}\}|\[\[|\]\]|\*\*/g,'');
const norm=s=>plain(s).toLowerCase().replace(/[“”"]/g,'"').replace(/\s+/g,' ').trim();
const texts=[L.reading&&L.reading.text,...(L.sentences||[]).map(s=>s.text),...((L.dialogue&&L.dialogue.lines)||[]).map(l=>l.id),...(L.vocab||[]).map(v=>v.example),
  ...[].concat(L.output||[]).map(o=>o&&o.reference_answer),...[].concat(L.rewrite||[]).map(o=>o&&o.reference_answer)].filter(Boolean).map(norm);
const inLesson=s=>texts.some(t=>t.includes(norm(s).replace(/^…\s*/,'')));
const vocabOf=w=>(L.vocab||[]).find(v=>String(v.word).toLowerCase()===String(w).toLowerCase());
const F=L.lesson_focus;if(!F){E('FOCUS_MISSING','lesson has no lesson_focus');}
function markup(where,s){if(typeof s!=='string')return;const c=(a,b)=>(s.split(a).length-1)!==(s.split(b).length-1);if(c('{{','}}')||c('[[',']]')||(s.split('**').length-1)%2)E('MARKUP',where+': unbalanced {{ }} / [[ ]] / **')}
function walk(where,o){if(typeof o==='string')return markup(where,o);if(Array.isArray(o))return o.forEach((x,i)=>walk(where+'['+i+']',x));if(o&&typeof o==='object')for(const k in o)walk(where+'.'+k,o[k])}
walk('teach',T);
function checkQ(where,q,required){
  if(!q){if(required)E('CHECK_MISSING',where);return}
  if(!q.q||!q.options||q.options.length<2||q.options.length>4)return E('CHECK_INVALID',where+': needs q and 2–4 options');
  const right=q.options.filter(o=>o.v==='right').length;if(right!==1)E('CHECK_RIGHT',where+': exactly one option must be right (found '+right+')');
  q.options.forEach((o,i)=>{if(!['right','ok','wrong'].includes(o.v))E('CHECK_VALUE',where+'.options['+i+']: v must be right|ok|wrong');
    if(!o.why||!o.why.length)E('CHECK_WHY',where+'.options['+i+']: every option needs its own why');
    if(o.v==='ok'&&!/(场合|可以|能说|能用|也有人|也能|口语|正式|书面)/.test(plain(o.why.join(''))))E('CHECK_OK_REASON',where+'.options['+i+']: an "ok" option must say where it is acceptable');
    if(o.v==='wrong'&&o.why.join('').length<12)Wn('CHECK_WHY_SHORT',where+'.options['+i+']: wrong-answer feedback is very short')});
  const ts=q.options.map(o=>norm(o.t));if(new Set(ts).size!==ts.length)E('CHECK_DUP',where+': duplicate options')}
function checkSay(where,p,{newScene}={}){
  if(!p||!p.prompt||!p.ref||!p.kw)return E('SAY_INVALID',where+': needs prompt, kw, ref');
  if(p.skel&&!/_{2,}/.test(p.skel))E('SAY_SKEL',where+': skeleton must contain ____ blanks');
  if(p.skel){const fixed=p.skel.split(/_{2,}/).map(norm).filter(x=>x.replace(/[.,!?]/g,'').trim());let at=0;const r=norm(p.ref);
    for(const f of fixed){const k=r.indexOf(f.trim(),at);if(k<0){E('SAY_SKEL_REF',where+': skeleton text "'+f.trim()+'" is not in the reference');break}at=k+f.trim().length}}
  p.kw.split(' · ').forEach(ch=>{const words=norm(ch).split(/\s+/);if(!words.every(w=>norm(p.ref).includes(w.replace(/[.,!?]/g,''))))Wn('SAY_KW',where+': keyword "'+ch+'" not found in the reference')});
  if(newScene&&inLesson(p.ref))E('RECALL_NOT_NEW',where+': recall/final reference is copied from the lesson; use a new situation')}
const items=T.items||[];
if(F){const want=[...F.words,...F.patterns.map(p=>p.pattern)].map(norm),got=items.map(i=>norm(i.name));
  want.forEach(w=>{if(!got.includes(w))E('ITEM_MISSING','lesson_focus item "'+w+'" has no teaching item')});
  got.forEach(g=>{if(!want.includes(g))E('ITEM_EXTRA','teaching item "'+g+'" is not in lesson_focus')})}
const keys=new Set();
items.forEach((it,n)=>{const w='items['+n+'] '+it.key;
  if(keys.has(it.key))E('ITEM_KEY',w+': duplicate key');keys.add(it.key);
  ['head','remind'].forEach(f=>{if(!it[f])E('ITEM_FIELD',w+': missing '+f)});
  if(!it.scene||!(it.scene.quotes||[]).length||!it.scene.ask||!(it.scene.options||[]).length)E('SCENE_INVALID',w+': scene needs quotes, ask, options');
  else{it.scene.quotes.forEach((q,i)=>{if(!inLesson(q.id))E('SCENE_QUOTE',w+'.scene.quotes['+i+']: not found verbatim in the lesson')});
    if(!it.scene.options.some(o=>o.ok))E('SCENE_OK',w+': scene needs one ok option');it.scene.options.forEach((o,i)=>{if(!o.reply||!o.reply.length)E('SCENE_REPLY',w+'.scene.options['+i+']: needs reply')})}
  if(!it.explain||!it.explain.length||it.explain.length>3)E('EXPLAIN',w+': explain must have 1–3 paragraphs');
  (it.explain||[]).forEach((p,i)=>{if(typeof p==='string'&&plain(p).length>150)Wn('EXPLAIN_LONG',w+'.explain['+i+']: '+plain(p).length+' chars (aim ≤150)')});
  if(!it.simple)E('SIMPLE_MISSING',w+': needs a simple version');else if(plain([].concat(it.simple).join('')).length>90)Wn('SIMPLE_LONG',w+': simple version is '+plain([].concat(it.simple).join('')).length+' chars');
  (it.asks||[]).forEach((a,i)=>{if(!a.label||!(a.reply||a.from))E('ASK_INVALID',w+'.asks['+i+']');
    if(a.from){const v=vocabOf(a.word||it.name);if(!v||!v[a.from])E('ASK_FROM',w+'.asks['+i+']: lesson has no '+a.from+' for '+(a.word||it.name))}});
  if(!(it.asks||[]).some(a=>a.remedy))Wn('REMEDY_MISSING',w+': no remedy ask for a wrong first answer');
  checkQ(w+'.check',it.check,true);checkQ(w+'.check.backup',it.check&&it.check.backup,false);
  if(it.check&&!it.check.backup)Wn('BACKUP_MISSING',w+': no backup question');
  checkSay(w+'.say',it.say);checkSay(w+'.recall',it.recall,{newScene:true});if(it.recall2)checkSay(w+'.recall2',it.recall2,{newScene:true});
  if(!it.final||!it.final.cn||!it.final.ref)E('FINAL_MISSING',w);else{checkSay(w+'.final',{prompt:1,kw:it.final.ref,ref:it.final.ref},{newScene:true});
    const refs=[it.say,it.recall,it.recall2].filter(Boolean).map(x=>norm(x.ref));if(refs.includes(norm(it.final.ref)))E('FINAL_REPEAT',w+': final repeats an earlier reference')}
  if(it.recall&&it.say&&norm(it.recall.ref)===norm(it.say.ref))E('RECALL_REPEAT',w+': recall repeats the speaking reference')});
(T.reading||[]).forEach((r,n)=>{const w='reading['+n+']';
  if(!L.reading||!norm(L.reading.text).includes(norm(r.sentence)))E('READING_SENTENCE',w+': not verbatim in reading.text');
  const joined=norm((r.chunks||[]).map(c=>c[0]).join(' ')).replace(/[.!?]$/,''),sent=norm(r.sentence).replace(/[.!?]$/,'');
  if(joined!==sent)E('READING_CHUNKS',w+': chunks do not add up to the sentence');
  checkQ(w+'.check',r.check,false);if(r.say)checkSay(w+'.say',r.say)});
if(T.dialogue){const lines=(L.dialogue&&L.dialogue.lines)||[];let last=-1;T.dialogue.turns.forEach((t,n)=>{if(!(t.line>last&&t.line<lines.length))E('DIALOGUE_LINE','turns['+n+']: bad line index');last=t.line;
  if(t.skel)checkSay('dialogue.turns['+n+']',{prompt:1,kw:t.kw,skel:t.skel,ref:lines[t.line]?lines[t.line].id:''})})}
if(T.scan){const focus=new Set((F?F.words:[]).map(norm));T.scan.words.forEach(x=>{if(!vocabOf(x))E('SCAN_WORD','"'+x+'" is not a lesson word');if(focus.has(norm(x)))E('SCAN_FOCUS','"'+x+'" is a focus word')});
  const others=(L.new_words||[]).filter(x=>!focus.has(norm(x))&&!T.scan.words.map(norm).includes(norm(x)));if(others.length)Wn('SCAN_INCOMPLETE','new words not in scan: '+others.join(', '))}
(T.tasks||[]).forEach((t,n)=>checkSay('tasks['+n+']',t));
const chars=JSON.stringify(T).length;
console.log(`teach layer: ${items.length} items, ${(T.reading||[]).length} reading sentences, ${T.dialogue?T.dialogue.turns.length+' dialogue turns, ':''}${chars} chars`);
warns.forEach(w=>console.log('  WARN '+w));errs.forEach(e=>console.log('  ERROR '+e));
console.log(errs.length?`FAILED: ${errs.length} error(s), ${warns.length} warning(s)`:`OK (${warns.length} warning(s))`);process.exit(errs.length?1:0);
