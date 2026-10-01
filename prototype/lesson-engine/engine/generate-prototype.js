#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const ROOT=path.resolve(__dirname,'..');
const REPO=path.resolve(ROOT,'../..');
const readJson=p=>JSON.parse(fs.readFileSync(path.resolve(ROOT,p),'utf8'));
const norm=x=>String(x??'').trim().toLowerCase();
const wc=x=>String(x||'').trim().split(/\s+/).filter(Boolean).length;
const uniq=xs=>[...new Set(xs)];
const hash=s=>parseInt(crypto.createHash('sha256').update(String(s)).digest('hex').slice(0,8),16);
const pick=(arr,key)=>arr.length?arr[hash(key)%arr.length]:null;
const parseTime=(date,session)=>Date.parse(date+'T'+(session==='am'?'08:00:00':'18:00:00')+'+07:00');

function loadMaterials(){
  const scenes=readJson('materials/scenes.json');
  const sceneCn=readJson('materials/scene-cn.json');
  const language=readJson('materials/language.json');
  const rules=readJson('materials/lexical-rules.json');
  const tasks=readJson('materials/tasks.json');
  const micro=readJson('materials/microcontent.json');
  const lex=new Map();
  for(let i=1;i<=6;i++){
    const f=readJson('materials/lexicon/eligible-0'+i+'.json');
    for(const e of f.entries)lex.set(norm(e.word),e);
  }
  for(const [word,e] of Object.entries(micro.entries||{}))lex.set(norm(word),{word,...e,_micro:true});
  return {scenes,sceneCn,language,rules,tasks,lex,micro};
}

function loadDailyVocab(){
  const file=path.join(REPO,'data/daily-vocab-data.js');
  if(!fs.existsSync(file))return new Map();
  const s=fs.readFileSync(file,'utf8'),a=s.indexOf('['),b=s.lastIndexOf(']');
  if(a<0||b<a)return new Map();
  const rows=JSON.parse(s.slice(a,b+1));
  return new Map(rows.map(x=>[norm(x.word),x]));
}

function tagWord(word,cn,M){
  const k=norm(word),entry=M.lex.get(k);
  if(entry?.tags?.length)return entry.tags;
  const curated=M.rules.curated?.[k];
  if(curated?.tags?.length)return curated.tags;
  const out=[];
  for(const row of M.rules.chinese_keyword_tags||[]){
    try{if(new RegExp(row.re).test(String(cn||'')))out.push(...row.tags)}catch{}
  }
  return uniq(out.length?out:M.rules.policy.fallback_tags);
}

function candidateRows(ctx,band){
  const key=band==='dont'?'new_dont':'new_fuzzy';
  return (ctx.candidates?.[key]||[]).map((x,i)=>({word:norm(x[0]),cn:x[1],band,index:i}));
}
function oralMap(ctx){
  return new Map((ctx.candidates?.oral||[]).map(x=>[norm(x[0]),{word:norm(x[0]),register:x[1],counterpart:x[2],root:x[3],rank:x[4],band:x[5]}]));
}
const GENERIC_SCENE_TAGS=new Set(['action','communication','description','daily','information','time','connector','movement','problem','feeling','plan','location']);
function sceneFit(row,scene,M){
  const tags=tagWord(row.word,row.cn,M);
  let score=0;
  for(const t of tags){
    if(t===scene.domain)score+=6;
    else if(scene.tags.includes(t))score+=GENERIC_SCENE_TAGS.has(t)?1:3;
  }
  return score;
}
function sceneScore(scene,rows,M,weights={}){
  let score=0;
  for(const r of rows){
    const fit=sceneFit(r,scene,M);
    if(fit)score+=fit*(weights[r.word]||1);
  }
  return score;
}
function chooseSeedScene(ctx,M){
  const oral=oralMap(ctx);
  const base=[...candidateRows(ctx,'dont').slice(0,35),...candidateRows(ctx,'fuzzy').slice(0,35)];
  const weights={};
  base.forEach((r,i)=>weights[r.word]=Math.max(1,4-Math.floor(i/12)));
  for(const [w] of oral)weights[w]=(weights[w]||1)+6;
  const ranked=M.scenes.scenes.map(s=>({scene:s,score:sceneScore(s,base,M,weights)}))
    .sort((a,b)=>b.score-a.score||a.scene.id.localeCompare(b.scene.id));
  const max=ranked[0]?.score||0,top=ranked.filter(x=>x.score>=Math.max(1,max-2)).slice(0,5);
  return pick((top.length?top:ranked).map(x=>x.scene),ctx.target.date+'-'+ctx.target.session+'-scene')||M.scenes.scenes[0];
}
function matchesScene(row,scene,M){
  return sceneFit(row,scene,M)>0;
}
function orderForScene(rows,scene,M){
  return [...rows].sort((a,b)=>{
    const af=sceneFit(a,scene,M),bf=sceneFit(b,scene,M);
    return bf-af||a.index-b.index||a.word.localeCompare(b.word);
  });
}

