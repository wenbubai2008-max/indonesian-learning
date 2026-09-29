# Lesson-generation JSON shape / 课程生成结构检查表

**Source of truth:** `.github/scripts/validate-lesson-candidate.js` plus `data/learning-pool-rules.json`. This is a generation-time key map, not a second validator or permission to simplify the lesson. Before writing the UNIQUE candidate to its release branch, read that validator and the latest successfully published lesson of the **same session**. Copy its structural keys, not its words, review history, examples, dates or answers. Never mix AM question/sentence keys with PM dialogue/test keys.

## AM — 08:00

Required root: `date, session:"am", time:"08:00", day, title, vocab, review_vocab, sentences, reading, quiz, output, review`. Other legitimate metadata may be retained. Do not use PM's `daily_test`, `dialogue`, `rewrite` in place of these root keys.

- `vocab`: exactly 10 fully filled new-word cards. Each card **must** contain `word, display, audio_text, cn, en, root, root_cn, formation, example, example_cn, synonym_note, is_oral_new`. The `display` and `audio_text` strings must be nonempty (normally identical to `word`), and `is_oral_new` must be boolean. Optional `usage_note` is permitted. Do not replace these with the PM grouping fields.
- `review_vocab`: array of 4–6 taught active word strings, no repetition with today's new words; obey the 7-day rotation and previous PM cooldown.
- `sentences`: **5** objects with `{ "text": "Indonesian sentence", "cn": "中文句子" }`. The `id` key is **not** an AM sentence key.
- `reading`: `{ "text": "80–120 Indonesian words", "cn": "逐段中文" }`.
- `quiz`: exactly **3 multiple-choice questions**, each using `{ "question": "题干", "options": ["A","B","C","D"], "answer_index": 0, "answer": "A", "explain": "解释" }`. `answer`, when provided, must equal `options[answer_index]`. At least one correct option must be one of the actual `review_vocab` words. No PM-style `prompt` in place of `question` and no `fill` item. The question must not accidentally reveal the correct option.
- `output`: `{ "task": "...", "reference_answer": "...", "reference_cn": "..." }`.
- `review`: array of exactly three nonempty strings (NOT PM's `{title,steps}` object).

## PM — 18:00

Required root: `date, session:"pm", time:"18:00", day, title, write_status:"lesson_complete", new_words, vocab, reading, dialogue, rewrite, daily_test, review`.

- `vocab`: **10–12** full cards. Every card must contain `word, display, audio_text, cn, en, root, root_cn, formation, example, example_cn, synonym_note, usage_note, source_group, is_new, is_oral_new`. Group exactly 3–4 `source_group:"new"`, 4–6 `"review"`, 2–3 `"application"`; `is_new` true **only** for new. `new_words` must list exactly all and only the new-group word strings. `display` and `audio_text` must be nonempty. Application sourced from today's AM must be genuinely taught and marked `今天08:00已教`.
- `reading`: `{ "text": "80–120 Indonesian words", "cn": "中文" }`.
- `dialogue`: an **object**, not an array: `{ "title": "标题", "lines": [{ "speaker": "A", "id": "Indonesian dialogue line", "cn": "逐句中文" }, ...] }` with at least four lines. `id` here is intentionally correct; do not reuse it for AM sentences.
- `rewrite`: array of **3–4** `{ "task": "...", "reference_answer": "...", "reference_cn": "..." }`; NOT `rewrite_application`.
- `daily_test`: `{ "questions": [three choices, two fills, one order], "self_check": ["非空自查文字", ...] }`. Never use `items`.
  - PM choice: `{ "type": "choice", "prompt": "题干", "options": ["A","B","C","D"], "answer_index": 0, "answer": "A", "explain": "解释" }`. This deliberately uses `prompt`, unlike AM's `question`.
  - PM fill: `{ "type": "fill", "prompt": "填空：Saya _____.（目标词中文提示）", "answer": "...", "explain": "..." }`. Chinese hint must be inline in parentheses.
  - PM order: `{ "type": "order", "prompt": "按照中文排列印尼语：完整中文句子", "tokens": ["Saya","...", "...", "...", "..."], "answer": "space-joined ordered tokens", "answer_cn": "中文句子", "explain": "解释" }`; five to eight tokens, whose joined text must match `answer`.
- `review`: `{ "title": "最后5分钟复盘", "steps": ["...", "..."] }`. NOT the AM string array or PM legacy `items`.

## Generation-to-publication checks

1. Generate using the **same-session** published lesson as an exact key/layout model, replacing content only after validating current runtime eligibility, full lesson contract and completed seven-day review history. Use `validate-lesson-candidate.js` for truth rather than inferring shape from prose.
2. Before the first release-branch write, audit every card/array/question against this key map. Check answer-index consistency and that actual answer words qualify.
3. Write the lesson and index to the same isolated release branch, read both back, then open one PR. The read-only PR preflight is mandatory and bound to the exact PR head SHA. For a **pure JSON structure error** (such as missing display/audio_text, AM `id` vs `text`, AM `prompt` vs `question`), preserve the original candidate and perform at most **one bounded correction on the SAME release branch**, preserving the 10/3–4 new-word identities, review selection, reading and learning content. Require a new PR preflight for the updated head. Conversion of AM fill to choice needs a real answer/options, not blind renaming.
4. Stop rather than auto-repair if errors concern word eligibility, seven-day cooldown, wrong answer semantics, incomplete source history, stale runtime, changed published lesson or a second failed preflight. Never relax the validator to make invalid content pass.
5. Only an exact-head, approved two-file release PR proceeds to squash publication. CI regression cases permanently exercise the historical AM/PM key mixups.

Existing correct structural examples: `data/daily/2026-09-28-am.json` and `data/daily/2026-09-27-pm.json`. The example content is **historical**, not a valid future word selection.
