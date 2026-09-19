const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
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

function validateLatestPm(){
  const dir = rel('data/daily');
  const files = fs.readdirSync(dir).filter(f => /^\d{4}-\d{2}-\d{2}-pm\.json$/.test(f)).sort();
  if(!files.length){ warnings.push('No PM lesson files found'); return; }
  const file = files[files.length - 1];
  const pm = readJSON('data/daily/' + file);
  const date = String(pm.date || file.slice(0,10));
  if(date < '2026-09-16') return;

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
  ok(inRange(vocab.length,10,12), `latest PM ${date}: 10-12 core vocab`);
  ok(inRange(groups.new.length,3,4), `latest PM ${date}: 3-4 new words`);
  ok(inRange(groups.review.length,4,5), `latest PM ${date}: 4-5 review words`);
  ok(inRange(groups.application.length,2,3), `latest PM ${date}: 2-3 application words`);

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
  ok(lines.length >= 4, `latest PM ${date}: dialogue exists`);
  ok(lines.length > 0 && lines.every(x => String(x && x.id || '').trim() && String(x && x.cn || '').trim()), `latest PM ${date}: dialogue lines have Indonesian and Chinese`);

  const rewrite = Array.isArray(pm.rewrite) ? pm.rewrite : [];
  ok(inRange(rewrite.length,3,4), `latest PM ${date}: rewrite/application has 3-4 tasks`);
  ok(rewrite.length > 0 && rewrite.every(x => String(x && x.task || '').trim() && String(x && x.reference_answer || '').trim() && String(x && x.reference_cn || '').trim()), `latest PM ${date}: rewrite tasks have answer + Chinese`);

  const test = pm.daily_test || {};
  const items = Array.isArray(test.items) ? test.items : [];
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
    const amWords = new Set([
      ...(Array.isArray(am.vocab) ? am.vocab.map(v => norm(v && v.word)) : []),
      ...(Array.isArray(am.review_vocab) ? am.review_vocab.map(v => norm(typeof v === 'string' ? v : v && v.word)) : [])
    ].filter(Boolean));
    groups.application.forEach(v => {
      const marked = /今天\s*08:00\s*已教/.test(String(v.formation || '') + ' ' + String(v.usage_note || ''));
      if(amWords.has(norm(v.word))) ok(marked, `latest PM ${date}: same-day application ${v.word} is marked 08:00 taught`);
      if(marked) ok(amWords.has(norm(v.word)), `latest PM ${date}: 08:00 marker for ${v.word} is not false`);
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

  const pm = rules.pm_contract || {};
  ok(pm.scheduled_time === '18:00', 'PM scheduled_time = 18:00');
  ok(/10-12/.test(String(pm.core_total || '')), 'PM keeps 10-12 core words');
  ok(/3-4/.test(String(pm.new_words || '')), 'PM keeps 3-4 new words');
  ok(/4-5/.test(String(pm.review_words || '')), 'PM keeps 4-5 review words');
  ok(/2-3/.test(String(pm.application_words || '')), 'PM keeps 2-3 application words');
  ok(Boolean(pm.cooling), 'PM cooling contract exists');
  ok(Boolean(pm.automation_value), 'PM automation-value tie-break rule exists');
  ok(/80-120/.test(String(pm.reading_words || '')), 'PM reading stays 80-120 words');
  ok(Boolean(pm.dialogue), 'PM dialogue contract exists');
  ok(/3-4/.test(String(pm.rewrite_application || '')), 'PM rewrite/application stays 3-4 tasks');
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
  ok(Array.isArray(runtime.new_pool), 'runtime.new_pool exists');
  ok(Array.isArray(runtime.review_pool), 'runtime.review_pool exists');
  ok(Array.isArray(runtime.oral_new_pool), 'runtime.oral_new_pool exists');

  const workflowDir = rel('.github/workflows');
  const workflows = fs.readdirSync(workflowDir).filter(x => /\.ya?ml$/i.test(x)).sort();
  const expectedWorkflows = ['build-learning-runtime.yml','sync-daily-vocab.yml'].sort();
  ok(JSON.stringify(workflows) === JSON.stringify(expectedWorkflows), `workflow set is exactly: ${expectedWorkflows.join(', ')}`);

  const sync = read('.github/workflows/sync-daily-vocab.yml');
  const build = read('.github/workflows/build-learning-runtime.yml');
  ok(/fs\.writeFileSync\(dbPath/.test(sync), 'sync-daily-vocab is the daily-vocab writer');
  ok(/git add data\/daily-vocab-data\.js data\/learning-runtime\.json/.test(sync), 'daily-vocab and runtime are committed together');
  ok(/build-learning-runtime\.js/.test(sync), 'sync workflow rebuilds runtime in the same chain');
  ok(!/fs\.writeFileSync\([^\n]*daily-vocab-data\.js/.test(build), 'build-learning-runtime workflow does not directly write daily-vocab');

  const css = read('data/daily-width-fix.css');
  ok(css.includes('#home .modules{display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))'), 'first-paint desktop homepage layout is 6 compact columns');
  ok(css.includes('@media (max-width:1050px)') && css.includes('repeat(3,minmax(0,1fr))'), 'first-paint medium layout keeps 3 columns');
  ok(css.includes('@media (max-width:700px)') && css.includes('repeat(2,minmax(0,1fr))'), 'first-paint mobile layout keeps 2 columns');
  ok(css.includes('@media (max-width:430px)') && css.includes('grid-template-columns:1fr'), 'first-paint narrow layout keeps 1 column');
  ok(css.includes('[data-home-module="vocab"]{order:1') && css.includes('[data-home-module="reading"]{order:2') && css.includes('[data-home-module="quick"]{order:3') && css.includes('[data-home-module="weak"]{order:4') && css.includes('[data-home-module="automation"]{order:5') && css.includes('[data-home-module="difficulty"]{order:6') && css.includes('[data-home-module="affix"]{order:7'), 'homepage CSS order matches the single module renderer');

  const protectedOrder = "const ORDER=['词汇学习','泛读','快速练习','弱项强化','自动训练','难点解释','前后缀'];";
  const layout = read('data/home-modules-layout.js');
  const indexHtml = read('index.html');
  ok(layout.includes(protectedOrder), 'JS card order matches the protected order');
  ok(layout.includes('const HOME_MODULES=[') && layout.includes('window.renderHomeModules=renderHomeModules'), 'homepage has one HOME_MODULES renderer');
  ok(indexHtml.includes('<div class="modules" id="homeModules"></div>'), 'index keeps only the homepage module mount point');
  ok(!/<div class="modules"[^>]*>\s*<button/s.test(indexHtml), 'index does not hard-code homepage cards');
  if(fs.existsSync(rel('data/home-modules-stability.js'))){
    const stability = read('data/home-modules-stability.js');
    ok(/Retired 2026-09-19/.test(stability) && !/const ORDER=|MutationObserver/.test(stability), 'retired homepage stability script cannot reorder cards');
  }

  const compat = read('data/vocab-dom-compat.js');
  ok(!/characterData\s*:\s*true/.test(compat), 'compat layer does not observe all character-data changes');
  ok(!/new MutationObserver/.test(compat), 'compat layer has no whole-page MutationObserver');
  ok(!/patchHomeTime|wrapLoadReading|__pm18Compat|PM_SWITCH_DATE/.test(compat), 'compat layer no longer patches PM time after render');

  const historyV2 = read('data/history-v2.js');
  ok(historyV2.includes("const PM_SWITCH_DATE='2026-09-16'") && /pmTimeForDate\(d\)/.test(historyV2), 'loaded lesson renderer handles 18:00/19:00 by lesson date');
  ok(/async function refreshDailyArchiveOnOpen\(\)/.test(historyV2) && /fetchJSON\('data\/daily\/index\.json'\)/.test(historyV2), 'daily lesson entry refreshes the course index only when opened');
  ok(/await refreshDailyArchiveOnOpen\(\);d=exists\(TODAY,s\)\?TODAY:latest\(s\)/.test(historyV2), 'daily lesson entry prefers today and falls back to latest available lesson');

  const extensiveUi = read('data/extensive-reading-history-ui.js');
  ok(/function loadFreshSource\(path\)/.test(extensiveUi) && /\?v='\+Date\.now\(\)/.test(extensiveUi), 'extensive reading entry bypasses stale browser cache on demand');
  ok(/loadFreshSource\('data\/extensive-reading-data\.js'\)/.test(extensiveUi) && /loadFreshSource\('data\/extensive-reading-history\.js'\)/.test(extensiveUi), 'extensive reading refreshes current article and history index on entry');
  ok(/window\.openExtensiveV2=async function\(\).*await refreshLatestSources\(\)/s.test(extensiveUi), 'extensive reading loads latest available content when opened');
  ok(!/setInterval\s*\(|new MutationObserver|location\.reload\s*\(/.test(historyV2+extensiveUi), 'on-demand refresh adds no polling, whole-page observer, or forced reload');

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

  validateLatestPm();

  const index = read('index.html');
  ok(index.includes('每天 08:00 / 18:00 自动生成到网站'), 'index source homepage schedule is 08:00 / 18:00');
  ok(index.includes('<span class="slotTime">18:00</span><span id="pmStatus"'), 'index source PM card first paint is 18:00');
  ok(index.includes("loadReading('pm')\">18:00短文"), 'index source PM reading button first paint is 18:00');
  ok(index.includes("const PM_SWITCH_DATE='2026-09-16'") && /function pmTimeForDate\(d\)/.test(index), 'index source keeps historical PM switch date');
  ok(/pmTimeForDate\(d\)\+' 晚间学习'/.test(index), 'index source lesson title is date-aware');
  ok(/pmTimeForDate\(TODAY\)/.test(index), 'index source PM reading meta uses current date-aware time');
  ok(!index.includes('每天 08:00 / 19:00') && !index.includes("loadReading('pm')\">19:00短文") && !index.includes("<span class=\"slotTime\">19:00</span><span id=\"pmStatus\""), 'index source has no stale current 19:00 static labels');

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
