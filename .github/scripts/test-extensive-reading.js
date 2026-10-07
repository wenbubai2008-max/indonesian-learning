#!/usr/bin/env node
'use strict';
// Tests for the extensive-reading validator (publish-extensive-reading-candidate.js) and the review-word ranker
// (reading-review.js). Pure functions plus a throwaway temp repo; never touches real data.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { validateArticle, check, ReleaseError } = require('./publish-extensive-reading-candidate');
const { readingReview, readingText, wordRegex, main: rankMain } = require('./reading-review');

let passed = 0;
function t(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function throwsRelease(fn, re) {
  assert.throws(fn, e => e instanceof ReleaseError && re.test(e.message), 'expected ReleaseError ' + re);
}

const words = n => Array.from({ length: n }, (_, i) => 'kata' + i).join(' ');
function article(over = {}) {
  const text = 'Warga merasa heran karena jadwal bus berubah. Petugas menegaskan bahwa layanan tetap bebas biaya. ' + words(170);
  return Object.assign({
    id: 'er-20261008-uji-bus', date: '2026-10-08', title: 'Uji', title_cn: '测试', category: '日常生活', level: 'A2+ → B1', minutes: 4,
    source_name: 'ANTARA', source_date: '2026-10-07', text, cn: '中文',
    hints: ['jadwal bus', 'berubah', 'petugas', 'layanan', 'biaya', 'warga', 'merasa', 'tetap'].map(term => ({ term, cn: '义' })),
  }, over);
}
const dialogue = lines => ({ title: '聊天', lines: lines.map((text, i) => ({ speaker: i % 2 ? 'B' : 'A', text, cn: '中' })) });

t('valid legacy-format article (no review_words, no dialogue) still passes', () => {
  const r = validateArticle(article(), '2026-10-08');
  assert.strictEqual(r.review_words, 0);
});
t('a hint whose term is not verbatim in the text is rejected (2026-10-07 bug)', () => {
  const a = article(); a.hints[0] = { term: 'jadwal bus kota', cn: '义' };
  throwsRelease(() => validateArticle(a, '2026-10-08'), /does not appear verbatim/);
});
t('hint matching is case-insensitive and may match inside the dialogue', () => {
  const a = article({ dialogue: dialogue(['Eh, kamu udah dengar?', 'Iya, aku sebel banget.', 'Pokoknya besok berangkat pagi.', 'Oke, nggak usah ngotot.']) });
  a.hints[0] = { term: 'Jadwal Bus', cn: '义' };
  a.hints[1] = { term: 'aku sebel', cn: '义' };
  validateArticle(a, '2026-10-08');
});
t('review words must appear in text or dialogue; clitic forms count', () => {
  const ok = article({ review_words: [{ word: 'heran', cn: '纳闷' }, { word: 'menegaskan', cn: '强调' }, { word: 'bebas', cn: '免费' }] });
  ok.text = ok.text.replace('bebas biaya', 'bebasnya biaya');
  assert.strictEqual(validateArticle(ok, '2026-10-08').review_words, 3);
  const bad = article({ review_words: [{ word: 'nyaris', cn: '差点' }] });
  throwsRelease(() => validateArticle(bad, '2026-10-08'), /does not appear/);
  const dup = article({ review_words: [{ word: 'heran', cn: 'a' }, { word: 'Heran', cn: 'b' }] });
  throwsRelease(() => validateArticle(dup, '2026-10-08'), /listed twice/);
  const part = article({ review_words: [{ word: 'bus', cn: '车' }] }); part.text = part.text.replace('jadwal bus', 'jadwal busway');
  part.hints[0] = { term: 'jadwal busway', cn: '义' };
  throwsRelease(() => validateArticle(part, '2026-10-08'), /does not appear/);
});
t('dialogue shape: 4-8 lines, speaker/text/cn, at most 30 words per line', () => {
  throwsRelease(() => validateArticle(article({ dialogue: dialogue(['a', 'b', 'c']) }), '2026-10-08'), /4-8 lines/);
  throwsRelease(() => validateArticle(article({ dialogue: { lines: [{ speaker: 'A', text: 'x', cn: '' }, 1, 2, 3] } }), '2026-10-08'), /non-empty speaker/);
  throwsRelease(() => validateArticle(article({ dialogue: dialogue(['a', 'b', 'c', words(31)]) }), '2026-10-08'), /longer than 30 words/);
  throwsRelease(() => validateArticle(article({ dialogue: ['a', 'b', 'c', 'd'] }), '2026-10-08'), /dialogue must be/);
});
t('existing rules unchanged: 160-220 words and 8-15 hints', () => {
  throwsRelease(() => validateArticle(article({ text: words(150) }), '2026-10-08'), /160-220/);
  const a = article(); a.hints = a.hints.slice(0, 7);
  throwsRelease(() => validateArticle(a, '2026-10-08'), /8-15/);
});

// temp repo for check()
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'er-test-'));
fs.mkdirSync(path.join(tmp, 'data'), { recursive: true });
const runtime = {
  focus_pool: [['heran', 90, [], 1, '', '', '纳闷'], ['menegaskan', 80, [], 1, '', '', '强调'], ['bebas', 70, [], 1, '', '', '免费']],
  review_pool: [['heran', 1, 1, '', '', '纳闷'], ['petugas', 2, 0, '', '', '工作人员'], ['tua', 5, 0, '', '', '老']],
  recurrence_pool: [['berubah', 3, '改变'], ['jadwal', 3, '时间表']],
};
fs.writeFileSync(path.join(tmp, 'data/learning-runtime.json'), JSON.stringify(runtime));
const writeCurrent = date => fs.writeFileSync(path.join(tmp, 'data/extensive-reading-data.js'), `window.EXTENSIVE_READING_DB=${JSON.stringify([article({ id: 'er-' + date.replace(/-/g, '') + '-x', date })])};\n`);
const quiet = fn => { const log = console.log; console.log = () => {}; try { return fn(); } finally { console.log = log; process.exitCode = 0; } };

