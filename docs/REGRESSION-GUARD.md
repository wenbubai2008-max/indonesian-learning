# Regression Guard / 回归保护清单

本文件记录这个项目已经真实发生过的问题，以及以后任何修改必须遵守的固定检查流程。目的不是“提醒一下”，而是把踩过的坑变成长期约束。

## 1. 当前架构与唯一真源

### 学习规则
- 权威规则：`data/learning-pool-rules.json`
- 主词库总数：977
- 新词池：`M ∩ A − D`
- 复习池：`A ∩ D`
- `daily-vocab` = 已正式教过，不等于 mastered
- mastered 只看 weakness 的 `status=mastered`

### 运行时词池
- 文件：`data/learning-runtime.json`
- 生成器：`.github/scripts/build-learning-runtime.js`
- 08:00 / 18:00 课程任务只通过 runtime 判断新词/复习资格
- 不允许课程任务直接读取大体积 weakness / daily-vocab 后重新计算资格

### daily-vocab 写入
- 唯一 writer：`.github/workflows/sync-daily-vocab.yml`
- 不允许第二个 PM writer、临时 writer 或课程任务自己整文件覆盖

### 当前课程时间
- AM：08:00
- PM：18:00
- PM 切换日期：`2026-09-16`
- `2026-09-15` 及以前历史 PM 仍属于 19:00，不得批量改成 18:00
- 20:00 补漏任务已于 `2026-09-16` 关闭；正式学习任务只保留 08:00、12:00、18:00
- V2 兜底时间门：AM 不早于 08:30（Claude 08:00 早课任务约 07:24 开始生成，需要留出发布时间），PM 不早于 18:05；cron 为 `30 1 * * *` 与 `5 11 * * *`
- **V4 备用课程生成：自 2026-10-03 起暂时完全停用（用户明确指示）。** Claude 是唯一的自动课程生成者：约 07:24 开始生成 08:00 早课，17:30 开始生成 18:00 晚课。上面的 08:30/18:05 时间门与两条 cron 保留，但只做健康检查、Sync 和“恢复同一份已保存原稿”，不再生成任何备用课程。原先计划把 PM 兜底从 18:05 延后到 18:30 的修改已撤销（从未落地）。只有用户明确指示后才能重新启用，并须同步更新回归守卫。

## 2. 已发生过的错误，禁止再次出现

### A. 修一个问题时删弱课程要求
发生过：为了缩短 19:00 提示词，把详细词卡、dialogue、rewrite、中文提示等要求删弱，导致课程退化。

以后：
- UI、时间、部署问题不得顺手修改 `am_contract` / `pm_contract`
- PM 详细度不得低于 2026-09-14 标准
- `formation`、`synonym_note`、`root_cn`、08:00复现标记、阅读、对话、rewrite/application、6题测试+self_check、final review 均属于固定合同

### B. 大文件被连接器截断后误判“不能写”
发生过：任务读取 `daily-vocab-data.js` 被截断，又因为 update_file 是整文件替换，主动停止甚至暂停任务。

以后：
- 课程生成任务（现为 Claude 定时任务，此前为 ChatGPT）不直接写 daily-vocab
- GitHub Runner 在仓库内完整读取并同步
- 课程生成任务只写当天唯一 AM/PM lesson JSON 到 `lesson-release-YYYY-MM-DD-am|pm` 分支，并打开带 `AUTO_PUBLISH_LESSON=1` 的同仓库 PR；`index.json` 由现有 `sync-daily-vocab.yml` 的 lesson release job 基于最新 main 与权威 planner 自动生成。课程生成任务不直接 update `data/daily/index.json`。

### C. weakness 结构解析错误
发生过：对 `{version, updated_at, words}` 顶层直接 `Object.values(parsed)`。

以后：
- weakness 解析只在 GitHub Runner builder 中完成
- 课程任务不自行解析完整 weakness

### D. 全局 MutationObserver 导致首页卡顿
发生过：为了把 19:00 改成 18:00，监听整个 document + characterData，再反复修改 DOM，导致刷新/首页卡顿。

以后：
- 禁止为静态时间、文字、卡片布局增加 whole-page / character-data observer
- observer 只能用于非常局部且不可避免的动态节点，而且不得在回调中制造同类 DOM 变化循环
- `data/vocab-dom-compat.js` 不得再增加全页面 MutationObserver

### E. FOUC：刷新先看到旧长卡，再变成新卡
发生过：HTML 首屏按旧两列大卡渲染，JS 后加载再改成 6 个小卡。

以后：
- 首屏关键布局必须在页面早期加载 CSS 中已有最终形态
- 不允许“旧布局 first paint → JS transform → 最终布局”
- 当前首屏关键 CSS 在 `data/daily-width-fix.css`

### F. 卡片顺序在刷新时交换
发生过：原始 HTML 顺序与 JS 最终顺序不同。

当前首页的“听词 / 快速练习 / 自动训练”位于独立的快捷训练栏；下方“其他学习工具”的可见顺序固定为：
1. 泛读
2. 词汇学习
3. 词根家族
4. 弱项强化
5. 难点解释

五张工具卡同宽同高。桌面端五列，中等屏三列，手机端两列，窄屏一列。`daily-width-fix.css` 的首屏样式与 `home-modules-layout.js` 的 DOM 顺序必须保持一致；不得在加载后重新排卡。

### G. 改时间牵连布局/逻辑
发生过：用户只要求 19→18，却通过运行后 DOM patch 带来卡顿、闪烁和卡片变化。

以后采用“范围锁”：
- 只改时间 = 只改 schedule / time contract / 必要显示兼容
- 不动学习卡结构、不动词池、不动课程详细度、不重构无关代码
- PM 页面时间必须按日期判断：`2026-09-16` 起 18:00，之前历史 19:00
- 当前首页和当前PM短文的静态首屏值直接写在 `index.html` 为18:00；不得再靠 DOM patch 把19:00改成18:00

### H. 临时 workflow 污染仓库
发生过：补课/审计过程中创建大量一次性 Actions workflow，导致噪声与潜在竞争。

以后 `.github/workflows` 长期只保留必要 workflow。当前应只有：
- `build-learning-runtime.yml`
- `sync-daily-vocab.yml`

任何新增 workflow 必须有长期必要性，不能只是一次性修复手段。

泛读发布不新增第三条 workflow。2026-09-30 起，长期发布逻辑放在现有 `sync-daily-vocab.yml` 的独立 `extensive_reading_release` PR job 中，但该 job **不得读写 daily-vocab/runtime**。泛读生成任务（2026-10-08 起为 Claude 定时任务，此前为 ChatGPT）每天只在同日 `extensive-reading-YYYY-MM-DD` 隔离分支写一个临时候选 `data/extensive-reading-candidate.json` 并打开带 `AUTO_PUBLISH_EXTENSIVE_READING=1` 标记的同仓库 PR；GitHub Runner 从受信任的 main 脚本生成/验证旧文归档、轻量历史索引与今日单篇文件，删除候选文件后用 PR head 精确 SHA squash merge。这样正式 main 仍只有一个发布 commit，历史三文件事务由 GitHub 完成，泛读生成任务不直接移动 main ref 或连续写三个正式文件。若 main 在生成/合并期间前进，保留 release 分支并停止，不 force push、不用旧 base 强并。 Runner 校验完成后，最终分支提交使用 `[skip ci]`，避免自身推送再触发一次 `pull_request synchronize`。squash merge 必须显式设置不含跳过标记的 commit_title 与 commit_message，确保正式 main 的 Pages 部署照常触发。普通候选提交不加跳过标记，仍正常校验；保留已 merged/closed 的幂等退出作为兼容保护。若以后启用强制 PR 状态检查，须重新评估此策略，不得绕过分支保护。

### I. 课程规则写对了，但实际 JSON Schema 仍写错
发生过：`2026-09-16` 18:00 晚课内容本身正确，但 3 道 choice 漏写 `answer_index`，导致网页把正确答案判成红色；同一份课还一度把 `review.steps` 写成 `review.items`，self_check 前端也曾不显示。

以后：
- 不允许只检查 `learning-pool-rules.json` 里的“规则文字正确”
- `.github/scripts/regression-guard.js` 必须直接读取最新 PM JSON 做实际结构校验
- 3 个 choice 必须逐题校验 `answer_index` 是有效整数，并且若同时有 `answer`，两者必须指向同一个答案
- 2 个 fill 必须有同行中文提示、answer、explain
- 1 个 order 必须有完整中文 prompt、5–8 个 tokens、answer、answer_cn、explain
- `daily_test.self_check` 必须是非空字符串数组
- final review 固定 `{title, steps:[...]}`
- 前端保留 legacy fallback 只是容错，不能代替标准 JSON Schema

### J. 2026-09-25–27 GitHub 写入事故复盘

最近的“被拒绝”并非同一种错误，必须保留分层原始证据：

- 2026-09-25 Sync daily vocab Run 36082208974：旧流程在生成派生提交后执行 `git pull --rebase origin main`，在 learning-pool-audit、learning-runtime、vocab-profile 三个派生文件发生合并冲突。禁止 rebase 已计算的派生文件。
- 2026-09-25 Run 36107087843：`Completed lesson recurrence missing from daily-vocab: sederhana`，属于正式学习复现记录缺失，不是 GitHub 分支拒绝。
- 2026-09-25 Runs 36127241719 / 36156542366：PM 的 dialogue/rewrite 结构不合合同，被回归守卫阻断；应修复实际课程 JSON，不得只改规则文字。
- 2026-09-26 Run 36216189130：回归脚本正则表达式未闭合，产生 SyntaxError；修改守卫时必须做语法检查和实际回归。
- 2026-09-26 提交 5c84f634：仅有 AM 文件，没有与 index 原子提交；不能凭课程文件存在宣布成功。
- 2026-09-27 ChatGPT 连接器的 fetch_file 曾错把 `repository_full_name` 传为 `repo_full_name`；必须核对每个工具独立 schema。最初 update_ref 的完整原始异常未留存，不能武断归为同一种错误。

