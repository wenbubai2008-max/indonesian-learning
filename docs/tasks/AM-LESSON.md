# 08:00 早课任务说明书

先读 `docs/tasks/COMMON.md`（仓库访问、写入边界、失败处理、V4 停用、汇报诚实等共用规则），再按本文件执行。

用户在学印尼语（A2+ → B1，约 30 分钟一节，目标是实用的日常印尼语，中文是工作语言）。本任务的工作不是随手写一篇课文，而是：按用户真实的词汇状态选出合格词汇 → 做出完整课程 JSON → 交给仓库现有的校验与发布流程 → 核实词库同步和网页部署。首要目标是每天真正完成一节合格、能在网站上学习的 08:00 早课。

本任务约 07:24 开始；分支 `lesson-release-D-am`，课程文件 `data/daily/D-am.json`。18:00 晚课和 12:00 泛读由另外两个任务负责，本任务不碰它们。

## 一、必读资料

规则：`AGENTS.md`、`docs/REGRESSION-GUARD.md`、`data/learning-pool-rules.json`、`docs/LESSON-RECOVERY.md`、`docs/LESSON-JSON-SCHEMA.md`（含末尾 “Review cycle” 一节）、**`docs/LESSON-QUALITY.md`（教学审稿清单，必须逐条执行）**、`.github/scripts/validate-lesson-candidate.js`、`.github/scripts/plan-lesson-publication.js`。

数据：`data/learning-runtime.json`（词汇资格与复习候选，唯一资格来源）、`data/lesson-context.json`、`data/daily/index.json`、前一天的 PM 课程、最近 7 天已完成的课程、最近一节成功发布的 AM 课程（只参考 JSON 结构，不复制单词、例句和答案）。不需要读完整的 977 词库、`daily-vocab-data.js` 或 `weakness-sync.json`，也不要自行重算词池。

## 二、先恢复，后生成

先查远端真实状态：main 上是否已有当天 AM 课程、index 是否已标 am=true、当天分支是否存在且有课程文件、是否已有同日 PR、是否有正在运行或刚失败的 lesson_release。

- **已正式发布**：不重新生成，只核验 Sync、runtime、lesson-context 和 Pages。
- **PR 已存在**：不重建、不开第二个 PR；核对 PR 状态、head SHA 和 Runner 日志，从断点继续。
- **分支有完整课程但没有 PR**：保留原课程，核对资格和结构后为同一分支开 PR。
- **只有分支、没有课程文件**：确认相对 main 的 ahead_by=0、无 index 改动、无同日 PR，才可当空分支复用；否则停止并保留证据。
- **什么都没有**：才进入生成。

## 三、数据基线

固定本次使用的 main SHA，runtime、lesson-context、index、rules 尽量从同一个 SHA 读取。确认：`rules.version` 与 `runtime.version`、`runtime.rules_version` 一致（目前都是 4，以回归守卫为准）；`runtime.stats.master_unique=977`；`runtime.lesson_watermark` 等于 index 最后完成的课程（正常应是昨天 18:00）；`lesson-context.target` 为今天、am、08:00；`lesson-context.source` 里的 runtime/index/rules 版本与哈希和读取的数据一致。

runtime 尚未同步时，不得用过期词池生成新课；先确认现有 Sync 是失败了还是还没结束。

## 四、先选词，再写课程（强制顺序）

严禁先想主题、写阅读，再凭感觉挑词。

先运行排序脚本：

`node .github/scripts/rank-review-candidates.js --date D --session am`

查看输出里的 `review_cycle`。`review_cycle.active=false` 时按 4.1–4.4 的正常规则选词；`review_cycle.active=true` 时（合法新词不足 10 个）按 4.5 的复习循环规则选词。

### 4.1 新词：恰好 10 个（复习循环时见 4.5）

每个新词必须同时：属于 runtime.new_pool；属于 new_pool_dont 或 new_pool_fuzzy；不属于 new_pool_unclassified；不是 mastered；不是昨晚 PM 的新词。

**dont-first**：排除昨晚新词后，合法 dont 有 10 个或更多，就 10 个全部来自 dont；只有合法 dont 不足 10 个时，才用 fuzzy 补足余量（例如剩 8 个 dont，就是 8 dont + 2 fuzzy，不能 5+5）。不能为了主题好看用 fuzzy 替换合法 dont。

