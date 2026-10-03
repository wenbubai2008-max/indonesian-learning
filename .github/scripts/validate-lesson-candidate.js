#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {checkPm}=require('./review-rotation');

/** Only completed core-review exposures count; a PM application is not another core review. */
function collectReviewHistory(index,targetDate,targetSession,load){
 const at=Date.parse(targetDate+'T00:00:00Z');
 if(!Number.isFinite(at))throw Error('Invalid target date for review history');
 const history=[];
 for(const row of index.dates||[]){
  const d=Date.parse(String(row.date||'')+'T00:00:00Z');
  if(!Number.isFinite(d)||d<at-7*86400000||d>at)continue;
  for(const session of ['am','pm']){
   if(row[session]!==true)continue;
   if(row.date===targetDate&&(targetSession==='am'||session!=='am'))continue;
   const p='data/daily/'+row.date+'-'+session+'.json';
   const lesson=load(p);
   if(!lesson||lesson.date!==row.date||lesson.session!==session)throw Error('Completed review history missing or mismatched: '+p);
   history.push(lesson);
  }
 }
 return history;
}

const validate=function validate({lesson,index,runtime,rules,expectedDate,expectedSession,sameDayAm,previousPm,reviewHistory}) {
  const errors=[], add=(code,detail)=>errors.push({code,detail});
  const check=(c,code,detail)=>{if(!c)add(code,detail);return !!c};
  const has=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
  const str=x=>typeof x==="string"&&!!x.trim();
  const norm=x=>String(x==null?"":x).trim().toLowerCase().replace(/[.,!?;:，。！？；：]/g,"").replace(/\s+/g," ");
  const word=x=>norm(Array.isArray(x)?x[0]:typeof x==="string"?x:x&&x.word);
  const ws=x=>Array.isArray(x)?x.map(word).filter(Boolean):[];
  const range=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
  const count=x=>String(x||"").trim().split(/\s+/).filter(Boolean).length;
  const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d||""))&&!isNaN(Date.parse(d+"T00:00:00Z"))&&new Date(d+"T00:00:00Z").toISOString().slice(0,10)===d;
  if(!lesson||typeof lesson!=="object"||Array.isArray(lesson))return {ok:false,errors:[{code:"LESSON_INVALID",detail:"Candidate must be a JSON object"}]};
  if(!index||!Array.isArray(index.dates)||!runtime||!rules)return {ok:false,errors:[{code:"INPUT_INVALID",detail:"Index, runtime and rules required"}]};
  const date=expectedDate, session=expectedSession,time=session==="am"?"08:00":"18:00";
  if(!validDate(date)||!["am","pm"].includes(session))return {ok:false,errors:[{code:"TARGET_INVALID",detail:"Explicit date/session required"}]};
  check(rules.version===4&&runtime.version===4&&runtime.rules_version===4&&runtime.stats?.master_unique===977,"RULE_RUNTIME_MISMATCH","Rules/runtime v4, 977 primary master required");
  check(Number.isFinite(Date.parse(runtime.generated_at||"")),"RUNTIME_INVALID","Runtime generated_at invalid");
  const seen=new Set(),stamps=[];
  for(const row of index.dates){
    if(!row||!validDate(row.date)||seen.has(row.date))add("INDEX_INVALID","Invalid/duplicate index date");
    if(row&&validDate(row.date)){
      seen.add(row.date);
      if(row.am===true)stamps.push(row.date+" 08:00");
      if(row.pm===true)stamps.push(row.date+(row.date>="2026-09-16"?" 18:00":" 19:00"));
    }
  }
  const latest=[...seen].sort().at(-1),watermark=stamps.sort().at(-1)||"";
  check(index.updated===latest,"INDEX_INVALID","index.updated must be newest index date");
  check(runtime.lesson_watermark===watermark,"BASELINE_SYNC_STALE","Runtime watermark differs from completed index: expected "+watermark);
  const existing=index.dates.find(r=>r?.date===date);
  check(!existing||existing[session]!==true,"ALREADY_PUBLISHED","This lesson session is already marked published");
  check(lesson.date===date&&lesson.session===session&&lesson.time===time,"IDENTITY_MISMATCH","Lesson date/session/time differs from target");
  check(str(lesson.title)&&lesson.title.startsWith(time),"TITLE_INVALID","Title must start with canonical time");
  check(Number.isInteger(lesson.day)&&lesson.day>0,"DAY_INVALID","Lesson day must be positive integer");
  const newPool=new Set(ws(runtime.new_pool)),dont=new Set(ws(runtime.new_pool_dont)),fuzzy=new Set(ws(runtime.new_pool_fuzzy)),unclassified=new Set(ws(runtime.new_pool_unclassified)),reviewPool=new Set(ws(runtime.review_pool)),oral=new Set(ws(runtime.oral_new_pool)),oralDont=new Set(ws(runtime.oral_new_pool_dont));
  const pool=(w,set,code)=>check(set.has(w),code,"Ineligible word: "+w);
  const vocab=Array.isArray(lesson.vocab)?lesson.vocab:[],vw=vocab.map(v=>word(v));
  check(vw.length===vocab.length&&vw.every(Boolean)&&new Set(vw).size===vw.length,"CORE_WORDS_INVALID","Core vocab must have non-empty, unique identities");
  const fields=session==="am"?["word","display","audio_text","cn","en","root","root_cn","formation","example","example_cn","synonym_note","is_oral_new"]:["word","display","audio_text","cn","en","root","root_cn","formation","example","example_cn","synonym_note","usage_note","source_group","is_new","is_oral_new"];
  vocab.forEach((v,i)=>{
    fields.forEach(f=>check(has(v,f),"VOCAB_FIELD_MISSING","vocab["+i+"] "+f));
    ["word","display","audio_text","cn","en","formation","example","example_cn","synonym_note"].forEach(f=>check(str(v?.[f]),"VOCAB_FIELD_EMPTY","vocab["+i+"] "+f));
    if(str(v?.root))check(str(v.root_cn),"ROOT_CN_MISSING","vocab["+i+"] root_cn");
    check(typeof v?.is_oral_new==="boolean","VOCAB_ORAL_FLAG","vocab["+i+"] flag");
  });
  check(range(count(lesson.reading?.text),80,120)&&str(lesson.reading?.cn),"READING_INVALID","80-120 Indonesian words plus Chinese required");
  const choice=(q,i,label)=>{
    const opts=Array.isArray(q?.options)?q.options:[],a=q?.answer_index;
    const valid=opts.length>=2&&opts.every(str)&&new Set(opts.map(norm)).size===opts.length&&Number.isInteger(a)&&a>=0&&a<opts.length;
    check(valid&&str(q?.[label])&&str(q?.explain),"QUESTION_INVALID","Question "+(i+1)+" schema");
    if(valid&&has(q,"answer"))check(norm(q.answer)===norm(opts[a]),"ANSWER_MISMATCH","Question "+(i+1)+" answer vs index");
    return valid?norm(opts[a]):"";
  };
  const amNewWords=new Set(ws(sameDayAm?.vocab)),amReviewWords=new Set(ws(sameDayAm?.review_vocab));
  const amWords=new Set([...amNewWords,...amReviewWords]);
  if(session==="am"){
    check(vocab.length===10,"AM_CORE_COUNT","Exactly 10 new words required");
    const prevDate=new Date(Date.parse(date+"T00:00:00Z")-86400000).toISOString().slice(0,10);
    const prevNew=new Set(previousPm?.write_status==="lesson_complete"?ws(previousPm.new_words):[]);
    if(previousPm){
      check(previousPm.date===prevDate&&previousPm.session==="pm","PREVIOUS_PM_INVALID","Previous PM date/session mismatch");
      prevNew.forEach(w=>check(!newPool.has(w),"BASELINE_SYNC_STALE","Previous PM word still new: "+w));
    }
    const availDont=[...dont].filter(w=>newPool.has(w)&&!prevNew.has(w));
    vw.forEach(w=>{pool(w,newPool,"NEW_WORD_INELIGIBLE");check(dont.has(w)||fuzzy.has(w),"NEW_MEMORY_POOL_INVALID",w);check(!unclassified.has(w),"UNCLASSIFIED_NEW_WORD",w);check(!prevNew.has(w),"CROSS_DAY_NEW_REPEAT",w)});
    if(availDont.length>=10)check(vw.every(w=>dont.has(w)),"AM_DONT_PRIORITY","10 available dont -> choose 10 dont");
    else check(vw.filter(w=>dont.has(w)).length===availDont.length,"AM_DONT_PRIORITY","Exhaust dont before fuzzy fallback");
    const oralEligible=[...oral].filter(w=>newPool.has(w)&&!prevNew.has(w));
    const oralDontEligible=oralEligible.filter(w=>dont.has(w));
    const oralFuzzyEligible=oralEligible.filter(w=>fuzzy.has(w));
    const dontSlots=Math.min(10,availDont.length),fuzzySlots=10-dontSlots;
    // Oral priority must never require a fuzzy word when AM's dont-first contract forbids it.
    const feasibleOral=Math.min(dontSlots,oralDontEligible.length)+Math.min(fuzzySlots,oralFuzzyEligible.length);
    const marked=vocab.filter(v=>v?.is_oral_new).map(word);
    marked.forEach(w=>pool(w,oral,"ORAL_INELIGIBLE"));
    if(feasibleOral>=2)check(marked.length>=2,"ORAL_COUNT","Two oral new words feasible within AM dont/fuzzy slots");
    if(oralDontEligible.length>0)check(marked.filter(w=>oralDont.has(w)).length>=Math.min(2,oralDontEligible.length,dontSlots),"ORAL_DONT_PRIORITY","Oral dont first");
    const rv=lesson.review_vocab,rw=Array.isArray(rv)?rv.map(norm):[];
    check(Array.isArray(rv)&&range(rv.length,4,6)&&rv.every(str)&&new Set(rw).size===rw.length,"AM_REVIEW_INVALID","4-6 unique review_vocab strings required");
    rw.forEach(w=>{pool(w,reviewPool,"REVIEW_INELIGIBLE");check(!vw.includes(w),"REVIEW_NEW_OVERLAP",w)});
    check(Array.isArray(lesson.sentences)&&lesson.sentences.length===5&&lesson.sentences.every(x=>str(x?.text)&&str(x?.cn)),"AM_SENTENCES_INVALID","Five bilingual sentences required");
    const quiz=Array.isArray(lesson.quiz)?lesson.quiz:[];
    check(quiz.length===3,"AM_QUIZ_COUNT","3 AM quiz questions required");
    const ans=quiz.map((q,i)=>choice(q,i,"question"));
    check(ans.some(a=>rw.includes(a)),"AM_REVIEW_QUIZ_MISSING","One correct answer must be review_vocab");
    quiz.forEach((q,i)=>{const recognition=/词义|意思|含义|形式|哪一个词|哪个词|哪种形式|正确形式|识别/.test(q?.question||"");if(ans[i])check(!String(q.question||"").toLowerCase().includes(ans[i])||recognition,"AM_QUIZ_ANSWER_LEAK","Question "+(i+1)+" leaks answer")});
    check(["task","reference_answer","reference_cn"].every(k=>str(lesson.output?.[k])),"AM_OUTPUT_INVALID","Active output incomplete");
    check(Array.isArray(lesson.review)&&lesson.review.length===3&&lesson.review.every(str),"AM_FINAL_REVIEW_INVALID","Three final review points required");
  } else {
    check(lesson.write_status==="lesson_complete","PM_STATUS_INVALID","PM status incomplete");
    check(range(vocab.length,10,12),"PM_CORE_COUNT","10-12 core words required");
    const groups={new:vocab.filter(v=>v?.source_group==="new"),review:vocab.filter(v=>v?.source_group==="review"),application:vocab.filter(v=>v?.source_group==="application")};
    check(vocab.every(v=>["new","review","application"].includes(v?.source_group)),"PM_GROUP_INVALID","Invalid PM source_group");
    check(range(groups.new.length,3,4)&&range(groups.review.length,4,6)&&range(groups.application.length,2,3),"PM_GROUP_COUNT","3-4 new, 4-6 review, 2-3 application");
    const actualNew=ws(groups.new),declared=ws(lesson.new_words);
    check(declared.length===actualNew.length&&JSON.stringify([...declared].sort())===JSON.stringify([...actualNew].sort()),"PM_NEW_WORDS_MISMATCH","new_words differs from new vocab group");
    check(existing?.am===true&&sameDayAm?.date===date&&sameDayAm?.session==="am"&&sameDayAm?.time==="08:00"&&sameDayAm?.vocab?.length===10,"AM_PREREQUISITE_MISSING","Published same-day AM must exist");
    vocab.forEach(v=>{
      const w=word(v),g=v?.source_group;
      check(typeof v?.is_new==="boolean"&&v.is_new===(g==="new"),"PM_NEW_FLAG_INVALID",w);
      if(g==="new"){
        pool(w,newPool,"NEW_WORD_INELIGIBLE");
        check(dont.has(w)||fuzzy.has(w),"NEW_MEMORY_POOL_INVALID",w);
        check(!unclassified.has(w),"UNCLASSIFIED_NEW_WORD",w);
        check(!amWords.has(w),"SAME_DAY_NEW_REPEAT",w);
        if(v.is_oral_new)pool(w,oral,"ORAL_INELIGIBLE");
      }
      if(g==="review"||g==="application")pool(w,reviewPool,"TAUGHT_ACTIVE_INELIGIBLE");
      if(g==="application"){
        const label=String(v.formation||"")+" "+String(v.usage_note||"");
        const newly=/今天\s*08:00\s*新学/.test(label);
        const oldReview=/今天\s*08:00\s*复习过的老词/.test(label);
        // Accept the generic marker in older published lessons and normal ChatGPT
        // drafts; precise new/review markers must match their actual AM provenance.
        const legacy=/今天\s*08:00\s*已教/.test(label);
        if(amNewWords.has(w))check(newly||legacy,"AM_MARKER_MISSING",w);
        else if(amReviewWords.has(w))check(oldReview||legacy,"AM_MARKER_MISSING",w);
        if(newly)check(amNewWords.has(w),"AM_MARKER_FALSE",w);
        if(oldReview)check(amReviewWords.has(w)&&!amNewWords.has(w),"AM_MARKER_FALSE",w);
        if(legacy)check(amWords.has(w),"AM_MARKER_FALSE",w);
      }
    });
    const usableFuzzy=[...fuzzy].filter(w=>newPool.has(w)&&!amWords.has(w));
    const usableDont=[...dont].filter(w=>newPool.has(w)&&!amWords.has(w));
    if(usableFuzzy.length>=2&&usableDont.length>=1){
      check(actualNew.filter(w=>fuzzy.has(w)).length>=2,"PM_FUZZY_PRIORITY","2 fuzzy expected");
      check(actualNew.some(w=>dont.has(w)),"PM_DONT_REQUIRED","1 dont expected");
    }
    const pmEligibleOral=[...oral].some(w=>newPool.has(w)&&!amWords.has(w)&&(dont.has(w)||fuzzy.has(w)));
    if(pmEligibleOral)check(groups.new.some(v=>v.is_oral_new),"PM_ORAL_COUNT","Use eligible oral new word");
    check(lesson.dialogue&&!Array.isArray(lesson.dialogue)&&str(lesson.dialogue.title)&&Array.isArray(lesson.dialogue.lines)&&lesson.dialogue.lines.length>=4&&lesson.dialogue.lines.every(x=>str(x?.speaker)&&str(x?.id)&&str(x?.cn)),"PM_DIALOGUE_INVALID","Dialogue object with 4+ bilingual lines");
    check(!has(lesson,"rewrite_application"),"PM_LEGACY_REWRITE","Use root rewrite");
    check(Array.isArray(lesson.rewrite)&&range(lesson.rewrite.length,3,4)&&lesson.rewrite.every(x=>["task","reference_answer","reference_cn"].every(k=>str(x?.[k]))),"PM_REWRITE_INVALID","3-4 bilingual rewrite tasks required");
    const test=lesson.daily_test,qs=Array.isArray(test?.questions)?test.questions:[];
    check(!has(test,"items")&&qs.length===6&&qs.filter(q=>q?.type==="choice").length===3&&qs.filter(q=>q?.type==="fill").length===2&&qs.filter(q=>q?.type==="order").length===1,"PM_TEST_SCHEMA","Only 3 choice + 2 fill + 1 order in questions");
    qs.filter(q=>q?.type==="choice").forEach((q,i)=>choice(q,i,"prompt"));
    qs.filter(q=>q?.type==="fill").forEach((q,i)=>check(/^填空\s*[：:]/.test(q.prompt||"")&&/[（(][^（）()]+[）)]/.test(q.prompt||"")&&str(q.answer)&&str(q.explain),"PM_FILL_INVALID","Fill "+(i+1)));
    qs.filter(q=>q?.type==="order").forEach(q=>{
      check(/按照中文|根据中文/.test(q.prompt||"")&&range(q.tokens?.length,5,8)&&q.tokens.every(str)&&str(q.answer)&&str(q.answer_cn)&&str(q.explain),"PM_ORDER_INVALID","Order structure");
      if(Array.isArray(q.tokens)&&str(q.answer))check(norm(q.tokens.join(" "))===norm(q.answer),"PM_ORDER_ANSWER_MISMATCH","Reconstruction from tokens");
    });
    check(Array.isArray(test?.self_check)&&test.self_check.length>0&&test.self_check.every(str),"PM_SELF_CHECK_INVALID","Nonempty self_check");
    check(lesson.review&&!Array.isArray(lesson.review)&&str(lesson.review.title)&&Array.isArray(lesson.review.steps)&&lesson.review.steps.length>0&&lesson.review.steps.every(str),"PM_FINAL_REVIEW_INVALID","Review {title,steps[]}");
  }

  // Enforce new review rotation only for unpublished lessons on/after its effective date.
  const rotation=rules.review_rotation;
  if(rotation&&rotation.enabled===true&&date>=(rotation.effective_date||'2026-09-28')){
   if(!Array.isArray(reviewHistory)){
    add('REVIEW_HISTORY_MISSING','The completed seven-day AM/PM review history is required');
   }else{
    const at=Date.parse(date+'T00:00:00Z'),from=at-7*86400000;
    const expected=[];
    for(const row of index.dates||[]){
     const d=Date.parse(String(row.date||'')+'T00:00:00Z');
     if(!Number.isFinite(d)||d<from||d>at)continue;
     for(const slot of ['am','pm'])if(row[slot]===true&&!(row.date===date&&(session==='am'||slot!=='am')))expected.push(row.date+'-'+slot);
    }
    const ids=reviewHistory.map(h=>String(h?.date||'')+'-'+String(h?.session||''));
    check(expected.length===ids.length&&expected.every(id=>ids.includes(id))&&new Set(ids).size===ids.length,'REVIEW_HISTORY_INCOMPLETE','The seven-day completed index coverage is incomplete or duplicated');
    const stamps=[], exposures=new Map(), completed=reviewHistory.slice().sort((a,b)=>(a.date+' '+a.session).localeCompare(b.date+' '+b.session));
    for(const h of completed){
     if(!h||!['am','pm'].includes(h.session))continue;
     const t=Date.parse(h.date+'T'+(h.session==='am'?'08:00:00':h.date<'2026-09-16'?'19:00:00':'18:00:00')+'+07:00');
     const words=h.session==='am'?ws(h.review_vocab):ws((h.vocab||[]).filter(v=>v?.source_group==='review'));
     const rec={date:h.date,session:h.session,time:t,words:new Set(words)};
     stamps.push(rec);
     for(const w of words){if(!exposures.has(w))exposures.set(w,[]);exposures.get(w).push(rec)}
    }
    const selected=session==='am'?ws(lesson.review_vocab):ws(vocab.filter(v=>v?.source_group==='review'));
    const lastWrong=new Map((runtime.review_pool||[]).map(v=>[word(v),Array.isArray(v)?Date.parse(v[3]||''):NaN]));
    const generatedAt=Date.parse(runtime.generated_at||'');
    const fresh=w=>{
     const recent=exposures.get(w)||[],last=recent.length?recent[recent.length-1].time:NaN,wrong=lastWrong.get(w);
     return Number.isFinite(last)&&Number.isFinite(wrong)&&Number.isFinite(generatedAt)&&wrong>last&&wrong<=generatedAt+300000;
    };
    const sameDayAm=stamps.find(x=>x.date===date&&x.session==='am');
    const pms=stamps.filter(x=>x.session==='pm').slice(-2);
    const latest=stamps.at(-1);
    const reviewCount=w=>(exposures.get(w)||[]).length;
    const blocked=w=>{
     if(fresh(w))return false;
     if(session==='pm'&&sameDayAm?.words.has(w))return true;
     if(session==='am'&&latest?.session==='pm'&&latest?.words.has(w))return true;
     return pms.length===2&&pms.every(x=>x.words.has(w))&&(at-Date.parse(pms[1].date+'T00:00:00Z'))<=3*86400000;
    };
    for(const w of selected){
     if(fresh(w))continue;
     if(session==='pm'&&sameDayAm?.words.has(w))add('PM_SAME_DAY_REVIEW_REPEAT',w+' was already a core review at 08:00; no new wrong answer');
     else if(session==='am'&&latest?.session==='pm'&&latest?.words.has(w))add('AM_PREVIOUS_PM_REVIEW_REPEAT',w+' was a core review in the preceding PM session');
     else if(pms.length===2&&pms.every(x=>x.words.has(w))&&(at-Date.parse(pms[1].date+'T00:00:00Z'))<=3*86400000)add('PM_REVIEW_COOLDOWN',w+' was in both previous PM core-review sets; allow three days unless a new wrong answer');
    }
    const frequent=selected.filter(w=>reviewCount(w)>=3&&!fresh(w));
    const alternatives=[...reviewPool].filter(w=>!selected.includes(w)&&reviewCount(w)<3&&!blocked(w));
    if(frequent.length>1&&alternatives.length>=frequent.length-1)
     add('REVIEW_OVEREXPOSURE','At most one word with three or more core-review exposures in the last seven days when eligible alternatives exist: '+frequent.join(', '));
    if(session==='pm'){ // executable recent-4-day / focus-mix / application rules (see review-rotation.js)
     const groupWords=g=>ws(vocab.filter(v=>v?.source_group===g));
     for(const e of checkPm({date,runtime,rotation,reviewHistory,review:groupWords('review'),application:groupWords('application'),newWords:groupWords('new'),amReview:[...amReviewWords]}))add(e.code,e.detail);
    }
   }
  }
  return {ok:errors.length===0,errors,date,session,baselineWatermark:runtime.lesson_watermark,proposedFlag:date+"."+session+"=true"};
};
function cli(argv){const a={};for(let i=0;i<argv.length;i++){if(!argv[i].startsWith('--')||!argv[i+1]||argv[i+1].startsWith('--'))throw Error('Expected --key value');a[argv[i++].slice(2)]=argv[i]}return a}
function read(f){return JSON.parse(fs.readFileSync(path.resolve(process.cwd(),f),'utf8'))}
function optional(f){return fs.existsSync(path.resolve(process.cwd(),f))?read(f):null}
if(require.main===module){try{const a=cli(process.argv.slice(2));if(!a.candidate||!a.date||!a.session)throw Error('--candidate, --date, --session required');const date=a.date;const prev=new Date(Date.parse(date+'T00:00:00Z')-86400000).toISOString().slice(0,10);const lesson=read(a.candidate),index=read(a.index||'data/daily/index.json'),runtime=read(a.runtime||'data/learning-runtime.json'),rules=read(a.rules||'data/learning-pool-rules.json');const result=validate({lesson,index,runtime,rules,expectedDate:date,expectedSession:a.session,sameDayAm:optional(a['same-day-am']||'data/daily/'+date+'-am.json'),previousPm:optional(a['previous-pm']||'data/daily/'+prev+'-pm.json'),reviewHistory:collectReviewHistory(index,date,a.session,p=>read(p))});result.baselineFingerprint=crypto.createHash('sha256').update(JSON.stringify({index,runtime,rules})).digest('hex');console.log(JSON.stringify(result,null,2));process.exitCode=result.ok?0:1}catch(e){console.error(JSON.stringify({ok:false,errors:[{code:'VALIDATOR_INPUT_ERROR',detail:e.message}]}));process.exitCode=2}}
module.exports={validate,collectReviewHistory};
