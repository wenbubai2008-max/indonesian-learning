const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../..');
// Review phase (2026-10-25, dormant): while data/review-phase.json is off, PC(d) returns the old fixed counts.
// The release check also runs this guard inside an older main tree that may not have review-phase.js yet: then the
// phase is simply off.
let RPH = null; try { RPH = require('./review-phase'); } catch (e) { RPH = null; }
const PHASE = RPH ? RPH.load(ROOT) : { active: false };
const OLD_COUNTS = { am_cards:[10,10], am_reading:[80,120], pm_core:[10,12], pm_new:[3,4], pm_review:[4,6], pm_review_cycle:[4,9], pm_application:[2,3], pm_dialogue:[4,1e9] };
const PC = d => RPH ? RPH.counts(PHASE, d) : JSON.parse(JSON.stringify(OLD_COUNTS)), PON = d => !!RPH && RPH.on(PHASE, d);
const failures = [];
const warnings = [];
const passes = [];

function rel(p){ return path.join(ROOT, p); }
function read(p){ return fs.readFileSync(rel(p), 'utf8'); }
function readJSON(p){ return JSON.parse(read(p)); }
function ok(cond, msg){
  if(cond) passes.push(msg);
  else failures.push(msg);
}
function warn(cond, msg){ if(cond) warnings.push(msg); }
function norm(s){ return String(s == null ? '' : s).trim().toLowerCase().replace(/[.,!?;:，。！？；：]/g,'').replace(/\s+/g,' '); }
function wordCount(s){ return String(s || '').trim().split(/\s+/).filter(Boolean).length; }
function inRange(n,a,b){ return Number.isInteger(n) && n >= a && n <= b; }
function unique(arr){ return new Set(arr).size === arr.length; }
function fileHash12(p){ return crypto.createHash('sha256').update(read(p)).digest('hex').slice(0,12); }
function completedStamp(row,session){
  const d=String(row&&row.date||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return '';
  if(session==='am'&&row.am===true)return d+' 08:00';
  if(session==='pm'&&row.pm===true)return d+' '+(d>='2026-09-16'?'18:00':'19:00');
  return '';
}
function latestCompletedStamp(index){
  const stamps=[];
  for(const row of (Array.isArray(index&&index.dates)?index.dates:[])){
    const a=completedStamp(row,'am'),p=completedStamp(row,'pm');
    if(a)stamps.push(a);if(p)stamps.push(p);
  }
  return stamps.sort().pop()||'';
}
function validateRecentDailyWindow(){
  const index=readJSON('data/daily/index.json');
  const rows=Array.isArray(index.dates)?index.dates:[];
  const counts=new Map();
  for(const row of rows){const d=String(row&&row.date||'');counts.set(d,(counts.get(d)||0)+1)}
  const dups=[...counts.entries()].filter(([d,n])=>d&&n>1).map(([d])=>d);
  ok(dups.length===0,'daily index has no duplicate dates'+(dups.length?': '+dups.join(', '):''));
  const dated=rows.filter(r=>r&&/^\d{4}-\d{2}-\d{2}$/.test(String(r.date||''))).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const recent=dated.slice(-7);

  // Full modern-history identity/contract check. The recent-seven-day window
  // remains the deeper check, but older modern lessons must not disappear from it.
  for(const row of dated.filter(x=>String(x.date)>='2026-09-16')){
    for(const session of ['am','pm']){
      if(row[session]!==true)continue;
      const p='data/daily/'+row.date+'-'+session+'.json';
      ok(fs.existsSync(rel(p)),`canonical history ${row.date} ${session}: file exists`);
      if(!fs.existsSync(rel(p)))continue;
      const x=readJSON(p);
      ok(x.date===row.date&&x.session===session&&x.time===(session==='am'?'08:00':'18:00'),`canonical history ${row.date} ${session}: date/session/time`);
      ok(Boolean(String(x.title||'').trim())&&String(x.title).startsWith(session==='am'?'08:00':'18:00'),`canonical history ${row.date} ${session}: title`);
      if(session==='pm'){
        const t=x.daily_test||{};
        const questions=Array.isArray(t.questions)?t.questions:[];
        ok(x.write_status==='lesson_complete',`canonical history ${row.date} pm: lesson_complete`);
        ok(!Object.prototype.hasOwnProperty.call(t,'items')&&questions.length===6&&questions.filter(q=>q&&q.type==='choice').length===3&&questions.filter(q=>q&&q.type==='fill').length===2&&questions.filter(q=>q&&q.type==='order').length===1,`canonical history ${row.date} pm: only standard 3+2+1 questions container`);
      }
    }
  }
  const latestDate=dated.length?String(dated[dated.length-1].date):'';
  ok(!latestDate||String(index.updated||'')===latestDate,'daily index.updated matches latest date');
  for(const row of recent){
    const d=String(row.date);
    if(row.am===true){
      const p='data/daily/'+d+'-am.json';
      ok(fs.existsSync(rel(p)),`recent AM ${d}: file exists`);
      if(fs.existsSync(rel(p))){
        const x=readJSON(p),v=Array.isArray(x.vocab)?x.vocab:[],rv=Array.isArray(x.review_vocab)?x.review_vocab:[];
        ok(x.session==='am'&&x.time==='08:00',`recent AM ${d}: session/time canonical`);
        ok(/^08:00/.test(String(x.title||'')),`recent AM ${d}: title canonical`);
        const recentAmWords=v.map(y=>norm(y&&y.word)).filter(Boolean);
        ok(inRange(recentAmWords.length,PC(d).am_cards[0],PC(d).am_cards[1])&&recentAmWords.length===v.length&&unique(recentAmWords),`recent AM ${d}: ${PON(d)?PC(d).am_cards.join('-'):10} unique vocab`);
        ok(inRange(rv.length,4,6)&&rv.every(y=>typeof y==='string'&&y.trim()),`recent AM ${d}: review_vocab canonical`);
        ok(Array.isArray(x.sentences)&&x.sentences.length===5,`recent AM ${d}: 5 sentences`);
        ok(Array.isArray(x.quiz)&&x.quiz.length===3,`recent AM ${d}: 3 quiz questions`);
        if(Array.isArray(x.quiz)&&x.quiz.length===3){
          const recentReviewSet=new Set(rv.map(norm));
          const realReviewQuiz=x.quiz.some(q=>{
            const opts=Array.isArray(q&&q.options)?q.options:[];
            const ai=q&&q.answer_index;
            return Number.isInteger(ai)&&ai>=0&&ai<opts.length&&recentReviewSet.has(norm(opts[ai]));
          });
          ok(realReviewQuiz,`recent AM ${d}: at least one quiz answer is truly in review_vocab`);
        }
        ok(Array.isArray(x.review)&&x.review.length===3,`recent AM ${d}: final review canonical`);
        ok(Boolean(x.output&&x.output.task&&x.output.reference_answer&&x.output.reference_cn),`recent AM ${d}: output canonical`);
        if(d>='2026-09-26'){
          const prev=new Date(d+'T00:00:00Z');prev.setUTCDate(prev.getUTCDate()-1);const pd=prev.toISOString().slice(0,10);
          const pp='data/daily/'+pd+'-pm.json';
          if(fs.existsSync(rel(pp))){
            const pm=readJSON(pp);
            if(pm.write_status==='lesson_complete'){
              const prevNew=new Set((Array.isArray(pm.new_words)?pm.new_words:[]).map(norm));
              const repeated=v.map(y=>norm(y&&y.word)).filter(w=>prevNew.has(w));
              ok(repeated.length===0,`recent AM ${d}: no previous-PM new-word repeat${repeated.length?': '+repeated.join(', '):''}`);
            }
          }
        }
      }
    }
    if(row.pm===true){
      const p='data/daily/'+d+'-pm.json';
      ok(fs.existsSync(rel(p)),`recent PM ${d}: file exists`);
      if(fs.existsSync(rel(p))){
        const x=readJSON(p),v=Array.isArray(x.vocab)?x.vocab:[],test=x.daily_test||{};
        ok(x.session==='pm'&&x.time===(d>='2026-09-16'?'18:00':'19:00'),`recent PM ${d}: session/time canonical`);
        ok(x.write_status==='lesson_complete',`recent PM ${d}: lesson_complete`);
        const recentPmWords=v.map(y=>norm(y&&y.word)).filter(Boolean);
        ok(inRange(v.length,PC(d).pm_core[0],PC(d).pm_core[1])&&recentPmWords.length===v.length&&unique(recentPmWords),`recent PM ${d}: ${PC(d).pm_core.join('-')} unique vocab`);
        ok(x.dialogue&&Array.isArray(x.dialogue.lines)&&x.dialogue.lines.length>=PC(d).pm_dialogue[0]&&x.dialogue.lines.length<=PC(d).pm_dialogue[1],`recent PM ${d}: dialogue canonical`);
        ok(Array.isArray(x.rewrite)&&inRange(x.rewrite.length,3,4),`recent PM ${d}: rewrite canonical`);
        const recentQuestions=Array.isArray(test.questions)?test.questions:[];
        const recentChoice=recentQuestions.filter(q=>q&&q.type==='choice').length;
        const recentFill=recentQuestions.filter(q=>q&&q.type==='fill').length;
        const recentOrder=recentQuestions.filter(q=>q&&q.type==='order').length;
        ok(recentQuestions.length===6&&recentChoice===3&&recentFill===2&&recentOrder===1,`recent PM ${d}: daily_test is 3 choice + 2 fill + 1 order`);
        ok(x.review&&!Array.isArray(x.review)&&Array.isArray(x.review.steps)&&x.review.steps.length>0,`recent PM ${d}: final review canonical`);
        if(d>='2026-09-26'){
          const ap='data/daily/'+d+'-am.json';
          if(fs.existsSync(rel(ap))){
            const am=readJSON(ap),amNew=new Set((Array.isArray(am.vocab)?am.vocab:[]).map(y=>norm(y&&y.word)));
            const pmNew=(Array.isArray(x.new_words)?x.new_words:[]).map(norm).filter(w=>amNew.has(w));
            ok(pmNew.length===0,`recent PM ${d}: no same-day AM new-word repeat${pmNew.length?': '+pmNew.join(', '):''}`);
          }
        }
      }
    }
  }
}

function validateLatestAm(){
  const index = readJSON('data/daily/index.json');
  const rows = (Array.isArray(index.dates) ? index.dates : [])
    .filter(x => x && /^\d{4}-\d{2}-\d{2}$/.test(String(x.date || '')) && x.am === true)
    .sort((a,b) => String(a.date).localeCompare(String(b.date)));
  if(!rows.length){ warnings.push('No completed AM lesson entries found in index'); return; }
  const date = String(rows[rows.length - 1].date);
  const amPath = `data/daily/${date}-am.json`;
  if(!fs.existsSync(rel(amPath))){ failures.push(`latest completed AM ${date}: file missing`); return; }
  const am = readJSON(amPath);

  ok((index.dates || []).filter(x => x && x.date === date).length === 1, `latest AM ${date}: index date is unique`);
  ok(am.session === 'am', `latest AM ${date}: session=am`);
  ok(am.time === '08:00', `latest AM ${date}: time=08:00`);
  ok(/^08:00/.test(String(am.title || '')), `latest AM ${date}: title starts with 08:00`);

  const vocab = Array.isArray(am.vocab) ? am.vocab : [];
  const amC = PC(date);
  ok(inRange(vocab.length, amC.am_cards[0], amC.am_cards[1]), PON(date) ? `latest AM ${date}: ${amC.am_cards.join('-')} vocab words (review phase)` : `latest AM ${date}: exactly 10 vocab words`);
  const vocabWords = vocab.map(v => norm(v && v.word)).filter(Boolean);
  ok(vocabWords.length === vocab.length && vocab.length > 0 && unique(vocabWords), `latest AM ${date}: vocab words are non-empty and unique`);

  const requiredFields = ['word','display','audio_text','cn','en','root','root_cn','formation','example','example_cn','synonym_note','is_oral_new'];
  vocab.forEach((v,i) => {
    const label = v && v.word ? v.word : `#${i+1}`;
    for(const f of requiredFields) ok(Object.prototype.hasOwnProperty.call(v || {}, f), `latest AM ${date}: ${label} has ${f}`);
    ok(Boolean(String(v && v.formation || '').trim()), `latest AM ${date}: ${label} formation non-empty`);
    ok(Boolean(String(v && v.synonym_note || '').trim()), `latest AM ${date}: ${label} synonym_note non-empty`);
    if(String(v && v.root || '').trim()) ok(Boolean(String(v && v.root_cn || '').trim()), `latest AM ${date}: ${label} root_cn present`);
  });

  const reviewVocab = Array.isArray(am.review_vocab) ? am.review_vocab : [];
  ok(inRange(reviewVocab.length,4,6), `latest AM ${date}: review_vocab has about 5 words`);
  ok(reviewVocab.every(x => typeof x === 'string' && x.trim()), `latest AM ${date}: review_vocab is a string array`);
  const reviewWords = reviewVocab.map(norm).filter(Boolean);
  ok(unique(reviewWords), `latest AM ${date}: review_vocab is unique`);
  const vocabSet = new Set(vocabWords);
  ok(reviewWords.every(w => !vocabSet.has(w)), `latest AM ${date}: new vocab and review_vocab are disjoint`);

  const sentences = Array.isArray(am.sentences) ? am.sentences : [];
  ok(sentences.length === 5, `latest AM ${date}: exactly 5 sentences`);
  ok(sentences.every(x => String(x && x.text || '').trim() && String(x && x.cn || '').trim()), `latest AM ${date}: sentences have Indonesian and Chinese`);

  const reading = am.reading || {};
  const wc = wordCount(reading.text);
  ok(inRange(wc,amC.am_reading[0],amC.am_reading[1]), `latest AM ${date}: reading is ${amC.am_reading.join('-')} words (${wc})`);
  ok(Boolean(String(reading.cn || '').trim()), `latest AM ${date}: reading Chinese translation exists`);

  const quiz = Array.isArray(am.quiz) ? am.quiz : [];
  ok(quiz.length === 3, `latest AM ${date}: exactly 3 quiz questions`);
  const reviewSet = new Set(reviewWords);
  let reviewQuizCount = 0;
  quiz.forEach((q,i) => {
    const options = Array.isArray(q && q.options) ? q.options : [];
    const ai = q && q.answer_index;
    const question = String(q && q.question || '').trim();
    const explain = String(q && q.explain || '').trim();
    const valid = Boolean(question && options.length >= 2 && Number.isInteger(ai) && ai >= 0 && ai < options.length && explain);
    ok(valid, `latest AM ${date}: quiz ${i+1} canonical schema valid`);
    if(valid){
      const answer = String(options[ai] || '').trim();
      if(reviewSet.has(norm(answer))) reviewQuizCount++;
      const recognition = /词义|意思|含义|形式|哪一个词|哪个词|哪种形式|正确形式|识别/.test(question);
      const leaked = Boolean(answer && question.toLowerCase().includes(answer.toLowerCase()));
      ok(!leaked || recognition, `latest AM ${date}: quiz ${i+1} does not leak the answer`);
    }
  });
  ok(reviewQuizCount >= 1, `latest AM ${date}: quiz includes at least one review item`);

  const output = am.output || {};
  ok(Boolean(String(output.task || '').trim() && String(output.reference_answer || '').trim() && String(output.reference_cn || '').trim()), `latest AM ${date}: active output has task + answer + Chinese`);

  // Hard freshness/de-dup gates: yesterday's PM new words must never return as today's AM new words.
  const prevDateObj = new Date(date + 'T00:00:00Z');
  prevDateObj.setUTCDate(prevDateObj.getUTCDate() - 1);
  const prevDate = prevDateObj.toISOString().slice(0,10);
  const prevPmPath = `data/daily/${prevDate}-pm.json`;
  if(fs.existsSync(rel(prevPmPath))){
    const prevPm = readJSON(prevPmPath);
    if(prevPm && prevPm.write_status === 'lesson_complete'){
      const prevNew = new Set((Array.isArray(prevPm.new_words)?prevPm.new_words:[]).map(norm).filter(Boolean));
      const repeated = vocabWords.filter(w => prevNew.has(w));
      ok(repeated.length === 0, `latest AM ${date}: no new word repeats previous PM${repeated.length?': '+repeated.join(', '):''}`);
    }
  }
  const runtimeNow = readJSON('data/learning-runtime.json');
  const runtimeNew = new Set((runtimeNow.new_pool || []).map(x => norm(Array.isArray(x)?x[0]:x && x.word || x)).filter(Boolean));
  const stillNew = vocabWords.filter(w => runtimeNew.has(w));
  ok(stillNew.length === 0, `latest AM ${date}: taught AM words exited runtime.new_pool${stillNew.length?': '+stillNew.join(', '):''}`);

  const review = Array.isArray(am.review) ? am.review : [];
  ok(review.length === 3 && review.every(x => typeof x === 'string' && x.trim()), `latest AM ${date}: final review is exactly 3 strings`);
}

function validateLatestPm(){
  const index = readJSON('data/daily/index.json');
  const rows = (Array.isArray(index.dates) ? index.dates : [])
    .filter(x => x && /^\d{4}-\d{2}-\d{2}$/.test(String(x.date || '')) && x.pm === true)
    .sort((a,b) => String(a.date).localeCompare(String(b.date)));
  if(!rows.length){ warnings.push('No completed PM lesson entries found in index'); return; }
  const date = String(rows[rows.length - 1].date);
  const pmPath = `data/daily/${date}-pm.json`;
  if(!fs.existsSync(rel(pmPath))){ failures.push(`latest completed PM ${date}: file missing`); return; }
  const pm = readJSON(pmPath);
  if(date < '2026-09-16') return;
  ok((index.dates || []).filter(x => x && x.date === date).length === 1, `latest PM ${date}: index date is unique`);

  ok(pm.session === 'pm', `latest PM ${date}: session=pm`);
  ok(pm.time === '18:00', `latest PM ${date}: time=18:00`);
  ok(pm.write_status === 'lesson_complete', `latest PM ${date}: write_status=lesson_complete`);
  ok(/^18:00/.test(String(pm.title || '')), `latest PM ${date}: title starts with 18:00`);

  const vocab = Array.isArray(pm.vocab) ? pm.vocab : [];
  const groups = {
    new: vocab.filter(v => v && v.source_group === 'new'),
    review: vocab.filter(v => v && v.source_group === 'review'),
    application: vocab.filter(v => v && v.source_group === 'application')
  };
  const pmC = PC(date);
  ok(inRange(vocab.length,pmC.pm_core[0],pmC.pm_core[1]), `latest PM ${date}: ${pmC.pm_core.join('-')} core vocab`);
  if(PON(date)){
    ok(inRange(groups.new.length,pmC.pm_new[0],pmC.pm_new[1]), `latest PM ${date}: ${pmC.pm_new.join('-')} new words (review phase)`);
    ok(inRange(groups.review.length,pmC.pm_review[0],pmC.pm_review[1]), `latest PM ${date}: ${pmC.pm_review.join('-')} review words (review phase)`);
    ok(inRange(groups.application.length,pmC.pm_application[0],pmC.pm_application[1]), `latest PM ${date}: ${pmC.pm_application.join('-')} application words (review phase)`);
  }else{
    // Review cycle (2026-10-14): with fewer than 3 new words left the PM teaches all of them (0-2) and reviews 4-9.
    // The validator enforces the exact rule at publication; this check accepts both shapes (2026-10-25 fix).
    const cyclePm = inRange(groups.new.length,0,2);
    ok(inRange(groups.new.length,cyclePm?0:3,cyclePm?2:4), `latest PM ${date}: 3-4 new words (0-2 in the review cycle)`);
    ok(inRange(groups.review.length,4,cyclePm?9:6), `latest PM ${date}: 4-6 review words (4-9 in the review cycle)`);
    ok(inRange(groups.application.length,2,3), `latest PM ${date}: 2-3 application words`);
  }

  const words = vocab.map(v => norm(v && v.word)).filter(Boolean);
  ok(unique(words), `latest PM ${date}: core vocab has no duplicates`);
  const newSet = new Set(groups.new.map(v => norm(v.word)));
  const reviewSet = new Set(groups.review.map(v => norm(v.word)));
  const appSet = new Set(groups.application.map(v => norm(v.word)));
  const overlap = [...newSet].filter(w => reviewSet.has(w) || appSet.has(w)).concat([...reviewSet].filter(w => appSet.has(w)));
  ok(overlap.length === 0, `latest PM ${date}: new/review/application groups are disjoint`);

  const declaredNew = Array.isArray(pm.new_words) ? pm.new_words.map(norm).filter(Boolean).sort() : [];
  const actualNew = [...newSet].sort();
  ok(JSON.stringify(declaredNew) === JSON.stringify(actualNew), `latest PM ${date}: new_words matches source_group=new`);

  const runtimeNow = readJSON('data/learning-runtime.json');
  const runtimeNew = new Set((runtimeNow.new_pool || []).map(x => norm(Array.isArray(x)?x[0]:x && x.word || x)).filter(Boolean));
  const stillNew = actualNew.filter(w => runtimeNew.has(w));
  ok(stillNew.length === 0, `latest PM ${date}: taught PM new words exited runtime.new_pool${stillNew.length?': '+stillNew.join(', '):''}`);

  const sameDayAmPath = `data/daily/${date}-am.json`;
  if(fs.existsSync(rel(sameDayAmPath))){
    const sameDayAm = readJSON(sameDayAmPath);
    const amNew = new Set((Array.isArray(sameDayAm.vocab)?sameDayAm.vocab:[]).map(v => norm(v && v.word)).filter(Boolean));
    const repeated = actualNew.filter(w => amNew.has(w));
    ok(repeated.length === 0, `latest PM ${date}: PM new words do not repeat same-day AM${repeated.length?': '+repeated.join(', '):''}`);
  }

  const requiredFields = ['word','display','audio_text','cn','en','root','root_cn','formation','example','example_cn','synonym_note','usage_note','source_group','is_new','is_oral_new'];
  vocab.forEach((v,i) => {
    const label = v && v.word ? v.word : `#${i+1}`;
    for(const f of requiredFields){
      ok(Object.prototype.hasOwnProperty.call(v || {}, f), `latest PM ${date}: ${label} has ${f}`);
    }
    ok(Boolean(String(v && v.formation || '').trim()), `latest PM ${date}: ${label} formation non-empty`);
    ok(Boolean(String(v && v.synonym_note || '').trim()), `latest PM ${date}: ${label} synonym_note non-empty`);
    if(String(v && v.root || '').trim()) ok(Boolean(String(v && v.root_cn || '').trim()), `latest PM ${date}: ${label} root_cn present`);
  });

  const reading = pm.reading || {};
  const wc = wordCount(reading.text);
  ok(inRange(wc,80,120), `latest PM ${date}: reading is 80-120 words (${wc})`);
  ok(Boolean(String(reading.cn || '').trim()), `latest PM ${date}: reading Chinese translation exists`);

  const lines = pm.dialogue && Array.isArray(pm.dialogue.lines) ? pm.dialogue.lines : [];
  ok(lines.length >= pmC.pm_dialogue[0] && lines.length <= pmC.pm_dialogue[1], `latest PM ${date}: dialogue exists`);
  ok(lines.length > 0 && lines.every(x => String(x && x.id || '').trim() && String(x && x.cn || '').trim()), `latest PM ${date}: dialogue lines have Indonesian and Chinese`);

  const rewrite = Array.isArray(pm.rewrite) ? pm.rewrite : [];
  ok(inRange(rewrite.length,3,4), `latest PM ${date}: rewrite/application has 3-4 tasks`);
  ok(rewrite.length > 0 && rewrite.every(x => String(x && x.task || '').trim() && String(x && x.reference_answer || '').trim() && String(x && x.reference_cn || '').trim()), `latest PM ${date}: rewrite tasks have answer + Chinese`);

  const test = pm.daily_test || {};
  const items = Array.isArray(test.questions) ? test.questions : [];
  const choices = items.filter(x => x && x.type === 'choice');
  const fills = items.filter(x => x && x.type === 'fill');
  const orders = items.filter(x => x && x.type === 'order');
  ok(items.length === 6 && choices.length === 3 && fills.length === 2 && orders.length === 1, `latest PM ${date}: daily_test is 3 choice + 2 fill + 1 order`);

  choices.forEach((x,i) => {
    const opts = Array.isArray(x.options) ? x.options : [];
    const ai = x.answer_index;
    ok(String(x.prompt || '').trim().length > 0 && opts.length >= 2 && Number.isInteger(ai) && ai >= 0 && ai < opts.length && String(x.explain || '').trim().length > 0, `latest PM ${date}: choice ${i+1} canonical schema valid`);
    if(x.answer != null && Number.isInteger(ai) && ai >= 0 && ai < opts.length){
      ok(norm(opts[ai]) === norm(x.answer), `latest PM ${date}: choice ${i+1} answer_index matches answer`);
    }
  });

  fills.forEach((x,i) => {
    const prompt = String(x.prompt || '');
    ok(/^填空\s*[：:]/.test(prompt) && /[（(][^（）()]+[）)]/.test(prompt) && String(x.answer || '').trim() && String(x.explain || '').trim(), `latest PM ${date}: fill ${i+1} has inline Chinese hint + answer`);
  });

  if(orders.length){
    const x = orders[0];
    const tokens = Array.isArray(x.tokens) ? x.tokens : [];
    ok(/按照中文|根据中文/.test(String(x.prompt || '')) && inRange(tokens.length,5,8) && String(x.answer || '').trim() && String(x.answer_cn || '').trim() && String(x.explain || '').trim(), `latest PM ${date}: order has Chinese prompt + 5-8 tokens + answers`);
  }

  const selfCheck = Array.isArray(test.self_check) ? test.self_check : [];
  ok(selfCheck.length > 0 && selfCheck.every(x => typeof x === 'string' && x.trim()), `latest PM ${date}: self_check is non-empty string array`);
  const review = pm.review;
  ok(review && !Array.isArray(review) && String(review.title || '').trim() && Array.isArray(review.steps) && review.steps.length > 0 && review.steps.every(x => typeof x === 'string' && x.trim()), `latest PM ${date}: final review uses {title, steps[]}`);

  const amPath = `data/daily/${date}-am.json`;
  if(fs.existsSync(rel(amPath))){
    const am = readJSON(amPath);
    // Review-cycle AM cards (cycle_vocab) are old words reviewed at 08:00, as in the validator (2026-10-25 fix).
    const amCycle = new Set((Array.isArray(am.cycle_vocab) ? am.cycle_vocab : []).map(norm).filter(Boolean));
    const amNewWords = new Set((Array.isArray(am.vocab) ? am.vocab : [])
      .map(v => norm(typeof v === 'string' ? v : v && v.word)).filter(w => w && !amCycle.has(w)));
    const amReviewWords = new Set([...(Array.isArray(am.review_vocab) ? am.review_vocab : [])
      .map(v => norm(typeof v === 'string' ? v : v && v.word)).filter(Boolean), ...amCycle]);
    const amWords = new Set([...amNewWords,...amReviewWords]);
    groups.application.forEach(v => {
      const w=norm(v.word),label=String(v.formation || '') + ' ' + String(v.usage_note || '');
      const newly=/今天\s*08:00\s*新学/.test(label);
      const oldReview=/今天\s*08:00\s*复习过的老词/.test(label);
      // Historical PM JSON used this generic marker; preserve its immutability.
      const legacy=/今天\s*08:00\s*已教/.test(label);
      if(amNewWords.has(w)) ok(newly||legacy, `latest PM ${date}: AM new application ${v.word} has correct source marker`);
      if(amReviewWords.has(w)&&!amNewWords.has(w)) ok(oldReview||legacy, `latest PM ${date}: AM old review application ${v.word} has correct source marker`);
      if(newly) ok(amNewWords.has(w),`latest PM ${date}: AM new marker ${v.word} is true`);
      if(oldReview) ok(amReviewWords.has(w)&&!amNewWords.has(w),`latest PM ${date}: AM old review marker ${v.word} is true`);
      if(legacy) ok(amWords.has(w),`latest PM ${date}: historical generic AM marker ${v.word} is true`);
    });
  }
}

try {
  const rules = readJSON('data/learning-pool-rules.json');
  const runtime = readJSON('data/learning-runtime.json');

  ok(rules.version === 4, 'rules.version = 4');
  ok(rules.master_total === 977, 'master_total = 977');
  ok(rules.new_pool_formula === 'M ∩ A − D', 'new pool formula unchanged');
  ok(rules.review_pool_formula === 'A ∩ D', 'review pool formula unchanged');
  ok(rules.semantics && /不等于已掌握/.test(rules.semantics.daily_vocab || ''), 'daily-vocab still means taught, not mastered');

  const am = rules.am_contract || {};
  ok(/10/.test(String(am.new_words || '')), 'AM keeps exactly 10 new words');
  ok(/80-120/.test(String(am.reading_words || '')), 'AM reading stays 80-120 words');
  ok(Number(am.sentences) === 5, 'AM keeps 5 sentences');
  ok(/3题/.test(String(am.quiz || '')), 'AM keeps 3 quiz questions');
  ok(Boolean(am.active_output), 'AM active output contract exists');
  ok(Boolean(am.final_review), 'AM final review contract exists');
  ok(/review_vocab/.test(String(am.review_vocab_schema || '')) && /review_pool/.test(String(am.review_vocab_schema || '')), 'AM review_vocab schema is protected');
  ok(/vocab/.test(String(am.root_schema || '')) && /review_vocab/.test(String(am.root_schema || '')) && /quiz/.test(String(am.root_schema || '')), 'AM root schema is protected');
  ok(/前一天PM/.test(String(am.cross_day_dedup || '')) && /runtime\.new_pool/.test(String(am.cross_day_dedup || '')), 'AM cross-day freshness/de-dup contract is protected');

  const pm = rules.pm_contract || {};
  ok(pm.scheduled_time === '18:00', 'PM scheduled_time = 18:00');
  ok(/10-12/.test(String(pm.core_total || '')), 'PM keeps 10-12 core words');
  ok(/3-4/.test(String(pm.new_words || '')), 'PM keeps 3-4 new words');
  ok(/4-6/.test(String(pm.review_words || '')), 'PM keeps 4-6 review words');
  ok(/focus_pool/.test(String(pm.focus_words || '')) && /2-3/.test(String(pm.focus_words || '')), 'PM focus pool contract exists');
  ok(/2-3/.test(String(pm.application_words || '')), 'PM keeps 2-3 application words');
  ok(Boolean(pm.cooling), 'PM cooling contract exists');
  ok(Boolean(pm.automation_value), 'PM automation-value tie-break rule exists');
  ok(/80-120/.test(String(pm.reading_words || '')), 'PM reading stays 80-120 words');
  ok(Boolean(pm.dialogue), 'PM dialogue contract exists');
  ok(/3-4/.test(String(pm.rewrite || '')) && /根字段.*rewrite|rewrite:\[/.test(String(pm.rewrite || '')), 'PM rewrite root schema stays canonical');
  ok(/3 choice/.test(String(pm.daily_test || '')) && /2 fill/.test(String(pm.daily_test || '')) && /1 order/.test(String(pm.daily_test || '')), 'PM daily_test remains 3 choice + 2 fill + 1 order');
  ok(Boolean(pm.final_review), 'PM final review contract exists');
  ok(/今天08:00已教/.test(String(pm.same_day_am_mark || '')) && /review_vocab/.test(String(pm.same_day_am_mark || '')), 'same-day AM vocab/review marker is protected');
  ok(/(?:括号中文提示|目标词中文提示)/.test(String(pm.fill_style || '')), 'fill question Chinese hint style is protected');
  ok(/tokens/.test(String(pm.order_style || '')) && /answer_cn/.test(String(pm.order_style || '')), 'order question tokens/answer_cn are protected');
  ok(/answer_index/.test(String(pm.choice_schema || '')), 'choice answer_index schema is protected');
  ok(/self_check/.test(String(pm.self_check_schema || '')) && /非空/.test(String(pm.self_check_schema || '')), 'self_check schema is protected');
  ok(/steps/.test(String(pm.final_review_schema || '')) && /items/.test(String(pm.final_review_schema || '')), 'final review steps schema is protected');

  const requiredVocabFields = ['word','display','audio_text','cn','en','root','root_cn','formation','example','example_cn','synonym_note','usage_note','source_group','is_new','is_oral_new'];
  const vocabFields = Array.isArray(pm.vocab_fields) ? pm.vocab_fields : [];
  for(const f of requiredVocabFields){
    ok(vocabFields.includes(f), `PM vocab field protected: ${f}`);
  }

  ok(runtime.version === 4, 'runtime.version = 4');
  ok(runtime.rules_version === 4, 'runtime.rules_version = 4');
  ok(runtime.stats && runtime.stats.master_unique === 977, 'runtime master_unique = 977');
  const dailyIndexForWatermark=readJSON('data/daily/index.json');
  const expectedWatermark=latestCompletedStamp(dailyIndexForWatermark);
  ok(Boolean(runtime.lesson_watermark), 'runtime lesson_watermark exists');
  ok(runtime.lesson_watermark===expectedWatermark, 'runtime lesson_watermark matches latest completed lesson ('+expectedWatermark+')');
  ok(Array.isArray(runtime.new_pool), 'runtime.new_pool exists');
  ok(Array.isArray(runtime.review_pool), 'runtime.review_pool exists');
  ok(Array.isArray(runtime.focus_pool), 'runtime.focus_pool exists');
  ok(Array.isArray(runtime.oral_new_pool), 'runtime.oral_new_pool exists');
  const reviewSet = new Set((runtime.review_pool || []).map(x => norm(Array.isArray(x) ? x[0] : x && x.word)).filter(Boolean));
  const focusWords = (runtime.focus_pool || []).map(x => norm(Array.isArray(x) ? x[0] : x && x.word)).filter(Boolean);
  const newSet = new Set((runtime.new_pool || []).map(x => norm(Array.isArray(x) ? x[0] : x && x.word)).filter(Boolean));
  ok(focusWords.length <= 30, 'runtime.focus_pool stays small (<=30 exposed)');
  ok(focusWords.every(w => reviewSet.has(w)), 'runtime.focus_pool is a subset of review_pool');
  ok(focusWords.every(w => !newSet.has(w)), 'runtime.focus_pool never overlaps new_pool');
  ok(Number(runtime.stats.primary_taught_unique)>=0,'runtime primary_taught_unique exists');
  ok(Number(runtime.stats.primary_unlearned_total)>=0,'runtime primary_unlearned_total exists');
  ok(Number(runtime.stats.primary_taught_unique)+Number(runtime.stats.primary_unlearned_total)===Number(runtime.stats.primary_master_unique),'primary taught + unlearned partitions the 977 main pool');

  const workflowDir = rel('.github/workflows');
  const workflows = fs.readdirSync(workflowDir).filter(x => /\.ya?ml$/i.test(x)).sort();
  const expectedWorkflows = ['build-learning-runtime.yml','sync-daily-vocab.yml'].sort();
  ok(JSON.stringify(workflows) === JSON.stringify(expectedWorkflows), `workflow set is exactly: ${expectedWorkflows.join(', ')}`);

  const sync = read('.github/workflows/sync-daily-vocab.yml');
  const build = read('.github/workflows/build-learning-runtime.yml');
  ok(/fs\.writeFileSync\(dbPath/.test(sync), 'sync-daily-vocab is the daily-vocab writer');
  ok(/git add data\/daily-vocab-data\.js data\/learning-runtime\.json/.test(sync), 'daily-vocab and runtime are committed together');
  ok(/build-learning-runtime\.js/.test(sync), 'sync workflow rebuilds runtime in the same chain');
  ok(sync.includes("'data/daily/*-am.json'") && sync.includes("'data/daily/*-pm.json'"), 'sync workflow re-runs after completed lesson-file repairs');
  ok(!/fs\.writeFileSync\([^\n]*daily-vocab-data\.js/.test(build), 'build-learning-runtime workflow does not directly write daily-vocab');
  ok(/actions\/checkout@v7/.test(sync)&&/actions\/setup-node@v7/.test(sync)&&/node-version:\s*['\"]24['\"]/.test(sync), 'sync workflow uses Node 24 actions/runtime');
  ok(/actions\/checkout@v7/.test(build)&&/actions\/setup-node@v7/.test(build)&&/node-version:\s*['\"]24['\"]/.test(build), 'build workflow uses Node 24 actions/runtime');
  ok(!/git pull --rebase/.test(build), 'build workflow never rebases generated output');
  ok(/for attempt in 1 2; do/.test(build) && /git reset --hard origin\/main/.test(build) && /git push origin HEAD:main/.test(build), 'build workflow retries by recomputing from current main');
  const syncGroup=sync.split('\n').find(line=>/^\s*group:/.test(line))||'';
  ok(/group:\s*learning-data-write/.test(build) && syncGroup.includes('learning-data-write') && syncGroup.includes('lesson-pr-') && /cancel-in-progress:\s*false/.test(build) && /cancel-in-progress:\s*false/.test(sync), 'build and main sync share a non-cancelling write lock; read-only PR checks have a separate group');
  const scheduleCrons=sync.split('\n').map(x=>x.trim()).filter(x=>x.startsWith('- cron: '));
  ok(scheduleCrons.length===2 && scheduleCrons[0]==="- cron: '30 1 * * *'" &&
    scheduleCrons[1]==="- cron: '5 11 * * *'",
    'sync workflow has only the existing two daily checks, now at 08:30/18:05 Jakarta');
  // V4 backup-lesson generation is TEMPORARILY DISABLED (user instruction 2026-10-03). Claude is the
  // only automatic lesson generator. Re-enable ONLY on the user's explicit instruction, and update
  // this guard in the same change.
  // The PR preflight also runs THIS guard against the pinned pre-change main tree (GUARD_BASELINE_TREE=1)
  // to check data regressions only. That old tree predates the pause, so workflow-shape assertions
  // are skipped there; the full strict run on the proposed tree always executes them.
  const pausedOk=process.env.GUARD_BASELINE_TREE==='1'?()=>{}:ok;
  const syncLines=sync.split('\n');
  const stepBody=(name)=>{const a=sync.indexOf('      - name: '+name);if(a<0)return '';
    const b=sync.indexOf('\n      - name: ',a+10),c=sync.indexOf('\n  extensive_reading_release:',a+10);
    return sync.slice(a,[b,c].filter(x=>x>0).sort((x,y)=>x-y)[0]||sync.length)};
  const lessonRelease=stepBody('Generate index, validate and squash-merge the lesson release');
  // Pinned pre-change main checks data; the proposed tree must pass these new workflow assertions.
  const releaseWorkflowOk=process.env.GUARD_BASELINE_TREE==='1'?()=>{}:ok;
  releaseWorkflowOk(lessonRelease.includes('for release_attempt in 0 1 2; do') &&
    lessonRelease.includes('git diff --name-only "$release_base" "$latest_main"') &&
    lessonRelease.includes("grep -q '^data/daily/'"),
    'lesson release handles main movement inside the same job with at most two retries');
  releaseWorkflowOk(lessonRelease.includes('regenerate_index=false') &&
    lessonRelease.includes('--main-head "$latest_main"') &&
    lessonRelease.includes('check-release-pr.js" "$latest_main" "$final_sha" "$PR_HEAD_REF"'),
    'main-only changes rerun authoritative planner and validator against the latest main');
  releaseWorkflowOk(lessonRelease.includes('git merge --no-commit --no-ff "$latest_main"') &&
    lessonRelease.includes('[ "$conflicts" != "data/daily/index.json" ]') &&
    lessonRelease.includes('git push origin "HEAD:$PR_HEAD_REF"'),
    'daily changes regenerate index on the original branch and reject lesson conflicts');
  releaseWorkflowOk(!lessonRelease.includes('the synchronize run will recompute the index') &&
    !/git (?:pull --rebase|rebase|reset --hard)|git push[^\n]*(?:--force|-f\b)|\[skip ci\]/.test(lessonRelease),
    'lesson recovery never relies on bot synchronize approval, rebase, force push or skip ci');
  releaseWorkflowOk(lessonRelease.includes('if [ "$main_moved" = "true" ]; then continue; fi') &&
    lessonRelease.includes('Lesson release retry limit') && lessonRelease.includes('dispatch_sync "$merge_sha"'),
    'late main movement shares the same bounded recovery and successful merge dispatches existing Sync');
  // 2026-10-14: cosmetic cleanup of the zero-job bot run created by the index push. It must stay narrow
  // (bot actor + 0 jobs + this release branch), run only after success, and never fail the release.
  const noiseCleanup=stepBody('Remove the zero-job bot run left by the index push');
  releaseWorkflowOk(noiseCleanup.includes("if: ${{ success() }}") && noiseCleanup.includes('continue-on-error: true') &&
    noiseCleanup.includes('.triggering_actor.login == \\"github-actions[bot]\\"') && noiseCleanup.includes('[ "$jobs" = 0 ] || continue') &&
    noiseCleanup.includes('select(.id != $GITHUB_RUN_ID') && noiseCleanup.includes('^lesson-release-') && !/--method DELETE[^\n]*\/git\//.test(noiseCleanup),
    'bot-noise cleanup only deletes zero-job github-actions[bot] runs on the release branch, after success, without failing the release');
  pausedOk(!/^  create:\s*$/m.test(sync), 'V4 paused: branch-create watcher is not an active workflow trigger');
  pausedOk(/^    if: \$\{\{ false \}\}\s*$/m.test(sync), 'V4 paused: dormant release-scaffold watcher job is hard-disabled');
  const failedPrStep=stepBody('Recover immediately after an eligible lesson release fails');
  pausedOk(failedPrStep.includes('LESSON_RECOVERY_V4_DISABLED') && !failedPrStep.includes('inputs[recover_date]=$date') &&
    !failedPrStep.includes('inputs[recover_session]=$session'),
    'V4 paused: a failed lesson release PR never dispatches a backup generator');
  const generatorStep=stepBody('Generate missing lesson with V2 and commit the two-file transaction');
  pausedOk(generatorStep.includes('"status":"v4_disabled"') && generatorStep.includes('LESSON_V4_FALLBACK_DISABLED') &&
    !/LESSON_V4_FALLBACK\s*[:=]/.test(generatorStep),
    'V4 paused: scheduled/dispatch recovery only resumes the same saved original draft');
  const recoverSource=read('.github/scripts/recover-missing-lesson.js');
  pausedOk(/process\.env\.LESSON_V4_FALLBACK==='1'/.test(recoverSource) && recoverSource.includes("status:'v4_disabled'"),
    'V4 paused: recover-missing-lesson.js generates nothing unless LESSON_V4_FALLBACK=1');
  pausedOk(syncLines.filter(x=>/LESSON_V4_FALLBACK=1 node /.test(x)).length===2 && !/LESSON_V4_FALLBACK/.test(build),
    'V4 paused: only the two isolated PR-preflight rehearsals may enable the V4 switch');
  ok(/scheduled_health_check/.test(sync) &&
    /Scheduled check: lesson, index, runtime, context, vocabulary and regression guard healthy; no rebuild or commit/.test(sync) &&
    sync.includes('node .github/scripts/build-lesson-context.js --check > /dev/null; then') &&
    sync.indexOf("scheduled_health_check") < sync.indexOf("node <<'NODE'"),
    'scheduled recovery exits read-only only when canonical runtime and context are both fresh');
  ok(sync.includes('node .github/scripts/build-lesson-context.js --output data/lesson-context.json') &&
    build.includes('node .github/scripts/build-lesson-context.js --output data/lesson-context.json') &&
    sync.includes('data/learning-runtime.json data/lesson-context.json') &&
    build.includes('data/learning-runtime.json data/lesson-context.json') &&
    sync.includes('node .github/scripts/build-lesson-context.js --check') &&
    build.includes('node .github/scripts/build-lesson-context.js --check'),
    'existing Sync and Build atomically generate and verify the lightweight lesson context');
  ok(/remote_readback/.test(sync) && /Sync push and remote read-back validation succeeded/.test(sync), 'sync validates the published commit after push');
  ok(sync.includes("\n          HEALTH\n") && !sync.includes("\n            HEALTH\n"), 'scheduled health-check heredoc delimiter stays flush after YAML block dedent');
  ok(/record_incident_on_exit/.test(sync) && /record_incident_on_exit/.test(build), 'both writers capture incident phase on failure');
  ok(/actions\/upload-artifact@v4/.test(sync) && /actions\/upload-artifact@v4/.test(build), 'both writers preserve failure evidence artifacts');
  ok(/issues:\s*write/.test(sync) && /issues:\s*write/.test(build) && /gh issue create/.test(sync) && /gh issue create/.test(build), 'both writers maintain deduplicated durable incident issues');
  const runtimeBuilderSource=read('.github/scripts/build-learning-runtime.js');
  const profileBuilderSource=read('.github/scripts/build-vocab-profile.js');
  ok(runtimeBuilderSource.includes('JSON.stringify(withoutGenerationTime(previousRuntime))===JSON.stringify(withoutGenerationTime(runtime))'), 'runtime builder preserves generated_at on no-op recovery');
  ok(profileBuilderSource.includes('isDeepStrictEqual(withoutGenerationTime(previousProfile),withoutGenerationTime(out))'), 'profile builder preserves generated_at on no-op recovery');

  const css = read('data/daily-width-fix.css');
  ok(css.includes('#home .modules{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))'), 'first-paint desktop remaining-tool layout is 5 equal columns');
  ok(css.includes('@media (max-width:1050px)') && css.includes('repeat(3,minmax(0,1fr))'), 'first-paint medium layout keeps 3 columns');
  ok(css.includes('@media (max-width:700px)') && css.includes('repeat(2,minmax(0,1fr))'), 'first-paint mobile layout keeps 2 columns');
  ok(css.includes('@media (max-width:430px)') && css.includes('grid-template-columns:1fr'), 'first-paint narrow layout keeps 1 column');
  ok(css.includes('[data-home-module="reading"]{order:1') && css.includes('[data-home-module="vocab"]{order:2') && css.includes('[data-home-module="roots"]{order:3') && css.includes('[data-home-module="weak"]{order:4') && css.includes('[data-home-module="difficulty"]{order:5'), 'visible 5-card CSS order matches the single module renderer');

  const homeKeys=(layout0=>{const m=layout0.match(/const HOME_MODULES=\[([\s\S]*?)\n  \];/);return m?[...m[1].matchAll(/\{key:'(\w+)'/g)].map(x=>x[1]).join(','):'';});
  const layout = read('data/home-modules-layout.js');
  // 2026-10-14: the JS-injected compact grid once said 4 columns while first paint said 5, so after load the fifth card wrapped to its own row.
  ok(!/homeModulesCompact|homeMod(?:Vocab|Reading|Quick|Weak|Automation|Difficulty)/.test(layout), '2026-10-14: home-modules-layout.js must not restyle/reorder the tool cards after load (daily-width-fix.css is the single source of the card grid, colours, sizes and order)');
  ok(css.includes('min-height:139px!important') && css.includes('#home .modules>.module:hover{transform:translateY(-2px)'), 'first-paint card CSS owns final card height and hover effect');
  const indexHtml = read('index.html');
  ok(homeKeys(layout).startsWith('reading,vocab,roots,weak,difficulty'), 'JS card order matches the protected order (HOME_MODULES: reading, vocab, roots, weak, difficulty; quick/automation stay hidden after them)');
  // 2026-10-14: the 7 difficulty lessons (~145KB incl. their CSS) load only when the learner opens 难点解释.
  const diffLessons = read('data/difficulty-lessons.js');
  ok(!layout.includes('class="difficultyLesson"') && !layout.includes('difficulty01') && layout.length < 30000, 'home-modules-layout.js must not carry the difficulty lesson content (keeps every homepage load small)');
  ok(layout.includes("data/difficulty-lessons.js?v=") && /window\.showDifficultyList\s*=\s*showDifficultyList/.test(layout), 'homepage script lazy-loads the difficulty lessons from a stub');
  ok(/<section id="difficulty" class="page">/.test(read('index.html')), 'index keeps the difficulty page placeholder (hash/history navigation needs it at load)');
  ok(['difficulty01','difficulty02','difficulty03','difficulty04','difficulty05','difficulty06','difficulty07'].every(id => diffLessons.includes('id="'+id+'"')) && diffLessons.includes('window.__difficultyLessons=') && diffLessons.includes('window.answerDpQuiz=') && diffLessons.includes('window.openDifficulty07='), 'difficulty-lessons.js defines all 7 lessons and their handlers');
  ok(layout.includes("key:'roots'") && layout.includes("root-families/index.html"), 'root family homepage shortcut exists');
  ok(layout.includes('const HOME_MODULES=[') && layout.includes('window.renderHomeModules=renderHomeModules'), 'homepage has one HOME_MODULES renderer');
  ok(indexHtml.includes('<div class="modules" id="homeModules"></div>'), 'index keeps only the homepage module mount point');
  const rootData=readJSON('root-families/roots.json');
  const rootPage=read('root-families/index.html');
  ok(rootData.version===1 && Array.isArray(rootData.families) && rootData.families.length>=100, 'root family library has 100+ expandable records');
  const rootIds=new Set(),rootTerms=new Set();
  for(const f of rootData.families||[]){
    ok(typeof f.id==='string' && !!f.id && !rootIds.has(f.id), 'root id is present and unique: '+String(f.id));rootIds.add(f.id);
    ok(Array.isArray(f.forms) && f.forms.length>0 && Array.isArray(f.recommended), 'root family form/recommendation schema: '+String(f.id));
    for(const w of f.forms||[]){
      ok(typeof w.word==='string' && !!w.word && !rootTerms.has(w.word.toLowerCase()), 'root form globally unique: '+String(w.word));
      rootTerms.add(String(w.word).toLowerCase());
    }
  }
  ok(rootPage.includes("fetch('roots.json'") && rootPage.includes('id="cards"') && rootPage.includes('id="detail"'), 'root family library loads independent expandable JSON');
  ok(indexHtml.includes('data/daily-width-fix.css?v=20261014-single1') && indexHtml.includes('data/home-modules-layout.js?v=20261014-lazy1'),'homepage css and module JS cache keys are updated');
  ok(!/<div class="modules"[^>]*>\s*<button/s.test(indexHtml), 'index does not hard-code homepage cards');
  if(fs.existsSync(rel('data/home-modules-stability.js'))){
    const stability = read('data/home-modules-stability.js');
    ok(/Retired 2026-09-19/.test(stability) && !/const ORDER=|MutationObserver/.test(stability), 'retired homepage stability script cannot reorder cards');
  }else{
    ok(!indexHtml.includes('data/home-modules-stability.js'), 'removed homepage stability script cannot load or reorder cards');
  }

  const compat = read('data/vocab-dom-compat.js');
  ok(!/characterData\s*:\s*true/.test(compat), 'compat layer does not observe all character-data changes');
  ok(!/new MutationObserver/.test(compat), 'compat layer has no whole-page MutationObserver');
  ok(!/patchHomeTime|wrapLoadReading|__pm18Compat|PM_SWITCH_DATE/.test(compat), 'compat layer no longer patches PM time after render');

  for(const scriptPath of ['data/history-v2.js','data/daily-light-test.js','data/daily-ui-polish.js','data/vocab-memory-feedback.js']){
    const h=fileHash12(scriptPath);
    ok(indexHtml.includes(scriptPath+'?v='+h), 'index cache-bust hash matches '+scriptPath);
  }

  const historyV2 = read('data/history-v2.js');
  ok(historyV2.includes("const PM_SWITCH_DATE='2026-09-16'") && /pmTimeForDate\(d\)/.test(historyV2), 'loaded lesson renderer handles 18:00/19:00 by lesson date');
  ok(/async function refreshDailyArchiveOnOpen\(\)/.test(historyV2) && /fetchJSON\('data\/daily\/index\.json'\)/.test(historyV2), 'daily lesson entry refreshes the course index only when opened');
  ok(/await refreshDailyArchiveOnOpen\(\);d=exists\(TODAY,s\)\?TODAY:latest\(s\)/.test(historyV2), 'daily lesson entry prefers today and falls back to latest available lesson');

  const extensiveUi = read('data/extensive-reading-history-ui.js');
  ok(/function loadFreshSource\(path\)/.test(extensiveUi) && /\?v='\+Date\.now\(\)/.test(extensiveUi), 'extensive reading entry bypasses stale browser cache on demand');
  ok(/loadFreshSource\('data\/extensive-reading-data\.js'\)/.test(extensiveUi) && /loadFreshSource\('data\/extensive-reading-history\.js'\)/.test(extensiveUi), 'extensive reading refreshes current article and history index on entry');
  ok(/window\.openExtensiveV2=async function\(\).*await refreshLatestSources\(\)/s.test(extensiveUi), 'extensive reading loads latest available content when opened');
  ok(!/setInterval\s*\(|new MutationObserver|location\.reload\s*\(/.test(historyV2+extensiveUi), 'on-demand refresh adds no polling, whole-page observer, or forced reload');
  // New with the 2026-10-08 reading change; the PR preflight also runs this guard on the pre-change main tree.
  const readingOk=process.env.GUARD_BASELINE_TREE==='1'?()=>{}:ok;
  readingOk(/function markText\(text,hints,reviewWords\)/.test(extensiveUi) && /class=\\?"erRev\\?"/.test(extensiveUi) && /function dialogueHtml\(x\)/.test(extensiveUi), 'extensive reading marks learned review words and renders the colloquial dialogue');
  const readingPublisher = read('.github/scripts/publish-extensive-reading-candidate.js');
  readingOk(/function failIfAlreadyPublished\(/.test(readingPublisher) && (readingPublisher.match(/failIfAlreadyPublished\(oldArticle, expectedDate\)/g) || []).length >= 2, 'extensive reading release refuses a second reading for an already-published date');
  readingOk(/does not appear verbatim in the text or dialogue/.test(readingPublisher) && !/require\('\.\//.test(readingPublisher), 'extensive reading validator checks hint terms and stays self-contained for the release job');

  const pronunciation = read('data/pronunciation-fix.js');
  ok(/u\.lang='id-ID'/.test(pronunciation), 'main speaker TTS locale is Indonesian id-ID');
  ok(/tl=id/.test(pronunciation), 'online pronunciation fallback explicitly uses Indonesian');
  ok(/function isIndonesianVoice\(v\)/.test(pronunciation) && /no Indonesian voice/.test(pronunciation), 'local pronunciation refuses non-Indonesian voices');
  ok(!/\^ms\[-_\]|\^en\[-_\]|voices\[0\]/.test(pronunciation), 'main pronunciation has no Malay, English, or arbitrary voice fallback');
  ok(/function getIndonesianVoice\(\)/.test(extensiveUi) && /u\.lang='id-ID'/.test(extensiveUi) && /u\.voice=v/.test(extensiveUi), 'extensive-reading paragraph speaker uses an Indonesian voice');
  ok(/if\(!v\).*window\.speak\(text\)/s.test(extensiveUi), 'extensive-reading paragraph falls back to the unified Indonesian speaker when no local Indonesian voice exists');

  const polish = read('data/daily-ui-polish.js');
  ok(/pmTimeForDate\(info\.date\)/.test(polish), 'completion toast uses date-aware PM time');

  const light = read('data/daily-light-test.js');
  ok(/function choiceAnswerIndex/.test(light) && /it\.answer_index/.test(light) && /it\.answer/.test(light), 'PM choice renderer supports canonical answer_index and legacy answer fallback');
  ok(/if\(!ok\)btn\.classList\.add\('wrong'\)/.test(light) && /data-correct=['\"]?1/.test(light), 'PM choice UI distinguishes correct green from wrong red');
  ok(/function selfCheckHtml\(items\)/.test(light) && !/function selfCheckHtml\([^)]*\)\{return ''/.test(light), 'PM self_check is rendered');
  ok(/x\.review\.steps/.test(light) && /x\.review\.items/.test(light), 'PM final review renders steps and legacy items');
  ok(/am\.review_vocab/.test(light), 'same-day AM review_vocab is recognized for application marker');

  validateRecentDailyWindow();
  validateLatestAm();
  validateLatestPm();

  const index = read('index.html');
  ok(index.includes('<span class="slotTime">08:00</span><span id="amStatus"') && index.includes('<span class="slotTime">18:00</span><span id="pmStatus"'), 'index source homepage exposes the 08:00 / 18:00 lesson cards');
  ok(!index.includes('每天 08:00 / 18:00 自动生成到网站。学完后只点一次'), 'homepage obsolete lesson instructions remain removed');
  ok(index.includes('<span class="slotTime">18:00</span><span id="pmStatus"'), 'index source PM card first paint is 18:00');
  // 2026-10-14: every local-storage key is a user-data format contract. A new or renamed indo_* key must be documented in docs/STORAGE-KEYS.md.
  {
    const keysDoc = read('docs/STORAGE-KEYS.md');
    const used = new Set();
    const scan = text => { for (const m of text.matchAll(/['"`](indo_[A-Za-z0-9_]*[A-Za-z0-9_])['"`]/g)) used.add(m[1]); };
    for (const f of fs.readdirSync(path.join(ROOT, 'data')).filter(x => x.endsWith('.js'))) scan(read('data/' + f));
    scan(read('index.html')); scan(read('root-families/index.html'));
    const missing = [...used].filter(k => !keysDoc.includes(k)).sort();
    ok(used.size >= 25, 'storage-key scan finds the known indo_* keys (' + used.size + ')');
    ok(missing.length === 0, 'every indo_* storage key is documented in docs/STORAGE-KEYS.md' + (missing.length ? ': ' + missing.join(', ') : ''));
  }
  // 2026-10-14: the two script-filled home cards must reserve their FINAL height in the early CSS, otherwise filling them pushes the training cards down (up to ~270px on phones).
  ok(/#home \.homeLearningGrid > #vocabCoachHome,#home \.homeLearningGrid > #vocabProfile\{[^}]*min-height:265px/.test(index), 'home first paint reserves the final height of the coach/profile cards (desktop)');
  ok(/@media\(max-width:856px\) and \(min-width:761px\)\{[^}]*#vocabCoachHome[^}]*\{min-height:286px\}\}/.test(index), 'home first paint reserves the final height of the coach/profile cards (narrow two-column)');
  ok(/#home \.homeLearningGrid > #vocabCoachHome\{min-height:191px\}/.test(index) && /#home \.homeLearningGrid > #vocabProfile\{min-height:265px\}/.test(index), 'home first paint reserves the final height of the coach/profile cards (phones, stacked)');
  ok(!/#vocabCoachHome,#home \.homeLearningGrid > #vocabProfile\{min-height:0\}/.test(index), 'coach/profile placeholder height must never collapse to 0 on phones');
  ok(index.includes("loadReading('pm')\">18:00短文"), 'index source PM reading button first paint is 18:00');
  ok(index.includes("const PM_SWITCH_DATE='2026-09-16'") && /function pmTimeForDate\(d\)/.test(index), 'index source keeps historical PM switch date');
  ok(/pmTimeForDate\(d\)\+' 晚间学习'/.test(index), 'index source lesson title is date-aware');
  ok(/pmTimeForDate\(TODAY\)/.test(index), 'index source PM reading meta uses current date-aware time');
  ok(!index.includes('每天 08:00 / 19:00') && !index.includes("loadReading('pm')\">19:00短文") && !index.includes("<span class=\"slotTime\">19:00</span><span id=\"pmStatus\""), 'index source has no stale current 19:00 static labels');

  // 2026-10-16 (REGRESSION-GUARD §23): recent-new-word lane in the training scheduler.
  {
    const coach=read('data/vocab-study-coach.js');
    ok(/first:String\(x\.first_seen\|\|''\)/.test(coach)&&/function ageDays\(first,now\)/.test(coach),'coach counts new-word age from first_seen, not last_seen');
    ok(coach.includes("LANE={quick:{page:10,cap:4},auto:{page:8,cap:3}}")&&coach.includes('PLAN_LANE={auto:1,quick:1}'),'new-word lane caps stay quick 4/10, auto 3/8, daily plan <= 2 (listening unchanged)');
    ok(coach.includes("RECALL_KEY='indo_lesson_recall_v1'")&&!/recordLessonWrong/.test(coach),'lesson-end recall is read-only in the coach and never written as a lesson error');
  }

  // 2026-10-16 (REGRESSION-GUARD §24): lesson-end recall is a self-report: separate key, first attempt wins, no side effects.
  {
    const rc=read('data/lesson-end-recall.js'),wk=read('cloudflare/weakness-sync-worker.js'),sc=read('data/training-sync-client.js');
    ok(indexHtml.includes('data/lesson-end-recall.js?v=')&&indexHtml.indexOf('data/lesson-end-recall.js')<indexHtml.indexOf('data/training-sync-client.js'),'index loads lesson-end recall before the training sync client');
    ok(!/\.recordLessonWrong\s*\(|markMastered\s*\(|markAnswer\s*\(|indo_automation_training_state_v1|indo_quick_practice_state/.test(rc),'lesson-end recall never writes lesson errors, mastery or training passes');
    ok(rc.includes("KEY='indo_lesson_recall_v1'")&&/if\(todayResult\(word,now\)\)return false;/.test(rc),'lesson-end recall keeps only the first attempt per word per day');
    ok(/taughtOn\(yesterday,session\)/.test(rc)&&!/while\(words\.length</.test(rc),'lesson-end recall uses the real number of yesterday new words (no padding)');
    ok(/function mergeRecall\(a,b\)/.test(wk)&&/tsAny\(h\.at\)<tsAny\(cur\.at\)/.test(wk)&&/modes\.recall\)t\.modes\.recall=\{\}/.test(wk),'Worker keeps the earliest recall per word per day and advertises modes.recall');
    ok(/m\.recall_supported/.test(sc)&&/function recallStatus\(\)/.test(sc),'recall is pushed only to a Worker that supports it; the page says 仅本机保存 otherwise');
  }

  // 2026-10-16 (REGRESSION-GUARD §25): automatic-training progress line is display-only.
  {
    const at=read('data/automation-training.js');
    ok(/function progressText\(st,now,after\)/.test(at)&&/跨日验证 '\+v\+'\/3/.test(at)&&/class="autoProgress"/.test(at),'automatic training shows stage x/4, cross-day verifications x/3 and the next verification time per word');
    const body=at.slice(at.indexOf('  function progressText('),at.indexOf('  function',at.indexOf('  function progressText(')+10));
    ok(body.length>0&&!/saveState|localStorage|record\(/.test(body),'progress line only reads the state');
  }

  // 2026-10-16 (REGRESSION-GUARD §26): weekly memory report is read-only and keeps self-report apart from accuracy.
  {
    const wr=read('data/weekly-memory-report.js'),ui=read('data/vocab-profile-ui.js');
    ok(indexHtml.includes('data/weekly-memory-report.js?v=')&&indexHtml.indexOf('data/weekly-memory-report.js')<indexHtml.indexOf('data/vocab-profile-ui.js'),'index loads the weekly report before the profile UI');
    ok(!/setItem|removeItem|recordLessonWrong|markMastered/.test(wr),'weekly report never writes');
    ok(/MIN_SAMPLE=10/.test(wr)&&/样本不足/.test(ui)&&/age<7\|\|age>30/.test(wr),'retention uses formal answers on words 7-30 days after first teaching, with a 10-answer minimum');
    ok(/\['week','本周'\]/.test(ui)&&ui.includes('weeklyHTML()'),'profile 本周 tab shows the weekly report');
  }

  // 2026-10-18 (REGRESSION-GUARD §33): 带学模式 — a view over the lesson's own content; own progress key only.
  {
    const okNew=process.env.GUARD_BASELINE_TREE==='1'?()=>{}:ok;
    const gl=fs.existsSync(rel('data/guided-lesson.js'))?read('data/guided-lesson.js'):'',hv=read('data/history-v2.js');
    okNew(gl.includes("const KEY='indo_guided_lesson_v1'")&&/function buildSteps\(x,am\)/.test(gl)&&!/recordLessonWrong|markAnswer|indo_lesson_recall_v1|indo_automation_training_state_v1|indo_quick_practice_state|markMastered/.test(gl),'guided mode builds steps from the lesson and writes only its own progress');
    okNew(hv.includes('data-guided-start=')&&indexHtml.includes('data/guided-lesson.js?v='),'guided mode starts from the 今天的重点 card; the full page stays');
  }

  // 2026-10-18 (REGRESSION-GUARD §32): word cards — example first, root on one line, details folded, display only.
  {
    const okNew=process.env.GUARD_BASELINE_TREE==='1'?()=>{}:ok;
    const hv=read('data/history-v2.js');
    okNew(/function vcCard\(v,i,list,fo\)/.test(hv)&&hv.includes('class="dailyFixGrid vcGrid"')&&hv.includes('.vcCard .vcDetail[hidden]{display:none}')&&hv.includes('class="dailyFixMeta vcRoot"'),'word cards: folded details, root line keeps .dailyFixMeta for the PM application tag');
    okNew(hv.includes('<div class="vcDetail" hidden>')&&!hv.includes("${fo?'':' hidden'}"),'word cards: every card starts folded, focus words too (2026-10-18 user request)');
    okNew(hv.includes("$('dailyBody').innerHTML=h;setTimeout(vcEvenRows,0);")&&/function vcEvenRows\(\)/.test(hv),'collapsed word cards in one row share a height; opened cards grow on their own');
  }

  // 2026-10-18 (REGRESSION-GUARD §31): 今天的重点 — lesson_focus required from the 2026-10-18 PM lesson, display-only on the page.
  {
    const okNew=process.env.GUARD_BASELINE_TREE==='1'?()=>{}:ok;
    const vl=read('.github/scripts/validate-lesson-candidate.js'),hv=read('data/history-v2.js'),rc=read('data/lesson-end-recall.js');
    okNew(vl.includes('const FOCUS_REQUIRED_FROM="2026-10-18 18:00";')&&vl.includes('"LESSON_FOCUS_MISSING"')&&vl.includes('"LESSON_FOCUS_WORD"')&&vl.includes('"LESSON_FOCUS_PATTERN"'),'validator requires lesson_focus from 2026-10-19 with words and pattern examples taken from the lesson');
    okNew(/function focusData\(x\)/.test(hv)&&hv.includes('const f=focusData(x);if(f){h+=focusCardHtml(x,f);rememberFocus(x,f);}'),'lesson page shows 今天的重点 only when the lesson carries lesson_focus');
    okNew(/function focusSet\(\)/.test(rc)&&rc.includes("const mastered=masteredSet(),yesterday=shift(date,-1);")&&rc.includes('if(todayResult(word,now))return false;'),'focus words only reorder lesson-end recall; eligibility and first-attempt-wins unchanged');
  }

  // 2026-10-16 (REGRESSION-GUARD §29): optional structured review cards; the page falls back to the three strings.
  {
    // Code checks for this PR's own change; the preflight also runs this guard on the pinned base tree, which predates it.
    const okNew=process.env.GUARD_BASELINE_TREE==='1'?()=>{}:ok;
    const hv=read('data/history-v2.js'),vl=read('.github/scripts/validate-lesson-candidate.js');
    okNew(/function reviewCardsHtml\(rc,vocab\)/.test(hv)&&hv.includes("const rc=reviewCardsHtml(x.review_cards,x.vocab);if(rc)h+=sec(no++,'复习',rc);else if(x.review?.length)"),'AM page shows review_cards when present and falls back to the review strings');
    okNew(vl.includes('if(lesson.review_cards!==undefined){')&&vl.includes('"AM_REVIEW_CARDS_ANSWER"')&&vl.includes('Three final review points required'),'validator keeps the 3 review strings required and checks review_cards only when present');
  }
  // 2026-10-16 (REGRESSION-GUARD §28): review points are shown through the display-only readable renderer.
  {
    const hv=read('data/history-v2.js'),lt=read('data/daily-light-test.js');
    ok(/window\.reviewReadableHtml=function\(raw,vocab\)/.test(hv)&&hv.includes("h+=sec(no++,'复习',x.review.map(r=>window.reviewReadableHtml(")&&lt.includes('window.reviewReadableHtml(t,x.vocab)'),'AM review and PM final review use the readable renderer (display only)');
  }

  // 2026-10-14: the three scheduled tasks' full instructions live in docs/tasks/ (the task prompts only bootstrap).
  // These markers stop a later edit from silently dropping a contract piece (see REGRESSION-GUARD §2.A and §20).
  {
    const taskOk=process.env.GUARD_BASELINE_TREE==='1'?()=>{}:ok;
    const doc=p=>fs.existsSync(rel(p))?read(p):'';
    const need=(name,text,markers)=>{
      const missing=markers.filter(m=>!text.includes(m));
      taskOk(text.length>0&&missing.length===0,'task runbook '+name+' keeps its required markers'+(missing.length?' (missing: '+missing.join(' | ')+')':''));
    };
    need('COMMON',doc('docs/tasks/COMMON.md'),['docs/tasks/AM-LESSON.md','docs/tasks/PM-LESSON.md','docs/tasks/EXTENSIVE-READING.md','TZ=Asia/Jakarta date +%F','REST','一次性 push','force push','不自己合并','LESSON_V4_FALLBACK','SendUserFile','PushNotification','不得禁用','未实际运行的检查不得声称通过']);
    need('AM',doc('docs/tasks/AM-LESSON.md'),['lesson_focus','2026-10-18 晚课起每节必填','逐字取自本课','LESSON_FOCUS_PATTERN','标题双语','印尼语标题 · 中文标题','review_cards','AM_REVIEW_CARDS_INVALID','删掉整个 review_cards','docs/tasks/COMMON.md','lesson-release-D-am','data/daily/D-am.json','AUTO_PUBLISH_LESSON=1','rank-review-candidates.js --date D --session am','validate-lesson-candidate.js','plan-lesson-publication.js','regression-guard.js','check-collocations.js','docs/LESSON-QUALITY.md','docs/LESSON-JSON-SCHEMA.md','docs/LESSON-RECOVERY.md','dont-first','恰好 10 张','review_vocab','cycle_vocab','exposure_ledger','natural_recurrence','check-recurrence.js --candidate data/daily/D-am.json','至少 10 个','review_groups','RELEASE_PREFLIGHT','LESSON_RELEASE_PUBLISHED','VERIFIED_COMPLETE','全课跨句逻辑检查']);
    need('PM',doc('docs/tasks/PM-LESSON.md'),['lesson_focus','2026-10-18 晚课起每节必填','逐字取自本课','LESSON_FOCUS_PATTERN','标题双语','印尼语标题 · 中文标题','docs/tasks/COMMON.md','lesson-release-YYYY-MM-DD-pm','data/daily/D-pm.json','AUTO_PUBLISH_LESSON=1','rank-review-candidates.js --date YYYY-MM-DD --session pm','validate-lesson-candidate.js','plan-lesson-publication.js','regression-guard.js','check-collocations.js','docs/LESSON-QUALITY.md','docs/LESSON-JSON-SCHEMA.md','docs/LESSON-RECOVERY.md','10–12','3 道 choice + 2 道 fill + 1 道 order','self_check','review.steps','今天08:00新学','今天08:00复习过的老词','exposure_ledger','natural_recurrence','check-recurrence.js --candidate data/daily/D-pm.json','至少 15 个','review_groups','RELEASE_PREFLIGHT','LESSON_RELEASE_PUBLISHED','VERIFIED_COMPLETE','全课跨句逻辑检查']);
    need('EXTENSIVE-READING',doc('docs/tasks/EXTENSIVE-READING.md'),['docs/tasks/COMMON.md','extensive-reading-D','data/extensive-reading-candidate.json','AUTO_PUBLISH_EXTENSIVE_READING=1','reading-review.js --date D','publish-extensive-reading-candidate.js check','regression-guard.js','check-collocations.js','160–220','0–3 天','12–16','至少 4 个 tier=focus','term 必须逐字出现','不得生成第二篇']);
    // 2026-10-15: the natural-recurrence minimum is a generator-side gate; it must not be loosened silently.
    const nrc=(rules.review_rotation&&rules.review_rotation.natural_recurrence)||{};
    taskOk(Number(nrc.min_per_lesson&&nrc.min_per_lesson.am)>=10&&Number(nrc.min_per_lesson&&nrc.min_per_lesson.pm)>=15&&Number(nrc.list_size)>=30&&fs.existsSync(rel('.github/scripts/check-recurrence.js')),
      'natural recurrence gate: AM >= 10, PM >= 15 stale pending words from a 30-word list, checked by check-recurrence.js');
    // 2026-10-15 (user decision): review window doubled (rotation 160) and same-root review groups.
    const rpr=(rules.review_rotation&&rules.review_rotation.review_pool_rotation)||{},rg=(rules.review_rotation&&rules.review_rotation.review_groups)||{};
    taskOk(Number(rpr.max)===160&&/const REVIEW_ROTATION_MAX=160;/.test(read('.github/scripts/build-learning-runtime.js')),'review window rotation slots = 160 in rules and runtime builder');
    taskOk(rg.enabled===true&&/review_groups:reviewGroups/.test(read('.github/scripts/review-rotation.js'))&&/evaluateGroup/.test(read('.github/scripts/check-recurrence.js')),'same-root review groups: ranker outputs them and check-recurrence enforces one when available');
  }

  // §34: optional, ephemeral deep teaching; old courses keep the legacy flow.
  {
    const okNew=process.env.GUARD_BASELINE_TREE==='1'?()=>{}:ok;
    const exists=fs.existsSync(rel('data/deep-teach.js'));
    const dt=exists?read('data/deep-teach.js'):'';
    okNew(exists&&/data\/deep-teach\.js\?v=[^"']+/.test(indexHtml),'deep teach exists and loads with a manual cache version');
    okNew(!/localStorage|sessionStorage|indexedDB|recordLessonWrong|markMastered|indo_lesson_recall_v1|indo_automation_training_state_v1|WeaknessPool|LessonRecall|TrainingSync/.test(dt),'deep teach does not write learning, recall, training, mastery or preference records');
    okNew(dt.includes("mode:'none'")&&!dt.includes('GuidedLesson.open')&&dt.includes('revealStarts')&&dt.includes('selectTeach'),'deep teach: no usable teaching data → no start button (old 带学 paused 2026-10-19)');
    okNew(read('data/history-v2.js').includes('class="lfStart" hidden data-guided-start='),'the 带学 start button is rendered hidden and only revealed when teaching data exists');
    const dir=rel('data/teach');
    const files=fs.existsSync(dir)?fs.readdirSync(dir).filter(f=>f.endsWith('.json')):[];
    okNew(files.length>0&&files.every(f=>/^\d{4}-\d{2}-\d{2}-(am|pm)\.json$/.test(f)&&fs.existsSync(rel('data/daily/'+f))),'every pilot teach sidecar has a corresponding daily lesson');

    // §36 (2026-10-21, user decision): deep-teach is written for every lesson and published through teach_release.
    const swf=read('.github/workflows/sync-daily-vocab.yml'),tr=(swf.split('\n  teach_release:')[1]||'').split('\n  sync:')[0];
    okNew(tr.includes("startsWith(github.head_ref, 'teach-')")&&tr.includes('AUTO_PUBLISH_TEACH=1')&&/\^teach-\[0-9\]\{4\}-\[0-9\]\{2\}-\[0-9\]\{2\}-\(am\|pm\)\$/.test(tr),'teach_release is gated on branch teach-D-am|pm, same repo/owner and the AUTO_PUBLISH_TEACH=1 marker');
    okNew(tr.includes('Unexpected deep-teach PR paths')&&tr.includes('Lesson not published')&&tr.includes('Deep-teach already published')&&tr.includes('git worktree add --detach "$trusted" origin/main')&&tr.includes('check-teach.js'),'teach_release: one file only, waits for the lesson on main, never overwrites, validates with trusted main scripts');
    okNew(/group: teach-release-/.test(tr)&&!/learning-data-write/.test(tr)&&!/lesson_release|daily-vocab-data|learning-runtime/.test(tr.replace(/#[^\n]*/g,'')),'teach_release has its own concurrency group and touches no learning data');
    okNew(swf.includes("!startsWith(github.head_ref, 'teach-')")&&swf.includes("- 'data/teach/*.json'"),'teach PRs wake the workflow and skip the generic preflight');
    const dtDoc=fs.existsSync(rel('docs/tasks/DEEP-TEACH.md'))?read('docs/tasks/DEEP-TEACH.md'):'';
    okNew(['teach-D-am','AUTO_PUBLISH_TEACH=1','check-teach.js','shape_ok','不得影响','08:15','18:30','lesson_focus'].every(m=>dtDoc.includes(m))&&read('docs/tasks/COMMON.md').includes('docs/tasks/DEEP-TEACH.md')&&read('docs/tasks/AM-LESSON.md').includes('docs/tasks/DEEP-TEACH.md')&&read('docs/tasks/PM-LESSON.md').includes('docs/tasks/DEEP-TEACH.md'),'deep-teach runbook exists and both lesson runbooks call it after the lesson PR');
    okNew(read('docs/LESSON-QUALITY.md').includes('晚课换场景'),'LESSON-QUALITY keeps the PM different-scene rule');
    // §37 (2026-10-22 review): natural reading, non-absolute contrasts, quiz stems without the answer's Chinese, no system words.
    const lq=read('docs/LESSON-QUALITY.md'),vlc=read('.github/scripts/validate-lesson-candidate.js');
    okNew(['只把自然放得进去的词写进阅读','情节合理性检查','近义辨析不绝对化','题干不给答案的中文','至少 1 道是完整情境判断','不让系统用语出现在课程里'].every(m=>lq.includes(m)),'LESSON-QUALITY keeps the 2026-10-22 review rules');
    okNew(vlc.includes('"LEARNER_JARGON"')&&vlc.includes('const JARGON_FROM="2026-10-23"')&&read('.github/scripts/validate-teach.js').includes('TEACH_JARGON'),'validators refuse internal system words in lessons (from 2026-10-23) and deep-teach files');
    // §38 (2026-10-25, user-approved phase 1): observation only. The ability panel is read-only and the goal suggestions
    // are read by nothing that selects words, schedules reviews, judges mastery or generates/publishes content.
    const obs=fs.existsSync(rel('data/ability-observation.js'))?read('data/ability-observation.js'):'';
    okNew(obs.length>0&&!/setItem|removeItem|recordLessonWrong|markMastered|markWeak|removeReasons|recordPractice|markAnswer|requestVerification|\.round\(/.test(obs)&&indexHtml.includes('data/ability-observation.js?v='),'ability observation panel exists, is loaded, and writes nothing');
    const consumers=['.github/scripts/build-learning-runtime.js','.github/scripts/rank-review-candidates.js','.github/scripts/review-rotation.js','.github/scripts/validate-lesson-candidate.js','.github/scripts/plan-lesson-publication.js','.github/scripts/build-lesson-context.js','.github/scripts/reading-review.js','.github/scripts/check-recurrence.js','.github/scripts/publish-extensive-reading-candidate.js','data/vocab-study-coach.js','data/automation-training.js','data/home-learning-upgrade-v2.js','data/listening-word-training.js','data/lesson-end-recall.js','data/weakness-pool.js','docs/tasks/AM-LESSON.md','docs/tasks/PM-LESSON.md','docs/tasks/EXTENSIVE-READING.md','docs/tasks/DEEP-TEACH.md','docs/tasks/COMMON.md'];
    const leak=consumers.filter(f=>fs.existsSync(rel(f))&&/vocab-goals/.test(read(f)));
    okNew(leak.length===0,'goal suggestions are not read by selection, scheduling, mastery or generation'+(leak.length?' (found in: '+leak.join(', ')+')':''));
    // §39 (2026-10-25, user decision): review-phase rules staged dormant behind data/review-phase.json.
    const rpSw=(()=>{try{return readJSON('data/review-phase.json')}catch(e){return null}})(),rpThemes=(()=>{try{return readJSON('data/themes.json')}catch(e){return null}})();
    const isDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d||''));
    okNew(rpSw&&typeof rpSw.active==='boolean'&&(rpSw.active===false||(isDate(rpSw.activated_at)&&isDate(rpSw.theme_start_date)&&new Date(rpSw.theme_start_date+'T00:00:00Z').getUTCDay()===1)),'review-phase switch: boolean active; when on, activated_at and a Monday theme_start_date');
    okNew(rpThemes&&Array.isArray(rpThemes.themes)&&rpThemes.themes.length===7&&new Set(rpThemes.themes.map(x=>x&&x.id)).size===7&&rpThemes.themes.every(x=>x&&x.id&&x.cn&&Array.isArray(x.scenes)&&x.scenes.length>=2),'theme table: 7 distinct themes, each with scenes');
    const rpDoc=fs.existsSync(rel('docs/tasks/REVIEW-PHASE.md'))?read('docs/tasks/REVIEW-PHASE.md'):'';
    okNew(['"active": false','忽略本说明书','七、启用步骤','八、停用','不重置、不覆盖'].every(m=>rpDoc.includes(m)),'REVIEW-PHASE.md: switch first, activation steps, rollback, no data reset');
    okNew(['AM-LESSON.md','PM-LESSON.md'].every(f=>{const t=read('docs/tasks/'+f);return t.includes('review-phase.js --date D')&&t.includes('active=false')&&t.includes('docs/tasks/REVIEW-PHASE.md')}),'AM/PM runbooks read REVIEW-PHASE.md only when the switch is on');
    const rpJs=fs.existsSync(rel('.github/scripts/review-phase.js'))?read('.github/scripts/review-phase.js'):'';
    okNew(/function goals\([^)]*\)\{\s*const empty=[^;]+;\s*if\(!on\(phase,date\)\)return empty;/.test(rpJs)&&!rpJs.includes('vocab-goals-suggested'),'confirmed goals are read only while the phase is on; suggestions never');
    okNew(['validate-lesson-candidate.js','rank-review-candidates.js','build-lesson-context.js'].every(f=>/require\('\.\/review-phase'\)/.test(read('.github/scripts/'+f))),'validator, ranking and context use the shared review-phase switch');
  }

} catch (e) {
  failures.push('guard script crashed: ' + (e && e.stack ? e.stack : e));
}

console.log(`Regression guard: ${passes.length} passed, ${warnings.length} warning(s), ${failures.length} failure(s)`);
for(const p of passes) console.log('  PASS  ' + p);
for(const w of warnings) console.log('  WARN  ' + w);
for(const f of failures) console.error('  FAIL  ' + f);

if(failures.length){
  process.exit(1);
}
