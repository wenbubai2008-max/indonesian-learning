# Lightweight lesson context — phase 1 (isolated / NOT live)

This is **one derivation of existing authoritative data**, not another vocabulary pool, eligibility rule, lesson publisher, or daily-vocab writer. No OpenAI API, subscription API keys, new workflow, or external service.

## Why it exists

The scheduled ChatGPT generator currently has to fetch large overlapping inputs to write AM/PM lessons. `.github/scripts/build-lesson-context.js` builds a short **next-session context** from one synced `data/learning-runtime.json`, `data/daily/index.json`, the existing `data/learning-pool-rules.json`, and only the completed lesson files that the existing `collectReviewHistory` already requires.

It does not choose words or generate lesson text. It retains **all exposed valid new-word candidates**, their exact meanings, all exposed review/focus candidates, eligible oral candidates, and seven-day *actual completed core reviews* (not reading/application exposures). Missing source lessons, invalid metadata, incorrect 977/v4 baseline, stale AM/PM runtime, wrong pool partitions and duplicate index dates fail closed.

## Compact JSON fields

- `target`: the next eligible date / session / time / day inferred from **actual completed index and runtime watermark**. PM only when the same-day AM is complete; AM only after the preceding PM completed.
- `source`: runtime/index/rules content hashes, version, 977 invariant, generation timestamp and completed lesson watermark. Optional exact main commit SHA.
- `schema`: column names for compact arrays.
- `candidates.new_dont` and `new_fuzzy`: every allowed **exposed** runtime new word + CN, preserving runtime order. No unclassified or mastered words. These are **candidates**, not a guaranteed selection.
- `candidates.review`, `focus`, `oral`: actual runtime pools and permitted oral metadata; focus is review priority, not additional eligibility.
- `history_7d`: all actually completed AM/PM core review word IDs and their newly taught words for the target's seven-day window. PM applications and natural reading exposure are not counted as review.
- `previous_pm`: exact prior PM new words / core reviews when present.
- `same_day_am`: for PM only, the ten real AM words with CN/EN/root and AM review word IDs.
- `contract`: references the unchanged rules and validator. The context is **not** an alternative to the existing `validate-lesson-candidate.js`.

The context deliberately does not copy entire articles, dialogue, tests, big weakness files, full master-vocab data, or all historical lesson content.

## Safe local generation

From the repository root:
```sh
# Read-only default: prints the next context and never writes a repository file
node .github/scripts/build-lesson-context.js

# Explicit output only, once the caller has a valid synced source
node .github/scripts/build-lesson-context.js --output data/lesson-context.json --source-sha <verified-40-character-main-commit>
```

Only `--output data/lesson-context.json` permits file output. No other script currently calls it in production, so **no live data/lesson-context.json is published yet**. Do not manually commit a static sample as though it were current for tomorrow: the source may change with weakness feedback or newly completed lessons.

## Validation and phase-2 activation gate

Run:
```sh
node .github/scripts/test-build-lesson-context.js
node .github/scripts/regression-guard.js
```
The first suite tests an immutable *real post-PM 2026-09-28 main snapshot*, tests PM using a cloned index/runtime completion state, compares each history entry to the canonical validator loader, tests failure modes, and runs the actual CLI in an isolated temporary checkout; it never writes to main. Existing staging preflight can run the same tests without a new workflow.

**Do not update the AM/PM scheduled prompts yet.** Before activation, use the already existing writer/lock after every successful runtime update (including weakness-driven runtime rebuild) to generate/update this single derived context **in the same derived-data transaction**. Confirm the data is current for the intended time by checking target date/session, source runtime/index/rules hashes and latest main. A mismatched or missing context is a hard stop, not permission to use stale candidate pools. Keep only the original Sync writer for `data/daily-vocab-data.js` and preserve full validator + atomic two-file lesson/index release. Test a real AM and PM before enabling automation to consume the context; then simplify their prompts. Do not activate the dormant assembler PR #7 as part of phase 1.

## Historical measurements

From main `fa2d2c7b35026140da912f94c2b287e845911ac5` (2026-09-28 PM published), the deterministic next target is 2026-09-29 AM (day 39), 977 master, 319 exposed new candidates, 60 review candidates and 14 completed history records. For exact current size and tests, consult staging CI rather than treating these frozen measurements as ongoing live values.
