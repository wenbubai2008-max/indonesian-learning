// 2026-10-14: wrong answers in the 08:00 quiz and the 18:00 choice / fill questions used to be graded on the
// page and then forgotten. They now record a dated `lesson_wrong` error on the lesson's core word, so the next
// lesson's review ranking (fresh-error rules) and the vocabulary profile can see them.
// Only clearly identifiable core words are recorded; ambiguous questions and order questions record nothing.
(function(){
  if(window.__lessonAnswerSignalLoaded)return;
  window.__lessonAnswerSignalLoaded=true;
  const SUFFIX=['nya','lah','kah','pun','ku','mu'];
  // Displayed options may carry pronunciation accents (ngarét); compare without diacritics.
  function clean(s){return ' '+String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9À-ɏ'\-\s]/g,' ').replace(/\s+/g,' ').trim()+' ';}
  function currentLesson(){
    const btn=document.querySelector('#daily button[onclick*="completeSession"]');
    const m=btn&&String(btn.getAttribute('onclick')||'').match(/completeSession\(\s*['"](\d{4}-\d{2}-\d{2})['"]\s*,\s*['"](am|pm)['"]/);
    const cache=window.__dailyLessonCache;
    return m&&cache instanceof Map?cache.get(m[1]+'-'+m[2])||null:null;
  }
  function forms(v){return [v.word,v.display,v.audio_text].filter(Boolean).map(x=>clean(x).trim()).filter(Boolean);}
  function hit(text,form){
    if(form.includes(' '))return text.includes(' '+form+' ');
    return text.trim().split(' ').some(t=>t===form||(t.startsWith(form)&&SUFFIX.includes(t.slice(form.length))));
  }
  function matches(vocab,text){const t=clean(text);return vocab.filter(v=>forms(v).some(f=>hit(t,f)));}
  // Prefer the word that is in the correct answer but not in the question (the blank); else a single match.
  function target(lesson,answer,prompt){
    // AM core words = 10 vocab cards + review_vocab (plain strings); PM vocab already holds every group.
    const vocab=[].concat(lesson&&lesson.vocab||[],(lesson&&lesson.review_vocab||[]).map(w=>({word:w}))).filter(v=>v&&v.word);if(!vocab.length)return null;
    const inAnswer=matches(vocab,answer),inPrompt=matches(vocab,prompt);
    const blank=inAnswer.filter(v=>!inPrompt.includes(v));
    if(blank.length===1)return blank[0];
    if(inAnswer.length===1)return inAnswer[0];
    if(!inAnswer.length&&inPrompt.length===1)return inPrompt[0];
    return null;
  }
  function record(box,answer){
    if(!box||box.dataset.lessonSignal==='1')return;box.dataset.lessonSignal='1';
    try{
      const lesson=currentLesson(),wp=window.WeaknessPool;if(!lesson||!wp||typeof wp.recordLessonWrong!=='function')return;
      const prompt=(box.querySelector('b')||{}).textContent||'';
      const v=target(lesson,answer,prompt);if(!v)return;
      wp.recordLessonWrong(v.word,{word:v.word,cn:v.cn||'',root:v.root||'',root_cn:v.root_cn||'',source:'课程小测',source_date:lesson.date||'',session:lesson.time||''});
      window.dispatchEvent(new CustomEvent('weak-pool-changed',{detail:{word:v.word,reason:'lesson_wrong'}}));
    }catch(e){}
  }
  function optionText(btn){return btn?String(btn.textContent||'').replace(/^\s*[A-H]\.\s*/,''):'';}
  function wrap(name,after){
    const original=window[name];if(typeof original!=='function'||original.__lessonSignal)return;
    const wrapped=function(btn){
      const box=btn&&btn.closest&&btn.closest('.dailyFixItem');
      const before=box?(box.dataset.done||''):'';
      const out=original.apply(this,arguments);
      try{if(box&&!before)after(box,btn,arguments);}catch(e){}
      return out;
    };
    wrapped.__lessonSignal=true;window[name]=wrapped;
  }
  // 08:00 quiz (history-v2.js) and 18:00 choice (daily-light-test.js): the correct option is marked .correct.
  const choice=function(box,btn,args){if(args[1])return;record(box,optionText(box.querySelector('.dailyFixChoice.correct')));};
  wrap('dailyFixGrade',choice);
  wrap('dailyLightChoice',choice);
  // 18:00 fill: graded by the original; a wrong answer shows "参考答案".
  const fill=window.dailyLightFillCheck;
  if(typeof fill==='function'&&!fill.__lessonSignal){
    window.dailyLightFillCheck=function(btn,answer){
      const box=btn&&btn.closest&&btn.closest('.dailyFixItem');
      const out=fill.apply(this,arguments);
      try{const fb=box&&box.querySelector('.dailyFixFeedback');if(fb&&!/^答对了/.test(String(fb.textContent||'').trim()))record(box,answer);}catch(e){}
      return out;
    };
    window.dailyLightFillCheck.__lessonSignal=true;
  }
  // 18:00 order: a wrong order records the single core word in the answer sentence (none or several → nothing).
  const order=window.dailyLightOrderCheck;
  if(typeof order==='function'&&!order.__lessonSignal){
    window.dailyLightOrderCheck=function(btn,answer){
      const box=btn&&btn.closest&&(btn.closest('.dailyFixItem')||btn.closest('.dailyLightOrder'));
      const out=order.apply(this,arguments);
      try{const fb=box&&box.querySelector('.dailyFixFeedback');if(fb&&!/^顺序正确/.test(String(fb.textContent||'').trim()))record(box,answer);}catch(e){}
      return out;
    };
    window.dailyLightOrderCheck.__lessonSignal=true;
  }
  // 18:00 self-check: the learner marks a named core word as stuck.
  window.lessonSelfStuck=function(btn){
    if(!btn||btn.classList.contains('done'))return;
    const wp=window.WeaknessPool,word=btn.dataset.word;if(!word||!wp||typeof wp.recordLessonWrong!=='function')return;
    wp.recordLessonWrong(word,{word:word,cn:btn.dataset.cn||'',source:'课程自检',source_date:btn.dataset.date||''});
    btn.classList.add('done');btn.disabled=true;btn.textContent=word+' · 已记下';
    window.dispatchEvent(new CustomEvent('weak-pool-changed',{detail:{word:word,reason:'lesson_wrong'}}));
  };
  function mentioned(lesson,text){
    const vocab=[].concat(lesson&&lesson.vocab||[],(lesson&&lesson.review_vocab||[]).map(w=>({word:w}))).filter(v=>v&&v.word);
    const seen=new Set();return matches(vocab,text).filter(v=>{const k=v.word.toLowerCase();if(seen.has(k))return false;seen.add(k);return true});
  }
  window.LessonAnswerSignal={target:target,mentioned:mentioned};
})();
