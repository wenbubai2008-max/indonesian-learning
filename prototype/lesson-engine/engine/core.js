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
      _collocations:collocations,
      // Private drill material. Never let an alternate example replace the teaching
      // example or change the official new/review/application word eligibility.
      _transfer:e.transfer_example&&e.transfer_cn&&hasExactWord(e.transfer_example,k)&&
        norm(e.transfer_example)!==norm(e.example||d.example||'')
        ?{id:e.transfer_example,cn:e.transfer_cn}:null
    };
    if(ctx.target.session==='pm'){
      // AM vocab is formally new; AM review_vocab consists of previously learned words.
      // Never relabel an old review word as newly taught merely because it appeared at 08:00.
      const amNew=new Set((ctx.same_day_am?.vocab||[]).map(x=>norm(Array.isArray(x)?x[0]:x?.word)));
      const amReview=new Set((ctx.same_day_am?.review_vocab||[]).map(x=>norm(typeof x==='string'?x:x?.word)));
      card.usage_note=group==='application'
        ?(amNew.has(k)?'今天08:00新学；晚课作为 application 主动复现。'
          :amReview.has(k)?'今天08:00复习过的老词；晚课作为 application 再次复现。'
          :'此前已正式学习的老词；晚课作为 application 主动复现。')
        :group==='review'?'已正式学习；本晚课进行主动复习。'
        :(e.note||d.usage_note||'本晚课新词；重点掌握常见搭配、语体和3秒主动提取。');
      card.source_group=group;card.is_new=group==='new';
    }
    return card;
  }

  function hasExactWord(text,word){
    const escaped=String(word||'').replace(/[\/\\^$*+?.()|[\]{}]/g,'\\$&').replace(/\s+/g,'\\s+');
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
    if(/\b(hujan|awan|air|cuaca|pohon|daun|matahari)\b/.test(ex)||has('weather','nature'))return 'nature';
    if(/\b(akun|ponsel|komputer|file|dokumen|internet|password|kabel|listrik|baterai)\b/.test(ex)||has('digital','document','electricity'))return 'digital';
    if(has('transport','travel')||/\b(jalan|mobil|kendaraan|stasiun|penerbangan)\b/.test(ex))return 'transport';
    if(has('health')||/\b(badan|sakit|demam|klinik|dokter|batuk|sembuh)\b/.test(ex))return 'health';
    if(has('food')||/\b(makan|makanan|sup|rasa|kantin)\b/.test(ex))return 'food';
    if(has('shopping','logistics','service'))return 'shopping';
    if(has('finance'))return 'finance';
    if(has('relationship','social','feeling'))return 'social';
    if(has('home'))return 'home';
    if(has('law','incident','conflict')||/\b(peristiwa|kejadian|kecelakaan)\b/.test(ex))return 'incident';
    if(has('work')||/\b(kantor|rapat|tim|atasan|pekerjaan|penjualan)\b/.test(ex))return 'work';
    if(has('connector','time','purpose'))return scene?.domain||'daily';
    return scene?.domain||'daily';
  }

  function readingFor(scene,cards,env,key,session,variant=0){
    const all=targetReadingCards(cards,scene,env,session);
    const news=all.filter(c=>c.group==='new'),support=all.filter(c=>c.group!=='new');
    const required=session==='am'?6:cards.filter(c=>c.group==='new').length;
    if(news.length<required)throw Error('MATERIAL_EXAMPLE_TARGET_MISSING: need '+required+' exact new-word examples; found '+news.length);
    const macro=c=>{
      const b=semanticBucket(c,env,scene);
      if(['transport','nature','incident'].includes(b))return 'outside';
      if(['health','social'].includes(b))return 'personal';
      return 'activity';
    };
    // Prefer cohesive clusters and shorter authentic examples; do NOT arbitrarily
    // replace legally selected vocabulary or invent new Indonesian sentences.
    const chosen=[],available=[...news];
    const clusterScore=c=>{
      const b=macro(c),fine=semanticBucket(c,env,scene);
      const neighbors=news.filter(n=>n!==c&&macro(n)===b).length;
      const close=news.filter(n=>n!==c&&semanticBucket(n,env,scene)===fine).length;
      return neighbors*7+close*9+sceneFit(c,scene,env)*2-wc(c.example)/3;
    };
    available.sort((a,b)=>clusterScore(b)-clusterScore(a)||a.word.localeCompare(b.word));
    const anchor=available[(variant%Math.min(3,available.length))]||available[0];
    chosen.push(anchor);available.splice(available.indexOf(anchor),1);
    while(chosen.length<required){
      available.sort((a,b)=>{
        const score=c=>{
          const fine=semanticBucket(c,env,scene),group=macro(c);
          const exact=chosen.filter(x=>semanticBucket(x,env,scene)===fine).length;
          const shared=chosen.filter(x=>macro(x)===group).length;
          return exact*13+shared*7+sceneFit(c,scene,env)-wc(c.example)/3;
        };
        return score(b)-score(a)||a.word.localeCompare(b.word);
      });
      chosen.push(available.shift());
    }
    // Explicitly group short topical notes. Mixed unrelated examples are NOT a
    // single fabricated narrative and must never inherit an unrelated scene title.
    const fineTopics=new Set(chosen.map(c=>semanticBucket(c,env,scene)));
    // A pre-reviewed two-word scene is used only if BOTH exact words are selected
    // for this reading. Never pull an ineligible word into a lesson for cohesion.
    const eligiblePairs=(env.M['micro-scenes']?.scenes||[]).filter(p=>{
      if(!Array.isArray(p.words)||p.words.length!==2||!Array.isArray(p.reading)||p.reading.length!==2)return false;
      const aa=chosen.find(c=>c.word===p.words[0]),bb=chosen.find(c=>c.word===p.words[1]);
      return aa&&bb&&p.reading.every((line,i)=>line.id&&line.cn&&hasExactWord(line.id,p.words[i]));
    }).sort((a,b)=>a.id.localeCompare(b.id));
    const pairByWord=new Map(),selectedPairs=[];
    for(const p of eligiblePairs){
      if(p.words.some(w=>pairByWord.has(w)))continue;
      const aa=chosen.find(c=>c.word===p.words[0]),bb=chosen.find(c=>c.word===p.words[1]);
      // Keep the pair in one broad topic; cross-topic pairs are not promoted into
      // an artificial story. Up to two curated scenes keeps length predictable.
      if(macro(aa)!==macro(bb)||selectedPairs.length>=2)continue;
      selectedPairs.push(p);
      for(const w of p.words)pairByWord.set(w,p);
    }
    const groups=new Map(),visitedPairs=new Set();
    for(const c of chosen){
      const b=macro(c);
      if(!groups.has(b))groups.set(b,[]);
      const pair=pairByWord.get(c.word);
      if(pair){
        if(visitedPairs.has(pair.id))continue;
        visitedPairs.add(pair.id);
        groups.get(b).push({kind:'paired-scene',pair});
      }else groups.get(b).push({kind:'card',card:c});
    }
    const mixed=fineTopics.size>1;
    // Never stitch five unrelated stock sentences into a fabricated single event.
    // Two or three expressly separate, broad life contexts need fewer hard transitions.
    const topicIntros={
      activity:['Untuk pekerjaan dan urusan sehari-hari, ada beberapa hal yang saya catat.','工作和日常事务方面，我记下了几件事。'],
      outside:['Di luar, ada beberapa kejadian yang menarik perhatian saya.','外面也有几件引起我注意的事情。'],
      personal:['Ada juga cerita tentang orang-orang di sekitar saya.','还有几件和身边人有关的事。']
    };
    const cn=env.M['scene-cn'].scenes[scene.id];
    const op=mixed
      ?['Hari ini ada beberapa kejadian kecil yang ingin saya ceritakan.','今天有几件生活中的小事想讲一讲。']
      :[scene.openings[hash(key+'open')%scene.openings.length],cn.openings[hash(key+'open')%cn.openings.length]];
    const closer=mixed
      ?['Itu beberapa hal yang saya dengar dan alami hari ini.','这些就是我今天听到和遇到的几件事。']
      :[scene.closing[hash(key+'close')%scene.closing.length],cn.closing[hash(key+'close')%cn.closing.length]];
    const entry=c=>{
      const imperative=/^(tolong|jangan|coba)\b/i.test(c.example);
      return imperative
        ?['Saya mendengar seseorang berkata, "'+c.example+'"','我听见有人说：“'+c.example_cn+'”',c.word,c.group]
        :[c.example,c.example_cn,c.word,c.group];
    };
    const pairs=[[...op,'','opening']];
    const chunks=[...groups.entries()].sort((a,b)=>b[1].length-a[1].length||a[0].localeCompare(b[0]));
    for(let i=0;i<chunks.length;i++){
      const [group,items]=chunks[i];
      if(mixed&&i>0){
        const bridge=topicIntros[group]||['Ada juga catatan singkat dari situasi lainnya.','还有另一个不同情境中的简短记录。'];
        pairs.push([...bridge,'','bridge']);
      }
      for(const item of items){
        if(item.kind==='paired-scene'){
          for(const line of item.pair.reading)pairs.push([line.id,line.cn,'','paired-scene']);
        }else pairs.push(entry(item.card));
      }
    }
    const count=()=>wc(pairs.map(x=>x[0]).join(' '));
    const remaining=()=>120-count()-wc(closer[0]);
    if(remaining()<0)throw Error('READING_TARGET_BUDGET: mandatory topical examples exceed 120');
    // Review enters only when it shares the main topic, not as a random filler.
    const mainTopic=chunks[0]?.[0];
    for(const c of support.filter(c=>macro(c)===mainTopic).slice(0,2)){
      const p=entry(c);
      if(wc(p[0])+2<=remaining())pairs.push(p);
    }
    const neutral=[
      ['Saya jadi punya beberapa bahan cerita saat bertemu teman nanti.','以后见朋友时，我又有了几件可以聊的小事。'],
      ['Ada hal sederhana yang ternyata cukup menarik untuk diperhatikan.','有些简单的小事其实也值得留意。'],
      ['Saya ingin mengingat bagian yang penting dari semua cerita itu.','这些事情中重要的部分，我想记下来。']
    ];
    const filler=mixed?neutral:scene.moves.map((x,i)=>[x,cn.moves[i]]);
    for(const p of filler){
      if(count()+wc(closer[0])>=80)break;
      if(wc(p[0])<=remaining())pairs.push([...p,'','transition']);
    }
    if(wc(closer[0])<=remaining())pairs.push([...closer,'','closing']);
    const text=pairs.map(x=>x[0]).join(' '),translation=pairs.map(x=>x[1]).join(' ');
    const coverage=cards.filter(c=>hasExactWord(text,c.word)).map(c=>({word:c.word,group:c.group}));
    const actual=coverage.filter(c=>c.group==='new').length;
    if(actual<required)throw Error('READING_EXACT_COVERAGE: '+actual+'/'+required);
    if(wc(text)<80||wc(text)>120)throw Error('READING_WORD_COUNT: '+wc(text));
    return {text,cn:translation,_coverage:coverage,_review_required:mixed,_mixed:mixed,
      _topic_count:fineTopics.size,_paired_scenes:selectedPairs.map(p=>p.id)};
  }

  function dialogueFor(scene,cards,env,key){
    const news=cards.filter(x=>x.group==='new'&&hasExactWord(x.example,x.word));
    const others=cards.filter(x=>x.group!=='new'&&hasExactWord(x.example,x.word));
    if(news.length<2)throw Error('DIALOGUE_NEW_EXAMPLE_INSUFFICIENT');
    // The strongest dialogue case: a pre-authored, bilingual micro-situation in
    // which BOTH required new words belong to the same conversational incident.
    const curated=(env.M['micro-scenes']?.scenes||[]).find(p=>
      p.words.length===2&&p.reading.length===2&&
      p.words.every(w=>news.some(c=>c.word===w))&&
      p.reading.every((line,i)=>hasExactWord(line.id,p.words[i])));
    if(curated){
      const prompts={
        weather:[['Tadi cuacanya bagaimana?','刚才天气怎么样？'],['Terus setelah itu apa yang terjadi?','那后来怎么样了？']],
        health:[['Tadi kondisi badannya bagaimana?','刚才身体情况如何？'],['Lalu sekarang bagaimana?','那现在怎么样了？']],
        transport:[['Tadi di jalan ada masalah apa?','刚才路上出了什么情况？'],['Terus apa yang terjadi setelah itu?','后来又发生了什么？']],
        finance:[['Ada urusan pembayaran apa hari ini?','今天有什么付款的事？'],['Lalu setelah itu bagaimana?','后来又怎么样？']],
        digital:[['Tadi ada masalah apa dengan perangkatnya?','刚才设备出了什么问题？'],['Terus kamu melakukan apa?','那你接着做了什么？']],
        work:[['Bagaimana urusan pekerjaan tadi?','刚才工作上的事怎么样？'],['Lalu langkah berikutnya apa?','那下一步是什么？']],
        home:[['Tadi ada urusan apa di rumah?','刚才家里有什么事？'],['Terus bagaimana kelanjutannya?','后来又怎么样了？']],
        social:[['Tadi temanmu cerita apa?','刚才你朋友说了什么？'],['Lalu apa yang terjadi?','那后来怎么样了？']],
        daily:[['Tadi ada cerita apa?','刚才有什么事？'],['Lalu bagaimana kelanjutannya?','后来怎么样了？']]
      };
      const q=prompts[curated.domain]||prompts.daily,[a,b]=curated.reading;
      const lines=[
        {speaker:'A',id:q[0][0],cn:q[0][1]},
        {speaker:'B',id:a.id,cn:a.cn},
        {speaker:'A',id:q[1][0],cn:q[1][1]},
        {speaker:'B',id:b.id,cn:b.cn}
      ];
      // Reuse a PREVIOUSLY learned application/review word only when its
      // teaching example shares a substantial concrete word with the story.
      // Otherwise a genuine short conversational close is better than a
      // disconnected third answer added only to increase word coverage.
      const stop=new Set(['dengan','sebelum','setelah','sudah','untuk','cukup','karena','mereka','kami','saya','kamu','dari','lagi','yang','bisa','tidak','jadi','saat','hari','lebih','masih','sambil','waktu']);
      const terms=new Set(((a.id+' '+b.id).toLowerCase().match(/[a-z]{4,}/g)||[]).filter(w=>!stop.has(w)));
      const related=others.map(c=>({c,
        hits:(c.example.toLowerCase().match(/[a-z]{4,}/g)||[]).filter(w=>terms.has(w)&&!stop.has(w)).length
      })).filter(x=>x.hits>0).sort((x,y)=>y.hits-x.hits||x.c.word.localeCompare(y.c.word));
      const support=related[0]?.c;
      if(support){
        const willContinue=/\b(biarpun|walaupun|meskipun|tetap)\b/i.test(support.example);
        const q3=willContinue
          ?['Jadi, rencanamu tetap jalan?','所以，你还是按计划继续？']
          :['Lalu kamu sendiri bagaimana?','那你自己后来怎么样了？'];
        lines.push({speaker:'A',id:q3[0],cn:q3[1]},
          {speaker:'B',id:support.example,cn:support.example_cn});
      }else{
        lines.push({speaker:'A',id:'Oke, makasih sudah cerita, ya.',cn:'好的，谢谢你告诉我。'},
          {speaker:'B',id:'Iya, sama-sama.',cn:'嗯，不客气。'});
      }
      const joined=lines.map(x=>x.id).join(' ');
      return {title:'真实口语｜Cerita sehari-hari',lines,_paired_scene:curated.id,
        _support_reused:Boolean(support),
        _coverage:cards.filter(c=>hasExactWord(joined,c.word)).map(c=>({word:c.word,group:c.group}))};
    }
    const cohesion=(a,b)=>{
      const shared=semanticBucket(a,env,scene)===semanticBucket(b,env,scene);
      const tagsA=tagWord(a.word,a.cn,env),tagsB=tagWord(b.word,b.cn,env);
      return (shared?20:0)+tagsA.filter(t=>tagsB.includes(t)).length*5+
        sceneFit(a,scene,env)+sceneFit(b,scene,env);
    };
    const pairs=[];
    for(let i=0;i<news.length;i++)for(let j=i+1;j<news.length;j++)
      pairs.push({a:news[i],b:news[j],score:cohesion(news[i],news[j])});
    pairs.sort((a,b)=>b.score-a.score||a.a.word.localeCompare(b.a.word));
    const {a:first,b:second}=pairs[0];
    const related=others.filter(c=>semanticBucket(c,env,scene)===semanticBucket(second,env,scene));
    const support=[...related].sort((a,b)=>sceneFit(b,scene,env)-sceneFit(a,scene,env))[0];
    const askFirst=c=>{
      const s=norm(c.example);
      if(/\b(hujan|awan|cuaca|matahari)\b/.test(s))return ['Tadi bagaimana cuacanya?','刚才天气怎么样？'];
      if(/\b(kantor|rapat|pekerjaan|tim|laporan)\b/.test(s))return ['Ada kabar apa soal pekerjaan tadi?','刚才工作上有什么新情况？'];
      if(/\b(sakit|sembuh|batuk|klinik)\b/.test(s))return ['Sekarang kondisinya bagaimana?','现在情况怎么样了？'];
      if(/\b(makan|restoran|kantin)\b/.test(s))return ['Bagaimana makan siangmu tadi?','你刚才午饭吃得怎么样？'];
      if(/\b(jalan|mobil|macet)\b/.test(s))return ['Tadi di jalan bagaimana?','刚才路上怎么样？'];
      return ['Tadi ada kejadian apa?','刚才发生了什么？'];
    };
    const same=semanticBucket(first,env,scene)===semanticBucket(second,env,scene);
    const askNext=()=>{
      if(!same)return ['Oh, begitu. Ada cerita lain?','哦，这样。还有别的事吗？'];
      const s=norm(second.example);
      if(/\b(air hujan|selokan)\b/.test(s))return ['Terus air hujannya mengalir ke mana?','那雨水后来流到哪里了？'];
      if(/\b(hujan|awan|cuaca|matahari)\b/.test(s))return ['Oh, begitu. Lalu setelah itu apa yang terjadi?','这样啊。那后来怎么样了？'];
      if(/\b(kantor|rapat|pekerjaan|tim|laporan)\b/.test(s))return ['Oh, begitu. Lalu apa yang kamu lakukan?','哦，这样。然后你怎么做？'];
      if(/\b(sakit|sembuh|batuk|klinik)\b/.test(s))return ['Oh, begitu. Lalu sekarang bagaimana perkembangannya?','这样啊。那现在恢复得怎么样？'];
      return ['Oh, begitu. Terus apa yang terjadi?','这样啊。后来发生了什么？'];
    };
    const q1=askFirst(first),q2=askNext(),lines=[
      {speaker:'A',id:q1[0],cn:q1[1]},
      {speaker:'B',id:first.example,cn:first.example_cn},
      {speaker:'A',id:q2[0],cn:q2[1]},
      {speaker:'B',id:second.example,cn:second.example_cn}
    ];
    if(support){
      const s=norm(support.example);
      const finalQ=/\b(biarpun|walaupun|meskipun)\b/.test(s)
        ?['Jadi, kamu tetap melanjutkan rencananya?','所以，你还是按计划继续了？']
        :['Lalu bagaimana akhirnya?','那最后怎么样了？'];
      lines.push({speaker:'A',id:finalQ[0],cn:finalQ[1]},
        {speaker:'B',id:support.example,cn:support.example_cn});
    }else{
      lines.push({speaker:'A',id:'Oh, begitu. Semoga semuanya lancar, ya.',cn:'这样啊。希望一切顺利。'},
        {speaker:'B',id:'Iya, terima kasih.',cn:'嗯，谢谢。'});
    }
    const joined=lines.map(x=>x.id).join(' ');
    const coverage=cards.filter(c=>hasExactWord(joined,c.word)).map(c=>({word:c.word,group:c.group}));
    return {title:'真实口语｜'+(same?scene.title:'Cerita sehari-hari'),lines,_coverage:coverage,
      _paired_scene:null,_support_reused:Boolean(support)};
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
    const actualTitle=reading._mixed?'Beberapa catatan sehari-hari':scene.title;
    const base={date:ctx.target.date,session:ctx.target.session,time,day:ctx.target.day,level:'A2+ → B1',duration_minutes:30,
      title:time+' '+(ctx.target.session==='am'?'早课':'晚课')+'｜'+actualTitle,
      _prototype:{engine_version:2,scene_id:scene.id,deterministic:true,production_write:false,variant,core_plan:plan,reading_coverage:reading._coverage,reading_review_required:reading._review_required,
         reading_mode:reading._mixed?'thematic-notes':'single-scene',reading_topics:reading._topic_count,
         micro_scene_pairs:reading._paired_scenes}};
    delete reading._coverage;delete reading._review_required;delete reading._mixed;delete reading._topic_count;delete reading._paired_scenes;

    if(ctx.target.session==='am'){
      const pool=cards.map(x=>x.word),r=reviewCards[0],n1=newCards[0],n2=newCards[1]||n1;
      // Use TWO actual target-word examples for the model answer. The former generic
      // frame could demand two new words while using none in its reference answer.
      const pairs=[];
      for(let i=0;i<newCards.length;i++)for(let j=i+1;j<newCards.length;j++){
        const a=newCards[i],b=newCards[j];
        const shared=semanticBucket(a,env,scene)===semanticBucket(b,env,scene);
        pairs.push({a,b,score:(shared?20:0)+sceneFit(a,scene,env)+sceneFit(b,scene,env)
          -Math.max(0,wc(a.example)-15)-Math.max(0,wc(b.example)-15)});
      }
      pairs.sort((a,b)=>{
        const transferA=Number(!!a.a._transfer)+Number(!!a.b._transfer);
        const transferB=Number(!!b.a._transfer)+Number(!!b.b._transfer);
        return transferB-transferA||b.score-a.score||a.a.word.localeCompare(b.a.word);
      });
      const focusPair=pairs[0],cleanCn=x=>String(x||'').trim().replace(/[。！？!?；;]+$/g,'');
      const outputCards=[focusPair.a,focusPair.b].map(c=>({
        word:c.word,id:c._transfer?.id||c.example,cn:c._transfer?.cn||c.example_cn,
        changed:Boolean(c._transfer)
      }));
      base._prototype.transfer_output_count=outputCards.filter(c=>c.changed).length;
      const out={
        task:'情境迁移（不要照抄词卡例句）：用 '+focusPair.a.word+' 和 '+focusPair.b.word+
          ' 各说一句。场景① '+cleanCn(outputCards[0].cn)+'；场景② '+cleanCn(outputCards[1].cn)+
          '。至少准确使用这2个目标词；可调整人物或语序。',
        answer:outputCards.map(c=>c.id).join(' '),
        cn:outputCards.map(c=>c.cn).join(' ')
      };
      return {...base,new_words:newCards.map(x=>x.word),vocab:newCards.map(({group,_transfer,...x})=>x),review_vocab:reviewCards.map(x=>x.word),
        sentences:newCards.slice(0,5).map(x=>({text:x.example,cn:x.example_cn})),reading,
        quiz:[
          {question:'哪个复习词表示“'+r.cn+'”？',...optionSet(r.word,pool,key+'q1'),explain:r.word+' = '+r.cn+'。'},
          {question:'哪个新词表示“'+n1.cn+'”？',...optionSet(n1.word,pool,key+'q2'),explain:n1.word+' = '+n1.cn+'。'},
          {question:'哪个新词表示“'+n2.cn+'”？',...optionSet(n2.word,pool,key+'q3'),explain:n2.word+' = '+n2.cn+'。'}
        ],
        output:{task:out.task,reference_answer:out.answer,reference_cn:out.cn},
        review:[
          '3秒主动回忆：'+newCards.slice(0,5).map(x=>x.word).join('、')+'。',
          '再看后5个新词，说出常见搭配或使用场景，不先背中文。',
          '复习 '+reviewCards.map(x=>x.word).join('、')+'，任选两个做主动输出。'
        ]};
    }

    const allWords=cards.map(x=>x.word),choices=[newCards[0],reviewCards[0],newCards[1]].map((c,i)=>({type:'choice',prompt:'哪个词表示“'+c.cn+'”？',
      ...optionSet(c.word,allWords,key+'pm'+i),explain:c.word+' = '+c.cn+'。'}));
    const fills=[fillFromCard(newCards[0]),fillFromCard(newCards[1]||newCards[0])],rewrite=[];
    // Prefer a second real-life context rather than re-translating the teaching
    // example. Keep exactly two new-word rewrites; never relax the official quota.
    const rewriteNew=[...newCards].sort((a,b)=>Number(!!b._transfer)-Number(!!a._transfer)).slice(0,2);
    const makeRewrite=(c,kind)=>{
      const chosen=c._transfer||{id:c.example,cn:c.example_cn};
      return {task:(c._transfer?'换个场景表达：':kind+'：')+chosen.cn+'（使用 '+c.word+'）',
        reference_answer:chosen.id,reference_cn:chosen.cn};
    };
    for(const c of rewriteNew)rewrite.push(makeRewrite(c,'中译印'));
    if(appCards[0])rewrite.push(makeRewrite(appCards[0],'当日应用'));
    if(reviewCards[0])rewrite.push(makeRewrite(reviewCards[0],'复习输出'));
    base._prototype.transfer_rewrite_count=[...rewriteNew,appCards[0],reviewCards[0]].filter(c=>c?._transfer).length;
    const dialogue=dialogueFor(scene,cards,env,key);
    base._prototype.dialogue_coverage=dialogue._coverage;
    base._prototype.dialogue_micro_scene=dialogue._paired_scene;
    base._prototype.dialogue_contextual_review=dialogue._support_reused;
    delete dialogue._coverage;delete dialogue._paired_scene;delete dialogue._support_reused;
    return {...base,write_status:'lesson_complete',new_words:newCards.map(x=>x.word),vocab:cards.map(({group,_transfer,...x})=>x),reading,dialogue,rewrite:rewrite.slice(0,4),
      daily_test:{questions:[...choices,...fills,orderQuestion(cards)],self_check:[
        '遮住中文，3秒内说出 '+newCards.map(x=>x.word).join(' / ')+' 的意思和一个常见搭配。',
        '主动复习 '+reviewCards.map(x=>x.word).join(' / ')+'，不要只做识别。',
        appCards.length?'复现今天08:00或近期已教的 '+appCards.map(x=>x.word).join(' / ')+'。':'复述晚课场景。'
      ]},
      review:{title:'最后5分钟复盘',steps:[
        '连续说出晚课新词并各造一个短句。',
        '用两个复习词重新讲一遍今天的场景。',
        '用30秒复述 '+actualTitle+'，优先自然表达，不强塞所有目标词。'
      ]}};
  }

  return {generate,prepare,selectNew,selectReviews,selectApplications,pmCorePlan,chooseScene,tagWord,sceneFit};
});
