const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', '..');
const load = name => fs.readFileSync(path.join(root, name), 'utf8');
const json = name => JSON.parse(load(name));
const utils = path.join(__dirname, '../client/utils');
const { parseAssignment } = require(path.join(utils, 'jsliteral'));
const { segments, storyParts } = require(path.join(utils, 'segments'));
const { collect, dedupe, search } = require(path.join(utils, 'phrases'));
const { scenes } = require(path.join(utils, 'scenes'));
const { schedule, reviewGroup, keepWithinBudget } = require(path.join(utils, 'srs'));
const { size } = require(path.join(utils, 'storage'));
const { dates } = json('data/daily/index.json');
const { isPublished } = require(path.join(utils, 'data'));

const archiveFolder = 'data/extensive-reading-history';
const archives = fs.readdirSync(path.join(root, archiveFolder)).filter(name => name.endsWith('.js'));
assert(archives.length >= 74);
const articles = archives.map(name => parseAssignment(load(archiveFolder + '/' + name), 'EXTENSIVE_READING_ARCHIVE_ITEM'));
assert(articles.every(article => article.id && article.text && article.cn));
assert.throws(() => parseAssignment('window.X=alert(1)', 'X'));
assert.throws(() => parseAssignment('window.X=`bad ${unexpected}`', 'X'));
assert.throws(() => parseAssignment('window.X=[]; process.exit()', 'X'));
assert.throws(() => parseAssignment('window.Y=[]', 'X'));
assert.deepEqual(parseAssignment("window.X = [{first:'一', data:`x\\nz`,},];", 'X'), [{ first: '一', data: 'x\nz' }]);
const hostile = parseAssignment('window.X={__proto__:{x:1}}', 'X');
assert.equal(Object.getPrototypeOf(hostile), Object.prototype);
assert(Object.hasOwn(hostile, '__proto__'));
console.log('泛读归档解析 ' + articles.length + ' / ' + archives.length + '，字面量与拒绝表达式验证通过');

const refs = dates.flatMap(day => ['am', 'pm'].filter(session => day[session] === true)
  .map(session => ({ date: day.date, session })));
const references = refs.slice(-28);
const find = (date, session) => json('data/daily/' + date + '-' + session + '.json');
const readings = [];
const lessons = references.map(({ date, session }) => {
  const lesson = find(date, session);
  const morning = session === 'pm' && isPublished({ dates }, date, 'am') ? find(date, 'am') : null;
  const groups = segments(lesson, morning);
  assert(groups.length >= 4);
  groups.forEach(group => {
    assert(group.minutes >= 1);
    assert(group.cards.every(card => card.front && card.back));
  });
  readings.push(...groups.flatMap(group => group.cards));
  console.log(date, session, groups.length + ' 段', groups.map(group => group.name + ' ' + group.count).join(' / '));
  return lesson;
});
console.log(lessons.length + ' 节，' + readings.length + ' 张卡');
assert(readings.some(card => card.kind === 'contrast' && card.options && card.front.includes('____')));
assert(readings.some(card => card.kind === 'word' && card.source === '此前已学 · 晚课复现'));

const split = storyParts('Satu. Dua! Tiga? Ada kalimat lain. '.repeat(30), '第一句。第二句。第三句。第四句。'.repeat(20));
assert(split.length > 1);
assert(split.every(part => part.block && part.translated));
assert.equal(split.map(part => part.translated).join(''), '第一句。第二句。第三句。第四句。'.repeat(20));

const lessonPhrases = dedupe(lessons.flatMap(lesson => collect({ lesson })));
assert(lessonPhrases.length > 150);
assert(search(lessonPhrases, '发票', '全部', false, {}).length > 0);
console.log('最近 28 节去重句库 ' + lessonPhrases.length + ' 句', Object.fromEntries(scenes.slice(1).map(scene =>
  [scene, lessonPhrases.filter(row => row.scene === scene).length])));

const currentArticles = parseAssignment(load('data/extensive-reading-data.js'), 'EXTENSIVE_READING_DB');
const all = dedupe(refs.flatMap(({ date, session }) => collect({ lesson: find(date, session) }))
  .concat(articles.concat(currentArticles).flatMap(reading => collect({ reading }))));
assert(size(all) < 1024 * 1024);
console.log('完整句库 ' + all.length + ' 句，' + size(all) + ' 字节');

const item = readings.find(card => card.kind === 'word');
const today = '2026-11-28';
assert.equal(schedule(item, 'forgot', today).due, '2026-11-29');
assert.equal(schedule(item, 'forgot', today, { lapses: 2 }).lapses, 3);
assert.equal(schedule(item, 'fuzzy', today).due, '2026-11-29');
assert.equal(schedule(item, 'remembered', today).due, '2026-12-01');
assert.equal(schedule(item, 'remembered', today, { interval: 3 }).due, '2026-12-04');
assert.equal(schedule(item, 'remembered', today, { interval: 48 }).interval, 60);
const intervalState = { [item.id]: schedule(item, 'forgot', today) };
const group = reviewGroup(readings, '2026-11-29', intervalState);
assert.equal(group.length, 15);
assert.equal(group[0].id, item.id);
assert.equal(new Set(group.map(card => card.id)).size, 15);
const oversized = Object.fromEntries(Array.from({ length: 610 }, (_, i) => [i, {
  ...intervalState[item.id], interval: i < 12 ? 60 : 3
}]));
const bounded = keepWithinBudget(oversized);
assert(Object.keys(bounded).length <= 600);
assert(!bounded[0] && bounded[609]);
console.log('排程、到期组卡、上限验证通过');
