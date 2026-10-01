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
