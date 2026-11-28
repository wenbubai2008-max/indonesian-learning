const { asList, text, normalize, stableId, splitNote, chat, card } = require('./cards');
const join = (...lines) => lines.filter(Boolean).join('\n');
const wordName = value => typeof value === 'string' ? value : text(value && (value.word || value.display));

function sentenceParts(source) {
  return text(source).match(/.+?(?:[.!?]+["'”’»)]*(?=\s|$)|$)/gs)?.map(part => part.trim()).filter(Boolean) || [];
}

function storyParts(original, translation) {
  const sentences = sentenceParts(original);
  const blocks = [];
  let current = '';
  sentences.forEach(sentence => {
    const next = current ? current + ' ' + sentence : sentence;
    if (!current || (current.length < 220 && next.length <= 360)) current = next;
    else {
      blocks.push(current);
      current = sentence;
    }
  });
  if (current) {
    if (current.length < 220 && blocks.length && blocks[blocks.length - 1].length + current.length + 1 <= 360) {
      blocks[blocks.length - 1] += ' ' + current;
    } else blocks.push(current);
  }

  const cn = text(translation);
  const stops = Array.from(cn.matchAll(/[。！？]+[”’」』）]*/g), match => match.index + match[0].length);
  if (stops[stops.length - 1] !== cn.length) stops.push(cn.length);
  const total = blocks.reduce((sum, block) => sum + block.length, 0);
  let start = 0;
  let length = 0;
  return blocks.map((block, i) => {
    length += block.length;
    const remaining = blocks.length - i - 1;
    const candidates = stops.filter(stop => stop > start && stop < cn.length);
    const possible = candidates.slice(0, Math.max(1, candidates.length - remaining + 1));
    const target = cn.length * length / total;
    const end = !remaining ? cn.length : possible.reduce((best, stop) =>
      Math.abs(stop - target) < Math.abs(best - target) ? stop : best, Infinity);
    const cut = Number.isFinite(end) ? end : start;
    const translated = cn.slice(start, cut).trim();
    start = cut;
    return { block, translated };
  });
}

function wholeWord(word) {
  return new RegExp('(^|[^\\p{L}\\p{N}])(' +
    word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?=$|[^\\p{L}\\p{N}])', 'iu');
}

function wordCard(v, source) {
  const word = wordName(v);
  return card('word', text(v.cn), text(v.display) || word, source, {
    id: stableId('w', word), seconds: 20, example: text(v.example), exampleCn: text(v.example_cn),
    root: v.root ? '词根 ' + v.root + (v.root_cn ? ' · ' + v.root_cn : '') : ''
  });
}

function question(q, source) {
  const options = asList(q.options);
  if (options.length) {
    const answer = Number.isInteger(q.answer_index) ? q.answer_index : options.indexOf(q.answer);
    return card('choice', text(q.question || q.prompt), text(options[answer]), source, {
      options, answer, explain: text(q.explain), hint: text(q.target_cn)
    });
  }
  if (q.type === 'fill' || q.type === 'order') {
    return card(q.type, text(q.prompt), text(q.answer), source, {
      exampleCn: text(q.answer_cn), frame: asList(q.tokens).join(' · '), explain: text(q.explain)
    });
  }
  return null;
}

function contrast(entry, examples, source) {
  const words = asList(entry.items).map(item => text(item.id)).filter(Boolean);
  const note = text(entry.note);
  if (words.length !== 2 || !note) return null;
  const id = stableId('c', words.map(normalize).sort().join(' '));
  for (const example of examples) {
    const matches = words.map(word => wholeWord(word));
    const indices = [0, 1].filter(i => matches[i].test(example));
    if (indices.length !== 1) continue;
    const selected = indices[0];
    return card('contrast', example.replace(matches[selected], '$1____'), note, source, {
      id, options: words, answer: selected
    });
  }
  return card('contrast', words.join('   /   '), note, source, { id });
}

function segments(lesson, morning) {
  const am = lesson.session === 'am';
  const source = lesson.date + ' ' + (am ? '早课' : '晚课');
  const focus = lesson.lesson_focus || {};
  const vocab = asList(lesson.vocab).filter(value => value && typeof value === 'object');
  const allWords = vocab.concat(asList(lesson.review_vocab), asList(lesson.cycle_vocab));
  const names = asList(focus.words).map(wordName).filter(Boolean);
  const patterns = asList(focus.patterns).filter(Boolean);
  const story = am && lesson.story;
  const reading = lesson.reading || {};
  const rawSentences = asList(lesson.sentences).filter(Boolean);
  const review = lesson.review_cards;
  const amNew = asList(morning && morning.vocab).map(v => normalize(wordName(v)));
  const amReview = asList(morning && morning.review_vocab).map(v => normalize(wordName(v)));
  const sections = [];
  function add(key, name, cards, details) {
    const valid = cards.filter(Boolean).map(item => ({ ...item, origin: source }));
    if (!valid.length) return;
    sections.push({ key, name, cards: valid, count: valid.length, details: details || valid.length + ' 张',
      minutes: Math.max(1, Math.ceil(valid.reduce((seconds, item) => seconds + item.seconds, 0) / 60)) });
  }

  const highlights = names.map(name => allWords.find(v => typeof v === 'object' && v && normalize(wordName(v)) === normalize(name)))
    .filter(Boolean).map(v => wordCard(v, '今日重点'));
  add('focus', '今日重点', highlights.concat(patterns.map(p => card('pattern', text(p.cn), text(p.pattern), '今日重点', {
    example: text(p.example), exampleCn: text(p.example_cn)
  }))), [names.join(' · '), patterns.length ? patterns.length + ' 个句型' : ''].filter(Boolean).join(' + '));

  add('words', story ? '本集词卡' : '今日词卡', vocab.map(v => {
    const key = normalize(wordName(v));
    let label = story ? '本集词汇' : '今日词汇';
    if (!am && morning && v.source_group === 'application') {
      if (amNew.includes(key)) label = '今天 08:00 新学 · 晚课复现';
      else if (amReview.includes(key)) label = '今天 08:00 复习过 · 老词';
      else label = '此前已学 · 晚课复现';
    }
    return wordCard(v, label);
  }), vocab.length + ' 张 · 先想后翻');

  const storyCards = storyParts(reading.text, reading.cn).map(({ block, translated }, i, parts) =>
    card('story', block, translated || text(reading.cn), (story && story.episode ? '连载第 ' + story.episode + ' 集 · ' : '') +
      '第 ' + (i + 1) + ' 段', { seconds: 60, fullCn: i === parts.length - 1 ? text(reading.cn) : '' }));
  function noteCard(value, label) {
    return card('text', text(value), text(value), label);
  }
  add('reading', story ? '连载故事' : '阅读', story ?
    [noteCard(story.previously_cn, '上集回顾'), ...storyCards, noteCard(story.next_cn, '下集预告')] : storyCards);

  if (am) {
    add('sentences', '高频句卡', rawSentences.map(s => {
      const sentence = text(s.text || s.id);
      const { cn, note } = splitNote(s.cn);
      return card('sentence', cn, sentence, '高频句子', {
        id: stableId('s', sentence), note, hints: names.filter(name => wholeWord(name).test(sentence)).slice(0, 2)
      });
    }), rawSentences.length + ' 句 · 看中文说整句');

    const examples = rawSentences.map(item => text(item.text || item.id)).concat(sentenceParts(reading.text)).filter(Boolean);
    const oldReview = Array.isArray(lesson.review) ? lesson.review : asList(lesson.review && (lesson.review.steps || lesson.review.items));
    const reviewItems = review ? asList(review.recall).map(r => card('recall', text(r.cn), text(r.id), '课末回想', {
      id: stableId('r', r.id)
    })).concat(asList(review.contrasts).map(c => contrast(c, examples, '课末易混'))) :
      oldReview.map(item => noteCard(typeof item === 'string' ? item : item.text, '课末复习'));
    add('practice', '小测 + 回想', asList(lesson.quiz).map(q => question(q, '课程小测')).concat(reviewItems));
  } else {
    const lines = chat(lesson.dialogue);
    add('dialogue', '情景对话', [lines.length ? card('chat', text(lesson.dialogue.title) || '情景对话',
      join(...lines.map(line => line.cn || line.id)), '课堂对话', { lines, seconds: lines.length * 10 }) : null],
    lines.length + ' 行 · 场景对练');
    add('practice', '改写 + 小测', asList(lesson.rewrite).map(v =>
      card('output', text(v.task), text(v.reference_answer || v.answer), '主动改写', {
        frame: text(v.frame), exampleCn: text(v.reference_cn || v.answer_cn)
      })).concat(asList(lesson.daily_test && lesson.daily_test.questions).map(q => question(q, '当日小测'))));
  }
  return sections;
}

module.exports = { segments, storyParts, wholeWord };
