const https = require('https');

const PROBE_TIMEOUT_MS = 2500;
const URLS = [
  {
    label: 'GitHub Pages',
    url: 'https://wenbubai2008-max.github.io/indonesian-learning/data/daily/index.json'
  },
  {
    label: 'GitHub Raw',
    url: 'https://raw.githubusercontent.com/wenbubai2008-max/indonesian-learning/main/data/daily/index.json'
  },
  {
    label: 'GitHub API',
    url: 'https://api.github.com/repos/wenbubai2008-max/indonesian-learning/contents/data/daily/index.json'
  },
  {
    label: 'GitHub codeload',
    url: 'https://codeload.github.com/wenbubai2008-max/indonesian-learning/zip/refs/heads/main'
  }
];

function probe(target) {
  const started = Date.now();
  return new Promise(resolve => {
    let request;
    let finished = false;
    const deadline = setTimeout(() => {
      finish(false, '超时');
      if (request) request.destroy();
    }, PROBE_TIMEOUT_MS);

    function finish(ok, error, status = null) {
      if (finished) return;
      finished = true;
      clearTimeout(deadline);
      const ms = Date.now() - started;
      resolve({ label: target.label, url: target.url, ok, status, ms, error });
    }

    try {
      request = https.get(target.url, {
        headers: { 'User-Agent': 'indo-mini-readonly-connectivity-check' }
      }, response => {
        const status = response.statusCode || null;
        response.destroy(); // Record response headers only; never download an archive/body.
        finish(status >= 200 && status < 300, status >= 200 && status < 300 ? '' : 'HTTP ' + status, status);
      });
      request.on('error', error => finish(false, error.code || '请求失败'));
      request.setTimeout(PROBE_TIMEOUT_MS, () => {
        finish(false, '超时');
        request.destroy();
      });
    } catch (error) {
      finish(false, error.code || '请求失败');
    }
  });
}

exports.main = async () => Promise.all(URLS.map(probe));
