#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {checkCore,checkPm,checkExposure}=require('./review-rotation');
const RP=require('./review-phase');

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

// 2026-10-18 (user decision): every lesson from this date carries lesson_focus — 3 of the lesson's own words and 2
// sentence patterns whose example is taken word for word from the lesson. Earlier lessons may lack it (optional there).
const FOCUS_REQUIRED_FROM="2026-10-18 18:00"; // first required lesson (that morning was already published)
// 2026-10-22 (user review, LESSON-QUALITY 7d): learner-facing text must not carry the generator's internal vocabulary
// (the 10-21 PM showed "runtime.oral_new_pool", "（hard）", "application" in usage notes). Field values only; the
// English gloss (en) and structural fields are not checked. Applies to lessons dated from JARGON_FROM.
const JARGON_FROM="2026-10-23";
const JARGON=/runtime|\b[a-z]+_pool\b|source_group|is_oral_new|\bis_new\b|exposure_ledger|natural_recurrence|review_cycle|cycle_vocab|review_vocab|lesson_focus|validator|（hard）|\(hard\)|hard\s*词|hard=|\bapplication\b/i;
const JARGON_SKIP=new Set(["en","source_group","session","write_status","date","time","day","group"]);
const validate=function validate({lesson,index,runtime,rules,expectedDate,expectedSession,sameDayAm,previousPm,reviewHistory,focusRequiredFrom,jargonFrom,reviewPhase,themes}) {
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
  // Review phase (2026-10-25, dormant until the learner switches data/review-phase.json on): P=false keeps every
  // count and rule below exactly as before; C then equals the old hard-coded numbers.
  const phase=reviewPhase===undefined?RP.load():reviewPhase,P=RP.on(phase,date),C=RP.counts(phase,date);
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
  {const rd=session==="am"?C.am_reading:RP.LEGACY.am_reading;
  check(range(count(lesson.reading?.text),rd[0],rd[1])&&str(lesson.reading?.cn),"READING_INVALID",rd[0]+"-"+rd[1]+" Indonesian words plus Chinese required");}
  const choice=(q,i,label)=>{
    const opts=Array.isArray(q?.options)?q.options:[],a=q?.answer_index;
    const valid=opts.length>=2&&opts.every(str)&&new Set(opts.map(norm)).size===opts.length&&Number.isInteger(a)&&a>=0&&a<opts.length;
    check(valid&&str(q?.[label])&&str(q?.explain),"QUESTION_INVALID","Question "+(i+1)+" schema");
    if(valid&&has(q,"answer"))check(norm(q.answer)===norm(opts[a]),"ANSWER_MISMATCH","Question "+(i+1)+" answer vs index");
    return valid?norm(opts[a]):"";
  };
  // Review cycle (2026-10-14): words in the same-day AM's cycle_vocab are old words reviewed at 08:00, not new words.
  const amCycleWords=new Set(ws(sameDayAm?.cycle_vocab));
  const amNewWords=new Set(ws(sameDayAm?.vocab).filter(w=>!amCycleWords.has(w))),amReviewWords=new Set([...ws(sameDayAm?.review_vocab),...amCycleWords]);
  const amWords=new Set([...amNewWords,...amReviewWords]);
  if(session==="am"){
    if(!P)check(vocab.length===10,"AM_CORE_COUNT","Exactly 10 new words required");
    else check(range(vocab.length,C.am_cards[0],C.am_cards[1]),"AM_CORE_COUNT","Review phase: "+C.am_cards.join("-")+" word cards");
    const N=P?vocab.length:10; // cards to fill (review phase: whatever the lesson has within its range)
    const prevDate=new Date(Date.parse(date+"T00:00:00Z")-86400000).toISOString().slice(0,10);
    const prevNew=new Set(previousPm?.write_status==="lesson_complete"?ws(previousPm.new_words):[]);
    if(previousPm){
      check(previousPm.date===prevDate&&previousPm.session==="pm","PREVIOUS_PM_INVALID","Previous PM date/session mismatch");
      prevNew.forEach(w=>check(!newPool.has(w),"BASELINE_SYNC_STALE","Previous PM word still new: "+w));
    }
    const availDont=[...dont].filter(w=>newPool.has(w)&&!prevNew.has(w));
    // Review cycle (2026-10-14, user decision): when fewer than 10 legal new words remain, the AM teaches every remaining
    // new word and fills the rest of its 10 cards with review-cycle words, listed in root cycle_vocab (all from review_pool).
    const availNew=[...newPool].filter(w=>!prevNew.has(w)&&!unclassified.has(w)&&(dont.has(w)||fuzzy.has(w)));
    const amCycle=availNew.length<N,cycleVocab=ws(lesson.cycle_vocab);
    const newPart=amCycle?vw.filter(w=>newPool.has(w)):vw;
    if(!amCycle)check(!has(lesson,"cycle_vocab")||cycleVocab.length===0,"CYCLE_NOT_ACTIVE","cycle_vocab is only allowed when fewer than "+N+" legal new words remain ("+availNew.length+" available)");
    else{
      const cyc=vw.filter(w=>!newPool.has(w));
      check(availNew.every(w=>vw.includes(w)),"CYCLE_NEW_REQUIRED","Review cycle: teach every remaining new word first; missing "+availNew.filter(w=>!vw.includes(w)).join(", "));
      check(Array.isArray(lesson.cycle_vocab)&&JSON.stringify([...cyc].sort())===JSON.stringify([...cycleVocab].sort()),"CYCLE_VOCAB_MISMATCH","cycle_vocab must list exactly the vocab words that are not new: "+cyc.join(", "));
      cyc.forEach(w=>{pool(w,reviewPool,"CYCLE_WORD_INELIGIBLE");const v=vocab.find(x=>word(x)===w);check(v&&v.is_oral_new===false,"CYCLE_ORAL_FLAG",w)});
    }
    newPart.forEach(w=>{pool(w,newPool,"NEW_WORD_INELIGIBLE");check(dont.has(w)||fuzzy.has(w),"NEW_MEMORY_POOL_INVALID",w);check(!unclassified.has(w),"UNCLASSIFIED_NEW_WORD",w);check(!prevNew.has(w),"CROSS_DAY_NEW_REPEAT",w)});
    if(!amCycle){
      if(availDont.length>=N)check(vw.every(w=>dont.has(w)),"AM_DONT_PRIORITY",N+" available dont -> choose "+N+" dont");
      else check(vw.filter(w=>dont.has(w)).length===availDont.length,"AM_DONT_PRIORITY","Exhaust dont before fuzzy fallback");
    }
    const oralEligible=[...oral].filter(w=>newPool.has(w)&&!prevNew.has(w));
    const oralDontEligible=oralEligible.filter(w=>dont.has(w));
    const oralFuzzyEligible=oralEligible.filter(w=>fuzzy.has(w));
    const dontSlots=Math.min(N,availDont.length),fuzzySlots=N-dontSlots;
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
    // 2026-10-16 (user decision): optional structured copy of the same three review points, for the review cards on the
    // page. Absent = fine (the page shows the three strings). Present = must be well formed; every recall answer must be
    // one of today's words, so the page never shows an answer that was not taught. On failure the generator removes it.
    // Review phase AM = 表达难点课: the easily confused words are shown as contrast cards (review_cards.contrasts).
    if(P)check(lesson.review_cards!==undefined,"PHASE_AM_CONTRAST_MISSING","Review phase: review_cards with contrasts (1-6 groups) required");
    if(lesson.review_cards!==undefined){
      const rc=lesson.review_cards,pair=x=>x&&str(x.id)&&str(x.cn),today=new Set(vocab.map(word).concat(rw,(Array.isArray(lesson.cycle_vocab)?lesson.cycle_vocab:[]).map(norm)));
      const recall=rc&&rc.recall,contrasts=rc&&rc.contrasts,apply=rc&&rc.apply,frames=rc&&rc.frames;
      check(rc&&typeof rc==="object"&&!Array.isArray(rc),"AM_REVIEW_CARDS_INVALID","review_cards must be an object {recall, contrasts, apply}");
      check(Array.isArray(recall)&&range(recall.length,4,12)&&recall.every(pair),"AM_REVIEW_CARDS_INVALID","review_cards.recall: 4-12 {cn,id}");
      if(Array.isArray(recall))recall.filter(pair).forEach(x=>check(today.has(norm(x.id)),"AM_REVIEW_CARDS_ANSWER","recall answer is not one of today's words: "+x.id));
      check(frames===undefined||(Array.isArray(frames)&&frames.length<=6&&frames.every(str)),"AM_REVIEW_CARDS_INVALID","review_cards.frames: up to 6 strings");
      check(Array.isArray(contrasts)&&range(contrasts.length,1,6)&&contrasts.every(g=>g&&Array.isArray(g.items)&&range(g.items.length,2,3)&&g.items.every(pair)&&str(g.note)),"AM_REVIEW_CARDS_INVALID","review_cards.contrasts: 1-6 groups of 2-3 {id,cn} with a note");
      check(Array.isArray(apply)&&range(apply.length,1,4)&&apply.every(a=>a&&str(a.word)&&str(a.usage)&&Array.isArray(a.examples)&&range(a.examples.length,1,3)&&a.examples.every(pair)),"AM_REVIEW_CARDS_INVALID","review_cards.apply: 1-4 {word,usage,examples:[{id,cn}]}");
    }
  } else {
    check(lesson.write_status==="lesson_complete","PM_STATUS_INVALID","PM status incomplete");
    check(range(vocab.length,C.pm_core[0],C.pm_core[1]),"PM_CORE_COUNT",C.pm_core.join("-")+" core words required");
    const groups={new:vocab.filter(v=>v?.source_group==="new"),review:vocab.filter(v=>v?.source_group==="review"),application:vocab.filter(v=>v?.source_group==="application")};
    check(vocab.every(v=>["new","review","application"].includes(v?.source_group)),"PM_GROUP_INVALID","Invalid PM source_group");
    // Review cycle (2026-10-14): fewer than 3 legal new words left for tonight -> teach all of them (0-2), and the review
    // group grows (4-9) so the lesson keeps its 10-12 core cards.
    const availNewPm=[...newPool].filter(w=>!amWords.has(w)&&!unclassified.has(w)&&(dont.has(w)||fuzzy.has(w)));
    if(P){const nn=Math.min(availNewPm.length,C.pm_new[1]);
      check(groups.new.length===nn&&range(groups.review.length,C.pm_review[0],C.pm_review[1])&&range(groups.application.length,C.pm_application[0],C.pm_application[1]),"PM_GROUP_COUNT","Review phase: "+nn+" new, "+C.pm_review.join("-")+" review, "+C.pm_application.join("-")+" application");}
    else if(availNewPm.length>=3)check(range(groups.new.length,3,4)&&range(groups.review.length,4,6)&&range(groups.application.length,2,3),"PM_GROUP_COUNT","3-4 new, 4-6 review, 2-3 application");
    else check(groups.new.length===availNewPm.length&&range(groups.review.length,4,9)&&range(groups.application.length,2,3),"PM_GROUP_COUNT","Review cycle: all "+availNewPm.length+" remaining new words, 4-9 review, 2-3 application");
    const actualNew=ws(groups.new),declared=ws(lesson.new_words);
    check(declared.length===actualNew.length&&JSON.stringify([...declared].sort())===JSON.stringify([...actualNew].sort()),"PM_NEW_WORDS_MISMATCH","new_words differs from new vocab group");
    check(existing?.am===true&&sameDayAm?.date===date&&sameDayAm?.session==="am"&&sameDayAm?.time==="08:00"&&(P?range(sameDayAm?.vocab?.length,C.am_cards[0],C.am_cards[1]):sameDayAm?.vocab?.length===10),"AM_PREREQUISITE_MISSING","Published same-day AM must exist");
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
    check(lesson.dialogue&&!Array.isArray(lesson.dialogue)&&str(lesson.dialogue.title)&&Array.isArray(lesson.dialogue.lines)&&range(lesson.dialogue.lines.length,C.pm_dialogue[0],C.pm_dialogue[1])&&lesson.dialogue.lines.every(x=>str(x?.speaker)&&str(x?.id)&&str(x?.cn)),"PM_DIALOGUE_INVALID",P?"Review phase: dialogue with "+C.pm_dialogue.join("-")+" bilingual lines":"Dialogue object with 4+ bilingual lines");
    // Review phase PM = 任务课: the dialogue has one turn where the situation changes (dialogue.twist = its line index),
    // and at least one rewrite task (kind "twist") asks the learner to handle that change.
    if(P){const L=Array.isArray(lesson.dialogue?.lines)?lesson.dialogue.lines.length:0,tw=lesson.dialogue?.twist;
      check(Number.isInteger(tw)&&tw>=1&&tw<L,"PHASE_PM_TWIST","Review phase: dialogue.twist must be the index (1.."+(L-1)+") of the line where the situation changes");
      check(Array.isArray(lesson.rewrite)&&lesson.rewrite.some(x=>x&&x.kind==="twist"),"PHASE_PM_TWIST","Review phase: one rewrite task with kind \"twist\" (respond to the change)");}
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

  // Review phase: every lesson names its theme and day role, which must match data/themes.json for this date.
  if(P){
    const plan=RP.dayPlan(phase,date,themes===undefined?RP.loadThemes():themes);
    const ph=lesson.phase;
    check(ph&&typeof ph==="object"&&!Array.isArray(ph)&&str(ph.theme_id)&&str(ph.day_role),"PHASE_TAG_MISSING","Review phase: root phase {theme_id, day_role} required");
    if(plan&&ph)check(ph.theme_id===plan.theme_id&&ph.day_role===plan.day_role,"PHASE_TAG_MISMATCH","Review phase: expected theme "+plan.theme_id+" / "+plan.day_role+" for "+date);
    if(plan&&plan.day_role==="weekly_test"&&session==="pm"){
      // Sunday PM test covers this theme week: 6-12 week words, each taught or reviewed in a lesson since Monday, each tested.
      const weekStart=new Date(Date.parse(date+"T00:00:00Z")-6*86400000).toISOString().slice(0,10);
      const weekSet=new Set();
      for(const h of [...(Array.isArray(reviewHistory)?reviewHistory:[]),sameDayAm].filter(Boolean))
        if(h.date>=weekStart&&h.date<=date)[...ws(h.vocab),...ws(h.review_vocab),...ws(h.cycle_vocab)].forEach(w=>weekSet.add(w));
      const ww=ws(lesson.daily_test?.week_words),qs=Array.isArray(lesson.daily_test?.questions)?lesson.daily_test.questions:[];
      const qtext=norm(JSON.stringify(qs));
      check(range(ww.length,6,12)&&new Set(ww).size===ww.length,"PHASE_WEEKLY_TEST","Weekly test: daily_test.week_words lists 6-12 distinct words");
      ww.forEach(w=>{check(weekSet.has(w),"PHASE_WEEKLY_TEST","Weekly test word not in this week's lessons: "+w);check(qtext.includes(w),"PHASE_WEEKLY_TEST","Weekly test word is not tested by any question: "+w)});
    }
  }
  // Today's focus: chosen from this lesson only; it adds no words and no tasks.
  {
    const lf=lesson.lesson_focus,from=focusRequiredFrom||FOCUS_REQUIRED_FROM;
    if(lf===undefined)check(date+" "+time<(from.length===10?from+" 00:00":from),"LESSON_FOCUS_MISSING","lesson_focus (3 words + 2 patterns) required from "+from);
    else{
      const own=new Set(session==="am"?[...vocab.map(word),...ws(lesson.review_vocab),...ws(lesson.cycle_vocab)]:vocab.map(word));
      const texts=[...(session==="am"?(Array.isArray(lesson.sentences)?lesson.sentences.map(x=>x&&x.text):[]):[]),lesson.reading&&lesson.reading.text,
        ...vocab.map(v=>v&&v.example),...(session==="am"?[lesson.output&&lesson.output.reference_answer]:[]),
        ...(session==="pm"?[...(lesson.dialogue&&Array.isArray(lesson.dialogue.lines)?lesson.dialogue.lines.map(l=>l&&l.id):[]),...(Array.isArray(lesson.rewrite)?lesson.rewrite.map(r=>r&&r.reference_answer):[])]:[])]
        .filter(str).map(norm).join(" | ");
      const fw=lf&&Array.isArray(lf.words)?lf.words:[],fp=lf&&Array.isArray(lf.patterns)?lf.patterns:[];
      check(lf&&typeof lf==="object"&&!Array.isArray(lf)&&fw.length===3&&fw.every(str)&&new Set(fw.map(norm)).size===3,"LESSON_FOCUS_INVALID","lesson_focus.words: exactly 3 distinct words");
      fw.filter(str).forEach(w=>check(own.has(norm(w)),"LESSON_FOCUS_WORD","focus word is not one of this lesson's words: "+w));
      check(fp.length===2&&fp.every(p=>p&&str(p.pattern)&&str(p.cn)&&str(p.example)&&str(p.example_cn)),"LESSON_FOCUS_INVALID","lesson_focus.patterns: exactly 2 {pattern, cn, example, example_cn}");
      fp.filter(p=>p&&str(p.example)).forEach(p=>check(texts.includes(norm(p.example)),"LESSON_FOCUS_PATTERN","pattern example must be copied from this lesson: "+p.example));
    }
  }
  if(String(date||"")>=(jargonFrom||JARGON_FROM)){
    const seen=[];
    const walk=(o,at)=>{if(typeof o==="string"){const m=o.match(JARGON);if(m)seen.push(at+": "+m[0]);}
      else if(Array.isArray(o))o.forEach((x,i)=>walk(x,at+"["+i+"]"));
      else if(o&&typeof o==="object")Object.keys(o).forEach(k=>{if(!JARGON_SKIP.has(k))walk(o[k],at?at+"."+k:k)});};
    walk(lesson,"");
    check(!seen.length,"LEARNER_JARGON","internal system words in learner-facing text (write it for the learner): "+seen.slice(0,5).join("; "));
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
    // Original hard core-review rules: single shared implementation in review-rotation.js (core-only, unchanged).
    const selected=session==='am'?[...ws(lesson.review_vocab),...ws(lesson.cycle_vocab)]:ws(vocab.filter(v=>v?.source_group==='review'));
    for(const e of checkCore({date,session,runtime,reviewHistory,selected}))add(e.code,e.detail);
    if(session==='pm'){ // executable recent-4-day / focus-mix / application rules (see review-rotation.js)
     const groupWords=g=>ws(vocab.filter(v=>v?.source_group===g));
     for(const e of checkPm({date,runtime,rotation,reviewHistory,review:groupWords('review'),application:groupWords('application'),newWords:groupWords('new'),amReview:[...amReviewWords]}))add(e.code,e.detail);
    }
    // Exposure ledger (2026-10-08+): application counts as an active exposure; no core slot right after an active
    // exposure or on the third day in a row. Only raised when enough legal alternatives exist (see review-rotation.js).
    {const g=gr=>ws(vocab.filter(v=>v?.source_group===gr));
     const amCyc=new Set(ws(lesson.cycle_vocab));
     const sel=session==='am'?{review:[...ws(lesson.review_vocab),...amCyc],application:[],newWords:vw.filter(w=>!amCyc.has(w))}:{review:g('review'),application:g('application'),newWords:g('new')};
     for(const e of checkExposure({date,session,runtime,rotation,reviewHistory,...sel,amVocab:[...amNewWords]}))add(e.code,e.detail);}
   }
  }
  return {ok:errors.length===0,errors,date,session,baselineWatermark:runtime.lesson_watermark,proposedFlag:date+"."+session+"=true"};
};
function cli(argv){const a={};for(let i=0;i<argv.length;i++){if(!argv[i].startsWith('--')||!argv[i+1]||argv[i+1].startsWith('--'))throw Error('Expected --key value');a[argv[i++].slice(2)]=argv[i]}return a}
function read(f){return JSON.parse(fs.readFileSync(path.resolve(process.cwd(),f),'utf8'))}
function optional(f){return fs.existsSync(path.resolve(process.cwd(),f))?read(f):null}
if(require.main===module){try{const a=cli(process.argv.slice(2));if(!a.candidate||!a.date||!a.session)throw Error('--candidate, --date, --session required');const date=a.date;const prev=new Date(Date.parse(date+'T00:00:00Z')-86400000).toISOString().slice(0,10);const lesson=read(a.candidate),index=read(a.index||'data/daily/index.json'),runtime=read(a.runtime||'data/learning-runtime.json'),rules=read(a.rules||'data/learning-pool-rules.json');const result=validate({lesson,index,runtime,rules,expectedDate:date,expectedSession:a.session,sameDayAm:optional(a['same-day-am']||'data/daily/'+date+'-am.json'),previousPm:optional(a['previous-pm']||'data/daily/'+prev+'-pm.json'),reviewHistory:collectReviewHistory(index,date,a.session,p=>read(p))});result.baselineFingerprint=crypto.createHash('sha256').update(JSON.stringify({index,runtime,rules})).digest('hex');console.log(JSON.stringify(result,null,2));process.exitCode=result.ok?0:1}catch(e){console.error(JSON.stringify({ok:false,errors:[{code:'VALIDATOR_INPUT_ERROR',detail:e.message}]}));process.exitCode=2}}
module.exports={validate,collectReviewHistory,FOCUS_REQUIRED_FROM,JARGON_FROM};
