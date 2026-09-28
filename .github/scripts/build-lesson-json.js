#!/usr/bin/env node
'use strict';

// Experimental, PURE course-content assembler. It never writes GitHub, index, runtime or lessons.
// The existing validate-lesson-candidate.js remains the ONLY eligibility/contract authority.
const fs=require('fs');
const {validate}=require('./validate-lesson-candidate');
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x||{},k);
const rec=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function reject(code,detail){const e=new Error(detail);e.code=code;throw e}
function object(x,label){if(!rec(x))reject('ASSEMBLY_INPUT_INVALID',label+' must be an object');return x}
function arr(x,label){if(!Array.isArray(x))reject('ASSEMBLY_INPUT_INVALID',label+' must be an array');return x}
function text(x,label){if(typeof x!=='string'||!x.trim())reject('ASSEMBLY_CONTENT_MISSING',label+' needs authored content');return x}
function alias(x,target,source,label){
  object(x,label);
  if(own(x,target)&&own(x,source)&&x[target]!==x[source])
    reject('ASSEMBLY_AMBIGUOUS_ALIAS',label+': conflicting '+target+'/'+source);
  const result={...x};
  if(!own(result,target)&&own(result,source))result[target]=result[source];
  delete result[source];
  return result;
}
function response(q,label,field){
  const a=alias(q,field,field==='question'?'prompt':'question',label);
  const t=a.type;
  if(t!==undefined&&t!=='choice')reject('ASSEMBLY_QUESTION_TYPE',label+': expected choice; cannot infer options for '+String(t));
  if(!Array.isArray(a.options)||!Number.isInteger(a.answer_index)||a.answer_index<0||a.answer_index>=a.options.length)
    reject('ASSEMBLY_ANSWER_INVALID',label+': valid authored options and answer_index required');
  const correct=text(a.options[a.answer_index],label+'.correctOption');
  if(own(a,'answer')&&a.answer!==correct)reject('ASSEMBLY_ANSWER_MISMATCH',label+': answer differs from options[answer_index]');
  if(!own(a,'answer'))a.answer=correct; // Mechanical derivation, NEVER guesses the correct index.
  if(field==='question'&&own(a,'type'))delete a.type; // Canonical AM quiz is choices without PM test type.
  return a;
}
function line(v,target,label){
  let x=alias(object(v,label),target,target==='text'?'id':'text',label);
  x=alias(x,target,'indonesian',label);
  x=alias(x,'cn','chinese',label);
  text(x[target],label+'.'+target);text(x.cn,label+'.cn');
  return x;
}
function card(v,i){
  const x={...object(v,'vocab['+i+']')};
  text(x.word,'vocab['+i+'].word');
  for(const field of ['display','audio_text']){
    if(!own(x,field))x[field]=x.word; // Only genuinely mechanical fields.
    text(x[field],'vocab['+i+'].'+field);
  }
  // Do NOT infer translations, root, new/review/application grouping, or oral flags.
  return x;
}
function buildLesson(source,validationInputs){
  const original=object(source,'lesson content');
  const session=original.session;
  if(session!=='am'&&session!=='pm')reject('ASSEMBLY_SESSION_INVALID','session must be am or pm');
  const x=JSON.parse(JSON.stringify(original)); // Avoid mutating the saved authorial content.
  x.vocab=arr(x.vocab,'vocab').map(card);
  if(session==='am'){
    x.sentences=arr(x.sentences,'sentences').map((v,i)=>line(v,'text','sentences['+i+']'));
    x.quiz=arr(x.quiz,'quiz').map((q,i)=>response(q,'quiz['+i+']','question'));
    // AM review is an array; PM review is an object. Never convert between the two.
    arr(x.review,'AM review');
  }else{
    object(x.dialogue,'PM dialogue');
    x.dialogue.lines=arr(x.dialogue.lines,'PM dialogue.lines').map((v,i)=>line(v,'id','dialogue.lines['+i+']'));
    const test=object(x.daily_test,'PM daily_test');
    test.questions=arr(test.questions,'PM daily_test.questions').map((q,i)=>{
      const label='daily_test.questions['+i+']';
      return q?.type==='choice'?response(q,label,'prompt'):q; // Fill/order require authored prompt and answers.
    });
    object(x.review,'PM review');
  }
  if(validationInputs){
    const r=validate({...validationInputs,lesson:x});
    if(!r.ok){const e=new Error('Candidate contract failed: '+JSON.stringify(r.errors));e.code='ASSEMBLY_VALIDATION_FAILED';e.details=r.errors;throw e}
  }
  return x;
}
if(require.main===module){
  // Read-only prototype: stdout only, no file or branch writes; full runtime approval is still required.
  try{
    const args=process.argv.slice(2);
    if(args.length!==1||args[0].startsWith('-'))throw Error('Usage: node .github/scripts/build-lesson-json.js path/to/content.json');
    const input=JSON.parse(fs.readFileSync(args[0],'utf8'));
    process.stdout.write(JSON.stringify(buildLesson(input),null,2)+'\n');
  }catch(e){console.error(JSON.stringify({ok:false,code:e.code||'ASSEMBLY_FAILED',error:e.message}));process.exitCode=1}
}
module.exports={buildLesson};
