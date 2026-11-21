'use strict';
// Theme new words (2026-11-21, user decision): each review-phase theme week brings a short, user-approved list of
// high-frequency words for that scene that the user has not learned yet (data/theme-words.json). They are a small,
// bounded supplement like the unfamiliar pool, not an expansion of the 977 primary library or the BIPA library.
//
// - A week's list becomes eligible only after the PM lesson of the day before its start_date is published
//   (lesson watermark >= "<start-1> 18:00"), so the Sunday PM is validated against the old runtime and the Monday AM
//   is the first lesson that can teach them.
// - Only the next `per_lesson` untaught words are released into runtime.new_pool at a time. The existing review-cycle
//   rules then teach exactly those words in the next AM (rest of the cards = review cycle) and the next PM
//   (new = min(available, pm_new max)), which keeps the daily card total unchanged.
// - Taught theme words with no weakness record are exposed for review (they cannot be in A ∩ D); the A ∩ D totals that
//   the vocab profile checks stay untouched. Mastered words never come back.
const key=s=>String(s||'').trim().toLowerCase();
const DAY=86400000;
function prevDay(d){return new Date(Date.parse(d+'T00:00:00Z')-DAY).toISOString().slice(0,10)}
function validWord(w){return w&&w.length<=60&&!/[<>\r\n\t]/.test(w)}

function readThemeWeeks(doc){
  const weeks=Array.isArray(doc&&doc.weeks)?doc.weeks:[];
  return weeks.filter(x=>x&&x.approved===true&&/^\d{4}-\d{2}-\d{2}$/.test(String(x.start_date||'')))
    .slice().sort((a,b)=>String(a.start_date).localeCompare(String(b.start_date)));
}

function collectThemeWords({doc,dailySet,weakMap,primarySet,secondarySet,lessonWatermark}){
  const perLesson=Math.max(0,Math.min(3,Number.isInteger(doc&&doc.per_lesson)?doc.per_lesson:2));
  const wm=String(lessonWatermark||'');
  const eligible=[],taught=[],seen=new Set();
  for(const week of readThemeWeeks(doc)){
    const open=wm>=prevDay(week.start_date)+' 18:00';
    for(const x of Array.isArray(week.words)?week.words:[]){
      const word=String(x&&x.word||'').trim(),k=key(word),cn=String(x&&x.cn||'').trim();
      if(!validWord(word)||!cn||seen.has(k))continue;
      seen.add(k);
      const weak=weakMap.get(k);
      if(weak&&weak.status==='mastered')continue;               // already known: never teach or review again
      if(primarySet.has(k)||secondarySet.has(k))continue;      // library words keep their own rules
      const meta={word,cn,formal:String(x.formal||'').trim(),note:String(x.note||'').trim(),theme_id:String(week.theme_id||'')};
      if(dailySet.has(k)){if(!weak)taught.push(meta);continue;}  // taught: review via weakness if it has a record
      if(open)eligible.push(meta);
    }
  }
  return {perLesson,eligible,release:eligible.slice(0,perLesson),taughtNoRecord:taught};
}
module.exports={collectThemeWords,readThemeWeeks};
