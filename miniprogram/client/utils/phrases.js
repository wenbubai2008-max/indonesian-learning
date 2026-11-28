const { asList, normalize, splitNote, stableId, chat, text } = require('./cards');
const { classify } = require('./scenes');

function collect({ lesson, reading }) {
  const entry = lesson || reading;
  const shortDate = Number(entry.date.slice(5, 7)) + '月' + Number(entry.date.slice(8, 10)) + '日';
  const label = reading ? '泛读 · ' + shortDate : shortDate + (lesson.session === 'am' ? ' 早课' : ' 晚课');
  const order = entry.date + (reading ? '-12' : lesson.session === 'am' ? '-08' : '-18');
  const candidates = [];
  if (lesson && lesson.session === 'am') {
    asList(lesson.sentences).forEach(item => candidates.push([item.text || item.id, item.cn, label]));
  }
  if (lesson) {
    asList(lesson.lesson_focus && lesson.lesson_focus.patterns).forEach(item =>
      candidates.push([item.example, item.example_cn, label + ' · 句型']));
  }
  if (reading || lesson.session === 'pm') {
    chat(entry.dialogue).forEach(line => candidates.push([line.id, line.cn, label + (reading ? '' : ' · 对话')]));
  }
  return candidates.flatMap(([id, chinese, source]) => {
    const { cn, note } = splitNote(chinese);
    return id && cn ? [{
      id: text(id), cn, note, source, order, scene: classify(id, cn), key: stableId('s', id)
    }] : [];
  });
}

function dedupe(rows) {
  const unique = new Map();
  for (const row of rows) {
    const key = normalize(row.id);
    const prior = unique.get(key);
    if (!prior || prior.order <= row.order) unique.set(key, row);
  }
  return Array.from(unique.values()).sort((a, b) => b.order.localeCompare(a.order));
}

function search(rows, query, scene, starsOnly, stars) {
  const terms = normalize(query).split(' ').filter(Boolean);
  return rows.filter(row => (scene === '全部' || scene === row.scene) && (!starsOnly || stars[row.key]) &&
    (!terms.length || terms.every(term => normalize(row.id).includes(term) || normalize(row.cn).includes(term))));
}

module.exports = { collect, dedupe, search };
