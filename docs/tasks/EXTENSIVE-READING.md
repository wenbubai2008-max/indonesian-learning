# 12:00 泛读任务说明书

先读 `docs/tasks/COMMON.md`（仓库访问、写入边界、失败处理、汇报诚实等共用规则），再按本文件执行。

## 〇、背景与约束

- 用户在学印尼语（A2+ → B1，目标是实用的日常印尼语，中文是工作语言）。每天 08:00 早课、18:00 晚课由另外两个 Claude 定时任务负责，本任务**不要碰课程**。
- 2026-10-08 起泛读由本任务生成（取代原来的 ChatGPT 任务），约 11:24 开始。用户的要求：**泛读要尽量复用“学过但还没掌握”的词，让同一个弱词隔几天在不同场景里反复出现**，同时仍然是基于真实、近期新闻改写的短文。规则来源：`data/learning-pool-rules.json` 的 `review_rotation.extensive_reading_recurrence`、`docs/REGRESSION-GUARD.md` §12。
- 每天只发一篇。分支 `extensive-reading-D`，候选文件 `data/extensive-reading-candidate.json`。
- 不得手动修改 `data/extensive-reading-data.js`、`data/extensive-reading-history.js` 或历史归档；不得自行合并 PR。

## 一、先确认远端状态（checkpoint，先恢复、后生成）

1. `git fetch origin main`，读取 main 上 `data/extensive-reading-data.js` 当前文章的 date。若已经等于 D：今天的泛读已发布。不要再生成第二篇；只核验 Pages 部署，并在汇报里说明是哪个 PR 发布的。
2. 检查是否已有 `extensive-reading-D` 分支或同名 PR：
   - 已有 open PR：不要重建，查看它对应的 `Sync daily vocab` 运行状态，从断点继续（见第九节）。
   - 只有分支、没有 PR，且分支上有完整候选：核对后用同一分支开 PR。
   - 分支存在但内容不完整：停止并如实报告，不要强推覆盖。
3. 只有确实没有今天的文章、分支和 PR，才进入生成。

## 二、必须先读的资料

`AGENTS.md`、`docs/REGRESSION-GUARD.md`（尤其 H 节和第 12 节）、`data/learning-pool-rules.json` 中 `review_rotation.extensive_reading_recurrence`、`.github/scripts/publish-extensive-reading-candidate.js`、`.github/scripts/fixtures/extensive-reading-sample.json`（新格式参考样稿，只参考结构，不复制内容），以及最近 7 篇泛读的标题和 category（当前文章在 `data/extensive-reading-data.js`，历史索引在 `data/extensive-reading-history.js`）。

## 三、选新闻（2026-11-19 起：题材多元、可轻松也可严肃）

- **来源必须真实、近期、可核实**：用网络搜索找印尼发生的新闻，`source_date` 必须在 D 当天或之前 **0–3 天**；优先 ANTARA、Kompas、Detik、Tempo、CNN Indonesia、可信的娱乐/体育/财经媒体或相关权威机构。必须打开原文核实关键事实，不把社交平台未经证实的传闻当新闻，不能编造搞笑事件。
- **不要再以政府公共服务新闻为默认选题**。把候选范围真正扩大为：①娱乐明星、电影、音乐、综艺、演出与流行文化；②经济商业、物价、消费、公司、就业和创业；③社会热点、真实人物经历、人情世故和有争议的社会现象；④科技、互联网、手机、社交平台；⑤体育、赛事、运动员；⑥趣闻、真实的搞笑事件、网络热门现象；⑦原有的生活、饮食、健康、教育、环境天气、旅游、交通、公共服务等。**轻松、有趣、荒诞但真实的新闻可以写；经济变化、社会问题、政策影响等严肃新闻也可以写**。不预先排除严肃话题，也不要因“新闻不够轻松”而一律回避。
- **必须先跨类别搜集，再选题**：每次先列 **4–6 条候选新闻，至少覆盖 3 个不同主类**；若近 3 篇偏向公共服务、交通、设施建设、政府活动或公告，本次优先娱乐、经济、社会、科技、体育或趣闻。阅读最近 7 篇的 title/category 后选择：**尽量不与最近 3 篇重复同一主类**，最近 7 天交通类仍最多 2 篇；连续两篇不要都写成政府公告或设施建设。以最近 6 篇尽量覆盖 4 种不同主类为多样性目标，不为凑类别选不真实或乏味的新闻。
- **兴趣与实际语言学习并重**：先选读者可能愿意读完、能讲出具体人物/事件/冲突/后果的一条，再与第四节的复习词候选匹配；不能因为某新闻容易塞进弱词就连续选择同类型公文题材。同等质量时，优先**更有意思、能引发聊天**的事件；轻松和严肃题材交替出现，不把幽默当作每篇的硬任务。
- **对严肃及娱乐新闻仍需客观**：对事件中的不同说法明确区分已证实事实、当事人观点和未知信息；不传未经证实的明星私生活八卦、不作无依据指控，不用灾难伤亡细节、犯罪暴力描写或恶意嘲笑作为噱头。可以讲社会问题、经济困难、争议政策及其普通人影响，语言保持 A2+→B1 的清楚易懂，不能为了搞笑改变事实。
- **选题自查**：写入候选前核对最近 7 篇的主类、所选新闻的主类及来源；如果最终仍选公共服务/交通/政府活动，必须有明显的新闻价值和不同于近几篇的角度。只在确实找不到可核实的其他近期新闻时例外，并在汇报中说明。

