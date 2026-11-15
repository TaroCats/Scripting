# 定时器与调度

## 应该从哪里导入

| 形式 | 使用方式 | 返回值 |
| --- | --- | --- |
| 全局定时器 | 直接调用 `setTimeout/setInterval/clearTimeout/clearInterval`，无需导入 | 数字 ID |
| Node 回调形式 | 从内置 `node:timers`（或 `timers`）导入 | Timeout / Immediate handle |
| Node Promise 形式 | 从内置 `node:timers/promises` 导入 | Promise / 异步迭代器 |
| 微任务 | 全局 `process.nextTick` 和 `queueMicrotask`，无需导入 | 无可取消的 timer handle |

无需安装 npm 包，也不从 `scripting` 导入。 全局 `setImmediate/clearImmediate` 也由 Node 兼容层提供，使用 Immediate handle；示例显式导入它们以便说明来源。下面每个代码块都是独立、完整的 App 普通脚本；异步工作完成前不要调用 `Script.exit()`。`process`、`AbortController`、`console` 均为全局对象。

### 全局 interval

约输出三次 `tick`，在 `finally` 中用数字 ID 清除定时器。

```ts
// Global functions: no import and no npm installation.
const interval = setInterval((message: string) => console.log(message), 1000, "tick")
try {
  await new Promise<void>(resolve => setTimeout(resolve, 3200))
} finally {
  clearInterval(interval)
}
```

### Node handle 与微任务

被取消的回调不会执行，只输出两条微任务消息；不承诺 V8 专属的优先级顺序。

```ts
import { setTimeout as schedule, clearTimeout as cancel, setImmediate, clearImmediate } from "node:timers"
import { setTimeout as sleep } from "node:timers/promises"

const timeout = schedule(() => console.log("cancelled callback"), 1000)
cancel(timeout)
const immediate = setImmediate(() => console.log("cancelled immediate"))
clearImmediate(immediate)
process.nextTick((message: string) => console.log(message), "nextTick")
queueMicrotask(() => console.log("microtask"))
await sleep(20) // only nextTick and microtask messages are expected
```

### Promise 延时与异步 interval

输出三次 `tick` 后输出 `done`。break 会结束迭代器的定时器，finally 同时取消本例自己的 controller。

```ts
import { setTimeout as sleep, setInterval as ticks, scheduler } from "node:timers/promises"

async function main() {
  // AbortController and console are globals.
  await sleep(100)
  const controller = new AbortController()
  let count = 0
  try {
    for await (const value of ticks(100, "tick", { signal: controller.signal })) {
      console.log(value)
      if (++count === 3) break
    }
  } finally {
    controller.abort()
  }
  await scheduler.yield()
  console.log("done")
}

void main()
```

## 行为与迁移

全局 callback 必须为函数，不执行字符串。省略、非有限、负数、零或大于2147483647的 delay 按1毫秒处理，其他值截断为整数毫秒。clearTimeout/clearInterval 可交叉取消；回调在脚本队列执行，脚本退出会取消自有定时器。

`timers` / `node:timers` 返回 Timeout handle，支持 `close/refresh/ref/unref/hasRef` 和数字转换，clear 方法接受 handle 或数字 ID。`refresh` 重启仍有效或已到期的计时器；经该模块明确取消的 handle 不再重启。`setImmediate(callback,...args)` 返回可取消的 Immediate handle，交给 `clearImmediate` 清除。ref/unref 记录引用意图，不控制 App 进程寿命，也不能阻止 iOS 挂起。

`timers/promises` / `node:timers/promises` 提供 Promise 版 `setTimeout/setImmediate`、异步迭代 `setInterval`、`scheduler.wait/yield`。options 支持 signal/ref。abort 拒绝值为 `name: AbortError`、`code: ABORT_ERR`，cause 保留 signal.reason。迭代器 `return()` 将等待中的 next 完成为 done；throw/abort 拒绝等待并释放资源。未消费 tick 仅计数，不为每次 tick 分配排队值；最多1024个并行 next，计数超限也会明确报错。

`process.nextTick(callback,...args)` 和 `queueMicrotask(callback)` 使用 JavaScriptCore 的 Promise 微任务队列，并检查函数类型；不提供 V8 独立 nextTick 优先级队列。Immediate 在后续 timer turn 执行。

定时器不是实时钟。队列繁忙、iOS 后台挂起均可延迟回调或合并 interval tick，不会并发执行同一 interval。后台任务仍需使用 App 已有的后台能力。每个 context 最多4096个活动定时器，callback 最多1024个额外参数。

迁移：旧版全局定时器的兜底延迟为16毫秒，依赖该间隔的脚本请显式传入 `16`。setImmediate 的运行时返回值从数字改为声明中的 Node 风格 handle，直接传给 clearImmediate 即可；确需数字 token 时使用 Number(handle)。全局 setTimeout/setInterval 仍返回数字。

模块导入与支持范围总览：[Node API 兼容性](../node_compat/zh.md)。
