# BackgroundKeeper

`BackgroundKeeper` 是 Scripting 主 App（`Script.env === "index"`、`"home_screen"` 或 `"camera_control"`）注入的全局对象，**无需 import，也无需安装 Node 包**。应在脚本前台运行、开始后台任务之前申请，工作结束后释放。

它使用 App 共享的后台音频资源。iOS 仍可能中断音频、挂起或终止 App。保活活动不代表网络会话健康，也不保证锁屏后定时器或 TCP 请求无限执行。

## API

- `await BackgroundKeeper.keepAlive(): boolean`：音频引擎和播放器实际运行才返回 `true`。音频启动/恢复失败返回 `false`，访问失败会 reject，两种情况均需处理。同一脚本重复成功申请是幂等的，不累加请求次数。
- `await BackgroundKeeper.isActive: boolean`：读取 **App 共享音频的实际活动状态**，不表示当前脚本拥有请求。中断或引擎停止时为 `false`。
- `await BackgroundKeeper.getState(): BackgroundKeeper.State`：读取包含 `status`、`isActive`、`requested`、`lastFailure` 的快照。
- `await BackgroundKeeper.stopKeepAlive(): void`：释放当前脚本的请求，其他持有者可继续保活。脚本退出也会释放请求。

`status`：没有引擎或请求时为 `idle`；音频运行时为 `active`；音频中断期间为 `interrupted`；仍有资源/请求但音频未运行时为 `inactive`。`requested` 仅表示**当前脚本**拥有一次成功申请，中断期间仍可能为 `true`。`lastFailure` 为 `null` 或固定原因：`audio-session-failed`、`audio-start-failed`、`audio-restart-failed`、`audio-state-failed`、`audio-interrupted`、`resume-not-permitted`。重试成功或最后一个请求释放后清空。

自动恢复遵循系统音频中断策略。系统不允许自动恢复时，检查状态，在合适时机显式重试；不要无界高频轮询。

## 完整示例

仅使用全局 API，可直接放入 App 脚本的 `index.ts`。

```ts
async function run() {
  let acquired = false
  try {
    acquired = await BackgroundKeeper.keepAlive()
    if (!acquired) {
      console.log("保活不可用", await BackgroundKeeper.getState())
      return
    }
    console.log("保活状态", await BackgroundKeeper.getState())
    // 用实际任务替换这段有界等待，并处理任务自身的失败。
    await new Promise<void>(resolve => setTimeout(resolve, 10000))
  } catch (error) {
    console.error("后台任务无法继续", error)
  } finally {
    if (acquired) await BackgroundKeeper.stopKeepAlive()
  }
}
void run()
```

后台音频会耗电，应按需使用。网络任务还需检查实际回复和会话错误。连接失败后应建立新连接；保活无法复活已经失效的连接。
