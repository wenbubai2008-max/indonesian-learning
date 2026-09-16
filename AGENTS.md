# Repository change rules

Before changing this repository, **always** read:

1. `docs/REGRESSION-GUARD.md`
2. `data/learning-pool-rules.json`

Then follow this mandatory sequence:

1. **Lock the requested scope.** If the request is “only change time”, do not change layout, lesson structure, vocabulary logic, workflows, or unrelated code.
2. **Search the full impact surface first.** Search all relevant literals, selectors, task names, data fields, workflows, and compatibility code before editing.
3. **Change the source of truth, not the rendered symptom.** Prefer static HTML/CSS/data/rules over post-render DOM rewriting. Do not add a global `MutationObserver` to repair static text or layout after load.
4. **Make the smallest possible change.** Do not refactor unrelated code during a bug fix.
5. **Run the regression guard:** `node .github/scripts/regression-guard.js`.
6. **Inspect the diff.** Confirm only intended files/lines changed.
7. **For UI changes:** verify first paint, refresh behavior, card order/size, responsiveness, and that GitHub Pages deployment succeeds.
8. **For lesson/task changes:** verify 08:00 and 18:00 contracts, runtime=977, single daily-vocab writer, and that tasks are not auto-disabled.

## Never reintroduce these failures

- Do not create temporary GitHub Actions/workflows for one-off debugging, recovery, or lesson generation.
- Do not add duplicate writers for `data/daily-vocab-data.js`; `sync-daily-vocab.yml` is the single writer.
- ChatGPT lesson automations must not directly read/replace the large `weakness-sync.json` or `daily-vocab-data.js`; use `data/learning-runtime.json` for eligibility.
- Do not compress or simplify the AM/PM lesson contract while fixing an unrelated problem.
- Do not use whole-page/character-data MutationObservers to change static UI text, time labels, or layout.
- Do not render one layout first and then transform it into another with JS; critical first-paint layout must exist in early CSS.
- Do not change historical PM display semantics when changing the current schedule. PM switched from 19:00 to 18:00 starting `2026-09-16`; older history remains 19:00.

If a proposed change conflicts with `docs/REGRESSION-GUARD.md`, stop and resolve the conflict before writing.