**977 主库优先**：runtime.new_pool_dont 里 977 主库词排在前面，第二库补给词排在后面。主库合法 dont 够 10 个时，10 个都用主库词；只有主库不够时才用第二库词补。判断方法：出现在 `data/master-vocab-secondary.js` 里的就是第二库词。（真实案例：2026-10-08 早课的 tepat 是第二库词，当时主库还剩 30 个可用词。）

### 4.2 口语新词

- 按 Validator 的 `ORAL_COUNT` / `ORAL_DONT_PRIORITY` 执行：在 dont-first 配额内有 2 个可行的合法口语候选时用 2 个，先用 oral_new_pool_dont；只有 dont 不足 10、需要 fuzzy 补位时才可用 oral_new_pool_fuzzy。合法候选不足 2 个就按实际数量，没有就是 0 个，不凑数（`docs/LESSON-QUALITY.md` §7b：口语改为随词学，不追求口语新词数量）。同一标准语↔口语组不占两个新词名额。
- `is_oral_new=true` 的词必须真实存在于 runtime.oral_new_pool，不能凭感觉标记。
- 词条可能是字符串、数组或对象。按 Validator 的 word 归一化识别：字符串取本身，数组取第一个元素，对象取 word 字段，再 trim、lowercase 并做标点归一化。口语形、标准形和派生词不能随意当成同一个词条。

### 4.3 复习词：4–6 个（根字段 `review_vocab`，字符串数组）

资格：每个词必须属于 runtime.review_pool，不与 10 张词卡的词重叠。focus_pool 是高优先候选，不是独立资格来源。

以排序脚本输出的 recommended_review 为起点锁定复习词。

- **同词根成组（2026-10-15 用户决定）**：review_vocab 里放 1 组 2–3 个同词根的词（例如 mengeluh / ngeluh / keluhan）。排序输出 `review_groups` 列出当节可用的组，`recommended_review` 已尽量放进最优的一组（`review_group_applied`）；真实新错仍优先，不因成组被挤掉。有可用组却不用，复现检查会不通过。没有可用同词根组时，可选 1 对反义词，或 1 对近义词（近义词要在小测或复盘里讲清区别）。成组的词在阅读、句子和题目里尽量放在同一场景，让学习者看出词缀变化。

若要偏离推荐，写明理由，并确认仍满足下面的规则。脚本无法运行时按文字规则人工执行，并在报告中说明。

曝光账本（`review_rotation.exposure_ledger`，2026-10-08 起生效；详见 `docs/REGRESSION-GUARD.md` §13）：

- **主动曝光** = AM 的 review_vocab、AM 的 cycle_vocab（复习循环词）、PM 中 source_group=review 和 source_group=application 的词。application 是完整词卡，要主动使用，和重点复习一样算一次。AM 新词不算复习曝光。
- 阅读、对话、例句里的出现不算复习，只用于“连续出现”判断。排序脚本还会把 12:00 泛读计入这项判断。
- 最近 2 节已完成课程（昨晚 PM、昨天 AM）里有主动曝光的词，今天不进 review_vocab。
- 前 2 天每天都以任何形式出现过、且其中至少一次是主动曝光的词，今天不进 review_vocab（避免连续第 3 天出现）。
- 真实新错可以解除冷却：last_wrong 晚于该词最近一次主动曝光（含 application），且不晚于 runtime.generated_at。7 天内没有主动曝光、但 7 天内答错过的词也算新错。旧的答错记录不能解除冷却；不得伪造历史、答错时间或掌握状态。
- 错词配额：新错最多 2 个（复习 6 个时最多 3 个），其余名额给到期最久、最近曝光最少的词。没排上的新错下一节优先。
- 同等条件下的优先顺序：最近真实答错或重新标为不会 > memory_dont > memory_fuzzy > 其他 active；再优先核心曝光少、到期久、更值得主动输出训练的词。
- 排序输出 `hard=true` 的词（累计答错 ≥3 次）：在 quiz 或 output 里换一种用法考它，并在复盘里补一句辨析或典型搭配。
- `avoid_in_text` 里的词正在冷却：除非是本课核心词，否则不写进阅读和例句。`natural_recurrence` 是久未出现的待复习词（最久没出现的在前，共约 30 个）：**至少 10 个**要自然出现在课文里（可带 -nya 等后缀）。新增的优先放在**词卡例句、5 个 sentences、output 参考答案**里，约每两句例句带 1 个；阅读已接近合适密度，不再刻意加密；只出现在小测选项里不算。排在前面的优先；某个词写不自然就跳过换下一个，不为凑数写别扭的句子。`overused_in_text` 里的词最近几节课已经出现很多次，不要为了复现刻意写进去。（2026-10-15：旧下限 2 个基本没执行，15 节课里 6 节一个没带；同日先提到 5 个，再按用户决定提到 10 个。）

