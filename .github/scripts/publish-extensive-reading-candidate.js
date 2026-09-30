#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const DATA_PATH = 'data/extensive-reading-data.js';
const INDEX_PATH = 'data/extensive-reading-history.js';
const CANDIDATE_PATH = 'data/extensive-reading-candidate.json';
const HISTORY_DIR = 'data/extensive-reading-history';

function fail(message) {
  console.error(`EXTENSIVE_READING_RELEASE_ERROR: ${message}`);
  process.exit(1);
}

function runGit(repo, args, options = {}) {
  return execFileSync('git', ['-C', repo, ...args], {
    encoding: 'utf8',
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
  }).trimEnd();
}

function gitShow(repo, ref, filePath) {
  try {
    return runGit(repo, ['show', `${ref}:${filePath}`]);
  } catch (_) {
    return null;
  }
}

function readFile(repo, filePath) {
  return fs.readFileSync(path.join(repo, filePath), 'utf8');
}

function writeFile(repo, filePath, content) {
  const full = path.join(repo, filePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}

function parseWindowAssignment(source, varName, label) {
  if (typeof source !== 'string' || !source.includes(`window.${varName}`)) {
    fail(`${label} is missing window.${varName}`);
  }
  const sandbox = { window: Object.create(null) };
  vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
  try {
    new vm.Script(source, { filename: label }).runInContext(sandbox, { timeout: 1000 });
  } catch (error) {
    fail(`${label} cannot be parsed: ${error.message}`);
  }
  return sandbox.window[varName];
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sameValue(a, b) {
  return stableJson(a) === stableJson(b);
}

function validateDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) fail(`${label} must be YYYY-MM-DD`);
}

function dayNumber(s) {
  validateDate(s, 'date');
  const ms = Date.parse(`${s}T00:00:00Z`);
  if (!Number.isFinite(ms)) fail(`invalid date ${s}`);
  return Math.floor(ms / 86400000);
}

function validateArticle(article, expectedDate) {
  if (!article || typeof article !== 'object' || Array.isArray(article)) fail('candidate article must be one JSON object');
  const required = ['id','date','title','title_cn','category','level','minutes','source_name','source_date','text','cn'];
  for (const key of required) {
    if (!(key in article)) fail(`candidate missing ${key}`);
    if (key !== 'minutes' && !String(article[key] ?? '').trim()) fail(`candidate ${key} is empty`);
  }
  if (!/^er-\d{8}-[a-z0-9-]+$/.test(article.id)) fail('candidate id must match er-YYYYMMDD-slug');
  if (article.date !== expectedDate) fail(`candidate date ${article.date} does not match branch date ${expectedDate}`);
  validateDate(article.source_date, 'source_date');
  const age = dayNumber(article.date) - dayNumber(article.source_date);
  if (age < 0 || age > 3) fail(`source_date must be within 0-3 days before article date; got ${article.source_date}`);
  if (!/[\u3400-\u9fff]/.test(article.title_cn)) fail('title_cn must contain Chinese');
  if (!Number.isFinite(Number(article.minutes)) || Number(article.minutes) < 1 || Number(article.minutes) > 15) fail('minutes must be a reasonable positive number');
  const words = String(article.text).trim().split(/\s+/).filter(Boolean).length;
  if (words < 160 || words > 220) fail(`Indonesian text must be 160-220 words; got ${words}`);
  if (!Array.isArray(article.hints) || article.hints.length < 8 || article.hints.length > 15) fail('hints must contain 8-15 items');
  for (const [i, hint] of article.hints.entries()) {
    if (!hint || typeof hint !== 'object' || !String(hint.term || '').trim() || !String(hint.cn || '').trim()) {
      fail(`hint ${i + 1} must contain non-empty term and cn`);
    }
  }
  return { words };
}

function parseBase(repo, baseSha) {
  const baseDataSrc = gitShow(repo, baseSha, DATA_PATH);
  const baseIndexSrc = gitShow(repo, baseSha, INDEX_PATH);
  if (baseDataSrc == null) fail(`base is missing ${DATA_PATH}`);
  if (baseIndexSrc == null) fail(`base is missing ${INDEX_PATH}`);
  const db = parseWindowAssignment(baseDataSrc, 'EXTENSIVE_READING_DB', `base:${DATA_PATH}`);
  const index = parseWindowAssignment(baseIndexSrc, 'EXTENSIVE_READING_HISTORY_INDEX', `base:${INDEX_PATH}`);
  if (!Array.isArray(db) || db.length !== 1) fail(`base ${DATA_PATH} must contain exactly one article`);
  if (!Array.isArray(index)) fail(`base ${INDEX_PATH} must be an array`);
  return { oldArticle: db[0], baseIndex: index, baseIndexSrc };
}

