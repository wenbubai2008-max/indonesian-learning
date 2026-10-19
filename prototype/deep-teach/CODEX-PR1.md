# PR 1：网站带学换成「深讲版」（给 Codex 的实施说明）

仓库：`wenbubai2008-max/indonesian-learning`。从 `main` 新建分支 `deep-teach-site`，最后开一个 PR 到 `main`。
用户已确认要做这一步（2026-10-19）。动手前先按 `AGENTS.md` 的要求读 `docs/REGRESSION-GUARD.md` 和 `data/learning-pool-rules.json`。

## 1. 目标

课程顶部「今天的重点」卡片上的「开始带学」按钮，**有讲解数据时**打开新的深讲版，**没有讲解数据时**照旧打开现在的带学（`data/guided-lesson.js`）。

深讲版是一位"老师"一步步带你学本课的 5 个重点（3 个词 + 2 个句型）：先问、再讲、再考、再让你开口，隔两个环节换个新场景回想。用户已经在 Claude 里试玩过原型并认可这种讲法。

## 2. 现成的原型（照着移植，不要重新设计）

在分支 **`deep-teach-demo-builder`** 的 `prototype/deep-teach/` 下：

| 文件 | 内容 |
|---|---|
| `engine.js` | 完整的深讲引擎：先问再讲、会的快进、答错补讲、隔时回想、分级提示、结束页诊断 |
| `style.css` | 原型样式（含深浅色 token） |
| `validate.js` | 讲解数据的校验器（初稿） |
| `build.js` / `run.js` | 原型打包脚本 / Playwright 点击测试（weak / strong / mixed 三种学习者） |
| `teach-2026-10-18-pm.json` | 10-18 晚课的讲解数据（已通过校验） |
| `teach-2026-10-19-am.json` | 10-19 早课的讲解数据（已通过校验） |

讲解数据格式就以这两份 `teach-*.json` 为准（items / scan / reading / dialogue / tasks / next，以及文字里的 `{{可朗读印尼语}}`、`[[加粗印尼语]]`、`**加粗**` 标记）。

## 3. 要做的事

### 3.1 新文件 `data/deep-teach.js`
- 由 `prototype/deep-teach/engine.js` 移植。行为保持一致，只改这几处：
  - 不再读 `window.__LESSON / __TEACH`，改为暴露 `window.DeepTeach = { open(lesson, teach), validateShape, … }`。
  - 打开时是一个**全屏覆盖层**（参考 `guided-lesson.js` 的 `#glOverlay`），顶部有「回到整页」，关闭后回到原页面原位置；整页内容不变。
  - 覆盖层里的 header（标题、简明讲解、标出内容来源、环节导航）、对话区、底部按钮栏，全部放在覆盖层内部，CSS 用 `.dt` 前缀**限定作用域**，不能影响页面其他元素。深色模式要能用。
  - 朗读优先用页面已有的 `window.speak`，没有再用 `speechSynthesis`（lang `id-ID`）。
  - 不加载外部字体，印尼语字体用 `Georgia, "Times New Roman", serif` 这类系统字体。
  - 覆盖层里加一个小链接「用旧版带学」，点了关闭深讲版并打开 `GuidedLesson.open(…)`（兜底）。
- 把**纯逻辑**提出来成可测试的函数，挂在 `window.DeepTeach` 上，例如：
  - `dueRecalls(queue, pos)`：隔时回想只在中间隔了 ≥ 2 个环节后出现；第一次没想起来或看了提示，再隔 2 个环节考第二次，最多两次。
  - `classify(log, items)`：结束页的"下次课前再看一眼 / 已经稳了"分类，要区分"自己说出来"和"看了提示说出来"。
  - `md(text)`：标记转 HTML，必须先转义再替换标记。
- **不写任何 localStorage / 训练 / 回想 / 错题 / 掌握记录**（这一版什么都不存，包括"简明讲解"开关）。不调用 `WeaknessPool`、`LessonRecall`、`TrainingSync` 等任何写数据的接口。

### 3.2 讲解数据从哪来
按顺序找，找到就用：
1. `lesson.lesson_focus.teach`（第 2 个 PR 会让生成任务直接写在课程 JSON 里；这个 PR 只需要读，课程 JSON 一个都不要改）；
2. 旁挂文件 `data/teach/YYYY-MM-DD-am|pm.json`（`fetch`，404 视为没有）；
3. 都没有：打开旧带学，行为和现在完全一样。

拿到数据后先跑一遍轻量形状检查（`DeepTeach.validateShape`：有 items、每个 item 有 scene/check/say/final 等必需字段）。不合格就**退回旧带学**并在控制台 `console.warn`，不能让页面报错。

### 3.3 旁挂数据文件
- 新建 `data/teach/2026-10-19-am.json`、`data/teach/2026-10-18-pm.json`，内容就是原型分支里的两份 `teach-*.json`，**原样复制**。
- 这是试点用的；以后每天的讲解由第 2 个 PR 写进课程 JSON。

### 3.4 入口
- `data/history-v2.js` 里「今天的重点」卡片按钮（`data-guided-start="DATE-SESSION"`）的 HTML 不用改。
- 点击处理放在 `deep-teach.js`：拦截 `[data-guided-start]` 的点击（先于 `guided-lesson.js` 的处理，或由 `guided-lesson.js` 调用 `DeepTeach` 决定）。找到讲解数据就开深讲版，否则交给 `GuidedLesson.open`。两边**只能打开一个**覆盖层。
- `index.html`：在 `guided-lesson.js` 附近加 `<script src="data/deep-teach.js?v=…">`，用手写版本号缓存刷新（和 `guided-lesson.js?v=20261018-guided2` 一样的方式）。