### 4.4 资格预检（写正文前，不得跳过）

列一张内部选词表（单词｜分组 new-dont/new-fuzzy/cycle/review｜是否在合法池｜口语资格｜历史与冷却｜PASS/FAIL），逐项确认：新词全部合法；严格执行 dont-first；不与昨晚 PM 新词重复；口语标记真实；4–6 个复习词全部在 review_pool；词卡词与复习词不重复；冷却与 7 天规则满足；没有 mastered 或 unclassified。全部 PASS 才能锁定词表。

### 4.5 复习循环（2026-10-14 用户决定；排序输出 review_cycle.active=true 时适用）

新词学完后进入复习循环：早课把新词名额换成复习词，一个词“确认掌握”后自动退出循环。结构细节见 `docs/LESSON-JSON-SCHEMA.md` 的 “Review cycle” 一节。

- 10 张词卡 = **全部**剩余合法新词（排序输出 `review_cycle.new_words_available` 个，可能是 0）+ `review_cycle.cycle_words` 里的循环词（共 10 张）。循环词一半是最弱的词（`weak`），一半是最久没在课程里出现的词（`stale`），不足互补；以脚本输出为起点，偏离要写理由。
- 课程根字段新增 `cycle_vocab`：字符串数组，恰好列出词卡里不是新词的那些词。循环词必须在 runtime.review_pool，`is_oral_new=false`，不得与 review_vocab 重复。
- 剩余新词仍按 4.1/4.2 的规则写（口语标记真实）。review_vocab 照常 4–6 个，sentences、reading、quiz、output、review 的结构和数量都不变。
- 循环词的词卡同样要有完整的构词、搭配、例句和辨析，但写法按“复习”来：先让学习者回忆，再给新的语境和新的搭配，不要照抄该词以前课程里的例句。阅读和输出任务要让循环词在新场景里主动使用。
- 新词充足时（review_cycle.active=false）不得出现 cycle_vocab。
- Validator 错误码：CYCLE_NOT_ACTIVE、CYCLE_NEW_REQUIRED、CYCLE_VOCAB_MISMATCH、CYCLE_WORD_INELIGIBLE、CYCLE_ORAL_FLAG。

## 五、课程 JSON 规范

完整 JSON 文件，结构与以往成功发布的 AM 课程一致；逐字段的键名表见 `docs/LESSON-JSON-SCHEMA.md` 的 AM 一节。要点：

- **根字段**：date、session="am"、time="08:00"、day（按正式 index 确认，不是运行天数）、title（以 "08:00" 开头；标题双语（2026-10-17 用户要求）：`时间 早课/晚课｜印尼语标题 · 中文标题`，两种语言说同一件事，例如 `08:00 早课｜Main ke Rumah Baru Tante Lia · 去莉亚阿姨的新家做客`）、vocab、review_vocab、sentences、reading、quiz、output、review；复习循环时另加 cycle_vocab。可保留 Schema 允许的其他元数据，不得混入 PM 结构。
- **vocab**：恰好 10 张。每张有 word、display、audio_text（通常同 word，非空）、cn、en、root、root_cn（root 非空时必填）、formation（优先写构词关系、真实搭配和使用场景，不写空洞语法描述）、example、example_cn、synonym_note（实用辨析）、is_oral_new（布尔值）。
- **sentences**：恰好 5 句 `{"text","cn"}`，尽量复现当天核心词，围绕真实情境（日常沟通、购物交通、办公室、朋友、家庭等），不要 5 句互不相关的字典例句。至少 1 句是自然口语（`docs/LESSON-QUALITY.md` §7b）。
- **reading**：`{"text","cn"}`，印尼语 80–120 词（按空白分词实际统计，建议 90–105），有明确场景和连贯性，自然复现核心词和若干复习词，中文完整对应。
- **quiz**：恰好 3 题，每题 question、options（建议 4 个）、answer_index（从 0 开始）、answer（必须等于 options[answer_index]）、explain。至少一题的正确答案是真实的 review_vocab 词（题干写“复习”两字不算）；题干不得泄露答案；不得照搬 PM 的 prompt/fill/order 结构。
- **output**：task、reference_answer、reference_cn，用至少 2 个本课重点词的真实交流任务。
- **review**：恰好 3 个非空字符串（3 秒主动提取、易混词或搭配、重点复习词的实际应用），不是晚课的 `{title, steps}`。
- **lesson_focus**（今天的重点，2026-10-18 用户决定；**2026-10-18 晚课起每节必填**）：**不新增任何词或任务**，只是从本课已有内容里标出最值得掌握的部分（不是多学五项）。格式 `{"words":[3 个词],"patterns":[2 个 {pattern, cn, example, example_cn}]}`：
  - words：恰好 3 个，必须是本课的词（vocab / review_vocab / cycle_vocab），优先选实用、容易忘、值得主动说出口的词。
  - patterns：恰好 2 个句型。pattern 用 `…` 标出可替换的部分（如 `Waktu masih …, …`），cn 是句型的中文意思；example 必须**逐字取自本课**（sentences、reading、词卡例句或 output 参考答案），example_cn 是它的中文。
  - 校验器检查：`LESSON_FOCUS_MISSING`（缺字段）、`LESSON_FOCUS_INVALID`（数量或字段不对）、`LESSON_FOCUS_WORD`（词不是本课的）、`LESSON_FOCUS_PATTERN`（例句不在本课里）。按报错改正，不得为此改动选词、题目或其他内容。
