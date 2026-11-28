const CONFIG = require('../../utils/config');
const { INDEX_URL } = require('../../utils/data');
const { jakartaTimestamp } = require('../../utils/date');

const WORKER_KEY = 'mini_nettest_worker_url';
const HISTORY_KEY = 'mini_nettest_history_v1';
const WORKER_ORIGIN = /^https:\/\/((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+workers\.dev)\/?$/i;

function readHistory() {
  const history = wx.getStorageSync(HISTORY_KEY);
  return Array.isArray(history) ? history.slice(0, 30) : [];
}

function result(target, ok, status, ms, error, skipped = false) {
  return { label: target.label, url: target.url, ok, status, ms, error, skipped };
}

function direct(target) {
  if (!target.url) return Promise.resolve(result(target, false, null, null, '未填写 Worker 地址', true));
  const started = Date.now();
  return new Promise(resolve => {
    wx.request({
      url: target.url,
      method: 'GET',
      timeout: 10000,
      success(response) {
        const status = response.statusCode;
        const ok = target.worker ? status === 401 : status >= 200 && status < 300;
        resolve(result(target, ok, status, Date.now() - started, ok ? '' : 'HTTP ' + status));
      },
      fail(error) {
        resolve(result(target, false, null, Date.now() - started, error.errMsg || '请求失败'));
      }
    });
  });
}

async function viaCloud(targets) {
  if (CONFIG.cloudEnv === 'TODO_ENV_ID') return { rows: [], error: '云环境未配置' };
  const initializationError = getApp().globalData.cloudError;
  if (initializationError) return { rows: [], error: initializationError };

  let deadline;
  try {
    const response = await Promise.race([
      wx.cloud.callFunction({
        name: 'nettest',
        data: { urls: targets.filter(target => target.url).map(target => target.url) }
      }),
      new Promise((resolve, reject) => {
        deadline = setTimeout(() => reject(new Error('等待云函数返回超时')), 25000);
      })
    ]);
    if (!Array.isArray(response.result)) throw new Error('返回格式不正确');
    const rows = targets.map(target => {
      if (!target.url) return result(target, false, null, null, '未填写 Worker 地址', true);
      const row = response.result.find(entry => entry.url === target.url);
      return row ? result(target, row.ok, row.status, row.ms, row.error) :
        result(target, false, null, null, '云函数未返回该地址的结果');
    });
    return { rows, error: '' };
  } catch (error) {
    return { rows: [], error: error.errMsg || error.message || '调用失败' };
  } finally {
    clearTimeout(deadline);
  }
}

function displayResult(row) {
  const outcome = row.skipped ? '跳过' : row.ok ?
    (row.status === 401 ? '成功 · 网络通（未授权，正常）' : '成功') : '失败';
  const status = row.status === null ? '—' : row.status;
  const time = row.ms === null ? '—' : row.ms + ' ms';
  return [row.label + '｜' + outcome + '｜HTTP ' + status + '｜' + time, row.url, row.error]
    .filter(Boolean).join('\n');
}

Page({
  data: {
    workerUrl: '', inputError: '', localError: '', running: false, directRows: [], cloudRows: [],
    cloudError: '', history: []
  },

  onLoad() {
    try {
      this.setData({ workerUrl: wx.getStorageSync(WORKER_KEY) || '', history: readHistory() });
    } catch (error) {
      this.setData({ localError: '读取本机历史失败。' });
    }
    if (CONFIG.cloudEnv === 'TODO_ENV_ID') this.setData({ cloudError: '云环境未配置' });
  },

  editWorker(event) {
    this.setData({ workerUrl: event.detail.value, inputError: '' });
  },

  saveWorker(event) {
    const value = event.detail.value.trim();
    const match = WORKER_ORIGIN.exec(value);
    if (value && !match) {
      this.setData({ inputError: '请输入 https:// 开头的 workers.dev 根地址。' });
      return;
    }
    try {
      wx.setStorageSync(WORKER_KEY, match ? 'https://' + match[1].toLowerCase() : '');
    } catch (error) {
      this.setData({ localError: 'Worker 地址保存失败。' });
    }
  },

  async start() {
    if (this.data.running) return;
    const value = this.data.workerUrl.trim();
    const match = WORKER_ORIGIN.exec(value);
    if (value && !match) {
      this.setData({ inputError: '请输入 https:// 开头的 workers.dev 根地址。也可清空后测试 GitHub。' });
      return;
    }
    const origin = match ? 'https://' + match[1].toLowerCase() : '';
    this.setData({ workerUrl: origin, inputError: '', localError: '', running: true,
      directRows: [], cloudRows: [], cloudError: '' });
    this.saveWorker({ detail: { value: origin } });

    const targets = [
      { label: 'GitHub Pages', url: INDEX_URL },
      { label: 'GitHub Raw', url: CONFIG.rawIndexUrl },
      { label: 'Worker /state', url: origin ? origin + '/state' : '', worker: true }
    ];
    const now = Date.now();
    try {
      const directTask = Promise.all(targets.map(direct)).then(rows => {
        this.setData({ directRows: rows });
        return rows;
      });
      const cloudTask = viaCloud(targets).then(cloud => {
        this.setData({ cloudRows: cloud.rows, cloudError: cloud.error });
        return cloud;
      });
      const [phone, cloud] = await Promise.all([directTask, cloudTask]);
      const record = { id: now, date: jakartaTimestamp(now), phone, cloud };
      const history = [record].concat(this.data.history).slice(0, 30);
      this.setData({ history });
      try {
        wx.setStorageSync(HISTORY_KEY, history);
      } catch (error) {
        this.setData({ localError: '本机历史保存失败，本次结果仍可复制。' });
      }
    } catch (error) {
      this.setData({ localError: error.errMsg || error.message || '自检失败' });
    } finally {
      this.setData({ running: false });
    }
  },

  copyAll() {
    const records = this.data.history.map(record => [
      record.date + '（雅加达）',
      'A. 手机直连',
      ...record.phone.map(displayResult),
      'B. 云函数转发',
      ...(record.cloud.error ? ['云函数不可用 · ' + record.cloud.error] : record.cloud.rows.map(displayResult))
    ].join('\n'));
    if (records.length) wx.setClipboardData({ data: records.join('\n\n') });
  }
});
