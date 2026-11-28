const data = require('./data');
const { segments } = require('./segments');
const { splitTitle } = require('./cards');
const { read, write } = require('./storage');

const progressKey = (date, session) => 'mini_v11:progress:' + date + '-' + session;
const progress = (date, session) => read(progressKey(date, session), {});
const courses = new Map();
const courseKey = (date, session) => date + '-' + session;

function saveProgress(date, session, key, cursor, done, retry = []) {
  const state = progress(date, session);
  state[key] = { cursor: done ? 0 : cursor, done: done || Boolean(state[key] && state[key].done), retry: done ? [] : retry };
  write(progressKey(date, session), state, 2048);
}

function cachedIndex() {
  const entry = data.currentIndexEntry();
  return entry && entry.data;
}

function cachedLesson(date, session) {
  const entry = data.cacheSnapshot()[data.lessonKey(date, session)];
  return entry && entry.data;
}

async function load(date, session, refresh = false) {
  const key = courseKey(date, session);
  const cached = courses.get(key) || cachedLesson(date, session);
  if (cached && !refresh) return cached;
  try {
    const result = await data.fetchLesson(date, session);
    courses.set(key, result.data);
    if (courses.size > 28) courses.delete(courses.keys().next().value);
    return result.data;
  } catch (error) {
    if (cached) return cached;
    throw error;
  }
}

function courseView(date, session, lesson, morning, published) {
  const title = lesson ? splitTitle(lesson.title) : {};
  const sections = lesson ? segments(lesson, morning) : [];
  const state = progress(date, session);
  let hasCurrent = false;
  const rows = sections.map(({ key, name, count, details, minutes }, i) => {
    const done = Boolean(state[key] && state[key].done);
    const current = !done && !hasCurrent;
    if (current) hasCurrent = true;
    return { key, name, count, details, minutes, done, current, number: i + 1 };
  });
  const completed = rows.filter(row => row.done).length;
  const label = session === 'am' ? '早课' : '晚课';
  return {
    date, session, label, time: lesson && lesson.time || (session === 'am' ? '08:00' : date < '2026-09-16' ? '19:00' : '18:00'),
    title, series: lesson && lesson.story ? splitTitle(lesson.story.series).cn : '', episode: lesson && lesson.story && lesson.story.episode || 0,
    rows, completed, published, available: Boolean(lesson), percent: rows.length ? completed / rows.length * 100 : 0
  };
}

function openLesson(date, session) {
  wx.navigateTo({ url: '/pages/lesson/index?date=' + date + '&session=' + session });
}

function openSegment(date, session, key) {
  wx.navigateTo({ url: '/pages/deck/index?date=' + date + '&session=' + session + '&segment=' + key });
}

module.exports = { progress, saveProgress, cachedIndex, cachedLesson, load, courseView, openLesson, openSegment };
