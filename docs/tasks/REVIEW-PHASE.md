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
| 阅读 `reading` | **2026-11-17 起是本周连载的一集，110–160 词，见 2.1**（`review-phase.js` 输出的 `story.reading`）。之前：60–100 词，放在本周主题的场景里。 |
| 自然复现 | 至少 `recurrence_min`（默认 6）个名单词，`check-recurrence.js` 检查。 |
| `phase` 根字段 | `{"theme_id": "...", "day_role": "..."}`，照抄 `review-phase.js` 输出的 `plan`。 |

`sentences` 5 句、`quiz` 3 题、`output`、`review` 3 条、`lesson_focus`（3 词 + 2 句型）都不变。

### 2.1 每周连载（2026-11-16 用户决定，2026-11-17 早课起）

为什么：学过的词要在不同的文章里碰到很多次才记得住；有情节的故事读起来不枯燥，会想知道后面发生什么。所以早课的阅读不再是一篇孤立的短文，而是**一周一个故事，每天一集**。

- **一周一个故事**：跟本周主题走（`plan.theme_id` / `plan.scenes`），周一到周日同一批人物、同一个地方。给人物起好记的印尼名字，身份写清楚（店主、客服、快递员、顾客……）。
- **先读前几集再写**：运行 `review-phase.js --date D --session am`，输出里的 `story` 给出本周第几集（`episode`）、连载名（`series`，第 1 集由你起名，之后整周照抄）和前几集的日期、标题。打开这些日期的 `data/daily/<日期>-am.json`，读它们的 `story` 和 `reading`，**接着写下一集**：人名、身份、地点、已经发生的事前后一致，不重复上一集的情节，也不把上一集重讲一遍。
- **每集一件完整的小事**：有起因、有麻烦、有结果；结尾留一个小悬念或下一步（写进 `next_cn`）。可以有一点幽默或紧张，贴近成年人的工作和日常生活，不说教，不写成课文腔。人物之间的对话用引号，口语照 `LESSON-QUALITY.md`。
- **词放进情节里**：本课词卡词和 `review_vocab` 在情节里自然出现（复现数照 `recurrence_min`）；本周前几集出现过的复习词可以再出现，这正是连载的用处。不为塞词写别扭的句子。
- **长度**：110–160 个印尼语词，`reading.cn` 逐段对应。`reading.title` = 本集标题，`印尼语 · 中文`。
- **根字段 `story`**：
  ```json
  "story": {"series": "Toko Bu Narti · 纳尔蒂太太的网店", "episode": 2, "previously_cn": "上集：……（中文 1–2 句）", "next_cn": "下集：……（中文一句，可选）"}
  ```
  `episode` 必须等于输出的 `story.episode`（本周已发布的连载集数 + 1；某天没发出来就顺延，不跳号）。第 2 集起 `previously_cn` 必填，让没看上一集的人也接得上。
- **其余部分不变**：`sentences` 5 句（可以取自本集，也可以是同场景的常用句；网页每句都有朗读按钮）、`quiz`、`output`、`review_cards`、`lesson_focus` 照旧（深讲 2026-11-10 起已取消，不写）。小测里至少 1 题要靠读懂本集才能答对。
- **页面**：带 `story` 的早课先显示本集（上集回顾 → 正文 → 下集预告），再显示词卡和其余部分。
- 校验码：`PHASE_AM_STORY_MISSING`（缺 story）、`PHASE_AM_STORY_INVALID`（字段不全、缺本集标题或第 2 集起缺上集回顾）、`PHASE_AM_STORY_EPISODE`（集数不对）、`PHASE_AM_STORY_SERIES`（连载名和本周前几集不同）、`READING_INVALID`（不在 110–160 词）。

### 2.2 早课后半部分精简（2026-11-17 用户决定，2026-11-18 早课起）

为什么：词卡已经先盖住答案回想过一遍（网页的「先想，后看」），后面 3 秒提取又把同样的词考一遍，课末回想再来一遍；“再各补半句”没有答案，“复习词应用”和高频句子重复；主动输出凭空写 3–4 句最容易卡住。

- **`output` 加句子骨架 `frame`**：参考答案的骨架，保留开头、连接词和本周句型，把关键内容换成 `……`（2–4 处），学习者只填关键部分。`reference_answer` 是填好的完整版，和 `frame` 一一对应。情境接本集故事。
- **`review_cards.recall` 只放词卡以外的复习词**：2–6 个，答案必须来自 `review_vocab`，且不是本课词卡（`vocab`）里的词。
- **`review_cards` 不写 `frames`，也不写 `apply`。**
- **`review_cards.contrasts` 1–3 组**（挑最容易混的）。
- **不变**：`sentences` 5 句、`quiz` 3 题（至少 1 题考读懂本集）、`review` 3 条（网页有复习卡时不显示，但仍要写，作退回内容）、`lesson_focus`。
- 校验码：`PHASE_AM_SLIM_OUTPUT`（缺带 `……` 的 `frame`）、`PHASE_AM_SLIM_REVIEW_CARDS`（recall 不是 2–6 个词卡以外的复习词、写了 frames / apply、辨析超过 3 组）。

