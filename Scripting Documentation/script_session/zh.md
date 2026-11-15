# 脚本服务与主会话通信

`ScriptSession` 是全局 API，无需导入。App 内不同脚本之间使用 `serve/call`；同一脚本的不同入口与扩展继续使用下方的 `register/request`。

## 提供公开脚本服务

脚本 A 在 `index.tsx` 中注册唯一回调后，可以正常结束入口代码的求值，继续等待消息；无需挂起一个永不结束的 Promise，也不需要 UI 或最小化。

```ts
// 脚本 A：index.tsx，无需导入。
ScriptSession.serve(async (message, request) => {
  if (!message || typeof message !== "object" || Array.isArray(message)
      || message.command !== "status") {
    throw Error("Unknown command")
  }
  return { running: true, caller: request.caller.name }
})
```

```ts
// 脚本 B：index.tsx，无需导入。
async function main() {
  const status = await ScriptSession.call<{ running: boolean; caller: string }>({
    name: "A", message: { command: "status" }, timeout: 30000,
  })
  console.log(status.running)
}
void main()
```

调用 `serve` 就表示向其他脚本开放服务，无需调用者名单。回调应验证命令和参数。`request.id` 标识本次请求；`request.caller.name` 与 `env` 来自原生调用上下文。若同脚本扩展通过既有 IPC 路径向此服务请求，`caller.env` 为空字符串，因为该路径不传递入口环境。return 或 Promise resolve 只完成本次调用，不退出 A 或释放其资源；`undefined` 转为 `null`，throw 只拒绝本次调用。

**每个脚本身份只有一个回调**，与 `register` 共用槽位。重复调用 `serve` 或 `register` 抛出 `SCRIPT_SESSION_BUSY`，不会隐式覆盖。`serve` 返回注册 ID；`ScriptSession.unregister(id)` 注销回调但不退出脚本。已接收但尚未结束的回调需先完成，才能注册替代回调。`Script.exit()` 仍会真正退出并释放资源。

## 复用、冷启动与期限

`call({name,message,timeout?})` 调用 App 主进程中的 JavaScript 脚本：

- 已有就绪服务则直接传入消息，不自动恢复 UI，也不触发 `Script.onResume`。服务继续使用自身权限，不再进行启动确认。
- 脚本已运行但未注册服务，立即以 `SCRIPT_SESSION_SERVER_NOT_REGISTERED` 拒绝，不再创建实例。
- 脚本没有运行实例时，Scripting 按与 `Script.run()` 相同的调用决定处理启动。允许启动后，新服务在该实例存续期间可使用已获准的脚本权限，并申请尚未决定的权限。以无权限方式启动的实例在存续期间一直受限。服务启动后最多有 10 秒调用 `serve`。应先注册回调，再在回调中执行耗时的初始化工作。
- 被阻止的调用会以 `SCRIPT_INVOCATION_BLOCKED` 拒绝。此调用不会启动服务，也不会交给已有服务的回调。在**设置 → 脚本权限 → 脚本调用**中阻止后，该调用方仍在排队的请求也不会进入回调。
- `timeout` 为包括编译/启动、注册、排队和回复的总期限，默认 30000ms，整数范围 100–300000ms。总期限较短时优先到期。超时不会回滚已接收的工作、退出 A 或自动重放请求。

并发冷启动共用启动过程和该实例的权限，后来的请求加入同一个注册等待窗口。阻止发起启动的调用方后，其他调用方仍可按各自的决定继续。若所有等待者都在确认完成前离开，则取消启动确认。

公开服务串行执行回调，每个调用者独立收到 JSON 副本。请求/回复支持 `ScriptSession.Value` 的 JSON 类型，最多 64KiB；不支持函数、BigInt、非有限数和循环引用。进程共享 32 个待处理请求的上限，每个调用者最多 8 个待完成 `call`。即使调用者超时，正在执行的回调也继续占据串行槽，直到回调结束或接收者退出。避免服务之间循环等待；直接自调用会拒绝。

普通打开复用已提供服务的实例。`Script.run` 创建新实例，并等待最终退出结果。`singleMode: true` 明确重启目标，会关闭旧服务。调用者退出不会停止接收者；接收者退出会拒绝待处理请求，旧请求不会迁移到替代实例。服务仍需系统分配执行时间，不会获得额外后台执行权，也不会在 App 终止后自动恢复。首版跨脚本 `call` 不支持扩展内部或 Python 脚本，下方同脚本扩展通信继续可用。

常见错误包括 `SCRIPT_SESSION_SERVER_NOT_REGISTERED`、`SCRIPT_SESSION_START_FAILED`、`SCRIPT_SESSION_CLOSED`、`SCRIPT_SESSION_TIMEOUT`、`SCRIPT_SESSION_HANDLER_FAILED`、`SCRIPT_SESSION_INVALID_DATA`、`SCRIPT_SESSION_BUSY` 和 `SCRIPT_SESSION_SELF_CALL`。

## 同一脚本的主会话与扩展

ScriptSession 和 Storage 都是全局 API，无需 import。主脚本 index.tsx 或 home_screen_default_ui.tsx 注册接收者，同一脚本的其他入口可发送请求并取得应答，包括在另一进程中运行且支持共享容器的扩展。