防复发：Build 与 Sync 必须共用 `learning-data-write` 写入锁并禁止中途取消；派生写入前基于最新 origin/main 重算，若 main 前进则丢弃未发布计算结果并有界重试，严禁 stale rebase / force push / 空提交。ChatGPT 只提交 lesson；GitHub Runner 必须在同一 release PR 中生成精确 index，并且正式 main 最终只能通过一个 squash commit 同时获得 AM/PM lesson + index。后续 Sync 成功、runtime 水位与新词退出三重验证后才能宣称成功。所有自动任务失败保持 enabled=true。GitHub Actions 日志和 ChatGPT 连接器错误是两种来源，缺失原始错误时明确标为无法确认。

### K. 失败自动补偿与故障台账（2026-09-27）

- 正常 AM/PM：课程生成任务写唯一 lesson 并打开授权 release PR；GitHub Runner 从最新 main 自动生成 index、运行权威校验并按最终 head SHA squash merge，使 lesson + index 以一个正式 main commit 原子进入。由于该 merge 使用 `GITHUB_TOKEN`，lesson release job 随后必须显式 `workflow_dispatch` 同一个 `sync-daily-vocab.yml` 的 main 运行，不能假设普通 push 会递归触发。该 Sync 完成完整回归、同步、推送后重新读取远端 main，再运行一次回归确认；只有通过才报告同步成功。雅加达 08:12、18:12 各保留一次兜底定时触发（UTC 01:12、11:12），先只读确认课程、index、runtime、水位、新词退出与回归结果；全部健康即直接结束，不运行 builder、不提交、不部署；仅异常才进入已有安全重算。GitHub cron 无法基于前次成功动态取消事件，故健康时仍会启动一次轻量任务，但不进行修复工作；可能有平台延迟。
- 两个现有 writer 均采用最新 main 重算与有限重试；不使用 stale rebase、不强推、不重复生成课程、不制造空提交。定时补偿仅能恢复已经正确提交且 index 标记完成的课程；课程生成任务在提交前失败时，GitHub 无法凭空生成未保存的课程。
- 每次 GitHub Actions 失败：捕捉初步类别、失败阶段、退出码、时间、触发 SHA、当前本地/远端 HEAD 与原始 Run URL；写入 Job Summary，使用 upload-artifact 保存 90 天，并通过 issues:write 按 workflow+category+phase 去重建立/更新 GitHub Issue。原始完整异常以 Run 日志为准，不把初步类别当成已证实根因。
- 如果仓库 Issues 或 artifact 服务自身不可用，原始 GitHub Run 日志依然保留；Issue/附件不可用须明确说明，不得声称记录完整。
- 定时补偿需要真正幂等：runtime 比较跨 VM 来源的派生数组时按 JSON 内容比较，而不是要求原型完全相同；runtime 与词汇画像的数据内容无变化时沿用上一次 `generated_at`，审计时间和 runtime 保持一致；即使定时检查运行，也不能因时钟变化而推送三份派生 JSON、触发无意义 Pages 部署。数据确实变化时才刷新时间戳与提交。
- 不新建第三条 workflow；不在失败恢复时修改课程内容或学习词池；不使正式 08:00/18:00 自动任务 disabled。历史事故另见上一节 J。

### 课程 release 的 main 前进与 bot 批准运行（2026-10-14）

