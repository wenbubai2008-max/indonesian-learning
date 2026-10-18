# 本机存储键清单（localStorage）

网站是纯静态页面，用户的学习记录**只存在各自浏览器的 localStorage 里**（弱项池和三个训练进度另外可以通过"学习状态同步"备份到 Cloudflare Worker）。所以这些键是**用户数据的格式契约**。

## 硬规则

1. **不得给任何已有键改名，也不得改变它的格式。** 否则用户手机和电脑上已有的学习记录会"消失"（读不到）。
2. 需要改格式时：新增一个带版本号的新键（如 `_v2`），读取时先读新键，没有就从旧键迁移，**保留旧键**（`indo_vocab_profile_evidence_v1` → `_v2` 就是这样做的）。
3. 代码里新增 `indo_*` 键时，必须同时登记到本文档（`regression-guard.js` 会检查：出现未登记的 `indo_*` 键就失败）。
4. `indo_weak_sync_config_v1` 里有同步密钥（SYNC_KEY），属于机密：不得写日志、不得进截图、不得提交到仓库。
5. 单个键过大会拖慢页面：弱项池和它的同步影子各约 0.8 MB（真实设备实测），每次整体读写都有成本；新增高频写入的键要先评估体积。

下表的"格式"只写能从代码直接确认的顶层结构；各记录内部的全部字段以"写入方"文件为准。

## 一、弱项池与云同步

| 键 | 用途 | 格式 | 写入 | 读取 |
|---|---|---|---|---|
| `indo_weak_pool_v1` | **弱项池（主数据）**：每个词的状态（active / mastered）、原因（reasons）、答错次数、最近复习时间等。与仓库 `data/weakness-sync.json` 的 `words` 同构 | 对象：小写单词 → 记录（`word`、`status`、`reasons[]`、`wrong_count`、`right_streak`、`last_wrong`、`last_review`、`last_mastered`、`updated_at`…） | `weakness-pool.js`（`save()`；批量导入用 `importRecords`） | 几乎所有模块通过 `window.WeaknessPool` 读取 |
| `indo_weak_sync_shadow_v1` | 云同步的"上次同步时的快照"，用来判断本机有哪些词变了 | 对象：小写单词 → 该词记录的签名字符串 | `weakness-sync-client.js` | 同左；丢失后会由 `refreshShadow()` 重新生成 |
| `indo_weak_sync_meta_v1` | 每个词的最后修改时间，用于云端/本机冲突时"新的覆盖旧的" | 对象：小写单词 → `{updated_at: ISO 时间}` | `weakness-sync-client.js` | 同左 |
| `indo_weak_sync_config_v1` | 同步服务地址和密钥（**机密**） | 对象：`{endpoint, key}` | `weakness-sync-client.js`（`configure`）、`sync-device-setup.js`（扫码设置） | `weakness-sync-client.js`、`training-sync-client.js`、`sync-device-setup.js`（生成二维码） |
| `indo_weak_sync_device_v1` | 本设备编号 | 字符串 | `weakness-sync-client.js` | `weakness-sync-client.js`、`training-sync-client.js` |
| `indo_training_sync_meta_v1` | 三个训练进度的同步进度（已推送到哪个时间、服务端是否支持） | 对象：`{pushed: {quick, listen, auto, recall: 毫秒时间戳}, last_push, unsupported_until, recall_supported: 服务端 GET /training 是否返回 modes.recall}` | `training-sync-client.js`（`sync-device-setup.js` 也会引用） | 同左 |
| `indo_weakness_dismissed` | 旧版"已掌握/忽略"记录，现在仍参与弱项池导入时的状态一致化 | 对象：小写单词 → `{word, at: 毫秒时间戳}` | `weakness-dismiss.js`、`weakness-pool.js` | 同左 |
| `indo_weak_manual_pause_v1` | 在"弱项强化"里手动暂停的词 | 对象：小写单词 → `true` | `weakness-paging-roots.js` | 同左 |
| `indo_unknown_words` | 旧版"陌生词"列表（阅读里点词加入），启动时迁移进弱项池 | 对象：小写单词 → `{word, cn, times_seen, last_seen…}` | `reading-word-lookup.js`、`vocab-controller-20260917.js` | `weakness-pool.js`（迁移）、`home-learning-upgrade-v2.js`、`weakness-dismiss.js` |

## 二、三个训练的进度（会通过训练同步在设备间合并，"最新时间的记录覆盖旧的"）

| 键 | 用途 | 格式 | 写入 | 读取 |
|---|---|---|---|---|
| `indo_quick_practice_state` | 快速练习的每词记录 | 对象：单词 → 记录（同步用字段 `last`） | `home-learning-upgrade-v2.js` | `automation-training.js`、`vocab-study-coach.js`、`training-sync-client.js`、`weakness-paging-roots.js` 等 |
| `indo_listen_stats_v1` | 听词训练的每词记录 | 对象：单词 → 记录（同步用字段 `last_at`） | `listening-word-training.js` | 同左、`vocab-study-coach.js`、`training-sync-client.js` |
| `indo_automation_training_state_v1` | 自动训练（主动提取）的每词记录 | 对象：单词 → 记录（同步用字段 `last_at`） | `automation-training.js` | 同左、`vocab-study-coach.js`、`training-sync-client.js` |
| `indo_listen_daily_v1` | 听词训练每天的统计 | 对象：雅加达日期 `YYYY-MM-DD` → `{attempts, correct, fast}` | `listening-word-training.js` | 同左 |
| `indo_automation_training_plan_v1` | 自动训练当天的计划 | 对象（细节见代码） | `automation-training.js` | 同左 |

## 三、学习教练与词汇画像

