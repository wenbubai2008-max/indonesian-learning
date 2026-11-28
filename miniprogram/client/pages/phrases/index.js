const { fetchIndex, fetchLesson } = require('../../utils/data');
const { cachedIndex, cachedLesson } = require('../../utils/course');
const reading = require('../../utils/reading');
const { collect, dedupe, search } = require('../../utils/phrases');
const { scenes } = require('../../utils/scenes');
const { read, write } = require('../../utils/storage');

const KEY = 'mini_v11:phrases';
const STARS = 'mini_v11:stars';
const PAGE_SIZE = 30;

Page({
  data: { scenes, scene: '全部', query: '', starsOnly: false, visible: [], total: 0, more: false,
    building: false, done: 0, count: 0, message: '' },

  onLoad() {
    this.store = read(KEY, { rows: [], completed: {} });
    this.stars = read(STARS, {});
    this.limit = PAGE_SIZE;
  },

  onShow() {
    const app = getApp();
    if (app.globalData.showStars) {
      app.globalData.showStars = false;
      this.limit = PAGE_SIZE;
      this.setData({ starsOnly: true, scene: '全部', query: '' });
    }
    this.render();
    this.build();
  },

  async onPullDownRefresh() {
    try { await this.build(); } finally { wx.stopPullDownRefresh(); }
  },

  build() {
    if (!this.building) this.building = this.collectMissing().finally(() => {
      this.building = null;
      this.setData({ building: false });
    });
    return this.building;
  },

  async collectMissing() {
    this.setData({ building: true, message: '', done: 0, count: 0 });
    const [indexResult, historyResult, latestResult] = await Promise.allSettled([
      fetchIndex(), reading.history(), reading.latest()
    ]);
    const available = [indexResult, historyResult, latestResult].some(result => result.status === 'fulfilled');
    if (!available) {
      this.setData({ message: '未能更新，显示已整理的句子。' });
      return;
    }
    const jobs = [];
    const index = indexResult.status === 'fulfilled' ? indexResult.value.data : cachedIndex();
    const archives = historyResult.status === 'fulfilled' ? historyResult.value : reading.cache().history;
    const latest = latestResult.status === 'fulfilled' ? latestResult.value : [];
    const latestIds = new Set(latest.map(item => item.id));
    asCourses(index).forEach(({ date, session }) => jobs.push({
      key: date + '-' + session, date, load: async () => {
        const saved = cachedLesson(date, session);
        return { lesson: saved || (await fetchLesson(date, session, false)).data };
      }
    }));
    archives.filter(row => !latestIds.has(row.id)).forEach(row => jobs.push({
      key: row.id, date: row.date, load: async () => ({ reading: await reading.getItem(row.path, row.id, false) })
    }));
    latest.forEach(item => jobs.push({ key: item.id, date: item.date, load: async () => ({ reading: item }) }));
    const missing = jobs.filter(job => !this.store.completed[job.key]).sort((a, b) => b.date.localeCompare(a.date));
    if (!missing.length) return;
    this.setData({ count: missing.length });
    let next = 0;
    let done = 0;
    let failed = 0;
    let pending = [];
    const flush = () => {
      this.store.rows = dedupe(this.store.rows.concat(pending));
      pending = [];
      write(KEY, this.store, 1024 * 1024);
      this.render();
    };
    const worker = async () => {
      while (next < missing.length) {
        const job = missing[next++];
        try {
          pending.push(...collect(await job.load()));
          this.store.completed[job.key] = true;
        } catch (_) { failed++; }
        done++;
        if (done === 1 || done % 8 === 0 || done === missing.length) {
          this.setData({ done });
          flush();
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, missing.length) }, worker));
    if (failed) this.setData({ message: failed + ' 项内容暂未读取，下次会继续整理。' });
  },

  render() {
    const { query, scene, starsOnly } = this.data;
    const rows = search(this.store.rows, query, scene, starsOnly, this.stars);
    this.setData({ total: rows.length, more: rows.length > this.limit, visible: rows.slice(0, this.limit)
      .map(row => ({ ...row, starred: Boolean(this.stars[row.key]) })) });
  },

  onReachBottom() {
    if (!this.data.more) return;
    this.limit += PAGE_SIZE;
    this.render();
  },
  changeQuery(event) { this.filter({ query: event.detail.value }); },
  selectScene(event) { this.filter({ scene: event.currentTarget.dataset.scene }); },
  showStars() { this.filter({ starsOnly: !this.data.starsOnly }); },
  filter(values) {
    this.limit = PAGE_SIZE;
    this.setData(values, () => this.render());
  },
  star(event) {
    const { key } = event.currentTarget.dataset;
    if (this.stars[key]) delete this.stars[key];
    else this.stars[key] = true;
    write(STARS, this.stars, 60 * 1024);
    this.render();
  },
  copy(event) {
    const row = this.data.visible.find(item => item.key === event.currentTarget.dataset.key);
    if (row) wx.setClipboardData({ data: row.id, success: () => wx.showToast({ title: '已复制', icon: 'success' }) });
  }
});

function asCourses(index) {
  return (index && index.dates || []).flatMap(row => ['am', 'pm'].filter(session => row[session] === true)
    .map(session => ({ date: row.date, session })));
}