function selectNew(ctx,scene,M){
  const dont=candidateRows(ctx,'dont'),fuzzy=candidateRows(ctx,'fuzzy');
  const oral=oralMap(ctx),prev=new Set((ctx.previous_pm?.new_words||[]).map(norm));
  const amWords=new Set((ctx.same_day_am?.vocab||[]).map(x=>norm(x[0])));
  const exclude=ctx.target.session==='am'?prev:amWords;
  const D=dont.filter(x=>!exclude.has(x.word)),F=fuzzy.filter(x=>!exclude.has(x.word));
  const oralLegal=[...oral.values()].filter(o=>!exclude.has(o.word)&&(o.band==='dont'||o.band==='fuzzy'));
  const chosen=[];
  const add=r=>{if(r&&!chosen.some(x=>x.word===r.word))chosen.push(r)};
  if(ctx.target.session==='am'){
    const dSlots=Math.min(10,D.length),fSlots=10-dSlots;
    const oralD=oralLegal.filter(o=>o.band==='dont').map(o=>D.find(r=>r.word===o.word)).filter(Boolean);
    const oralF=oralLegal.filter(o=>o.band==='fuzzy').map(o=>F.find(r=>r.word===o.word)).filter(Boolean);
    oralD.slice(0,Math.min(2,dSlots)).forEach(add);
    for(const r of orderForScene(D,scene,M))if(chosen.filter(x=>x.band==='dont').length<dSlots)add(r);
    if(fSlots){
      const need=Math.min(2,oralD.length+oralF.length)-chosen.filter(x=>oral.has(x.word)).length;
      oralF.slice(0,Math.max(0,need)).forEach(add);
      for(const r of orderForScene(F,scene,M))if(chosen.length<10)add(r);
    }
    return chosen.slice(0,10);
  }
  const oralF=oralLegal.filter(o=>o.band==='fuzzy').map(o=>F.find(r=>r.word===o.word)).filter(Boolean);
  const oralD=oralLegal.filter(o=>o.band==='dont').map(o=>D.find(r=>r.word===o.word)).filter(Boolean);
  const fRank=orderForScene(F,scene,M),dRank=orderForScene(D,scene,M);
  add(oralF.find(r=>matchesScene(r,scene,M))||oralF[0]);
  for(const r of fRank)if(chosen.filter(x=>x.band==='fuzzy').length<2)add(r);
  if(chosen.filter(x=>x.band==='fuzzy').length<2)for(const r of F)add(r);
  add(oralD.find(r=>matchesScene(r,scene,M))||null);
  for(const r of dRank)if(chosen.filter(x=>x.band==='dont').length<2)add(r);
  if(!chosen.some(x=>oral.has(x.word))&&oralLegal.length)add((oralLegal[0].band==='dont'?D:F).find(r=>r.word===oralLegal[0].word));
  return chosen.slice(0,Math.min(4,Math.max(3,chosen.length)));
}

