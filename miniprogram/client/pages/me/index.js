const { jakartaDate, shiftDate } = require('../../utils/date');
const { fetchIndex, fetchJson, isPublished } = require('../../utils/data');
const { websiteRoot } = require('../../utils/config');
const courses = require('../../utils/course');
const reading = require('../../utils/reading');
const { read, write } = require('../../utils/storage');

const STATS = 'mini_v11:stats';
const labels = ['日', '一', '二', '三', '四', '五', '六'];

function monthShift(month, offset) {
  const when = new Date(month + '-01T00:00:00Z');
  when.setUTCMonth(when.getUTCMonth() + offset);
  return when.toISOString().slice(0, 7);
}

function calendar(month, today, index) {
  const first = month + '-01';
  const offset = new Date(first + 'T00:00:00Z').getUTCDay();
  const next = monthShift(month, 1) + '-01';
  const byDate = new Map((index && index.dates || []).map(row => [row.date, row]));
  const days = Array.from({ length: offset }, (_, i) => ({ key: 'empty-' + i }));
  for (let date = first; date < next; date = shiftDate(date, 1)) {
    const row = byDate.get(date);
    days.push({ key: date, date, day: Number(date.slice(8)), today: date === today,
      am: row && row.am === true, pm: row && row.pm === true });
  }
  return days;
}

Page({
  data: { labels, month: '', label: '', days: [], selected: '', selectedAm: false, selectedPm: false,
    backMonth: false, nextMonth: false, totalDays: 0, stats: null, readingCount: 0, version: '1.1.0',
    course: null, courseBusy: false },

  onLoad() {
    this.today = jakartaDate();
    this.month = this.today.slice(0, 7);
    this.index = courses.cachedIndex();
    this.selected = this.today;
    this.setData({ stats: read(STATS, {}).result || null, readingCount: reading.cache().history.length });
  },

  onShow() {
    const now = jakartaDate();
    if (this.today !== now) {
      if (this.selected === this.today) this.selected = now;
      if (this.month === this.today.slice(0, 7)) this.month = now.slice(0, 7);
      this.today = now;
    }
    this.render();
    if (this.active) this.openCourse(this.active.date, this.active.session);
    this.refresh();
  },

  async refresh() {
    const tasks = [
      fetchIndex().then(entry => { this.index = entry.data; this.render(); }),
      reading.history().then(rows => { this.setData({ readingCount: rows.length }); }),
      this.readStats()
    ];
    await Promise.allSettled(tasks);
  },

  async readStats() {
    const saved = read(STATS, {});
    const today = this.today;
    if (saved.attempt === today || this.statsAttempt === today) return;
    this.statsAttempt = today;
    write(STATS, { ...saved, attempt: today }, 2048);
    const snapshot = await fetchJson(websiteRoot + 'data/weakness-sync.json', data =>
      data && data.words && typeof data.words === 'object' && !Array.isArray(data.words));
    const result = { mastered: 0, active: 0, date: String(snapshot.updated_at || '').slice(0, 10) || today };
    for (const record of Object.values(snapshot.words)) {
      if (record && (record.status === 'mastered' || record.status === 'active')) result[record.status]++;
    }
    write(STATS, { attempt: today, result }, 2048);
    this.setData({ stats: result });
  },

  render() {
    const rows = (this.index && this.index.dates || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const newest = [...rows].reverse().find(row => row.am || row.pm);
    const selected = this.selected;
    const firstMonth = rows.length ? rows[0].date.slice(0, 7) : this.today.slice(0, 7);
    const latestMonth = this.today.slice(0, 7);
    if (this.month < firstMonth) this.month = firstMonth;
    this.setData({
      month: this.month, label: this.month.slice(0, 4) + '年' + Number(this.month.slice(5)) + '月',
      days: calendar(this.month, this.today, this.index), selected,
      selectedAm: isPublished(this.index, selected, 'am'), selectedPm: isPublished(this.index, selected, 'pm'),
      backMonth: this.month > firstMonth, nextMonth: this.month < latestMonth,
      totalDays: newest && (newest.day || newest.am_day || newest.pm_day) || 0
    });
  },

  changeMonth(event) {
    const delta = Number(event.currentTarget.dataset.delta);
    if (delta < 0 ? !this.data.backMonth : !this.data.nextMonth) return;
    this.month = monthShift(this.month, delta);
    this.selected = '';
    this.closeCourse();
    this.render();
  },
  selectDay(event) {
    this.selected = event.currentTarget.dataset.date;
    this.closeCourse();
    this.render();
  },
  pickCourse(event) { this.openCourse(this.selected, event.currentTarget.dataset.session); },

  async openCourse(date, session) {
    if (!isPublished(this.index, date, session)) return;
    const token = { date, session };
    this.active = token;
    const cached = courses.cachedLesson(date, session);
    const morning = courses.cachedLesson(date, 'am');
    this.setData({ course: courses.courseView(date, session, cached, morning, true), courseBusy: !cached });
    try {
      const [lesson, am] = await Promise.all([courses.load(date, session), session === 'pm' ?
        courses.load(date, 'am').catch(() => null) : Promise.resolve(null)]);
      if (this.active === token) this.setData({ course: courses.courseView(date, session, lesson, am, true) });
    } catch (_) {
      // Keep the published course link visible if its body could not be read.
    } finally {
      if (this.active === token) this.setData({ courseBusy: false });
    }
  },

  closeCourse() { this.active = null; this.setData({ course: null, courseBusy: false }); },
  openSegment(event) {
    const { date, session, key } = event.currentTarget.dataset;
    courses.openSegment(date, session, key);
  },
  openLesson(event) {
    const { date, session } = event.currentTarget.dataset;
    courses.openLesson(date, session);
  },
  stars() {
    getApp().globalData.showStars = true;
    wx.switchTab({ url: '/pages/phrases/index' });
  }
});
