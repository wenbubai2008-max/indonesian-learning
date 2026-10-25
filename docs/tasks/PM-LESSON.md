# 18:00 晚课任务说明书

先读 `docs/tasks/COMMON.md`（仓库访问、写入边界、失败处理、V4 停用、汇报诚实等共用规则），再按本文件执行。本文件第 1–9 节是用户给出的晚课正式要求，全部必须遵守。

本任务每天 17:30（Asia/Jakarta）开始运行，目标是让 18:00 的正式晚课尽量提前准备好。17:30 是开始生成和发布的时间，不是课程页面显示时间，课程标注时间始终是 18:00。分支 `lesson-release-D-pm`，文件 `data/daily/D-pm.json`。早课（约 07:24 开始）和 12:00 泛读另有任务，本任务都不要碰。

PM 专用的运行要求：

- 写入前必须在本地真实运行并通过：
  1. `node .github/scripts/validate-lesson-candidate.js --candidate data/daily/D-pm.json --date D --session pm`（ok=true）
  2. `node .github/scripts/plan-lesson-publication.js --candidate data/daily/D-pm.json --date D --session pm --main-head "$(git rev-parse HEAD)"`（ok=true，status=ready）
  3. `node .github/scripts/regression-guard.js`
  4. 复现检查：`node .github/scripts/check-recurrence.js --candidate data/daily/D-pm.json --date D --session pm`（输出 RECURRENCE_CHECK，ok=true，即 natural_recurrence 名单里至少 15 个词出现在课文里，且有可用同词根组时重点复习里用了其中一组）。不够就按 suggestions 优先在例句、rewrite 参考答案里自然补上再查；必须在推送前通过。
- 内容守卫：课程中所有印尼语文本（阅读、对话、例句、选项、参考答案）不得出现 runtime.new_pool 中、但不属于今晚核心词的未教词。用脚本把文本分词后与 new_pool 比对，发现就换成已学或基础词。
- 推送后用 REST 开 PR（base=main，head=分支，正文单独一行 `AUTO_PUBLISH_LESSON=1`），不要自己合并，不要写 index.json。
- 发布后核验：轮询 PR 对应的 `Sync daily vocab` lesson_release 运行，确认 RELEASE_PREFLIGHT 成功和 LESSON_RELEASE_PUBLISHED。Actions 日志下载可能因网络限制失败，此时以 PR merged=true、main 上存在 D-pm.json、index.json 中 D 的 pm=true、随后 main 上 Sync 运行成功、runtime.lesson_watermark="D 18:00"、lesson-context.target 指向次日 08:00、Pages 部署成功作为依据，并在汇报中说明哪些是直接核验、哪些是间接核验。轮询总时长不超过约 40 分钟；超时则如实报告当前 checkpoint。release PR 上偶尔会多出 0 个 job 的失败运行，那是 bot push 派生的无害噪声，不要据此判断失败。
- 如果课程已生成但发布没有成功，用 SendUserFile 把同一份完整课程 JSON 发给用户，让用户当天仍能学习，并明确说明网站发布未完成。不要生成第二份不同的课程。

## 1. 课程的根本目标

这是一套连续运行的个人印尼语学习系统，学习方向为 A2+ 至 B1，以印尼当地日常口语和真实生活应用为主。

早课和晚课承担不同任务：

- 早上 08:00：以真正陌生词的首次学习为主，固定 10 个新词，配合复习、例句、阅读和主动输出。（新词学完后进入复习循环，见第 3 节 E。）
- 晚上 18:00：不重复制作一节早课，而是利用当天已经正式学过的内容、近期尚未掌握的弱词和训练反馈，进行巩固、辨析、实际表达与延迟复现。

晚课应帮助学习者完成三个转变：

- 从看着眼熟，到不看答案能够回忆。
- 从知道中文意思，到能够放进真实印尼语句子。
- 从今天认识，到间隔一段时间后依然能够主动使用。

不能把重复展示单词误认为真正掌握。

## 2. 每次开始时必须读取的权威资料