function reviewState(ctx){
  const hist=[...(ctx.history_7d||[])].sort((a,b)=>(a.date+a.session).localeCompare(b.date+b.session));
  const exposures=new Map();
  for(const h of hist){
    const t=parseTime(h.date,h.session);
    for(const w0 of h.review_core||[]){
      const w=norm(w0);if(!exposures.has(w))exposures.set(w,[]);
      exposures.get(w).push({date:h.date,session:h.session,time:t});
    }
  }
  return {hist,exposures};
}
function selectReviews(ctx,scene,M,count){
  const {hist,exposures}=reviewState(ctx);
  const focus=new Map((ctx.candidates?.focus||[]).map(x=>[norm(x[0]),Number(x[1])||0]));
  const rows=(ctx.candidates?.review||[]).map((x,i)=>({
    word:norm(x[0]),priority:Number(x[1])||9,wrong:Number(x[2])||0,lastWrong:x[3],lastReview:x[4],
    cn:x[5]||'',root:x[6]||'',root_cn:x[7]||'',index:i
  }));
  const generated=Date.parse(ctx.source?.runtime_generated_at||'');
  const lastHist=hist.at(-1),sameAm=hist.find(x=>x.date===ctx.target.date&&x.session==='am');
  const prevPms=hist.filter(x=>x.session==='pm').slice(-2);
  function fresh(r){
    const ex=exposures.get(r.word)||[],last=ex.at(-1)?.time,lastWrong=Date.parse(r.lastWrong||'');
    return Number.isFinite(last)&&Number.isFinite(lastWrong)&&lastWrong>last&&(!Number.isFinite(generated)||lastWrong<=generated+300000);
  }
  function blocked(r){
    if(fresh(r))return false;
    if(ctx.target.session==='pm'&&(sameAm?.review_core||[]).map(norm).includes(r.word))return true;
    if(ctx.target.session==='am'&&lastHist?.session==='pm'&&(lastHist.review_core||[]).map(norm).includes(r.word))return true;
    if(prevPms.length===2&&prevPms.every(p=>(p.review_core||[]).map(norm).includes(r.word))){
      const days=(Date.parse(ctx.target.date+'T00:00:00Z')-Date.parse(prevPms[1].date+'T00:00:00Z'))/86400000;
      if(days<=3)return true;
    }
    return false;
  }
  const scored=rows.filter(r=>!blocked(r)).map(r=>{
    const ex=(exposures.get(r.word)||[]).length;
    const sceneBonus=sceneFit(r,scene,M)*5;
    const score=(focus.get(r.word)||0)*2+(r.priority===1?45:r.priority===2?20:5)+r.wrong*18+sceneBonus-ex*12;
    return {...r,ex,score,fresh:fresh(r)};
  }).sort((a,b)=>b.score-a.score||a.index-b.index);
  const out=[];let frequent=0;
  for(const r of scored){
    if(r.ex>=3&&!r.fresh&&frequent>=1&&scored.some(x=>x.ex<3&&!out.some(y=>y.word===x.word)))continue;
    out.push(r);if(r.ex>=3&&!r.fresh)frequent++;
    if(out.length===count)break;
  }
  return out;
}

function selectApplications(ctx,scene,M,reviews,count=2){
  if(ctx.target.session!=='pm')return [];
  const used=new Set(reviews.map(x=>x.word));
  const amMeta=new Map((ctx.same_day_am?.vocab||[]).map(x=>[norm(x[0]),x]));
  const amSeen=new Set([...amMeta.keys(),...(ctx.same_day_am?.review_vocab||[]).map(norm)]);
  const rows=(ctx.candidates?.review||[]).map((x,i)=>{
    const a=amMeta.get(norm(x[0]));
    return {word:norm(x[0]),cn:a?.[1]||x[5]||'',en:a?.[2]||'',root:a?.[3]||x[6]||'',root_cn:a?.[4]||x[7]||'',index:i,same_day_am:amSeen.has(norm(x[0]))};
  }).filter(x=>!used.has(x.word));
  const same=orderForScene(rows.filter(x=>x.same_day_am),scene,M);
  const other=orderForScene(rows.filter(x=>!x.same_day_am),scene,M);
  return [...same,...other].slice(0,count);
}

