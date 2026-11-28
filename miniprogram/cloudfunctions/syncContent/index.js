const https = require('https');
const crypto = require('crypto');
const zlib = require('zlib');
const cloud = require('wx-server-sdk');
const { parseAssignment } = require('./lib/jsliteral');
const phrases = require('./lib/phrases');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const ORIGIN = 'https://wenbubai2008-max.github.io/indonesian-learning/';
const FALLBACKS = [
  'https://raw.githubusercontent.com/wenbubai2008-max/indonesian-learning/main/',
  'https://api.github.com/repos/wenbubai2008-max/indonesian-learning/contents/'
];
const MAX_BYTES = 12 * 1024 * 1024;
const MAX_DOC_BYTES = 8 * 1024 * 1024;
const HASH_FIELD = '_syncHash';

function allowedPath(path) {
  return typeof path === 'string' && path.length <= 180 && !path.includes('..') &&
    !path.includes('\\') && !path.includes('?') && !path.includes('#') && (
      path === 'data/daily/index.json' ||
      /^data\/daily\/\d{4}-\d{2}-\d{2}-(am|pm)\.json$/.test(path) ||
      path === 'data/weakness-sync.json' ||
      path === 'data/extensive-reading-data.js' ||
      path === 'data/extensive-reading-history.js' ||
      /^data\/extensive-reading-history\/[\w-]+\.js$/.test(path)
    );
}

function requestText(url, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    let request;
    let responseStream;
    let settled = false;
    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      handler(value);
    };
    const deadline = setTimeout(() => {
      finish(reject, new Error('timeout'));
      if (responseStream) responseStream.destroy();
      if (request) request.destroy();
    }, timeoutMs);
    request = https.get(url, { headers: {
      'User-Agent': 'indo-learning-mini-sync',
      'Accept-Encoding': 'gzip, deflate'
    } }, response => {
      responseStream = response;
      if (response.statusCode !== 200) {
        response.resume();
        finish(reject, new Error('HTTP ' + response.statusCode));
        return;
      }
      const encoding = String(response.headers['content-encoding'] || '').toLowerCase();
      const stream = encoding === 'gzip' ? response.pipe(zlib.createGunzip()) :
        encoding === 'deflate' ? response.pipe(zlib.createInflate()) : response;
      let size = 0;
      const chunks = [];
      stream.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_BYTES) request.destroy(new Error('file too large'));
        else chunks.push(chunk);
      });
      stream.on('end', () => finish(resolve, Buffer.concat(chunks).toString('utf8')));
      stream.on('error', error => finish(reject, error));
      if (stream !== response) response.on('error', error => finish(reject, error));
    });
    request.on('error', error => finish(reject, error));
  });
}

function apiContentsUrl(base, path) {
  return base + path + (base.includes('api.github.com') ? '?ref=main' : '');
}

