const { isDate, jakartaTime } = require('../../utils/date');
const data = require('../../utils/data');
const { buildLesson } = require('./content');

Page({
  data: {
    date: '', sessionLabel: '', model: null, status: '', issue: '', busy: false,
    translations: {}, details: {}, answers: {}, choices: {}, website: ''
  },

  onLoad(options) {
    const { date, session } = options;
    if (!isDate(date) || (session !== 'am' && session !== 'pm')) {
      this.setData({ issue: '课程地址无效。' });
      return;
    }
    this.course = { date, session };
    this.setData({
      date,
      sessionLabel: session === 'am' ? '早课' : '晚课',
      website: data.lessonUrl(date, session)
    });
    this.load();
  },

  async onPullDownRefresh() {
    try {
      if (this.course) await this.load();
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  async load() {
    const { date, session } = this.course;
    const token = {};
    this.loadToken = token;
    const snapshot = data.cacheSnapshot();
    const cachedIndex = snapshot[data.INDEX];
    const cached = cachedIndex && data.isPublished(cachedIndex.data, date, session) ?
      snapshot[data.lessonKey(date, session)] : null;
    const morningKey = session === 'pm' ? data.lessonKey(date, 'am') : '';
    if (cached) this.showLesson(cached, snapshot[morningKey]);
    this.setData({ issue: '', busy: true });

    try {
      const index = await data.fetchIndex();
      if (token !== this.loadToken) return;
      if (!data.isPublished(index.data, date, session)) {
        this.currentLesson = '';
        this.setData({ model: null, issue: '尚未发布', status: '', busy: false });
        return;
      }
      const entry = await data.fetchLesson(date, session);
      if (token !== this.loadToken) return;
      this.showLesson(entry, morningKey ? data.cacheSnapshot()[morningKey] : null);
      this.setData({ busy: false });
    } catch (error) {
      if (token !== this.loadToken) return;
      this.setData({
        busy: false,
        status: this.data.model ? '离线，显示的是缓存' : '',
        issue: this.data.model ? '' : '课程加载失败：' + error.message + '。请下拉重试。'
      });
    }
  },

  showLesson(entry, morning) {
    const status = '内容更新于 ' + jakartaTime(entry.updatedAt);
    const morningLesson = morning && morning.data;
    const signature = JSON.stringify([entry.data, morningLesson]);
    if (signature === this.currentLesson) {
      this.setData({ status });
      return;
    }
    this.currentLesson = signature;
    this.setData({
      model: buildLesson(entry.data, this.course.session, morningLesson),
      status,
      translations: {},
      details: {},
      answers: {},
      choices: {}
    });
  },

  toggleTranslation(event) {
    const key = event.currentTarget.dataset.key;
    this.setData({ ['translations.' + key]: !this.data.translations[key] });
  },

  toggleDetails(event) {
    const key = event.currentTarget.dataset.key;
    this.setData({ ['details.' + key]: !this.data.details[key] });
  },

  toggleAnswer(event) {
    const key = event.currentTarget.dataset.key;
    this.setData({ ['answers.' + key]: !this.data.answers[key] });
  },

  selectChoice(event) {
    const { key, index } = event.currentTarget.dataset;
    this.setData({ ['choices.' + key]: Number(index) + 1 });
  },

  copyWebsite() {
    wx.setClipboardData({ data: this.data.website });
  }
});
