# Single-release lesson publishing and recovery / 单分支课程发布与恢复

Source of truth: `data/learning-pool-rules.json` (full AM/PM contracts), `.github/scripts/validate-lesson-candidate.js`, `docs/LESSON-JSON-SCHEMA.md` and this protocol. `main` is the only formal learning-data source. Preserve all 977/mastered/focus/review-rotation rules, two lesson sessions, and the existing sole `Sync daily vocab` data writer. Never add a backup ChatGPT task, extra workflow, second derived-data writer or OpenAI API dependency.

## Resume first, then five operations

At the start of every 08:00/18:00 run, determine the **remote checkpoint before generating anything**. Read the official lesson/index plus the single named release branch and any same-day release PR if they exist. Resume from the furthest verified state:

- official lesson already on main -> do not regenerate; verify Sync/runtime/context/Pages only.
- release PR exists -> do not recreate the lesson or PR; inspect that exact PR/head. The existing GitHub lesson release job owns index generation, authoritative preflight and squash merge.
- release branch contains the exact lesson but no index -> this is now the normal pre-PR checkpoint. Do not write index from ChatGPT; create/recover the one authorized PR and let GitHub Runner generate it from current main.
- release branch already contains lesson + index -> treat it as a resumable older/interrupted checkpoint; reuse the same PR/branch and let GitHub Runner recompute the exact index if needed. An index-only branch is invalid and must not invent a lesson.
- release branch exists but is **identical to current main**, has no lesson file, no index-only change, and no same-day PR -> treat it as an empty release scaffold, not as a saved candidate. Reuse that same branch and continue as the one allowed generation/write path if the current context is still valid; never create a second branch.
- release branch has any nonempty change or candidate evidence but no recoverable complete lesson -> stop with evidence; never overwrite it or invent a second candidate.
- no release state exists -> only then generate one candidate.

Group initial read-only state checks where possible. After a successful stage, re-read only the remote objects needed to prove that stage; do not repeatedly refetch unchanged large inputs “for safety”. The goal is fewer connector calls without weakening any validator.

## Five operations
1. Pin the exact current main SHA; read its lightweight context, runtime and index. Check context target/source hashes, watermarks, previous completed lesson and seven-day history. If wrong/stale or official lesson already exists, stop or verify existing. Generate **one complete, recoverable** AM/PM JSON from context candidates only when the checkpoint rules above show that no recoverable candidate exists; preserve the original unchanged.
2. Reuse the one branch `lesson-release-YYYY-MM-DD-am|pm` if it already exists, checking its real remote files/status first. Otherwise create it from pinned latest main. A branch that is byte-for-byte identical to current main, has no lesson/index delta and no PR is only an empty scaffold and may receive the one candidate; any nonempty or ambiguous branch must be preserved and never overwritten.
3. ChatGPT writes only `data/daily/YYYY-MM-DD-am|pm.json` to that release branch, then re-reads that exact lesson once. It must not update `data/daily/index.json`. Open/reuse the same-day PR with the body marker `AUTO_PUBLISH_LESSON=1`. The existing `sync-daily-vocab.yml` lesson release job pins current main, runs the trusted `plan-lesson-publication.js` there, writes the exact planned `data/daily/index.json` to the release branch, and preserves the unchanged lesson candidate.
4. The lesson release job rejects unrelated paths, validates the same unchanged lesson against the latest main, requires the final PR diff to be exactly lesson + generated index, runs `check-release-pr.js` on exact base/head SHAs, and only then squash-merges the exact final head SHA. Its raw log must contain a successful `RELEASE_PREFLIGHT {...}` for the final head and `LESSON_RELEASE_PUBLISHED ...` after merge. If main advances before merge, it must not force or merge stale data; preserve the same branch/PR and recompute the index from the newer main on the synchronized/retried run. Never create a second branch/candidate.
5. After the lesson release job squash-merges with `GITHUB_TOKEN`, it must explicitly `workflow_dispatch` this same `sync-daily-vocab.yml` on `main`, because token-authored merges do not reliably recurse into normal `push` workflows. That dispatched run is the existing single Sync. Verify official lesson+index, matching Sync success, runtime watermark, new words removed from `new_pool`, next-session context and final Pages deployment. Only then `VERIFIED_COMPLETE`. No direct task writes to daily-vocab/runtime.

