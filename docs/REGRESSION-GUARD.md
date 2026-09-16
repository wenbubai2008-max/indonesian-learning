# Regression Guard / 回归保护清单

本文件记录这个项目已经真实发生过的问题，以及以后任何修改必须遵守的固定检查流程。目的不是“提醒一下”，而是把踩过的坑变成长期约束。

## 1. 当前架构与唯一真源

### 学习规则
- 权威规则：`data/learning-pool-rules.json`
- 主词库总数：977
- 新词池：`M ∩ A − D`
- 复习池：`A ∩ D`
- `daily-vocab` = 已正式教过，不等于 mastered
- mastered 只看 weakness 的 `status=mastered`

### 运行时词池
- 文件：`data/learning-runtime.json`
- 生成器：`.github/scripts/build-learning-runtime.js`
- 08:00 / 18:00 课程任务只通过 runtime 判断新词/复习资格
- 不允许课程任务直接读取大体积 weakness / daily-vocab 后重新计算资格

### daily-vocab 写入
- 唯一 writer：`.github/workflows/sync-daily-vocab.yml`
- 不允许第二个 PM writer、临时 writer 或课程任务自己整文件覆盖

### 当前课程时间
- AM：08:00
- PM：18:00
- PM 切换日期：`2026-09-16`
- `2026-09-15` 及以前历史 PM 仍属于 19:00，不得批量改成 18:00
- 20:00 补漏任务已于 `2026-09-16` 关闭；正式学习任务只保留 08:00、12:00、18:00

## 2. 已发生过的错误，禁止再次出现

### A. 修一个问题时删弱课程要求
发生过：为了缩短 19:00 提示词，把详细词卡、dialogue、rewrite、中文提示等要求删弱，导致课程退化。

以后：
- UI、时间、部署问题不得顺手修改 `am_contract` / `pm_contract`
- PM 详细度不得低于 2026-09-14 标准
- `formation`、`synonym_note`、`root_cn`、08:00复现标记、阅读、对话、rewrite/application、6题测试+self_check、final review 均属于固定合同

### B. 大文件被连接器截断后误判“不能写”
发生过：任务读取 `daily-vocab-data.js` 被截断，又因为 update_file 是整文件替换，主动停止甚至暂停任务。

以后：
- ChatGPT 自动课程不直接写 daily-vocab
- GitHub Runner 在仓库内完整读取并同步
- 课程任务只写 AM/PM JSON + index

### C. weakness 结构解析错误
发生过：对 `{version, updated_at, words}` 顶层直接 `Object.values(parsed)`。

以后：
- weakness 解析只在 GitHub Runner builder 中完成
- 课程任务不自行解析完整 weakness

### D. 全局 MutationObserver 导致首页卡顿
发生过：为了把 19:00 改成 18:00，监听整个 document + characterData，再反复修改 DOM，导致刷新/首页卡顿。

以后：
- 禁止为静态时间、文字、卡片布局增加 whole-page / character-data observer
- observer 只能用于非常局部且不可避免的动态节点，而且不得在回调中制造同类 DOM 变化循环
- `data/vocab-dom-compat.js` 不得再增加全页面 MutationObserver

### E. FOUC：刷新先看到旧长卡，再变成新卡
发生过：HTML 首屏按旧两列大卡渲染，JS 后加载再改成 6 个小卡。

以后：
- 首屏关键布局必须在页面早期加载 CSS 中已有最终形态
- 不允许“旧布局 first paint → JS transform → 最终布局”
- 当前首屏关键 CSS 在 `data/daily-width-fix.css`

### F. 卡片顺序在刷新时交换
发生过：原始 HTML 顺序与 JS 最终顺序不同。

最终顺序固定为：
1. 词汇学习
2. 泛读
3. 快速练习
4. 弱项强化
5. 前后缀
6. 难点解释

`daily-width-fix.css`、`home-modules-layout.js` 以及任何备用稳定脚本的顺序必须一致。

### G. 改时间牵连布局/逻辑
发生过：用户只要求 19→18，却通过运行后 DOM patch 带来卡顿、闪烁和卡片变化。

以后采用“范围锁”：
- 只改时间 = 只改 schedule / time contract / 必要显示兼容
- 不动学习卡结构、不动词池、不动课程详细度、不重构无关代码
- PM 页面时间必须按日期判断：`2026-09-16` 起 18:00，之前历史 19:00

### H. 临时 workflow 污染仓库
发生过：补课/审计过程中创建大量一次性 Actions workflow，导致噪声与潜在竞争。

以后 `.github/workflows` 长期只保留必要 workflow。当前应只有：
- `build-learning-runtime.yml`
- `sync-daily-vocab.yml`

任何新增 workflow 必须有长期必要性，不能只是一次性修复手段。

### I. 课程规则写对了，但实际 JSON Schema 仍写错
发生过：`2026-09-16` 18:00 晚课内容本身正确，但 3 道 choice 漏写 `answer_index`，导致网页把正确答案判成红色；同一份课还一度把 `review.steps` 写成 `review.items`，self_check 前端也曾不显示。

以后：
- 不允许只检查 `learning-pool-rules.json` 里的“规则文字正确”
- `.github/scripts/regression-guard.js` 必须直接读取最新 PM JSON 做实际结构校验
- 3 个 choice 必须逐题校验 `answer_index` 是有效整数，并且若同时有 `answer`，两者必须指向同一个答案
- 2 个 fill 必须有同行中文提示、answer、explain
- 1 个 order 必须有完整中文 prompt、5–8 个 tokens、answer、answer_cn、explain
- `daily_test.self_check` 必须是非空字符串数组
- final review 固定 `{title, steps:[...]}`
- 前端保留 legacy fallback 只是容错，不能代替标准 JSON Schema

