const https = require('https');

const pages = 'https://wenbubai2008-max.github.io/indonesian-learning/data/daily/index.json';
const raw = 'https://raw.githubusercontent.com/wenbubai2008-max/indonesian-learning/main/data/daily/index.json';
const workerHost = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+workers\.dev$/;
// The free CloudBase environment stops the entire invocation after 3 seconds.
const PROBE_TIMEOUT_MS = 2500;

function allowedUrl(value) {
  if (typeof value !== 'string' || value.length > 300) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        url.search || url.hash || value !== url.href) return null;
    if (value === pages || value === raw) return { url, worker: false };
    if (workerHost.test(url.hostname) && url.pathname === '/state') return { url, worker: true };
  } catch (error) {
    return null;
  }
  return null;
}

function probe(value) {
  const target = allowedUrl(value);
  if (!target) {
    return Promise.resolve({ url: '', ok: false, status: null, ms: 0, error: '地址不在允许范围内' });
  }

  const url = target.url.href;
  const started = Date.now();
  return new Promise(resolve => {
    let request;
    let status = null;
    let finished = false;
    const deadline = setTimeout(() => {
      finish(false, `超时（${PROBE_TIMEOUT_MS} ms 内未收到 HTTP 响应）`);
      if (request) request.destroy();
    }, PROBE_TIMEOUT_MS);

    function finish(ok, error) {
      if (finished) return;
      finished = true;
      clearTimeout(deadline);
      const ms = Date.now() - started;
      console.log(JSON.stringify({ url, status, ms }));
      resolve({ url, ok, status, ms, error });
    }

    try {
      request = https.get(target.url, response => {
        status = response.statusCode;
        const ok = target.worker ? status === 401 : status >= 200 && status < 300;
        finish(ok, ok ? '' : 'HTTP ' + status);
        response.destroy();
      });
      request.on('error', error => finish(false, error.code || '请求失败'));
    } catch (error) {
      finish(false, error.code || '请求失败');
    }
  });
}

exports.main = async event => {
  const urls = event && event.urls;
  if (!Array.isArray(urls) || urls.length > 3) return [];
  return Promise.all(urls.map(probe));
};