## 四、复习词（本任务的重点）

1. 运行 `node .github/scripts/reading-review.js --date D --count 40`。输出是按优先级排好的“学过但还没掌握”的词：tier=focus（最弱，最优先）> review > legacy > recurrence；`days_since_any_appearance` 是距上次在课程或泛读里出现的天数；`last_reading` 是它上次出现在哪篇泛读；`second_scene=true` 表示它适合换一个场景第二次出现；`oral=true` 是口语词；`too_recent=true` 的词最近 2 天泛读刚用过，尽量不用。
2. 从名单靠前的词里挑 **12–16 个**能自然放进这条新闻的词，**至少 4 个 tier=focus**（2026-10-15 起，原 8–12 个、至少 3 个）。优先排序靠前的词；若某词的 `last_reading` 场景和今天相同，尽量换别的词。`oral=true` 的词放进文末对话。
3. 只能用名单里的词作为复习词（check 模式会核对 runtime 词池）。词形要用对：可以带 -nya/-lah/-kah/-pun/-ku/-mu 后缀，但不要换成别的派生词（例如名单是 mengatur，正文写 diatur 不算）。
4. **自然度和事实优先**：不得为了塞词歪曲新闻事实、编造数字或写别扭的句子。放不自然的词就换掉，宁可少几个也不要硬凑。
5. 泛读复现只是被动接触，不计入核心复习、不影响任何复习资格和掌握状态。不要因此去改任何学习数据。

## 五、写候选 JSON（`data/extensive-reading-candidate.json`，一个 JSON 对象）

字段：

- `id`：`er-YYYYMMDD-英文小写短横线slug`；`date`：D
- `title`（印尼语）、`title_cn`（中文）
- `category`：统一用“主类 · 副类”格式；主类可选：日常生活、消费与物价、饮食、健康、交通出行、公共服务、工作与职场、教育、社区与社会、环境与天气、文化与休闲、**娱乐与人物、经济与商业、社会热点、科技与互联网、体育与赛事、趣闻与奇事**。主类体现新闻实际内容，不要把娱乐/经济/社会新闻统一记为“公共服务”或“日常生活”。
- `level`："A2+ → B1"；`minutes`：4 或 5
- `source_name`、`source_date`（YYYY-MM-DD，距 D 0–3 天）、`source_url`、`source_urls`（其他参考链接数组，可空）
- `text`：印尼语正文 **160–220 词**（按空白分词实际统计，建议 180–200），4 段，段与段之间空一行。用自己的话改写成 A2+→B1 难度：句子清楚、常用搭配、不逐句翻译或照抄原文（版权）。
- `cn`：中文翻译，段落与 text 一一对应（同样空行分段），意思准确完整。
- `hints`：8–15 个，给真正可能陌生的词或短语：`{term, cn, root?, formation?}`。**term 必须逐字出现在正文或对话里**（大小写可不同，网页按原文查找，对不上就不显示，2026-10-07 曾因此漏掉 2 个）。root/formation 要准确（meN-/peN-/ber-/ke-an/-an 的鼻音变化写清楚，规则见 `docs/LESSON-QUALITY.md` §2）。不要给复习词加 hint。
- `review_words`：12–16 个 `{word, cn}`，即第四节选定的复习词，每个都必须真的出现在正文或对话里；cn 写它在本文里的意思。
- `dialogue`：`{title, lines:[{speaker, text, cn}]}`，4–6 行（上限 8）。两个普通人（邻居、同事、朋友、家人）在日常场景里聊这条新闻，用自然的雅加达日常口语（aku/kamu、nggak、udah、aja 等，同一段对话人称和口语程度保持一致），每行不超过 30 词，逐行附中文。口语复习词优先放在这里。对话内容必须与正文事实一致。

