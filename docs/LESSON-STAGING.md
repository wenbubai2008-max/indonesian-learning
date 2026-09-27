# Stage 1: read-only lesson pre-publication gate / 课程发布前校验

Status: **Stage 2 isolated integration on `lesson-staging-v1`**. Production 08:00/18:00 prompts and the main workflow remain unchanged until a real unpublished lesson and final deployment are verified. On the staging branch, only the existing Sync workflow's read-only preflight job runs; its writer is skipped.

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


## Stage 2: gated release boundary (not activated on main)

1. Generate ONE unpublished candidate at `staging/drafts/YYYY-MM-DD-am.json` or `-pm.json` in the staging branch. Never modify formal data/daily or daily-vocab while drafting.
2. The staging push triggers the existing Sync workflow's read-only preflight job. It runs the Stage-1 30 tests and Stage-2 14 tests, fetches the current main, and checks every changed candidate. The PREFLIGHT record shows exact staging SHA, main SHA, candidate hash, baseline fingerprint, and error codes. Invalid drafts fail CI and cannot be promoted.
3. Before release, require that the candidate path was actually added/modified by that stage commit, stage HEAD is unchanged, preflight succeeded and main sync job was skipped. Re-fetch main immediately before publication. A changed main invalidates the old approval: revalidate using current main.
4. `plan-lesson-publication.js` generates a read-only plan with precisely TWO files: candidate lesson and updated `data/daily/index.json`. The connected GitHub App publishes them with one Git Data commit: latest main ref/tree, 2 blobs, tree using existing base tree, commit parent=validated main SHA, then non-force update_ref of main. If ref moved or HTTP 422, re-fetch and revalidate; never force-push or regenerate the course. Identical already-published content is a verified no-op; differing existing content blocks.
5. Re-read the committed lesson and index. The original main push-triggered Sync remains the only giant daily-vocab writer; await Sync success, verify runtime lesson watermark and taught words out of new_pool, then verify Pages deployment. Two-file publication alone does not mean the website is fully done.
6. Do not push from a GitHub Actions job with its ordinary GITHUB_TOKEN: that push does NOT trigger normal push-based Sync/Pages. Use the existing connected GitHub App or a separately authorized external App token, never place credentials in drafts or prompts. The isolated phase adds no secret, no third workflow, and no additional main writer.

### Isolated evidence, 2026-09-27

- Staging preflight run 36289105979: Stage 1 30/30 and Stage 2 14/14 passed; main Sync writer skipped.
- Deliberately incomplete draft run 36289276314: rejected with structured errors; writer skipped. The bad candidate was deleted, and cleanup run 36289307097 passed; main was not modified.
- Real Git Data sandbox transaction wrote only `staging/test-publish/lesson.json` and `staging/test-publish/index.json` together in one staging commit `6dfa9a59022c8568f33312aef29395851bab44cf`, both read back. A stale competing commit based on the previous stage HEAD was rejected as non-fast-forward (HTTP 422), and current ref did not move. Sandbox fixtures are not website files.
- Main and production 08:00/18:00 automations are untouched. A full real candidate → main → Sync → Pages run is still untested; no production switch has been claimed.

### Local checks

```bash
node --check .github/scripts/validate-lesson-candidate.js
node --check .github/scripts/plan-lesson-publication.js
node --check .github/scripts/check-staged-drafts.js
node .github/scripts/test-lesson-candidate.js
node .github/scripts/test-publication-plan.js
```