function makeFormation(word,root,entry){
  if(entry?.formation)return entry.formation;
  if(!root||norm(root)===norm(word))return '基础词形；结合例句和常用搭配记忆。';
  return '核心词根：'+root+'；当前词形结合本课例句记忆，避免只靠机械拆词缀。';
}
function buildCard(row,group,ctx,M,daily,oral){
  const k=norm(row.word),lex=M.lex.get(k)||{},d=daily.get(k)||{};
  const reviewRow=(ctx.candidates?.review||[]).find(x=>norm(x[0])===k);
  const cn=lex.cn||row.cn||reviewRow?.[5]||d.cn||'';
  const root=lex.root||row.root||reviewRow?.[6]||d.root||k;
  const rootCn=lex.root_cn||row.root_cn||reviewRow?.[7]||(root===k?cn:'基础词形');
  const en=lex.en||row.en||d.en||cn;
  const example=lex.example||d.example||('Saya sedang mempelajari kata '+k+' dalam konteks sehari-hari.');
  const exampleCn=lex.example_cn||d.example_cn||('我正在日常语境中学习 '+k+' 这个词。');
  const note=lex.synonym_note||lex.note||M.rules.curated?.[k]?.spoken_note||'结合本课语境和常见搭配掌握，不与近义词机械互换。';
  const isNew=group==='new';
  const card={
    word:k,display:k,audio_text:k,cn,en,root,root_cn:rootCn,
    formation:makeFormation(k,root,lex),example,example_cn:exampleCn,synonym_note:note,
    is_oral_new:isNew&&oral.has(k)
  };
  if(ctx.target.session==='pm'){
    const sameDayAm=new Set([...(ctx.same_day_am?.vocab||[]).map(x=>norm(x[0])),...(ctx.same_day_am?.review_vocab||[]).map(norm)]);
    card.usage_note=group==='application'
      ?(sameDayAm.has(k)?'今天08:00已教；晚课作为 application 主动复现。':'已正式学习；晚课作为 application 主动复现。')
      :group==='review'?'已正式学习；本晚课进行主动复习。'
      :(lex.note||'本晚课新词；先掌握常见搭配和自然语境。');
    card.source_group=group;card.is_new=isNew;
  }
  return card;
}

function readingFor(scene,cards,M,key){
  const cn=M.sceneCn.scenes[scene.id];
  const pairs=[];
  const oi=hash(key+'open')%scene.openings.length;
  pairs.push([scene.openings[oi],cn.openings[oi]]);
  const candidates=cards.filter(c=>{
    const tags=tagWord(c.word,c.cn,M);
    return sceneFit(c,scene,M)>=3&&c.example&&c.example_cn&&!/^(jangan|tolong|coba|biar)\b/i.test(c.example);
  }).slice(0,4).map(c=>[c.example,c.example_cn]);
  const moves=scene.moves.map((x,i)=>[x,cn.moves[i]]);
  const closei=hash(key+'close')%scene.closing.length,closing=[scene.closing[closei],cn.closing[closei]];
  let i=0,j=0;
  while((i<moves.length||j<candidates.length)&&wc(pairs.map(x=>x[0]).join(' '))<92){
    if(i<moves.length)pairs.push(moves[i++]);
    if(j<candidates.length)pairs.push(candidates[j++]);
  }
  if(wc(pairs.map(x=>x[0]).join(' '))<80){
    while(i<moves.length&&wc(pairs.map(x=>x[0]).join(' '))<98)pairs.push(moves[i++]);
  }
  pairs.push(closing);
  while(wc(pairs.map(x=>x[0]).join(' '))>120&&pairs.length>4)pairs.splice(-2,1);
  return {text:pairs.map(x=>x[0]).join(' '),cn:pairs.map(x=>x[1]).join(' ')};
}

