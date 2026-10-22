# 课程教学质量与审稿清单（08:00 早课、18:00 晚课共用）

本文件汇总用户对 Day 43–45 课程的点评（以及之后各条带日期标注的点评），是早课和晚课生成任务的统一教学要求（2026-10-07 起由两份任务提示词引用，取代提示词里各自粘贴的“补充”段落）。规则不因合并而放宽：凡下文写“必须”的，都是硬性要求。

适用说明：早课没有 dialogue / rewrite / fill / order，对应地把“对话”换成 sentences，“rewrite”换成 output，“choice”换成 quiz。

本清单只管教学质量。词汇资格、数量、JSON 结构以 `data/learning-pool-rules.json`、`docs/LESSON-JSON-SCHEMA.md` 和 Validator 为准；本清单不新增题量、不新增 JSON 字段，也不修改 Validator、发布工作流或词库规则。

## 0. 固定执行顺序

锁定合法词表 → 写初稿 → 第二遍教学审稿（下文 1–7 节逐项执行，真正动手改稿）→ 搭配黑名单检查 → 复现检查（`check-recurrence.js`）→ 内容守卫脚本、Validator、planner、回归守卫 → 提交 GitHub 发布。

**搭配黑名单检查（2026-10-14）：** `node .github/scripts/check-collocations.js --candidate <课程或泛读 JSON>`。它对照 `data/lesson-collocation-watchlist.json`（用户点评里标出过的不自然搭配）逐条检查，只警告、不阻断发布；有警告就改句子，改不了要在汇报里说明。以后每次点评标出新的不自然搭配，都要追加到这份清单里。

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

**新词首日搭配从严（Day 54 点评，必须）：** 新词第一次出现时，学习者会把课里的句子当作固定搭配记住，所以新词所在的每一句（例句、sentences、阅读、复盘里的示范半句）都要用最典型的搭配，“能懂但不地道”也不行。同一节课里词卡说明和正文用法必须一致：词卡写了“khas 放在名词后”，正文就不能出现 khas 放错位置的句子。真实反例：

- `Suhu siang ini panas banget.`：suhu 是温度数值，应说 `Suhu siang ini tinggi banget.`，或不用 suhu，直接说 `Siang ini panas banget.`。“suhu panas”相当于中文“温度很热”，不能作为 suhu 的示范句。
- `Kain jualannya bermotif khas batik Solo.` / `Kain motif khas Jawa ini…`：khas 要紧跟被修饰的名词，应写 `bermotif batik khas Solo`、`Kain bermotif khas Jawa ini…` 或 `Kain dengan motif khas Jawa ini…`。
- `Pedagang itu menerapkan harga khusus untuk pembeli langganan.`：“老顾客”说 `pelanggan tetap`；“实行特价”说 `memberlakukan harga khusus`（口语 `kasih harga khusus`）。menerapkan 的示范搭配优先 `menerapkan strategi / sistem / aturan`。
- 连接词：日常对话里“然后呢？”说 `Terus gimana?`，不说 `Kemudian bagaimana?`。kemudian 用在叙述和讲步骤里；对话、口语句里的“然后”优先用 terus / lalu。

## 2. 词卡准确性审稿 + 反例测试

每张词卡检查：核心含义有没有讲窄或讲过头；“常见倾向”有没有被写成“绝对规则”；口语形式与规范形式有没有说清；近义/易混辨析是否真正成立。每个词至少想一个反例来验证解释。

- 真实反例：把 sekadar 写成“带‘随便、不认真’意味”，但 “Ini sekadar informasi.” 并不表示不认真；应写成“只是（程度有限、不多不重）；在 lihat-lihat、basa-basi 等搭配里才带‘随便’的味道”。
- 解释里凡出现“总是 / 一定 / 带……意味”等绝对化说法，都要用反例检验。
- **近义辨析不绝对化（2026-10-22 点评，必须）**：“只能用 A”“不说 B”“固定用 A”这类说法，只在两词确实不能互换时才写。有重叠的写成“A 多用于……；在……场合两者都可以”。真实反例：词卡和深讲把 lolos / lulus 讲成“筛选过关固定说 lolos seleksi”，但官方公告常写 *dinyatakan lulus seleksi administrasi*。准确讲法：lolos 偏“过关、进入下一轮、逃脱”，lulus 偏“达到考试、毕业或审核标准”，选拔场合两者都能用。题目里也不得把这种可以互换的说法判为错误（可以设成“也可以”的选项并说明场合）。

