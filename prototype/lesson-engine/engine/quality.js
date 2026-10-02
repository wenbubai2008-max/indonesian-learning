'use strict';

/**
 * Strict supplemental content gate for deterministic V2 candidates.
 * The formal plan/validator remains the authoritative vocabulary/schema gate.
 * This gate catches semantic-instruction mismatches that JSON validation misses.
 * Do not apply retrospectively to already published lessons.
 */
const norm=x=>String(x??'').trim().toLowerCase();
const count=s=>String(s||'').trim().split(/\s+/).filter(Boolean).length;
function containsWord(text,word){
 const escaped=String(word||'').replace(/[\/\\^$*+?.()|[\]{}]/g,'\\$&').replace(/\s+/g,'\\s+');
 return Boolean(escaped)&&new RegExp('(^|[^\\p{L}])'+escaped+'(?=$|[^\\p{L}])','iu').test(String(text||''));
}
function auditLesson(lesson){
 const errors=[],reject=(code,detail)=>errors.push({code,detail});
 if(!lesson||!['am','pm'].includes(lesson.session)){
   reject('QUALITY_LESSON_INVALID','Missing lesson or session');
   return {ok:false,errors};
 }
 const reading=String(lesson.reading?.text||''),cn=String(lesson.reading?.cn||'');
 const news=lesson.session==='am'?(lesson.vocab||[]).map(x=>norm(x.word)):
   (lesson.vocab||[]).filter(x=>x.source_group==='new').map(x=>norm(x.word));
 const exact=news.filter(w=>containsWord(reading,w));
 const minimum=lesson.session==='am'?6:news.length;
 if(exact.length<minimum)reject('QUALITY_READING_COVERAGE',exact.length+'/'+minimum);
 if(count(reading)<80||count(reading)>120||cn.trim().length<30)
   reject('QUALITY_READING_BILINGUAL','Need an 80-120-word reading with meaningful Chinese');
 const mode=lesson._prototype?.reading_mode;
 if(!['single-scene','thematic-notes'].includes(mode))
   reject('QUALITY_READING_MODE','Every new V2 reading must declare its coherence mode');
 if(mode==='thematic-notes'&&!/Beberapa catatan sehari-hari/.test(String(lesson.title||'')))
   reject('QUALITY_MISLEADING_SCENE_TITLE','Mixed-topic reading cannot carry a narrow unrelated scene title');
 if(/Hari ini saya mencatat beberapa kejadian berbeda dari orang-orang/.test(reading))
   reject('QUALITY_LEGACY_READING_GLUE','Reject the former unrelated-example introduction');
 if(lesson.session==='am'){
   const output=lesson.output||{},answer=String(output.reference_answer||''),task=String(output.task||'');
   const used=news.filter(w=>containsWord(answer,w)&&containsWord(task,w));
   if(used.length<2)
     reject('QUALITY_OUTPUT_TARGET_MISMATCH','Reference answer must really use at least two distinct new words named in its task');
   if(!answer.trim()||!String(output.reference_cn||'').trim())
     reject('QUALITY_OUTPUT_INCOMPLETE','The model output must have both languages');
 }else{
   const lines=lesson.dialogue?.lines||[],joined=lines.map(x=>x.id||'').join(' ');
   if(news.filter(w=>containsWord(joined,w)).length<Math.min(2,news.length))
     reject('QUALITY_DIALOGUE_COVERAGE','Conversation must naturally cover two PM new words');
   const questions=lines.filter(x=>x.speaker==='A').map(x=>norm(x.id));
   if(questions.length!==new Set(questions).size)
     reject('QUALITY_DIALOGUE_REPETITION','Same question repeated in a short dialogue');
   if((joined.match(/ngomong-ngomong/gi)||[]).length>1)
     reject('QUALITY_DIALOGUE_TOPIC_JUMP','Too many abrupt topic changes');
   if(lines.some((x,i)=>x.speaker!==(i%2?'B':'A')))
     reject('QUALITY_DIALOGUE_TURN','Dialogue must alternate A/B');
 }
 return {ok:errors.length===0,errors,metrics:{
   exact_new_reading:exact.length,required_new_reading:minimum,
   reading_words:count(reading),reading_mode:mode,
   output_target_count:lesson.session==='am'?news.filter(w=>containsWord(lesson.output?.task,w)&&containsWord(lesson.output?.reference_answer,w)).length:null,
   dialogue_new_count:lesson.session==='pm'?news.filter(w=>containsWord((lesson.dialogue?.lines||[]).map(x=>x.id).join(' '),w)).length:null
 }};
}
module.exports={auditLesson,containsWord};