- `lesson_release` 不得再报“the synchronize run will recompute the index”后退出并等待下一次运行。初次准备之外，同一 job 最多重试 2 次；push 后、等待 mergeability 时及 merge API 重试前发现 main 前进，均回到同一有界循环。
- 用 `git diff --name-only "$release_base" "$latest_main"` 判断 main 变化是否涉及 `data/daily/`。未涉及时，不再提交或 push index，但必须从 `latest_main` 的受信任 worktree 重跑权威 planner（`--main-head "$latest_main"`）和 release validator；资格、context 或课程校验不通过仍停止，不能因“只是 runtime/weakness 更新”跳过校验。
- 涉及时，将最新 main 普通 merge 到原 release 分支，基于最新 main 重生成 index，提交、普通 push 并再次校验。只有生成文件 `data/daily/index.json` 的冲突可以用权威 planner 的输出解决；原课程或其他冲突必须停止。不得 rebase、force push、修改原课程、创建第二个分支/PR或启用 V4。
- GitHub 自 2026-06-11 起允许 `GITHUB_TOKEN` 创建/更新 PR 产生 `opened/synchronize/reopened` 运行，但这些运行需要人工批准；[官方 GITHUB_TOKEN 文档](https://docs.github.com/en/actions/concepts/security/github_token) 明确说明，免批需使用独立 GitHub App installation token 或 PAT。Settings → Actions 的 fork 审批设置及“Allow GitHub Actions to create and approve pull requests”分别控制 fork 工作流和 PR review 权限，不能消除这项 bot 运行审批；本次保持现有 token 与设置。
- 例：[run 38490316334](https://github.com/wenbubai2008-max/indonesian-learning/actions/runs/38490316334)，actor=`github-actions[bot]`、`pull_request`、0 个 job、批准过期后 failure。**这些由 index push 派生、未获批准而过期的零 job 运行，对课程发布数据是无害的重复运行噪声**；原 job 自行完成生成、校验、合并和显式 Sync dispatch，不依赖它们。不得把实际 release/Sync 的失败也归为无害；仍需检查原 job、Sync、水位与新词退出。若以后配置必需 PR 状态检查，须重新评估它们是否阻挡合并，不得绕过保护。
- **自动清理（2026-10-14 用户要求）**：`lesson_release` 成功后的最后一步 “Remove the zero-job bot run left by the index push” 删除这些噪声运行，条件同时满足才删：同一 `lesson-release-*` 分支、`triggering_actor=github-actions[bot]`、结论 failure/action_required/startup_failure、0 个 job，且不是本次运行。只在成功后执行、`continue-on-error`，最多等约 50 秒让仍在收尾的 bot 运行结束，没有待清理的就立即结束，不拖住 `learning-data-write` 锁。真正跑过 job 的失败运行永远不删。守卫断言这些条件。
- **Pages 偶尔显示 cancelled**：合并提交后几秒内 `build-learning-runtime.yml` 又推送一次派生数据，GitHub 内置的 `pages build and deployment` 会取消旧的部署、只部署最新提交。这是内置行为，网站总是部署到最新版本。要消除只能改成自建部署工作流，而本仓库只允许两个工作流（守卫 “workflow set is exactly”），所以不改。
- 课程 release 提交不加 `[skip ci]`，防止默认 squash 提交说明携带该标记而跳过 main 后续流程。泛读现有的显式 squash 提交说明策略不在本次修改范围。
- `test-release-pr.js` 直接执行工作流发布步骤，在临时本地 Git 仓库模拟两类 main 前进，使用真实 planner、validator、普通 merge/push，GitHub API 为本地替身；本地不得执行其他工作流中带 `git reset --hard` 的循环。
- PR preflight 把新守卫复制到修改前的 pinned main 做数据回归时（`GUARD_BASELINE_TREE=1`），跳过这五条新增工作流形状断言；正常 PR/main 检查必须全部执行，不能要求旧工作流提前具备本次修复。

## 3. 每次修改前：Preflight

修改前必须回答：

1. 用户到底要求改什么？哪些明确不能动？
2. 这个东西的 source of truth 在哪里？
3. 有没有第二个文件/脚本在运行后覆盖它？
4. 是否存在历史兼容要求？
5. 搜索相关关键词后，影响面有哪些？

### 常见影响面搜索
改 PM 时间时至少检查：
- `19:00`
- `18:00`
- `晚间学习`
- `loadReading('pm')`
- `PM_SWITCH_DATE`
- `scheduled_time`
- `history-v2.js`
- `daily-ui-polish.js`
- `vocab-dom-compat.js`

改晚课内容时至少检查：
- `learning-pool-rules.json`
- `learning-runtime.json`
- `docs/tasks/PM-LESSON.md`（18点任务说明书；定时任务提示词只做引导，见 §20）
- PM 渲染脚本
- 最新 `data/daily/YYYY-MM-DD-pm.json`
- `regression-guard.js` 对真实课程文件的检查

改首页卡片时至少检查：
- `index.html`
- `data/daily-width-fix.css`
- `data/home-modules-layout.js`
- `data/home-modules-stability.js`
- `data/vocab-dom-compat.js`

## 4. 每次修改后：固定回归检查

### A. 数据/词池
- [ ] `rules.version == 4`
- [ ] `runtime.version == 4`
- [ ] `runtime.rules_version == 4`
- [ ] `runtime.stats.master_unique == 977`
- [ ] 新词公式仍是 `M ∩ A − D`
- [ ] 复习公式仍是 `A ∩ D`
- [ ] mastered 不进入 new / focus review / PM application
- [ ] daily-vocab 仍只表示 taught

### B. 08:00
- [ ] 恰好10个新词
- [ ] 合法时优先2个口语新词
- [ ] 约5个 review recurrence
- [ ] 5句
- [ ] 80–120词阅读
- [ ] 3题 quiz
- [ ] active output
- [ ] final review 3个重点

### C. 18:00
- [ ] 10–12核心词
- [ ] 3–4 new
- [ ] 4–6 review（默认 5）
- [ ] 2–3 application
- [ ] 三组无交集
- [ ] mastered_hits=0
- [ ] 口语比例规则未被删
- [ ] cooling / 自动化价值未被删
- [ ] 词卡保持 2026-09-14 详细度
- [ ] 当天 AM application 显示“今天08:00已教”
- [ ] reading 80–120 + 中文
- [ ] dialogue 存在且逐句中文
- [ ] rewrite/application 3–4项
- [ ] daily_test = 3 choice + 2 fill + 1 order
- [ ] 3 个 choice 的 `answer_index` 都有效；如果同时有 `answer` 必须一致
- [ ] fill 同行有括号中文提示
- [ ] order 有完整中文 + 5–8 tokens + answer + answer_cn
- [ ] self_check 存在
- [ ] final review 使用 `review.steps`
- [ ] 最新真实 PM JSON 通过 regression guard，而不是只看规则文件

### D. 首页/UI
- [ ] 首次打开不卡
- [ ] 连续刷新不卡
- [ ] 不出现旧长条卡片闪一下再变形
- [ ] 卡片顺序不交换
- [ ] “其他学习工具”5张卡尺寸/颜色一致且不跳
- [ ] 桌面宽屏是5列，新增词根卡点击后可打开独立资料库
- [ ] 中等屏3列
- [ ] 手机2列/窄屏1列按现有规则
- [ ] 首页源HTML直接显示 08:00 / 18:00，不依赖DOM补丁
- [ ] 今日 PM 卡源HTML直接显示18:00
- [ ] 今日 PM 短文入口源HTML直接显示18:00
- [ ] 今日 PM 课程导航/标签/完成提示显示18:00
- [ ] 2026-09-15及以前历史PM仍显示19:00
- [ ] 正确答案绿色；错误选择红色且同时标出正确答案
- [ ] `vocab-dom-compat.js` 不再承担19→18时间改写

### E. 自动任务/Actions
- [ ] 08:00 task enabled
- [ ] 12:00 task enabled
- [ ] 18:00 task enabled
- [ ] 20:00补漏保持 disabled，除非用户明确重新开启
- [ ] 任务失败不得自动把正式任务 disabled
- [ ] 任务行为改在 `docs/tasks/` 说明书里（守卫检查关键标记），不改回定时任务提示词
- [ ] `.github/workflows` 没有临时/重复 workflow
- [ ] `sync-daily-vocab.yml` 是唯一 daily-vocab writer
- [ ] 12:00 泛读只把单个 candidate 写入 `extensive-reading-YYYY-MM-DD` 分支；归档/index/today 三文件由 GitHub Runner 生成并 squash merge，candidate 不进入 main
- [ ] 泛读 PR 仅允许同仓库、当天命名分支、指定 marker 和泛读数据路径；main 前进时停止而不是 force/rebase
- [ ] 同步后 runtime 在同一链路重建

### F. 部署
- [ ] GitHub Pages 最新部署 success
- [ ] 强刷后显示新版本
- [ ] 不只检查最终静态截图，还要检查“刷新过程”

## 5. 修改协议

以后每次修改按这个顺序：

1. 读取本文件 + `learning-pool-rules.json`
2. 做全局影响面搜索
3. 记录本次 scope lock
4. 只改最小 source-of-truth
5. 不顺手重构
6. 运行 `node .github/scripts/regression-guard.js`
7. 看 diff 是否超出范围
8. UI 改动等待 Pages success
9. 手动做刷新/首屏检查
10. 确认后再告诉用户“已完成”

如果第6–9步没有完成，不应说“已经全部没问题”。

## 6. 已解决的时间迁移技术债务

`2026-09-16` 已完成 `index.html` 的PM时间源迁移：

- 当前首页静态默认值直接为 `08:00 / 18:00`
- 当前PM卡静态默认值直接为 `18:00`
- 当前PM短文入口静态默认值直接为 `18:00短文`
- `index.html` 内部课程标题通过 `PM_SWITCH_DATE='2026-09-16'` + `pmTimeForDate(date)` 保留历史兼容：此前19:00，此后18:00
- `data/history-v2.js` 和 `data/daily-ui-polish.js` 继续按日期保留历史显示语义
- `data/vocab-dom-compat.js` 已移除 `patchHomeTime` / `wrapLoadReading` 等运行后时间改写，不再负责19→18
- regression guard 将以上内容作为硬检查；以后如果把当前静态19:00重新带回，会直接失败，而不是仅给warning

原则：**当前显示直接来自正确源值；历史兼容只负责历史，不再用运行后DOM补丁修当前页面。**

## 7. 复习轮换的可执行规则（2026-10-04 起对晚课生效）

- 共享实现：`.github/scripts/review-rotation.js`；Validator 与 `rank-review-candidates.js` 使用同一份逻辑，规则配置在 `data/learning-pool-rules.json` 的 `review_rotation.recent_core / focus_quota / application_am_review`。
- PM 重点复习：最近4天内已做过正式核心复习的词最多2个；focus_pool 词2–3个；当天AM.review_vocab 的老词不得占完整 application 词卡。真实新错（`last_wrong` 晚于该词最近一次核心复习且不晚于 `runtime.generated_at`）可解除限制；旧标签（quick_wrong、automation_fail）不算新错。
- 合法替代不足时规则自动放行（不卡发布、不使用 mastered 或非 review_pool 的词）；原有相邻课冷却、连续PM冷却、7天≥3次限制保持不变。
- 生成端：17:30 晚课必须先运行 `node .github/scripts/rank-review-candidates.js --date D` 再锁定词表。回归测试：`test-review-rotation.js`（由 `test-lesson-candidate.js` 调用），含 2026-10-03 真实案例 fixture。

## 8. 2026-10-07 新词供给与复习排序调整

- **第二库 dont 补给（primary 阶段）**：`build-learning-runtime.js` 在 primary 阶段把第二库 `dont` 词追加在 977 合法词之后（按 BIPA 等级 S>A>B 排序）。977 词永远排在前面；第二库 fuzzy 仍只在 transition/secondary 阶段进入；阶段切换阈值仍只看 977 合法新词数。新增 `runtime.stats.new_pool_secondary_dont_topup`。
- **口语候选**：`data/oral-vocab-candidates.js` 新增 18 条常用标准语↔口语对应（rank 716–733），2026-10-07 再补 18 条（rank 734–751）；`oral_candidate_total` 同步为 242。候选只有在 `M ∩ A − D` 内才会进入 `oral_new_pool`。
- **复习排序**：`review-rotation.js` 的 `rank()` 对超过 7 天未出现在课程中的复习词加分（封顶 30，低于真实新错的 100）；只影响排序，不改变资格、冷却、配额。`rank-review-candidates.js --compare 1` 输出与旧排序的差异。
- **只读工具**：`report-learning-health.js`（池子余量/口语池/复习缺口）与 `test-handoff-drill.js`（用真实 builder 在临时目录演练 primary→transition→secondary 与 dont 耗尽）。
- 部署后需确认：Build learning runtime 成功，`runtime.new_pool_dont` 中 977 词排在第二库词之前，`oral_new_pool_dont` ≥ 2。

## 9. 2026-10-07 旧词（未验证）复习通道

- **问题**：已教但在弱项库里没有任何记录的词（画像“未验证”，当时 93 个，全部是 2026-08-23 至 09-12 的早期词）不属于 A，所以按 `A ∩ D` 永远进不了复习池，从教完起从未被课程复习。
- **做法**：`build-learning-runtime.js` 把其中最久没出现的至多 10 个以优先级 5 附加到 `runtime.review_pool` 末尾；`review_pool_total_full` 与所有 A ∩ D 计数不变（`build-vocab-profile.js` / `write-vocab-profile-snapshot.js` 依赖它们）；新增 `stats.legacy_unverified_total_full` / `legacy_unverified_exposed`。`review-rotation.js` 的排序每晚至多选 1 个，且不作 application 词。
- **不变**：新词公式、复习公式定义、mastered 判定、冷却与轮换规则、课程合同。
- **测试**：`test-review-rotation.js`（G 项）与 `test-handoff-drill.js`（A2 项）。
- 合并后需确认：Build 成功，画像快照不报 mismatch，runtime 里 `review_pool` 末尾有优先级 5 的行。

## 10. 2026-10-07 学习节奏决定：不放慢，学完后统一复习

- **用户决定**：每天新词节奏保持不变（早课 10 个、晚课 3–4 个），不因“需要加强”数量增长而放慢；**等全部新词学完后统一安排复习**，这是循环学习。
- 因此：“需要加强 / 31 天以上未出现的词”增长是**预期现象**，不得作为告警、不得据此提议减少新词、不得据此改动 am_contract / pm_contract 的新词数量。`report-learning-health.js` 已移除“31 天以上未出现”告警。
- **必须提前处理的后果**：主库剩余 + 第二库可用新词合计约 550 个，按每天约 13.5 个，**约 41 天（2026-11 中旬）用完**。用完后“早课恰好 10 个新词 / 晚课 3–4 个新词”的合同无法满足，课程生成会失败。
- `report-learning-health.js` 新增预警：所有新词预计 21 天内用完时告警，提示需要先设计“复习循环”课程形态（合同、校验器、守卫和外部 07:30 / 17:30 生成任务的提示词必须同时调整）。
- 在循环复习形态上线前，不要让新词池在无预案的情况下耗尽；是否补充第二库（按人工筛选结果）由用户决定。

## 11. 2026-10-07 待复习词的“自然复现”

- **想法（用户）**：待复习的词可以直接用在每天的课程里——新词例句、阅读、对话等——而不是只靠固定的复习名额。
- **现状度量**：待复习词中 48%–61% 在最近一周/两周的课文里出现过，但集中在少数常用词（biar、tenang、buat、untung…），另有 60 多个词 30 天以上没在任何文本中出现。问题是**选哪些词**，不是容量。
- **做法**：`runtime.recurrence_pool`（[word, priority, cn]，最多 500，review_pool 之外的其余 A ∩ D 词 + 剩余旧词）；`review-rotation.js` 的 `naturalRecurrence()` 按“距上次在任何课文里出现的天数”排序（未知历史按 45 天处理，同分按日期哈希轮换）；工具 `rank-natural-recurrence.js`，PM 的 `rank-review-candidates.js` 输出也含 `natural_recurrence`。
- **不变**：不计入核心复习次数，不占 review / application 名额，不改冷却/轮换/配额，不改 A ∩ D 计数（画像依赖）；mastered 不在池里；软规则，不进校验器，发布不会因此失败。
- **度量**：`report-learning-health.js` §3c（覆盖度）；匹配是整词精确匹配，屈折形式不会被识别，所以是下限。
- **外部配合（2026-10-07 已完成）**：07:24 早课与 17:30 晚课的提示词已要求先运行 `rank-review-candidates.js --session am|pm`，其输出的 `natural_recurrence` 已排除冷却中的词，生成时在阅读/对话/例句里自然带入（晚课约 6–8 个）。
- 测试：`test-review-rotation.js`（H1–H3）、`test-handoff-drill.js`（A3）、`test-report-learning-health.js`（recurrenceCoverage）。

## 12. 2026-10-08 泛读复现学过的词，改由 Claude 生成

- **用户决定**：12:00 泛读尽量复用“学过但还没掌握”的词，让同一个弱词在不同场景里隔几天反复出现；生成端从 ChatGPT 改为 Claude 定时任务（约 11:24 开始）。**ChatGPT 的泛读任务必须由用户停用**，否则两边会抢同一天。
- **选词工具（只读）**：`.github/scripts/reading-review.js --date D` 输出约 40 个候选：focus_pool > review_pool > 旧词 > recurrence_pool，再按“距上次在课程**或泛读**里出现的天数”排序；最近 2 天泛读刚用过的词降权；3–10 天前只在一篇泛读出现过的词加分（第二个场景）。不改任何池子、资格、冷却或掌握状态。
- **文章新字段（可选）**：`review_words=[{word,cn}]`，`dialogue={title?,lines:[{speaker,text,cn}]}`（4–8 行口语小对话）。旧文章没有这两个字段，页面照旧显示。
- **校验（publish-extensive-reading-candidate.js，release job 照常调用）**：新增阻断——提示词 term 必须逐字出现在正文/对话里（2026-10-07 曾有 2 个提示因此不显示）；`review_words` 每个都必须真的出现；对话结构；**同一天已经发布过泛读则拒绝第二篇**（防止新旧两个生成任务重复发布、把当天文章归档替换掉）。脚本仍保持单文件自包含（release job 会把它单独拷到临时目录运行）。
- **生成端自查**：`publish-extensive-reading-candidate.js check --candidate <file> --date D` 做同样的结构校验，并按 runtime 报告复习词覆盖（不足 8 个 / focus 不足 3 个 / 没有对话 → 警告；复习词不在已学未掌握词池 → 报错）。
- **页面**：`data/extensive-reading-history-ui.js` 用绿色实线标出复习词，点一下显示中文（先回忆再看）；对话放在正文后，可朗读、可整体显示中文；文末列出“本篇复现了 N 个学过的词”。无 MutationObserver、无轮询、无首屏布局变化。
- **不变**：泛读复现不计入核心复习次数，不影响 AM/PM 合同、复习轮换和 `report-learning-health.js` §3c 的课程复现度量；正文 160–220 词、8–15 个提示、来源 0–3 天内的规则不变。
- **测试**：`test-extensive-reading.js`（校验器、同日拒绝、覆盖报告、排序规则、真实数据冒烟），在 PR preflight 中运行。

## 13. 2026-10-08 曝光账本：application 计为主动曝光，连续出现有上限

- **问题**：旧规则只把 AM.review_vocab 与 PM review 算作复习，application 和课文出现都不计。真实案例：`nggak heran` 在 2026-10-04、05、06 连续三晚做 application，10-07 又进 review；排序脚本还因为 application 不算曝光而给它加了“久未出现”分。
- **规则**（`review_rotation.exposure_ledger`，2026-10-08 起生效，共享实现 `review-rotation.js`）：
  1. **主动曝光** = AM.review_vocab、PM review、PM application；AM 新词 vocab 不计（早课新词进晚课 application 是合同要求）。原有冷却、7 天次数、最近 4 天窗口、真实新错判定都按主动曝光计算。
  2. **最近 2 节课**有主动曝光的词，本节不占 review / application 核心名额。
  3. **连续 3 天**：前 2 天每天都以任何形式出现（核心词表、阅读、对话、句子、例句），且其中至少一次是主动曝光 → 本节不占核心名额。纯课文出现的高频词（biar、buat…）不受影响。
  4. **被动出现不推进复习间隔**，只用于冷却判断；仍在冷却中的词列在排序输出 `avoid_in_text`，生成时不写进阅读/对话/例句，`natural_recurrence` 自动排除它们。
  5. **错词配额**：真实新错每节最多 `min(3, max(2, 复习数-3))` 个，其余名额给到期词；没排上的新错保持新错身份，下一节继续优先（`fresh_errors_deferred`）。7 天内没有任何主动曝光、但 7 天内答错过的词也算新错。只在排序中执行。
  6. **难词**：累计答错 ≥3 次标 `hard`，复习时换题型并加辨析/搭配讲解（软规则）。
- 以上 1–3 由校验器执行：`AM_EXPOSURE_COOLDOWN` / `PM_EXPOSURE_COOLDOWN` / `PM_APPLICATION_EXPOSURE_COOLDOWN`，只在合法替代充足时报错，真实新错例外，不卡发布。
- **生成端**：07:30 早课与 17:30 晚课都先运行 `node .github/scripts/rank-review-candidates.js --date D --session am|pm`，再锁定复习词。
- **不变**：新词/复习公式、mastered 判定、课程合同、AM/PM 题型与数量；`exposure_ledger` 缺失或日期早于生效日时行为与旧版完全一致。
- **曾考虑但未做**：单独的“快速回顾”栏。§11 的自然复现已经承担“让积压词先露个面”的作用，再加一栏会改动课程合同与前端，收益不大。
- 测试：`test-review-rotation.js` L1–L9（含 nggak heran 案例、无死锁、旧行为不变、AM 排序）。

## 14. 2026-10-07 规则清理（不改变学习规则）

- **教学审稿要求集中到 `docs/LESSON-QUALITY.md`**：Day 43–45 点评原先分别粘贴在早课、晚课两份提示词里，现在合并为一份清单，两份提示词只引用它。以后新增点评只改这一个文件，不要再往提示词里追加“补充”段落。
- **校验器单一实现**：`validate-lesson-candidate.js` 原有的核心复习硬规则（`PM_SAME_DAY_REVIEW_REPEAT`、`AM_PREVIOUS_PM_REVIEW_REPEAT`、`PM_REVIEW_COOLDOWN`、`REVIEW_OVEREXPOSURE`）移到 `review-rotation.js` 的 `checkCore()`，语义保持只算核心复习、不受曝光账本影响（它们是不看替代数量的硬错误）。迁移前后用 09-29 至 10-07 的 18 节真实课程（有无曝光账本各一次）逐一比对，错误输出完全一致。
- **泛读计入连续出现（只用于排序）**：`rank-review-candidates.js` 把最近 7 天 12:00 泛读正文与对话当作被动出现，用于“连续 3 天”判断；同日泛读只对晚课生效。校验器不读泛读，不会因此卡发布。测试 L10。
- 规则文件 `review_rotation.core_only` 改为 false 并附说明；检查清单晚课复习数改为 4–6；早课开始时间按实际定时任务写为约 07:24；各文档中把“ChatGPT 课程任务”改为“课程生成任务”（历史事故记录保留原文）。

## 15. 2026-10-08 当天早课新词可以进晚课 application

- **问题**：晚课合同要求 application 优先用“当天 08:00 新学的词”，但 runtime 的 `review_pool` 只暴露前 60 个复习词（按优先级排序，目前 53 个是 priority-1 的 quick_wrong 词），当天早课新词（priority 2）永远排不进去。校验器要求 application 必须在 `review_pool` 里，所以 2026-10-04 起没有一节晚课用上当天早课新词（09-28 至 10-03 每晚 1–3 个）。
- **做法**：`build-learning-runtime.js` 在 `lesson_watermark` 是 08:00 课时，把该课首次教的、属于 A ∩ D 的词追加到 `review_pool` 末尾（新增 `stats.same_day_am_review_exposed`）。`review-rotation.js` 的排序不把它们推荐为晚课重点复习，只放在 application 候选最前面。watermark 是 18:00 时不追加，次日早课不受影响。
- **不变**：`review_pool_total_full` 与所有 A ∩ D 计数（画像依赖）、复习公式、冷却与轮换规则、课程合同。
- **验证**：用 10-08 晚课前的真实数据重建 runtime，追加了当天 10 个早课词，重点复习推荐不变，application 候选变为当天早课词；watermark 为 18:00 时追加 0 个。测试 L11。

## 16. 2026-10-08 复习词轮换范围放宽（用户决定）

- **问题**：`review_pool` 只暴露前 60 个复习词，其中 53 个是 priority-1（quick_wrong）词；其余约 370 个“学过但未掌握”的词永远进不了早晚课核心复习，只能偶尔在课文中出现。这也是“同几个词反复出现”的根源之一。
- **做法**：`build-learning-runtime.js` 在原 60 个之后再追加最多 40 个最久没在课程中出现的其他 A ∩ D 词（daily-vocab `last_seen` 最早优先），新增 `stats.review_rotation_exposed`；规则见 `review_rotation.review_pool_rotation`。
- **效果（用 10-08 晚课后数据模拟 10-09 早课）**：推荐从 nyusahin、tumbuh、terjadi、melawan、memanggil 变为 nyusahin、tumbuh、keuntungan、memutuskan、mengganggu。新错仍优先，另外 3 个换成 47–48 天没出现的词。
- **不变**：A ∩ D 定义与计数（画像依赖）、冷却、轮换、错词配额、focus 配额（晚课仍保证 2–3 个 focus 词）、课程合同。
- **晚课模拟（10-08 晚课前数据）**：ceria、melepaskan（focus＋新错）＋ keuntungan、mengganggu、peningkatan（47 天未出现）；application 为当天早课词；checkPm / checkExposure / checkCore 全部通过。

## 17. 2026-10-14 全站复盘后的修复（用户授权“能改的全部改”）

- **掌握判定打通**：自动训练连续三次跨日验证（间隔 2/4/7 天）达到 stable 后，除了 `automation_fail`，同时清除首次分类留下的 `memory_dont / memory_fuzzy / bipa_secondary_* / manual_unknown / seed_unfamiliar / quick_wrong / lesson_wrong / weak`，没有剩余原因就转为 mastered（`mastered_reason=automation_stable`）。听力原因（`listening_*`）保留，因为听力是独立能力。此前 782 个已学词里有 479 个带首次分类标记，训练无论如何都清不掉，“确认掌握”从 9-29 起停在 182。已经 stable 的词在页面加载时补做一次（`backfillStable`）。单纯的识别练习仍然不能判定掌握。
- **课程小测答错进入弱项池**：新脚本 `data/lesson-answer-signal.js` 包装 08:00 小测（`dailyFixGrade`）和 18:00 选择 / 填空（`dailyLightChoice` / `dailyLightFillCheck`），答错时给唯一能确定的核心词（vocab 或 AM review_vocab）记 `lesson_wrong`（带 `last_wrong`、`wrong_count`）。无法唯一确定的题和排序题不记录。runtime 中 `lesson_wrong` 与 `quick_wrong` 同级（priority 1，focus +36）。
- **训练任务同分排序**：`vocab-study-coach.js` 同分时按“弱词优先、离上次在课程里出现最久优先”，不再按字母顺序（此前总是先练 a 开头的词）。
- **搭配黑名单**：`data/lesson-collocation-watchlist.json` + `.github/scripts/check-collocations.js`（只警告，不阻断发布），三个生成任务在校验前运行。
- **小修**：“查看能力与逐词档案”打开“能力总览”；首页词汇卡标签由 VocabController 独占，不再在“782 个词”和“主学习词库 977 词”之间跳动；自动训练页标签在手机上换行。
- **测试**：`test-cross-module-training.js`（stable 清除首次分类标记、听力原因保留、小测答错的目标词判定），`test-vocab-study-coach.js`（同分排序），`test-handoff-drill.js`（主库 dont 用完后的断言，#128）。
- **不变**：新词 / 复习公式、课程合同、冷却与轮换、曝光账本、发布流程。
- **补充（同日第二批）**：晚课排序题答错时，答案句里只有一个核心词才记 `lesson_wrong`；自检每条下面列出它提到的核心词，可点“卡住了”记一笔（`lessonSelfStuck`，只改渲染，`selfCheckHtml(items)` 签名和课程 JSON 不变）；首页画像卡显示“近 7 天”变化（掌握数不涨时标橙）；训练进度跨设备同步：Worker 新增 `/training`（只存 KV），网站端 `data/training-sync-client.js`，Worker 未更新时 404 → 6 小时退避，不影响弱项同步。测试 `test-training-sync.js`（两台模拟设备经真实 Worker 代码同步）已加入 Build learning runtime。
- **手机扫码设置同步（同日第三批，用户要求）**：“学习状态同步”面板新增“手机扫码设置”，按本机已保存的地址和密钥生成二维码（`data/sync-device-setup.js`，二维码库 `data/vendor/qrcode-generator-1.4.4.js`（MIT）只在点开时加载）。链接形如 `…/indonesian-learning/#sync-setup=<base64url>`：只用 URL 片段（不会发到任何服务器），不用查询参数；该脚本在页面解析阶段同步执行，先于 `home-modules-layout.js` 在 DOMContentLoaded 读取 hash，立即用 `replaceState` 去掉片段；用户点“启用”前不保存任何东西；只接受 https 地址；启用时清除训练同步的 404 退避。二维码弹窗 3 分钟自动关闭。测试并入 `test-training-sync.js`。
- **弱项写入 GitHub 的窗口（同日第四批，用户同意）**：Worker 的 5 分钟 Cron 只在雅加达 06:40–07:15、10:40–11:15、16:40–17:20、21:00–21:10 把 KV 变化写进 `data/weakness-sync.json`（早课 07:24、泛读 11:24、晚课 17:30 生成前各有约 6 次重试机会），其他时间不写；“立即同步”的 `/flush` 照常立即写。设备间同步走 KV，不受影响。改动只在 `cloudflare/weakness-sync-worker.js`，需要重新部署 Worker 才生效（Cron 设置不变）。如果以后调整课程生成时间，必须同时调整这些窗口。测试在 `test-training-sync.js`。同日早课、晚课定时任务的模型改为 claude-opus-5-5（用户决定）。
- **口语随词学（同日第五批，用户决定）**：口语不再靠“口语新词”名额补充。`docs/LESSON-QUALITY.md` 新增 7b：核心词卡在 `synonym_note` 末尾写真实常用的“口语说法”；早课 sentences 至少 1 句自然口语、晚课 dialogue 一律用雅加达日常口语，口语形式在该行 cn 括号注明标准形；不新增 JSON 字段。Validator 的口语规则（有合法候选时使用）和 `learning-pool-rules.json` 不变；`report-learning-health.js` 不再因口语候选余量或口语新词数量报警（只作信息显示），不再为此补充口语候选。
- **本地复现 Build 步骤时注意**：工作流 Recompute 步骤的 for 循环里有 `git reset --hard origin/main`，只截取到 `vocab-ui-regression-guard.js` 为止的命令来跑，否则会清掉本地未提交的修改。

## 18. 2026-10-14 复习循环课程形态（用户决定）

- **用户决定**：新词学完后进入复习循环。早课把原来 10 个新词的名额换成复习词；晚课结构不变，只是没有新词；一个词“确认掌握”后退出循环；选词兼顾最弱的词和最久没出现的词（各一半，不足互补）。
- **自动切换**：校验器按 runtime 判断，没有开关。合法新词不足 10 个时，早课用上全部剩余新词，其余名额填循环词（根字段 `cycle_vocab`）；当晚剩余新词不足 3 个时，晚课 new 组等于全部剩余新词（0–2），review 4–9，application 2–3，总数仍为 10–12。新词充足时行为与以前完全一致（`cycle_vocab` 必须为空）。
- **选词**：`rank-review-candidates.js` 输出 `review_cycle`（AM：`cycle_words` / `weak` / `stale`；PM：`review_target`）。循环词与 `review_vocab` 不重叠，遵守曝光账本、冷却和“7 天 ≥3 次最多 1 个”。
- **记账**：`cycle_vocab` 计为主动曝光（`activeWords`）；晚课把它们当作“今天08:00复习过的老词”（不是新词）；runtime 在 08:00 水位时把当天的循环词追加进 review_pool（并入 `same_day_am_review_exposed`），供晚课 application 使用；每日同步对已学词只更新出现时间，不需要改工作流。
- **不变**：新词公式、复习公式、mastered 判定、课程其他结构、发布流程、`learning-pool-rules.json`（没有修改，避免改变 lesson-context 的规则哈希）。
- **测试**：`test-review-cycle.js`（真实课程文件构造：早课 4+6、缺 cycle_vocab、未用完剩余新词、循环词不在 review_pool、正常模式拒绝 cycle_vocab、晚课 0 新词扩展复习、08:00 老词标记、账本、排序各半）。
- **第二词库筛选入口（同日加入，同日撤回）**：曾给 BIPA 词库加“只看可加入第二词库、还没筛选过的词”开关，按“没有学习记录”判断未筛选，这是错的。BIPA 里点“会了”只写本机 `indo_bipa_mem_*`，没有学习记录的词不会生成任何记录（`bipa-secondary-seed` 对 know 且无记录的词直接跳过），所以那 424 个“无记录”词其实是用户早已标为“会了”的词。开关已撤回；手机端 BIPA 工具栏的 `minmax(0,1fr)` 修复保留。结论：第二词库（BIPA 非主库词，B2 只取 S 级，共 856 个）已经全部筛完。
- **CI 修复（同日）**：Sync preflight 的“停用的 V4 备用生成器演练”用当天数据生成晚课，选出 5 个 focus 词，被 planner 以 `PM_FOCUS_MIX_HIGH` 拒绝，导致所有改到课程脚本的代码 PR 预检都失败（main 上同样失败）。原因是 V4 停用前没有跟上 2026-10-04 的“晚课 focus 词 2–3 个”规则。现在 `prototype/lesson-engine/engine/core.js` 的 `selectReviews` 在晚课最多选 3 个 focus 词（还有非 focus 候选时）。V4 仍然停用，这只是让演练符合现行规则。

## 19. 2026-10-14 难点解释改为点开才加载

- **做法**：7 篇难点课的 HTML、测验/打开函数和约 50KB 专用样式从 `home-modules-layout.js`（原 150KB）移到 `data/difficulty-lessons.js`。首页脚本只留一个桩：`showDifficultyList()` 第一次被调用（点“难点解释”卡、打开 `#difficulty` 链接、浏览器后退到该页）时才注入该脚本，加载后在 `index.html` 里的空占位 `<section id="difficulty" class="page">` 中生成内容并补上导航条。
- **必须保留**：`index.html` 中的占位页（哈希/历史导航在页面加载时就要找到它）；`speakIdText`、站内导航（`.siteNav`）、`.page>.back` 隐藏规则仍在首页脚本里（听词训练等页面在用）。
- **代价**：第一次打开“难点解释”多一次约 145KB 的请求（之后走浏览器缓存）；加载失败时占位页显示提示，刷新可重试。
- **验证**：7 篇课的 DOM 与逐元素计算样式在 390/720/1280px 下与旧版一致；首页 11 个宽度下可见卡片与旧版一致；深链 `#difficulty`、刷新、后退、测验按钮行为一致。
- **守卫**：首页脚本不得再含难点课内容（体积 < 30KB），必须有桩、占位页和 7 篇课。

## 20. 2026-10-14 定时任务说明书移进仓库（用户要求“定时任务和仓库规则优化”）

- **问题**：08:00 早课、18:00 晚课、12:00 泛读三个定时任务的提示词各有 5–9 千字，大段重复仓库里的规则（曝光账本、复习循环、JSON 结构、发布流程），每次改规则都要改两处，已经出现偏差（例如口语新词名额的写法与 `LESSON-QUALITY.md` §7b 不一致）。提示词也不经过 PR 和回归守卫。
- **做法**：三个任务的完整说明书放在 `docs/tasks/`：`COMMON.md`（仓库访问、写入边界、一次性 push、失败处理、V4 停用、汇报诚实）、`AM-LESSON.md`、`PM-LESSON.md`、`EXTENSIVE-READING.md`。原提示词的全部要求都搬了过来（晚课第 1–9 节“正式要求”原样保留），只把与 `LESSON-QUALITY.md`、`LESSON-JSON-SCHEMA.md`、`LESSON-RECOVERY.md` 完全相同的段落改成引用。定时任务提示词只保留：添加仓库、clone、读说明书、几条读不到说明书时也必须遵守的底线。
- **守卫**：`regression-guard.js` 检查四份文件存在并包含关键标记（分支命名、`AUTO_PUBLISH_LESSON=1` / `AUTO_PUBLISH_EXTENSIVE_READING=1`、必跑脚本、题型数量、自检/复盘分工、早课来源标注、VERIFIED_COMPLETE、V4 停用、不得禁用任务等）。删掉任何一项都会失败。
- **以后**：用户的新要求或点评，教学质量写 `LESSON-QUALITY.md`，流程写对应说明书，规则写 `learning-pool-rules.json`；不改定时任务提示词，也不在提示词里加“补充”段落。
- **同时修正的过时描述（不改变学习规则）**：`pm_contract.cooling.recent_pm_focus` 与 `rules` 最后一条改为与曝光账本一致（application、cycle_vocab 计为主动曝光，不再写“应用复现独立计算”）；`pm_contract.listening_overlay` 的复习数 4–5 改为 4–6；`LESSON-RECOVERY.md` 早课开始时间 07:30 改为约 07:24。修改 `learning-pool-rules.json` 会让 `build-learning-runtime.yml` 重建 runtime 与 lesson-context（规则哈希随之更新），合并后需确认该运行成功、`build-lesson-context.js --check` 通过。
- **不变**：新词节奏（早课 10 个、晚课 3–4 个，用户决定等新词全部学完再进入复习循环）、校验器、发布工作流、课程合同、词池公式。

## 21. 2026-10-15 课文复现：最久没出现的词要真的带进课文（用户要求改进复习覆盖）

- **问题**：10-08 至 10-15 的 15 节课里，每节课文平均用到约 15（早）/ 23（晚）个没掌握的学过词，但一周只覆盖 614 个待复习词中的 163 个，常用词反复出现（sejak、rapat 各 8 次）。原因是“从 natural_recurrence 名单带入，早课至少 2 个、晚课至少 3 个”是软规则、没有检查：15 节课里 6 节一个没带，只有 3 节达标，同一批 46 天没出现的词每天都排在最前。
- **做法（只改课文用词，不改新词节奏、复习词名额、Validator 和发布流程）**：
  1. `review_rotation.natural_recurrence` 新增 `min_per_lesson`（早 5、晚 8）、`list_size`（20）、`overuse`（最近 6 节课文出现 ≥3 次）。
  2. 新脚本 `check-recurrence.js --candidate <JSON> --date D --session am|pm`：统计名单里有几个词出现在阅读、对话、sentences、词卡例句中（与排序用的 `lessonText()` 同一范围），不够返回非零。AM/PM 说明书要求推送前通过；只在生成端执行，不进 Validator、不卡发布。
  3. 匹配接受 -nya/-lah/-kah/-pun/-ku/-mu 后缀（排序和检查一致），派生词仍不算。
  4. **修正排序缺陷**：晚课的“最久没出现”排序原来不看当天早课课文，会把早上刚用过的词（如 10-15 的 pemasukan、nyiapin）再推荐给晚课。现在晚课把当天 08:00 课文算进去。
  5. 排序输出新增 `overused_in_text`，只警告，不禁止常用词。
- **守卫**：说明书必须保留 `check-recurrence.js` 和“至少 5 个 / 至少 8 个”；规则文件下限不得低于早 5、晚 8、名单 20。测试 `test-check-recurrence.js`（PR 预检运行）。
- **预期**：每天约 13 个久未出现的弱词进入课文（原来约 1 个），一周可多覆盖约 90 个不同的弱词。覆盖度继续看 `report-learning-health.js` §3c。

## 22. 2026-10-15 复习加量三项（用户确认的方案）

1. **核心复习备选扩大一倍**：`build-learning-runtime.js` 的轮换名额 `REVIEW_ROTATION_MAX` 40 → 160，`runtime.review_pool` 约 119 → 约 239（60 个最弱 + 160 个最久没进课程的 + 10 个旧词 + 当天早课新词）。每节核心复习数量、排序优先级、冷却、配额都不变。`recurrence_pool` 相应变小，`natural_recurrence` 用两池并集，不受影响。
2. **复习词同词根成组**：`rank()` 在可用（合法、未冷却）的复习词里按 `review_pool` 第 7 列 root 分组，输出 `review_groups`；在不挤掉真实新错、不破坏晚课 focus 下限的前提下，把最优的一组（2–3 个）放进 `recommended_review`，记为 `review_group_applied`。`check-recurrence.js` 只在 `review_group_applied` 不为空时要求核心复习词里有同词根的两个词；放不下时不要求，写课时可用反义/近义词对（近义词必须讲清区别）。不进 Validator。
3. **课文复现加量约 40–50%**：`natural_recurrence.min_per_lesson` 早 5 → 10、晚 8 → 15，名单 20 → 30；计数文本新增 `recurrenceText()`（= `lessonText()` + AM output、PM rewrite 参考答案），新增的放在例句、sentences、rewrite / output 参考答案，阅读和对话不再加密。曝光账本的冷却仍只用 `lessonText()`，校验器行为不变。泛读复习词 8–12 → 12–16，focus ≥3 → ≥4（`publish-extensive-reading-candidate.js check` 的警告阈值同步，仍只警告）。
- **回放验证**：用扩大后的 runtime 对 10-09 至 10-15 的 14 个课时重新排序，14 个都放进了同词根组，用校验器同一套 `checkCore` / `checkPm` / `checkExposure` 检查推荐结果，0 个违规。
- **守卫**：规则文件与生成脚本的轮换名额都必须是 160；`review_groups` 开启且排序与检查脚本都实现；说明书保留“至少 10 个 / 至少 15 个 / review_groups / 12–16 / 至少 4 个 tier=focus”。测试 `test-check-recurrence.js` 12 项。
- **不变**：新词节奏、词卡数量、复习循环、Validator、发布流程。

## 23. 2026-10-16 新词优先进入训练（用户确认的 PR 1）

- **问题**：09-20 至 10-09 的 200 个早课新词，只有 23 个后来进过核心复习；训练里“这个专项从没练过”的词按“最久没在课程出现”排在最前，刚学的词总排最后，几天后就陌生。另外 `taught()` 用 `last_seen` 判断新旧，老词在课文复现后会被当成新词。
- **做法（只改训练排序，不改课程、新词数量、到期规则、掌握标准）**：
  1. `vocab-study-coach.js` 用 `first_seen` 计算“首次学习后第几天”（`age`，雅加达日期）；没有 `first_seen` 的词 `age=null`，排序与原来完全相同。
  2. 新词通道 `lane`：快速练习、自动训练里尚未被该专项检查过、未确认掌握、首次学习 1–30 天的词。每轮第一页最多放：快速练习 10 个里 4 个、自动训练 8 个里 3 个；按首次学习天数分三组：1–2 天、3–7 天、8–30 天（超过 7 天的积压不会消失），快速练习 2/1/1、自动训练 1/1/1，某组不够按“近→远”顺序由其他组补。其余位置仍按原顺序给到期复习和弱词；没有新词时名额全部回到原顺序。听词训练不变。
  3. 今日 8 项最多 2 个新词（自动训练 1、快速练习 1，不同词）。今天的新词 age=0 不进通道，所以早于课程发布生成的当日清单不会漏掉应选的词，也不重置已完成的任务。
  4. 读取 `indo_lesson_recall_v1`（课末回想，PR 2 写入；只对快速练习/自动训练生效，且只在比该专项最近一次练习更新时生效）：想不起来 > 有点慢 > 没有记录 > 马上想到，分数 +40 / +15 / −15。没有这项数据时完全不影响。自评永远不算通过、不改掌握、不改到期、不写课程错题。
  5. 今日建议面板新增一行：“最近 7 天新学 X 个词，已做过主动提取 Y 个、快速练习 Z 个（本机记录）”。
- **守卫**：`regression-guard.js` 检查 first_seen 年龄、4/3/2 上限、回想只读且不调用 `recordLessonWrong`。测试 `test-vocab-study-coach.js` 新增新词通道一组。

## 24. 2026-10-16 课末回想（用户确认的 PR 2）

- **位置**：只在今天的早课、晚课页面，最后一节之后、「我学完了」之前（`data/lesson-end-recall.js`）。可跳过，从不阻止「我学完了」，只提示“还有 X 个没回想”。
- **选词**：早课 = 昨天 08:00 首次学的新词，按实际数量（复习循环里没有新词就不出现，绝不凑数）；晚课 = 昨天晚课首次学的新词 + 2–3 个积压词（首次学习 2–30 天、还没有自动训练记录、昨天以来没回想过；2–7 天两个、8–30 天一个，上次没想起来的优先）。都排除已确认掌握的词和今天已练过的词。选词按课固定，刷新不变。
- **流程**：先看中文 →「想到了 / 想不起来」→ 显示答案和发音 → 想到了再选「对，很快 / 对，有点慢 / 不对」。记为 fast / slow / fail，每词每天只算第一次。
- **边界**：只写 `indo_lesson_recall_v1`。不调用 `recordLessonWrong`、不算自动训练或快速练习通过、不计入掌握、不改到期日。训练排序按 §23 使用这个信号。
- **跨设备**：`training-sync-client.js` 只在 Worker 的 GET `/training` 返回 `modes.recall` 时同步；同一词同一天取最早的作答（页面、客户端、Worker 同一规则），后上传的设备不会覆盖第一次回想。Worker 更新前页面显示“仅本机保存”，记录不会上传也不会丢失。Worker 需要重新部署一次（`cloudflare/WEAKNESS_SYNC_SETUP.md` 2026-10-16 节）。
- **守卫 / 测试**：`regression-guard.js` §24 组；`test-lesson-end-recall.js`（实际数量、积压、第一次作答、无副作用、训练排序、两台设备经真实 Worker 合并、旧 Worker 只存本机），在 `build-learning-runtime.yml` 运行。

## 25. 2026-10-16 自动训练逐词进度（用户确认的 PR 3，只显示）

- 每张自动训练卡片（含从画像进入的单词卡、冷却提示）显示一行进度：`阶段 x/4 · 跨日验证 x/3 · 下次 今天/明天/日期 时间`（雅加达时间）。从没练过显示“第一次训练”；稳定词显示“已稳定 · 跨日验证 3/3 · 下次抽查”。作答后同一行立即更新为“进入阶段 x/4 …”或“这次没通过 · 阶段 x/4 …”。
- 跨日验证 = 第 4 阶段（延迟验证）连续通过次数，间隔 2/4/7 天，满 3 次为稳定（与 `record()` 相同，不改规则）。
- 只读状态：`progressText()` 不写任何存储。守卫 §25 组，测试在 `test-cross-module-training.js`。

## 26. 2026-10-16 每周记忆报告（用户确认的 PR 4）

- **位置**：词汇画像新标签「本周报告」（`data/weekly-memory-report.js` 计算，`vocab-profile-ui.js` 显示），只读本机数据。
- **内容**：本周新学的词（首次学习在今天及前 6 天）；本周新增确认掌握（按掌握记录日期）；近 7 天新词（首次学习 1–7 天前）已正式验证的数量（快速练习、听词或自动训练任一有记录）；学后 7–30 天的词的正式测试正确率（最近 7 天、每词每天每个专项只算第一次，hinted 算未答对；少于 10 次显示“样本不足”）；课末回想覆盖和第一次回想的快 / 慢 / 没想起来（自评，单独列出，不进正确率）；反复遗忘的词（近 14 天至少 2 个不同的日子出错，正式训练或课末回想）；近 14 天每天的正式作答次数。
- **边界**：没有测试过的词不算掌握，也不算遗忘。报告不写任何存储。守卫 §26 组，测试 `test-weekly-memory-report.js`（`build-learning-runtime.yml` 运行）。

## 27. 2026-10-16 个人词汇画像 7 个标签合并为 3 个（用户确认）

- **今天**：三个专项的到期数（原“能力总览”上半部分）+ 今日针对性建议 + 近 7 天新词覆盖。
- **本周**：一句“本周结论”（本周新学、新词验证覆盖、7–30 天正确率或样本不足、反复遗忘数、近 7 天确认掌握变化，以及有证据时的一条建议）；“总体情况”（正式学习 / 确认掌握 / 待强化 / 待验证、本机主动词汇、本机稳定识别、主词库待学习、再次通过 / 验证后又忘）；本周报告（§26）；掌握数趋势图。原“学习建议”不再单列。
- **查词**：搜索 + 「弱词 / 到期 / 最近练过」筛选（默认弱词 = 反复遗忘 + 网站快照的重点弱词）；点开一个词显示三项能力状态、下次时间、真实轨迹；若是重点弱词，同时显示弱词原因和“去自动训练 / 去快速练习”。
- 旧标签名（overview / trend / weekly / advice / weak）仍能打开对应的新标签。从没练过的词不再显示 1970 年的占位时间，而显示“现在可练”。
- 守卫：`vocab-ui-regression-guard.js`（三个标签、旧名映射、本周保留长期数字和趋势、查词三个筛选），`regression-guard.js` §26 改为检查“本周”标签包含本周报告。

## 28. 2026-10-16 复习区可读排版（用户确认，只改显示）

- 早课 `review` 三段文字、晚课 `review.steps` 由 `history-v2.js` 的 `reviewReadableHtml()` 显示：开头“标题：”变成小标题；顶层“；”换行（括号和引号里的不拆）；“——”后面是 3 个以上、每个不超过 14 字的“、”列表时显示成小块；印尼语加深加粗，`vs` 单独淡色显示。
- 不猜答案、不生成互动题，文字内容一字不改；课程 JSON、校验器、生成任务都不变。旧课同样适用。
- 需要答案和互动卡片的结构化复习（`review_cards`）是下一步，单独 PR。

## 29. 2026-10-16 早课结构化复习 `review_cards`（用户确认）

- **课程合同不变**：`review` 仍然必须是 3 段文字（`AM_FINAL_REVIEW_INVALID`）。新增可选根字段 `review_cards`，是同一内容的结构化版本：`recall`（4–12 个 {cn, id}，答案必须是本课 vocab / review_vocab / cycle_vocab 的词）、可选 `frames`、`contrasts`（1–6 组 2–3 个词 + 一句区别）、`apply`（1–4 个词，各 1–3 个例句）。
- **校验**：字段不存在不检查；存在时格式错 `AM_REVIEW_CARDS_INVALID`、答案不是本课的词 `AM_REVIEW_CARDS_ANSWER`。生成任务按报错改一次，仍不通过就删掉整个字段，不改动 review 或其他内容（`docs/tasks/AM-LESSON.md`）。
- **网页**：`history-v2.js` 的 `reviewCardsHtml()`：提取卡片显示中文、点开显示答案和发音（不记分、不存储）；易混词每组一块并附一句区别；应用词一词一块、例句带发音和中文。缺字段的条目跳过，什么都没有时退回 §28 的三段文字排版。
- **守卫 / 测试**：`regression-guard.js` §29 组和 AM 说明书标记；`test-lesson-candidate.js` 新增 4 项（有卡片通过、答案不是本课的词、对比组不足 2 个、类型错误）。
- **同 PR 修复（CI 预检）**：停用的 V4 预演选到一个词根没有中文意思的词，报 `ROOT_CN_MISSING`，和本改动无关但让预检变红。`core.js` 现在先按词根本身查意思，查不到就把这个词当作自己的词根。只影响 CI 里的 V4 预演，不影响正式生成。守卫 §29 的代码检查在预检的“基线树”上跳过（基线是改动前的 main）。

## 30. 2026-10-17 课程标题双语（用户要求）

- 以前早课标题只有印尼语、晚课标题多是中文。现在两课都写成 `时间 早课/晚课｜印尼语标题 · 中文标题`（`docs/tasks/AM-LESSON.md` §5、`PM-LESSON.md` 根字段说明）。仍以时间开头，校验器 `TITLE_INVALID` 规则不变；旧课标题不改。
- 守卫：两份说明书必须保留“标题双语 / 印尼语标题 · 中文标题”标记。

## 31. 2026-10-18 今天的重点 `lesson_focus`（用户确认的带学方案第 1 步）

- **课程数据**：早晚课新增根字段 `lesson_focus = {words: 3 个本课的词, patterns: 2 个 {pattern, cn, example, example_cn}}`，example 逐字取自本课（早课：sentences / reading / 词卡例句 / output 参考答案；晚课：reading / dialogue / 词卡例句 / rewrite 参考答案）。**2026-10-18 晚课起必填**（原定 10-19，用户要求提前到当晚；当天早课已发布，不补）；之前的课没有这个字段也照常有效，不批量修改历史 JSON。不新增词、不改新词数量、词池、复习名额和题目。
- **校验**：`validate-lesson-candidate.js`：`LESSON_FOCUS_MISSING` / `INVALID` / `WORD` / `PATTERN`。停用的 V4 预演也机械地生成 lesson_focus，CI 预演保持可用。
- **网页**（`history-v2.js`）：有 lesson_focus 时课程顶部显示“今天的重点”卡片；词卡上重点词加小“重点”标签；句子、课文、对话里出现的重点例句用浅色标出。没有字段的课程完全照旧。
- **回想排序**：渲染课程时把重点词存到 `indo_lesson_focus_v1`（本机）；第二天课末回想里重点词排在前面（积压词里排在“上次没想起来”之后）。资格规则（已掌握、当天练过、昨天以来回想过）和“每词每天第一次作答为准”不变，不会多加词。
- **守卫 / 测试**：§31 代码检查（基线树跳过）、AM/PM 说明书标记；`test-lesson-candidate.js` +8 项，`test-lesson-end-recall.js` 新增重点排序一组。

## 32. 2026-10-18 词卡排版（用户确认，只改显示）

- `history-v2.js` 的 `vocabHtml` / `vcCard`：标题区三行（单词 + 发音 / 中文 / 英文）；例句移到意思下面；词根一行（`词根 abai 疏忽 · meN- + abai + -kan → mengabaikan`，保留 `.dailyFixMeta` 类，晚课“今天 08:00 新学”标签仍插在这里）。
- 其余内容按课程原文已有的小标题拆分并默认收起：常见搭配、同词根（含被动式/名词形式、同词根组）、辨析（`A vs B` 加粗 + 逐句）、反义、口语、怎么用（`usage_note`，以前没显示）、补充（拆不出的原句）。文字不改写。所有词卡（含“今天的重点”词）默认收起（2026-10-18 用户要求；重点词只多一个“重点”标签）。
- 收起时同一行两张卡一样高（`vcEvenRows`，课程渲染后、展开收起、窗口变化时计算）；展开的卡单独变高。旧的 `daily-density-fix.js` 等高规则对新卡用更具体的选择器覆盖。
- 历史课程同样生效；课程 JSON、校验器、生成任务都不变。

## 33. 2026-10-18 带学模式（用户确认的方案第 2 步）

- **入口**：只在带 `lesson_focus` 的课程“今天的重点”卡片上显示「开始带学」；原来整页不变，带学里随时「回到整页」，下次从停下的那一步继续。
- **早课流程**：今天的重点 → 3 个重点词（听 / 跟读 / 盖住说）→ 其余的词扫一眼（认识 / 不熟，只给自己看）→ 2 个句型（听 / 跟读两遍 / 看中文说 / 换成自己的话）→ 课文（先听不看 / 看中文大意 / 抓重点句 / 30 秒复述）→ 回到整页做小测、课末回想、「我学完了」。
- **晚课流程**：先快检当天早课的重点词（早课有重点时）→ 同上的重点和词 → 对话练习（学习者说重点词最多的角色的台词：先看中文说，再看原句）→ 句型 → 课文 → 回到整页做改写、小测、复盘、课末回想。
- **内容来源**：全部来自本课（词卡、对话、课文、lesson_focus）；复习词的意思取自词库；不生成新题或答案。
- **录音**：浏览器支持时可“录下我读的 / 听我的”，只在本机播放，不上传、不评分。
- **记录**：只写 `indo_guided_lesson_v1`（进度、自查结果、完成日期 → 连续带学天数）。不写训练结果、课末回想、课程错题或掌握。
- **守卫 / 测试**：§33；`test-guided-lesson.js`（早晚流程、内容来源、早课重点快检、不写其他数据），在 `build-learning-runtime.yml` 运行。


## 34. 2026-10-19 深讲版带学（试点 PR 1）

- **入口**：今天的重点卡片原有 `data-guided-start` 按钮。`data/deep-teach.js` 在捕获阶段接管点击，且只开一个覆盖层；`GuidedLesson` 的现有实现不变。深讲版全屏覆盖，header、导航、对话和按钮都在 `.dt` 作用域内，支持深浅色与系统字体。「回到整页」/ Escape 关闭后回到原位置，词卡默认收起不变；「用旧版带学」关闭深讲再打开旧版。
- **数据来源顺序**：先读可选 `lesson.lesson_focus.teach`，没有则 fetch `data/teach/YYYY-MM-DD-am|pm.json`，404 表示没有。找到数据先执行 `DeepTeach.validateShape`；缺失、形状不合格、网络/解析失败均退回 `GuidedLesson.open`，异常在控制台 warn。找到但不合格的内嵌数据不再改用旁挂内容。旁挂文件只是 10-18 晚课、10-19 早课的试点，后续生成接入另一个 PR，本 PR 不修改任何课程 JSON。
- **不写任何记录**：深讲版只有当前覆盖层内的临时状态，关闭清空。简明讲解、内容来源开关也不保存；不新增存储键，不写训练、课末回想、错题、掌握，不调用这些模块的写接口。切回旧版后，旧版按自身既有规则工作。
- **教学行为**：保留原型的先问再讲、会的快进、答错补讲、逐级提示和收尾诊断。待回想项在讲完时记录已完成环节数，之后真正经过 ≥2 个其他环节再问；未独立想起再隔 ≥2 个环节，最多两次。结束分类区分独立说出和提示后说出，导航跳过的内容不会列为已经稳了。
- **校验/测试**：`.github/scripts/validate-teach.js` 导出 `validateTeach(lesson, teach)`，保留原错误码和双文件 CLI；`test-deep-teach.js` 覆盖两份真实数据、故意损坏的引用/答案/解释/骨架/拆句/标记/重点、纯逻辑、安全转义和无数据兜底。新增守卫全部 `okNew`，基线树跳过；接入现有 `build-learning-runtime.yml`，不新增工作流。
- **验收**：全回归和全部 `test-*.js`；400px 宽三种学习策略跑到结束，无脚本错误、无横向滚动；深浅截图；关闭位置和折叠状态不变；深讲过程存储快照不变。旧课缺 lesson_focus 时仍不显示入口；可对真实试点课模拟旁挂 404 来验证旧版覆盖层。PR 合并并完成 Pages 部署后，仍需线上打开 10-19 早课确认，PR 阶段不能宣称已部署。

## 35. 2026-10-19 旧版带学暂停（用户要求）

- 用户要求暂停旧版带学：「今天的重点」卡片上的「开始带学」按钮**默认隐藏**（`history-v2.js` 渲染时带 `hidden`），只有 `deep-teach.js` 确认这节课有可用的讲解数据（`lesson_focus.teach` 或 `data/teach/D-S.json`，并通过形状检查）后才显示，点开就是深讲版。
- 没有讲解数据的课程不显示带学入口，不再退回旧版；深讲版里的「用旧版带学」链接已去掉，讲解出错时直接回到整页。
- `data/guided-lesson.js` 和 `indo_guided_lesson_v1` 保留不删，只是不再被打开；恢复旧版需要用户明确要求。
- 守卫 / 测试：§34 的兜底检查改为"无讲解数据 → 不显示入口、不调用 GuidedLesson"；`test-deep-teach.js` 断言按钮默认隐藏、源码不再调用 `GuidedLesson.open`。

## 36. 2026-10-21 深讲每节生成（用户决定：早晚课都写，先试几天）

- **谁写、何时写**：早课、晚课任务在课程 PR 开出之后，按 `docs/tasks/DEEP-TEACH.md` 为同一节课写 `data/teach/D-am|pm.json`，在 `teach-D-am|pm` 分支单独开一个 PR（正文 `AUTO_PUBLISH_TEACH=1`）。课程优先：深讲的任何问题都不得影响、修改或推迟课程；早课 08:15、晚课 18:30 还没写完就放弃当天深讲。`COMMON.md` §2 的“一个文件、一个 PR”只为此开一个例外；定时任务提示词的底线行同步加了这一句（用户同意修改任务）。
- **发布**：`sync-daily-vocab.yml` 新增 `teach_release` job（不新增工作流）。闸门同泛读（同仓库、所有者、分支名、标记）；PR 只能改这一个文件；先等课程进入 main（最多 30 分钟），main 上已有同名深讲就拒绝；用 main 的受信任 worktree 跑 `check-teach.js`（`validate-teach.js` + 网页自己的 `DeepTeach.validateShape`），通过后按 PR head squash merge，输出 `DEEP_TEACH_PUBLISHED`。job 用自己的并发组 `teach-release-<PR>`，不占 `learning-data-write`，不碰任何学习数据。通用 preflight 跳过 `teach-` 分支；PR 路径过滤加了 `data/teach/*.json`。
- **精简**：`validate-teach.js` 新增体积上限（紧凑 JSON >26000 字符为错误，>15000 警告）、情境题选项 ≤3（错误），讲解段数、旁问数、阅读句数、开口任务数、对话轮数超过目标给警告。两份试点仍通过（只有警告）。
- **晚课换场景**：`docs/LESSON-QUALITY.md` 7c，晚课不沿用当天早课的故事和场景。
- **测试**：`test-teach-release.js` 在临时 Git 仓库直接执行工作流里的真实脚本（gh、sleep 为本地替身），覆盖合并、多余路径、课程未上 main、深讲不合格、已存在不覆盖、已合并空操作；`test-deep-teach.js` 新增体积、选项数、`check-teach` 和“main 上每份深讲都能通过检查”。两者接入 Build learning runtime。

## 37. 2026-10-22 课程质量点评（用户同意按点评修改）

- `docs/LESSON-QUALITY.md`：阅读只放能自然放进去的新词（早课一般 5–7 个），其余放实用句和例句；写完逐个事件做情节合理性检查（反例：科学竞赛要交家谱和血型、一句列四种动物）；复现数量统计全课文本，不必压在阅读里。近义辨析不绝对化（反例：lolos / lulus，选拔场合两者都可用），可互换的说法不得判错。选择题题干不给正确答案的中文，三题至少一道完整情境判断（晚课 fill 的括号中文提示按合同保留）。新增 7d：给学习者看的文字不出现系统用语。
- `validate-lesson-candidate.js`：`LEARNER_JARGON`，2026-10-23 起的课程，学习者可见字段（不含 en 和结构字段）出现 runtime、`*_pool`、source_group、（hard）、application 等即拒绝；之前已发布的课程不重新判定。`validate-teach.js`：`TEACH_JARGON`。
- `data/teach/2026-10-22-am.json`：lolos 备用题里 lulus 改为“也可以”，讲解和提醒句补上“选拔场合两个都能用”。当天早课 JSON 的词卡不改（已发布课程不回改）。
- 深讲其余新词的快速回忆（引擎改动）暂缓，等用户试用几天后再定。

## 2026-10-24 词汇训练排除（不混淆已掌握）

- 「词汇学习」词卡和批量管理的「不再训练」只改变后续**主动选词资格**；不删除历史课程、阅读原文和词库内容。批量管理默认收起，未改首页模块、排序或首屏布局。
- 不新增云端记录类型、键、Worker 或另一份本机黑名单。为了兼容**当前已部署**的 weakness-sync Worker，复用 `status=mastered` 并在现有 `reasons` 数组最前保留 `training_excluded`、原因与原 mastered 状态标记。所有统计必须优先识别 `training_excluded`，不得把主动跳过当作真正 mastered；恢复时保留以前的模糊/不会原因以及原 mastered 身份和掌握时间。
- 已有真正 `mastered` 不迁移、不重新标记；核心训练的快速/听词/自动候选和已保存的自动计划都必须跳过真正 mastered 与训练排除词。已排除词不能因为再次读到历史题、错题或听音信号自动变回 active。恢复必须由用户显式操作。
- 词汇筛选须一次获取弱项快照并建立 Set/Map；禁止在 977 词循环中逐词调用 `WeaknessPool.get()`/ `isExcluded()` 反复解析本机弱项数据。
- **2026-10-24 性能修复**：`VocabStudyCoach.snapshot()` 只能读取一次弱项全集，随后所有核心候选复用 snapshot.excluded；`WeaknessPool.isExcluded()` 的排除 Set 在保存和跨标签页 storage 变化时失效。严禁在 `status()` 的逐词循环里直接重新解析 `indo_weak_pool_v1`。回归测试覆盖「120个候选只读一次」和「连续120次排除查询只读一次、写入后清缓存」。
- 全面运行 `test-cross-module-training.js`、`test-vocab-study-coach.js`、`vocab-ui-regression-guard.js` 和 `regression-guard.js`。仅语法解析或单个功能模拟不等于完整 CI 通过。