t('check(): a second reading for an already-published date is refused', () => {
  writeCurrent('2026-10-08');
  fs.writeFileSync(path.join(tmp, 'cand.json'), JSON.stringify(article()));
  throwsRelease(() => quiet(() => check(tmp, '2026-10-08', 'cand.json')), /already published/);
});
t('check(): coverage by tier, pool membership errors, target warnings', () => {
  writeCurrent('2026-10-07');
  const a = article({ review_words: [{ word: 'heran', cn: '纳闷' }, { word: 'petugas', cn: '工作人员' }, { word: 'berubah', cn: '改变' }, { word: 'warga', cn: '居民' }] });
  fs.writeFileSync(path.join(tmp, 'cand.json'), JSON.stringify(a));
  const r = quiet(() => check(tmp, '2026-10-08', 'cand.json'));
  assert.deepStrictEqual(r.by_tier, { focus: ['heran'], review: ['petugas'], recurrence: ['berubah'] });
  assert.strictEqual(r.status, 'error');
  assert.ok(r.errors.some(e => /"warga" is not a learned-but-not-mastered/.test(e)));
  assert.ok(r.warnings.some(w => /only 4 review words/.test(w)) && r.warnings.some(w => /only 1 focus_pool/.test(w)) && r.warnings.some(w => /no dialogue/.test(w)));
});

t('ranker: focus > review > legacy > recurrence; days since any appearance breaks ties', () => {
  const r = readingReview({ date: '2026-10-08', runtime, lessons: [], readings: [], count: 10 });
  assert.deepStrictEqual(r.candidates.map(x => x.tier), ['focus', 'focus', 'focus', 'review', 'legacy', 'recurrence', 'recurrence']);
  assert.strictEqual(r.candidates.find(x => x.word === 'heran').tier, 'focus', 'a focus word is not listed again as review');
});
t('ranker: readings count as exposure, recent reuse is pushed down, a second scene 3-10 days later is boosted', () => {
  const lessons = [{ date: '2026-10-07', session: 'am', reading: { text: 'Saya heran sekali.' } }];
  const readings = [
    { date: '2026-10-07', title_cn: '昨天', text: 'Layanan tetap bebasnya biaya.' },          // bebas: 1 day ago -> too recent
    { date: '2026-10-01', title_cn: '上周', category: '交通', text: 'Petugas menegaskan aturan.' }, // menegaskan, petugas: 7 days, once
    { date: '2026-10-08', text: 'jadwal' },                                                    // today's own reading is ignored
  ];
  const r = readingReview({ date: '2026-10-08', runtime, lessons, readings, count: 10 });
  const by = Object.fromEntries(r.candidates.map(x => [x.word, x]));
  assert.strictEqual(by.bebas.too_recent, true);
  assert.strictEqual(by.menegaskan.second_scene, true);
  assert.strictEqual(by.menegaskan.last_reading.title, '上周');
  assert.strictEqual(by.heran.days_since_any_appearance, 1);
  assert.strictEqual(by.jadwal.days_since_any_appearance, null);
  assert.ok(r.candidates.indexOf(by.menegaskan) < r.candidates.indexOf(by.heran));
  assert.ok(r.candidates.indexOf(by.bebas) > r.candidates.indexOf(by.petugas), 'a word used in yesterday\'s reading drops below review words');
});
t('ranker helpers: whole-word regex with clitics, reading text includes dialogue and declared review words', () => {
  assert.ok(wordRegex('bebas').test('gratis, bebasnya!') && !wordRegex('bebas').test('membebaskan'));
  const txt = readingText({ text: 'A', dialogue: { lines: [{ text: 'Pokoknya' }] }, review_words: [{ word: 'Heran' }] });
  assert.ok(txt.includes('pokoknya') && txt.includes('heran'));
});
t('ranker on the real repository data returns a usable list', () => {
  const root = path.resolve(__dirname, '../..');
  const r = rankMain(['--date', '2026-10-08', '--root', root, '--count', '40']);
  assert.ok(r.count >= 40 && r.candidates.filter(x => x.tier === 'focus').length >= 8);
  assert.ok(r.candidates.every(x => x.word && typeof x.score === 'number'));
});

t('the reference sample (new format) passes the validator', () => {
  const sample = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/extensive-reading-sample.json'), 'utf8'));
  const r = validateArticle(sample, sample.date);
  assert.ok(r.review_words >= 8 && r.dialogue_lines >= 4);
});
t('health report section 3d counts declared review words and focus words re-used in the last 7 days', () => {
  const { readingCoverage } = require('./report-learning-health');
  const readings = [
    { date: '2026-10-08', text: 'heran dan bebasnya', review_words: [{ word: 'heran' }], dialogue: { lines: [{ text: 'Menegaskan lagi' }] } },
    { date: '2026-10-01', text: 'heran' },
  ];
  const r = readingCoverage({ runtime, readings, today: '2026-10-08' });
  assert.deepStrictEqual(r.rows, [{ date: '2026-10-08', review_words: 1, focus_in_text: 3, dialogue: true }]);
  assert.strictEqual(r.focus_covered_7d, 3);
});
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`extensive reading tests: ${passed} passed`);
