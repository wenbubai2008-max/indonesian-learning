# 词根家族库（独立只读学习资料）

`index.html` 动态读取同目录 `roots.json`，不要把词根数组重新写回 HTML。首页“词根家族”入口定义在 `../data/home-modules-layout.js`，五张卡首屏大小/顺序在 `../data/daily-width-fix.css`。没有新增定时任务或新的词汇掌握状态。

## 添加第 101 组及以后
在 `roots.json.families` 末尾增加一个对象，填写：
- `id`：稳定、唯一的词根标识，小写；
- `root`、`root_cn`：词根和中文核心义；
- `rank`：展示顺序序号；
- `forms`：`[{word,cn,formation,register}]`，register 只使用“口语”或“通用”；
- `recommended`：本组建议先理解的 1–2 个 forms.word；并非已掌握状态；
- `example`、`example_cn`：自然、口语优先的例句和译文。

总数和派生词数均从 JSON 自动计算，无需修改 HTML、增加批次或写死“100”。首页卡片标签仅显示“词根资料库”，也不会因新增资料而过期。只有确实值得推荐的词根，才手工补入本页 JS 的 `REC` 集合；其他词根照常在“全部”和搜索中出现。

## 与正式学习系统隔离
原附件每个派生词的静态 mastered/learning/new 已故意不导入，不能把“没在记录里”当作真正新词。此页面不读写 `daily-vocab-data.js`、`weakness-sync.json`、`learning-runtime.json`、`indo_mem`，不会替 977 主词库判断资格或掌握程度。收藏保存在本机 `indo_root_favorites_v1`，不跨设备。

添加/调整词根时，检查真实构词链，谨慎区别派生词、复合表达和非正式口语变体。资料源于用户提供的 Claude《印尼语词根家族 100》并作局部修订；不是经过独立频率排名验证的语料库。