### 2.3 复习词卡成组（2026-11-17 用户决定，2026-11-18 早课起）

为什么：近义词、反义词、长得像的词放在一起学，更容易分清，也记得牢。

- **排序输出的 `review_cycle.groups`**：选词脚本最多给 2 组（每组 2–3 个）：先找同词根（`same_root`），再找长得像的（`look_alike`：字母相同只是顺序不同，或 5 个字母以上只差一个字母，例如 `mengenali / mengenai`）。脚本只拿“最久没见”的填充词去换搭档，**最弱的词和答错的词从不被换掉**；组员在 `cycle_words` 里已经排在一起。直接照用 `cycle_words`，词卡按这个顺序排，组员相邻。
- **脚本给的组不到 2 组时，自己补 1 对近义词或反义词**：从本课词卡词里挑一个，再从 `runtime.review_pool` 里找它真正常见的近义 / 反义搭档（例如 `seenggaknya ↔ paling tidak`、`ramai ↔ sepi`），用它替换 1 个 `stale` 词（不换 `weak` 词），同样写进 `cycle_vocab`，词卡相邻。没有合适的就不补，不硬凑。
- **每组都要在 `review_cards.contrasts` 里讲清区别**（意思、用法或拼写差在哪），算进 2.2 的 1–3 组辨析里；`lesson_focus` 的 3 个词尽量包含一组。
- 本集连载里，同组的词尽量出现在同一个情节里。
- 汇报里列出用了哪几组、各是什么关系。

### 2.4 日常说法

早晚课都执行 `LESSON-QUALITY.md` 7e：对话、阅读、例句用印尼人日常真正说的词，正式词首次出现放括号；词卡可写 `everyday`。

### 2.5 小测里的「中文 → 选印尼语」（2026-11-17 用户决定，2026-11-18 早课起）

为什么：复习阶段的目标是能用印尼语说出来。只看印尼语选中文，练的是认得；先看中文、在心里说出印尼语、再从相近的句子里挑对，更接近真正开口，又不会多数题都答不上来。

- **开关**：`review-phase.js` 输出 `am_zh2id: true` 时执行（`data/review-phase.json` 的 `am_zh2id.from` = 2026-11-18）。
- **`quiz` 仍是 3 题**：1 题照旧考读懂本集；**另外 2 题写成 `kind: "zh2id"`**：
  ```json
  {"kind": "zh2id", "question": "我已经习惯住在这里了。", "target": "terbiasa", "target_cn": "习惯了",
   "options": ["Aku sudah terbiasa tinggal di sini.", "Aku pernah terbiasa tinggal di sini.", "Aku sudah membiasakan tinggal di sini.", "Aku belum terbiasa tinggal di sini."],
   "answer_index": 0, "answer": "Aku sudah terbiasa tinggal di sini.", "point": "sudah / pernah / belum，terbiasa 的词缀",
   "explain": "中文说明：为什么 A 对、每个错项错在哪；口语里能说的变体也要提一句（例如 sudah biasa 也常说）。"}
  ```
- **`question`** 是一句自然的中文（日常或工作里真会说的话，最好接本集故事或本周主题），不写印尼语，不写提示。
- **`target`** 是本课词卡词或 `review_vocab` 里的词，原样出现在正确句子里；2 题的 `target` 不同，**至少 1 题的 `target` 在 `review_vocab` 里**（这样就满足“至少一题考复习词”）。`target_cn` 可选，写这个词的中文。
- **4 个选项都是完整的印尼语句子**（3 个词以上），**错项只能和正确句子差一个点**：`sudah / belum / pernah / masih`、`bisa / boleh / sempat`、`karena / supaya / sehingga`、词缀（`ter- / me- / di-`、`-kan / -i`）、语序、搭配的介词。不要用意思完全不同、一眼就能排除的句子。校验要求每个错项和正确句子至少有 40% 的词相同。
- 错项必须真的错（或在这个意思下不对）。口语里也能说的说法不要当错项；如果不得不提，就在 `explain` 里讲清。
- **`point`** 一句话写考点；**`explain`** 用中文讲为什么对、错项错在哪。
- **页面**：先显示中文和「先在心里用印尼语说一遍」，点「看选项」才出现 4 个选项；答完显示考点和 🔊。答错时，对 `target` 记一次课程错词（同一课同一个词最多一次，和「忘了」一样），不改掌握状态；答对不记录。
- 校验码：`PHASE_AM_ZH2ID_COUNT`（不是恰好 2 题，或 2 题 target 相同）、`PHASE_AM_ZH2ID_INVALID`（字段不全、题干不是中文、选项不是印尼语句子、target 不在本课词里或不在正确句子里）、`PHASE_AM_ZH2ID_EASY`（错项和正确句子差太多）。
- 汇报里写出 2 题各考什么。

