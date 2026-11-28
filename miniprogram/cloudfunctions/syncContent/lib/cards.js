const asList = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' ? value.trim() : '';
const normalize = value => text(value).normalize('NFKC').toLowerCase()
  .replace(/[\p{P}\p{S}]/gu, ' ').replace(/\s+/g, ' ').trim();

function stableId(prefix, value) {
  const key = normalize(value);
  if (prefix === 'w') return prefix + ':' + key;
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  return prefix + ':' + (hash >>> 0).toString(36);
}

function splitNote(value) {
  const cn = text(value);
  const found = /\s*[（(]([^（）()]*(?:[（(][^（）()]*[）)][^（）()]*)*)[）)]\s*$/.exec(cn);
  return found && found.index > 0 ? { cn: cn.slice(0, found.index).trim(), note: found[1] } : { cn, note: '' };
}

function splitTitle(value) {
  const title = text(value).split('｜').pop();
  const index = title.lastIndexOf(' · ');
  return index < 0 ? { id: title, cn: '' } : { id: title.slice(0, index), cn: title.slice(index + 3) };
}

function chat(dialogue) {
  const lines = asList(dialogue && dialogue.lines);
  const first = lines.find(line => line && line.speaker);
  return lines.filter(Boolean).map((line, i) => ({
    speaker: text(line.speaker), id: text(line.id) || text(line.text), cn: text(line.cn),
    side: first ? (line.speaker === first.speaker ? 'left' : 'right') : (i % 2 ? 'right' : 'left')
  })).filter(line => line.id);
}

const labels = {
  word: '词卡', pattern: '句型卡', sentence: '句卡', contrast: '易混卡', recall: '回想卡',
  story: '故事卡', choice: '选择题', output: '输出卡', text: '文字卡', chat: '情景对话',
  fill: '填空卡', order: '排序卡'
};

function card(kind, front, back, source, extra = {}) {
  return front && back ? { kind, label: labels[kind], front, back, source, seconds: 30, ...extra } : null;
}

module.exports = { asList, text, normalize, stableId, splitNote, splitTitle, chat, card };