首先读取仓库 main 分支的最新状态，并固定当前 main SHA。

必须遵守：`AGENTS.md`、`docs/REGRESSION-GUARD.md`、`docs/LESSON-RECOVERY.md`、`docs/LESSON-JSON-SCHEMA.md`（含末尾 “Review cycle” 一节）、`docs/LESSON-QUALITY.md`（教学审稿清单）、`data/learning-pool-rules.json`、`.github/scripts/validate-lesson-candidate.js`、`.github/scripts/plan-lesson-publication.js`。

并读取：`data/daily/index.json`、`data/learning-runtime.json`、`data/lesson-context.json`、`data/daily/YYYY-MM-DD-am.json`（当天正式早课）、前一天正式 PM 课程、最近 7 天已经完成的 AM/PM 核心复习记录、最近一节正式 PM 课程（作为 JSON 结构参考，只参考结构，不复制其单词、例句和答案）。

**复习阶段开关（2026-10-25 起放入，默认关闭）**：读完上面的资料后运行 `node .github/scripts/review-phase.js --date D --session pm`。输出 `active=false`（现在的状态）时照本说明书执行，不读 `docs/tasks/REVIEW-PHASE.md`；只有输出 `active=true` 时，才按 `docs/tasks/REVIEW-PHASE.md` 覆盖本说明书的词卡数量、课程结构和复现最低数，其余照旧。

日期 YYYY-MM-DD 按 Asia/Jakarta 当日自动确定，不得写死。

必须确认：

- 当天正式 AM 已发布，index.am=true。
- 当天 PM 尚未正式发布。
- runtime.lesson_watermark 已更新到当天 08:00。
- lesson-context.target 准确指向当天 pm、18:00 及对应 Day。
- context 中的 runtime/index/rules 来源版本和哈希与当前数据一致。
- runtime 版本和 rules 版本符合仓库要求，主词库仍为 977。
- 若已有当天 PM 草稿、发布分支或 PR，应优先恢复原稿，不重新生成第二节课程。

如果 AM 未完成、同步未完成或 context 已经过期，先检查现有 Sync 是否仍在运行。不得拿昨天的词池凑出今天的课程。

## 3. 晚课选词规则

每晚默认 10 个核心词；有明显的弱词强化压力时可以增加到 11–12 个。

锁定词表前必须先运行排序脚本：

`node .github/scripts/rank-review-candidates.js --date YYYY-MM-DD --session pm`

查看输出里的 review_cycle：active=false 时按下面 A–D 的正常规则；active=true 时（当晚合法新词不足 3 个）按 E 的复习循环规则。

三组词必须完全去重：

**A. 新词：3–4 个**

必须同时属于 runtime.new_pool 以及 new_pool_dont 或 new_pool_fuzzy 之一。默认优先组合：2 个 fuzzy + 1–2 个 dont。原因是早课主要负责真正陌生词，晚课更侧重把半熟词训练成能够主动调用的词。不得选用 unclassified、mastered，或当天 08:00 已经正式学过的词充当 PM 新词。

口语新词按 Validator 的 `PM_ORAL_COUNT` 执行：当晚有合法口语新词候选时至少用 1 个（最多 2 个，结合当天 08:00 已用的口语新词数；3–4 个新词不要全部是口语词，以免口语候选过快耗尽）；没有就是 0 个，不凑数（`docs/LESSON-QUALITY.md` §7b）。is_oral_new 必须以 runtime.oral_new_pool 为准，绝不能凭个人感觉标记（读取时按 Validator 的 word 归一化：字符串直接取词，数组取第一个元素，对象取 word 字段，再 trim/lowercase）。

**B. 重点复习：4–6 个**

每个词都必须属于当前 runtime.review_pool。优先从合法的 focus_pool 选择 2–3 个，再由低曝光、复习到期、确实不稳定的词补足。

优先级参考：真实的新答错或重新标记不会；memory_dont；memory_fuzzy；其他仍处于 active 状态的已教词。同等条件下优先复习到期更久、最近核心曝光更少的词。口语高频价值只作为最后的平局排序条件，不得越过资格与冷却规则。

