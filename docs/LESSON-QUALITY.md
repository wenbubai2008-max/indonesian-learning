# 课程教学质量与审稿清单（08:00 早课、18:00 晚课共用）

本文件汇总用户对 Day 43–45 课程的点评，是早课和晚课生成任务的统一教学要求（2026-10-07 起由两份任务提示词引用，取代提示词里各自粘贴的“补充”段落）。规则不因合并而放宽：凡下文写“必须”的，都是硬性要求。

适用说明：早课没有 dialogue / rewrite / fill / order，对应地把“对话”换成 sentences，“rewrite”换成 output，“choice”换成 quiz。

本清单只管教学质量。词汇资格、数量、JSON 结构以 `data/learning-pool-rules.json`、`docs/LESSON-JSON-SCHEMA.md` 和 Validator 为准；本清单不新增题量、不新增 JSON 字段，也不修改 Validator、发布工作流或词库规则。

## 0. 固定执行顺序

锁定合法词表 → 写初稿 → 第二遍教学审稿（下文 1–7 节逐项执行，真正动手改稿）→ 内容守卫脚本、Validator、planner、回归守卫 → 提交 GitHub 发布。

先固定全部合法核心词，再分析词与词的语义关系，最后设计场景。不要先写故事再往里硬塞单词。

## 1. 逐句母语化审稿

把全课所有印尼语（词卡例句、sentences、阅读、对话、选项、fill/order、rewrite / output 参考答案）逐句重读，问：

- 印尼成年人真实聊天会这样说吗？有没有中文直译痕迹？有没有“语法没错但本地人很少这么说”的句子？
- 口语与书面语是否混用？同一段里 aku/saya、nggak/tidak、ngerjain/mengerjakan 是否一致？
- 印尼语例句与中文翻译是否真正一致？

真实反例：

- “作出决定”用 mengambil keputusan / membuat keputusan，不用 menghasilkan keputusan。
- “价格与品质相符”优先 harganya sepadan dengan kualitasnya，轻松口语可用 worth it。
- “barang yang hanya ingin”“barang yang hanya terlihat menarik”不自然，应改成 “barang yang cuma saya inginkan” 之类的完整说法。
- “terpeleset kulit pisang”不自然，应写成 “terpeleset karena menginjak kulit pisang”。
- “tugas ini sudah nanggung kalau berhenti sekarang”不自然，放进口语引语更好：“Udah nanggung, jangan berhenti sekarang!”
- “tidak punya hak ikut ujian”生硬，更自然是 “tidak boleh mengikuti ujian” 或 “akan kehilangan hak untuk mengikuti ujian”。

凡是把名词直接接在不及物/被动动词后面、或自己造出来的“固定搭配”，都要问一遍本地人是否真这样说；不确定就改成更完整、更常见的说法。

**目标词入句检查（Day 48 点评，必须）：** 每个核心词放进阅读、对话、例句、rewrite 参考答案后，先单独问：这个搭配是不是本地人真会这么说？不能只因为“要复现这个词”就保留。真实反例：`Melepaskan gaji yang lebih besar` 不自然（放弃的是工作机会，不是工资），应写 `Melepaskan tawaran dengan gaji yang lebih besar`；`Nyantai aja dulu` 能懂，但劝人别急更自然是 `Santai aja dulu`，nyantai 更适合作动作：`Kita nyantai dulu aja`。为复现词而写、带明显刻意感的句子（如为 kabur 硬写的玩笑）宁可删掉。不要为展示词根或派生形式造不自然的搭配；也不要一味追求俚语，A2+→B1 仍需规范实用的印尼语。

## 2. 词卡准确性审稿 + 反例测试

每张词卡检查：核心含义有没有讲窄或讲过头；“常见倾向”有没有被写成“绝对规则”；口语形式与规范形式有没有说清；近义/易混辨析是否真正成立。每个词至少想一个反例来验证解释。

- 真实反例：把 sekadar 写成“带‘随便、不认真’意味”，但 “Ini sekadar informasi.” 并不表示不认真；应写成“只是（程度有限、不多不重）；在 lihat-lihat、basa-basi 等搭配里才带‘随便’的味道”。
- 解释里凡出现“总是 / 一定 / 带……意味”等绝对化说法，都要用反例检验。

**构词说明必须准确。** 涉及 meN-、peN-、ber-、ke-an、pe-an 等词缀时，检查词根与鼻音变化：pencuri＝peN- + curi（不是“pe- + curi”），menulis＝meN- + tulis，mengetik＝meN- + ketik，memukul＝meN- + pukul（p 脱落），penulis＝peN- + tulis。root 必须是真正的词根（如 curi），root_cn 对应；formation 的派生说明要经得起推敲。

## 3. 全课事实一致性与因果

先列一张内部“事实表”（谁、何时、做什么、原因、结果），把阅读、对话 / sentences、rewrite / output 参考答案、词卡例句逐项对照，不得有人物、时间、事件状态、因果矛盾。

