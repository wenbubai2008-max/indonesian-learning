# Frontend cleanup: stage 1

Scope: remove confirmed unused JavaScript and retired no-op ownership stubs. No lesson data, storage formats, displayed text, CSS, live global functions, workflows, or Worker code changes.

Audited main: `de25472ae0cda04209eb8ce442ccad70a13a2276`.

## Reference audit

The search covered every repository HTML/JS entry point, script loaders, dynamically constructed filenames, builders, guards, workflow paths, and JSON manifests. A filename absent from `index.html` is not sufficient evidence for deletion.

| File or family | Decision | Evidence |
| --- | --- | --- |
| `data/bipa-vocab-01.js`, `data/bipa-vocab-02.js` | Delete | No references outside themselves, including no `bipa-vocab-` dynamic loader. Current BIPA uses per-level gzip files. |
| `data/daily-ui-fix.js` | Delete | No external filename references or dynamic loader. |
| `data/home-learning-upgrade.js` | Delete | No external references; active modules load `home-learning-upgrade-v2.js`. |
| `data/master-library-patch.js` | Delete | No external references or dynamic loader. |
| `data/master-vocab-click-stability.js` | Delete | No external references; its library-switcher detection is only an outgoing reference from this unused file. |
| `data/master-vocab-integration.js` | Delete | No external references; its library-switcher detection is only an outgoing reference from this unused file. |
| `data/pronunciation.js` | Delete | No external references; `pronunciation-fix.js` is the live loaded file. |
| `data/library-switcher.js` | Delete | No-op marker only. Its only JavaScript callers are the two unused master files above; no live HTML or dynamic loader loads it. |
| `data/vocab-bipa-state-20260917.js` | Delete | No-op marker only; referenced only by retirement assertions. |
| `data/home-modules-stability.js` | Delete | No-op marker only; references are historical documentation, guard, and an existing workflow path filter. The workflow is unchanged. |
| `data/bipa-gz-01.js` through `data/bipa-gz-08.js` | Keep | `build-bipa-level-chunks.js` constructs all eight filenames and decodes their combined payload. They are build inputs, even though most have no literal references. |
| `data/bipa-level-a1-gz.js`, `-a2-`, `-b1-`, `-b2-` | Keep | `bipa-json-loader-20260917.js` constructs the level path; runtime lazy loading depends on them. |
| `data/bipa-secondary-seed-20260917.js` | Keep | Consumed by runtime builders and protected by the UI guard. Absence of a direct HTML reference does not make it unused. |
| `data/master-vocab-secondary.js` | Keep | Consumed by runtime builders and lesson context; outside this cleanup scope. |
| `data/oral-vocab-candidates.js` | Keep | Consumed by runtime/planner tooling and governed by learning rules. |
| `data/vocab-review-ui.js` | Keep for now | It still enforces the three-column stats contract. It is not completely inert; moving that behavior belongs to the later style stage and requires visual verification. |

No removed filename is loaded by `index.html`, so no live script URL or content hash changed in this stage. Source remains recoverable in Git history.

## Guard intent and live ownership

- The UI guard now requires the retired library controller and BIPA state module to be absent and unreachable from both HTML and the active dynamic loader. This preserves the original intent: they cannot regain `DB`/`FILTER`/renderer ownership.
- The homepage guard retains the old inert-stub check for a pinned baseline and checks that the deleted stability script has no HTML load path in the proposed tree. Homepage ordering still belongs to `home-modules-layout.js`.
- `VocabController`, vocabulary filtering, marking, and library selection remain in `vocab-controller-20260917.js`; cards remain in `vocab-unified-renderer-20260917.js`.
- No live global function definition moved. The existing `dailyFixGrade`, `dailyLightChoice`, `dailyLightFillCheck`, `dailyLightOrderCheck`, and `loadReading` wrappers are unchanged; their consolidation is stage 4.
- All `indo_*` key names, formats, and readers/writers are unchanged.

## Acceptance status

Before changes: regression guard 1519 checks passed; vocabulary UI guard passed. The unmodified homepage was inspected at 1366px, with zero console errors and zero failed network requests when served at its GitHub Pages path.

After changes: regression guard 1519 checks passed; vocabulary UI guard passed; all 17 `.github/scripts/test-*.js` scripts passed (including 25 release-PR cases); both changed guards passed `node --check` and the diff passed `git diff --check`. The four protected frontend cache hashes still match their unchanged script content. The initial test run lacked a local `origin/main` ref; after restoring a verified local main snapshot, the five affected test scripts were rerun successfully without changing any tests.

The full before/after matrix is now complete: homepage, AM, PM, extensive reading, vocabulary, root families, weakness, quick practice, listening, automatic training, calendar, difficulties, and profile at widths 1366/1000/600/390. All 52 screenshot pairs are byte-identical JPEGs (therefore identical decoded pixels); all 52 DOM text snapshots are identical. The additional 2026-09-15 PM case at 390px retains 19:00 in both versions. Async lesson/reading/calendar captures wait for actual content readiness rather than capturing loading placeholders.

The storage fixture covers all 24 literal indo_* keys and the four indo_bipa_mem_ level keys found in active top-level frontend scripts and index.html. It contains weak-pool entries, quick/listen/auto progress and dummy sync configuration. The existing ceria quick/listen counts, auto stage 2 and next_due, memory states and sync endpoint/key/device remain intact. Weakness-pool normalization enriches the existing entry identically in both versions, preserving wrong_count, status and original timestamps. All requests to the dummy sync endpoint are mocked; the production Worker is never contacted. No console warnings/errors or 404 responses were observed during the full matrix.

## Remaining merge blocker: pre-existing homepage movement

Frame-by-frame sampling found a baseline acceptance failure in BOTH versions. The visible tool cards keep identical order, dimensions and 5/3/2/1 column layouts, but their absolute vertical position changes while the upper coach/profile modules initialize:
- 1366px: y=637 -> 675 -> 702 (65px total).
- 1000px: first-row y=637 -> 675 -> 702 (65px total).
- 600px: first-row y=737 -> 982 -> 1009 (272px total).
- 390px: first card y=847 -> 1092 -> 1119 (272px total; the intermediate sample can be skipped depending on timing).

This is not caused by deleting unloaded files. Nevertheless, the user's absolute acceptance requirement that homepage cards must not move during loading is not satisfied. Do not relabel this as passing and do not weaken the guard or expand stage 1 into the later styling phase. PR remains Draft/unmerged pending resolution of this baseline requirement. No post-merge Pages deployment is claimed; stages 2-6 have not started.
