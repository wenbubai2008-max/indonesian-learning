# V2备用课程 V4 升级：同输入新旧质量对比（2026-10-02）

## 测试口径

以 main 中 PR #58 合并后的 V3 为旧版：旧代码读取 **旧版源码和旧素材包**；新版使用 V4 源码和新版素材包；两边都读取相同的学习上下文、合法词库、历史记录和固定 variant。早晚课各6份，12组同输入配对课程。版本之间不允许更换新词资格、跨日去重、mastered/冷却或正式发布规则。以下为程序可复现指标，而非印尼语母语者盲评。

## 实际素材

| 项目 | V3 | V4 |
|---|---:|---:|
| 专门维护的 microcontent 词汇条目 | 40 | **127** |
| 独立于词卡原句的双语迁移例句 | 无独立迁移字段 | **115** |
| 两目标词的双语微场景 | 0 | **52** |
| 改写/输出质量门槛 | 必须命中所要求的词 | **还须检验第二语境确实不同于词卡、无虚报迁移、晚课答案包含要求的词** |

另外 V4 逐项核对源文件与编译后的 materials-bundle 完全相同，每条迁移例句包含实际目标词，每组场景两句话分别包含各自指定词及中文对照。只在**两个词均合法入选**时使用双词微场景。

## 12组相同输入：实际结果

| 可复现指标（每份课均值） | V3 | V4 |
|---|---:|---:|
| 早课指定新词在参考答案中实际命中 | 2 | **2（维持）** |
| 早课真正不同于词卡例句的情境迁移数量 | 0 | **2** |
| 早课阅读双词微场景命中次数 | 0 | **1.17** |
| 早课阅读新词精确覆盖 | 6 | **6（维持）** |
| 早课阅读平均印尼语词数 | 84.67 | 86.67 |
| 晚课真正不同于词卡例句的改写数量 | 0 | **3** |
| 晚课阅读双词微场景命中次数 | 0 | **1** |
| 晚课采用配对微场景对话的比例（0/1均值） | 0 | **1** |
| 晚课明显生硬换话题次数 | 0 | **0（维持）** |
| 晚课阅读新词精确覆盖 | 4 | **4（维持）** |
| 晚课阅读平均印尼语词数 | 88 | 82 |

V4 早晚阅读均维持原有80—120词约束；法律意义上的“新词、复习词、当天应用”类别不变。PM微场景示例保留原本自然存在的旧词 biarpun，不能把原有教学内容换成机械的“谢谢分享”来制造形式上的连贯。

## 直观样例：08:00 主动输出（mundur / meledak）

V3 虽然已经能保证参考答案命中两个目标词，但仍照搬词卡例句：

- 「Tolong mundur sedikit supaya pintunya bisa dibuka.」
- 「Ban mobil itu tiba-tiba meledak di jalan.」

V4 换成与词卡不同的**实际停车/道路情境**：

> Mobil di depan terlalu dekat, bisa mundur sedikit? Ban motor itu meledak waktu lewat jalan yang rusak.

「前面的车离得太近，能稍微往后倒一点吗？摩托车经过破损路面时轮胎突然爆了。」

这才是在相近但不相同的情况下使用刚学过的词，而不是立即重复原句。

## 直观样例：18:00 阅读与对话

V3 把几条独立例句排列在一起：乌云出现 → 雨水流动 → 杀虫剂能消灭昆虫。

V4 优先匹配已复核的 awan + mengalir 微场景：

> Awan gelap mulai berkumpul sejak siang. Tak lama kemudian, air hujan mengalir ke selokan depan rumah. Petugas kebun menunggu hujan reda sebelum memakai pestisida untuk membunuh serangga.

「中午起乌云聚集。不久后雨水流入屋前排水沟。园艺工人等雨停后再使用杀虫剂杀虫。」

对话同时采用连贯追问，并根据共同的 konkret 词（本例 hujan）选择已学词作第三轮答复：

- A: Tadi cuacanya bagaimana?
- B: Awan gelap mulai berkumpul sejak siang.
- A: Terus setelah itu apa yang terjadi?
- B: Tak lama kemudian, air hujan mengalir ke selokan depan rumah.
- A: Jadi, rencanamu tetap jalan?
- B: Biarpun hujan, saya tetap pergi ke kantor.

## 发布风险与压力测试

- Prototype与教学素材质量专项：**48项通过**（常规 AM/PM 各6个 variant、专项失败注入及素材自查）。
- **48种合法候选词排列（24早课+24晚课），每组最多尝试6个variant，全部存在至少1份可通过正式Validator和额外质量审计的课程**。
- V2恢复专项：**26项通过**。
- 原有通用回归检查：**822项通过，0警告、0失败**。
- 独立临时目录中的V2实际两文件写入演练通过；发布仍必须同时写 lesson + index，官方历史课程不可覆盖。
- ChatGPT/人工原课优先、雅加达08:05/18:05最早启动、两个现有Cron、GitHub授权和Pages路径完全保留。

## 判断范围与局限

这次改进能够客观证明新旧同输入的情境迁移数量与微场景使用率提高，且不减少原有学习覆盖。**它并不等价于证实印尼语自然度已达到某个精确百分制分数**；88—90分仍只能作为基于现有课程样例的主观阶段目标，需再有母语者人工盲评验证。确定性V2不会为了写一个完美故事而引入未正式选中的新词；面对真正不相关的候选词，仍保留诚实的多片段阅读模式。

## 可重复验证

在PR #59分支中，执行：

- \`node prototype/lesson-engine/engine/test-prototype.js\`
- \`node prototype/lesson-engine/engine/compare-quality.js origin/main\`
- \`node .github/scripts/test-recover-missing-lesson.js\`
- \`node .github/scripts/regression-guard.js\`

GitHub PR preflight 会执行以上命令、正式数据只读排演和临时目录的两文件原子写入演练。