## 三、18:00 晚课：任务课

目标：在一个要办成的事里把旧词用出来，遇到变化也能接着说。

| 部分 | 复习阶段要求 |
|---|---|
| 词卡 `vocab` | 6–8 张：新词 = 剩余合法新词全部（最多 3 个），复习 4–6 个（数量用排序输出的 `review_cycle.review_target`），application 1–3 个。 |
| 对话 `dialogue` | 8–12 行，围绕一件要办成的事（退货、改约、报修……）。中途有一处**转折**：对方不配合、出了问题或改了主意。`dialogue.twist` = 转折那一行的下标（从 0 数，不能是第 0 行）。 |
| `rewrite` | **2026-11-17 起见 3.1：只写 1 个**（`kind: "twist"`，带句子骨架 `frame`；周日另加挑战题）。之前：3–4 个，至少 1 个带 `"kind": "twist"`：让学习者自己应对这个转折（换个说法拒绝、提出替代方案、道歉补救）。 |
| 场景 | 同一主题，但换成和早课不同的小场景（`themes.json` 的 `scenes`）；`LESSON-QUALITY.md` 7c 晚课换场景照样适用。 |
| 自然复现 | 至少 `recurrence_min`（默认 8）个名单词。 |
| `phase` 根字段 | 同早课。 |

`daily_test` 结构不变（3 选择 + 2 填空 + 1 排序），周日见第四节。

### 3.1 晚课后半部分精简（2026-11-16 用户决定，2026-11-17 晚课起）

为什么：后半部分原来有 3–4 道改写、自检、4 步复盘，再加网页上的课末回想，同一件事重复做、凭空写句子容易卡住、复盘只有题目没有答案，最容易被跳过。改成三步，每步都有提示和答案：

1. **对话「藏台词」**（网页自动做，不用写字段）：读完对话，网页可以把学习者选的那个角色的台词藏起来，只显示中文，先说再对照。所以对话里两个角色都要有足够的、能用上本课词的台词。
2. **`rewrite` 只写 1 个转折应对题**：`{"kind":"twist","task":"……","frame":"……","reference_answer":"……","reference_cn":"……"}`。
   - `frame` = 参考答案的**句子骨架**：保留开头、连接词和本周句型，把关键内容换成 `……`（2–4 处），让学习者只填关键部分。例：`Mohon maaf, Kak, …… . Saya mau menegaskan bahwa …… . Kakak bebas pilih: …… atau …… .`
   - `reference_answer` 是填好的完整版，和 `frame` 一一对应。
   - 周日（`day_role` = `weekly_test`）另加第四节的挑战题（`kind: "challenge"`），共 2 个。不写别的改写题。
3. **小测保留，自检去掉**：`daily_test` 照旧（3 选择 + 2 填空 + 1 排序，周日见第四节），但**不写 `self_check`**（网页的课末回想和词卡的「记得 / 模糊 / 忘了」已经覆盖）。
4. **复盘只留一项可选的 30 秒复述，并给参考**：
   ```json
   "review": {"title": "可选 · 30 秒复述", "steps": ["用 A、B、C 说说……（一句中文提示，点名 2–4 个本课词）"], "retell_reference": "3–5 句印尼语参考复述，用上点名的词", "retell_reference_cn": "对应中文"}
   ```
   `steps` 只有 1 条。PM-LESSON.md 第 5 节“自检与复盘分工”和 LESSON-QUALITY.md §7 关于 self_check / 复盘第一步的要求，在复习阶段由本节代替。
5. **藏台词用精简版对话 `dialogue.practice`**（2026-11-17 用户决定，2026-11-18 晚课起）：网页的「藏台词」不再整段照搬原对话，而是用这一段。
   ```json
   "practice": {"role": "学习者要说的角色（必须是对话里的一个 speaker）", "lines": [{"speaker": "……", "id": "……", "cn": "……"}]}
   ```
   - 放在 `dialogue` 里面；4–6 句，按原对话的顺序把事情精简地走一遍，`role` 至少 2 句。
   - 每句不超过 12 个印尼语词，挑最值得开口练的说法（本课词、本周句型、口语反应）。
   - **不照抄原句**：至少一半的句子是改写过的短句（换个说法、缩短、合并），不是原对话里一模一样的句子。
   - `cn` 是自然中文，学习者看着它说印尼语；不在中文里透露印尼语答案。
   - 校验码 `PHASE_PM_PRACTICE`。

