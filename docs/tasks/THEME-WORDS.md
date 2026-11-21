# 主题新词表起草（每周日上午，Claude 定时任务）

用户决定（2026-11-21）：复习阶段每个主题周配一张场景高频、但用户没学过的词表 `data/theme-words.json`，每节课由 runtime 放出 2 个（规则见 `docs/tasks/REVIEW-PHASE.md` 第四节「主题新词」）。本任务每周日上午起草**下周**的词表。

先读 `docs/tasks/COMMON.md` 第 1 节（身份、日期、仓库与 REST 用法）。本任务不碰课程、泛读、runtime、weakness 和 daily-vocab。

## 步骤

1. `D = TZ=Asia/Jakarta date +%F`，`N` = D 之后的那个周一。运行 `node .github/scripts/review-phase.js --date N --session am`，取 `plan.theme_id`、`plan.theme_cn`、`plan.scenes`、`plan.functions`。`active` 不是 true 就只汇报“复习阶段未开启”，结束。
2. `data/theme-words.json` 里已有 `start_date = N` 的周：只汇报已存在，结束（不重复起草，不改用户删过的表）。
3. 起草 16 个左右候选：这个主题的场景里印尼人日常真说的词或短语（口语里直接用的英语借词也算，比如 refund、COD），`formal` 填正式说法（没有就空），`cn` 写简短中文，`note` 写一句真实用法例句或场景提示（中文 + 印尼语短句）。不要冷僻书面词，不要人名地名，A2–B1 能用得上。
4. **和学过的词逐个比对**：用 `data/daily-vocab-data.js`（已教）、`data/weakness-sync.json`（`status=mastered` 的是已会）、`data/master-vocab-data*.js` 和 `data/master-vocab-secondary.js`（词库词）检查，凡是已教、已掌握或在词库里的都删掉；同时去掉和更早周词表重复的词。剩下不足 10 个就再补候选重比对，最多 16 个。
5. 在分支 `theme-words-N` 上只改 `data/theme-words.json`：追加 `{"theme_id", "start_date": N, "approved": true, "approved_note": "D 起草，用户可在周一早课前划掉", "words": [...]}`，跑 `node .github/scripts/test-theme-word-pool.js` 和 `node .github/scripts/regression-guard.js`，通过后开 PR 并自己合并（用户已授权合并，不要让用户手动合并）。
6. 向用户汇报（简洁中文，这条汇报就是给用户看的词表）：下周主题；每行一个词：印尼语 —— 中文（正式说法）；最后一句“不需要的词告诉我，周一早课前删掉”。

失败时：不要动其他文件，不要开第二个 PR，说明卡在哪一步。
