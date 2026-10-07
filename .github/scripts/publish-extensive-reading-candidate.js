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

class ReleaseError extends Error {}
function fail(message) {
  throw new ReleaseError(message);
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
  // Optional (2026-10-08+): a short colloquial dialogue about the story, shown after the article.
  const lines = [];
  if (article.dialogue !== undefined) {
    const d = article.dialogue;
    if (!d || typeof d !== 'object' || Array.isArray(d) || !Array.isArray(d.lines)) fail('dialogue must be {title?, lines:[{speaker,text,cn}]}');
    if (d.lines.length < 4 || d.lines.length > 8) fail('dialogue must have 4-8 lines');
    for (const [i, l] of d.lines.entries()) {
      if (!l || typeof l !== 'object' || !String(l.speaker || '').trim() || !String(l.text || '').trim() || !String(l.cn || '').trim()) {
        fail(`dialogue line ${i + 1} must contain non-empty speaker, text and cn`);
      }
      if (String(l.text).trim().split(/\s+/).length > 30) fail(`dialogue line ${i + 1} is longer than 30 words`);
      lines.push(String(l.text));
    }
  }
  const searchable = [String(article.text), ...lines].join('\n').toLowerCase();
  if (!Array.isArray(article.hints) || article.hints.length < 8 || article.hints.length > 15) fail('hints must contain 8-15 items');
  for (const [i, hint] of article.hints.entries()) {
    if (!hint || typeof hint !== 'object' || !String(hint.term || '').trim() || !String(hint.cn || '').trim()) {
      fail(`hint ${i + 1} must contain non-empty term and cn`);
    }
    // The page highlights a hint by finding its exact term in the text; a term that is not there is silently lost.
    if (!searchable.includes(String(hint.term).trim().toLowerCase())) fail(`hint ${i + 1} term "${hint.term}" does not appear verbatim in the text or dialogue`);
  }
  // Optional (2026-10-08+): learned-but-not-mastered words deliberately re-used in this reading (passive recurrence).
  if (article.review_words !== undefined) {
    if (!Array.isArray(article.review_words) || article.review_words.length < 1 || article.review_words.length > 20) fail('review_words must contain 1-20 items');
    const seen = new Set();
    for (const [i, r] of article.review_words.entries()) {
      const w = String(r && r.word || '').trim().toLowerCase();
      if (!w || !String(r.cn || '').trim()) fail(`review word ${i + 1} must contain non-empty word and cn`);
      if (seen.has(w)) fail(`review word "${w}" is listed twice`);
      seen.add(w);
      if (!reviewWordRegex(w).test(searchable)) fail(`review word "${w}" does not appear in the text or dialogue`);
    }
  }
  return { words, dialogue_lines: lines.length, review_words: (article.review_words || []).length };
}

function reviewWordRegex(w) {
  const e = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z])${e}(-?(nya|lah|kah|pun|ku|mu))?([^a-z]|$)`, 'i');
}

function failIfAlreadyPublished(oldArticle, expectedDate) {
  // One reading per day. A second release for a date that already has its article would archive and replace it.
  if (oldArticle && oldArticle.date === expectedDate) fail(`a reading for ${expectedDate} is already published (${oldArticle.id}); do not publish a second one`);
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
  failIfAlreadyPublished(oldArticle, expectedDate);
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
  failIfAlreadyPublished(oldArticle, expectedDate);
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

/**
 * Local pre-PR check for the generator (never used by the release job): the same structural validation, plus
 * "already published today" against the working tree and a review-word coverage report against learning-runtime.json.
 * Coverage targets are reported as warnings; review words outside the learned-not-mastered pools are errors.
 */
function check(repo, expectedDate, candidatePath) {
  let article;
  try { article = JSON.parse(fs.readFileSync(path.resolve(repo, candidatePath), 'utf8')); }
  catch (error) { fail(`candidate JSON cannot be parsed: ${error.message}`); }
  const stats = validateArticle(article, expectedDate);
  const current = parseWindowAssignment(readFile(repo, DATA_PATH), 'EXTENSIVE_READING_DB', DATA_PATH);
  if (Array.isArray(current) && current[0]) failIfAlreadyPublished(current[0], expectedDate);
  const runtime = JSON.parse(readFile(repo, 'data/learning-runtime.json'));
  const name = v => String(Array.isArray(v) ? v[0] : (v && v.word) || v || '').trim().toLowerCase();
  const focus = new Set((runtime.focus_pool || []).map(name));
  const review = new Set((runtime.review_pool || []).map(name));
  const recurrence = new Set((runtime.recurrence_pool || []).map(name));
  const tiers = { focus: [], review: [], recurrence: [] };
  const errors = [], warnings = [];
  for (const r of article.review_words || []) {
    const w = String(r.word).trim().toLowerCase();
    if (focus.has(w)) tiers.focus.push(w);
    else if (review.has(w)) tiers.review.push(w);
    else if (recurrence.has(w)) tiers.recurrence.push(w);
    else errors.push(`review word "${w}" is not a learned-but-not-mastered word (not in focus_pool, review_pool or recurrence_pool)`);
  }
  const n = (article.review_words || []).length;
  if (n < 8) warnings.push(`only ${n} review words (target 8-12)`);
  if (n > 12) warnings.push(`${n} review words (target 8-12; make sure the text still reads naturally)`);
  if (tiers.focus.length < 3) warnings.push(`only ${tiers.focus.length} focus_pool words (target at least 3)`);
  if (!article.dialogue) warnings.push('no dialogue (target: 4-6 colloquial lines about the story)');
  const report = { status: errors.length ? 'error' : 'ok', date: expectedDate, words: stats.words, dialogue_lines: stats.dialogue_lines,
    review_words: n, by_tier: tiers, errors, warnings };
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exitCode = 1;
  return report;
}

function usage() {
  console.error('Usage: publish-extensive-reading-candidate.js prepare|validate --repo <path> --base <sha> --date <YYYY-MM-DD> [--candidate <path>]\n' +
    '       publish-extensive-reading-candidate.js check --candidate <path> --date <YYYY-MM-DD> [--repo <path>]');
  process.exit(2);
}

function parseArgs(argv) {
  const [mode, ...rest] = argv;
  if (!['prepare', 'validate', 'check'].includes(mode)) usage();
  const opts = {};
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i];
    const value = rest[i + 1];
    if (!key || !key.startsWith('--') || value == null) usage();
    opts[key.slice(2)] = value;
  }
  if (mode === 'check') { if (!opts.candidate || !opts.date) usage(); opts.repo = opts.repo || '.'; }
  else if (!opts.repo || !opts.base || !opts.date) usage();
  validateDate(opts.date, 'date');
  return { mode, opts };
}

if (require.main === module) {
  try {
    const { mode, opts } = parseArgs(process.argv.slice(2));
    if (mode === 'prepare') prepare(opts.repo, opts.base, opts.date, opts.candidate || CANDIDATE_PATH);
    else if (mode === 'check') check(opts.repo, opts.date, opts.candidate);
    else validateFinal(opts.repo, opts.base, opts.date);
  } catch (error) {
    if (!(error instanceof ReleaseError)) throw error;
    console.error(`EXTENSIVE_READING_RELEASE_ERROR: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { validateArticle, check, ReleaseError };
