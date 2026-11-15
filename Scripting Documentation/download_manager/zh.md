# DownloadManager

`DownloadManager` 是主 App 脚本（`Script.env === "index"`、`"home_screen"` 或 `"camera_control"`）中的全局 HTTP/HTTPS 下载器，无须 import。各脚本的具名队列与任务相互隔离，可在下一次运行时重新连接。

```ts
const queue = await DownloadManager.open({ identifier: 'videos' })
const task = await queue.download({
  url: 'https://example.com/video.mp4',
  destination: FileManager.documentsDirectory + '/video.mp4',
  notifyOnFinished: { success: '下载完成', failure: '下载失败' }
})
task.onProgress = progress => console.log(progress.fractionCompleted)
task.onStateChange = snapshot => console.log(snapshot.state)
console.log(await task.waitUntilFinished())
```

`destination` 可省略，使用 App 托管的持久文件；指定时必须为本地绝对文件路径。发布文件时创建父目录，不覆盖已有文件。WebDAV 等虚拟远程位置不能作为本地下载目标。

## 模式与配置

| 能力 | `background`（默认） | `foreground` |
| --- | --- | --- |
| iOS 原生后台传输 | 支持 | App 进入后台时暂停 |
| 同时下载文件数 | 1–6 | 1–6 |
| 单文件并行 Range 请求 | 不支持 | 1–8，取决于服务器 |
| 平均有效数据限速 | 不支持 | 支持，要求 Range 及可靠资源校验标识 |
| 跨脚本运行恢复 | 支持 | 支持，重新连接后显式恢复 |
| 资源超时 | App 执行时检查 | 每次请求前检查剩余预算，请求同时受 URLSession 资源超时约束 |

后台模式由 iOS 调度，脚本退出后仍可下载。用户强制退出 App 后，后台传输要等再次打开 App 才能恢复。JS 回调只在所属脚本环境存活时运行。前台队列进入后台后暂停，不会自动切换模式或偷偷关闭限速。

```ts
const queue = await DownloadManager.open({
  identifier: 'large-files',
  mode: 'foreground',
  maxConcurrentTasks: 2,
  maxConnectionsPerTask: 4,
  chunkSize: 1024 * 1024,
  bytesPerSecond: 2 * 1024 * 1024,
  timeoutIntervalForRequest: 30,
  timeoutIntervalForResource: 3600,
  retry: { maxAttempts: 4, baseDelay: 1, maxDelay: 30 }
})
```

默认值：后台模式、3 个同时下载任务、每文件 1 个连接、分块 1 MiB、不限速（0）、请求超时 60 秒、活跃下载超时 86400 秒、禁止蜂窝网络、允许昂贵/受限网络、进度回调间隔 0.3 秒。分块范围 64 KiB–16 MiB，回调间隔范围 0.1–10 秒，非零速率至少为 1 字节/秒。

`open` 等待队列恢复；省略的选项采用原队列配置，显式不一致时报 `configurationConflict`，改用 `updateConfiguration`。更换模式、分块布局、连接数、网络策略、超时或限速前须暂停任务。并发任务数、回调间隔、重试策略可在运行时修改；已运行的前台传输保留当前传输配置，后续 attempt 使用新值。

每个 App 进程中，所有脚本合计最多打开 64 个不同队列。重复工作应复用 identifier。销毁 JS 句柄只解除该句柄的订阅，原生队列仍保留注册以继续已接受的下载。移除不用的任务并清理缓存可以回收内部传输文件；记录与已发布文件继续持久保存。取消任务会保留目标路径预约，直到移除该任务，以便安全地重新开始。

限速通过调度有界 Range 请求控制队列平均有效数据吞吐，允许每个活跃连接一个分块的突发，不是网络接口瞬时流量的硬上限。服务器不支持 Range 或缺少可靠标识时，限速任务明确失败；不限速任务可安全回退完整响应。iOS 可能复用连接，连接数表示并行 Range 请求数，不保证独立 TCP 连接数量。

## 队列方法

- `download(options)` 校验并持久化任务，然后自动排队。支持 `url`，以及可选的 `destination`、`headers`、`priority`（0–1，默认 0.5）、`checksum: { algorithm, checksum }`、`notifyOnFinished: { success, failure }`。
- `downloadMany(options[])` 最多 1000 项，先校验所有参数，再按输入顺序返回 `{ task, error }[]`。运行时冲突按项报告，不撤销其他成功任务。
- `getTasks()` 返回未移除的任务，包括成功、失败、取消记录。`getTask(id)`、`getTaskByURL(url)` 找不到时返回 `null`。
- `getSnapshot()` 返回配置、能力、任务/运行/成功/失败数量、总字节、已完成字节、速度和预计剩余秒数；未知总量/时间为 `null`。
- `resumeAll()`、`suspendAll()`、`cancelAll()`、`removeAll({ deleteFile?: boolean })` 返回逐项 `{ id, error }[]`。操作依次执行，不是原子事务。
- `reorder(ids)` 须包含每个未移除任务 id 各一次；调度先比较优先级，再使用列表顺序，不打断正在运行的任务。
- `getCacheInfo()` 返回托管文件总字节数与任务数量。`clearCache()` 只清理终态任务内部传输文件，保留记录和已发布文件；须先取消/移除未完成任务。
- `dispose()` 解除当前句柄及其回调，不取消已接受的下载；可重新 open 连接。

