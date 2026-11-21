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

function section(sections, title, items, tags = []) {
  const entries = items.filter(item => item.body || item.cn || item.details || item.choices || item.answer);
  if (!entries.length && !tags.length) return;
  sections.push({
    title,
    tags,
    entries: entries.map((entry, i) => Object.assign({ key: 's' + sections.length + 'i' + i }, entry))
  });
}

function focus(sections, lesson) {
  const data = lesson.lesson_focus || {};
  section(sections, '本课重点', list(data.patterns).filter(Boolean).map(item =>
    block(item.pattern, item.cn, { example: text(item.example), exampleCn: text(item.example_cn) })
  ), list(data.words).map(text).filter(Boolean));
}

function vocabulary(sections, lesson) {
  section(sections, '词卡', list(lesson.vocab).filter(Boolean).map(item => {
    const details = [
      { label: '词根', body: item.root, cn: item.root_cn },
      { label: '构词', body: item.formation },
      { label: '例句', body: item.example, cn: item.example_cn },
      { label: '用法', body: item.usage_note },
      { label: '近义辨析', body: item.synonym_note }
    ].map(row => block(row.body, row.cn, { label: row.label }))
      .filter(row => row.body || row.cn);
    return block(item.display || item.word || item.id || text(item), item.cn, {
      details: details.length ? details : null
    });
  }));
}

function reading(sections, lesson) {
  const data = lesson.reading;
  if (!data) return;
  section(sections, '阅读', [block(data.text || text(data), data.cn, { label: text(data.title) })]);
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
      choices: options.map(text),
      correct,
      explanation
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
  return block(item.task || text(item), item.task_cn, {
    example: text(item.frame),
    answerLabel: '看参考答案',
    answer: text(item.reference_answer || item.reference || item.answer),
    answerCn: text(item.reference_cn || item.reference_answer_cn || item.answer_cn)
  });
}

function morning(sections, lesson) {
  const story = lesson.story;
  if (story) {
    const caption = [text(story.series), text(story.episode) && '第 ' + story.episode + ' 集']
      .filter(Boolean).join(' · ');
    const synopsis = [block(caption)];
    if (story.previously_cn) synopsis.push(block('', story.previously_cn, { translationLabel: '看上集' }));
    if (story.next_cn) synopsis.push(block('', story.next_cn, { translationLabel: '看下集预告' }));
    section(sections, '连载', synopsis);
  }
  focus(sections, lesson);
  vocabulary(sections, lesson);
  section(sections, '复习词', [], list(lesson.review_vocab).map(text).filter(Boolean));
  section(sections, '高频句子', list(lesson.sentences).filter(Boolean).map(item =>
    block(item.text || text(item), item.cn)));
  reading(sections, lesson);
  section(sections, '小测', list(lesson.quiz).filter(Boolean).map(item => exercise(item, true)));
  if (lesson.output) section(sections, '主动输出', [reference(lesson.output)]);

  const cards = lesson.review_cards || {};
  section(sections, '回想', list(cards.recall).filter(Boolean).map(item =>
    block(item.cn, '', { answerLabel: '看印尼语', answer: text(item.id) })));
  section(sections, '辨析', list(cards.contrasts).filter(Boolean).map(group => {
    const items = list(group.items || group).filter(Boolean);
    return block(items.map(item => text(item.id || item.word || item)).filter(Boolean).join('\n'),
      items.map(item => text(item.cn)).filter(Boolean).join('\n'),
      { note: text(group.note) });
  }));
  section(sections, '复盘', list(lesson.review).map(item => block(item)));
}

function evening(sections, lesson) {
  focus(sections, lesson);
  vocabulary(sections, lesson);
  reading(sections, lesson);

  const dialogue = lesson.dialogue || {};
  section(sections, text(dialogue.title) || '情景对话', list(dialogue.lines || dialogue)
    .filter(Boolean).map(line => block(line.id || line.text || text(line), line.cn, { label: text(line.speaker) })));
  section(sections, '改写', list(lesson.rewrite).filter(Boolean).map(reference));

  const test = lesson.daily_test || {};
  section(sections, text(test.title) || '当日小测',
    list(test.questions || test.items).filter(Boolean).map(item => exercise(item)));
  const review = lesson.review || {};
  const steps = list(review.steps || review).map(item => block(item));
  if (review.retell_reference || review.retell_reference_cn) {
    steps.push(block('', '', {
      answerLabel: '看参考',
      answer: text(review.retell_reference),
      answerCn: text(review.retell_reference_cn)
    }));
  }
  section(sections, text(review.title) || '复盘', steps);
}

function buildLesson(lesson, session) {
  const sections = [];
  const isMorning = session === 'am';
  const handled = commonFields.concat(isMorning ?
    ['story', 'review_vocab', 'sentences', 'quiz', 'output', 'review_cards'] :
    ['dialogue', 'rewrite', 'daily_test']);
  if (isMorning) morning(sections, lesson);
  else evening(sections, lesson);
  return {
    title: text(lesson.title),
    time: text(lesson.time),
    sections,
    otherFields: Object.keys(lesson).filter(key => !handled.includes(key)).join('、')
  };
}

module.exports = { buildLesson };
