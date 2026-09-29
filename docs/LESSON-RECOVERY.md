# Daily lesson release / 课程发布与恢复 V2 (single release branch)

## One authorized path

Only the existing 08:00 AM and 18:00 PM ChatGPT tasks create lessons. Neither a new task nor a new workflow is allowed. The authoritative inputs are the pinned main version of data/lesson-context.json, data/learning-runtime.json, data/daily/index.json and the complete existing learning-pool-rules.json. Keep both full lesson contracts and validate-lesson-candidate.js as the only course validator. Never fetch/overwrite large daily-vocab-data.js or weakness-sync.json in the lesson task.

1. Generate ONE complete candidate for context.target, preserving it in the task's visible result until GitHub confirms receipt. If an official lesson already exists, verify it instead. If today's release branch exists, read it first, recover the SAME original lesson, and do not create another candidate.
2. Create only lesson-release-YYYY-MM-DD-am|pm from fresh main. Write data/daily/YYYY-MM-DD-{am,pm}.json and data/daily/index.json on this release branch. The two branch writes may be separate. Read back BOTH files, ensure the unchanged candidate and the intended session-only index update. Do not open a PR while either is missing.
3. Open one release PR to main. The EXISTING sync-daily-vocab.yml workflow runs a read-only pull_request job (no GitHub writer on PR). .github/scripts/check-release-pr.js checks: the exact pull_request.head.sha checkout; exactly the two intended changed files; same unchanged candidate; complete validator, rules, new/review eligibility, completed seven-day core review; and that the entire release index equals plan-lesson-publication.js applied to the CURRENT main index. It emits RELEASE_PREFLIGHT with ok:true/status:ready, headSha, mainSha, candidateHash, baselineFingerprint and two paths. A failed/missing report or an unrelated success is NOT approval.
4. Verify the successful PR run's HEAD SHA equals the PR's CURRENT head SHA, and main relevant sources still match the report's baselineFingerprint. A changed PR head requires its own new successful PR preflight. If main's relevant data advanced, re-evaluate the unchanged candidate and regenerate only the branch index if still eligible; require PR synchronize/recheck. If eligibility changed, stop. Squash merge the PR using expected_head_sha; never merge the complete long-lived staging branch or publish directly to main from the ordinary Actions GITHUB_TOKEN.
5. Check the actual official lesson and index, the matching main push-triggered Sync success, runtime watermark, all just-taught new words leaving new_pool, updated next-session context, and the corresponding successful Pages deploy before VERIFIED_COMPLETE. The two lesson/index files enter main in ONE squash merge commit.

## Failure and idempotence

One date/session means one branch and one original lesson. For timeout, network failure, 409/422 race or unknown result, first READ the remote branch/lesson/index/PR; if the write actually succeeded, continue from there. Otherwise do at most one bounded retry on the same original after a fresh authorized state read. A pure structure error may receive one evidence-based correction without changing selected words or inventing answers; invalid eligibility must stop. Never force push, overwrite an already published different lesson, duplicate a PR, or guess success.

An explicit upstream safety refusal is not a network error: stop remote writes without switching APIs, keep the full candidate and exact tool error in the task-visible result (legacy status FAILED_UNSTAGED_DRAFT, now meaning failed first release-file write), and do not claim a remote SHA. Existing release content is authoritative if a later run recovers. On interrupted formal publication, verify both files and index before retrying. All tasks stay enabled.

## Removed from active timed path

No lesson-staging-v1 draft write, no staging push preflight, no second copy of the candidate on a separate release branch. Historical staging publisher/tests remain in the repository only for rollback reference until V2 has passed real AM and PM production acceptance; timed tasks MUST NOT call them. The only course publication route after activation is release branch -> successful SHA-pinned PR preflight -> PR squash merge -> existing main Sync/Runtime/Pages. Keep the single 08:12/18:12 Sync recovery: it detects missing lessons but cannot generate one.

## Deployment safety

Modify and test code first on a feature branch; do not update timed tasks before the new PR check works with exact synthetic positive/negative cases and the existing regression guards. Activation must change AM/PM prompts consistently and verify the first real AM and PM; simulated test success is not proof of future upstream tool acceptance.
