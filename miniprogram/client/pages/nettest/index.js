const CONFIG = require('../../utils/config');
const { jakartaTimestamp } = require('../../utils/date');
const remote = require('../../utils/remote');

const HISTORY_KEY = 'mini_nettest_history_v2';
const TARGETS = [
  { label: 'GitHub Pages', url: 'https://wenbubai2008-max.github.io/indonesian-learning/data/daily/index.json' },
  { label: 'GitHub Raw', url: 'https://raw.githubusercontent.com/wenbubai2008-max/indonesian-learning/main/data/daily/index.json' },
  { label: 'GitHub API', url: 'https://api.github.com/repos/wenbubai2008-max/indonesian-learning/contents/data/daily/index.json' },
  { label: 'GitHub codeload', url: 'https://codeload.github.com/wenbubai2008-max/indonesian-learning/zip/refs/heads/main' }
];

function readHistory() {
  const history = wx.getStorageSync(HISTORY_KEY);
  return Array.isArray(history) ? history.slice(0, 30) : [];
}

function normalize(rows) {
  if (!Array.isArray(rows) || rows.length !== TARGETS.length) throw new Error('云函数返回格式不正确');
  return TARGETS.map(target => {
    const row = rows.find(entry => entry && entry.url === target.url);
    return row ? { ...row, label: target.label, skipped: false } :
      { ...target, ok: false, status: null, ms: null, error: '云函数未返回该地址的结果', skipped: false };
  });
}

function displayResult(row) {
  const outcome = row.ok ? '成功' : row.error === '超时' ? '超时' : '失败';
  const status = row.status === null ? '—' : row.status;
  const time = row.ms === null ? '—' : row.ms + ' ms';
  return [row.label + '｜' + outcome + '｜HTTP ' + status + '｜' + time, row.url, row.error]
    .filter(Boolean).join('\n');
}

Page({
  data: { running: false, cloudRows: [], cloudError: '', localError: '', history: [], syncAt: '' },

  onLoad() {
    try { this.setData({ history: readHistory() }); }
    catch (error) { this.setData({ localError: '读取本机历史失败。' }); }
    if (CONFIG.cloudEnv === 'TODO_ENV_ID') this.setData({ cloudError: '云环境未配置' });
    remote.syncStatus().then(row => this.setData({ syncAt: row && row.finishedAt || '' })).catch(() => {});
  },

  async start() {
    if (this.data.running) return;
    this.setData({ running: true, cloudRows: [], cloudError: '', localError: '' });
    const now = Date.now();
    try {
      if (getApp().globalData.cloudError) throw new Error(getApp().globalData.cloudError);
      const response = await wx.cloud.callFunction({ name: 'nettest', data: {} });
      const rows = normalize(response && response.result);
      this.setData({ cloudRows: rows });
      const history = [{ id: now, date: jakartaTimestamp(now), rows }].concat(this.data.history).slice(0, 30);
      this.setData({ history });
      wx.setStorageSync(HISTORY_KEY, history);
    } catch (error) {
      this.setData({ cloudError: error.errMsg || error.message || '调用失败' });
    } finally {
      this.setData({ running: false });
    }
  },

  copyAll() {
    const records = this.data.history.map(record => [
      record.date + '（雅加达）', '云函数连通性（只读取响应头）', ...record.rows.map(displayResult)
    ].join('\n'));
    if (records.length) wx.setClipboardData({ data: records.join('\n\n') });
  }
});