使用 `register/request` 时请先启动主脚本。主脚本必须仍在运行，并获得系统执行时间才能处理请求。这两个方法不负责启动、唤醒或后台保活。

## 主入口：index.tsx

```tsx
import { Navigation, Script, Text } from "scripting"

async function main() {
  // 在这里校验并实现自己的应用命令。
  const id = ScriptSession.register(async message => {
    return { accepted: true, message }
  })
  Storage.set("mainSessionID", id)
  try {
    await Navigation.present(<Text>主会话运行中，关闭后注销。</Text>)
  } finally {
    ScriptSession.unregister(id)
    Storage.remove("mainSessionID")
    Script.exit()
  }
}

void main()
```

## 分享扩展入口：intent.tsx

在脚本设置中启用文本输入，并选择在分享扩展内运行。先启动主入口，再从 App 分享文本，进入 Scripting 分享扩展并选择同一脚本。

```ts
import { Script } from "scripting"

async function main() {
  const id = Storage.get<string>("mainSessionID")
  if (!id) throw new Error("请先启动主脚本")
  try {
    const reply = await ScriptSession.request(id, { command: "status" }, { timeout: 5000 })
    Script.exit({ type: "text", value: JSON.stringify(reply) })
  } catch (error: any) {
    Script.exit({ type: "text", value: String(error.code ?? error.message) })
  }
}

void main()
```

## App Intent 入口：app_intents.tsx

```ts
import { AppIntentManager, AppIntentProtocol } from "scripting"

export const StopMainIntent = AppIntentManager.register({
  name: "StopMainIntent",
  protocol: AppIntentProtocol.LiveActivityIntent,
  perform: async () => {
    const id = Storage.get<string>("mainSessionID")
    if (!id) throw new Error("请先启动主脚本")
    console.log(await ScriptSession.request(id, { command: "stop" }, { timeout: 5000 }))
  },
})
```

命令名称没有内置行为，需要主 handler 自行执行操作并返回应答。请先返回应答，再注销或退出主脚本，否则待应答请求会被拒绝。

## 限制与生命周期

- 仅主 App 的 index/home_screen/camera_control 可注册接收者。扩展可发送请求，不可注册主会话；扩展需能访问 Scripting 的 App Group，仍受对应扩展类型的系统限制。
- 每次注册返回新 ID，只定位原生身份相同的脚本中该次会话，旧 ID 不会投递给替代会话。
- 同进程保留内存传递路径，跨进程使用共享存储。通知只提醒读取，不保证时延，也不能唤醒被挂起的 App；进程可执行时通过补偿扫描处理遗漏的通知。
- 每进程最多 32 个已注册会话、32 个待应答请求。输入和应答为 JSON，各最多 64 KiB；handler 返回 undefined 时应答为 null。函数、symbol、BigInt、非有限数、undefined 字段和循环引用会拒绝。
- 应答期限默认 10000 毫秒，可设 100...30000 的整数，计入挂起和设备休眠时间。恢复后丢弃过期排队命令；不能抢占同步 JS，也不会撤销接收方已接受的工作。
- 注销/退出会移除接收者并释放回调。发送方退出时清理待回应请求，但已提交到另一进程的工作可能已被接受；迟到回应会忽略。找不到、过期或不可响应的主会话会明确报错或超时，主 App 重启不重放旧命令。
- 应答仅证明 handler 所报告的结果，例如“停止”应答本身不能证明设备真实位置已恢复。

错误码：SCRIPT_SESSION_UNAVAILABLE、SCRIPT_SESSION_NOT_FOUND、SCRIPT_SESSION_BUSY、SCRIPT_SESSION_CLOSED、SCRIPT_SESSION_TIMEOUT、SCRIPT_SESSION_INVALID_DATA、SCRIPT_SESSION_INVALID_HANDLER、SCRIPT_SESSION_HANDLER_FAILED、ERR_PRO_REQUIRED。

目标脚本不存在时 reject，错误码为 `SCRIPT_SESSION_SCRIPT_NOT_FOUND`。脚本已存在但元数据无效、入口不支持或编译/启动失败时为 `SCRIPT_SESSION_START_FAILED`；正在运行但未注册服务时为 `SCRIPT_SESSION_SERVER_NOT_REGISTERED`。


## 每条请求的调用来源

`serve` 和 `register` 回调都接收 `(message, request)`。`request` 包含冻结的 `id`、`caller: { name, env }` 和 `source`（`"scriptSessionCall"` 或 `"scriptSessionRequest"`）。每条请求在排队或跨 `await` 后仍保留自己的来源。原有单参数回调继续有效；依赖 `arguments.length` 或收集全部实参的 `register` 代码会看到新增的第二实参。

```ts
// 全局 API，无需导入。
ScriptSession.register(async (message, request) => {
  console.log(request.caller.name, request.caller.env, request.source)
  return { accepted: true, message }
})
```

扩展请求会携带发送方环境；旧扩展消息缺少来源时，`caller.env` 保留空字符串，不冒充主入口环境。这些字段不会放宽同脚本扩展通信范围，也不表示扩展/Python 已支持跨脚本 `call`。调用者名称不是授权凭据或允许名单；业务消息中的同名字段不能修改宿主来源。识别当前客户请使用 `request.caller`，`Script.invocation` 仅描述服务首次启动的来源。
