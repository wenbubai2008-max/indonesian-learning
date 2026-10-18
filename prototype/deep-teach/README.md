# Deep-teach demo builder (prototype, not used by the site)

Draft for the user-requested 深讲版带学 (2026-10-18). Nothing here is loaded by index.html or the lesson tasks.

- `teach-*.json` — the teaching layer for one lesson (draft schema for a future `lesson_focus.teach`).
- `node validate.js data/daily/D-S.json teach.json` — draft checks (quotes verbatim, one right answer, every option explained, recall uses a new situation, chunks add up, …).
- `node build.js data/daily/D-S.json teach.json out.html` — self-contained demo page (style.css + engine.js inlined).
- `run.js` — Playwright click-through (weak / strong / mixed learner).
