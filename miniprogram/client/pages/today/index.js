const { jakartaDate } = require('../../utils/date');
const { fetchIndex, isPublished } = require('../../utils/data');
const courses = require('../../utils/course');
const { segments } = require('../../utils/segments');
const { reviewGroup } = require('../../utils/srs');
const reading = require('../../utils/reading');

const dayNames = '日一二三四五六';
const sessions = ['am', 'pm'];

Page({
  data: { titleDate: '', day: '', groupCount: 0, groupMinutes: 0, lessonViews: [], latest: null,
    offline: false, busy: true },

  onLoad() {
    this.date = jakartaDate();
    this.lessons = {};
    this.index = courses.cachedIndex();
  },

  onShow() {
    const date = jakartaDate();
    if (this.date !== date) {
      this.date = date;
      this.lessons = {};
    }
    sessions.forEach(session => {
      if (!this.lessons[session]) this.lessons[session] = courses.cachedLesson(date, session);
    });
    this.render();
    this.refresh();
  },

  async onPullDownRefresh() {
    try { await this.refresh(); } finally { wx.stopPullDownRefresh(); }
  },

  async refresh() {
    const date = this.date;
    const token = {};
    this.refreshToken = token;
    let offline = false;
    const readingTask = reading.latest().catch(() => { offline = true; });
    try { this.index = (await fetchIndex()).data; } catch (_) { offline = true; }
    if (this.refreshToken !== token) return;
    await Promise.all([...sessions.map(async session => {
      if (!isPublished(this.index, date, session)) return;
      try {
        const lesson = await courses.load(date, session, true);
        if (this.refreshToken === token) this.lessons[session] = lesson;
      } catch (_) { offline = true; }
    }), readingTask]);
    if (this.refreshToken !== token) return;
    this.render();
    this.setData({ busy: false, offline });
  },

  render() {
    const date = this.date;
    const row = this.index && this.index.dates.find(item => item.date === date);
    const morning = this.lessons.am;
    const publishedSessions = sessions.filter(session => isPublished(this.index, date, session));
    const candidates = publishedSessions.flatMap(session => this.lessons[session] ?
      segments(this.lessons[session], morning).flatMap(group => group.cards) : []);
    const group = reviewGroup(candidates, date);
    this.setData({
      titleDate: Number(date.slice(5, 7)) + '月' + Number(date.slice(8, 10)) + '日 周' +
        dayNames[new Date(date + 'T00:00:00Z').getUTCDay()],
      day: row && (row.day || row.am_day || row.pm_day) || '',
      groupCount: group.length,
      groupMinutes: Math.max(1, Math.ceil(group.reduce((total, card) => total + card.seconds, 0) / 60)),
      lessonViews: this.index ? sessions.map(session =>
        courses.courseView(date, session, publishedSessions.includes(session) ? this.lessons[session] : null,
          morning, publishedSessions.includes(session))) : [],
      latest: reading.cache().latest[0] || null
    });
  },

  openReview() { wx.navigateTo({ url: '/pages/deck/index' }); },
  openSegment(event) {
    const { date, session, key } = event.currentTarget.dataset;
    courses.openSegment(date, session, key);
  },
  openLesson(event) {
    const { date, session } = event.currentTarget.dataset;
    courses.openLesson(date, session);
  },
  openReading() {
    const { id, path } = this.data.latest;
    wx.navigateTo({ url: '/pages/reading/detail?id=' + encodeURIComponent(id) + '&path=' + encodeURIComponent(path) });
  }
});
