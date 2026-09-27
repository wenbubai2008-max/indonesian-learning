# Course prepublication and recovery / 课程发布与恢复约定

This file records the operational source-of-truth after the 2026-09-27 PM safety-check failure. The exact upstream safety rule of the original failure is **unknown** because the original scheduled run did not record its raw error; do not mislabel it as GitHub 403/422.

## Required path
- Read authoritative `data/learning-pool-rules.json`, `data/learning-runtime.json`, index and existing lesson; obey full AM/PM contracts. Main is the only formal data source.
- Generate the lesson ONCE and persist an unchanged candidate in `staging/drafts/YYYY-MM-DD-{am,pm}.json` on `lesson-staging-v1`. The production branch and index remain untouched until release.
- The existing `Sync daily vocab` workflow on staging is a read-only preflight. Match the run to the exact stage commit and draft path; preflight must succeed and staging's `sync` job must be skipped.
- Immediately before promotion, re-fetch main. Its SHA must match the successful preflight baseline; if main advanced, do not reuse that approval. Revalidate the same candidate, rather than regenerate it.
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