以排序输出的 recommended_review 为起点锁定重点复习词（含同词根组，见下），以 application_candidates 为起点选应用词；如要偏离推荐，必须写明理由，并确认仍满足下面的规则。脚本无法运行时，按下面的文字规则人工执行，并在报告中说明。


- **同词根成组（2026-10-15 用户决定）**：重点复习（source_group=review）里放 1 组 2–3 个同词根的词（例如 mengeluh / ngeluh / keluhan）。排序输出 `review_groups` 列出当节可用的组，`recommended_review` 已尽量放进最优的一组（`review_group_applied`）；真实新错和 focus 2–3 个的配额仍优先。有可用组却不用，复现检查会不通过。没有可用同词根组时，可选 1 对反义词，或 1 对近义词（近义词必须配一道辨析题，写清区别）。成组的词在词卡 formation / synonym_note 里互相指明构词关系。

曝光账本（2026-10-08 起生效，仓库 `review_rotation.exposure_ledger`，详见 `docs/REGRESSION-GUARD.md` §13）：

- 主动曝光 = AM.review_vocab、AM.cycle_vocab（复习循环词）、PM 中 source_group=review、PM 中 source_group=application。application 和重点复习一样算一次曝光；当天 AM 新词 vocab 不算（它们本来就该进今晚 application）。
- 最近 2 节已完成课程（今天 AM、昨晚 PM）里有主动曝光的词，今晚不再占 review 或 application 核心名额。
- 前 2 天每天都以任何形式出现过（核心词表、阅读、对话、句子、例句），且其中至少一次是主动曝光的词，今晚不占核心名额（避免连续第 3 天出现）。排序脚本还会把 12:00 泛读计入这项判断。
- 原有规则保留：今天 AM.review_vocab 和 AM.cycle_vocab 不作 PM review；连续两次 PM 主动出现后冷却 3 天；最近 7 天主动曝光 ≥3 次的词，在合法替代充足时每晚最多 1 个。
- 真实新错可以解除上述冷却：last_wrong 晚于该词最近一次主动曝光（含 application），且已进入本次 runtime 快照。7 天内没有主动曝光、但 7 天内答错过的词也算新错。旧的答错记录不能解除冷却。
- 错词配额：新错每晚最多 2 个（复习 6 个时最多 3 个），其余名额给到期最久、最近曝光最少的词；没排上的新错列在 fresh_errors_deferred，下一节优先。
- 排序输出 hard=true 的词（累计答错 ≥3 次）：不要只重复词卡，换题型（造句、中译印、辨析题），并在 synonym_note 或 usage_note 里补一句近义辨析或典型搭配。
- 阅读、对话、例句里的出现不推进复习，只用于上面的冷却判断。

**C. 应用复现：2–3 个**

优先考虑当天 08:00 真正学过、但目前仍需强化的词（2026-10-08 起 runtime 会把当天早课新词放进 review_pool，排序输出的 application_candidates 里 from_today_am_vocab=true 的就是它们，优先选 2 个）。它们必须仍属于 runtime.review_pool。上午新学的词可以进入晚课 application，但不能因为它上午出现过，就忽视它是否仍具备当前应用资格。上午 review_vocab 或 cycle_vocab 中的老词，也只有仍符合应用资格时才能进入 application，不得再次冒充 PM 的新词或重点 review。

如果 application 来自当天上午，必须在 formation 或 usage_note 中根据真实来源注明：

- 上午新词：今天08:00新学。
- 上午老复习词（含 cycle_vocab 复习循环词）：今天08:00复习过的老词。

不得将历史课程中的词伪标为今天早课内容。应用词同样遵守曝光账本：昨晚已经是 review 或 application 的老词，今晚不再做 application（真实新错除外）；当天 08:00 新词不受此限。

**D. 课文用词（阅读、对话、例句、rewrite）**