async function fetchAllowed(path, failures) {
  if (!allowedPath(path)) throw new Error('path not allowed');
  const candidates = [ORIGIN].concat(FALLBACKS);
  let last;
  for (const base of candidates) {
    try {
      const response = await requestText(apiContentsUrl(base, path), path === 'data/weakness-sync.json' ? 20000 : 2500);
      if (base.includes('api.github.com')) {
        const body = JSON.parse(response);
        if (!body || typeof body.content !== 'string' || body.encoding !== 'base64') throw new Error('invalid GitHub API response');
        return Buffer.from(body.content.replace(/\n/g, ''), 'base64').toString('utf8');
      }
      return response;
    } catch (error) {
      last = error;
      failures.push(base + path + ': ' + (error.message || 'request failed'));
    }
  }
  throw last || new Error('upstream failed');
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function chunksOf(list, limit) {
  const chunks = [];
  let current = [];
  let bytes = 2;
  for (const row of list) {
    const rowBytes = Buffer.byteLength(JSON.stringify(row), 'utf8') + 1;
    if (current.length && bytes + rowBytes > limit) {
      chunks.push(current);
      current = [];
      bytes = 2;
    }
    current.push(row);
    bytes += rowBytes;
  }
  if (current.length || !chunks.length) chunks.push(current);
  return chunks;
}

async function getDoc(collection, id) {
  try { return (await db.collection(collection).doc(id).get()).data || null; }
  catch (_) { return null; }
}

function documentFields(row) {
  if (!row || typeof row !== 'object') return {};
  const { _id, ...fields } = row;
  return fields;
}

async function putDoc(collection, id, data) {
  await db.collection(collection).doc(id).set({ data });
}

async function allDocs(collection) {
  const result = [];
  let offset = 0;
  for (;;) {
    const page = await db.collection(collection).skip(offset).limit(100).get();
    const rows = page.data || [];
    result.push(...rows);
    if (rows.length < 100) return result;
    offset += rows.length;
  }
}

async function boundedMap(items, concurrency, worker) {
  let next = 0;
  const errors = [];
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      try { await worker(items[index], index); }
      catch (error) { errors.push({ item: items[index], error: error.message || 'failed' }); }
    }
  }));
  return errors;
}

function jsonOrThrow(text, label) {
  try { return JSON.parse(text); }
  catch (_) { throw new Error(label + ' JSON parse failed'); }
}

async function syncLesson(path, counts, failures) {
  const source = await fetchAllowed(path, failures);
  const data = jsonOrThrow(source, path);
  const id = data.date + '-' + data.session;
  if (!/^\d{4}-\d{2}-\d{2}-(am|pm)$/.test(id)) throw new Error('invalid lesson identity');
  const digest = hash(data);
  const previous = await getDoc('lessons', id);
  if (previous && previous[HASH_FIELD] === digest) return;
  await putDoc('lessons', id, { ...data, [HASH_FIELD]: digest });
  counts.lessonsUpdated++;
  if (!previous) counts.lessonsAdded++;
}

async function syncReadingItem(item, counts) {
  if (!item || typeof item.id !== 'string' || !/^[\w-]{1,120}$/.test(item.id) || !item.date || !item.text) {
    throw new Error('invalid reading item');
  }
  const digest = hash(item);
  const previous = await getDoc('reading', item.id);
  if (previous && previous[HASH_FIELD] === digest) return;
  await putDoc('reading', item.id, { ...item, [HASH_FIELD]: digest });
  counts.readingUpdated++;
  if (!previous) counts.readingAdded++;
}

async function writePhrases(rows, counts) {
  const chunks = chunksOf(rows, MAX_DOC_BYTES);
  const ids = chunks.length === 1 ? ['phrases'] : chunks.map((_, index) => 'phrases_' + index);
  const phraseErrors = await boundedMap(chunks, 4, async (items, index) => {
    await putDoc('meta', ids[index], { items, count: items.length, part: index, parts: chunks.length, syncedAt: new Date().toISOString() });
  });
  if (phraseErrors.length) throw new Error('phrase shard write failed: ' + phraseErrors[0].error);
  const currentMeta = await allDocs('meta');
  const staleIds = currentMeta.map(row => row._id).filter(id =>
    (chunks.length === 1 && /^phrases_\d+$/.test(id)) || (chunks.length > 1 && id === 'phrases'));
  for (const id of staleIds) {
    if (ids.includes(id)) continue;
    try { await db.collection('meta').doc(id).remove(); } catch (_) {}
  }
  await putDoc('meta', 'phrasesIndex', { ids, count: rows.length, syncedAt: new Date().toISOString() });
  counts.phraseCount = rows.length;
}

