# 弱项状态同步服务部署

网站端已经接好事件触发同步：学习状态先立即保存在浏览器，停止操作约 10 秒后才发送一次；没有变化时不会轮询，也不会刷新页面。

## 1. 创建 Cloudflare Worker

在 Cloudflare Dashboard → Workers & Pages → Create Worker，使用仓库中的 `cloudflare/weakness-sync-worker.js` 作为 Worker 代码并部署。

## 2. 创建 KV

创建一个 Workers KV namespace，并在 Worker 的 Bindings 中绑定：

- Variable name: `WEAK_SYNC_KV`

Worker 会把浏览器刚上传的状态先缓存在 KV，避免每次做题都产生 GitHub commit。

## 3. Worker Secrets / Variables

Secrets：

- `GITHUB_TOKEN`：只给 `wenbubai2008-max/indonesian-learning` 仓库 Contents 读写权限的 fine-grained GitHub token
- `SYNC_KEY`：自己生成的一段长随机字符串，用于网站和 Worker 之间鉴权

Variables：

- `GITHUB_OWNER` = `wenbubai2008-max`
- `GITHUB_REPO` = `indonesian-learning`
- `GITHUB_BRANCH` = `main`
- `SYNC_FILE` = `data/weakness-sync.json`
- `ALLOWED_ORIGIN` = `https://wenbubai2008-max.github.io`

不要把 `GITHUB_TOKEN` 写进 GitHub Pages 或任何前端 JS。

## 4. 设置 Cron Trigger

给 Worker 增加 Cron Trigger：

`*/5 * * * *`

即每 5 分钟执行一次。只有 KV 中存在新变化时才会写 GitHub，没有变化不会产生 commit。

## 5. 网站端配置

部署 Worker 后，打开学习网站 → 弱项强化 → “学习状态同步” → “设置同步”。

依次填入：

1. Worker 地址，例如 `https://xxx.workers.dev`
2. 与 Worker 中相同的 `SYNC_KEY`

配置只保存在当前浏览器本机，不写入公开仓库。

## 同步行为

- 学习操作：立即写本机 `indo_weak_pool_v1`
- 连续操作：10 秒防抖合并成一次后台请求
- 无变化：不请求
- 断网：继续本机学习，恢复网络后补同步
- Worker：先写 KV
- GitHub：Cron 最多约 5 分钟后写入 `data/weakness-sync.json`
- “立即同步”：网站会调用 `/flush`，直接把当前 KV 状态写入 GitHub
- 多设备冲突：每个词按 `updated_at` 采用较新的状态

## 19:00 课程

后续生成 19:00 课程时应读取 `data/weakness-sync.json`，只选择 `status = active` 的弱项；`status = mastered` 的词不应继续作为弱项重复抓取。建议再结合最近 2–3 天冷却规则，避免连续重复同一个词。

## 2026-10-14 更新：训练进度跨设备同步（需要重新部署一次 Worker）

快速练习、听词训练、自动训练的复习级别和到期时间以前只存在当前浏览器里。新版 Worker 增加了 `/training` 接口，把这三份进度存进同一个 KV（键名 `training-state-v1`，不写 GitHub），各设备按“每个词最近一次练习时间较新的为准”合并。

更新步骤（约 2 分钟，不需要改任何设置）：

1. 打开 Cloudflare Dashboard → Workers & Pages → 你的同步 Worker → Edit code。
2. 用仓库中最新的 `cloudflare/weakness-sync-worker.js` 全文替换原代码，点 Deploy。
3. KV 绑定、Secrets、Variables、Cron 都保持不变。

网站端（`data/training-sync-client.js`）复用“弱项强化 → 学习状态同步”里已经填好的 Worker 地址和 SYNC_KEY，不用重新设置。Worker 更新前接口返回 404，网站端会安静地跳过，6 小时后再试，不影响原有的弱项同步。

更新后：每台设备打开网站约 2 秒后先拉取再上传；做题后约 10 秒合并上传一次；切到后台时也会上传。每台设备都要先在“设置同步”里填过地址和密钥。
