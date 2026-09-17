# Vocabulary legacy archive

These files are retired vocabulary UI/rendering patches. They are preserved only for historical reference and rollback.

Rules:
- Nothing under `archive/vocab-legacy/` may be loaded by `index.html`, runtime loaders, or production workflows.
- Current vocabulary UI is owned by `data/vocab-unified-renderer-20260917.js` plus `data/vocab-bipa-state-20260917.js`, `data/vocab-bipa-toolbar-compact-20260917.js`, `data/vocab-unified-ui-guard-20260917.js`, and `data/vocab-flip-content-fix-20260917.js`.
- 已掌握 / 待掌握 / 搜索 / 分类 / BIPA S-A-B / 翻卡 must all stay on the unified renderer.
- Do not restore archived renderers to fix a new issue. Fix the active unified chain instead.

Archived on 2026-09-17 after repeated regressions where old renderers resurfaced when script order changed.