async function syncStats(failures) {
  const existing = await getDoc('meta', 'stats');
  const now = new Date();
  const day = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  if (existing && existing.fetchedDay === day) return existing;
  const source = await fetchAllowed('data/weakness-sync.json', failures);
  const snapshot = jsonOrThrow(source, 'weakness-sync');
  const words = snapshot && snapshot.words && typeof snapshot.words === 'object' ? Object.values(snapshot.words) : [];
  const result = {
    mastered: words.filter(row => row && row.status === 'mastered').length,
    pending: words.filter(row => row && row.status === 'active').length,
    snapshotDate: snapshot.updated_at || day,
    fetchedDay: day,
    syncedAt: new Date().toISOString()
  };
  await putDoc('meta', 'stats', result);
  return result;
}

function isPublished(index, date, session) {
  return Array.isArray(index.dates) && index.dates.some(row => row && row.date === date && row[session] === true);
}

exports.main = async event => {
  const startedAt = new Date().toISOString();
  const failures = [];
  const counts = { lessonsUpdated: 0, lessonsAdded: 0, readingUpdated: 0, readingAdded: 0, phraseCount: 0 };
  const previousState = await getDoc('meta', 'sourceState') || {};
  const indexText = await fetchAllowed('data/daily/index.json', failures);
  const index = jsonOrThrow(indexText, 'daily index');
  if (!index || !Array.isArray(index.dates)) throw new Error('invalid daily index');
  await putDoc('meta', 'index', { ...index, syncedAt: new Date().toISOString() });

  const lessonPaths = [];
  index.dates.forEach(row => {
    if (!row || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return;
    ['am', 'pm'].forEach(session => {
      if (row[session] === true) lessonPaths.push('data/daily/' + row.date + '-' + session + '.json');
    });
  });
  const indexHash = hash(index);
  const scanLessons = previousState.indexHash !== indexHash;
  const pendingLessonRun = previousState.pendingIndexHash === indexHash;
  let lessonCursor = pendingLessonRun ? Math.min(previousState.lessonCursor || 0, lessonPaths.length) :
    (scanLessons ? 0 : lessonPaths.length);
  let contentChanged = (pendingLessonRun || previousState.indexHash === indexHash) ? !!previousState.contentChanged : false;
  let lessonScanComplete = lessonCursor >= lessonPaths.length;
  if (!lessonScanComplete) {
    const end = Math.min(lessonCursor + 10, lessonPaths.length);
    const lessonBatch = lessonPaths.slice(lessonCursor, end);
    const lessonErrors = await boundedMap(lessonBatch, 4, path => syncLesson(path, counts, failures));
    lessonErrors.forEach(row => failures.push(row.item + ': ' + row.error));
    contentChanged = contentChanged || counts.lessonsUpdated > 0 || lessonErrors.length > 0;
    if (!lessonErrors.length) lessonCursor = end;
    lessonScanComplete = lessonCursor >= lessonPaths.length;
    await putDoc('meta', 'sourceState', {
      ...documentFields(previousState),
      indexHash: lessonScanComplete ? indexHash : previousState.indexHash || '',
      pendingIndexHash: lessonScanComplete ? '' : indexHash,
      lessonCursor: lessonScanComplete ? 0 : lessonCursor,
      contentChanged,
      lessonScanComplete,
      updatedAt: new Date().toISOString()
    });
    if (!lessonScanComplete) {
      const log = { startedAt, finishedAt: new Date().toISOString(), lessonsAdded: counts.lessonsAdded,
        lessonsUpdated: counts.lessonsUpdated, readingAdded: 0, readingUpdated: 0, phraseCount: 0,
        phase: 'lessons', progress: lessonCursor + '/' + lessonPaths.length,
        failedAddresses: failures.slice(0, 100) };
      await putDoc('meta', 'syncLogLatest', log);
      const oldLog = await getDoc('meta', 'syncLog');
      const rows = Array.isArray(oldLog && oldLog.rows) ? oldLog.rows : [];
      rows.unshift(log);
      await putDoc('meta', 'syncLog', { rows: rows.slice(0, 20), syncedAt: new Date().toISOString() });
      return { ...counts, phase: 'lessons', progress: lessonCursor + '/' + lessonPaths.length,
        failureCount: failures.length, failedAddresses: failures.slice(0, 100) };
    }
  }

  let latest = [];
  let history = [];
  let latestHash = previousState.latestHash;
  let historyHash = previousState.historyHash;
  let latestRead = false;
  let historyRead = false;
  try {
    const latestText = await fetchAllowed('data/extensive-reading-data.js', failures);
    latestHash = crypto.createHash('sha256').update(latestText).digest('hex');
    latest = parseAssignment(latestText, 'EXTENSIVE_READING_DB');
    if (!Array.isArray(latest)) throw new Error('invalid latest reading data');
    latestRead = true;
  } catch (error) { failures.push('data/extensive-reading-data.js: ' + error.message); }
  try {
    const historyText = await fetchAllowed('data/extensive-reading-history.js', failures);
    historyHash = crypto.createHash('sha256').update(historyText).digest('hex');
    history = parseAssignment(historyText, 'EXTENSIVE_READING_HISTORY_INDEX');
    if (!Array.isArray(history)) throw new Error('invalid reading history index');
    historyRead = true;
  } catch (error) { failures.push('data/extensive-reading-history.js: ' + error.message); }

  let archiveScanComplete = historyRead && previousState.historyHash === historyHash;
  let latestSyncComplete = latestRead;
  if (latestRead || historyRead) {
    const previousReadingIndex = await getDoc('meta', 'readingIndex') || { today: [], history: [] };
    const readingIndex = {
      today: latestRead ? latest.map(item => ({ id: item.id, date: item.date, title: item.title, title_cn: item.title_cn,
        category: item.category || '', level: item.level || '', minutes: item.minutes || 0 })) : previousReadingIndex.today || [],
      history: historyRead ? history : previousReadingIndex.history || []
    };
    await putDoc('meta', 'readingIndex', { ...readingIndex, syncedAt: new Date().toISOString() });
    const pendingArchiveRun = previousState.pendingHistoryHash === historyHash;
    const scanArchives = historyRead && previousState.historyHash !== historyHash;
    let archiveCursor = pendingArchiveRun ? previousState.archiveCursor || 0 : 0;
    archiveScanComplete = archiveScanComplete || !scanArchives;
    if (scanArchives) {
      const archivePaths = history.map(item => item.path).filter(path => allowedPath(path) && /^data\/extensive-reading-history\/[\w-]+\.js$/.test(path));
      const archiveBatch = archivePaths.slice(archiveCursor, Math.min(archiveCursor + 1, archivePaths.length));
      const readingItems = latestRead ? latest.slice() : [];
      const archiveErrors = await boundedMap(archiveBatch, 3, async path => {
        const text = await fetchAllowed(path, failures);
        const items = parseAssignment(text, 'EXTENSIVE_READING_ARCHIVE_ITEM');
        readingItems.push(...(Array.isArray(items) ? items : [items]));
      });
      archiveErrors.forEach(row => failures.push(row.item + ': ' + row.error));
      const itemErrors = await boundedMap(readingItems, 3, item => syncReadingItem(item, counts));
      itemErrors.forEach(row => failures.push('reading item: ' + row.error));
      if (itemErrors.length) latestSyncComplete = false;
      contentChanged = contentChanged || counts.readingUpdated > 0 || itemErrors.length > 0;
      if (!archiveErrors.length && !itemErrors.length) archiveCursor += archiveBatch.length;
      archiveScanComplete = archiveCursor >= archivePaths.length;
      await putDoc('meta', 'sourceState', {
        ...documentFields(await getDoc('meta', 'sourceState') || previousState),
        indexHash,
        pendingHistoryHash: archiveScanComplete ? '' : historyHash,
        archiveCursor: archiveScanComplete ? 0 : archiveCursor,
        historyHash: archiveScanComplete ? historyHash : previousState.historyHash || '',
        latestHash: latestSyncComplete ? latestHash : previousState.latestHash || '',
        contentChanged,
        lessonScanComplete: true,
        phrasesReady: !!previousState.phrasesReady,
        updatedAt: new Date().toISOString()
      });
      if (!archiveScanComplete) {
        const log = { startedAt, finishedAt: new Date().toISOString(), lessonsAdded: counts.lessonsAdded,
          lessonsUpdated: counts.lessonsUpdated, readingAdded: counts.readingAdded, readingUpdated: counts.readingUpdated,
          phraseCount: 0, phase: 'reading', progress: archiveCursor + '/' + archivePaths.length,
          failedAddresses: failures.slice(0, 100) };
        await putDoc('meta', 'syncLogLatest', log);
        const oldLog = await getDoc('meta', 'syncLog');
        const rows = Array.isArray(oldLog && oldLog.rows) ? oldLog.rows : [];
        rows.unshift(log);
        await putDoc('meta', 'syncLog', { rows: rows.slice(0, 20), syncedAt: new Date().toISOString() });
        return { ...counts, phase: 'reading', progress: archiveCursor + '/' + archivePaths.length,
          failureCount: failures.length, failedAddresses: failures.slice(0, 100) };
      }
    } else {
      archiveScanComplete = true;
      const readingItems = latestRead ? latest : [];
      const itemErrors = await boundedMap(readingItems, 8, item => syncReadingItem(item, counts));
      itemErrors.forEach(row => failures.push('reading item: ' + row.error));
      if (itemErrors.length) latestSyncComplete = false;
      contentChanged = contentChanged || counts.readingUpdated > 0 || itemErrors.length > 0;
    }
  }

  if (contentChanged || !previousState.phrasesReady) {
    const lessonDocs = await allDocs('lessons');
    const storedReading = await allDocs('reading');
    const phraseRows = [];
    lessonDocs.forEach(lesson => {
      if (lesson && lesson.date && lesson.session) phraseRows.push(...phrases.collect({ lesson }));
    });
    storedReading.forEach(item => phraseRows.push(...phrases.collect({ reading: item })));
    await writePhrases(phrases.dedupe(phraseRows), counts);
  } else {
    const phraseIndex = await getDoc('meta', 'phrasesIndex');
    counts.phraseCount = phraseIndex && phraseIndex.count || 0;
  }
  try { await syncStats(failures); }
  catch (error) { failures.push('data/weakness-sync.json: ' + error.message); }
  await putDoc('meta', 'sourceState', {
    indexHash: lessonScanComplete ? indexHash : previousState.indexHash || '',
    latestHash: latestSyncComplete ? latestHash : previousState.latestHash || '',
    historyHash: archiveScanComplete ? historyHash : previousState.historyHash || '',
    pendingIndexHash: '',
    lessonCursor: 0,
    pendingHistoryHash: '',
    archiveCursor: 0,
    contentChanged: false,
    lessonScanComplete,
    phrasesReady: true,
    updatedAt: new Date().toISOString()
  });

  const log = { startedAt, finishedAt: new Date().toISOString(), lessonsAdded: counts.lessonsAdded,
    lessonsUpdated: counts.lessonsUpdated, readingAdded: counts.readingAdded, readingUpdated: counts.readingUpdated,
    phraseCount: counts.phraseCount, failedAddresses: failures.slice(0, 100) };
  await putDoc('meta', 'syncLogLatest', log);
  const oldLog = await getDoc('meta', 'syncLog');
  const rows = Array.isArray(oldLog && oldLog.rows) ? oldLog.rows : [];
  rows.unshift(log);
  await putDoc('meta', 'syncLog', { rows: rows.slice(0, 20), syncedAt: new Date().toISOString() });
  return { ...counts, failureCount: failures.length, failedAddresses: failures.slice(0, 100) };
};
