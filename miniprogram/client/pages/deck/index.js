const { jakartaDate, isDate } = require('../../utils/date');
const { isPublished } = require('../../utils/data');
const courses = require('../../utils/course');
const { segments } = require('../../utils/segments');
const srs = require('../../utils/srs');

const scores = [
  { key: 'forgot', label: '忘了', storyLabel: '没看懂' },
  { key: 'fuzzy', label: '模糊', storyLabel: '大概懂' },
  { key: 'remembered', label: '记得', storyLabel: '看懂了' }
];

Page({
  data: {
    card: null, next: null, scores, seen: false, pick: -1, expanded: false,
    number: 0, total: 0, percent: 0, busy: true, finished: false, error: '', moving: false,
    counts: { forgot: 0, fuzzy: 0, remembered: 0 }
  },

  onLoad(options) {
    this.options = options;
    this.load();
  },

  onUnload() { clearTimeout(this.timer); },

  async load() {
    const { date, session, segment } = this.options;
    this.course = isDate(date) && ['am', 'pm'].includes(session) && segment ? { date, session, segment } : null;
    this.today = jakartaDate();
    this.counts = { forgot: 0, fuzzy: 0, remembered: 0 };
    this.repeated = new Set();
    const title = !this.course ? '复习' : session === 'am' ? '早课' : '晚课';
    wx.setNavigationBarTitle({ title: '刷卡 · ' + title });
    this.setData({ busy: true, finished: false, card: null, error: '', counts: this.counts });

    try {
      if (this.course) {
        const morning = session === 'pm' ? await courses.load(date, 'am').catch(() => null) : null;
        const lesson = await courses.load(date, session);
        const section = segments(lesson, morning).find(group => group.key === segment);
        this.queue = section ? section.cards.slice() : [];
        const progress = courses.progress(date, session)[segment];
        const original = this.queue.slice();
        const retry = progress && !progress.done ? progress.retry || [] : [];
        this.retryIndices = retry.filter(index => original[index]);
        this.retryIndices.forEach(index => {
          const card = original[index];
          this.queue.push(card);
          this.repeated.add(card.id);
        });
        this.cursor = progress && !progress.done ? Math.min(progress.cursor, Math.max(0, this.queue.length - 1)) : 0;
      } else {
        const index = courses.cachedIndex();
        const lessons = await Promise.all(['am', 'pm'].map(part => isPublished(index, this.today, part) ?
          courses.load(this.today, part).catch(() => null) : null));
        const candidates = lessons.filter(Boolean).flatMap(lesson => segments(lesson, lessons[0]).flatMap(group => group.cards));
        this.queue = srs.reviewGroup(candidates, this.today);
        this.cursor = 0;
        this.retryIndices = [];
      }
      this.setData({ busy: false });
      if (this.queue.length) this.show();
      else this.setData({ error: '这组暂时没有卡片。' });
    } catch (_) {
      this.setData({ busy: false, error: '这组卡片暂未读到，联网后可重试。' });
    }
  },

  show() {
    this.setData({
      card: this.queue[this.cursor], next: this.queue[this.cursor + 1] || null,
      number: this.cursor + 1, total: this.queue.length, percent: (this.cursor + 1) * 100 / this.queue.length,
      seen: false, pick: -1, expanded: false, moving: false
    });
  },

  flip() { if (!this.data.moving) this.setData({ seen: !this.data.seen }); },
  expand() { this.setData({ expanded: !this.data.expanded }); },
  choose(event) {
    if (this.data.seen || this.data.moving) return;
    this.setData({ pick: Number(event.currentTarget.dataset.index), seen: true });
  },

  rate(event) {
    if (this.data.moving || !this.data.seen) return;
    const rating = event.currentTarget.dataset.rating;
    if (!Object.prototype.hasOwnProperty.call(this.counts, rating)) return;
    const card = this.queue[this.cursor];
    this.counts[rating]++;
    if (srs.eligible(card)) {
      srs.score(card, rating, this.today);
      if (rating === 'forgot' && !this.repeated.has(card.id)) {
        this.repeated.add(card.id);
        this.retryIndices.push(this.cursor);
        this.queue.push(card);
      }
    }
    if (typeof wx.vibrateShort === 'function') wx.vibrateShort({ type: 'light', fail() {} });
    this.setData({ moving: true });
    const target = this.cursor + 1;
    this.save(target);
    this.timer = setTimeout(() => this.advance(target), 120);
  },

  next() {
    if (this.data.moving) return;
    const target = this.cursor + 1;
    this.save(target);
    this.advance(target);
  },

  save(target) {
    if (!this.course) return;
    const { date, session, segment } = this.course;
    courses.saveProgress(date, session, segment, target, target >= this.queue.length, this.retryIndices);
  },

  advance(target) {
    this.cursor = target;
    if (target >= this.queue.length) {
      this.setData({ card: null, next: null, finished: true, counts: this.counts, moving: false });
    } else this.show();
  },

  again() {
    this.options = {};
    this.load();
  },
  close() {
    if (getCurrentPages().length > 1) wx.navigateBack();
    else this.todayPage();
  },
  todayPage() { wx.switchTab({ url: '/pages/today/index' }); }
});
