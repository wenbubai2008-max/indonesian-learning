# Course prepublication and recovery / 课程发布与恢复约定

This file records the operational source-of-truth after the 2026-09-27 PM safety-check failure. The exact upstream safety rule of the original failure is **unknown** because the original scheduled run did not record its raw error; do not mislabel it as GitHub 403/422.

## Required path
- Read authoritative `data/learning-pool-rules.json`, `data/learning-runtime.json`, index and existing lesson; obey full AM/PM contracts. Main is the only formal data source.
- Generate the lesson ONCE and persist an unchanged candidate in `staging/drafts/YYYY-MM-DD-{am,pm}.json` on `lesson-staging-v1`. The production branch and index remain untouched until release.
- The existing `Sync daily vocab` workflow on staging is a read-only preflight. Match the run to the exact stage commit and draft path; preflight must succeed and staging's `sync` job must be skipped.
- Immediately before promotion, re-fetch main. Revalidate the SAME candidate against the latest relevant index, runtime, rules and same-day/prior lessons. An unrelated main SHA change alone is not a rejection; changed eligibility or a duplicate official lesson is. The new Git Data commit must use the actual latest main as its parent.
- The connected GitHub App may then atomically publish exactly the official lesson and index with one commit based on current main, non-force ref update. Never use normal Actions GITHUB_TOKEN to publish the lesson: its push will not trigger regular downstream push workflows.
- Read both files back. Confirm the matching main Sync run, runtime watermark, taught new words removed from runtime new_pool and the final Pages deployment. Only these checks justify VERIFIED_COMPLETE.

## Error evidence and recovery
Record phase, operation, ref/path, pinned main SHA, candidate/stage SHA if present, raw tool error code and safe message excerpt. Distinguish upstream app security block, connector argument/schema error, GitHub HTTP error, candidate validation, branch race, Sync, runtime and Pages. Never guess the security rule, never log a token.

If the stage write itself is blocked, DO NOT discard the generated JSON. Return the complete original candidate in the automation's user-visible result with `FAILED_UNSTAGED_DRAFT` and original error. This is a fallback in task history, not a confirmed remotely saved draft: accurately label it as such. If the stage write succeeded, reuse that path/SHA on subsequent recovery; don't create a second course. On an interrupted main write, read main and both files before deciding whether to retry. All failures leave the scheduled task enabled. No forced pushes, no new sync writer, no extra workflow, no unbounded retries.

Statuses: NO_CANDIDATE, FAILED_UNSTAGED_DRAFT, STAGED_PENDING, PREFLIGHT_BLOCKED, PUBLISHED_PENDING_SYNC, SYNC_FAILED, PAGES_FAILED, VERIFIED_COMPLETE.

The 2026-09-27 evening lesson was separately reconstructed and published after the original automated write failure. Its successful GitHub/Sync/Pages outcome does not prove why the first tool invocation was blocked.

## Fixed publisher and verification (2026-09-27)

- The fixed transaction lives at `.github/scripts/publish-staged-lesson.js`; its external authorized GitHub adapter is `.github/scripts/github-publish-adapter.js`. It revalidates the same staged candidate against **current relevant main data**, so unrelated main commits alone no longer veto an otherwise valid draft. A real branch race still stops with `MAIN_REF_CONFLICT` rather than forcing a push. Draft content remains intact.
- An authorized external GitHub App/PAT runner can dry-run with `LESSON_PUBLISH_TOKEN=... node .github/scripts/github-publish-adapter.js --date YYYY-MM-DD --session am|pm --stage-sha SHA`, and release with the extra `--publish` flag. The same command with `--verify-existing` instead of `--stage-sha` can complete a read-only Sync/Pages check later. Do not expose a token, and do not use the ordinary Actions GITHUB_TOKEN for external release. Connected ChatGPT GitHub tooling may follow the same fixed operations without exposing its token; the CLI token is **not provisioned by this repository change**.
- Existing staging preflight executes 30 Stage-1 +14 Stage-2 +12 publisher mock regressions, syntax-checks the adapter, and checks the current real published lesson read-only for no-op vs conflicting duplicate. Its Sync writer stays skipped on staging. The mock test uses stub Sync/Pages statuses; current real Actions status is verified separately. Do not call this proof of a future scheduled trigger.