function dialogueFor(scene,M,key){
  const lines=[];let speaker='A';
  for(const move of scene.dialogue||[]){
    const variants=M.language.dialogue_moves[move]||[];
    if(!variants.length)continue;
    const v=pick(variants,key+move);
    lines.push({speaker,id:v[0],cn:v[1]});speaker=speaker==='A'?'B':'A';
  }
  return {title:'真实口语｜'+scene.title,lines};
}
function optionSet(correct,pool,key){
  const others=uniq(pool.filter(x=>x&&x!==correct));
  const chosen=[correct,...others.sort((a,b)=>hash(key+a)-hash(key+b)).slice(0,3)];
  const n=hash(key+'rot')%chosen.length,rotated=chosen.slice(n).concat(chosen.slice(0,n));
  return {options:rotated,answer_index:rotated.indexOf(correct),answer:correct};
}
function fillFromCard(card){
  const escaped=card.word.replace(/[-\/\\^$*+?.()|[\]{}]/g,'\\$&');
  const re=new RegExp(escaped,'i');
  let prompt=card.example;
  if(re.test(prompt))prompt=prompt.replace(re,'_____');
  else prompt='Saya memakai kata _____ dalam konteks yang tepat.';
  return {type:'fill',prompt:'填空：'+prompt+'（'+card.cn+'）',answer:card.word,explain:card.word+' = '+card.cn+'。'};
}
function orderQuestion(cards){
  const c=cards.find(x=>wc(x.example)>=5&&wc(x.example)<=8&&!/[,:;]/.test(x.example))||null;
  const answer=c?.example||'Kami mulai bekerja lagi setelah makan siang.';
  return {type:'order',prompt:'按照中文排列印尼语：'+(c?.example_cn||'午饭后我们又开始工作。'),tokens:answer.trim().split(/\s+/),answer,answer_cn:c?.example_cn||'午饭后我们又开始工作。',explain:'按自然印尼语语序还原完整句子。'};
}
function outputFrame(scene,M){
  const scored=M.tasks.output_frames.map(f=>({
    frame:f,
    score:f.tags.reduce((n,t)=>n+(t===scene.domain?6:scene.tags.includes(t)?(GENERIC_SCENE_TAGS.has(t)?1:3):0),0)
  })).sort((a,b)=>b.score-a.score||a.frame.id.localeCompare(b.frame.id));
  const best=scored[0]?.score||0;
  const top=scored.filter(x=>x.score===best&&best>0).map(x=>x.frame);
  return pick(top.length?top:M.tasks.output_frames,scene.id)||M.tasks.output_frames[0];
}