| 键 | 用途 | 格式 | 写入 | 读取 |
|---|---|---|---|---|
| `indo_vocab_coach_daily_session_v1` | 今天的统一训练清单及完成情况 | 对象：`{version: 2, day: 'YYYY-MM-DD', items: [{mode, word…}], done: {}}` | `vocab-study-coach.js` | 同左 |
| `indo_vocab_coach_verify_requests_v1` | "再验证一次"的请求 | 对象：单词 → `{requested_at: ISO 时间, due_at: 毫秒时间戳}` | `vocab-study-coach.js` | 同左 |
| `indo_lesson_focus_v1` | 打开过的课程的“今天的重点”词（只用于课末回想排序） | 对象：`{version: 1, lessons: {'YYYY-MM-DD-am': {words: [3 个词], at: ISO 时间}}}`，保留最近 14 节 | `lesson-end-recall.js`（只读，重点词排前，资格规则不变） | `history-v2.js`（渲染带 lesson_focus 的课程时写入） |
| `indo_lesson_recall_v1` | 课末主动回想（自评，不算训练通过、不计入掌握、不改到期、不写课程错题） | 对象：`{version: 1, words: {单词(小写): {day, result: 'fail' / 'slow' / 'fast', at: ISO 时间, lesson: 'YYYY-MM-DD-am', hist: [{day, result, at, lesson}]（每天一条，最多 20 条）}}, lessons: {'YYYY-MM-DD-am': {words: [{word, cn, group}], created_at}}（最近 10 节课的选词，刷新不变）}`。每词每天只算第一次作答；跨设备合并时同一天取最早的那次 | `vocab-study-coach.js`（只读，调整快速练习/自动训练的新词顺序）、`training-sync-client.js`（同步 words） | `lesson-end-recall.js`；`training-sync-client.js`（合并其他设备的记录） |
| `indo_vocab_skill_rounds_v1` | 三种训练各自当天的一轮词表 | 对象：模式（quick / listen / auto）→ `{version: 1, day, items: [单词], done: {单词: true}}` | `vocab-study-coach.js` | 同左 |
| `indo_vocab_profile_evidence_v2` | 词汇画像用的本机答题证据（只保留最近若干条） | 数组（细节见代码） | `vocab-profile-evidence.js` | 同左、`vocab-profile-ui.js` |
| `indo_vocab_profile_evidence_v1` | 上面的旧版本；**保留**，仅用于迁移 | 数组 | （不再写入） | `vocab-profile-evidence.js`（迁移） |
| `indo_vocab_profile_longterm_v1` | 画像的长期记忆汇总（超过证据条数上限后仍保留的统计） | 对象（细节见代码） | `vocab-profile-evidence.js` | 同左 |

## 四、词库学习标记

| 键 | 用途 | 格式 | 写入 | 读取 |
|---|---|---|---|---|
| `indo_mem` | 主词库（977）的"认识/模糊/不会"标记 | 对象：单词 → 标记字符串（含 `'know'`） | `vocab-controller-20260917.js` 等词库页 | `automation-training.js`、`home-learning-upgrade-v2.js`、`extensive-reading-history-ui.js`、`weakness-pool.js`（迁移）等 |
| `indo_bipa_mem_<级别>` | BIPA 各级别（`A1` / `A2` / `B1` / `B2`）的同类标记，**键名由代码拼接**（`'indo_bipa_mem_'+级别`） | 同 `indo_mem` | `vocab-controller-20260917.js` | 同左、`bipa-secondary-seed-20260917.js` |

注意：文本搜索看不到完整键名，`indo_bipa_mem_A1` 等是运行时拼出来的；上面文件里的 `indo_bipa_mem_` 就是它们的前缀。

## 五、阅读与其他页面

| 键 | 用途 | 格式 | 写入 | 读取 |
|---|---|---|---|---|
| `indo_translate_cache_v2` | 阅读点词的翻译缓存（最多保留 400 条，超出时删最旧的） | 对象：原文 → `{zh, at: 毫秒时间戳}` | `reading-word-lookup.js` | 同左 |
| `indo_weak_example_translate_queue_v1` | 弱项例句等待翻译的队列 | 对象：`小写单词|句子哈希` → 队列项（细节见代码） | `reading-word-lookup.js` | 同左 |
| `indo_weak_example_translate_seed_v2` | "已把弱项例句加入翻译队列"的一次性标记 | 字符串 `'1'` | `reading-word-lookup.js` | 同左 |
| `indo_root_favorites_v1` | 词根家族页的收藏 | 数组：字符串 | `root-families/index.html`（独立页面，同一域名共用存储） | 同左 |

## 附：没有 `indo_` 前缀的键

| 键 | 用途 | 写入 / 读取 |
|---|---|---|
| `done_<日期>_am` / `done_<日期>_pm` | 某天早课 / 晚课是否完成（值为 `'1'`） | 写入：`index.html`（`completeSession`）、`daily-ui-polish.js`；读取：`daily-ui-polish.js`、`automation-training.js` |
| `daily_light_self_<题目标识>` | 课程小测里自我核对按钮的选择 | `daily-light-test.js` |
| `vocab_view_mode` | 词库页当前的"已认识 / 复习"视图（空则无） | `vocab-controller-20260917.js` |
| `master_core_count_v1`、`master_top1000_weak_merge_result`、`master_top1000_weak_added_count` | 主词库与弱项合并的内部结果/计数 | `master-top1000-weak-merge.js` |
| `selected_vocab_library`、`vocab_progress_master` | 旧版词库选择/进度；目前只有未加载的旧脚本引用（`master-library-patch.js`、`master-vocab-integration.js`），运行时不读写 | （死代码，见前端整理 PR #138） |
