const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const project = path.join(__dirname, '..', '..');
const base = path.join(__dirname, '../client');
const { parseAssignment } = require(path.join(base, 'utils/jsliteral'));
const phrase = require(path.join(base, 'utils/phrases'));
const source = name => fs.readFileSync(path.join(project, name), 'utf8');
const index = JSON.parse(source('data/daily/index.json'));
const date = index.dates.at(-1).date;
const lesson = JSON.parse(source('data/daily/' + date + '-am.json'));
const readingPath = 'data/extensive-reading-data.js';
const article = parseAssignment(source(readingPath), 'EXTENSIVE_READING_DB')[0];
const rows = phrase.dedupe(phrase.collect({ lesson }).concat(phrase.collect({ reading: article })));
const now = Date.parse(date + 'T03:00:00Z');
const storage = new Map(Object.entries({
  'mini_cache_v1:lessons': { index: { data: index, updatedAt: now }, [date + '-am']: { data: lesson, updatedAt: now } },
  'mini_v11:phrases': { rows, completed: {} },
  'mini_v11:stars': { [rows[0].key]: true },
  'mini_v11:reading': { items: { [article.id]: { at: now, item: article } }, history: [],
    latest: [{ id: article.id, date: article.date, title: article.title, title_cn: article.title_cn, path: readingPath }] }
}).map(([key, value]) => [key, JSON.stringify(value)]));

Date.now = () => now;
global.wx = {
  getStorageSync: key => storage.get(key),
  setStorageSync: (key, value) => storage.set(key, value),
  request: options => queueMicrotask(() => options.fail({ errMsg: 'simulated offline' })),
  setNavigationBarTitle() {}
};
const app = { globalData: {} };
global.getApp = () => app;

function openPage(relative, options = {}) {
  let page;
  global.Page = config => {
    page = { ...config, data: structuredClone(config.data), setData(values, callback) {
      Object.assign(this.data, values);
      if (callback) callback();
    } };
  };
  require(path.join(base, relative));
  page.onLoad(options);
  if (page.onShow) page.onShow();
  return page;
}

async function main() {
  const today = openPage('pages/today/index');
  assert(today.data.lessonViews[0].available);
  assert(today.data.groupCount > 0);
  const deck = openPage('pages/deck/index', { date, session: 'am', segment: 'focus' });
  const phrases = openPage('pages/phrases/index');
  const reading = openPage('pages/reading/detail', { id: encodeURIComponent(article.id), path: encodeURIComponent(readingPath) });
  const fullLesson = openPage('pages/lesson/index', { date, session: 'am' });
  await new Promise(resolve => setImmediate(resolve));
  phrases.showStars();
  assert(today.data.offline && today.data.lessonViews[0].available);
  assert.equal(phrases.data.visible.length, 1);
  assert.equal(phrases.data.visible[0].key, rows[0].key);
  assert(reading.data.offline && reading.data.article.paragraphs.length);
  assert.match(fullLesson.data.status, /离线/);
  assert.equal(deck.data.card.kind, 'word');
  assert.equal(deck.data.number, 1);
  deck.flip();
  assert(deck.data.seen);
  deck.rate({ currentTarget: { dataset: { rating: 'remembered' } } });
  assert.equal(JSON.parse(storage.get('mini_v11:progress:' + date + '-am')).focus.cursor, 1);
  deck.onUnload();
  console.log('离线重开通过：今天、分段刷卡、完整课程、句库收藏、泛读；翻面、评分与继续位置通过');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