**构词说明必须准确。** 涉及 meN-、peN-、ber-、ke-an、pe-an 等词缀时，检查词根与鼻音变化：pencuri＝peN- + curi（不是“pe- + curi”），menulis＝meN- + tulis，mengetik＝meN- + ketik，memukul＝meN- + pukul（p 脱落），penulis＝peN- + tulis。root 必须是真正的词根（如 curi），root_cn 对应；formation 的派生说明要经得起推敲。

**不要编造音变规则（Day 54 点评，必须）：** 真实反例：词卡写 `pedagang = peN- + dagang（peN- 遇 d 变 pe-）`，这是错的。peN- 遇 d 规则上变 pen-（penduduk、pendaftar）。pedagang 属于 pe- 直接加词根、对应 ber- 动词的一类：berdagang → pedagang，bertani → petani，berlari → pelari。说不清规则时，就写成“dagang（买卖）→ pedagang（做买卖的人），对应动词 berdagang”，不要为了解释自造一条规则。

## 3. 全课事实一致性与因果

先列一张内部“事实表”（谁、何时、做什么、原因、结果），把阅读、对话 / sentences、rewrite / output 参考答案、词卡例句逐项对照，不得有人物、时间、事件状态、因果矛盾。

- 真实反例：第 1 句“我爷爷上个月去世了”，第 4 句却“爷爷的病相当严重，到现在体力还没恢复”。发现矛盾就改句子（例如改成 “Sebelum meninggal, kondisi kakek rupanya sudah cukup parah. Kekuatan tubuhnya makin berkurang.”），保留已锁定的核心词，不得更换合法核心词。
- 人物的情绪、评价或决定（如 rugi banget、kesel、terpaksa）出现前，必须已交代原因。真实反例：Bu Sari 突然说 “Aduh, rugi banget hari ini!”，前面应补 “Karena harus ke UGD, warungnya terpaksa tutup lebih awal.”。在事实表里给每个情绪/评价句标出“原因句”，没有就补，篇幅仍控制在要求范围内。
- 晚课 application 词若标注“今天08:00新学 / 今天08:00复习过的老词”，来源必须真实。
- **早课来源回查（Day 48 点评，必须）：** 凡是课程里任何地方（词卡 usage_note/formation、rewrite、题目、复盘）写“今天早课学过 / 今天08:00新学 / 今天08:00复习过”的词，发布前必须回查当天 `data/daily/YYYY-MM-DD-am.json` 的 `vocab` 与 `review_vocab`，逐词确认真的在里面。真实反例：rewrite 写“用今天早课学过的 dilarang 和 ngeh”，但 ngeh 并不在当天 AM 里（它是历史弱项池的重点复习词）。不在 AM 里的词只能写“此前已学的弱项词”或直接不提来源。

## 4. 阅读

- 严格按 Validator 的空白分词统计（80–120 词，建议 90–105），生成后实际统计。
- 围绕一个完整场景：人物、事件、矛盾、结果自然衔接；不拼接不同主题的例句；中文翻译完整对应。
- **只把自然放得进去的词写进阅读（2026-10-22 点评，必须）**：阅读不要求、也不应该把全部新词都塞进去。早课一般 5–7 个新词进阅读即可，其余新词放在实用句、词卡例句或输出里完成“三次接触”（第 7 节）。真实反例：为了同时放进 silsilah keluarga 和 golongan darah，写出“科学竞赛前老师要求每人画家谱、写全家血型”，参赛准备和这项作业毫无关系；结尾又一句列出长颈鹿、麂、黑豹、袋鼠四种动物。这两处应改为：家谱、血型放进实用句里的独立生活场景，动物只写一两种进阅读，其余放例句。
- **情节合理性检查**：写完阅读，逐个事件问“为什么会这样、真实生活里会不会这样”。讲不通就改情节，或者把那个词移出阅读，不要用不合理的情节换覆盖率。
- 复现要求（`check-recurrence.js` 的“久未出现的待复习词”数量）统计的是阅读、对话、实用句、词卡例句、早课 output / 晚课 rewrite 参考答案的全部文本，不需要都压在阅读里；优先放进实用句和例句，阅读里只放自然出现的。

## 5. 题目设计

