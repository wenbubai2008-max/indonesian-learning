function read(key, fallback) {
  try {
    const value = wx.getStorageSync(key);
    return value ? JSON.parse(value) : fallback;
  } catch (_) {
    return fallback;
  }
}

function size(value) {
  let bytes = 0;
  for (const ch of JSON.stringify(value)) {
    const code = ch.codePointAt(0);
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

function write(key, value, budget = Infinity) {
  try {
    if (budget !== Infinity && size(value) > budget) return false;
    wx.setStorageSync(key, JSON.stringify(value));
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = { read, write, size };