- 排序输出 avoid_in_text 里的词正在冷却：除非它是本课核心词，否则不写进阅读、对话和例句。
- 排序输出 natural_recurrence 是久未出现的待复习词（最久没出现的在前，共约 30 个；当天 08:00 课文里用过的词已经排到后面）：**至少 15 个**要自然出现在课文里（可带 -nya 等后缀）。新增的优先放在**词卡例句和 rewrite 参考答案**里，约每两句例句带 1 个；阅读和对话已接近合适密度，不再刻意加密；只出现在 6 道题里不算。排在前面的优先；某个词写不自然就跳过换下一个。它们不算核心复习，不占任何名额。`overused_in_text` 里的词最近几节课已经出现很多次，不要为了复现刻意写进去。（2026-10-15：旧下限 3 个基本没执行，15 节课里 6 节一个没带；同日先提到 8 个，再按用户决定提到 15 个。）
- 本课的新词和复习词鼓励在阅读、对话、例句中多次出现，同一节课内不额外计入跨课重复。

**E. 复习循环（2026-10-14 用户决定；排序输出 review_cycle.active=true 时适用）**

新词学完后，晚课结构不变，只是没有新词：

- new 组 = 当晚**全部**剩余合法新词（review_cycle.new_words_available 个，0–2 个），new_words 照常列出它们。
- review 组 4–9 个（以 review_cycle.review_target 和 recommended_review 为起点），application 2–3 个，总数仍为 10–12 张。focus 词 2–3 个、冷却和曝光账本规则照常。
- 当天早课若有 cycle_vocab，这些是“今天08:00复习过的老词”，不是新词。
- 一个词“确认掌握”后自动退出循环（不再出现在 review_pool），不需要手动处理。

三组词彼此不得重复，任何 mastered 词都不能占用核心名额。

## 4. 与其他三个训练模块的联动

晚课必须理解以下数据来源，但不能直接篡改这些模块的计划或训练记录。

- 快速练习：主要验证视觉识别与到期词，单轮最多 10 题。答错记录 quick_wrong；连续答对只是识别能力证据，不得直接等于 mastered。
- 自动训练：每天最多 8 个词，重点包括快速主动提取、语境补词、主动表达和延迟验证。真实失败会产生 automation_fail。晚课应适当强化这些词的主动使用，而不只是重复提供中文意思。
- 听词训练：关注只听声音时的词义识别、反应时间和重复播放。连续答错或反应慢可能形成 listening_wrong、listening_slow。优先通过晚课对话自然复现合法的听觉弱词。listening_focus_pool 可以作为非核心补充信号；如果某词已经 mastered，不得因为单纯的听觉弱项而重新占用 PM review 或 application 核心名额。
- 课程小测：早课小测、晚课选择/填空/排序答错，以及晚课自检里点“卡住了”，会记为 lesson_wrong（与 quick_wrong 同级的真实新错）。

上述训练和阅读中的明确陌生词标记会进入 WeaknessPool；同步后由现有 GitHub 构建链形成 `data/weakness-sync.json` → `data/learning-runtime.json` → `data/lesson-context.json`。

生成晚课时，只以当前已同步、已重建且有效的 runtime 为正式选词资格来源。不要直接读取浏览器 localStorage，不要重新解析整个 weakness-sync.json 或 daily-vocab 大文件来自行推算资格。没有及时同步的训练结果不能凭空补造，也不能因为某个词今天在快速练习中答对一次就自行删除其弱词身份。保持三个训练各自独立的到期选题逻辑，不改变它们的每日计划、状态或冷却周期。

## 5. 教学质量要求

先固定全部合法核心词，再分析这些词之间的语义关系，最后设计课程场景。不要先写故事，再倒过来往故事里硬塞单词。

主题以印尼当地真实交流为主，例如：工作沟通、日常生活、购物、交通、社交、情绪表达、家庭沟通、解决问题等。优先口语实用性，但区分口语与标准表达。不使用生硬的中文直译、不存在的固定搭配或刻意凑词的台词。

