function collection(name) {
  return wx.cloud.database().collection(name);
}

async function document(name, id) {
  const result = await collection(name).doc(id).get();
  return result && result.data || null;
}

function clean(row) {
  if (!row) return row;
  const result = { ...row };
  delete result._id;
  delete result._syncHash;
  return result;
}

async function readingByPath(path) {
  const index = await document('meta', 'readingIndex');
  if (!index) throw new Error('泛读索引尚未同步');
  let id;
  if (path === 'data/extensive-reading-data.js') {
    const row = (index.today || [])[0];
    id = row && row.id;
  } else {
    const row = (index.history || []).find(item => item.path === path);
    id = row && row.id;
  }
  if (!id) throw new Error('泛读文章不存在');
  return clean(await document('reading', id));
}

async function read(path) {
  if (path === 'data/daily/index.json') {
    return JSON.stringify(clean(await document('meta', 'index')));
  }
  const lesson = /^data\/daily\/(\d{4}-\d{2}-\d{2})-(am|pm)\.json$/.exec(path);
  if (lesson) return JSON.stringify(clean(await document('lessons', lesson[1] + '-' + lesson[2])));
  if (path === 'data/extensive-reading-data.js') {
    const index = await document('meta', 'readingIndex');
    const rows = await Promise.all((index && index.today || []).map(item => document('reading', item.id)));
    return 'window.EXTENSIVE_READING_DB=' + JSON.stringify(rows.filter(Boolean).map(clean)) + ';';
  }
  if (path === 'data/extensive-reading-history.js') {
    const index = await document('meta', 'readingIndex');
    return 'window.EXTENSIVE_READING_HISTORY_INDEX=' + JSON.stringify(index && index.history || []) + ';';
  }
  if (/^data\/extensive-reading-history\/[\w-]+\.js$/.test(path)) {
    const item = await readingByPath(path);
    return 'window.EXTENSIVE_READING_ARCHIVE_ITEM=' + JSON.stringify(item) + ';';
  }
  throw new Error('云端读取路径不支持');
}

async function readMany(paths) {
  if (!Array.isArray(paths) || paths.length > 4) throw new Error('一次最多读取四项');
  return Promise.all(paths.map(async path => ({ path, text: await read(path) })));
}

async function phraseRows() {
  const index = await document('meta', 'phrasesIndex');
  if (!index || !Array.isArray(index.ids)) throw new Error('句库尚未同步');
  const pages = await Promise.all(index.ids.map(id => document('meta', id)));
  return pages.flatMap(page => page && Array.isArray(page.items) ? page.items : []);
}

async function stats() {
  const row = clean(await document('meta', 'stats'));
  if (!row) throw new Error('统计快照尚未同步');
  return { ...row, active: row.pending, date: String(row.snapshotDate || '').slice(0, 10) };
}

function syncStatus() {
  return document('meta', 'syncLogLatest');
}

module.exports = { read, readMany, phraseRows, stats, syncStatus, document };
