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
  ok(css.includes('[onclick*="vocab"]{order:1') && css.includes('[onclick*="openExtensiveV2"]{order:2') && css.includes('[onclick*="openQuickPracticeV2"]{order:3') && css.includes('[onclick*="openWeaknessV2"]{order:4') && css.includes('[onclick*="affix"]{order:5'), 'first-paint card order is protected');

  const layout = read('data/home-modules-layout.js');
  ok(layout.includes("const ORDER=['词汇学习','泛读','快速练习','弱项强化','前后缀','难点解释'];"), 'JS card order matches the protected order');

  const compat = read('data/vocab-dom-compat.js');
  ok(!/characterData\s*:\s*true/.test(compat), 'compat layer does not observe all character-data changes');
  const observerMatch = compat.match(/new MutationObserver\(([\s\S]*?)\)\.observe/);
  ok(!observerMatch || !/patchHomeTime|patchDailyPmDisplay|wrapOpenDaily|wrapLoadReading/.test(observerMatch[1]), 'MutationObserver does not rewrite PM time/layout');
  ok(compat.includes("const PM_SWITCH_DATE='2026-09-16'"), 'PM historical switch date is protected');

  const light = read('data/daily-light-test.js');
  ok(/function choiceAnswerIndex/.test(light) && /it\.answer_index/.test(light) && /it\.answer/.test(light), 'PM choice renderer supports canonical answer_index and legacy answer fallback');
  ok(/function selfCheckHtml\(items\)/.test(light) && !/function selfCheckHtml\([^)]*\)\{return ''/.test(light), 'PM self_check is rendered');
  ok(/x\.review\.steps/.test(light) && /x\.review\.items/.test(light), 'PM final review renders steps and legacy items');
  ok(/am\.review_vocab/.test(light), 'same-day AM review_vocab is recognized for application marker');

  const index = read('index.html');
  warn(index.includes('每天 08:00 / 19:00') || index.includes('>19:00<'), 'Known legacy debt: index.html still contains old 19:00 literals. Do not fix this by adding a global DOM observer; migrate source directly when safely editing index.html.');

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