完整晚课必须包含：

- **词卡**：每个核心词具有中文、英文、正确词根及中文解释、构词或常见派生、2–4 个实用搭配、自然例句及中文翻译、至少一组有实际价值的近义或易混辨析，以及明确的使用说明。
- **阅读**：80–120 个印尼语单词（按 Validator 的空白分割计数，生成后实际统计），建议 90–105 词，附准确中文翻译。围绕一个完整、自然的事件展开，有起因、发展与结果。不要把互不相关的词义解释强行拼成一篇故事。
- **情景对话**：至少 4 行，每句附中文。应当是阅读场景的延伸，或者同类场景中的真实交流，而不是把阅读原句机械地分给 A、B 两个人。对话用雅加达日常口语（`docs/LESSON-QUALITY.md` §7b）。
- **主动改写**：3–4 项。应包含新词主动提取、真正弱词应用、当天早课词汇迁移或场景回应等不同任务。参考答案必须真实满足题目要求。
- **六题测试**：3 道 choice + 2 道 fill + 1 道 order。选择题兼顾词义辨析、真实搭配与场景使用，不全部设计成简单中译印识别；正确答案位置尽量分散，干扰项要有迷惑性。fill 的题干同一行必须有括号中文提示。order 必须有完整中文题干、5–8 个 tokens、正确 answer、answer_cn 及解释。tokens 按正确顺序拼接后必须与 answer 一致。
- **最后约 5 分钟复盘**：重点放在 3 秒主动提取、易混词、薄弱词和真实表达，不只是让学习者重新阅读一遍词卡。

**自检与复盘分工（2026-10-12 用户点评，必须）**：完整规则见 `docs/LESSON-QUALITY.md` §7。要点：daily_test.self_check 和 review.steps 不得出现同一个练习。

- self_check = 诊断：3–4 条简短的是/否问题，只用来找出哪些词还不熟。不要求造句、复述或写输出。每条自检里点名的核心词会在网页上自动出现“卡住了”按钮，所以每条自检要明确写出它检查的核心词。
- review.steps = 输出：第一步固定为“只把自检里卡住的词，看中文说出印尼语，答不出的回看词卡再说一遍”（不要把全部核心词再列一遍）；其余步骤从易混词各造一句、用阅读场景做 30 秒复述、联系自己真实经历的表达中选，hard 词的辨析或典型搭配放在这里。复盘一般 4 条左右。
- 当天 08:00 早课词的回顾只放在 review.steps，不在 self_check 里重复。
- 写完后逐条对照：若某条复盘只是把某条自检换个说法（同一批词、同一种动作），删掉或改成输出任务。汇报“第二遍教学审稿”时写一句自检与复盘的去重结果。

## 6. 晚课 JSON 结构，必须完整遵守

逐字段的键名表见 `docs/LESSON-JSON-SCHEMA.md` 的 PM 一节。要点：

- 根字段：date、session:"pm"、time:"18:00"、day、title（必须以 18:00 开头；标题双语（2026-10-17 用户要求）：`时间 早课/晚课｜印尼语标题 · 中文标题`，两种语言说同一件事，例如 `18:00 晚课｜Kemah di Bogor: Tenda Kena Longsor Kecil · 茂物露营夜：没听劝的帐篷遇上小滑坡`）、write_status:"lesson_complete"、new_words、vocab、reading、dialogue、rewrite、daily_test、review。
- vocab 必须为 10–12 张词卡，每张含：word, display, audio_text, cn, en, root, root_cn, formation, example, example_cn, synonym_note, usage_note, source_group, is_new, is_oral_new。source_group 只能是 new、review、application。is_new 只能在 source_group=new 时为 true。根字段 new_words 必须恰好列出所有 new 组词汇，不能混入 review 或 application。正常时 new 3–4、review 4–6、application 2–3；复习循环时 new=全部剩余新词（0–2）、review 4–9、application 2–3。
- reading 使用 {text,cn}。
- dialogue 必须是 {title,lines:[{speaker,id,cn},...]}，其中 id 存放印尼语台词，不是数字编号。
- rewrite 必须为 3–4 个：{task,reference_answer,reference_cn}。
- daily_test 必须使用 questions，禁止使用 items：
  - choice：{type:"choice",prompt,options,answer_index,answer,explain}
  - fill：{type:"fill",prompt,answer,explain}
  - order：{type:"order",prompt,tokens,answer,answer_cn,explain}