- **review_cards**（2026-10-16 用户决定；可选但每节都要写）：上面 3 段复习的结构化版本，网页据此显示可点开的提取卡片、对比块和例句。**内容与 review 三段一致，不新增词、不加量**；review 三段照常写。格式：
  - `recall`：4–12 个 `{cn, id}`——cn 是中文提示，id 是印尼语答案，**必须是本课 vocab / review_vocab / cycle_vocab 里的词**（校验器检查）。
  - `frames`（可选）：最多 6 个补半句的印尼语字符串，例如 `"Masukin …, mau hujan!"`。
  - `contrasts`：1–6 组 `{items:[{id, cn}] 2–3 个, note: 一句话区别}`，同词根一组也写在这里。
  - `apply`：1–4 个 `{word, usage: 一句话用法, examples:[{id, cn}] 1–3 句}`。
  - 预检报 `AM_REVIEW_CARDS_INVALID` / `AM_REVIEW_CARDS_ANSWER` 时，按报错改一次；仍不通过就**删掉整个 review_cards**（课程照样有效，网页退回显示 3 段文字），不得为此改动 review 或其他内容。

## 六、教学质量

严格执行 `docs/LESSON-QUALITY.md` 的全部内容：固定执行顺序（含搭配黑名单检查 `node .github/scripts/check-collocations.js --candidate data/daily/D-am.json`）、母语化审稿、词卡与构词准确性、全课事实一致性与因果、阅读、题目设计、主动输出、记忆强化、口语随词学（§7b），以及汇报里的两行。早课补充：

- 优先使用印尼人实际常用的表达、自然语序和高频搭配，不写成新闻稿、词典释义或过于书面的教材语言；但不能为了口语化改动词汇资格或 is_oral_new。
- 10 个核心词可以来自不同语义领域。能自然组合就组合；实在串不起来就分组教学，不硬编不通顺的故事。
- 不得出现：字段缺失、假口语词、已教词冒充新词（复习循环词必须列在 cycle_vocab）、mastered 进入复习、词汇过度重复、印中不一致、例句不通、阅读不足 80 词、答案与 answer_index 不一致、参考答案与任务无关。

## 七、写入前校验

写正文前已做资格预检（4.4）。完整 JSON 生成并完成第二遍教学审稿后，再核对：根字段齐全；vocab 恰好 10 张且字段完整；review_vocab 为 4–6 个合法词；复习循环时 cycle_vocab 正确；sentences 恰好 5 句；reading 80–120 词且有中文；quiz 3 题且答案对应，至少一题答案是 review_vocab 词；output 三字段完整；review 恰好 3 条；review_cards 与 review 内容一致、recall 答案都是本课的词；日期、day、时段和 runtime/index 基线一致。

然后在本地真实运行，全部通过才可写入：

1. 内容守卫：把全部印尼语文本（阅读、句子、例句、选项、参考答案）分词，与 runtime.new_pool 比对；出现不属于今天新词的未教词，就换成已学词或基础词。
2. 复现检查：`node .github/scripts/check-recurrence.js --candidate data/daily/D-am.json --date D --session am`（输出 RECURRENCE_CHECK，ok=true，即 natural_recurrence 名单里至少 10 个词出现在课文里，且有可用同词根组时 review_vocab 里用了其中一组）。不够就按 suggestions 优先在例句、sentences、output 参考答案里自然补上再查；必须在推送前通过。
3. `node .github/scripts/validate-lesson-candidate.js --candidate data/daily/D-am.json --date D --session am`（ok=true）
4. `node .github/scripts/plan-lesson-publication.js --candidate data/daily/D-am.json --date D --session am --main-head "$(git rev-parse HEAD)"`（ok=true，status=ready）
5. `node .github/scripts/regression-guard.js`