### 3.5 校验器
- 把 `prototype/deep-teach/validate.js` 移成 `.github/scripts/validate-teach.js`，导出 `validateTeach(lesson, teach) → {errors, warnings}`，命令行用法保留：`node .github/scripts/validate-teach.js data/daily/D-S.json data/teach/D-S.json`。
- 错误码保持原型里的命名（`SCENE_QUOTE`、`CHECK_RIGHT`、`CHECK_WHY`、`CHECK_OK_REASON`、`SAY_SKEL_REF`、`RECALL_NOT_NEW`、`READING_CHUNKS`、`ITEM_MISSING`、`MARKUP` …）。
- 这个 PR 不改 `validate-lesson-candidate.js`（第 2 个 PR 再接进去）。

### 3.6 测试 `.github/scripts/test-deep-teach.js`
1. 两份旁挂数据对着对应课程 JSON 跑 `validateTeach`，必须 0 错误。
2. 把一份数据故意改坏（引用不是原文、两个正确答案、选项没解释、回想照抄课文、骨架和参考对不上、拆句拼不回原句、标记不配对、少一个重点），断言报出对应错误码。
3. 在 `vm` 里加载 `deep-teach.js`（假的 `window/document`），测 `dueRecalls`、`classify`、`md` 的行为，并断言源码里没有 `localStorage.setItem`、`recordLessonWrong`、`markMastered`、`indo_lesson_recall_v1`、`indo_automation_training_state_v1` 等写数据的调用。
4. 没有讲解数据的课程，选择逻辑返回"旧带学"。

在 `.github/workflows/build-learning-runtime.yml` 里接上：`paths` 加 `data/deep-teach.js`、`data/teach/**`、`.github/scripts/validate-teach.js`、`.github/scripts/test-deep-teach.js`；步骤里加 `node --check data/deep-teach.js` 和 `node .github/scripts/test-deep-teach.js`。**不要新建工作流。**

### 3.7 回归守卫与文档
- `.github/scripts/regression-guard.js`：新增检查，全部用 `okNew`（基线树上会跳过），至少包括：
  - `data/deep-teach.js` 存在，并在 `index.html` 带版本号加载；
  - 源码里没有写数据的调用（同 3.6 第 3 条的清单）；
  - 没有讲解数据时退回 `GuidedLesson`；
  - `data/teach/*.json` 每一份都能找到对应的 `data/daily/*.json`。
- `docs/REGRESSION-GUARD.md` 加 **§34**：写清入口、数据来源顺序、退回旧带学的条件、"不写任何记录"、旁挂文件只是试点。
- `docs/LESSON-JSON-SCHEMA.md`：加讲解数据格式说明（初稿），标明 `lesson_focus.teach` 是**可选**字段、这个 PR 只读不写。
- `docs/STORAGE-KEYS.md`：注明深讲版不新增任何存储键。

## 4. 不要碰

- 早晚课生成说明 `docs/tasks/*.md`、`validate-lesson-candidate.js`、任何定时任务、`sync-daily-vocab.yml`。
- 任何 `data/daily/*.json` 课程文件。
- `data/guided-lesson.js` 的现有行为（只允许加"交给深讲版"的那一个入口判断，如果你选择在那里接）。
- 词汇画像、课末回想、小测、复盘等其他模块。
- 不新增新词、题目或学习任务；整页上的小测、改写、复盘、课末回想、「我学完了」都不变。

## 5. 验收（全部要实际跑过再说通过）

1. `node .github/scripts/regression-guard.js` 全部 PASS；`node .github/scripts/vocab-ui-regression-guard.js` 通过；`.github/scripts/test-*.js` 全部通过。
2. 本地起服务（站点路径带 `/indonesian-learning/` 前缀），用 Playwright 在 **400px 宽**下：
   - 打开 10-19 早课和 10-18 晚课，点「开始带学」，进的是深讲版；
   - 用 weak / strong / mixed 三种策略各走完一遍（可参考原型的 `run.js`）：无控制台错误、无横向滚动、能走到结束页；
   - 再打开一节没有讲解数据的旧课（如 2026-10-17 早课）：进的是**旧带学**，行为不变；
   - 关掉深讲版后，整页还在原位，词卡默认收起不变。
3. 浅色和深色模式各截一张图看一眼。
4. 跑完 Playwright 后检查 localStorage：深讲版没有新增或改动任何键。
5. PR 合并后 GitHub Pages 部署成功，再在线上打开 10-19 早课确认一次。

用户之前给的验收标准，这些都要满足（原型已经满足，移植时不要丢）：
- 老师讲"为什么这样说、和哪个词区别"，不是照念词卡；
- 每个错误选项都有针对性的解释；"能用但不是最好"只给语法正确的说法，并写明适用场合；
- 提示逐级给（关键词 → 句子骨架 → 参考），不在第一步就泄露答案；
- 隔时回想换新场景、不展示刚才的答案，区分"自己说出来"和"看提示说出来"；
- 会的可以快进（「这个我会，直接考我」），不会的才多讲；
- 不写任何正式学习记录；
- 没有讲解数据的课程照常用旧带学。

## 6. PR 描述里写清楚

改了哪些文件、数据来源顺序、怎么退回旧带学、本地实际跑过哪些检查（带结果）、哪些要等部署后才能确认。
