#!/usr/bin/env node
'use strict';
const assert=require('assert');
const {checkFocus,lessonTime}=require('./lesson-focus-rotation');
const config={enabled:true,effective_date:'2026-11-04',cooldown_hours:72,window_days:7,max_prior_focus:2,am_new_first_from:'2026-11-05'};
function history(date,session,focus=[],active=[]){
 return {date,session,lesson_focus:{words:focus},review_vocab:session==='am'?active:[],
  vocab:session==='pm'?active.map(word=>({word,source_group:'review'})):[]};
}
function candidate(date='2026-11-04',session='am',focus=['a','b','c'],vocab=['a','b','c','d']){
 return {date,session,lesson_focus:{words:focus},vocab:vocab.map(word=>({word})),review_vocab:[]};
}
const runtime=(wrong='')=>({generated_at:'2026-11-04T00:30:00.000Z',
 review_pool:wrong?[['a',1,1,wrong]]:[]});
const errors=(lesson,reviewHistory,run=runtime())=>checkFocus({lesson,reviewHistory,runtime:run,config});
function run(){
 assert.strictEqual(lessonTime('2026-11-04','am')-lessonTime('2026-11-03','pm'),14*3600000);
 // The 10/30, 11/01, 11/03 pattern would not pass for an unchanged 11/04 focus.
 assert.strictEqual(errors(candidate(),[
  history('2026-10-30','pm',['a']),
  history('2026-11-01','am',['a']),
  history('2026-11-03','pm',['a'])
 ]).some(e=>e.code==='LESSON_FOCUS_COOLDOWN'),true);
 // A single recent focus is still cooled down when another lesson word is available.
 assert.strictEqual(errors(candidate(),[history('2026-11-03','pm',['a'])]).length,1);
 // At 72h exactly, cooldown ends, but two appearances in seven days still block it.
 assert.strictEqual(errors(candidate(),[history('2026-10-30','pm',['a']),history('2026-11-01','am',['a'])]).length,1);
 assert.strictEqual(errors(candidate(),[history('2026-10-24','pm',['a'])]).length,0);
 // Fresh real mistake after the newest focus and active exposure overrides cooling.
 assert.strictEqual(errors(candidate(),[history('2026-11-03','pm',['a'],['a'])],
  runtime('2026-11-03T16:00:00.000Z')).length,0);
 assert.strictEqual(errors(candidate(),[history('2026-11-03','pm',['a'])],
  runtime('2026-11-03T08:00:00.000Z')).length,1);
 // A mistaken answer after a focus but before a later active review is not new enough.
 assert.strictEqual(errors(candidate(),[history('2026-11-03','am',['a']),history('2026-11-03','pm',[],['a'])],
  runtime('2026-11-03T04:00:00.000Z')).length,1);
 // No other legal words in the actual lesson: allow necessary repeats rather than block release.
 assert.strictEqual(errors(candidate('2026-11-04','am',['a','b','c'],['a','b','c']),[history('2026-11-03','pm',['a'])]).length,0);
 // Do not retroactively invalidate published lessons.
 assert.strictEqual(errors(candidate('2026-11-03'),[history('2026-11-02','pm',['a'])]).length,0);
 // The same-day AM focus counts against PM 14/10 hours later.
 assert.strictEqual(errors(candidate('2026-11-04','pm'),[history('2026-11-04','am',['a'])]).length,1);
 // Passive reading mention alone does not consume any focus cooldown.
 const passive=history('2026-11-03','pm',[]);passive.reading={text:'The word a appears here'};
 assert.strictEqual(errors(candidate(),[passive]).length,0);
 // Avoiding two cooled choices needs two distinct available alternatives.
 assert.strictEqual(errors(candidate('2026-11-04','am',['a','b','c'],['a','b','c','d']),[history('2026-11-03','pm',['a','b'])]).length,1);
 // Nov 4 is already published: the new source restriction must not rewrite the old lesson.
 const previous=candidate('2026-11-04','am',['old','a','b'],['a','b','c','d']);
 previous.review_vocab=['old'];
 assert.strictEqual(errors(previous,[]).some(e=>e.code==='AM_FOCUS_NEW_REQUIRED'),false);
 // The original Nov 4 problem (two review highlights, one new) fails on the next AM.
 const repeats=candidate('2026-11-05','am',['kasur','selera','berbelanja'],
   ['pers','berasal dari','berbelanja','suka menolong','menyapu','sapu','ember','saking','menyebalkan','kemeja']);
 repeats.review_vocab=['kasur','selera'];
 assert.strictEqual(errors(repeats,[]).some(e=>e.code==='AM_FOCUS_NEW_REQUIRED'),true);
 // Three genuinely new words always pass, even if old review words have fresh errors.
 const freshOk=candidate('2026-11-05','am',['a','b','c'],['a','b','c','d']);freshOk.review_vocab=['old'];
 assert.strictEqual(errors(freshOk,[],runtime('2026-11-04T00:25:00.000Z')).some(e=>e.code==='AM_FOCUS_NEW_REQUIRED'),false);
 // When only two new words remain, include both plus a cycle word.
 const two=candidate('2026-11-05','am',['a','b','c'],['a','b','c','d']);
 two.cycle_vocab=['c','d'];two.review_vocab=['old'];
 assert.strictEqual(errors(two,[]).filter(e=>e.code.startsWith('AM_FOCUS_')).length,0);
 const insufficient={...two,lesson_focus:{words:['a','old','c']}};
 assert.strictEqual(errors(insufficient,[]).some(e=>e.code==='AM_FOCUS_NEW_REQUIRED'),true);
 const wrongFallback={...two,lesson_focus:{words:['a','b','old']}};
 assert.strictEqual(errors(wrongFallback,[]).some(e=>e.code==='AM_FOCUS_CYCLE_REQUIRED'),true);
 // Zero new words: the focus becomes three cycle words, never review_vocab first.
 const none=candidate('2026-11-05','am',['a','b','c'],['a','b','c','d']);
 none.cycle_vocab=['a','b','c','d'];none.review_vocab=['old'];
 assert.strictEqual(errors(none,[]).filter(e=>e.code.startsWith('AM_FOCUS_')).length,0);
 const noneBad={...none,lesson_focus:{words:['a','b','old']}};
 assert.strictEqual(errors(noneBad,[]).some(e=>e.code==='AM_FOCUS_CYCLE_REQUIRED'),true);
 // PM retains mixed new/review/application highlights.
 assert.strictEqual(errors(candidate('2026-11-05','pm',['old','a','b'],['old','a','b']),[]).some(e=>e.code.startsWith('AM_FOCUS_')),false);
 return true;
}
if(require.main===module){run();console.log('lesson-focus-rotation: 22 checks passed')}
module.exports={run};