- daily_test 还必须包含非空字符串数组 self_check（3–4 条诊断问题，按第 5 节“自检与复盘分工”写）。
- review 必须使用 {title,steps:[...]}，不能把 steps 误写成 items。
- lesson_focus（今天的重点，2026-10-18 用户决定；**2026-10-18 晚课起每节必填**）：**不新增任何词或任务**，只是从本课已有内容里标出最值得掌握的部分（不是多学五项）。格式 `{"words":[3 个词],"patterns":[2 个 {pattern, cn, example, example_cn}]}`：
  - words：恰好 3 个，必须是本课的词（vocab 里任一组的词），优先选实用、容易忘、值得主动说出口的词。
  - patterns：恰好 2 个句型。pattern 用 `…` 标出可替换的部分（如 `Waktu masih …, …`），cn 是句型的中文意思；example 必须**逐字取自本课**（reading、dialogue 台词、词卡例句或 rewrite 参考答案），example_cn 是它的中文。
  - 校验器检查：`LESSON_FOCUS_MISSING`（缺字段）、`LESSON_FOCUS_INVALID`（数量或字段不对）、`LESSON_FOCUS_WORD`（词不是本课的）、`LESSON_FOCUS_PATTERN`（例句不在本课里）。按报错改正，不得为此改动选词、题目或其他内容。
  晚课重点优先放对话和输出里真正要用的表达。

生成过程中不得混用早课和晚课的 JSON 结构，也不得为了通过验证删除教学内容。

## 7. 生成完成后的双重检查

第一次远程写入前，先检查教学质量：印尼语自然度、词根、搭配、词义辨析、中文翻译、场景连贯性、阅读真实词数、改写和参考答案的一致性，六题是否具有训练价值，以及自检与复盘有没有重复。再运行搭配黑名单检查：`node .github/scripts/check-collocations.js --candidate data/daily/YYYY-MM-DD-pm.json`（只警告，有命中就改句子，改不了在汇报里说明）。

然后进行技术与资格检查：所有核心词属于相应 runtime 合法集合；当日 AM 来源正确；口语标记正确；分组、数量、冷却及七天历史正确；字段完整；答案和 answer_index 完全对应；同一份 JSON 能够满足现有权威 validator 和 planner 要求。尽可能真实执行仓库中的校验脚本。未运行的校验不得声称已经通过。

任何资格或内容错误，先修改同一份尚未提交的原稿；不降低 validator 标准，不借修复结构之名更换已锁定的合法核心词。

## 8. 唯一正式发布流程

发布前先检查：main 是否已有正式 PM；当天唯一 release 分支是否存在；是否已有完整原稿或 PR。若已有可恢复原稿，只恢复原稿，不重新选词或生成第二课（按 `docs/LESSON-RECOVERY.md` 的 checkpoint 规则：正式课程已在 main → 只核验 Sync/runtime/context/Pages；PR 已存在 → 不重建，核对该 PR head SHA 继续；分支有完整课程无 PR → 核对后创建同一个 PR；只有 ahead_by=0 的空分支才可复用；分支有非空改动但无可恢复课程 → 停止并保留证据）。

若确实没有，使用分支 lesson-release-YYYY-MM-DD-pm，仅在该分支创建 data/daily/YYYY-MM-DD-pm.json（分支创建和课程文件在同一次 push 中完成），创建到 main 的唯一授权 PR，PR 正文必须独立包含 AUTO_PUBLISH_LESSON=1。

不要自行修改 data/daily/index.json；不要直接写 main；不要直接修改 daily-vocab、runtime、lesson-context 或 weakness；不要自行 merge_pull_request。

