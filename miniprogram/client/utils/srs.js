const { shiftDate } = require('./date');
const { read, write, size } = require('./storage');

const KEY = 'mini_v11:srs';
const eligible = card => Boolean(card.id) && ['word', 'sentence', 'recall', 'contrast'].includes(card.kind);

function schedule(card, rating, today, old = {}) {
  const interval = rating === 'remembered' ? Math.min(60, old.interval > 1 ? 2 * old.interval : 3) : 1;
  const { back, kind, source } = card;
  const front = kind === 'contrast' && card.options ? card.options.join('   /   ') : card.front;
  return { due: shiftDate(today, interval), interval, last: today,
    lapses: (old.lapses || 0) + (rating === 'forgot' ? 1 : 0), front, back, kind, source };
}

function keepWithinBudget(state) {
  const entries = Object.entries(state).sort(([, a], [, b]) => b.interval - a.interval || a.last.localeCompare(b.last));
  let count = entries.length;
  let bytes = size(state);
  for (const [id, entry] of entries) {
    if (count <= 600 && bytes <= 300 * 1024) break;
    delete state[id];
    count--;
    bytes -= size(id) + size(entry) + 2;
  }
  return state;
}

function score(card, rating, today) {
  if (!eligible(card)) return;
  const state = read(KEY, {});
  state[card.id] = schedule(card, rating, today, state[card.id]);
  write(KEY, keepWithinBudget(state), 300 * 1024);
}

function reviewGroup(cards, today, state = read(KEY, {})) {
  const byId = new Map(cards.filter(eligible).map(card => [card.id, card]));
  const labels = { word: '词卡', sentence: '句卡', recall: '回想卡', contrast: '易混卡' };
  const due = Object.entries(state).filter(([, value]) => value.due <= today)
    .sort(([, a], [, b]) => a.due.localeCompare(b.due) || a.last.localeCompare(b.last))
    .slice(0, 10).map(([id, value]) => byId.get(id) || {
      ...value, id, label: labels[value.kind], seconds: value.kind === 'word' ? 20 : 30
    });
  const added = new Set();
  for (const card of cards) {
    if (due.length >= 15) break;
    if (!eligible(card) || state[card.id] || added.has(card.id)) continue;
    due.push(card);
    added.add(card.id);
  }
  return due;
}

module.exports = { schedule, score, reviewGroup, eligible, keepWithinBudget };
