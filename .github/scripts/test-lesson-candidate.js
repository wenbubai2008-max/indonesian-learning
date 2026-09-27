'use strict';
const {validate}=require('./validate-lesson-candidate');
const runTests=function runTests(validate){
 const clone=x=>JSON.parse(JSON.stringify(x)),day="2026-09-28",wctext=Array(85).fill("Saya").join(" ");
 const card=(w)=>({word:w,display:w,audio_text:w,cn:"中文",en:"English",root:w,root_cn:"词根",formation:"派生词形",example:"Saya ingin belajar.",example_cn:"我想学习",synonym_note:"与近义词辨析",usage_note:"练习中",source_group:"review",is_new:false,is_oral_new:false});
 function AM(){
   const words=Array.from({length:10},(_,i)=>"new"+i),review=Array.from({length:5},(_,i)=>"rev"+i);
   const runtime={version:4,rules_version:4,generated_at:"2026-09-27T18:00:00Z",stats:{master_unique:977},lesson_watermark:"2026-09-27 18:00",new_pool:words.concat(["f0"]),new_pool_dont:words,new_pool_fuzzy:["f0"],oral_new_pool:[["new0"],["new1"]],oral_new_pool_dont:[["new0"],["new1"]],review_pool:review.map(x=>[x])};
   const lesson={date:day,session:"am",time:"08:00",day:38,title:"08:00 早课",vocab:words.map((w,i)=>({...card(w),is_oral_new:i<2})),review_vocab:review,sentences:Array.from({length:5},()=>({text:"Saya bekerja hari ini.",cn:"我今天工作"})),reading:{text:wctext,cn:"中文"},quiz:[{question:"复习词选择",options:["rev0","other"],answer_index:0,explain:"解释"},{question:"词义选择",options:["new0","new1"],answer_index:0,explain:"解释"},{question:"词义选择",options:["new2","new3"],answer_index:0,explain:"解释"}],output:{task:"造句",reference_answer:"Saya bekerja.",reference_cn:"我工作"},review:["第一","第二","第三"]};
   return {lesson,index:{dates:[{date:"2026-09-27",am:true,pm:true},{date:day,am:false,pm:false}],updated:day},runtime,rules:{version:4},expectedDate:day,expectedSession:"am",previousPm:{date:"2026-09-27",session:"pm",write_status:"lesson_complete",new_words:["oldpm"]}};
 }
 function PM(){
   const nw=["f0","f1","n0","n1"],rv=Array.from({length:5},(_,i)=>"review"+i),app=["app0","app1","app2"];
   const runtime={version:4,rules_version:4,generated_at:"2026-09-28T01:00:00Z",stats:{master_unique:977},lesson_watermark:day+" 08:00",new_pool:[...nw],new_pool_dont:["n0","n1"],new_pool_fuzzy:["f0","f1"],oral_new_pool:[["f0"]],review_pool:rv.concat(app).map(x=>[x])};
   const v=nw.map((x,i)=>({...card(x),source_group:"new",is_new:true,is_oral_new:i===0})).concat(rv.map(card),app.map(x=>({...card(x),source_group:"application",usage_note:"今天08:00已教；应用复现"})));
   const q=[0,1,2].map(i=>({type:"choice",prompt:"哪个词正确",options:["f0","n0","f1"],answer_index:i,answer:["f0","n0","f1"][i],explain:"解释"})).concat([0,1].map(i=>({type:"fill",prompt:"填空：Saya ____ hari ini.（提示）",answer:"belajar",explain:"解释"})),[{type:"order",prompt:"按照中文排列印尼语：我想学习",tokens:["Saya","ingin","belajar","hari","ini."],answer:"Saya ingin belajar hari ini.",answer_cn:"我今天想学习",explain:"解释"}]);
   const lesson={date:day,session:"pm",time:"18:00",day:38,title:"18:00 晚课",write_status:"lesson_complete",new_words:[...nw],vocab:v,reading:{text:wctext,cn:"中文"},dialogue:{title:"对话",lines:Array.from({length:4},(_,i)=>({speaker:i%2?"B":"A",id:"Saya ingin belajar.",cn:"我想学习"}))},rewrite:Array.from({length:3},()=>({task:"翻译",reference_answer:"Saya bekerja.",reference_cn:"我工作"})),daily_test:{questions:q,self_check:["自己复盘"]},review:{title:"最后复盘",steps:["第一","第二"]}};
   return {lesson,index:{dates:[{date:"2026-09-27",am:true,pm:true},{date:day,am:true,pm:false}],updated:day},runtime,rules:{version:4},expectedDate:day,expectedSession:"pm",sameDayAm:{date:day,session:"am",time:"08:00",vocab:app.concat(Array.from({length:7},(_,i)=>"other"+i)).map(word=>({word})),review_vocab:["review0"]}};
 }
 let count=0;const ok=(name,input)=>{const r=validate(input);if(!r.ok)throw Error(name+" valid failed "+JSON.stringify(r.errors));count++};const bad=(name,input,code)=>{const r=validate(input);if(r.ok||!r.errors.some(x=>x.code===code))throw Error(name+" expected "+code+" got "+JSON.stringify(r.errors));count++};
 ok("normal AM",AM());ok("normal PM",PM());
 const matrix=[
  ["AM duplicate","am",x=>x.lesson.vocab[9].word=x.lesson.vocab[0].word,"CORE_WORDS_INVALID"],
  ["AM unknown new","am",x=>x.lesson.vocab[0].word="unknown","NEW_WORD_INELIGIBLE"],
  ["AM fuzzy when dont sufficient","am",x=>x.lesson.vocab[9].word="f0","AM_DONT_PRIORITY"],
  ["AM missing root_cn","am",x=>x.lesson.vocab[0].root_cn="","ROOT_CN_MISSING"],
  ["AM old runtime","am",x=>x.runtime.lesson_watermark="2026-09-26 18:00","BASELINE_SYNC_STALE"],
  ["AM wrong identity","am",x=>x.lesson.date="2026-09-29","IDENTITY_MISMATCH"],
  ["AM duplicate index date","am",x=>x.index.dates.push({...x.index.dates.at(-1)}),"INDEX_INVALID"],
  ["AM already published","am",x=>x.index.dates.at(-1).am=true,"ALREADY_PUBLISHED"],
  ["AM review ineligible","am",x=>x.lesson.review_vocab[0]="invalid","REVIEW_INELIGIBLE"],
  ["AM quiz no real review answer","am",x=>x.lesson.quiz[0].options=["new0","new1"],"AM_REVIEW_QUIZ_MISSING"],
  ["AM answer leak","am",x=>x.lesson.quiz[0].question="rev0 对吗","AM_QUIZ_ANSWER_LEAK"],
  ["AM reading short","am",x=>x.lesson.reading.text="short","READING_INVALID"],
  ["AM previous PM repetition","am",x=>x.previousPm.new_words=["new0"],"CROSS_DAY_NEW_REPEAT"],
  ["AM no output","am",x=>delete x.lesson.output,"AM_OUTPUT_INVALID"],
  ["PM no dialogue","pm",x=>delete x.lesson.dialogue,"PM_DIALOGUE_INVALID"],
  ["PM missing rewrite","pm",x=>delete x.lesson.rewrite,"PM_REWRITE_INVALID"],
  ["PM old rewrite_application","pm",x=>x.lesson.rewrite_application=x.lesson.rewrite,"PM_LEGACY_REWRITE"],
  ["PM bad answer index","pm",x=>x.lesson.daily_test.questions[0].answer_index=99,"QUESTION_INVALID"],
  ["PM answer mismatch","pm",x=>x.lesson.daily_test.questions[0].answer="wrong","ANSWER_MISMATCH"],
  ["PM items legacy","pm",x=>x.lesson.daily_test.items=x.lesson.daily_test.questions,"PM_TEST_SCHEMA"],
  ["PM new unknown","pm",x=>x.lesson.vocab[0].word="unknown","NEW_WORD_INELIGIBLE"],
  ["PM AM overlap","pm",x=>x.lesson.vocab[0].word="app0","SAME_DAY_NEW_REPEAT"],
  ["PM false application marker","pm",x=>x.lesson.vocab.at(-1).usage_note="none","AM_MARKER_MISSING"],
  ["PM group repeat","pm",x=>x.lesson.vocab.at(-1).word="review0","CORE_WORDS_INVALID"],
  ["PM no AM prerequisite","pm",x=>x.index.dates.at(-1).am=false,"AM_PREREQUISITE_MISSING"],
  ["PM no self check","pm",x=>x.lesson.daily_test.self_check=[],"PM_SELF_CHECK_INVALID"],
  ["PM malformed order answer","pm",x=>x.lesson.daily_test.questions[5].answer="I forgot.","PM_ORDER_ANSWER_MISMATCH"],
  ["PM bad status","pm",x=>x.lesson.write_status="draft","PM_STATUS_INVALID"]
 ];
 for(const [name,sess,mutate,code] of matrix){const x=sess==="am"?AM():PM();mutate(x);bad(name,x,code)}
 return {passed:count,failed:0};
};
console.log('Stage 1 pre-publication guard:',JSON.stringify(runTests(validate)));