The lesson release PR job is now the publication owner for the final two-file transaction. ChatGPT performs only the lesson write and PR creation; GitHub Runner performs index generation, exact two-file validation and squash merge. CI logs still must be checked against the exact final head; do not infer success from a green run for an earlier SHA.

## Failure recovery, without a second candidate

Always preserve phase, ref/path, pinned main SHA, candidate/hash if available, raw tool error and request ID if returned. Read remote state first after timeout, network error, 409/422 or uncertain write outcome. Retry only a confirmed incomplete operation with the same content; no force push, no blank commit, no new branch naming.

**Retry policy:** for retryable transport/API failures such as timeout, connection reset, 429, 5xx, or an uncertain response, first re-read remote state and then make at most two bounded retries of the exact incomplete operation. Respect an explicit GitHub `Retry-After`/rate-limit instruction. A deterministic 4xx validation/permission error is not fixed by waiting. An explicit upstream safety refusal must not be spammed or bypassed through another API. The ChatGPT scheduler has no sub-hour recurring schedule, so this protocol does not pretend to create a separate “retry in one minute” task; retries happen only inside the current run when the operation is actually retryable.

**Runner recovery parity:** the existing lesson release job follows the same unknown-outcome rule for its own GitHub mutations. After a merge API error it re-reads the PR before retrying; after an uncertain workflow dispatch it checks for a newly created `workflow_dispatch` run before retrying. A rerun of an already-merged lesson PR must repair a missing post-merge Sync instead of exiting merely because the PR is closed.

**Learning-first fallback:** once a complete candidate exists, a publication failure must not hide the lesson from the learner. The automation result must present the same complete candidate (not a regenerated substitute), identify the furthest checkpoint and remote branch/path, and state clearly that website publication is incomplete. A later run must resume that same candidate from the remote checkpoint.

- **Before the first remote write:** keep the full original JSON in the automation's visible result if rejected. This is NOT a remote backup. Report `FAILED_UNSTAGED_DRAFT` (legacy status string, meaning original release candidate not remotely saved) and the exact tool error. Do not switch APIs, rewrite safety-blocked content, or invent a successful remote commit.
- **After lesson branch write:** read the branch. If the lesson exists unchanged, do not write index from ChatGPT. Open/reuse the authorized PR so the GitHub lesson release job can generate the exact index. If only index exists without the lesson, stop as invalid; never invent a replacement candidate.
- **Invalid structure:** a real validator finding may receive at most one bounded, auditable structure-only correction on the same branch, retaining the initial original and all word/review/reading/answer semantics. A second failure, semantic issue, eligibility issue, source mismatch or safety rejection stops.
- **PR check failed/missing/stale:** do not merge. Verify the exact base/head and raw logs. A run for another SHA, only synthetic tests, or a green summary without `RELEASE_PREFLIGHT` is insufficient.
- **Main moved / conflict:** check main lesson/index first; if already identical, verify existing. Otherwise confirm relevant baseline validity before updating the same release branch and require new PR preflight; never reuse stale approval.
- **After merge:** never regenerate the lesson. Only inspect/resume Sync/Pages and existing data writer.

Status examples: CONTEXT_STALE, FAILED_UNSTAGED_DRAFT, RELEASE_PARTIAL, PREFLIGHT_BLOCKED, RELEASE_PENDING_MERGE, PUBLISHED_PENDING_SYNC, SYNC_FAILED, PAGES_FAILED, VERIFIED_COMPLETE. Leave both daily automation tasks enabled on any failure.

## Migration boundary
The historical `lesson-staging-v1`, `check-staged-drafts.js`, `publish-staged-lesson.js` and `github-publish-adapter.js` document the 2026-09-27/29 incidents but are no longer on the active automated ChatGPT lesson path. Their existence is not an instruction to stage twice. Do not remove historical lesson files, disable tasks, or weaken the old validator. Test the new path on an isolated code PR and with synthetic interruption/duplicate/conflict cases before switching the two task prompts. Real subsequent AM and PM releases are the final operational acceptance.
