(function(root,factory){
  if(typeof module==='object'&&module.exports) module.exports=factory();
  else root.LessonEngineCore=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const norm=x=>String(x??'').trim().toLowerCase();
  const uniq=xs=>[...new Set(xs)];
  const wc=s=>String(s||'').trim().split(/\s+/).filter(Boolean).length;
  function hash(s){
    let h=2166136261>>>0;
    for(const ch of String(s)) h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;
    return h>>>0;
  }
  const pick=(arr,key)=>arr.length?arr[hash(key)%arr.length]:null;
  const parseTime=(date,session)=>Date.parse(date+'T'+(session==='am'?'08:00:00':'18:00:00')+'+07:00');

  function prepare(bundle,dailyRows=[]){
    const M=bundle.materials||bundle;
    const lex=new Map((M['eligible-lexicon']?.entries||[]).map(e=>[norm(e.word),e]));
    for(const [w,e] of Object.entries(M.microcontent?.entries||{})) lex.set(norm(w),{word:w,...e,_micro:true});
    const daily=new Map((dailyRows||[]).map(x=>[norm(x.word),x]));
    return {M,lex,daily};
  }

  function oralMap(ctx){
    return new Map((ctx.candidates?.oral||[]).map(x=>[norm(x[0]),{
      word:norm(x[0]),register:x[1],counterpart:norm(x[2]),root:x[3],rank:Number(x[4])||9999,band:x[5]
    }]));
  }
  function candidateRows(ctx,band){
    const key=band==='dont'?'new_dont':'new_fuzzy';
    return (ctx.candidates?.[key]||[]).map((x,i)=>({word:norm(x[0]),cn:x[1],band,index:i}));
  }
  function tagWord(word,cn,env){
    const {M,lex}=env,k=norm(word),e=lex.get(k);
    if(e?.tags?.length)return e.tags;
    const cur=M['lexical-rules']?.curated?.[k];
    if(cur?.tags?.length)return cur.tags;
    const out=[];
    for(const row of M['lexical-rules']?.chinese_keyword_tags||[]){
      try{if(new RegExp(row.re).test(String(cn||'')))out.push(...row.tags)}catch{}
    }
    return uniq(out.length?out:['daily']);
  }
  const genericTags=new Set(['action','communication','description','daily','information','time','connector','movement','problem','feeling','plan','location']);
  function sceneFit(row,scene,env){
    let score=0;
    for(const t of tagWord(row.word,row.cn,env)){
      if(t===scene.domain)score+=7;
      else if(scene.tags.includes(t))score+=genericTags.has(t)?1:3;
    }
    return score;
  }

  function sameOralFamily(a,b,oral){
    if(a===b)return true;
    const oa=oral.get(a),ob=oral.get(b);
    return !!(oa?.counterpart&&oa.counterpart===b)||!!(ob?.counterpart&&ob.counterpart===a);
  }
  function pushUnique(out,row,oral){
    if(!row||out.some(x=>sameOralFamily(x.word,row.word,oral)))return false;
    out.push(row);return true;
  }

  function selectNew(ctx,variant=0){
    const oral=oralMap(ctx),prev=new Set((ctx.previous_pm?.new_words||[]).map(norm));
    const sameAm=new Set((ctx.same_day_am?.vocab||[]).map(x=>norm(x[0])));
    const exclude=ctx.target.session==='am'?prev:sameAm;
    const D=candidateRows(ctx,'dont').filter(x=>!exclude.has(x.word));
    const F=candidateRows(ctx,'fuzzy').filter(x=>!exclude.has(x.word));
    const oralIn=(rows,band)=>[...oral.values()].filter(o=>o.band===band)
      .map(o=>rows.find(r=>r.word===o.word)).filter(Boolean)
      .sort((a,b)=>(oral.get(a.word)?.rank||9999)-(oral.get(b.word)?.rank||9999)||a.index-b.index);
    const out=[];

    if(ctx.target.session==='am'){
      const dSlots=Math.min(10,D.length),fSlots=10-dSlots;
      for(const r of oralIn(D,'dont').slice(0,2))pushUnique(out,r,oral);
      for(const r of D)if(out.filter(x=>x.band==='dont').length<dSlots)pushUnique(out,r,oral);
      if(fSlots){
        const oralNeed=Math.max(0,2-out.filter(x=>oral.has(x.word)).length);
        for(const r of oralIn(F,'fuzzy').slice(0,oralNeed))pushUnique(out,r,oral);
        for(const r of F)if(out.length<10)pushUnique(out,r,oral);
      }
      return out.slice(0,10);
    }

    const wantF=Math.min(2,F.length),wantD=Math.min(2,D.length);
    const chosenF=[],chosenD=[];
    const addBand=(bucket,row)=>{if(row&&!out.some(x=>sameOralFamily(x.word,row.word,oral))&&!bucket.some(x=>sameOralFamily(x.word,row.word,oral))){bucket.push(row);return true}return false};
    const legalOralF=oralIn(F,'fuzzy'),legalOralD=oralIn(D,'dont');
    const preferredOral=(variant%2===0?legalOralF:legalOralD)[0]||legalOralF[0]||legalOralD[0];
    if(preferredOral)(preferredOral.band==='fuzzy'?addBand(chosenF,preferredOral):addBand(chosenD,preferredOral));
    for(const r of F)if(chosenF.length<wantF)addBand(chosenF,r);
    for(const r of D)if(chosenD.length<wantD)addBand(chosenD,r);
    out.push(...chosenF,...chosenD);
    const pool=[...F,...D];
    for(const r of pool)if(out.length<4)pushUnique(out,r,oral);
    return out.slice(0,Math.min(4,Math.max(3,out.length)));
  }

  function reviewHistory(ctx){
    const hist=[...(ctx.history_7d||[])].sort((a,b)=>(a.date+a.session).localeCompare(b.date+b.session));
    const exp=new Map();
    for(const h of hist){
      const t=parseTime(h.date,h.session);
      for(const w0 of h.review_core||[]){
        const w=norm(w0);if(!exp.has(w))exp.set(w,[]);
        exp.get(w).push({date:h.date,session:h.session,time:t});
      }
    }
    return {hist,exp};
  }
  function reviewCandidates(ctx){
    const {hist,exp}=reviewHistory(ctx),focus=new Map((ctx.candidates?.focus||[]).map(x=>[norm(x[0]),Number(x[1])||0]));
    const generated=Date.parse(ctx.source?.runtime_generated_at||'');
    const sameAm=hist.find(x=>x.date===ctx.target.date&&x.session==='am');
    const last=hist.at(-1),prevPms=hist.filter(x=>x.session==='pm').slice(-2);
    function freshWrong(r){
      const es=exp.get(r.word)||[],lastSeen=es.at(-1)?.time,lastWrong=Date.parse(r.lastWrong||'');
      return Number.isFinite(lastSeen)&&Number.isFinite(lastWrong)&&lastWrong>lastSeen&&(!Number.isFinite(generated)||lastWrong<=generated+300000);
    }
    function cooling(r){
      if(freshWrong(r))return false;
      if(ctx.target.session==='pm'&&(sameAm?.review_core||[]).map(norm).includes(r.word))return true;
      if(ctx.target.session==='am'&&last?.session==='pm'&&(last.review_core||[]).map(norm).includes(r.word))return true;
      if(prevPms.length===2&&prevPms.every(p=>(p.review_core||[]).map(norm).includes(r.word))){
        const days=(Date.parse(ctx.target.date+'T00:00:00Z')-Date.parse(prevPms[1].date+'T00:00:00Z'))/86400000;
        if(days<=3)return true;
      }
      return false;
    }
    return (ctx.candidates?.review||[]).map((x,i)=>{
      const r={word:norm(x[0]),priority:Number(x[1])||9,wrong:Number(x[2])||0,lastWrong:x[3],lastReview:x[4],
        cn:x[5]||'',root:x[6]||'',root_cn:x[7]||'',index:i};
      const exposure=(exp.get(r.word)||[]).length,fresh=freshWrong(r),blocked=cooling(r),focusScore=focus.get(r.word)||0;
      const score=(fresh?1000:0)+(r.priority===1?180:r.priority===2?70:10)+r.wrong*30+focusScore*2-exposure*20;
      return {...r,exposure,fresh,blocked,focusScore,score};
    });
  }
  function pmCorePlan(ctx,newCount){
    const available=reviewCandidates(ctx).filter(x=>!x.blocked);
    const pressure=available.filter(x=>x.fresh||x.priority===1||x.focusScore>=60).length;
    let total=10;
    if(pressure>=10)total=12; else if(pressure>=5)total=11;
    let apps=total===12?3:2;
    let reviews=total-newCount-apps;
    reviews=Math.max(4,Math.min(6,reviews));
    if(newCount+reviews+apps<total&&apps<3)apps++;
    if(newCount+reviews+apps<total&&reviews<6)reviews++;
    return {total,reviews,apps,pressure};
  }
  function selectReviews(ctx,count){
    const rows=reviewCandidates(ctx).filter(x=>!x.blocked)
      .sort((a,b)=>b.score-a.score||a.index-b.index);
    const out=[];let repeated=0;
    for(const r of rows){
      if(r.exposure>=3&&!r.fresh&&repeated>=1&&rows.some(x=>x.exposure<3&&!out.some(y=>y.word===x.word)))continue;
      out.push(r);if(r.exposure>=3&&!r.fresh)repeated++;
      if(out.length===count)break;
    }
    return out;
  }
  function selectApplications(ctx,reviews,count){
    if(ctx.target.session!=='pm')return [];
    const reviewRows=(ctx.candidates?.review||[]).map((x,i)=>({word:norm(x[0]),cn:x[5]||'',root:x[6]||'',root_cn:x[7]||'',index:i}));
    const legal=new Map(reviewRows.map(x=>[x.word,x])),used=new Set(reviews.map(x=>x.word));
    const amMeta=new Map((ctx.same_day_am?.vocab||[]).map(x=>[norm(x[0]),x]));
    const amReview=new Set((ctx.same_day_am?.review_vocab||[]).map(norm));
    const out=[];
    const add=w=>{
      w=norm(w);if(used.has(w)||out.some(x=>x.word===w)||!legal.has(w))return;
      const base=legal.get(w),a=amMeta.get(w);
      out.push({...base,cn:a?.[1]||base.cn,en:a?.[2]||'',root:a?.[3]||base.root,root_cn:a?.[4]||base.root_cn,same_day_am:amMeta.has(w)||amReview.has(w)});
    };
    for(const w of amMeta.keys())add(w);
    for(const w of amReview)add(w);
    for(const r of reviewCandidates(ctx).filter(x=>!x.blocked).sort((a,b)=>b.score-a.score||a.index-b.index))add(r.word);
    return out.slice(0,count);
  }

  function chooseScene(cards,env,variant=0){
    const ranked=env.M.scenes.scenes.map(scene=>{
      let score=0,covered=0;
      for(const c of cards){
        const fit=sceneFit(c,scene,env),weight=c.group==='new'?6:c.group==='application'?3:2;
        score+=fit*weight;if(fit>=3)covered++;
      }
      return {scene,score,covered};
    }).sort((a,b)=>b.covered-a.covered||b.score-a.score||a.scene.id.localeCompare(b.scene.id));
    const best=ranked[0]?.covered||0;
    const top=ranked.filter(x=>x.covered>=Math.max(1,best-1)).slice(0,6);
    return (top.length?top:ranked)[variant%(top.length||ranked.length)]?.scene||env.M.scenes.scenes[0];
  }

  function deriveCollocations(entry,word,env){
    const curated=env.M['lexical-rules']?.curated?.[norm(word)]?.collocations||[];
    if(curated.length)return curated.slice(0,4);
    if(entry?.collocations?.length)return entry.collocations.slice(0,4);
    const ex=String(entry?.example||'').replace(/[.,!?;:]/g,'').split(/\s+/);
    const i=ex.findIndex(x=>norm(x)===norm(word));
    const out=[];
    if(i>=0){
      if(ex[i+1])out.push(ex.slice(i,Math.min(ex.length,i+3)).join(' '));
      if(i>0)out.push(ex.slice(Math.max(0,i-1),Math.min(ex.length,i+2)).join(' '));
    }
    return uniq(out).slice(0,2);
  }
  function formationFor(word,root,entry,collocations){
    if(entry?.formation)return entry.formation;
    const w=norm(word),r=norm(root);
    let morph='';
    if(r&&r!==w){
      const suffix=w.endsWith('kan')?'+ -kan':w.endsWith('i')?'+ -i':w.endsWith('an')?'+ -an':'';
      const prefix=w.startsWith('meng')?'meng-':w.startsWith('meny')?'meny-':w.startsWith('men')?'men-':w.startsWith('mem')?'mem-':w.startsWith('me')?'me-':
        w.startsWith('ber')?'ber-':w.startsWith('ter')?'ter-':w.startsWith('ke')&&w.endsWith('an')?'ke-...-an':w.startsWith('pe')?'pe-':'';
      if(prefix)morph=prefix+' + '+root+(suffix?' '+suffix:'')+'。';
      else morph='来自词根 '+root+'。';
    }
    if(collocations.length)return (morph?morph+' ':'')+'常见搭配：'+collocations.join('、')+'。';
    return morph||'基础词形；结合本课例句与真实语境掌握。';
  }
  function buildCard(row,group,ctx,env){
    const {lex,daily,M}=env,k=norm(row.word),e=lex.get(k)||{},d=daily.get(k)||{};
    const rr=(ctx.candidates?.review||[]).find(x=>norm(x[0])===k);
    const cn=e.cn||row.cn||rr?.[5]||d.cn||'',root=e.root||row.root||rr?.[6]||d.root||k;
    const rootCn=e.root_cn||row.root_cn||rr?.[7]||d.root_cn||(root===k?cn:'');
    const collocations=deriveCollocations(e,k,env);
    const card={
      word:k,display:k,audio_text:k,cn,en:e.en||row.en||d.en||cn,
      root,root_cn:rootCn,formation:formationFor(k,root,e,collocations),
      example:e.example||d.example||('Saya memakai kata '+k+' dalam kalimat sehari-hari.'),
      example_cn:e.example_cn||d.example_cn||('我在日常句子中使用 '+k+' 这个词。'),
      synonym_note:e.synonym_note||M['lexical-rules']?.curated?.[k]?.spoken_note||e.note||'注意结合语境与常见搭配使用。',
      is_oral_new:group==='new'&&oralMap(ctx).has(k),
      _collocations:collocations
    };
    if(ctx.target.session==='pm'){
      const sameDay=new Set([...(ctx.same_day_am?.vocab||[]).map(x=>norm(x[0])),...(ctx.same_day_am?.review_vocab||[]).map(norm)]);
      card.usage_note=group==='application'
        ?(sameDay.has(k)?'今天08:00已教；晚课作为 application 主动复现。':'已正式学习；晚课作为 application 主动复现。')
        :group==='review'?'已正式学习；本晚课进行主动复习。'
        :(e.note||'本晚课新词；重点掌握常见搭配、语体和3秒主动提取。');
      card.source_group=group;card.is_new=group==='new';
    }
    return card;
  }

  function targetReadingCards(cards,scene,env,session){
    const newCards=cards.filter(x=>x.group==='new'),review=cards.filter(x=>x.group==='review'),apps=cards.filter(x=>x.group==='application');
    const usable=c=>c.example&&c.example_cn&&!/^(jangan|tolong|coba|biar)\b/i.test(c.example);
    const rank=xs=>[...xs].filter(usable).sort((a,b)=>sceneFit(b,scene,env)-sceneFit(a,scene,env));
    if(session==='am'){
      const ns=rank(newCards),rs=rank(review);
      const strong=ns.filter(x=>sceneFit(x,scene,env)>=2).slice(0,8);
      for(const x of ns)if(strong.length<6&&!strong.includes(x))strong.push(x);
      return [...strong.slice(0,8),...rs.filter(x=>sceneFit(x,scene,env)>=2).slice(0,3)];
    }
    const ns=rank(newCards),others=rank([...review,...apps]);
    return [...ns,...others.filter(x=>sceneFit(x,scene,env)>=2).slice(0,4)];
  }
  function readingFor(scene,cards,env,key,session){
    const cn=env.M['scene-cn'].scenes[scene.id],pairs=[];
    const oi=hash(key+'open')%scene.openings.length;
    pairs.push([scene.openings[oi],cn.openings[oi]]);
    const targets=targetReadingCards(cards,scene,env,session).map(c=>[c.example,c.example_cn,c.word,c.group]);
    const moves=scene.moves.map((x,i)=>[x,cn.moves[i],'','scene']);
    let ti=0,mi=0;
    while((ti<targets.length||mi<moves.length)&&wc(pairs.map(x=>x[0]).join(' '))<100){
      if(mi<moves.length)pairs.push(moves[mi++]);
      if(ti<targets.length)pairs.push(targets[ti++]);
    }
    while(mi<moves.length&&wc(pairs.map(x=>x[0]).join(' '))<84)pairs.push(moves[mi++]);
    const ci=hash(key+'close')%scene.closing.length;
    pairs.push([scene.closing[ci],cn.closing[ci],'','scene']);
    while(wc(pairs.map(x=>x[0]).join(' '))>120&&pairs.length>5)pairs.splice(-2,1);
    const text=pairs.map(x=>x[0]).join(' '),translation=pairs.map(x=>x[1]).join(' ');
    const included=cards.filter(c=>norm(text).includes(norm(c.word))).map(c=>({word:c.word,group:c.group}));
    return {text,cn:translation,_coverage:included};
  }

  function dialogueFor(scene,cards,env,key){
    const moves=scene.dialogue||[],lines=[],newCards=cards.filter(x=>x.group==='new'&&x.example),review=cards.filter(x=>x.group==='review'&&x.example),apps=cards.filter(x=>x.group==='application'&&x.example);
    const targets=[...newCards.slice(0,2),...(apps[0]?[apps[0]]:review[0]?[review[0]]:[])];
    let speaker='A',mi=0,ti=0;
    while(lines.length<6){
      if(lines.length%2===0){
        const move=moves[mi++%Math.max(1,moves.length)],vs=env.M.language.dialogue_moves[move]||env.M.language.dialogue_moves.confirm||[];
        const v=pick(vs,key+'m'+lines.length)||['Terus setelah itu bagaimana?','那之后怎么样？'];
        lines.push({speaker,id:v[0],cn:v[1]});
      }else{
        const c=targets[ti++];
        if(c)lines.push({speaker,id:c.example,cn:c.example_cn});
        else{
          const vs=env.M.language.dialogue_moves.confirm||[],v=pick(vs,key+'c'+lines.length)||['Oke, sekarang sudah jelas.','好，现在清楚了。'];
          lines.push({speaker,id:v[0],cn:v[1]});
        }
      }
      speaker=speaker==='A'?'B':'A';
      if(lines.length>=4&&ti>=targets.length&&lines.length%2===0)break;
    }
    const joined=norm(lines.map(x=>x.id).join(' '));
    const coverage=cards.filter(c=>joined.includes(norm(c.word))).map(c=>({word:c.word,group:c.group}));
    return {title:'真实口语｜'+scene.title,lines,_coverage:coverage};
  }

  function optionSet(correct,pool,key){
    const others=uniq(pool.filter(x=>x&&x!==correct)),chosen=[correct,...others.sort((a,b)=>hash(key+a)-hash(key+b)).slice(0,3)];
    const n=hash(key+'rot')%chosen.length,options=chosen.slice(n).concat(chosen.slice(0,n));
    return {options,answer_index:options.indexOf(correct),answer:correct};
  }
  function fillFromCard(card){
    const escaped=card.word.replace(/[-\/\\^$*+?.()|[\]{}]/g,'\\$&'),re=new RegExp(escaped,'i');
    const p=re.test(card.example)?card.example.replace(re,'_____'):'Saya memakai kata _____ dalam konteks yang tepat.';
    return {type:'fill',prompt:'填空：'+p+'（'+card.cn+'）',answer:card.word,explain:card.word+' = '+card.cn+'。'};
  }
  function orderQuestion(cards){
    const c=cards.find(x=>wc(x.example)>=5&&wc(x.example)<=8&&!/[,:;]/.test(x.example));
    const answer=c?.example||'Kami mulai bekerja lagi setelah makan siang.';
    return {type:'order',prompt:'按照中文排列印尼语：'+(c?.example_cn||'午饭后我们又开始工作。'),tokens:answer.trim().split(/\s+/),answer,
      answer_cn:c?.example_cn||'午饭后我们又开始工作。',explain:'按自然印尼语语序还原完整句子。'};
  }

  function generate(ctx,bundle,dailyRows=[],opts={}){
    const variant=Number(opts.variant)||0,env=prepare(bundle,dailyRows);
    const newRows=selectNew(ctx,variant);
    const plan=ctx.target.session==='pm'?pmCorePlan(ctx,newRows.length):{total:15,reviews:5,apps:0,pressure:0};
    const reviews=selectReviews(ctx,ctx.target.session==='am'?5:plan.reviews);
    const apps=selectApplications(ctx,reviews,plan.apps);
    const preCards=[
      ...newRows.map(x=>({...x,group:'new'})),
      ...reviews.map(x=>({...x,group:'review'})),
      ...apps.map(x=>({...x,group:'application'}))
    ];
    const scene=chooseScene(preCards,env,variant);
    const newCards=newRows.map(x=>({...buildCard(x,'new',ctx,env),group:'new'}));
    const reviewCards=reviews.map(x=>({...buildCard(x,'review',ctx,env),group:'review'}));
    const appCards=apps.map(x=>({...buildCard(x,'application',ctx,env),group:'application'}));
    const cards=[...newCards,...reviewCards,...appCards],key=ctx.target.date+'-'+ctx.target.session+'-'+variant+'-'+newRows.map(x=>x.word).join('|');
    const reading=readingFor(scene,cards,env,key,ctx.target.session),time=ctx.target.session==='am'?'08:00':'18:00';
    const base={date:ctx.target.date,session:ctx.target.session,time,day:ctx.target.day,level:'A2+ → B1',duration_minutes:30,
      title:time+' '+(ctx.target.session==='am'?'早课':'晚课')+'｜'+scene.title,
      _prototype:{engine_version:2,scene_id:scene.id,deterministic:true,production_write:false,variant,core_plan:plan,reading_coverage:reading._coverage}};
    delete reading._coverage;

    if(ctx.target.session==='am'){
      const pool=cards.map(x=>x.word),r=reviewCards[0],n1=newCards[0],n2=newCards[1]||n1;
      const out=pick(env.M.tasks.output_frames.filter(f=>f.tags.some(t=>scene.tags.includes(t))),scene.id)||env.M.tasks.output_frames[0];
      return {...base,new_words:newCards.map(x=>x.word),vocab:newCards.map(({group,...x})=>x),review_vocab:reviewCards.map(x=>x.word),
        sentences:newCards.slice(0,5).map(x=>({text:x.example,cn:x.example_cn})),reading,
        quiz:[
          {question:'哪个复习词表示“'+r.cn+'”？',...optionSet(r.word,pool,key+'q1'),explain:r.word+' = '+r.cn+'。'},
          {question:'哪个新词表示“'+n1.cn+'”？',...optionSet(n1.word,pool,key+'q2'),explain:n1.word+' = '+n1.cn+'。'},
          {question:'哪个新词表示“'+n2.cn+'”？',...optionSet(n2.word,pool,key+'q3'),explain:n2.word+' = '+n2.cn+'。'}
        ],
        output:{task:out.task+' 本课可用词：'+newCards.slice(0,5).map(x=>x.word).join('、')+'。',reference_answer:out.answer,reference_cn:out.cn},
        review:[
          '3秒主动回忆：'+newCards.slice(0,5).map(x=>x.word).join('、')+'。',
          '再看后5个新词，说出常见搭配或使用场景，不先背中文。',
          '复习 '+reviewCards.map(x=>x.word).join('、')+'，任选两个做主动输出。'
        ]};
    }

    const allWords=cards.map(x=>x.word),choices=[newCards[0],reviewCards[0],newCards[1]].map((c,i)=>({type:'choice',prompt:'哪个词表示“'+c.cn+'”？',
      ...optionSet(c.word,allWords,key+'pm'+i),explain:c.word+' = '+c.cn+'。'}));
    const fills=[fillFromCard(newCards[0]),fillFromCard(newCards[1]||newCards[0])],rewrite=[];
    for(const c of newCards.slice(0,2))rewrite.push({task:'中译印：'+c.example_cn+'（使用 '+c.word+'）',reference_answer:c.example,reference_cn:c.example_cn});
    if(appCards[0])rewrite.push({task:'主动复现：'+appCards[0].example_cn+'（使用 '+appCards[0].word+'）',reference_answer:appCards[0].example,reference_cn:appCards[0].example_cn});
    if(reviewCards[0])rewrite.push({task:'复习输出：'+reviewCards[0].example_cn+'（使用 '+reviewCards[0].word+'）',reference_answer:reviewCards[0].example,reference_cn:reviewCards[0].example_cn});
    const dialogue=dialogueFor(scene,cards,env,key);
    base._prototype.dialogue_coverage=dialogue._coverage;delete dialogue._coverage;
    return {...base,write_status:'lesson_complete',new_words:newCards.map(x=>x.word),vocab:cards.map(({group,...x})=>x),reading,dialogue,rewrite:rewrite.slice(0,4),
      daily_test:{questions:[...choices,...fills,orderQuestion(cards)],self_check:[
        '遮住中文，3秒内说出 '+newCards.map(x=>x.word).join(' / ')+' 的意思和一个常见搭配。',
        '主动复习 '+reviewCards.map(x=>x.word).join(' / ')+'，不要只做识别。',
        appCards.length?'复现今天08:00或近期已教的 '+appCards.map(x=>x.word).join(' / ')+'。':'复述晚课场景。'
      ]},
      review:{title:'最后5分钟复盘',steps:[
        '连续说出晚课新词并各造一个短句。',
        '用两个复习词重新讲一遍今天的场景。',
        '用30秒复述 '+scene.title+'，优先自然表达，不强塞所有目标词。'
      ]}};
  }

  return {generate,prepare,selectNew,selectReviews,selectApplications,pmCorePlan,chooseScene,tagWord,sceneFit};
});
