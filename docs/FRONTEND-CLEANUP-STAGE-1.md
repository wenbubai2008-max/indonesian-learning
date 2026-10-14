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

The full before/after matrix must cover homepage, AM, PM, extensive reading, vocabulary, root families, weakness, quick practice, listening, automatic training, calendar, difficulties, and profile at widths 1366/1000/600/390. An additional pre-2026-09-16 PM case protects the 19:00 history rule. The fixture includes weak-pool, quick/listen/auto progress and dummy sync configuration; it never contacts the production Worker.

**Do not merge until the full screenshot/storage comparison is complete.** During baseline capture the browser automation transport disconnected (`Transport closed`); the initial homepage screenshot alone is not full acceptance. No screenshot equivalence or post-merge Pages verification is claimed yet.