function generate(ctx){
  const M=loadMaterials(),daily=loadDailyVocab(),oral=oralMap(ctx);
  const scene=chooseSeedScene(ctx,M);
  const newRows=selectNew(ctx,scene,M);
  const reviews=selectReviews(ctx,scene,M,ctx.target.session==='am'?5:4);
  const apps=selectApplications(ctx,scene,M,reviews,2);
  const newCards=newRows.map(r=>buildCard(r,'new',ctx,M,daily,oral));
  const reviewCards=reviews.map(r=>buildCard(r,'review',ctx,M,daily,oral));
  const appCards=apps.map(r=>buildCard(r,'application',ctx,M,daily,oral));
  const cards=[...newCards,...reviewCards,...appCards];
  const key=ctx.target.date+'-'+ctx.target.session+'-'+newRows.map(x=>x.word).join('|');
  const reading=readingFor(scene,cards,M,key);
  const time=ctx.target.session==='am'?'08:00':'18:00';
  const base={
    date:ctx.target.date,session:ctx.target.session,time,day:ctx.target.day,
    level:'A2+ → B1',duration_minutes:30,title:time+' '+(ctx.target.session==='am'?'早课':'晚课')+'｜'+scene.title,
    _prototype:{engine_version:1,scene_id:scene.id,deterministic:true,production_write:false}
  };
  if(ctx.target.session==='am'){
    const pool=cards.map(x=>x.word),r=reviewCards[0],q1=optionSet(r.word,pool,key+'q1'),n1=newCards[0],q2=optionSet(n1.word,pool,key+'q2'),n2=newCards[1]||n1,q3=optionSet(n2.word,pool,key+'q3');
    const out=outputFrame(scene,M);
    return {...base,new_words:newCards.map(x=>x.word),vocab:newCards,review_vocab:reviewCards.map(x=>x.word),
      sentences:newCards.slice(0,5).map(x=>({text:x.example,cn:x.example_cn})),reading,
      quiz:[
        {question:'哪个复习词表示“'+r.cn+'”？',...q1,explain:r.word+' = '+r.cn+'。'},
        {question:'哪个新词表示“'+n1.cn+'”？',...q2,explain:n1.word+' = '+n1.cn+'。'},
        {question:'哪个新词表示“'+n2.cn+'”？',...q3,explain:n2.word+' = '+n2.cn+'。'}
      ],
      output:{task:out.task+' 本课可用词：'+newCards.slice(0,5).map(x=>x.word).join('、')+'。',reference_answer:out.answer,reference_cn:out.cn},
      review:[
        '3秒主动回忆：'+newCards.slice(0,5).map(x=>x.word).join('、')+'。',
        '再看后5个新词，只说常见搭配和使用场景，不先背中文。',
        '复习 '+reviewCards.map(x=>x.word).join('、')+'，任选两个做主动输出。'
      ]};
  }
  const allWords=cards.map(x=>x.word),choices=[newCards[0],reviewCards[0],newCards[1]].map((c,i)=>{
    const o=optionSet(c.word,allWords,key+'pmq'+i);
    return {type:'choice',prompt:'哪个词表示“'+c.cn+'”？',...o,explain:c.word+' = '+c.cn+'。'};
  });
  const fills=[fillFromCard(newCards[0]),fillFromCard(newCards[1]||newCards[0])];
  const rewrite=[];
  for(const c of newCards.slice(0,2))rewrite.push({task:'中译印：'+c.example_cn+'（使用 '+c.word+'）',reference_answer:c.example,reference_cn:c.example_cn});
  if(appCards[0]){
    const amSet=new Set([...(ctx.same_day_am?.vocab||[]).map(x=>norm(x[0])),...(ctx.same_day_am?.review_vocab||[]).map(norm)]);
    rewrite.push({task:(amSet.has(appCards[0].word)?'主动复现今天08:00词 ':'主动复现已学词 ')+appCards[0].word+'：'+appCards[0].example_cn,reference_answer:appCards[0].example,reference_cn:appCards[0].example_cn});
  }
  if(reviewCards[0])rewrite.push({task:'复习输出：'+reviewCards[0].example_cn+'（使用 '+reviewCards[0].word+'）',reference_answer:reviewCards[0].example,reference_cn:reviewCards[0].example_cn});
  return {...base,write_status:'lesson_complete',new_words:newCards.map(x=>x.word),vocab:cards,reading,
    dialogue:dialogueFor(scene,M,key),rewrite:rewrite.slice(0,4),
    daily_test:{questions:[...choices,...fills,orderQuestion(cards)],self_check:[
      '遮住中文，3秒内说出 '+newCards.map(x=>x.word).join(' / ')+' 的意思和一个常见搭配。',
      '主动复习 '+reviewCards.map(x=>x.word).join(' / ')+'，不要只做识别。',
      appCards.length?'复现今天08:00的 '+appCards.map(x=>x.word).join(' / ')+'。':'复述晚课场景。'
    ]},
    review:{title:'最后5分钟复盘',steps:[
      '连续说出晚课新词并各造一个短句。',
      '用两个复习词重新讲一遍今天的场景。',
      '用30秒复述 '+scene.title+'，优先自然表达，不强塞所有目标词。'
    ]}};
}

if(require.main===module){
  const input=process.argv[2]||path.join(REPO,'data/lesson-context.json');
  const ctx=JSON.parse(fs.readFileSync(path.resolve(process.cwd(),input),'utf8'));
  process.stdout.write(JSON.stringify(generate(ctx),null,2)+'\n');
}
module.exports={generate,loadMaterials,loadDailyVocab,tagWord,sceneFit,selectNew,selectReviews,selectApplications,chooseSeedScene};
