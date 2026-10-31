# 复习阶段说明书（休眠中，开关打开后才适用）

用户决定（2026-10-25）：新词学完后的复习阶段规则先放进仓库，**默认关闭**。等新词学完、用户通知，再按第七节打开。开关是 `data/review-phase.json` 的 `active`。

## 一、先看开关（每节课都要做，必须实际运行）

```
node .github/scripts/review-phase.js --date D --session am|pm
```

- 输出 `"active": false`：**忽略本说明书全部内容**，按 `AM-LESSON.md` / `PM-LESSON.md` 原规则出课。
- 输出 `"active": true`：本说明书覆盖原说明书里的数量和结构（第二至五节）；没提到的部分照原说明书。输出里的 `counts`、`plan`（本周主题和今天的分工）、`recurrence_min` 是准数，和本文不一致时以输出为准。
- 开关只认 `active` 是 `true` 且课程日期不早于 `activated_at`。课程 PR 里不得修改 `data/review-phase.json`、`data/themes.json` 或 `data/vocab-goals.json`。

## 二、08:00 早课：表达难点课

目标：把学过的词从“看得懂”推到“分得清、说得出”。

| 部分 | 复习阶段要求 |
|---|---|
| 词卡 `vocab` | 5–7 张。还有合法新词时先教新词，其余是复习循环词（排序输出 `review_cycle.cycle_words`，数量已按 `counts.am_target` 算好），根字段 `cycle_vocab` 恰好列出不是新词的那些。规则同 4.5。 |
| `review_vocab` | 4–6 个，不变（句子、小测用）。 |
| 表达难点 `review_cards` | **必填**。`contrasts` 1–6 组：每组 2–3 个容易混的词或说法，`note` 一句话说清区别和各自的场合；能互换的不要写成“只能用 A”（`LESSON-QUALITY.md` 第 2 节）。`recall` 4–12 个、`apply` 1–4 个，格式同原规则。 |
| 阅读 `reading` | 60–100 词，放在本周主题的场景里。 |
| 自然复现 | 至少 `recurrence_min`（默认 6）个名单词，`check-recurrence.js` 检查。 |
| `phase` 根字段 | `{"theme_id": "...", "day_role": "..."}`，照抄 `review-phase.js` 输出的 `plan`。 |

`sentences` 5 句、`quiz` 3 题、`output`、`review` 3 条、`lesson_focus`（3 词 + 2 句型）都不变。

## 三、18:00 晚课：任务课

目标：在一个要办成的事里把旧词用出来，遇到变化也能接着说。

| 部分 | 复习阶段要求 |
|---|---|
| 词卡 `vocab` | 6–8 张：新词 = 剩余合法新词全部（最多 3 个），复习 4–6 个（数量用排序输出的 `review_cycle.review_target`），application 1–3 个。 |
| 对话 `dialogue` | 8–12 行，围绕一件要办成的事（退货、改约、报修……）。中途有一处**转折**：对方不配合、出了问题或改了主意。`dialogue.twist` = 转折那一行的下标（从 0 数，不能是第 0 行）。 |
| `rewrite` | 3–4 个，至少 1 个带 `"kind": "twist"`：让学习者自己应对这个转折（换个说法拒绝、提出替代方案、道歉补救）。 |
| 场景 | 同一主题，但换成和早课不同的小场景（`themes.json` 的 `scenes`）；`LESSON-QUALITY.md` 7c 晚课换场景照样适用。 |
| 自然复现 | 至少 `recurrence_min`（默认 8）个名单词。 |
| `phase` 根字段 | 同早课。 |

`daily_test` 结构不变（3 选择 + 2 填空 + 1 排序），周日见第四节。

## 四、主题周

- 主题表：`data/themes.json`，7 个主题按顺序每周一个，从 `theme_start_date`（周一）开始轮换。
- 一周分工（`day_role`）：周一到周三 `core` 核心场景；周四、周五 `variation` 同主题换情况；周六 `transfer` 把本周说法搬到别的场景；周日 `weekly_test`。
- **本周交流动作（2026-10-31 用户决定）**：每个主题配 2–3 个交流动作（如网店客服周：说明问题、解释原因、提出办法），每个动作有 2–3 个固定句型，见 `themes.json` 的 `functions`，`review-phase.js` 输出的 `plan.functions` 就是本周的。**每节课 `lesson_focus.patterns` 的 2 个句型里，至少 1 个必须逐字是本周的某个句型**，并加 `"function": "<动作 id>"`；它的 `example` 要真的用上这个句型（固定部分按顺序出现），照常从本课原文逐字摘。另一个句型照旧自由选。这样同几个句型一周里在不同情况下反复出现。句型不占复习词名额；为套句型写出别扭的句子就换本周另一个句型，不硬写。
- 周日晚课 = 本周小测 + 开口挑战：
  - `daily_test` 另加 `week_words`，列出 6–12 个本周（周一起）课程里教过或复习过的词，每个词都要在某道题里真的考到。题型结构不变。
  - `rewrite` 里恰好 1 个 `"kind": "challenge"`，带 `"functions": [...]`（本周 2 个以上动作 id）。任务写成一个真实情况 + 三步：① 说明问题 ② 解释理由 ③ 提出解决办法（按本周动作调整），提示学习者不看参考、每一步尽量 3 秒内开口（网站不计时，靠自己掐）；参考答案用上本周句型。它算在 rewrite 的 3–4 个里。
- 主题只决定场景，不决定选哪些词：核心复习词仍由排序脚本按轮换、冷却和错词规则选；主题词靠阅读、对话和例句自然复现。学过的词不会因为换周而退出复习。

## 五、选词

照原说明书运行 `rank-review-candidates.js`。开关打开后它的输出会带 `review_phase`，并且已经：

- 用 `data/vocab-goals.json`（启用时由用户确认的词汇目标）把目标是“会认”的词移出核心词卡和复习名额（它们仍可以出现在阅读、对话里）；
- 给“要快”的词加分；真实新错照旧优先；
- 把自然复现最低数改成 `recurrence_min`。

不得手工挑出排序结果以外的核心复习词。

## 六、不变的部分

确认掌握的定义、弱词池、快速/听词/自动三个训练、跨设备同步、深讲（仍是 3 词 + 2 句型，`DEEP-TEACH.md`）、发布流程、质量规则（`LESSON-QUALITY.md`）、系统用语禁令都不变。复习阶段不重置、不覆盖任何学习记录。

## 七、启用步骤（用户通知“学完了、可以换”之后，由 Claude 执行）

1. 先把观察期结果和启用日期发给用户确认；启用日期取下一个周一（或用户指定的周一）。
2. 用户决定待确认的词汇目标后，从 `data/vocab-goals-suggested.json` 生成 `data/vocab-goals.json`：每个词 `{goal, fast}`，`observation_only` 不写或为 `false`，另记 `confirmed_at`。
3. 改 `data/review-phase.json`：`active: true`，`activated_at` 和 `theme_start_date` 都写启用的那个周一。
4. 跑全部测试和 `regression-guard.js`，确认 `review-phase.js --date 启用日 --session am` 输出 `active: true` 和正确的主题。
5. 开 PR 合并；避开 06:40–08:30 和 17:20–18:30。
6. 告诉用户从哪天哪节课开始变化。

## 八、停用 / 回退

把 `data/review-phase.json` 的 `active` 改回 `false` 即可：下一节课起完全回到原规则（新词不足时按 10-14 的复习循环）。不删除、不改动任何学习记录；`data/vocab-goals.json` 可以留着，关闭期间没有程序读取它。