- 选择题（晚课 3 道 choice / 早课 3 道 quiz）：正确答案位置分散（answer_index 不要全相同）；answer 严格等于 options[answer_index]；不要为打乱位置牺牲题目质量。
- 干扰项要有迷惑性：考查容易混淆的词义、搭配或场景；不要用语法不通、或语义类别完全无关的词凑数（例如只列 kepake / kepancing / kesiangan / kelewat 这类“中文意思对应哪个词”的识别题）。
- 三题尽量覆盖词义识别、搭配辨析、场景应用；**至少 1 道**是“同一真实语境下，从词形/近义/搭配里选最自然的一项”，例如 “Payung ini ternyata ___ banget waktu hujan.”，选项 kepake / dipakai / terpakai / memakai，并在 explain 里说明其他项为什么不合适。
- 早课另须满足：至少一题正确答案是真实 review_vocab 词；题干不得泄露答案（AM_QUIZ_ANSWER_LEAK）。
- **题干不给答案的中文（2026-10-22 点评，必须）**：选择题（早课 quiz、晚课 choice）的题干和括号说明里，不得写出正确答案的中文意思或等价提示。真实反例：题干注明“委婉建议‘最好……’”，答案 sebaiknya 一眼可猜；题干写“意思是有效期至……”，答案 berlaku sampai 也被直接点破。这样只考认不认得中文，不考会不会用。三道题里**至少 1 道是完整情境判断**：只给一段对话或场景（可以附整句中文翻译，但不单独点出空格的中文），让学习者判断最自然的说法。晚课 fill 按合同保留同一行括号中文提示，不受本条限制。
- 晚课 fill 题干同一行带括号中文提示；order 有完整中文题干、5–8 个 tokens、answer、answer_cn、explain，tokens 拼接后等于 answer。

## 6. 主动输出（晚课 rewrite / 早课 output）

- 不只是模仿课文：要有一点独立思考和组织语言，例如介绍最近买过的一件东西并解释值不值得。
- 每项要求使用至少 2 个本课目标词，鼓励 2–3 句自然印尼语，贴近用户真实生活，不要求照抄阅读。
- 参考答案单独审：是否完成 task 的全部要求、是否用了要求的目标词、是否自然、人称是否统一、逻辑是否成立、难度是否超出所需、是否照抄课文。不能因为是“参考答案”就降低标准。

## 7. 记忆强化（不增加题量）

- **新词三次接触**：词卡理解 → 在阅读、对话或 sentences 中以真实语境出现 → 在选择题、fill、order、rewrite / output 或复盘的“3 秒主动提取”里再用一次。只有“词卡 + 一句例句”的新词不合格；用现有题目改造补齐，逐词核对。
- 只在词卡（和实用句）里出现过的核心词，必须在题目、主动输出或复盘的“3 秒主动提取”里至少再复现一次。
- **复习词不必硬塞进阅读和对话**：只要在词卡、题目、主动输出或复盘里真实出现过即可。真实反例：“Saya nggak niat nyinggung, Bu, tapi lain kali jangan dikejar sendiri.” 能懂但很刻意（nyinggung 已在复习题里），更自然的是 “Maaf ya, Bu, bukan mau nyalahin, tapi lain kali jangan kejar pencurinya sendiri. Bahaya.”。写不自然就删掉。
- 排序脚本 `avoid_in_text` 里的词不写进阅读、对话和例句（除非是本课核心词）；`natural_recurrence` 的词早课至少带入 10 个、晚课至少 15 个（2026-10-15 起由 `check-recurrence.js` 在推送前检查），新增的优先放在词卡例句、sentences、rewrite / output 参考答案里，在自然的前提下带入，写不自然的跳过换名单里的下一个；`overused_in_text` 里的词不要刻意写进去。
- **复习词成组（2026-10-15）**：核心复习里有可用的同词根组时放 1 组 2–3 个，让学习者看到同一词根的不同词形；没有时可用 1 对反义词，或 1 对近义词（必须讲清区别，不能让两个都没掌握的近义词只是并排出现）。
- 复盘重点放在 3 秒主动提取、易混词、薄弱词和真实表达，不是让学习者重读词卡。
- **晚课自检与复盘分工（2026-10-12 用户点评，必须）**：`daily_test.self_check` 和 `review.steps` 不得出现同一个练习。真实反例：某节晚课的 4 条自检（印→中说意思、找想不起来的词、辨析 berjanji/janjian/perjanjian 和 memerlukan/perlu、用早课词各说一句）在复盘里几乎原样又出现了一遍，5 条复盘只有“复述阅读”是新的。
  - **self_check = 诊断**：3–4 条简短的是/否问题，只用来找出哪些词还不熟（例如“不看中文，下面几个词里哪个我 3 秒内说不出意思？”“这几组易混词我分得清吗？”）。不要求造句、复述或写输出。
  - **review.steps = 输出**：第一步固定为“只把自检里卡住的词，看中文说出印尼语，答不出的回看词卡再说一遍”（不要把全部核心词再列一遍）；其余步骤从易混词各造一句、用阅读场景做 30 秒复述、联系自己真实经历的表达中选，hard 词的辨析或典型搭配放在这里。
  - 当天 08:00 早课词的回顾只放在 review.steps，不在 self_check 里重复。
  - 写完后逐条对照：若某条复盘只是把某条自检换个说法（同一批词、同一种动作），删掉或改成输出任务。

