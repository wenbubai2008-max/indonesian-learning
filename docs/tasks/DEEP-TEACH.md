# 深讲数据说明书（08:00 早课、18:00 晚课任务共用，2026-10-21 起）

用户决定（2026-10-21）：深讲版带学每节课都要有，先试几天。早课、晚课任务在**课程 PR 开出之后**，为同一节课写一份深讲数据 `data/teach/D-am.json` / `data/teach/D-pm.json`，单独开一个 PR。网站上“今天的重点”卡片的「开始带学」按钮只在这份数据存在且合格时出现（`data/deep-teach.js`）。

## 一、边界（不能放宽）

- **课程优先**：先按各自说明书把课程写完、校验、push、开 PR。深讲是课程之后的附加步骤，深讲的任何问题都不得影响、修改、重发或推迟课程。课程 PR 没能开出、被关闭或 release 失败时，不写也不发深讲。
- **只写一个文件、开一个 PR**：从最新 `origin/main` 建分支 `teach-D-am` / `teach-D-pm`，只提交 `data/teach/D-am.json` / `data/teach/D-pm.json`，一次性 push；用 REST 开 PR（base=main，标题 `Deep teach D am|pm`，正文单独一行 `AUTO_PUBLISH_TEACH=1`）。不自己合并。
- **谁来合并**：`sync-daily-vocab.yml` 的 `teach_release` job 会先等这节课进入 main（最多 30 分钟），再用 main 上的 `check-teach.js` 校验，通过后按 PR head squash merge。课程还在发布中时就可以开深讲 PR，不用等。
- **时间上限**：深讲写作约 10–15 分钟。早课到 08:15、晚课到 18:30 还没写完就放弃当天深讲，在汇报里说明。不能因为深讲拖延课程验收。
- **不写任何学习记录**：深讲页面本身不写存储；深讲数据也不得改动课程、词库、runtime 或任何学习数据。
- 深讲不是课程，发布失败时**不**用 SendUserFile 发给用户。

## 二、格式

结构以两份试点为准：`data/teach/2026-10-19-am.json`（早课）、`data/teach/2026-10-18-pm.json`（晚课）。只参考结构和写法，不复制内容。标记：`{{印尼语}}` 可点读，`[[…]]` 高亮，`**…**` 加粗，三种都必须成对。

| 字段 | 要求 |
|---|---|
| `version` / `title` | `1`；`早课深讲 · 10月21日` 或 `晚课深讲 · 10月21日` |
| `intro` | 2 段：一句话讲本课故事；“今天只讲 5 样：[[词1]] · [[词2]] · [[词3]] · [[句型1]] · [[句型2]]” |
| `items` | **恰好** `lesson_focus` 的 3 个词 + 2 个句型，`name` 与 `lesson_focus.words` / `patterns[].pattern` 逐字一致；`key` 唯一 |
| `scan` | 本课其余新词（不含重点词）：`{head, intro, words}`；晚课没有其余新词时省略 |
| `reading` | 1–2 个阅读原句拆解：`sentence` 是阅读原文里的整句（逐字），`chunks` 拼起来等于原句，`steal` 给一个可借用的句型和新例句，可带 `check` |
| `dialogue` | 仅晚课，可选：≤3 个 `turns`，`line` 是课程对话的行号（递增），`skel` 的固定部分逐字出自该行 |
| `tasks` | 1 个开口任务，早课取自 output、晚课取自 rewrite，缩短 |
| `next` | `回到整页做小测、课末回想和「我学完了」。这些都不变。` |

每个 item：

- `head`：`词 · 中文`。
- `scene`：`quotes` 引用课程原句（逐字），`ask` 先问学习者一个情境问题，`options` 2–3 个，恰好一个 `ok:true`；每个选项的 `reply` 都要说清为什么对或为什么错。
- `explain` 1–2 段，每段 ≤150 字；`simple` 一段 ≤90 字（“讲简单一点”时用）。
- `asks` ≤2 个：一个 `remedy:true`（第一次答错时自动换角度讲，可用 `{table:[[a,b],…]}`）；另一个优先用 `{label, from:"synonym_note"|"usage_note"|"formation", word?}` 直接引用词卡原文，省字数。
- `check`：3 个选项，恰好一个 `v:"right"`，每个选项都有 `why`（错项说明错在哪；`ok` 项写明什么场合也能用）；`backup` 同结构换一题。
- `say`：`prompt`、`kw`（用 ` · ` 分隔，都出现在 `ref` 里）、`skel`（含 `____`，固定部分按顺序逐字出自 `ref`）、`ref`、可选 `notes`。
- `recall`：同 `say` 的结构，**换到课程里没有的新场景**，`ref` 不得抄课程原文；`recall2` 可省略。
- `final`：`{cn, ref}`，又一个新场景，不得重复前面任何一个 `ref`。
- `remind`：一句话要点（结束诊断里给“还不稳”的词显示）。

## 三、写法（精简版，2026-10-21 用户确认）

- 目标：一节深讲约 15 分钟。先问后讲：情境题让学习者先猜；答对只给一句点评，答错才展开。讲解短、具体，不写成词卡全文。
- 新场景：`recall`、`final`、开口任务放到课程里没出现过的生活场景。晚课不要沿用当天早课的场景（音乐会学的词，晚课拿去咖啡店、工作、家里用）。
- 口语：按场合写参考答案。朋友、家人之间用 aku/kamu、nggak、udah 等，在 `notes` 里注明标准形；对上级、顾客用 saya 和标准形。
- 不引入本课和已学范围以外的生词：与课程相同的内容守卫，`runtime.new_pool` 里不属于本课的未教词不得出现。
- 事实与课程一致，印尼语按 `docs/LESSON-QUALITY.md` 第 1 节逐句母语化审稿，搭配黑名单同样适用。
- 体积：紧凑 JSON 目标 ≤15000 字符，上限 26000（超过直接不合格）。试点约 18000，写得比试点短。

## 四、校验（必须实际运行）

```
node .github/scripts/check-teach.js --lesson data/daily/D-S.json --teach data/teach/D-S.json
```

必须 `ok: true`、`shape_ok: true`（`shape_ok` 是网页自己的格式检查，不通过就不会出现按钮）。warnings（`TEACH_LONG`、`ASKS_MANY`、`EXPLAIN_PARAS` 等）尽量改掉；改不掉的在汇报里说明。错误先改同一份稿件再重跑；改一次还不过就放弃当天深讲。

## 五、核验与失败

- 成功标志：深讲 PR `merged=true`；main 上有 `data/teach/D-S.json`；随后的 Pages 部署 success。日志可下载时会看到 `DEEP_TEACH_PUBLISHED`。
- `teach_release` 失败：日志拿不到时看 PR 状态和 main。稿件问题可以在同一分支提交**一次**修正（不换分支、不开第二个 PR）；“Lesson not published”说明课程没上 main，按课程的失败处理，不再动深讲。
- 不关闭、不重开 PR 来触发运行。

## 六、汇报

课程汇报末尾加一行：`深讲：已发布 PR #n（大小 x 字符，warnings y 个）` 或 `深讲：未发布（阶段 + 原因）`。
