# Stage 1: read-only lesson pre-publication gate / 课程发布前校验

Status: **isolated trial on `lesson-staging-v1`**. This is not the production lesson writer. The scheduled 08:00/18:00 ChatGPT tasks, the two existing GitHub Actions workflows, main, and GitHub Pages remain unchanged by Stage 1.

## Draft procedure

1. Start from the current main HEAD, retaining its `data/learning-runtime.json`, `data/daily/index.json`, and `data/learning-pool-rules.json` as **one pre-lesson snapshot**. Runtime watermark must equal the latest completed flag in index. If main advances, re-fetch and re-validate.
2. Put a candidate at `staging/drafts/YYYY-MM-DD-am.json` or `-pm.json` in the isolated branch, never `data/daily/`. Do not mark index complete or alter the giant vocabulary database while drafting.
3. From repository root (Node >=22), run:

```bash
node .github/scripts/validate-lesson-candidate.js --candidate staging/drafts/YYYY-MM-DD-am.json --date YYYY-MM-DD --session am
node .github/scripts/validate-lesson-candidate.js --candidate staging/drafts/YYYY-MM-DD-pm.json --date YYYY-MM-DD --session pm
```

The program is read-only: exit 0 = pass, 1 = candidate blocked with machine-readable error codes, 2 = malformed input. It reports a SHA-256 baseline fingerprint. It uses repository current `data/` files by default; for isolated tests, override `--index`, `--runtime`, `--rules`, `--same-day-am`, or `--previous-pm`.

## Publish boundary

Passing Stage 1 **does not publish anything**. Stage 2 must re-fetch main, compare its source baseline and repeat validation, then atomically publish approved lesson/index and reconcile derived sources. An old passing result cannot justify publishing into a newer state. Previously completed lessons are blocked as duplicate submissions. The tool verifies deterministic schema, pool and consistency conditions; it cannot prove Indonesian wording is naturally fluent or semantically correct.

## Tests

```bash
node --check .github/scripts/validate-lesson-candidate.js
node --check .github/scripts/test-lesson-candidate.js
node .github/scripts/test-lesson-candidate.js
```

No extra GitHub Actions workflow and no production writer are introduced in Stage 1.
