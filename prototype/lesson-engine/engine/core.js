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
    const preferredOral=legalOralF[0]||legalOralD[0];
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

  function chooseScene(cards,env,variant=0,ctx=null){
    const date=ctx?.target?.date,day=date?new Date(date+'T00:00:00Z').getUTCDay():null;
    const weekday=day!==0&&day!==6;
    const scenes=env.M.scenes.scenes.filter(scene=>!(weekday&&scene.id==='weekend-errands'));
    const ranked=scenes.map(scene=>{
      let score=0,covered=0;
      for(const c of cards){
        const fit=sceneFit(c,scene,env),weight=c.group==='new'?6:c.group==='application'?3:2;
        score+=fit*weight;if(fit>=3)covered++;
      }
      if(ctx?.target?.session==='am'&&scene.id==='work-morning')score+=12;
      return {scene,score,covered};
    }).sort((a,b)=>b.covered-a.covered||b.score-a.score||a.scene.id.localeCompare(b.scene.id));
    const best=ranked[0];
    const viable=ranked.filter(x=>x.covered>=Math.max(1,best.covered-2)&&x.score>=best.score-70&&x.score>0).slice(0,6);
    const top=viable.length?viable:ranked.slice(0,1);
    return top[((variant%top.length)+top.length)%top.length]?.scene||scenes[0];
  }

  function deriveCollocations(entry,word,env){
    const curated=env.M['lexical-rules']?.curated?.[norm(word)]?.collocations||[];
    if(curated.length)return curated.slice(0,4);
    if(entry?.collocations?.length)return entry.collocations.slice(0,4);
    const note=String(entry?.note||'');
    const m=note.match(/常见([^。]+)/);
    if(m){
      const parts=m[1].split(/[、，,；;]/).map(x=>x.trim()).filter(x=>/[A-Za-z]/.test(x));
      if(parts.length)return uniq(parts).slice(0,4);
    }
    const ex=String(entry?.example||'').replace(/[.,!?;:]/g,'').split(/\s+/);
    const i=ex.findIndex(x=>norm(x)===norm(word)),out=[];
    if(i>=0){
      if(ex[i+1])out.push(ex.slice(i,Math.min(ex.length,i+2)).join(' '));
      if(i>0&&ex[i-1].length>2)out.push(ex.slice(i-1,i+1).join(' '));
    }
    return uniq(out).slice(0,2);
  }

  function formationFor(word,root,entry,collocations){
    if(entry?.formation)return entry.formation;
    const w=norm(word),r=norm(root),register=String(entry?.register||'');
    let morph='';
    if(/colloquial|spoken/i.test(register)&&r&&r!==w){
      morph='口语形式，来自词根 '+root+'；按真实口语整体记忆。';
    }else if(r&&r!==w){
      if(w.startsWith('ke')&&w.endsWith('an'))morph='ke- + '+root+' + -an。';
      else{
        const suffix=w.endsWith('kan')?'+ -kan':w.endsWith('i')?'+ -i':w.endsWith('an')?'+ -an':'';
        const prefix=w.startsWith('meng')?'meng-':w.startsWith('meny')?'meny-':w.startsWith('men')?'men-':w.startsWith('mem')?'mem-':w.startsWith('me')?'me-':
          w.startsWith('ber')?'ber-':w.startsWith('ter')?'ter-':w.startsWith('pe')?'pe-':'';
        morph=prefix?(prefix+' + '+root+(suffix?' '+suffix:'')+'。'):('来自词根 '+root+'。');
      }
    }
    if(collocations.length)return (morph?morph+' ':'')+'常见搭配：'+collocations.join('、')+'。';
    return morph||'基础词形；结合本课例句与真实语境掌握。';
  }

  function buildCard(row,group,ctx,env){
    const {lex,daily,M}=env,k=norm(row.word),e=lex.get(k)||{},d=daily.get(k)||{};
    const rr=(ctx.candidates?.review||[]).find(x=>norm(x[0])===k);
    const cn=e.cn||row.cn||rr?.[5]||d.cn||'',root=e.root||row.root||rr?.[6]||d.root||k;
    const rootCn=e.root_cn||row.root_cn||rr?.[7]||d.root_cn||(root===k?cn:'');
    const lexicalSource=Object.keys(e).length?e:d;
    const collocations=deriveCollocations(lexicalSource,k,env);
    const card={
      word:k,display:d.display||k,audio_text:d.audio_text||k,cn,en:e.en||row.en||d.en||cn,
      root,root_cn:rootCn,formation:e.formation||d.formation||formationFor(k,root,lexicalSource,collocations),
      example:e.example||d.example||('Saya memakai kata '+k+' dalam kalimat sehari-hari.'),
      example_cn:e.example_cn||d.example_cn||('我在日常句子中使用 '+k+' 这个词。'),
      synonym_note:e.synonym_note||d.synonym_note||M['lexical-rules']?.curated?.[k]?.spoken_note||e.note||d.usage_note||('例句搭配：'+(collocations.length?collocations.join(' / '):k)+'；这里的意思是“'+cn+'”。'),
      is_oral_new:group==='new'&&oralMap(ctx).has(k),
      _collocations:collocations
    };
    if(ctx.target.session==='pm'){
      const sameDay=new Set([...(ctx.same_day_am?.vocab||[]).map(x=>norm(x[0])),...(ctx.same_day_am?.review_vocab||[]).map(norm)]);
      card.usage_note=group==='application'
        ?(sameDay.has(k)?'今天08:00已教；晚课作为 application 主动复现。':'已正式学习；晚课作为 application 主动复现。')
        :group==='review'?'已正式学习；本晚课进行主动复习。'
        :(e.note||d.usage_note||'本晚课新词；重点掌握常见搭配、语体和3秒主动提取。');
      card.source_group=group;card.is_new=group==='new';
    }
    return card;
  }

  function hasExactWord(text,word){
    const escaped=String(word||'').replace(/[-\/\\^$*+?.()|[\]{}]/g,'\\$&').replace(/\s+/g,'\\s+');
    return !!escaped&&new RegExp('(^|[^\\p{L}])'+escaped+'(?=$|[^\\p{L}])','iu').test(String(text||''));
  }

  function targetReadingCards(cards,scene,env,session){
    const news=cards.filter(x=>x.group==='new'),others=cards.filter(x=>x.group!=='new');
    const usable=c=>c.example&&c.example_cn&&hasExactWord(c.example,c.word);
    const rank=xs=>[...xs].filter(usable).sort((a,b)=>sceneFit(b,scene,env)-sceneFit(a,scene,env)||wc(a.example)-wc(b.example));
    return [...rank(news),...rank(others)];
  }

  function semanticBucket(card,env,scene){
    const ex=norm(card.example),tags=tagWord(card.word,card.cn,env);
    const has=(...xs)=>xs.some(x=>tags.includes(x));
    if(/\b(hujan|awan|air|cuaca|pohon|daun)\b/.test(ex)||has('weather','nature'))return 'nature';
    if(/\b(akun|ponsel|komputer|file|dokumen|internet|password)\b/.test(ex)||has('digital','document'))return 'digital';
    if(has('transport','travel')||/\b(jalan|mobil|kendaraan|stasiun|penerbangan)\b/.test(ex))return 'transport';
    if(has('health')||/\b(badan|sakit|demam|klinik|dokter)\b/.test(ex))return 'health';
    if(has('food')||/\b(makan|makanan|sup|rasa|kantin)\b/.test(ex))return 'food';
    if(has('shopping','logistics','service'))return 'shopping';
    if(has('finance'))return 'finance';
    if(has('relationship','social','feeling'))return 'social';
    if(has('home'))return 'home';
    if(has('law','incident','conflict'))return 'incident';
    if(has('work')||/\b(kantor|rapat|tim|atasan|pekerjaan)\b/.test(ex))return 'work';
    if(has('connector','time','purpose'))return scene?.domain==='weather'?'nature':(scene?.domain||'daily');
    return scene?.domain||'daily';
  }

  function readingFor(scene,cards,env,key,session,variant=0){
    const cn=env.M['scene-cn'].scenes[scene.id],all=targetReadingCards(cards,scene,env,session);
    const news=all.filter(c=>c.group==='new'),support=all.filter(c=>c.group!=='new');
    const required=session==='am'?6:cards.filter(c=>c.group==='new').length;
    if(news.length<required)throw Error('MATERIAL_EXAMPLE_TARGET_MISSING: need '+required+' exact new-word examples; found '+news.length);
    const rotated=[...news.slice(variant%news.length),...news.slice(0,variant%news.length)];
    const chosen=session==='am'?rotated.slice(0,6):rotated;
    const macro=c=>{
      const b=semanticBucket(c,env,scene);
      if(['work','digital','shopping','finance','home','daily'].includes(b))return 'activity';
      if(['transport','nature','incident'].includes(b))return 'outside';
      return 'personal';
    };
    const groups=new Map();
    for(const c of chosen){const tag=macro(c);if(!groups.has(tag))groups.set(tag,[]);groups.get(tag).push(c)}
    const multi=groups.size>1,oi=hash(key+'open')%scene.openings.length;
    // Mixed-topic examples are explicitly presented as daily notes, not one invented story.
    const opener=multi
      ?['Hari ini saya mencatat beberapa kejadian berbeda dari orang-orang di sekitar saya.','今天我记下了身边发生的几件不同的小事。']
      :[scene.openings[oi],cn.openings[oi]];
    const ci=hash(key+'close')%scene.closing.length,closing=[scene.closing[ci],cn.closing[ci]];
    const pairs=[[...opener,'','scene']];
    const entry=c=>{
      const request=/^(tolong|jangan|coba)\b/i.test(c.example);
      return request
        ?['Saya juga mendengar seseorang berkata, "'+c.example+'"','我还听见有人说：“'+c.example_cn+'”',c.word,c.group]
        :[c.example,c.example_cn,c.word,c.group];
    };
    const groupsContent=[...groups.entries()].map(([tag,items])=>({
      tag,lines:items.map(entry),
      bridge:tag==='outside'
        ?['Di luar kegiatan utama, ada kabar lain.','除了手头的事情，外面还有别的消息。']
        :tag==='personal'
          ?['Saya juga sempat mendengar cerita orang lain.','我还听到了其他人的一些事情。']
          :['Ada pula beberapa urusan sehari-hari yang saya catat.','我也记下了几件日常事务。']
    }));
    const mandatory=wc(opener[0])+wc(closing[0])+groupsContent.reduce((n,g)=>n+g.lines.reduce((m,l)=>m+wc(l[0]),0),0);
    if(mandatory>120)throw Error('READING_TARGET_BUDGET: '+mandatory+' words before transitions');
    const bridgeBudget=Math.min(2,Math.max(0,Math.floor((116-mandatory)/9)));
    for(let i=0;i<groupsContent.length;i++){
      const g=groupsContent[i];if(i>0&&i<=bridgeBudget)pairs.push([...g.bridge,'','bridge']);pairs.push(...g.lines);
    }
    const length=()=>wc(pairs.map(x=>x[0]).join(' '));
    for(const c of support.filter(x=>macro(x)===macro(chosen[0])).slice(0,2)){
      const p=entry(c);if(length()+wc(p[0])+wc(closing[0])<=110)pairs.push(p);
    }
    let move=hash(key+'move')%Math.max(scene.moves.length,1),tried=0;
    while(length()+wc(closing[0])<80&&tried<scene.moves.length){
      const j=move++%scene.moves.length,p=[scene.moves[j],cn.moves[j],'','scene'];
      if(length()+wc(p[0])+wc(closing[0])<=119)pairs.push(p);tried++;
    }
    if(length()+wc(closing[0])<=120)pairs.push([...closing,'','scene']);
    const text=pairs.map(x=>x[0]).join(' '),translation=pairs.map(x=>x[1]).join(' ');
    const coverage=cards.filter(c=>hasExactWord(text,c.word)).map(c=>({word:c.word,group:c.group}));
    const actual=coverage.filter(c=>c.group==='new').length;
    if(actual<required)throw Error('READING_EXACT_COVERAGE: '+actual+'/'+required);
    if(wc(text)<80||wc(text)>120)throw Error('READING_WORD_COUNT: '+wc(text));
    return {text,cn:translation,_coverage:coverage,_review_required:multi};
  }

  function dialogueFor(scene,cards,env,key){
    const news=cards.filter(x=>x.group==='new'&&hasExactWord(x.example,x.word));
    const others=cards.filter(x=>x.group!=='new'&&hasExactWord(x.example,x.word));
    if(news.length<2)throw Error('DIALOGUE_NEW_EXAMPLE_INSUFFICIENT');
    const bucket=semanticBucket(news[0],env,scene);
    const score=c=>(semanticBucket(c,env,scene)===bucket?12:0)+sceneFit(c,scene,env);
    const targets=[...news].sort((a,b)=>score(b)-score(a)).slice(0,2);
    const third=[...others].sort((a,b)=>score(b)-score(a))[0];if(third)targets.push(third);
    const ask=(c,i)=>{
      const s=c.example,b=semanticBucket(c,env,scene),imperative=/^(tolong|jangan|coba)\b/i.test(s);
      let q;
      if(imperative)q=['Aku perlu bantu apa?','我需要帮什么忙？'];
      else if(/\b(kata sandi|akun|ponsel|password)\b/i.test(s))q=['Ada masalah apa dengan akun atau ponselnya?','账号或手机出了什么问题？'];
      else if(/\b(awan|hujan|cuaca|becek)\b/i.test(s))q=['Bagaimana kondisi di luar?','外面的情况怎么样？'];
      else if(/\b(stiker|tempel|nempel)\b/i.test(s))q=['Ada apa dengan stikernya?','那个贴纸怎么了？'];
      else if(/\b(tim|pertandingan|kalah)\b/i.test(s))q=['Bagaimana kabar timmu?','你们队怎么样？'];
      else if(/\b(dokumen|laporan|rapat|kerjaan|pekerjaan|data|kantor)\b/i.test(s))q=['Ada kabar apa soal pekerjaan?','工作上有什么新情况？'];
      else if(/\b(ibu|anak|teman|keluarga|dia|beliau|mereka)\b/i.test(s))q=['Bagaimana keadaan orang-orang itu?','他们怎么样了？'];
      else if(/^Saya\b/i.test(s))q=['Tadi kamu mengalami apa?','你刚才遇到什么事了？'];
      else if(b==='nature')q=['Bagaimana kondisi di sekitar sana?','那附近的情况如何？'];
      else q=['Kamu juga mendengar kabar apa lagi?','你还听到了什么其他消息？'];
      if(i>0&&semanticBucket(targets[i-1],env,scene)!==b)
        q=['Ngomong-ngomong, '+q[0].charAt(0).toLowerCase()+q[0].slice(1),'换个话题，'+q[1]];
      return q;
    };
    const lines=[];
    for(let i=0;i<targets.length;i++){
      const q=ask(targets[i],i),c=targets[i];
      lines.push({speaker:'A',id:q[0],cn:q[1]},{speaker:'B',id:c.example,cn:c.example_cn});
    }
    const joined=lines.map(x=>x.id).join(' ');
    const coverage=cards.filter(c=>hasExactWord(joined,c.word)).map(c=>({word:c.word,group:c.group}));
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
    if(!ctx?.target||!['am','pm'].includes(ctx.target.session))throw Error('LESSON_CONTEXT_INVALID');
    const minNew=ctx.target.session==='am'?10:3;
    const D=ctx.candidates?.new_dont||[],F=ctx.candidates?.new_fuzzy||[];
    if(D.length+F.length<minNew)throw Error('LESSON_NEW_POOL_INSUFFICIENT: need '+minNew+'; found '+(D.length+F.length));
    const newRows=selectNew(ctx,variant);
    if(newRows.length<minNew)throw Error('LESSON_NEW_SELECTION_INSUFFICIENT: '+newRows.length+'/'+minNew);
    const plan=ctx.target.session==='pm'?pmCorePlan(ctx,newRows.length):{total:15,reviews:5,apps:0,pressure:0};
    const reviews=selectReviews(ctx,ctx.target.session==='am'?5:plan.reviews);
    if(reviews.length<4)throw Error('LESSON_REVIEW_POOL_INSUFFICIENT: '+reviews.length);
    const apps=selectApplications(ctx,reviews,plan.apps);
    if(ctx.target.session==='pm'&&!ctx.same_day_am)throw Error('LESSON_PM_REQUIRES_AM_CONTEXT');
    if(ctx.target.session==='pm'&&apps.length<2)throw Error('LESSON_APPLICATION_POOL_INSUFFICIENT: '+apps.length);
    const preCards=[
      ...newRows.map(x=>({...x,group:'new'})),
      ...reviews.map(x=>({...x,group:'review'})),
      ...apps.map(x=>({...x,group:'application'}))
    ];
    const scene=chooseScene(preCards,env,variant,ctx);
    const newCards=newRows.map(x=>({...buildCard(x,'new',ctx,env),group:'new'}));
    const reviewCards=reviews.map(x=>({...buildCard(x,'review',ctx,env),group:'review'}));
    const appCards=apps.map(x=>({...buildCard(x,'application',ctx,env),group:'application'}));
    const cards=[...newCards,...reviewCards,...appCards],key=ctx.target.date+'-'+ctx.target.session+'-'+variant+'-'+newRows.map(x=>x.word).join('|');
    const reading=readingFor(scene,cards,env,key,ctx.target.session,variant),time=ctx.target.session==='am'?'08:00':'18:00';
    const base={date:ctx.target.date,session:ctx.target.session,time,day:ctx.target.day,level:'A2+ → B1',duration_minutes:30,
      title:time+' '+(ctx.target.session==='am'?'早课':'晚课')+'｜'+scene.title,
      _prototype:{engine_version:2,scene_id:scene.id,deterministic:true,production_write:false,variant,core_plan:plan,reading_coverage:reading._coverage,reading_review_required:reading._review_required}};
    delete reading._coverage;delete reading._review_required;

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
