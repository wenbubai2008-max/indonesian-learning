const CONFIG = require('./config');
const { isDate, jakartaDate, shiftDate } = require('./date');

const INDEX = 'index';
const STORAGE_KEY = 'mini_cache_v1:lessons';
const CACHE_LIMIT = 2 * 1024 * 1024;
const INDEX_URL = CONFIG.websiteRoot + 'data/daily/index.json';

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
  const today = jakartaDate();
  return /^\d{4}-\d{2}-\d{2}-(am|pm)$/.test(key) &&
    isDate(date) && date >= shiftDate(today, -13) && date <= today;
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
  const keys = Object.keys(cache);
  let size = STORAGE_KEY.length + 2 + keys.reduce((sum, name) => sum + bytes(name, cache[name]), 0);
  if (size > CACHE_LIMIT) {
    const removable = keys.filter(name => name !== INDEX).sort();
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

function fetchIndex() {
  return refresh(INDEX, INDEX_URL, data => data && Array.isArray(data.dates));
}

function fetchLesson(date, session) {
  return refresh(lessonKey(date, session), lessonUrl(date, session), data =>
    data && data.date === date && data.session === session);
}

function isPublished(index, date, session) {
  return !!index && index.dates.some(row => row && row.date === date && row[session] === true);
}

module.exports = {
  INDEX, INDEX_URL, lessonKey, lessonUrl, cacheSnapshot, fetchIndex, fetchLesson, isPublished
};