同一队列的 URL 对应一个未移除任务。参数完全相同会复用，参数不同报 `duplicateTaskConflict`。同一 URL 的不同凭据或目标副本可使用不同队列。目标文件路径也会跨队列检查冲突。

`queue.onProgress` 接收汇总快照，`queue.onStateChange` 接收发生变化的任务快照。`queue.onComplete` 在当前工作全部进入终态后触发，须检查 `failedCount` 和任务状态区分成功、失败、取消；暂停不算完成。绑定回调不会重放历史事件。

## 任务方法与快照

句柄提供稳定 `id`、`onProgress`、`onStateChange`、`onComplete`，以及：

- `getSnapshot()`：原始/最终 URL、HTTP 状态与响应头、文件路径/名称、状态、优先级、进度、attempt 次数、Unix 秒时间戳、可恢复性、分块、校验结果与错误。不会返回请求凭据，敏感响应头会被省略。
- `resume()`：恢复等待/暂停/失败任务；系统断点数据不可用时可能从头下载。`suspend()` 尽可能保留恢复数据。`cancel()` 清理未完成传输数据，不删除已发布文件。
- `restart()`：丢弃部分数据后重新下载；已成功任务须先显式移除并选择新目标/重新创建。
- `remove({ deleteFile?: boolean })`：删除内部传输数据，使记录从普通查询中移除。默认保留已发布文件；`deleteFile: true` 也只删除仍匹配本任务 SHA-256 所有权指纹的文件，避免误删后来替换的文件。
- `setPriority(value)`：修改队列调度优先级。`updateHeaders(headers)` 只允许暂停/失败/取消状态，修改会先丢弃旧断点数据，避免混用不同凭据对应的内容。
- `validateFile({ algorithm, checksum })`：验证完成文件，返回布尔值；文件访问错误 reject。支持 `md5`、`sha1`、`sha256`、`sha512`，完整性校验建议 SHA-256 或更强算法。
- `waitUntilFinished()`：成功时返回最终路径，等待期间可跨重试、暂停/恢复，最终失败/取消/移除时 reject；已完成任务立即读取结果，文件丢失也会报错。多个等待者相互独立。

进度字段为 `completedBytes`、`totalBytes`、`fractionCompleted`、`bytesPerSecond`、`estimatedTimeRemaining`；未知值为 `null`。重下资源时进度可能重置。`onStateChange` 接收快照，`onComplete(error, snapshot)` 在脚本存活期间对终态 attempt 触发一次；恢复后通过读取快照或等待结果补读，不依赖事件重放。

状态：`waiting`、`running`、`retrying`、`suspended`、`verifying`、`publishing`、`completed`、`failed`、`canceled`、`removed`。校验/发布期间拒绝控制操作并报告 `taskBusy`，应等待它完成。

```ts
const queue = await DownloadManager.open({ identifier: 'videos' })
for (const task of await queue.getTasks()) {
  const snapshot = await task.getSnapshot()
  console.log(task.id, snapshot.state, snapshot.destination)
  if (snapshot.state === 'suspended') await task.resume()
}
```

## HTTP、重试与恢复

只接受 HTTP(S)，URL 不允许内嵌账户密码或 fragment。请求头须合法；`Range`、`If-Range`、`Accept-Encoding`、`Host`、`Content-Length` 由下载器管理。前台跨 origin 重定向会移除自定义凭据并拒绝 HTTPS 降级；后台重定向/安全处理沿用原生 URLSession 行为。不提供绕过 TLS 证书验证的选项。

前台分段逐项验证 206、Content-Range、分段/总长度以及稳定的强 ETag（或相对 Date 足够早的 Last-Modified）。编码、区间或资源版本不匹配时不拼接。已确认分块保存 SHA-256，恢复时检查。最多允许 100000 个分块，大文件应增大分块尺寸。

重试默认最多 3 次（包括初次），指数退避 1–60 秒并加入 jitter，默认可重试 HTTP 408/429/500/502/503/504，遵守数字/日期形式的 Retry-After，最长一天。指定的临时传输错误可重试；认证、错误区间、参数、校验及本地文件错误不自动重试。前台资源预算在每次请求前检查，进行中的请求也受 URLSession 资源超时约束；这不是包含文件哈希/发布阶段的严格墙钟截止时间。App 被系统挂起时，后台重试时间和超时检查可能延后。错误包含 `code`、`message`、可选 `statusCode`、`retryable`、可选 `retryAfter`。

元数据和已确认分块保存在本地 Application Support。可选的预期校验通过、暂存文件持久化并发布到最终路径后才报告完成；崩溃发生在重命名与元数据提交之间时，用保存的指纹对账。用户删除 App 数据仍可能丢失文件。队列身份跟随脚本的原生存储/权限 scope，不承诺脚本改名或身份变更后自动迁移。
