# Single-release lesson publishing and recovery / 单分支课程发布与恢复

Source of truth: `data/learning-pool-rules.json` (full AM/PM contracts), `.github/scripts/validate-lesson-candidate.js`, `docs/LESSON-JSON-SCHEMA.md` and this protocol. `main` is the only formal learning-data source. Preserve all 977/mastered/focus/review-rotation rules, two lesson sessions, and the existing sole `Sync daily vocab` data writer. Never add a backup ChatGPT task, extra workflow, second derived-data writer or OpenAI API dependency.

## Resume first, then five operations

At the start of every 08:00/18:00 run, determine the **remote checkpoint before generating anything**. Read the official lesson/index plus the single named release branch and any same-day release PR if they exist. Resume from the furthest verified state:

- official lesson already on main -> do not regenerate; verify Sync/runtime/context/Pages only.
- release PR exists -> do not recreate files or PR; inspect that exact PR/head and continue preflight/merge/verification.
- release branch contains both exact lesson + index -> do not regenerate or rewrite; create/recover the one PR.
- release branch contains only one of the two files -> recover the missing file from the same original candidate/plan, then verify the two-file diff.
- release branch exists but has no recoverable complete candidate -> stop with evidence; never invent a second candidate.
- no release state exists -> only then generate one candidate.

Group initial read-only state checks where possible. After a successful stage, re-read only the remote objects needed to prove that stage; do not repeatedly refetch unchanged large inputs “for safety”. The goal is fewer connector calls without weakening any validator.

## Five operations
1. Pin the exact current main SHA; read its lightweight context, runtime and index. Check context target/source hashes, watermarks, previous completed lesson and seven-day history. If wrong/stale or official lesson already exists, stop or verify existing. Generate **one complete, recoverable** AM/PM JSON from context candidates only when the checkpoint rules above show that no recoverable candidate exists; preserve the original unchanged.
2. Reuse the one branch `lesson-release-YYYY-MM-DD-am|pm` if it already exists, checking its real remote files/status first. Otherwise create it from pinned latest main. Never overwrite an existing different candidate or generate another lesson for the same date/session.
3. Write only `data/daily/YYYY-MM-DD-am|pm.json` and `data/daily/index.json` to that release branch, based on the immutable original candidate. Sequential Contents API writes are acceptable off main. Use `.github/scripts/plan-lesson-publication.js` for the exact index transaction. Re-read both files once after the pair is complete, verify the candidate and preserved historical/index counterpart fields, and compare main...release: **exactly these two paths**. Never open a PR for a partial branch.
4. Open or reuse the one PR against main. The **existing** `sync-daily-vocab.yml` read-only `pull_request` preflight runs the authoritative validator via `check-release-pr.js` on exact PR base/head SHAs, context hashes, seven-day review history, eligibility, and exact planner output. Require one matching original `RELEASE_PREFLIGHT {...}` line: `candidate` exact path, `releaseSha` exact PR head, `mainSha` actual PR base, `candidateHash` matching normalized JSON, valid `baselineFingerprint`, `ok:true`, `status:"ready"`, `errors:[]`; preflight job and PR run must succeed, sync job must be skipped. Check current PR head, diff and mergeability immediately before `squash` merge with `expected_head_sha`. If main advanced, check the latest relevant context/index/runtime/rules and revalidate the **same** candidate; never create a second branch/candidate.
5. Main push triggers the existing single Sync; verify official lesson+index, matching main Sync success, runtime watermark, new words removed from `new_pool`, next-session context and final Pages deployment. Only then `VERIFIED_COMPLETE`. No direct task writes to daily-vocab/runtime. The connected GitHub App has no arbitrary Node execution action: do not claim to have run a standalone CLI.

The read-only PR check runs **after** both branch writes, not on each partial branch push. It is a publication gate for the task: CI alone does not substitute for checking its actual run/head and merge status; if branch-protection required checks are not configured, do not claim GitHub globally prevents a separate manual merge.

## Failure recovery, without a second candidate

Always preserve phase, ref/path, pinned main SHA, candidate/hash if available, raw tool error and request ID if returned. Read remote state first after timeout, network error, 409/422 or uncertain write outcome. Retry only a confirmed incomplete operation with the same content; no force push, no blank commit, no new branch naming.

**Retry policy:** for retryable transport/API failures such as timeout, connection reset, 429, 5xx, or an uncertain response, first re-read remote state and then make at most two bounded retries of the exact incomplete operation. Respect an explicit GitHub `Retry-After`/rate-limit instruction. A deterministic 4xx validation/permission error is not fixed by waiting. An explicit upstream safety refusal must not be spammed or bypassed through another API. The ChatGPT scheduler has no sub-hour recurring schedule, so this protocol does not pretend to create a separate “retry in one minute” task; retries happen only inside the current run when the operation is actually retryable.

**Learning-first fallback:** once a complete candidate exists, a publication failure must not hide the lesson from the learner. The automation result must present the same complete candidate (not a regenerated substitute), identify the furthest checkpoint and remote branch/path, and state clearly that website publication is incomplete. A later run must resume that same candidate from the remote checkpoint.

- **Before the first remote write:** keep the full original JSON in the automation's visible result if rejected. This is NOT a remote backup. Report `FAILED_UNSTAGED_DRAFT` (legacy status string, meaning original release candidate not remotely saved) and the exact tool error. Do not switch APIs, rewrite safety-blocked content, or invent a successful remote commit.
- **After one branch write:** read the branch. Keep its candidate and complete the missing exact index/lesson using the original. Do not open PR or treat the partial branch as published.
- **Invalid structure:** a real validator finding may receive at most one bounded, auditable structure-only correction on the same branch, retaining the initial original and all word/review/reading/answer semantics. A second failure, semantic issue, eligibility issue, source mismatch or safety rejection stops.
- **PR check failed/missing/stale:** do not merge. Verify the exact base/head and raw logs. A run for another SHA, only synthetic tests, or a green summary without `RELEASE_PREFLIGHT` is insufficient.
- **Main moved / conflict:** check main lesson/index first; if already identical, verify existing. Otherwise confirm relevant baseline validity before updating the same release branch and require new PR preflight; never reuse stale approval.
- **After merge:** never regenerate the lesson. Only inspect/resume Sync/Pages and existing data writer.

Status examples: CONTEXT_STALE, FAILED_UNSTAGED_DRAFT, RELEASE_PARTIAL, PREFLIGHT_BLOCKED, RELEASE_PENDING_MERGE, PUBLISHED_PENDING_SYNC, SYNC_FAILED, PAGES_FAILED, VERIFIED_COMPLETE. Leave both daily automation tasks enabled on any failure.

## Migration boundary
The historical `lesson-staging-v1`, `check-staged-drafts.js`, `publish-staged-lesson.js` and `github-publish-adapter.js` document the 2026-09-27/29 incidents but are no longer on the active automated ChatGPT lesson path. Their existence is not an instruction to stage twice. Do not remove historical lesson files, disable tasks, or weaken the old validator. Test the new path on an isolated code PR and with synthetic interruption/duplicate/conflict cases before switching the two task prompts. Real subsequent AM and PM releases are the final operational acceptance.
