const reading = require('../../utils/reading');

Page({
  data: { current: [], history: [], offline: false, busy: true, more: false },
  onLoad() { this.limit = 30; this.render(); this.refresh(); },
  async onPullDownRefresh() {
    try { await this.refresh(); } finally { wx.stopPullDownRefresh(); }
  },
  async refresh() {
    const results = await Promise.allSettled([reading.latest(), reading.history()]);
    this.render();
    this.setData({ offline: results.some(result => result.status === 'rejected'), busy: false });
  },
  render() {
    const cache = reading.cache();
    const latest = new Set(cache.latest.map(item => item.id));
    const history = cache.history.filter(item => !latest.has(item.id));
    this.setData({ current: cache.latest, history: history.slice(0, this.limit), more: history.length > this.limit });
  },
  onReachBottom() { if (this.data.more) { this.limit += 30; this.render(); } },
  open(event) {
    const { id, path } = event.currentTarget.dataset;
    wx.navigateTo({ url: '/pages/reading/detail?id=' + encodeURIComponent(id) + '&path=' + encodeURIComponent(path) });
  }
});
