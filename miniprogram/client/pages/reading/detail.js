const reading = require('../../utils/reading');

Page({
  data: { article: null, showCn: false, offline: false, busy: true },
  onLoad({ id, path }) {
    if (!id || !reading.validFile(path)) { this.setData({ busy: false }); return; }
    this.address = { id, path };
    const entry = reading.cache().items[id];
    if (entry) this.setData({ article: reading.toDetail(entry.item) });
    this.refresh();
  },
  async refresh() {
    if (!this.address) return;
    const { id, path } = this.address;
    try {
      let item;
      try { item = await reading.getItem(path, id); }
      catch (error) {
        const index = await reading.history().catch(() => reading.cache().history);
        const archived = index.find(row => row.id === id && row.path !== path);
        if (!archived) throw error;
        item = await reading.getItem(archived.path, id);
      }
      this.setData({ article: reading.toDetail(item), offline: false });
    } catch (_) { this.setData({ offline: true }); }
    finally { this.setData({ busy: false }); }
  },
  async onPullDownRefresh() {
    try { await this.refresh(); } finally { wx.stopPullDownRefresh(); }
  },
  toggle() { this.setData({ showCn: !this.data.showCn }); }
});