由仓库现有 sync-daily-vocab.yml 中的 lesson_release 负责：根据最新 main 生成 index；执行权威 RELEASE_PREFLIGHT；按最终 head SHA 严格校验；squash 合并 lesson+index；显式触发后续 Sync；完成 runtime/context 更新和 Pages 部署。

如果写入遇到 timeout 或结果不确定，先回读同一远端路径再决定是否重试（最多两次有界重试，遵守 Retry-After）。如果遇到明确的上游安全拒绝，停止该写入，保留错误和已完成的 checkpoint；不换接口或其他写入方式绕过。

### 8-B. 深讲（课程 PR 开出后）

课程 PR 开出后，按 `docs/tasks/DEEP-TEACH.md` 为这节晚课写 `data/teach/D-pm.json`，在 `teach-D-pm` 分支单独开一个深讲 PR（正文单独一行 `AUTO_PUBLISH_TEACH=1`）。可以一边等课程 release 一边写；到 18:30 还没写完就放弃当天深讲。深讲的任何问题都不得影响课程，下面的课程验收照常进行。

## 9. 最终验收及反馈

必须确认以下事实，才能报告完整发布成功（VERIFIED_COMPLETE）：

1. 正式 PM 课程及 index 都已经进入 main。
2. RELEASE_PREFLIGHT 通过，且日志包含 LESSON_RELEASE_PUBLISHED（日志不可下载时按上文间接核验并说明）。
3. 后续 Sync 成功。
4. runtime.lesson_watermark 更新为当天 18:00。
5. 本节 PM 所有 new_words 均已退出 new_pool。
6. lesson-context 正确指向次日 08:00。
7. GitHub Pages 最终部署成功。

若课程已发布并同步但 Pages 尚未独立确认，须明确说明，不能虚报完全成功。

完成后用简洁中文报告：课程标题、Day、实际生成者；是否处于复习循环（若是，剩余新词数和 review 数）；新词及来源；核心复习词与选择理由（排序脚本是否运行、是否偏离推荐及原因、有无新错被顺延）；复现检查结果（带入了哪些 natural_recurrence 词、几个/要求几个，用了哪些 overused_in_text 词，重点复习里用了哪一组同词根词或反义/近义词）；应用词及上午来源；最新训练弱项如何影响本课；按 `docs/LESSON-QUALITY.md` 第 8 节写“全课跨句逻辑检查”和“第二遍教学审稿”两行；搭配黑名单检查结果；实际 PR、最终 commit 和 Pages 状态；未通过的检查或仍然存在的限制；最后一行写深讲结果（`docs/tasks/DEEP-TEACH.md` 第六节）。失败时按 `docs/tasks/COMMON.md` §5 说明。

整个过程中，不重建项目、不增加备用课程、不新增定时任务或工作流、不改变学习规则。首要目标是每天交付高质量、符合个人学习状态且真正发布成功的 18:00 课程。

## 补充：教学审稿与运行经验

- **教学质量**：严格执行 `docs/LESSON-QUALITY.md` 的全部内容（早晚课共用）：固定执行顺序、逐句母语化审稿、词卡与构词准确性、全课事实一致性与因果、阅读、题目设计（3 道 choice 里至少 1 道同语境词形/近义/搭配辨析）、rewrite 与参考答案审稿、新词三次接触与记忆强化、口语随词学，以及汇报中的两行。晚课还要核对：阅读、对话、rewrite 之间人物、时间、事件一致；application 词的“今天08:00新学/复习过的老词”标注来源真实；self_check 与 review.steps 没有重复练习。不得因此增加题量或新的 JSON 字段。
- **运行经验（2026-10-04）**：lesson_release 失败而 Actions 日志无法下载时，按 `docs/tasks/COMMON.md` §5 先在最新 main 上跑回归守卫判断是不是 main 本身的问题；未发布的课程 PR 在 main 修复后由用户重跑 lesson_release，不新建第二个 PR 或第二份课程。
