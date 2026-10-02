# V2 教学质量升级对比（2026-10-02）

本报告基于同一份学习上下文、相同正式词库/素材及相同 variant，使用 `compare-quality.js origin/main` 对比升级前的 V2 与本次升级版本。不是使用不同单词、不同日期来人为制造提升。

## 评估条件

- 固定 2026-10-01 AM/PM 两份上下文，分别生成 variant 0–5，合计 **12组配对课**。
- 两边选出的新词清单必须逐项相同；新旧课程均以原正式词汇规则为边界。
- 升级后逐份执行新增教学质量审计；正式课程规则由原 Validator 独立负责。
- 额外把合法新词候选列表调整成早晚各8种顺序；每组最多尝试6种 V2 变体，全部16组均有至少一份合格输出。
- 本报告的统计是自动可复现指标，不是母语教师的自然度评分。

## 同输入平均对比

| 可复现指标 | 升级前 | 升级后 | 说明 |
|---|---:|---:|---|
| 早课主动输出参考答案命中题目要求的新词 | 0 | **2** | 题目/参考答案从真实选中的两词联动生成 |
| 早课阅读覆盖新词 | 6 | **6** | 保留原覆盖约束 |
| 早课阅读印尼语词数 | 89.50 | 84.67 | 均符合80–120词范围 |
| 晚课对话生硬“Ngomong-ngomong”跳转 | 2 | **0** | 改成顺接上句的追问 |
| 晚课阅读覆盖新词 | 4 | **4** | 保留全部晚课新词覆盖 |
| 晚课阅读印尼语词数 | 84.67 | 88.00 | 均符合80–120词范围 |

## 对比示例：早课主动输出

**以前的任务**：用至少2个目标词，向朋友回应并提出建议。

**以前的参考答案**：`Saya paham kenapa kamu merasa begitu. Menurut saya, lebih baik dibicarakan pelan-pelan.`

问题：参考答案包含**0个**题目列出的目标新词，无法示范本题要求。

**升级后的任务**：遮住印尼语，分别用 `mundur` 和 `meledak` 表达“请稍微后退，让门能打开”“汽车轮胎突然在路上爆了”。可调整人物或时间。

**升级后的参考答案**：`Tolong mundur sedikit supaya pintunya bisa dibuka. Ban mobil itu tiba-tiba meledak di jalan.`

改善：题目要求与答案一一对应，确实使用2个目标新词，仍保留主动输出的空间。

## 对比示例：晚课真实对话

**以前**：问工作 → 午饭后回办公室 → 突然说 `Ngomong-ngomong` 问天气 → 乌云 → 再次 `Ngomong-ngomong` 问工作。

**升级后**：

- A: `Tadi bagaimana cuacanya?`
- B: `Awan gelap mulai terlihat sebelum hujan turun.`
- A: `Terus air hujannya mengalir ke mana?`
- B: `Air hujan mengalir ke selokan di depan rumah.`
- A: `Jadi, kamu tetap melanjutkan rencananya?`
- B: `Biarpun hujan, saya tetap pergi ke kantor.`

改善：使用相互联系的天气、雨水、原计划三轮问答，而不是反复生硬换话题。

## 阅读升级与边界

旧版可能给跨电线、身体恢复、天气与办公事项的一组素材套上“午餐”标题，且用同一篇看似连续的故事硬接独立例句。新版优先聚合同主题新词、按较少的日常生活大主题安排，必要时明确称为 `Beberapa catatan sehari-hari`（几则日常记录），不冒充一篇单线故事。还对 `membunuh` 与 `daya` 补充更自然、准确的例句及辨析，同步更新 microcontent 源文件和正式 bundle。

**局限**：V2仍是无需外部模型和密钥的确定性素材备用引擎；它能保障词汇、题目与答案一致，并减少明显话题拼接，但遇到任意六个互不相关的新词，不应宣称能自动写出与人工/ChatGPT精修一样流畅的单线短篇故事。此时分成清晰的生活记录更可靠。

## 测试与安全约束

- Prototype V2: **45项通过**，其中常规12个 AM/PM variant 均经正式 Validator 和质量校验。
- 16组合法词序压力组合：每组最多六个变体，均找到至少一份正式有效且质量审计通过的输出。
- 备用恢复专项测试：**26项通过**，含故意修改参考答案为目标词零命中时的拒绝验证。
- 回归检查：**822项通过，0警告、0失败**。
- 临时工作目录：课件＋index两文件写入演练通过，不接触正式日期已发布课程。
- ChatGPT/人工优先、08:05/18:05最早V2启动、无覆盖、无强推、原子发布等流程均未改变。

**复现**：在改动 PR 分支执行 `node prototype/lesson-engine/engine/compare-quality.js origin/main`，打印逐课原版和新版片段、上述指标及失败列表。数据以GitHub Actions实际运行结果为准。
