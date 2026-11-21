const { jakartaDate, jakartaTime, shiftDate, isDate } = require('../../utils/date');
const data = require('../../utils/data');

const sessions = [{ id: 'am', label: '早课' }, { id: 'pm', label: '晚课' }];

function courseSlots(date, index, lessons) {
  return sessions.map(session => {
    const key = data.lessonKey(date, session.id);
    const published = data.isPublished(index, date, session.id);
    const lesson = published && lessons[key] && lessons[key].data;
    return {
      key, date, session: session.id, label: session.label, published,
      url: '/pages/lesson/index?date=' + date + '&session=' + session.id,
      time: lesson ? lesson.time || '' : '',
      title: lesson ? lesson.title || '' : ''
    };
  });
}

function recentCourses(today, index, lessons) {
  if (!index) return [];
  const start = shiftDate(today, -7);
  return [...new Set(index.dates.filter(row => row && isDate(row.date) &&
    row.date >= start && row.date < today).map(row => row.date))]
    .sort().reverse()
    .reduce((courses, date) => courses.concat(courseSlots(date, index, lessons)
      .filter(slot => slot.published)), []);
}

Page({
  data: {
    today: '', current: [], recent: [], status: '', issue: '',
    hasIndex: false, busy: false
  },

  onShow() {
    this.load();
  },

  async onPullDownRefresh() {
    try {
      await this.load();
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  async load() {
    const token = {};
    this.loadToken = token;
    const today = jakartaDate();
    const lessons = data.cacheSnapshot();
    let indexEntry = lessons[data.INDEX];
    this.renderCourses(today, indexEntry, lessons, {
      busy: true, issue: '', status: indexEntry ? '内容更新于 ' + jakartaTime(indexEntry.updatedAt) : '正在读取课程…'
    });

    try {
      indexEntry = await data.fetchIndex();
      if (this.loadToken !== token) return;
      this.renderCourses(today, indexEntry, lessons, { status: '内容更新于 ' + jakartaTime(indexEntry.updatedAt) });

      const queue = courseSlots(today, indexEntry.data, lessons).filter(slot => slot.published)
        .concat(recentCourses(today, indexEntry.data, lessons));
      let hadCachedFailure = false;
      let hadMissingFailure = false;
      const fetchNext = async () => {
        while (queue.length && this.loadToken === token) {
          const slot = queue.shift();
          try {
            const lesson = await data.fetchLesson(slot.date, slot.session);
            if (this.loadToken !== token) return;
            lessons[slot.key] = lesson;
            this.renderCourses(today, indexEntry, lessons);
          } catch (error) {
            if (lessons[slot.key]) hadCachedFailure = true;
            else hadMissingFailure = true;
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(6, queue.length) }, fetchNext));
      if (this.loadToken !== token) return;
      this.setData({
        busy: false,
        status: hadCachedFailure ? '离线，显示的是缓存' : '内容更新于 ' + jakartaTime(indexEntry.updatedAt),
        issue: hadMissingFailure ? '部分课程详情加载失败。可点开重试，或下拉刷新。' : ''
      });
    } catch (error) {
      if (this.loadToken !== token) return;
      this.setData({
        busy: false,
        status: indexEntry ? '离线，显示的是缓存' : '',
        issue: indexEntry ? '' : '课程列表加载失败：' + error.message + '。请下拉重试。'
      });
    }
  },

  renderCourses(today, indexEntry, lessons, state) {
    const index = indexEntry ? indexEntry.data : null;
    this.setData(Object.assign({
      today, hasIndex: !!index, current: courseSlots(today, index, lessons),
      recent: recentCourses(today, index, lessons)
    }, state));
  }
});
