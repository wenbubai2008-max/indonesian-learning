const CONFIG = require('./config');
const { isDate } = require('./date');

const INDEX = 'index';
const STORAGE_KEY = 'mini_cache_v1:lessons';
const CACHE_LIMIT = 2 * 1024 * 1024;
const INDEX_URL = CONFIG.websiteRoot + 'data/daily/index.json';
let currentIndex;

function lessonKey(date, session) {
  return date + '-' + session;
}

function lessonUrl(date, session) {
  return CONFIG.websiteRoot + 'data/daily/' + lessonKey(date, session) + '.json';
}

function utf8Size(text) {
  let size = 0;
  for (const character of text) {
    const point = character.codePointAt(0);
    size += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
  }
  return size;
}

function readCache() {
  let cache;
  try {
    const stored = wx.getStorageSync(STORAGE_KEY);
    cache = stored ? JSON.parse(stored) : {};
  } catch (error) {
    cache = {};
  }
  return cache && typeof cache === 'object' && !Array.isArray(cache) ? cache : {};
}

function withinCacheWindow(key) {
  if (key === INDEX) return true;
  const date = key.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}-(am|pm)$/.test(key) &&
    isDate(date);
}

function writeCache(cache) {
  try {
    wx.setStorageSync(STORAGE_KEY, JSON.stringify(cache));
  } catch (error) {
    // A storage quota or disabled storage must not interrupt reading a live lesson.
  }
}

function cacheSnapshot() {
  const cache = readCache();
  const expired = Object.keys(cache).filter(key => !withinCacheWindow(key));
  expired.forEach(key => delete cache[key]);
  if (expired.length) writeCache(cache);
  return cache;
}

function save(key, entry) {
  if (!withinCacheWindow(key)) return;
  const cache = cacheSnapshot();
  const bytes = (name, item) => utf8Size(JSON.stringify(name) + ':' + JSON.stringify(item)) + 1;
  if (bytes(key, entry) + STORAGE_KEY.length + 2 > CACHE_LIMIT) return;

  cache[key] = entry;
  const days = [...new Set(Object.keys(cache).filter(name => name !== INDEX)
    .sort((a, b) => cache[b].updatedAt - cache[a].updatedAt).map(name => name.slice(0, 10)))];
  Object.keys(cache).filter(name => name !== INDEX && !days.slice(0, 14).includes(name.slice(0, 10)))
    .forEach(name => delete cache[name]);
  const keys = Object.keys(cache);
  let size = STORAGE_KEY.length + 2 + keys.reduce((sum, name) => sum + bytes(name, cache[name]), 0);
  if (size > CACHE_LIMIT) {
    const removable = keys.filter(name => name !== INDEX).sort((a, b) => cache[a].updatedAt - cache[b].updatedAt);
    for (const name of removable) {
      if (size <= CACHE_LIMIT) break;
      size -= bytes(name, cache[name]);
      delete cache[name];
    }
  }
  writeCache(cache);
}

function fetchJson(url, valid) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: url + '?t=' + Math.floor(Date.now() / 60000),
      method: 'GET',
      timeout: 10000,
      success(response) {
        if (response.statusCode !== 200) {
          reject(new Error('HTTP ' + response.statusCode));
          return;
        }
        try {
          const payload = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
          if (!valid(payload)) throw new Error('课程数据格式不正确');
          resolve(payload);
        } catch (error) {
          reject(error);
        }
      },
      fail(error) {
        reject(new Error(error.errMsg || '网络请求失败'));
      }
    });
  });
}

async function refresh(key, url, valid) {
  const data = await fetchJson(url, valid);
  const entry = { data, updatedAt: Date.now() };
  save(key, entry);
  return entry;
}

async function fetchIndex() {
  currentIndex = await refresh(INDEX, INDEX_URL, data => data && Array.isArray(data.dates));
  return currentIndex;
}

function currentIndexEntry() {
  return currentIndex || cacheSnapshot()[INDEX];
}

function fetchLesson(date, session, cache = true) {
  if (!isDate(date) || !['am', 'pm'].includes(session)) return Promise.reject(new Error('课程地址无效'));
  const valid = data => data && data.date === date && data.session === session;
  const url = lessonUrl(date, session);
  if (!cache) return fetchJson(url, valid).then(data => ({ data }));
  return refresh(lessonKey(date, session), url, valid);
}

function isPublished(index, date, session) {
  return !!index && index.dates.some(row => row && row.date === date && row[session] === true);
}

module.exports = {
  INDEX, INDEX_URL, fetchJson, lessonKey, lessonUrl, cacheSnapshot, currentIndexEntry, fetchIndex, fetchLesson, isPublished
};