## 3. 每次修改前：Preflight

修改前必须回答：

1. 用户到底要求改什么？哪些明确不能动？
2. 这个东西的 source of truth 在哪里？
3. 有没有第二个文件/脚本在运行后覆盖它？
4. 是否存在历史兼容要求？
5. 搜索相关关键词后，影响面有哪些？

### 常见影响面搜索
改 PM 时间时至少检查：
- `19:00`
- `18:00`
- `晚间学习`
- `loadReading('pm')`
- `PM_SWITCH_DATE`
- `scheduled_time`
- `history-v2.js`
- `daily-ui-polish.js`
- `vocab-dom-compat.js`

改晚课内容时至少检查：
- `learning-pool-rules.json`
- `learning-runtime.json`
- 18点自动任务 prompt
- PM 渲染脚本
- 最新 `data/daily/YYYY-MM-DD-pm.json`
- `regression-guard.js` 对真实课程文件的检查

改首页卡片时至少检查：
- `index.html`
- `data/daily-width-fix.css`
- `data/home-modules-layout.js`
- `data/home-modules-stability.js`
- `data/vocab-dom-compat.js`

## 4. 每次修改后：固定回归检查

### A. 数据/词池
- [ ] `rules.version == 4`
- [ ] `runtime.version == 4`
- [ ] `runtime.rules_version == 4`
- [ ] `runtime.stats.master_unique == 977`
- [ ] 新词公式仍是 `M ∩ A − D`
- [ ] 复习公式仍是 `A ∩ D`
- [ ] mastered 不进入 new / focus review / PM application
- [ ] daily-vocab 仍只表示 taught

### B. 08:00
- [ ] 恰好10个新词
- [ ] 合法时优先2个口语新词
- [ ] 约5个 review recurrence
- [ ] 5句
- [ ] 80–120词阅读
- [ ] 3题 quiz
- [ ] active output
- [ ] final review 3个重点

### C. 18:00
- [ ] 10–12核心词
- [ ] 3–4 new
- [ ] 4–5 review
- [ ] 2–3 application
- [ ] 三组无交集
- [ ] mastered_hits=0
- [ ] 口语比例规则未被删
- [ ] cooling / 自动化价值未被删
- [ ] 词卡保持 2026-09-14 详细度
- [ ] 当天 AM application 显示“今天08:00已教”
- [ ] reading 80–120 + 中文
- [ ] dialogue 存在且逐句中文
- [ ] rewrite/application 3–4项
- [ ] daily_test = 3 choice + 2 fill + 1 order
- [ ] 3 个 choice 的 `answer_index` 都有效；如果同时有 `answer` 必须一致
- [ ] fill 同行有括号中文提示
- [ ] order 有完整中文 + 5–8 tokens + answer + answer_cn
- [ ] self_check 存在
- [ ] final review 使用 `review.steps`
- [ ] 最新真实 PM JSON 通过 regression guard，而不是只看规则文件

### D. 首页/UI
- [ ] 首次打开不卡
- [ ] 连续刷新不卡
- [ ] 不出现旧长条卡片闪一下再变形
- [ ] 卡片顺序不交换
- [ ] 6张卡尺寸/颜色不跳
- [ ] 桌面宽屏是6列
- [ ] 中等屏3列
- [ ] 手机2列/窄屏1列按现有规则
- [ ] 首页显示 08:00 / 18:00
- [ ] 今日 PM 卡显示18:00
- [ ] 今日 PM 短文入口显示18:00
- [ ] 今日 PM 课程导航/标签/完成提示显示18:00
- [ ] 2026-09-15及以前历史PM仍显示19:00
- [ ] 正确答案绿色；错误选择红色且同时标出正确答案

### E. 自动任务/Actions
- [ ] 08:00 task enabled
- [ ] 12:00 task enabled
- [ ] 18:00 task enabled
- [ ] 20:00补漏保持 disabled，除非用户明确重新开启
- [ ] 任务失败不得自动把正式任务 disabled
- [ ] `.github/workflows` 没有临时/重复 workflow
- [ ] `sync-daily-vocab.yml` 是唯一 daily-vocab writer
- [ ] 同步后 runtime 在同一链路重建

### F. 部署
- [ ] GitHub Pages 最新部署 success
- [ ] 强刷后显示新版本
- [ ] 不只检查最终静态截图，还要检查“刷新过程”

## 5. 修改协议

以后每次修改按这个顺序：

1. 读取本文件 + `learning-pool-rules.json`
2. 做全局影响面搜索
3. 记录本次 scope lock
4. 只改最小 source-of-truth
5. 不顺手重构
6. 运行 `node .github/scripts/regression-guard.js`
7. 看 diff 是否超出范围
8. UI 改动等待 Pages success
9. 手动做刷新/首屏检查
10. 确认后再告诉用户“已完成”

如果第6–9步没有完成，不应说“已经全部没问题”。

## 6. 已知技术债务

当前 `index.html` 仍保留少量历史 `19:00` 静态字面值，现代页面通过轻量、无全局 observer 的兼容层把当前首页/当前PM短文入口显示为18:00。未来安全整理 `index.html` 时：

- 应直接把当前首页/当前PM静态默认值迁移到18:00
- 同时保留 `2026-09-16` 前历史PM=19:00 的日期兼容
- 完成后应进一步删减兼容补丁，而不是增加新的全局 observer

在这项迁移完成前，不要为了消除字面值而再次增加运行后全页面重写逻辑。
