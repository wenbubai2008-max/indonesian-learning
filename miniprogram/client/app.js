const CONFIG = require('./utils/config');

App({
  globalData: { cloudError: '', showStars: false },

  onLaunch() {
    if (CONFIG.cloudEnv === 'TODO_ENV_ID') return;
    try {
      wx.cloud.init({ env: CONFIG.cloudEnv, traceUser: false });
    } catch (error) {
      this.globalData.cloudError = error.errMsg || error.message || '初始化失败';
    }
  }
});