## Connected ChatGPT GitHub route (2026-09-27)

The connected GitHub App does not expose a command-execution action for running arbitrary Node scripts in the repository, and this repository has no provisioned `LESSON_PUBLISH_TOKEN` for the CLI adapter. Thus the 08:00/18:00 ChatGPT tasks MUST perform the documented fixed publisher contract with connected GitHub actions; they must not claim to have directly executed the standalone Node CLI. Never request, print or store a token in lesson content.

- Stage exactly one candidate; read back the exact stage ref and lesson. Match the staging push run and read the successful preflight job's original log with `fetch_workflow_job_logs`. A successful workflow alone is INSUFFICIENT. Require a single matching `PREFLIGHT {...}` record with exact draft path, stage SHA, SHA-256 of normalized lesson JSON, valid main SHA, `ok:true`, `status:"ready"`, empty errors and fingerprint. Staging sync job must be skipped.
- Refresh main and fully revalidate the SAME candidate on current relevant data, regardless of unrelated main SHA advancement. When the CLI adapter is unavailable, publish using the connected GitHub App's scoped PR release path below. The standalone CLI still supports a two-file Git Data commit; never claim that ChatGPT ran that CLI. Do not use ordinary Actions GITHUB_TOKEN for external lesson publication.
- Read back lesson/index, matching main Sync run, runtime watermark/new pool and latest Pages status. A post-publication failure must never regenerate the lesson.
- On main ref error, read back main/lesson/index first. If remote already contains the identical lesson and index, use its actual commit for verification. Otherwise separate 401/403 permission, explicit 403/429 rate limit, actual non-fast-forward 409/422, other 422 validation, upstream tool safety block and unknown error. Never label all failures "branch conflict."

Current CI tests exercise the evidence and error classifications and read the real published lesson without mutating it. They are not proof of a future scheduled task run.

## Scoped PR release for scheduled ChatGPT lessons

The 2026-09-27 code-only PR #4 was squash-merged successfully by the connected GitHub App after direct `create_commit` calls were blocked upstream. This is evidence that normal PR merge is currently supported, not a promise that any future call will always succeed.

After the unchanged staged candidate passes the exact preflight-log checks and a fresh, relevant main-data validation:
1. Re-read main ref; create a dedicated `lesson-release-YYYY-MM-DD-am|pm` branch from that precise main SHA. Never use or merge the entire long-lived `lesson-staging-v1` branch as a release PR.
2. Create ONLY the official lesson file and update ONLY today's row in `data/daily/index.json` on the release branch; preserve all other dates and the other session flag. Sequential Contents API commits on this release branch are acceptable, since **main is not modified yet**. If either branch write fails, keep the staged candidate, do not open or merge a partial PR.
3. Re-read both branch files, compare `main...release`; require the diff contains exactly these two paths, with no other changes. Check latest main relevant inputs again. Open a PR targeting main, inspect actual diff and mergeable status; squash merge with `expected_head_sha`. If main advanced and the PR conflicts, do not force merge: keep the candidate and revalidate/recreate the release plan against the latest base.
4. GitHub reports one squash merge commit on main. Read back official lesson and index; verify the main Sync triggered by that commit and the latest Pages deploy. Do not claim VERIFIED_COMPLETE while either is pending. Do not delete the original staging draft merely because a PR was opened.

This changes the *transport* used by ChatGPT's already authorized connected GitHub App; it is not permission to evade an upstream safety rejection. Any rejection, including on PR actions, must be reported with its original error and remote state rather than retried through arbitrary substitutes.
