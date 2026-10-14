# 定时任务共用规则（08:00 早课 · 18:00 晚课 · 12:00 泛读）

本目录是三个 Claude 定时任务的**完整说明书**（2026-10-14 起）。定时任务本身的提示词只负责添加仓库、clone，然后读本目录；任务行为的任何修改都在这里通过 PR 完成，回归守卫会检查关键要求没有被删弱。不要再把规则写回定时任务提示词里，也不要在提示词里另加“补充”段落。

每个任务开始时先读本文件，再读自己的说明书：

| 任务 | 开始时间（Asia/Jakarta） | 说明书 |
|---|---|---|
| 08:00 早课 | 约 07:24 | `docs/tasks/AM-LESSON.md` |
| 12:00 泛读 | 约 11:24 | `docs/tasks/EXTENSIVE-READING.md` |
| 18:00 晚课 | 17:30（实际可能晚几分钟） | `docs/tasks/PM-LESSON.md` |

三个任务互不触碰对方的产物。Claude 是唯一的自动课程/泛读生成者。

## 1. 身份、日期与仓库

- 每次运行都是全新会话，没有之前的对话记忆。向用户汇报一律用简洁中文。
- 当天日期 `D = TZ=Asia/Jakarta date +%F`，不得写死任何历史日期。
- 仓库：`wenbubai2008-max/indonesian-learning`（主分支 main）。会话里没有该仓库时，先用 add_repo（owner=wenbubai2008-max，repo=indonesian-learning，access=push）添加，再 `git clone --depth 50`（给足约 10 分钟超时，只 clone 一次）。部分回归测试需要较深历史，测试因缺提交失败时 `git fetch --no-tags --depth=1500 origin main`。
- 本环境的 GitHub 身份就是仓库所有者，能通过 release job 的作者闸门。GitHub GraphQL 不可用，`gh pr ...` 会失败，一律用 REST：`gh api repos/wenbubai2008-max/indonesian-learning/...`。
- 不得把 token 或密钥写进课程、提交信息或日志。

## 2. 写入边界

- 每个任务每天只在自己的唯一分支上提交自己的**一个**文件，并开**一个** PR：
  - 早课：分支 `lesson-release-D-am`，文件 `data/daily/D-am.json`
  - 晚课：分支 `lesson-release-D-pm`，文件 `data/daily/D-pm.json`
  - 泛读：分支 `extensive-reading-D`，文件 `data/extensive-reading-candidate.json`
- 禁止 `-v2`、`-fix`、`-new` 之类的第二条分支，禁止第二个 PR、第二份课程或第二篇泛读。
- 不直接写 main；不写 `data/daily/index.json`、`data/daily-vocab-data.js`、`data/learning-runtime.json`、`data/lesson-context.json`、`data/weakness-sync.json`、词库、mastered 状态、规则、Validator、Workflow，也不写本目录以外的任何文档。不新增工作流、定时任务、数据写入者或外部 API。
- **一次性 push**：从最新 `origin/main` 在本地建分支，只提交自己的那一个文件，一次 push。不要先推空分支，不要 force push。push 后回读远端文件，确认内容完整、可解析，记下 commit SHA。
- **不自己合并**。仓库 `sync-daily-vocab.yml` 的 `lesson_release` / `extensive_reading_release` job 负责最终校验、生成派生文件、squash merge、触发 Sync 和 Pages。PR 页面出现绿勾不等于已发布。

## 3. 先恢复、后生成

开始生成之前，先查远端真实状态（main 上是否已发布、自己的分支和 PR 是否已存在、是否有正在运行或刚失败的 release job），从最远的已验证 checkpoint 继续。上一次中断留下的成果要恢复，不要重新选词、重新生成。早晚课的完整 checkpoint 规则见 `docs/LESSON-RECOVERY.md`；泛读的规则写在 `EXTENSIVE-READING.md`。

## 4. 校验与汇报要诚实

- 未实际运行的检查不得声称通过。“人工预检通过”和“权威 Validator 实际运行通过”要分开说明。
- 发布后核验说明哪些是直接核验（看到了日志里的标记），哪些是间接核验（Actions 日志因网络限制下载不了，改看 PR merged、main 上的文件、后续 Sync、水位、Pages 状态）。
- 课程或泛读已发布、但 Pages 尚未确认时，要明确这样说，不能虚报完全成功。
- 如果本说明与仓库当前的权威规则（`data/learning-pool-rules.json`、Validator、`docs/` 下其他文档）冲突，以仓库为准，但不得自行放宽任何标准。

## 5. 失败处理

- 原则：先看 GitHub 远端真实状态，再决定下一步；看到错误就重做整节课是禁止的。
- 写入失败要区分 timeout、连接错误、429、5xx、409/422、权限拒绝、上游安全拒绝。结果不确定时先回读同一路径，已写入就继续；可重试的临时错误最多两次有界重试，遵守 Retry-After；明确的安全拒绝不得反复提交，也不得换接口绕过。记录原始错误和 Request ID。
- 稿件问题（Validator 或 check 报错）：还没写入远端就改同一份原稿重验；已进入 PR 的，只在同一分支做一次有记录的修正（详见各说明书），不改已锁定的词汇资格和内容语义。
- release job 失败而日志无法下载时，先在最新 main 上运行 `node .github/scripts/regression-guard.js`。若 main 本身有失败项，那是 main 的问题：不要自行修改守卫或其他仓库文件，保留 PR 和原稿，用 SendUserFile 发出完整 JSON，并用 PushNotification 明确告诉用户需要修复 main。main 修好后由用户重跑 release job，不开第二个 PR。
- 内容已生成但没能发布：用 SendUserFile 把**同一份**完整 JSON 发给用户，让用户当天仍能学习，并明确说明网站未更新。
- 失败汇报必须写清：失败发生在哪个阶段、原始错误、远端已完成到哪个 checkpoint、是否已正式发布、恢复还需要什么。不要只说“GitHub 出错了”。
- 无论成功或失败，都不得禁用、暂停或修改任何定时任务（包括自己）。

## 6. V4 备用课程生成已停用

2026-10-03 起，按用户明确指示，V4 备用课程生成完全停用（详见 `docs/LESSON-RECOVERY.md` 的 “V4 backup generation is paused” 一节）。不存在任何自动备用课程。08:30 / 18:05 的仓库定时检查只做健康检查、Sync 和“恢复同一份已保存原稿”。原课程生成或发布失败时：保留原稿和错误记录，如实报告，不补课、不生成第二份课程、不重新启用 V4（create 监听器、失败 PR 派发、`LESSON_V4_FALLBACK`）。只有用户明确指示才能重新启用。

## 7. 修改本目录的规则

- 用户对课程或泛读提出新的要求或点评时：教学质量写进 `docs/LESSON-QUALITY.md`，流程和选词步骤写进对应说明书，规则写进 `data/learning-pool-rules.json`；不改定时任务提示词。
- 修改后运行 `node .github/scripts/regression-guard.js`；守卫会检查三份说明书仍包含发布标记、分支命名、必跑脚本、V4 停用、验收标准等关键要求。
- 不得借修改说明书删弱 AM/PM 合同（见 `docs/REGRESSION-GUARD.md` §2.A）。