function ensureIndexUnique(index, label) {
  const seen = new Set();
  for (const item of index) {
    if (!item || !String(item.id || '').trim()) fail(`${label} has an item without id`);
    if (seen.has(item.id)) fail(`${label} has duplicate id ${item.id}`);
    seen.add(item.id);
  }
}

function chooseArchivePath(repo, baseSha, oldArticle) {
  const direct = `${HISTORY_DIR}/${oldArticle.date}.js`;
  const directSrc = gitShow(repo, baseSha, direct);
  if (directSrc == null) return direct;
  const directItem = parseWindowAssignment(directSrc, 'EXTENSIVE_READING_ARCHIVE_ITEM', `base:${direct}`);
  if (directItem && directItem.id === oldArticle.id) return direct;
  const rawSuffix = String(oldArticle.id).replace(new RegExp(`^er-${oldArticle.date.replace(/-/g, '')}-?`), '');
  const suffix = rawSuffix.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'archive';
  let candidate = `${HISTORY_DIR}/${oldArticle.date}-${suffix}.js`;
  const existing = gitShow(repo, baseSha, candidate);
  if (existing == null) return candidate;
  const existingItem = parseWindowAssignment(existing, 'EXTENSIVE_READING_ARCHIVE_ITEM', `base:${candidate}`);
  if (existingItem && existingItem.id === oldArticle.id) return candidate;
  const short = crypto.createHash('sha1').update(oldArticle.id).digest('hex').slice(0, 8);
  return `${HISTORY_DIR}/${oldArticle.date}-${suffix}-${short}.js`;
}

function appendIndexSource(baseSource, meta) {
  const marker = 'window.EXTENSIVE_READING_HISTORY_INDEX=[';
  if (!baseSource.startsWith(marker)) fail(`${INDEX_PATH} has unexpected assignment format`);
  return `${marker}\n${JSON.stringify(meta)},${baseSource.slice(marker.length)}`;
}

function expectedMeta(oldArticle, archivePath) {
  return {
    id: oldArticle.id,
    date: oldArticle.date,
    title: oldArticle.title,
    title_cn: oldArticle.title_cn,
    path: archivePath,
  };
}

function prepare(repo, baseSha, expectedDate, candidatePath = CANDIDATE_PATH) {
  const fullCandidate = path.join(repo, candidatePath);
  if (!fs.existsSync(fullCandidate)) fail(`missing candidate file ${candidatePath}`);
  let article;
  try { article = JSON.parse(fs.readFileSync(fullCandidate, 'utf8')); }
  catch (error) { fail(`candidate JSON cannot be parsed: ${error.message}`); }
  const articleStats = validateArticle(article, expectedDate);
  const { oldArticle, baseIndex, baseIndexSrc } = parseBase(repo, baseSha);
  ensureIndexUnique(baseIndex, 'base history index');
  if (!oldArticle || !oldArticle.id || !oldArticle.date) fail('base current article is malformed');
  if (oldArticle.id === article.id) fail('new article id must differ from base current article id');
  if (baseIndex.some(x => x.id === article.id)) fail('new article id already exists in history index');

  let archivePath = null;
  let finalIndexSrc = baseIndexSrc.endsWith('\n') ? baseIndexSrc : `${baseIndexSrc}\n`;
  const alreadyArchived = baseIndex.find(x => x.id === oldArticle.id);
  if (!alreadyArchived) {
    archivePath = chooseArchivePath(repo, baseSha, oldArticle);
    const archiveSource = `window.EXTENSIVE_READING_ARCHIVE_ITEM=${JSON.stringify(oldArticle)};\n`;
    writeFile(repo, archivePath, archiveSource);
    finalIndexSrc = appendIndexSource(finalIndexSrc, expectedMeta(oldArticle, archivePath));
  } else {
    archivePath = alreadyArchived.path;
    if (!archivePath || !String(archivePath).startsWith(`${HISTORY_DIR}/`)) fail(`existing history item ${oldArticle.id} has invalid path`);
    const archivedSrc = gitShow(repo, baseSha, archivePath);
    if (archivedSrc == null) fail(`existing history index points to missing archive ${archivePath}`);
    const archived = parseWindowAssignment(archivedSrc, 'EXTENSIVE_READING_ARCHIVE_ITEM', `base:${archivePath}`);
    if (!sameValue(archived, oldArticle)) fail(`existing archive ${archivePath} does not exactly match current base article`);
  }

  writeFile(repo, INDEX_PATH, finalIndexSrc);
  writeFile(repo, DATA_PATH, `window.EXTENSIVE_READING_DB=${JSON.stringify([article])};\n`);
  fs.rmSync(fullCandidate, { force: true });

  console.log(JSON.stringify({ status: 'prepared', date: expectedDate, words: articleStats.words, archive_path: archivePath, article_id: article.id }));
}