- 真实反例：第 1 句“我爷爷上个月去世了”，第 4 句却“爷爷的病相当严重，到现在体力还没恢复”。发现矛盾就改句子（例如改成 “Sebelum meninggal, kondisi kakek rupanya sudah cukup parah. Kekuatan tubuhnya makin berkurang.”），保留已锁定的核心词，不得更换合法核心词。
- 人物的情绪、评价或决定（如 rugi banget、kesel、terpaksa）出现前，必须已交代原因。真实反例：Bu Sari 突然说 “Aduh, rugi banget hari ini!”，前面应补 “Karena harus ke UGD, warungnya terpaksa tutup lebih awal.”。在事实表里给每个情绪/评价句标出“原因句”，没有就补，篇幅仍控制在要求范围内。
- 晚课 application 词若标注“今天08:00新学 / 今天08:00复习过的老词”，来源必须真实。
- **早课来源回查（Day 48 点评，必须）：** 凡是课程里任何地方（词卡 usage_note/formation、rewrite、题目、复盘）写“今天早课学过 / 今天08:00新学 / 今天08:00复习过”的词，发布前必须回查当天 `data/daily/YYYY-MM-DD-am.json` 的 `vocab` 与 `review_vocab`，逐词确认真的在里面。真实反例：rewrite 写“用今天早课学过的 dilarang 和 ngeh”，但 ngeh 并不在当天 AM 里（它是历史弱项池的重点复习词）。不在 AM 里的词只能写“此前已学的弱项词”或直接不提来源。

## 4. 阅读

- 严格按 Validator 的空白分词统计（80–120 词，建议 90–105），生成后实际统计。
- 围绕一个完整场景：人物、事件、矛盾、结果自然衔接；不拼接不同主题的例句；中文翻译完整对应。
- 词义跨度过大时，允许部分词只出现在词卡、实用句或对话里，不必全部塞进阅读，但仍须满足仓库实际的覆盖校验。

## 5. 题目设计

- 选择题（晚课 3 道 choice / 早课 3 道 quiz）：正确答案位置分散（answer_index 不要全相同）；answer 严格等于 options[answer_index]；不要为打乱位置牺牲题目质量。
- 干扰项要有迷惑性：考查容易混淆的词义、搭配或场景；不要用语法不通、或语义类别完全无关的词凑数（例如只列 kepake / kepancing / kesiangan / kelewat 这类“中文意思对应哪个词”的识别题）。
- 三题尽量覆盖词义识别、搭配辨析、场景应用；**至少 1 道**是“同一真实语境下，从词形/近义/搭配里选最自然的一项”，例如 “Payung ini ternyata ___ banget waktu hujan.”，选项 kepake / dipakai / terpakai / memakai，并在 explain 里说明其他项为什么不合适。
- 早课另须满足：至少一题正确答案是真实 review_vocab 词；题干不得泄露答案（AM_QUIZ_ANSWER_LEAK）。
- 晚课 fill 题干同一行带括号中文提示；order 有完整中文题干、5–8 个 tokens、answer、answer_cn、explain，tokens 拼接后等于 answer。

## 6. 主动输出（晚课 rewrite / 早课 output）

- 不只是模仿课文：要有一点独立思考和组织语言，例如介绍最近买过的一件东西并解释值不值得。
- 每项要求使用至少 2 个本课目标词，鼓励 2–3 句自然印尼语，贴近用户真实生活，不要求照抄阅读。
- 参考答案单独审：是否完成 task 的全部要求、是否用了要求的目标词、是否自然、人称是否统一、逻辑是否成立、难度是否超出所需、是否照抄课文。不能因为是“参考答案”就降低标准。

## 7. 记忆强化（不增加题量）

- **新词三次接触**：词卡理解 → 在阅读、对话或 sentences 中以真实语境出现 → 在选择题、fill、order、rewrite / output 或复盘的“3 秒主动提取”里再用一次。只有“词卡 + 一句例句”的新词不合格；用现有题目改造补齐，逐词核对。
- 只在词卡（和实用句）里出现过的核心词，必须在题目、主动输出或复盘的“3 秒主动提取”里至少再复现一次。
- **复习词不必硬塞进阅读和对话**：只要在词卡、题目、主动输出或复盘里真实出现过即可。真实反例：“Saya nggak niat nyinggung, Bu, tapi lain kali jangan dikejar sendiri.” 能懂但很刻意（nyinggung 已在复习题里），更自然的是 “Maaf ya, Bu, bukan mau nyalahin, tapi lain kali jangan kejar pencurinya sendiri. Bahaya.”。写不自然就删掉。
- 排序脚本 `avoid_in_text` 里的词不写进阅读、对话和例句（除非是本课核心词）；`natural_recurrence` 的词在自然的前提下带入，写不自然就不带。
- 复盘重点放在 3 秒主动提取、易混词、薄弱词和真实表达，不是让学习者重读词卡。

## 8. 汇报里的两行（必须）

- **全课跨句逻辑检查**：已通读全课、未发现矛盾，或列出改了哪几句。
- **第二遍教学审稿**：构词说明改了哪几张词卡；哪些搭配/例句改成了更自然的说法；哪些为凑覆盖率写的句子被删掉；补了哪些因果句。
