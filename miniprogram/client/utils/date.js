const dayMs = 24 * 60 * 60 * 1000;
const jakartaOffset = 7 * 60 * 60 * 1000;

function twoDigits(value) {
  return value < 10 ? '0' + value : String(value);
}

function utcDate(date) {
  return [date.getUTCFullYear(), twoDigits(date.getUTCMonth() + 1), twoDigits(date.getUTCDate())].join('-');
}

function jakartaDate(timestamp = Date.now()) {
  return utcDate(new Date(timestamp + jakartaOffset));
}

function jakartaTime(timestamp) {
  const date = new Date(timestamp + jakartaOffset);
  return [twoDigits(date.getUTCHours()), twoDigits(date.getUTCMinutes())].join(':');
}

function jakartaTimestamp(timestamp) {
  const date = new Date(timestamp + jakartaOffset);
  return jakartaDate(timestamp) + ' ' + jakartaTime(timestamp) + ':' + twoDigits(date.getUTCSeconds());
}

function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && utcDate(date) === value;
}

function shiftDate(value, days) {
  return utcDate(new Date(Date.parse(value + 'T00:00:00Z') + days * dayMs));
}

module.exports = { jakartaDate, jakartaTime, jakartaTimestamp, isDate, shiftDate };