## 六、第二遍审稿（写完后、校验前，必须真的动手改稿）

像挑剔的印尼语老师一样把全文、对话、hints、中文翻译通读一遍：

1. 每句印尼语是否是本地人真实会说的；有无中文直译痕迹、不自然的搭配、书面与口语混用。
2. 每个复习词是否用在**正确的意思和自然的搭配**里（例如 menegaskan 用于“强调/明确表示”，layak 用于“值得/合适”），用错或牵强就改句子或换词。
3. 事实核对：数字、地名、日期、机构与原新闻一致，没有编造；对话不与正文矛盾。
4. 中文翻译是否准确对应；hints 的词根和构词说明是否正确。
5. 记录改了哪些地方，汇报时写一行“第二遍审稿”结果。

## 七、校验（必须实际运行）

1. `node .github/scripts/publish-extensive-reading-candidate.js check --candidate data/extensive-reading-candidate.json --date D`
   必须 `status: ok`、无 errors。warnings（复习词不足 12、focus 不足 4、没有对话）应先修改稿件消除；确实无法自然做到时可以保留，但必须在汇报里说明原因。
2. `node .github/scripts/regression-guard.js` 必须通过。
3. 搭配黑名单（2026-10-14 起）：`node .github/scripts/check-collocations.js --candidate data/extensive-reading-candidate.json`。它对照用户点评里标出过的不自然搭配（`data/lesson-collocation-watchlist.json`），只警告、不阻断；有命中就改句子，改不了在汇报里说明。

任何失败先修改同一份尚未提交的稿件再重跑，不得修改校验脚本。

## 八、发布（唯一流程）

1. 从最新 origin/main 建本地分支 `extensive-reading-D`，只 `git add data/extensive-reading-candidate.json`，提交信息如 `Extensive reading candidate D`，**一次性** push（不要先推空分支，不要 force push）。
2. 用 REST 开 PR：base=main，head=`extensive-reading-D`，标题 `Publish extensive reading D`，正文必须单独有一行 `AUTO_PUBLISH_EXTENSIVE_READING=1`。
3. 不要自己合并。仓库 `sync-daily-vocab.yml` 的 `extensive_reading_release` job 会：校验、把昨天文章归档进历史、生成今天的 `data/extensive-reading-data.js`、删除候选文件、按 PR head SHA squash merge，并触发 Pages 部署。

## 九、发布后核验（轮询不超过约 30 分钟）

- 用 REST 查看该 PR 对应的 `Sync daily vocab` 运行。成功标志：PR `merged=true`；main 上 `data/extensive-reading-data.js` 的文章 id/date 是今天这篇；`data/extensive-reading-history.js` 新增了昨天的条目；随后 main 的 `pages build and deployment` 为 success。
- 若运行失败并提示 “Main advanced before reading merge”（main 在合并前前进了），用 `gh api --method POST repos/wenbubai2008-max/indonesian-learning/actions/runs/<run_id>/rerun` 重跑同一运行（它会基于最新 main 重新校验），最多 2 次；不要新建第二个分支或 PR。
- 其他失败：读取日志或注释中的 `EXTENSIVE_READING_RELEASE_ERROR`，若是稿件问题，可在**同一分支**提交修正后的候选文件（不重新选新闻、不换主题），最多一次；否则保留现场如实报告。
- 若最终没能发布，用 SendUserFile 把候选 JSON 发给用户，说明网站未更新。不得生成第二篇不同的文章。

## 十、汇报（简洁中文）

- 标题（印尼语 + 中文）、类别、新闻来源与日期、正文词数；简述本篇为什么值得读、与最近 3 篇有何主题区别（如按例外仍选政府/交通题材，说明原因）。
- 复习词列表，标出 focus/review/recurrence，以及哪些放在对话里；`check` 输出的覆盖情况和 warnings；搭配黑名单检查结果。
- 一行“第二遍审稿”：改了哪些句子、搭配、翻译或构词说明。
- PR 编号、合并 commit、Pages 状态；哪些是直接核验、哪些是间接核验。
- 失败时：失败阶段、原始错误、远端已完成到哪个 checkpoint、文章是否已发布、恢复需要什么。