function validateFinal(repo, baseSha, expectedDate) {
  const { oldArticle, baseIndex } = parseBase(repo, baseSha);
  ensureIndexUnique(baseIndex, 'base history index');
  const currentDataSrc = readFile(repo, DATA_PATH);
  const currentIndexSrc = readFile(repo, INDEX_PATH);
  const currentDb = parseWindowAssignment(currentDataSrc, 'EXTENSIVE_READING_DB', `head:${DATA_PATH}`);
  const currentIndex = parseWindowAssignment(currentIndexSrc, 'EXTENSIVE_READING_HISTORY_INDEX', `head:${INDEX_PATH}`);
  if (!Array.isArray(currentDb) || currentDb.length !== 1) fail(`head ${DATA_PATH} must contain exactly one article`);
  const currentArticle = currentDb[0];
  validateArticle(currentArticle, expectedDate);
  if (!Array.isArray(currentIndex)) fail(`head ${INDEX_PATH} must be an array`);
  ensureIndexUnique(currentIndex, 'head history index');
  if (currentIndex.some(x => x.id === currentArticle.id)) fail('current article must not already be in history index');

  const headById = new Map(currentIndex.map(x => [x.id, x]));
  for (const baseItem of baseIndex) {
    const headItem = headById.get(baseItem.id);
    if (!headItem) fail(`history index deleted old item ${baseItem.id}`);
    if (!sameValue(headItem, baseItem)) fail(`history index changed existing item ${baseItem.id}`);
  }

  const baseOldIndexItem = baseIndex.find(x => x.id === oldArticle.id);
  const headOldIndexItem = headById.get(oldArticle.id);
  if (!headOldIndexItem) fail(`old current article ${oldArticle.id} was not archived in history index`);
  const archivePath = headOldIndexItem.path;
  if (!archivePath || !String(archivePath).startsWith(`${HISTORY_DIR}/`)) fail('archive path is invalid');
  const archiveFull = path.join(repo, archivePath);
  if (!fs.existsSync(archiveFull)) fail(`archive file missing: ${archivePath}`);
  const archive = parseWindowAssignment(fs.readFileSync(archiveFull, 'utf8'), 'EXTENSIVE_READING_ARCHIVE_ITEM', `head:${archivePath}`);
  if (!sameValue(archive, oldArticle)) fail(`archive ${archivePath} does not exactly match old current article`);
  if (baseOldIndexItem && !sameValue(baseOldIndexItem, headOldIndexItem)) fail(`existing archive metadata changed for ${oldArticle.id}`);

  const changed = runGit(repo, ['diff', '--name-only', baseSha, 'HEAD']).split('\n').filter(Boolean);
  const allowedFixed = new Set([DATA_PATH, INDEX_PATH]);
  const archives = changed.filter(p => p.startsWith(`${HISTORY_DIR}/`));
  const unexpected = changed.filter(p => !allowedFixed.has(p) && !p.startsWith(`${HISTORY_DIR}/`));
  if (unexpected.length) fail(`unexpected changed paths: ${unexpected.join(', ')}`);
  if (!changed.includes(DATA_PATH)) fail(`${DATA_PATH} must change`);
  if (archives.length > 1) fail(`at most one archive file may change; got ${archives.join(', ')}`);
  if (fs.existsSync(path.join(repo, CANDIDATE_PATH))) fail(`${CANDIDATE_PATH} must be removed before merge`);

  console.log(JSON.stringify({ status: 'validated', date: expectedDate, article_id: currentArticle.id, archive_path: archivePath, changed_paths: changed }));
}

function usage() {
  console.error('Usage: publish-extensive-reading-candidate.js prepare|validate --repo <path> --base <sha> --date <YYYY-MM-DD> [--candidate <path>]');
  process.exit(2);
}

function parseArgs(argv) {
  const [mode, ...rest] = argv;
  if (!['prepare', 'validate'].includes(mode)) usage();
  const opts = {};
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i];
    const value = rest[i + 1];
    if (!key || !key.startsWith('--') || value == null) usage();
    opts[key.slice(2)] = value;
  }
  if (!opts.repo || !opts.base || !opts.date) usage();
  validateDate(opts.date, 'date');
  return { mode, opts };
}

const { mode, opts } = parseArgs(process.argv.slice(2));
if (mode === 'prepare') prepare(opts.repo, opts.base, opts.date, opts.candidate || CANDIDATE_PATH);
else validateFinal(opts.repo, opts.base, opts.date);
