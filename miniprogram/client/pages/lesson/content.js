const commonFields = [
  'date', 'session', 'time', 'day', 'title', 'phase', 'write_status', 'new_words', 'cycle_vocab',
  'lesson_focus', 'vocab', 'reading', 'review'
];

function list(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  if (typeof value === 'string') return value.trim() ? value : '';
  if (typeof value === 'number') return String(value);
  return list(value).filter(item => typeof item === 'string' || typeof item === 'number').join(' / ');
}

function block(body, cn, extra) {
  return Object.assign({ body: text(body), cn: text(cn) }, extra);
}

function section(sections, title, items, options = {}) {
  const entries = items.filter(item =>
    item.body || item.cn || item.details || item.choices || item.answer || item.answerCn);
  if (!entries.length) return;
  const index = sections.length;
  const number = index + 1 - (sections[0] && sections[0].focus ? 1 : 0);
  sections.push({
    title,
    marker: options.focus ? '' : options.check ? '✓' : String(number).padStart(2, '0'),
    focus: !!options.focus,
    subtitle: options.subtitle || '',
    entries: entries.map((entry, i) => Object.assign({ key: 's' + index + 'i' + i }, entry))
  });
}

function normalized(value) {
  return text(value).toLowerCase().trim().replace(/[.,!?;:，。！？；：“”"'’]/g, '').replace(/\s+/g, ' ');
}

function wordName(item) {
  return typeof item === 'string' ? item : item && item.word;
}

function focus(sections, words, patterns, vocab) {
  const subtitle = '这节课最值得掌握的 ' + words.length + ' 个词和 ' + patterns.length +
    ' 个句型，都出自本课；其余内容认识即可。';
  const wordCards = words.map(word => {
    const matching = vocab.find(item => normalized(wordName(item)) === normalized(word));
    return block((matching && matching.display) || word, matching && matching.cn);
  });
  const patternCards = patterns.map(item => block(item.pattern, item.cn, {
    example: text(item.example), exampleCn: text(item.example_cn)
  }));
  section(sections, '今天的重点', wordCards.concat(patternCards), { focus: true, subtitle });
}

function wordSources(morning) {
  const normalizeSource = value => text(wordName(value)).toLowerCase().trim()
    .replace(/[.,!?;:，。！？；：]/g, '').replace(/\s+/g, ' ');
  if (!morning) return () => '';
  const newWords = new Set(list(morning.vocab).map(normalizeSource));
  const reviewWords = new Set(list(morning.review_vocab).map(normalizeSource));
  return item => {
    if (item.source_group !== 'application') return '';
    const word = normalizeSource(item);
    if (newWords.has(word)) return '今天 08:00 新学 · 晚课复现';
    if (reviewWords.has(word)) return '今天 08:00 复习过 · 老词';
    return '此前已学 · 晚课复现';
  };
}

function vocabulary(sections, title, vocab, oldWords, focusWords, source) {
  section(sections, title, vocab.map((item, i) => {
    const word = normalized(wordName(item));
    const details = [
      { label: '构词', body: item.formation },
      { label: '用法', body: item.usage_note },
      { label: '辨析', body: item.synonym_note }
    ].map(row => block(row.body, row.cn, { label: row.label })).filter(row => row.body || row.cn);
    return block(item.display || item.word || item.id || text(item), item.cn, {
      vocabularyNumber: String(item.order == null ? i + 1 : item.order) + '.',
      english: text(item.en),
      everyday: text(item.everyday),
      example: text(item.example),
      exampleCn: text(item.example_cn),
      root: text(item.root),
      rootCn: text(item.root_cn),
      details: details.length ? details : null,
      recallWord: oldWords.has(word),
      highlight: focusWords.has(word),
      source: source(item)
    });
  }));
}

function relatedSentence(body, cn, highlights, label) {
  const content = normalized(body);
  return block(body, cn, { label, highlight: highlights.some(example => content.includes(example)) });
}

function readingBlock(reading, fold) {
  return block(reading.text || text(reading), reading.cn, {
    reading: true,
    foldTranslation: fold,
    translationLabel: '看整段中文 ▼'
  });
}

function readingTitle(reading) {
  return reading.title ? '阅读 · ' + reading.title : '阅读';
}

function exercise(item, forceChoice = false) {
  const body = item.question || item.prompt || text(item);
  const options = list(item.options);
  const explanation = text(item.explain);
  if ((forceChoice || item.type === 'choice') && options.length) {
    let correct = item.answer_index;
    if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) {
      correct = options.indexOf(item.answer);
    }
    return block(body, item.question_cn || item.prompt_cn, {
      choices: options.map((option, i) => String.fromCharCode(65 + i) + '. ' + text(option)),
      correct,
      explanation,
      revealChoices: item.kind === 'zh2id'
    });
  }
  if (item.type === 'fill' || item.type === 'order') {
    return block(body, item.prompt_cn, {
      example: text(item.options || item.tokens),
      hint: text(item.hint_cn),
      answerLabel: '看答案',
      answer: text(item.answer),
      answerCn: text(item.answer_cn),
      explanation
    });
  }
  return block(body, item.prompt_cn);
}

function reference(item) {
  return block(item.task || item.prompt || text(item), item.task_cn, {
    example: text(item.frame),
    exampleLabel: '句子骨架 · 把 …… 换成你的话，说出来或写下来',
    answerLabel: '参考答案',
    answer: text(item.reference_answer || item.reference || item.answer),
    answerCn: text(item.reference_cn || item.reference_answer_cn || item.answer_cn)
  });
}

function reviewCards(cards) {
  const recall = list(cards.recall).filter(Boolean).map(item =>
    block(item.cn, '', { answerLabel: '点开看答案', answer: text(item.id) }));
  const contrasts = list(cards.contrasts).filter(Boolean).map(group => {
    const items = list(group.items || group).filter(Boolean);
    const pairs = items.map(item =>
      [text(item.id || item.word || item), text(item.cn)].filter(Boolean).join(' ')).filter(Boolean);
    return block(pairs.join(' vs '), '', { note: text(group.note) });
  });
  if (recall.length) recall[0].group = '主动回想';
  if (contrasts.length) contrasts[0].group = '易混词与搭配';
  return recall.concat(contrasts);
}

function morning(sections, lesson, model) {
  const { vocab, oldWords, focusWords, highlights } = model;
  const { story, reading } = lesson;
  const fold = oldWords.size > 0;
  const serial = reading && story && Number.isInteger(story.episode);
  if (serial) {
    const storyParts = [
      block(story.series, '', { series: true }),
      block('', story.previously_cn, { label: '上集回顾', storyNote: true }),
      readingBlock(reading, fold),
      block('', story.next_cn, { label: '下集预告', storyNote: true })
    ];
    const title = '本周连载 · 第' + story.episode + '集' +
      (reading.title ? ' · ' + reading.title : '');
    section(sections, title, storyParts);
  }
  vocabulary(sections, serial ? '本集词汇' : '今日词汇', vocab, oldWords, focusWords, () => '');
  section(sections, '高频句子', list(lesson.sentences).filter(Boolean).map(item =>
    relatedSentence(item.id || item.text || text(item), item.cn, highlights)));
  if (reading && !serial) section(sections, readingTitle(reading), [readingBlock(reading, fold)]);
  section(sections, '小测', list(lesson.quiz).filter(Boolean).map(item => exercise(item, true)));
  if (lesson.output) section(sections, '主动输出', [reference(lesson.output)]);
  const cards = reviewCards(lesson.review_cards || {});
  section(sections, '复习', cards.length ? cards :
    list(lesson.review).filter(Boolean).map(item => block(item.text || item)));
}

function evening(sections, lesson, model, sameDayAm) {
  const { vocab, oldWords, focusWords, highlights } = model;
  vocabulary(sections, '今日词汇', vocab, oldWords, focusWords, wordSources(sameDayAm));
  if (lesson.reading) section(sections, readingTitle(lesson.reading),
    [readingBlock(lesson.reading, oldWords.size > 0)]);

  const dialogue = lesson.dialogue || {};
  section(sections, text(dialogue.title) || '情景对话', list(dialogue.lines || dialogue)
    .filter(Boolean).map(line =>
      relatedSentence(line.id || line.text || text(line), line.cn, highlights, text(line.speaker))));
  section(sections, '主动改写 · 应用练习', list(lesson.rewrite).filter(Boolean).map(reference), { check: true });

  const test = lesson.daily_test || {};
  const questions = list(test.items).length ? list(test.items) : list(test.questions);
  const subtitle = '轻量检测今天刚学的内容，不追求全对，也不用写长句。';
  section(sections, text(test.title) || '当日小测 · 5–8分钟',
    questions.filter(Boolean).map(item => exercise(item)), { check: true, subtitle });
  const review = lesson.review || {};
  const steps = list(review.steps || review.items || review).filter(Boolean).map(item => block(item.text || item));
  if (review.retell_reference || review.retell_reference_cn) {
    steps.push(block('', '', {
      answerLabel: '参考复述',
      answer: text(review.retell_reference),
      answerCn: text(review.retell_reference_cn)
    }));
  }
  section(sections, text(review.title) || '最后 5 分钟复盘', steps, { check: true });
}

function buildLesson(lesson, session, sameDayAm) {
  const sections = [];
  const isMorning = session === 'am';
  const handled = commonFields.concat(isMorning ?
    ['story', 'review_vocab', 'sentences', 'quiz', 'output', 'review_cards'] :
    ['dialogue', 'rewrite', 'daily_test']);
  const vocab = list(lesson.vocab).filter(Boolean);
  const lessonFocus = lesson.lesson_focus || {};
  const words = list(lessonFocus.words).filter(word => typeof word === 'string' && word.trim());
  const patterns = list(lessonFocus.patterns).filter(item =>
    item && typeof item.pattern === 'string' && typeof item.example === 'string');
  const newWords = new Set(list(lesson.new_words).map(word => normalized(wordName(word))));
  const old = !lesson.phase ? [] : Array.isArray(lesson.cycle_vocab) ? lesson.cycle_vocab :
    vocab.map(wordName).filter(word => word && !newWords.has(normalized(word)));
  const model = {
    vocab, oldWords: new Set(old.map(normalized)), focusWords: new Set(words.map(normalized)),
    highlights: patterns.map(item => normalized(item.example)).filter(Boolean)
  };
  focus(sections, words, patterns, vocab);
  if (isMorning) morning(sections, lesson, model);
  else evening(sections, lesson, model, sameDayAm);
  return {
    title: text(lesson.title),
    time: text(lesson.time),
    sections,
    otherFields: Object.keys(lesson).filter(key => !handled.includes(key)).join('、')
  };
}

module.exports = { buildLesson };
