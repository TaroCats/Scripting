# MergeDL

aria2 + Cloudreve v4 下载推送，带 Safari 下载链接拦截。

## 功能

- 界面分为「推送 / 任务 / 设置」三个标签页；aria2 与 Cloudreve 配置都放在设置页。轮询状态由页面父组件统一持有，切换标签不中断。
- 推送页把渠道选择与链接输入放在一起：点击“推送”后弹出渠道选择，2 秒内不选则默认 aria2。选择 Cloudreve 时会再弹一层“默认目录 / 自定义目录…”，自定义目录打开同一套目录树选择器。上次选择的渠道会用于 Safari 拦截任务。
- 手动填写并测试 aria2 JSON-RPC 连接（地址 + rpc-secret）。
- 手动登录 Cloudreve v4（站点地址 + 邮箱 + 密码）；保存目录不再手输，改为下拉的懒加载目录树选择（`GET /api/v4/file?uri=cloudreve://my`）。
- Cloudreve v4 登录后保存 access / refresh 双令牌，页面打开期间每 30 秒检查，并在到期前 2 分钟自动刷新；401 时自动刷新后重试一次。令牌轮换后覆盖保存。
- 两种下载渠道按次选择：aria2 `aria2.addUri`，Cloudreve v4 `POST /api/v4/workflow/download` 离线下载。
- 实时进度：任务页按「aria2 任务 / Cloudreve v4 任务」分组显示；aria2 使用 `tellActive/tellWaiting/tellStopped`，Cloudreve 使用 `GET /api/v4/workflow?category=downloading|downloaded`，每 1.5 秒刷新。Cloudreve 任务根据 `summary.phase` 显示下载中、转存中、做种中、已完成等状态。
- Safari 拦截：默认脚本 `browser.js`（源码 `browser.tsx`，v1.2.0）捕获下载链接（含 `download` 属性、常见文件扩展名、magnet、`/download` 路径），在悬浮面板中选渠道后写入 GM 存储队列；App 页面打开时按该渠道推送。Safari 侧不保存任何账号或令牌。
- 页面中显示绿色悬浮球，点开后展开面板：顶部显示版本号 v1.2.0 与拦截状态。拦截链接或点击资源“选择”后，面板顶部出现“选择推送渠道”（aria2 / Cloudreve v4 / 取消）。资源按视频 / 音频 / 图片图标 / 压缩包 / 种子磁力 / 文档手风琴分类展示，可收缩展开，默认展开第一个有内容的分类。

## 使用前准备

1. aria2 需要开启 JSON-RPC，并允许来自 Scripting 的跨域请求（例如 `--rpc-allow-origin-all=*`，或通过反向代理配置 CORS）。否则 `fetch` 会失败。
2. Cloudreve v4 账号若开启两步验证或图形验证码，请使用 OAuth 应用授权方式；当前密码登录会在界面提示。
3. Safari 注入使用的是项目自带的 `browser.tsx`（应用会编译为默认的 `browser.js`），不是单独放到 userscripts 目录的文件。请在 Safari → Scripting 扩展弹窗中启用本项目的浏览器脚本，并在 Safari 设置 → 网站 → Scripting 扩展中允许“所有网站”（或目标网站）；在弹窗执行 “MergeDL：状态”，若显示“已加载 · 拦截中”说明注入成功。
4. 只能拦截网页里普通点击的 `<a>` 下载链接；长按链接后用 Safari 原生“下载链接”菜单无法被网页脚本拦截。

## 数据与安全

- RPC 地址、密钥、邮箱、双令牌保存在脚本独立 Keychain 域，不会写进 `script.json` 或日志。
- Safari 通过 GM 存储键 `mergedl.queue` 写入下载链接，App 从 `scripting-safari-extension/storages/*.json` 读取并清空；失败任务写回 JSONL 兼容队列。Safari 扩展禁止 FileManager 访问 App Group 目录，因此不再使用该路径。
- 退出登录调用 `DELETE /api/v4/session/token` 撤销 refresh token；网络不可用时仍会清除本地令牌。

## 真机验证清单

1. 设置页填写 aria2 地址与密钥 → 点“测试并保存连接”，确认提示成功；推送页输入 http/magnet 链接 → 点“推送”，测试手动选渠道与 2 秒不操作的默认 aria2，确认进度卡片出现并递增。
2. 设置页填写 Cloudreve v4 地址、邮箱、密码 → 登录；用“保存目录”下拉打开目录树选择目录；确认“令牌有效”提示，并在 Cloudreve 网页看到离线下载任务。
3. 等待令牌临近过期（或手动缩短 `access_expires`）观察自动刷新；确认刷新后仍可推送任务。
4. Safari 打开任意含下载链接的页面 → 点击链接 → 应看到 “已加入队列” 提示且页面不跳转；回到 MergeDL 页面，确认自动推送与“待推送 0 个”。
5. 在扩展弹窗测试“暂停/恢复拦截”和“查看待推送数量”两个菜单命令。

> 预览截图仅证明 UI 渲染；网络协议、令牌刷新、Safari 注入与权限需在真机按上述步骤验证。
