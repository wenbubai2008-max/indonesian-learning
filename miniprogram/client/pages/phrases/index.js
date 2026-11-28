const remote = require('../../utils/remote');
const { dedupe, search } = require('../../utils/phrases');
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
    try {
      const rows = await remote.phraseRows();
      this.store.rows = dedupe(rows);
      this.store.syncedAt = new Date().toISOString();
      write(KEY, this.store, 1024 * 1024);
      this.setData({ count: rows.length, done: rows.length });
      this.render();
    } catch (_) {
      this.setData({ message: '未能更新，显示已整理的句子。' });
    }
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
