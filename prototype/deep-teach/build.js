// node build.js lesson.json teach.json out.html
const fs=require('fs'),path=require('path');
const [,,lp,tp,out]=process.argv;const L=JSON.parse(fs.readFileSync(lp,'utf8')),T=JSON.parse(fs.readFileSync(tp,'utf8'));
const dir=__dirname,css=fs.readFileSync(path.join(dir,'style.css'),'utf8'),eng=fs.readFileSync(path.join(dir,'engine.js'),'utf8');
const lesson={date:L.date,session:L.session,title:L.title,vocab:(L.vocab||[]).map(v=>({word:v.word,cn:v.cn,formation:v.formation,synonym_note:v.synonym_note,usage_note:v.usage_note,example:v.example,example_cn:v.example_cn})),dialogue:L.dialogue||null};
const j=o=>JSON.stringify(o).replace(/</g,'\\u003c');
const sub=String(L.title||'').replace(/^\d\d:\d\d\s*/,'');
const html=`<title>${T.title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&display=swap">
${css}
<header><div class="wrap"><div class="hrow"><div class="htitle"><b>${T.title}</b><span>${L.date} ${L.session==='am'?'早课':'晚课'} · ${sub.split(' · ').pop().replace(/</g,'&lt;')}</span></div>
<div class="toggles"><label class="tg" for="simpleT"><input type="checkbox" id="simpleT">简明讲解</label><label class="tg" for="srcT"><input type="checkbox" id="srcT">标出内容来源</label></div></div>
<nav id="nav" aria-label="课程环节"></nav></div></header>
<main class="wrap"><div class="notice">深讲版试玩：内容来自 ${L.date} ${L.session==='am'?'早课':'晚课'}的真实课程。不保存任何记录，不影响网站上的正式课程。</div><div id="thread" aria-live="polite"></div></main>
<div class="bar"><div class="wrap" id="bar"></div></div>
<script>window.__LESSON=${j(lesson)};window.__TEACH=${j(T)};</script>
<script>
${eng}
</script>
`;
fs.writeFileSync(out,html);console.log('built',out,(html.length/1024).toFixed(1)+'KB');