- 自然复现照算：对话、阅读、改写参考答案和 `retell_reference` 里的词都算。改写少了 2–3 题，复现词要主动放进对话（两个角色都要有）、阅读和参考复述里，不要只靠改写凑数。
- 校验码：`PM_REWRITE_INVALID`（不是 1–2 个）、`PHASE_PM_SLIM_REWRITE`（缺 twist、缺带 `……` 的 `frame`，或有挑战题以外的改写）、`PM_SELF_CHECK_INVALID`（还写了 self_check）、`PHASE_PM_SLIM_REVIEW`（复盘不是 1 步，或缺参考复述）。

## 四、主题周

- 主题表：`data/themes.json`，7 个主题按顺序每周一个，从 `theme_start_date`（周一）开始轮换。
- 一周分工（`day_role`）：周一到周三 `core` 核心场景；周四、周五 `variation` 同主题换情况；周六 `transfer` 把本周说法搬到别的场景；周日 `weekly_test`。
- **本周交流动作（2026-10-31 用户决定）**：每个主题配 2–3 个交流动作（如网店客服周：说明问题、解释原因、提出办法），每个动作有 2–3 个固定句型，见 `themes.json` 的 `functions`，`review-phase.js` 输出的 `plan.functions` 就是本周的。**每节课 `lesson_focus.patterns` 的 2 个句型里，至少 1 个必须逐字是本周的某个句型**，并加 `"function": "<动作 id>"`；它的 `example` 要真的用上这个句型（固定部分按顺序出现），照常从本课原文逐字摘。另一个句型照旧自由选。这样同几个句型一周里在不同情况下反复出现。句型不占复习词名额；为套句型写出别扭的句子就换本周另一个句型，不硬写。
- 周日晚课 = 本周小测 + 开口挑战：
  - `daily_test` 另加 `week_words`，列出 6–12 个本周（周一起）课程里教过或复习过的词，每个词都要在某道题里真的考到。题型结构不变。
  - `rewrite` 里恰好 1 个 `"kind": "challenge"`，带 `"functions": [...]`（本周 2 个以上动作 id）。任务写成一个真实情况 + 三步：① 说明问题 ② 解释理由 ③ 提出解决办法（按本周动作调整），提示学习者不看参考、每一步尽量 3 秒内开口（网站不计时，靠自己掐）；参考答案用上本周句型。它算在 rewrite 的 3–4 个里。
- 主题只决定场景，不决定选哪些词：核心复习词仍由排序脚本按轮换、冷却和错词规则选；主题词靠阅读、对话和例句自然复现。学过的词不会因为换周而退出复习。
- **主题新词（2026-11-21 用户同意）**：主题周另配一张用户确认过的场景高频词表 `data/theme-words.json`（只收没学过的词；用户划掉的直接删除）。它们不用你挑：runtime 在上周日晚课发布后，每次只把下 2 个未教的主题词放进 `new_pool`（归为 dont），所以早课、晚课照现有规则「先教合法新词，其余是复习循环词」就会每节教 2 个，词卡总数不变。写这两张词卡时看 `runtime.theme_new_pool`（`[word, cn, formal, note, theme_id]`）：
  - 词卡的 `word` 写印尼人平时真说的形式（如 `ongkir`、`resi`、`COD`），`formal` 不为空时在释义或用法里用括号注正式说法（如「运费（正式：ongkos kirim）」）；`note` 是给你的用法提示，可以化用，不要原样整句照抄成内部说明。
  - 这两个词要在本课阅读 / 对话里自然出现，最好正好落在本周连载的情节里。
  - 教过以后它们和别的词一样进复习（没有 weakness 记录的主题词以 priority 2 出现在 `review_pool`），不用另外处理。
  - 每周日上午由定时任务按下周主题起草下一张词表（先和全部学过 / 标过的词逐个比对，去掉学过的），推送给用户看；用户要划掉的词，下周一早课前删掉即可。

## 五、选词

照原说明书运行 `rank-review-candidates.js`。开关打开后它的输出会带 `review_phase`，并且已经：

- 用 `data/vocab-goals.json`（启用时由用户确认的词汇目标）把目标是“会认”的词移出核心词卡和复习名额（它们仍可以出现在阅读、对话里）；
- 给“要快”的词加分；真实新错照旧优先；
- 把自然复现最低数改成 `recurrence_min`。
- （2026-11-20 起）按顺序轮复习词，上次复习后没再答错的词 30 天内先跳过（`review_sweep`），复习循环的“最弱的词”一半也不再反复挑已经过关的词。
- （2026-11-20 起）词卡一周一次（`card_weekly`）：7 天内上过词卡的词不再上词卡，答错也一样，可以出现在复习词、阅读、对话、例句里。

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
