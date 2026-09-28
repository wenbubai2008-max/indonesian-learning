# Lightweight daily lesson context — generation and integration

This is a **derived, read-only lesson generation input**. It is not a new vocabulary selector, learning rule, publisher or writer for daily-vocab. No OpenAI API or external subscription is used.

## Canonical source and payload

`.github/scripts/build-lesson-context.js` reads exactly:
- `data/learning-runtime.json` (v4, 977 primary master words, actual exposed candidates);
- `data/daily/index.json` (real completed AM/PM flags);
- `data/learning-pool-rules.json` (v4);
- the completed AM/PM lessons required by the existing validator's `collectReviewHistory`.

The single derived output is `data/lesson-context.json`. It contains all exposed eligible dont/fuzzy new words with CN meanings, review/focus/eligible oral candidates, seven-day **core review** history, prior PM new words/core reviews, and the same-day AM taught words when the next target is PM. Reading/application exposure never becomes core-review history. The target date/session/day is inferred from completed index and exact runtime lesson watermark; no selection or translation is invented.

The `source` section includes the rules and runtime versions, runtime generation timestamp and lesson watermark, master=977, index date, and cryptographic hashes over parsed runtime/index/rules JSON. A live context intentionally **does not claim an older main SHA as its source**, because the new runtime and context are generated in the **same derived-data commit**.

## CLI contracts

```sh
node .github/scripts/build-lesson-context.js
node .github/scripts/build-lesson-context.js --output data/lesson-context.json
node .github/scripts/build-lesson-context.js --check
node .github/scripts/test-build-lesson-context.js
```

Default mode writes nothing. Only explicit `--output` writes the canonical derived file. `--check` independently reconstructs the expected data from the local canonical sources and fails with `CONTEXT_MISSING`, `CONTEXT_STALE`, or the relevant earlier source-integrity code; it never repairs or rewrites anything. Do not use `--check` and `--output` together. A `--source-sha` option exists **only for reproducible/pinned test snapshots**, not in the live workflow.

## Existing writers only (phase 2)

No third workflow or second daily-vocab writer is created. The existing serialized, retry-safe workflows each follow their normal baseline reset and produce the context immediately **after** building the current runtime:

- `.github/workflows/sync-daily-vocab.yml`: lesson/index publish -> existing reconciliation -> runtime build -> context build/check -> existing regression guards -> **one derived-data commit** containing daily-vocab, runtime and context. The scheduled healthy no-op gate requires the context's `--check` as well; an outdated/missing context enters the same idempotent recovery. Post-push readback re-checks it.
- `.github/workflows/build-learning-runtime.yml`: weakness and eligible source updates -> runtime build -> context build/check -> one derived-data commit containing runtime and context. Post-push readback checks context and existing regression guard. Its push path filters include the new builder/test scripts only for initial seeding; it does **not** monitor `data/lesson-context.json`, preventing self-trigger loops.

A context file is never accepted merely because its timestamp looks recent: the target, source hashes, candidate pool membership/order and actual completed history must still match. A broken or incomplete upstream lesson/history causes the writer to fail rather than publishing misleading context.

## Deployment and activation gate

The first merge of this code triggers the **existing Build learning runtime** workflow to seed `data/lesson-context.json`; this is not a second lesson generator. Verify the resulting main commit actually includes the file and has matching target and watermark, along with Build/Pages success. Subsequent completed lessons should trigger existing Sync; subsequent weakness updates should trigger existing Build.

The original AM/PM ChatGPT automations are deliberately **unchanged until a real generated context is present and its update path is verified**. When switching them later, they must still use the authoritative lesson validator and the existing unchanged, two-file (lesson + index) PR publish path. A stale/missing context must never authorize old word selection or a false claim of completed publication.

Regression tests use the immutable published 2026-09-28 PM main `fa2d2c7b35026140da912f94c2b287e845911ac5` and a simulated AM-only state. They verify source preservation (319 new + 60 review and 14 completed history entries at that checkpoint), malformed/unsynced sources, real CLI read-only versus output, missing/stale context on runtime/index change, and two existing writer transactions. Staging synthetic tests do not write to formal main or replace real post-merge evidence.
