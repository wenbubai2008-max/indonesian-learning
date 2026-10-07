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
- V2 兜底时间门：AM 不早于 08:30（Claude 08:00 早课任务 07:30 开始生成，需要留出发布时间），PM 不早于 18:05；cron 为 `30 1 * * *` 与 `5 11 * * *`
- **V4 备用课程生成：自 2026-10-03 起暂时完全停用（用户明确指示）。** Claude 是唯一的自动课程生成者：07:30 开始生成 08:00 早课，17:30 开始生成 18:00 晚课。上面的 08:30/18:05 时间门与两条 cron 保留，但只做健康检查、Sync 和“恢复同一份已保存原稿”，不再生成任何备用课程。原先计划把 PM 兜底从 18:05 延后到 18:30 的修改已撤销（从未落地）。只有用户明确指示后才能重新启用，并须同步更新回归守卫。

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
- ChatGPT 自动课程不直接写 daily-vocab
- GitHub Runner 在仓库内完整读取并同步
- ChatGPT 课程任务只写当天唯一 AM/PM lesson JSON 到 `lesson-release-YYYY-MM-DD-am|pm` 分支，并打开带 `AUTO_PUBLISH_LESSON=1` 的同仓库 PR；`index.json` 由现有 `sync-daily-vocab.yml` 的 lesson release job 基于最新 main 与权威 planner 自动生成。ChatGPT 不再直接 update `data/daily/index.json`。

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

泛读发布不新增第三条 workflow。2026-09-30 起，长期发布逻辑放在现有 `sync-daily-vocab.yml` 的独立 `extensive_reading_release` PR job 中，但该 job **不得读写 daily-vocab/runtime**。泛读生成任务（2026-10-08 起为 Claude 定时任务，此前为 ChatGPT）每天只在同日 `extensive-reading-YYYY-MM-DD` 隔离分支写一个临时候选 `data/extensive-reading-candidate.json` 并打开带 `AUTO_PUBLISH_EXTENSIVE_READING=1` 标记的同仓库 PR；GitHub Runner 从受信任的 main 脚本生成/验证旧文归档、轻量历史索引与今日单篇文件，删除候选文件后用 PR head 精确 SHA squash merge。这样正式 main 仍只有一个发布 commit，历史三文件事务由 GitHub 完成，ChatGPT 不再直接移动 main ref 或连续写三个正式文件。若 main 在生成/合并期间前进，保留 release 分支并停止，不 force push、不用旧 base 强并。 Runner 校验完成后，最终分支提交使用 `[skip ci]`，避免自身推送再触发一次 `pull_request synchronize`。squash merge 必须显式设置不含跳过标记的 commit_title 与 commit_message，确保正式 main 的 Pages 部署照常触发。普通候选提交不加跳过标记，仍正常校验；保留已 merged/closed 的幂等退出作为兼容保护。若以后启用强制 PR 状态检查，须重新评估此策略，不得绕过分支保护。

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

- 正常 AM/PM：ChatGPT 写唯一 lesson 并打开授权 release PR；GitHub Runner 从最新 main 自动生成 index、运行权威校验并按最终 head SHA squash merge，使 lesson + index 以一个正式 main commit 原子进入。由于该 merge 使用 `GITHUB_TOKEN`，lesson release job 随后必须显式 `workflow_dispatch` 同一个 `sync-daily-vocab.yml` 的 main 运行，不能假设普通 push 会递归触发。该 Sync 完成完整回归、同步、推送后重新读取远端 main，再运行一次回归确认；只有通过才报告同步成功。雅加达 08:12、18:12 各保留一次兜底定时触发（UTC 01:12、11:12），先只读确认课程、index、runtime、水位、新词退出与回归结果；全部健康即直接结束，不运行 builder、不提交、不部署；仅异常才进入已有安全重算。GitHub cron 无法基于前次成功动态取消事件，故健康时仍会启动一次轻量任务，但不进行修复工作；可能有平台延迟。
- 两个现有 writer 均采用最新 main 重算与有限重试；不使用 stale rebase、不强推、不重复生成课程、不制造空提交。定时补偿仅能恢复已经正确提交且 index 标记完成的课程；ChatGPT 在提交前失败时，GitHub 无法凭空生成未保存的课程。
- 每次 GitHub Actions 失败：捕捉初步类别、失败阶段、退出码、时间、触发 SHA、当前本地/远端 HEAD 与原始 Run URL；写入 Job Summary，使用 upload-artifact 保存 90 天，并通过 issues:write 按 workflow+category+phase 去重建立/更新 GitHub Issue。原始完整异常以 Run 日志为准，不把初步类别当成已证实根因。
- 如果仓库 Issues 或 artifact 服务自身不可用，原始 GitHub Run 日志依然保留；Issue/附件不可用须明确说明，不得声称记录完整。
- 定时补偿需要真正幂等：runtime 比较跨 VM 来源的派生数组时按 JSON 内容比较，而不是要求原型完全相同；runtime 与词汇画像的数据内容无变化时沿用上一次 `generated_at`，审计时间和 runtime 保持一致；即使定时检查运行，也不能因时钟变化而推送三份派生 JSON、触发无意义 Pages 部署。数据确实变化时才刷新时间戳与提交。
- 不新建第三条 workflow；不在失败恢复时修改课程内容或学习词池；不使正式 08:00/18:00 自动任务 disabled。历史事故另见上一节 J。

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
- 18点自动任务 prompt
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
- [ ] 4–5 review
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
- **需要外部配合**：07:30 / 17:30 生成任务的提示词里要加入“先运行 rank-natural-recurrence.js，在阅读/对话/例句里自然带入约 6–8 个”，否则只有数据、没人使用。
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