## 7b. 口语随词学（2026-10-14 用户决定，必须）

口语不再单独靠“口语新词”名额来学，而是挂在每天学的词上一起学。

- **不追求口语新词数量**：`runtime.oral_new_pool` 里有合法候选时照 Validator 要求使用（`ORAL_COUNT` / `ORAL_DONT_PRIORITY` / `PM_ORAL_COUNT` 照常执行）；没有就是 0 个，不凑数，也不为此补充口语候选。`is_oral_new` 仍只按 runtime 标记。
- **词卡写“口语说法”**：核心词（新词、复习词、循环词都算）如果在雅加达日常口语里有常用的不同说法，在 `synonym_note` 末尾加一句“口语说法：……”，并说明什么场合用标准形。例如 membeli → beli；mengerti → ngerti；tidak → nggak；sudah → udah；bagaimana → gimana；memberikan → ngasih；-kan → -in（membersihkan → bersihin）。只写真实常用的；没有常用口语说法的词（如 menegaskan）不写，不要硬造。不新增 JSON 字段。
- **早课**：5 句 sentences 里至少 1 句是朋友、家人或同事之间的自然口语，句中的口语形式在该句 `cn` 末尾用括号注明标准形，例如“（nggak = tidak，udah = sudah）”。阅读保持标准语。
- **晚课**：`dialogue` 一律用自然的雅加达日常口语（aku/kamu 或 gue/lo 按人物关系选，同一段对话保持一致；长辈、顾客、上级之间用 saya/Bapak/Ibu 加口语语气词）。每个口语形式第一次出现时，在那一行 `cn` 末尾用括号注明标准形。阅读保持标准语。
- 口语形式不算新词或复习词，不计入任何名额，也不标 `is_oral_new`。
- 审稿时检查：口语形式用在人物和场合都对得上的地方；同一句里不要标准形、口语形无理由混用；括号注明的标准形写对。

## 7c. 晚课换场景（2026-10-21 用户决定，必须）

晚课的阅读、对话和 rewrite 不得沿用当天早课的故事或场景（2026-10-21 早课是公园小音乐会，晚课又是音乐会入口改道，属于反例）。当天早课的词进入晚课 application 时，要放到完全不同的生活场景里使用（例如早课在音乐会学的 nuansa，晚课拿来介绍一家咖啡店的风格），练的是迁移，不是同一个故事换篇文章。写完对照当天早课的标题和阅读，确认场景不同。

## 7d. 不让系统用语出现在课程里（2026-10-22，必须）

词卡、阅读、句子、题目、对话、改写、复盘等给学习者看的文字，不得出现生成系统的内部用语：runtime、`*_pool`（new_pool、oral_new_pool、review_pool……）、source_group、is_oral_new、application（作为分组名）、（hard）、validator 等。要表达来源就用人话：“今天08:00新学”“今晚应用复现”“最近常错的词”。真实反例（2026-10-21 晚课）：usage_note 写“在 runtime.oral_new_pool 中具备合法口语新词资格”“当前真实错题压力较高（hard）”。2026-10-23 起 Validator 用 `LEARNER_JARGON` 拦截。

## 8. 汇报里的两行（必须）

- **全课跨句逻辑检查**：已通读全课、未发现矛盾，或列出改了哪几句。
- **第二遍教学审稿**：构词说明改了哪几张词卡；哪些搭配/例句改成了更自然的说法；哪些为凑覆盖率写的句子被删掉；补了哪些因果句。