发现错误，先改同一份尚未提交的原稿再重跑；不降低标准，不借修结构之名更换已锁定的合法核心词。

## 八、发布（唯一流程）

1. 从最新 origin/main 在本地建分支 `lesson-release-D-am`，只提交 `data/daily/D-am.json` 这一个文件，**一次性** push（不要先推空分支，不要 force push）。推送后回读远端文件，确认内容完整、可解析、日期/session/time/词数正确，并记下 commit SHA。
2. 用 REST 开 PR：base=main，head=该分支，正文单独一行 `AUTO_PUBLISH_LESSON=1`。同一分支已有 PR 就复用，不开第二个。
3. 不要自己合并，也不要写 index。仓库 `sync-daily-vocab.yml` 的 lesson_release job 会验证作者、分支名和标记，基于最新 main 用权威 planner 校验，生成 index，执行 RELEASE_PREFLIGHT，按最终 head SHA squash merge，再触发 Sync（更新 daily-vocab、runtime、lesson-context）和 Pages 部署。
4. 核对的必须是最新 head SHA 的运行结果：RELEASE_PREFLIGHT `{"ok":true,"status":"ready"}` 和 LESSON_RELEASE_PUBLISHED。PR 页面出现绿勾不等于课程已发布。release PR 上偶尔会多出 0 个 job 的失败运行，那是 bot push 派生的无害噪声（`docs/REGRESSION-GUARD.md` “课程 release 的 main 前进与 bot 批准运行”），不要据此判断失败。

## 九、失败与恢复

共用原则见 `docs/tasks/COMMON.md` §5，完整协议见 `docs/LESSON-RECOVERY.md`。早课补充：

- **资格或结构错误**（如 NEW_WORD_INELIGIBLE、ORAL_INELIGIBLE、REVIEW_INELIGIBLE、READING_INVALID、AM_CORE_COUNT、AM_QUIZ_COUNT、ANSWER_MISMATCH、CYCLE_*）：还没写入远端就改稿重验；已进入 PR 的，只按恢复协议在同一分支做有记录的修正，不改已确定的词汇资格和课程语义。
- **PR 或 Runner 失败**：不关闭原 PR、不开第二个；查原文件、当前 head SHA、Runner 原始日志，以及 main 是否已由合法流程完成。只是同步没完成，就恢复同步，不重做课程。
- **main 在发布中前进**：不强推。读取最新 main：课程已发布就转入验收；未发布就核对原候选在新基线下是否仍合法，复用原分支和 PR。
- **已合并但网页没更新**：只检查并修复真正失败的环节（Sync、runtime、lesson-context、Pages），不生成第二份课程。

## 十、验收（轮询不超过约 40 分钟，超时如实报告当前 checkpoint）

全部确认才可报告 VERIFIED_COMPLETE：main 上有当天 AM JSON；index 当天 am=true；PR merged=true；RELEASE_PREFLIGHT ok；出现 LESSON_RELEASE_PUBLISHED；随后的 Sync 成功；runtime.lesson_watermark = "D 08:00"；本节新词（复习循环时只看新词部分）已全部退出 new_pool；lesson-context.target 为当天 18:00 pm；Pages 部署 success。

Actions 日志可能因网络限制无法下载。此时以 PR merged=true、main 上的课程与 index、Sync 成功、watermark、lesson-context、Pages 成功作为间接依据，并说明哪些是直接核验、哪些是间接核验。

## 十一、汇报（简洁中文）

成功时报告：课程标题；新词（dont/fuzzy 与口语标记）；是否处于复习循环，若是则列出 cycle_vocab（哪些是 weak、哪些是 stale）和剩余新词数；复习词及选择理由（排序脚本是否运行、是否偏离推荐及原因、有无新错被顺延）；复现检查结果（带入了哪些 natural_recurrence 词、几个/要求几个，用了哪些 overused_in_text 词，复习词里用了哪一组同词根词或反义/近义词）；搭配黑名单检查结果；PR 编号；是否已正式发布；runtime 是否同步；Pages 是否成功；按 `docs/LESSON-QUALITY.md` 第 8 节写“全课跨句逻辑检查”和“第二遍教学审稿”两行。

失败时按 `docs/tasks/COMMON.md` §5 的要求说明。
