# Lesson Material Library V1 (prototype only)

Purpose: test a zero-model, deterministic lesson-content engine without touching the production 08:00/18:00 publication chain.

## Hard boundaries
- This directory is experimental only.
- It does not modify `data/daily/*`, `data/daily/index.json`, runtime, context, workflows, Pages, or production tasks.
- Production truth remains `data/learning-pool-rules.json` + `.github/scripts/validate-lesson-candidate.js`.
- The prototype may READ `data/lesson-context.json` and published lesson JSON, but writes only to stdout or an explicit prototype output path.
- Word eligibility, dont/fuzzy priority, review cooldown, and AM/PM structure must never be redefined by this library.

## Design goal
The library is not a bag of fixed lessons. It separates:
1. semantic domains and real-life scenes;
2. natural Indonesian discourse moves and connectors;
3. lexical usage/register notes;
4. sentence and dialogue moves;
5. reading story frames;
6. exercise frames;
7. deterministic selection/anti-repetition logic.

A lesson should use only the subset of target words that fit a coherent reading/dialogue scene. Remaining target words stay in cards, bilingual sentences and exercises instead of being forced into an unnatural paragraph.

## Current V1
- `materials/scenes.json`: daily-life scene families and coherent story/dialogue frames.
- `materials/language.json`: register, connectors, discourse moves, natural spoken variants.
- `materials/lexical-rules.json`: semantic tag heuristics and curated lexical overrides.
- `materials/tasks.json`: AM/PM output and test frames.
- `engine/generate-prototype.js`: deterministic prototype generator; stdout only by default.
- `engine/test-prototype.js`: static quality/coverage checks.

## Quality principles
- Indonesian first: natural word order and register matter more than covering every target word in one text.
- A2+→B1: short clauses, common connectors, controlled colloquial Indonesian.
- Spoken-vs-formal distinction is explicit (e.g. `agar` vs `biar`, `lezat` vs `enak`, `seraya` vs `sambil`).
- Avoid fake combinations: a lexical item enters a scene only if its semantic tags fit.
- Avoid repetition: scene IDs and frame IDs are selected from a stable hash of target date/session/word set, while recent-history IDs can be excluded.
- No random generation; same inputs produce the same prototype lesson.

## Test command
```bash
node prototype/lesson-engine/engine/test-prototype.js
node prototype/lesson-engine/engine/generate-prototype.js data/lesson-context.json
```

The generator is intentionally not connected to production publication. V1 must be evaluated side-by-side with human/LLM lessons before any integration decision.


## V2 alignment (2026-10-01)

V2 keeps the production AM/PM learning contract but moves all prototype rendering onto one shared deterministic core:

- `engine/core.js` is the single generation core for Node tests and browser preview.
- `engine/generate-prototype.js` is only a Node wrapper around that core.
- `preview.html` / `preview.js` call the same core; the browser no longer maintains a second lesson algorithm.
- Word selection happens before scene selection. Scene/content can never replace a higher-priority legal learning word.
- AM: 10 legal new words with dont-first, ~5 reviews, 5 bilingual sentences, 80–120 word reading, 3-question quiz, active output, 3-point review.
- PM: 3–4 legal new words, dynamic 10–12 total core words, 4–6 reviews, 2–3 applications, 80–120 word reading, 4+ line dialogue, 3–4 rewrites, 6-question test, final review.
- Reading quality target: AM naturally reuses at least 6 selected new words; PM reuses all or nearly all selected new words. Review/application words only use remaining space.
- PM dialogue must naturally reuse at least 2 PM new words plus a learned review/application item when possible.
- Published detailed cards from `daily-vocab-data.js` are reused for review/application words before any fallback explanation is generated.
- New-word examples are audited so the target surface form itself appears in the teaching example.
- Preview provides separate real AM/PM context fixtures and browser Indonesian TTS buttons, but remains read-only.

### V2 regression

```bash
node prototype/lesson-engine/engine/test-prototype.js
```

The V2 regression exercises 6 AM + 6 PM variants against the existing production validator and additionally checks reading target coverage, PM dialogue target coverage, fixed PM test shape, shared-core identity, and read-only preview behavior.

The prototype is still not connected to official lesson publication. Integration requires a separate decision after human review of generated lesson quality.
