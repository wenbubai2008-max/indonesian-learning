const { websiteRoot } = require('./config');
const { parseAssignment } = require('./jsliteral');
const { read, write, size } = require('./storage');
const { chat, text, asList } = require('./cards');

const KEY = 'mini_v11:reading';
const INDEX_PATH = 'data/extensive-reading-history.js';
const TODAY_PATH = 'data/extensive-reading-data.js';
const ARCHIVE = /^data\/extensive-reading-history\/[\w-]+\.js$/;
const validFile = path => path === TODAY_PATH || ARCHIVE.test(path);
const inFlight = new Map();
let memory;

function literal(path, name) {
  if (!inFlight.has(path)) {
    const promise = new Promise((resolve, reject) => wx.request({
      url: websiteRoot + path + '?t=' + Math.floor(Date.now() / 60000), method: 'GET',
      timeout: 10000, dataType: 'text', responseType: 'text',
      success(response) {
        try {
          if (response.statusCode !== 200) throw new Error('HTTP ' + response.statusCode);
          resolve(parseAssignment(response.data, name));
        } catch (error) { reject(error); }
      },
      fail(error) { reject(new Error(error.errMsg || '网络请求失败')); }
    })).finally(() => inFlight.delete(path));
    inFlight.set(path, promise);
  }
  return inFlight.get(path);
}

function cache() {
  if (!memory) memory = read(KEY, { items: {}, history: [], latest: [] });
  return memory;
}

function save(update) {
  const state = cache();
  update(state);
  const entries = Object.entries(state.items).sort(([, a], [, b]) => b.at - a.at).slice(0, 14);
  state.items = Object.fromEntries(entries);
  while (entries.length && size(state) > 1024 * 1024) delete state.items[entries.pop()[0]];
  write(KEY, state, 1024 * 1024);
}

function summary(item, path) {
  return { id: item.id, date: item.date, title: item.title, title_cn: item.title_cn, category: item.category || '',
    level: item.level || '', minutes: item.minutes || 0, path };
}

async function latest() {
  const items = await literal(TODAY_PATH, 'EXTENSIVE_READING_DB');
  if (!Array.isArray(items) || items.some(item => !item || !item.id || !item.date || !item.text)) {
    throw new Error('泛读数据格式不正确');
  }
  save(state => {
    state.latest = items.map(item => summary(item, TODAY_PATH));
    items.forEach(item => { state.items[item.id] = { item, at: Date.now() }; });
  });
  return items;
}

async function history() {
  const items = await literal(INDEX_PATH, 'EXTENSIVE_READING_HISTORY_INDEX');
  if (!Array.isArray(items) || items.some(item => !item || !item.id || !ARCHIVE.test(item.path))) {
    throw new Error('泛读索引格式不正确');
  }
  const rows = items.map(item => summary(item, item.path)).sort((a, b) => b.date.localeCompare(a.date));
  save(state => { state.history = rows; });
  return rows;
}

async function getItem(path, id, remember = true) {
  if (!validFile(path)) throw new Error('泛读地址无效');
  if (path === TODAY_PATH) {
    const items = await latest();
    const item = items.find(row => row.id === id);
    if (!item) throw new Error('此文章已移入归档');
    return item;
  }
  const item = await literal(path, 'EXTENSIVE_READING_ARCHIVE_ITEM');
  if (!item || item.id !== id || !item.date || !item.text) throw new Error('泛读文章格式不正确');
  if (remember) save(state => { state.items[id] = { item, at: Date.now() }; });
  return item;
}

function toDetail(item) {
  const paragraphs = value => text(value).split(/\r?\n\s*\r?\n/).filter(Boolean);
  const body = paragraphs(item.text);
  const translations = paragraphs(item.cn);
  const aligned = body.length === translations.length;
  return {
    ...summary(item), paragraphs: body.map((id, i) => ({ id, cn: aligned ? translations[i] : '' })),
    fullCn: aligned ? '' : text(item.cn), dialogueTitle: item.dialogue && item.dialogue.title || '',
    lines: chat(item.dialogue), hints: asList(item.hints), reviewWords: asList(item.review_words),
    source: [item.source_name, item.source_date].filter(Boolean).join(' · '),
    links: [...new Set([item.source_url, ...asList(item.source_urls)].filter(url => typeof url === 'string'))]
  };
}

module.exports = { cache, latest, history, getItem, toDetail, validFile };
