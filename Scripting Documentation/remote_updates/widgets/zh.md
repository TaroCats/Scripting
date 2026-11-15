# 小组件远程更新

## 连接并授权小组件

1. 在接收设备的 Scripting → 远程推送中连接账户。
2. 在对应脚本的 App 执行环境调用 `await Widget.remoteUpdates.enable()`，或通过远程更新管理页面授权，并确认脚本授权提示。
3. 添加现有的 Scripting 桌面小组件，选择该脚本、设置参数，并打开这份配置的 **Remote Updates** 开关。不需要添加新的小组件 kind。
4. WidgetKit 提供 token 与配置的对应关系，原生代码登记目标。在完成之前，已启用的配置可以处于 `pending`。
5. `widget.tsx` 读取注入的状态，App 脚本或外部服务器负责提交更新。

不要在 `widget.tsx` 中调用 `enable`、恢复账户、登记 token 或发送 API。预览不会登记目标；完成准备后，入口脚本无需持续运行。

```tsx
// widget.tsx
import { Text, VStack, Widget } from "scripting"

type WeatherState = { temperature: number }
const snapshot = Widget.remoteUpdates.getState<WeatherState>()
const temperature = snapshot?.hasState && snapshot.state != null
  && typeof snapshot.state.temperature === "number"
  ? snapshot.state.temperature : null

Widget.present(
  <VStack>
    <Text>{Widget.parameter || "Default location"}</Text>
    <Text>{temperature === null ? "Waiting for data" : `${temperature}°`}</Text>
    {snapshot?.isStale ? <Text>Cached data</Text> : null}
  </VStack>
)
```

### 参数与目标身份

`{ parameter: "" }` 选择当前安装、当前脚本中没有填写参数的小组件目标。系统没有提供参数时归一为 `""`；`" "`、`"null"`、大小写和 JSON 文本格式保持区别，不会 trim 或解析。

不同参数对应不同目标。同一安装中，同脚本同参数的多个桌面位置或尺寸共享一个状态目标。target 表示逻辑配置，不是某一个桌面位置；另一台设备即使脚本和参数相同，targetId 也不同。

App 中使用 `Widget.remoteUpdates.getTarget({ parameter })`，小组件渲染中使用 `getTarget()`；App 中还可以使用 `listTargets()`。给其他已授权设备发送时，明确填写其 `targetId`。参数 selector 不会隐式广播到其他设备。

```tsx
// widget_update.tsx
import { RemotePush, Widget } from "scripting"

// Run in the app, after authorizing this script and adding its widget.
const parameter = "" // The exact configured parameter; no parameter means "".
const snapshot = await Widget.remoteUpdates.getSnapshot({ parameter })
const request = {
  selector: { parameter },
  state: { temperature: 24 },
  expectedRevision: snapshot.revision,
  idempotencyKey: "weather-observation-1042",
  sourceVersion: 1042,
}
const receipt = await RemotePush.widgets.update(request)
console.log(receipt.targetId, receipt.revision, receipt.operation.status)
// A transport retry reuses this same request, including its idempotencyKey.
```

实际运行发送示例时，将其保存为 `index.tsx` 等 App 入口。新业务事件使用新的 observation ID；同一个幂等键配上不同内容会返回 `IDEMPOTENCY_CONFLICT`。

`getState<T>()` 同步执行，没有可用的受管理快照时返回 `null`。快照结构为 `{ targetId, hasState, state, revision, isStale? }`。`hasState: false` 表示尚未提交状态；`hasState: true, state: null` 表示明确提交过 JSON null。`isStale` 表示刷新失败后使用的缓存。TypeScript 泛型不会在运行时验证业务数据。

`RemotePush.widgets.update` 提交完整 JSON 状态并排队请求刷新；`RemotePush.widgets.reload` 只发送刷新信号，不生成新状态。仅使用 reload 时可保留原有的数据加载逻辑。WidgetKit 可能刷新多份时间线，并根据系统预算择机处理，接口成功不能保证屏幕立即变化。


## 发送参数

`update` 接收 `targetId` 或 `selector: { parameter }`，以及 `state`、`expectedRevision`、`idempotencyKey`，可选 `sourceVersion` / `expiresAt`。`reload` 接收同样的地址、`idempotencyKey` 和可选 `expiresAt`。

状态是完整 JSON 替换，最多 16 KiB、深度 32。支持有限数字、字符串、布尔值、null、数组和普通对象；日期先转为字符串。`updateMany` 接收 1–50 个明确目标的请求，逐项返回结果，不是跨设备事务。

## 配置与恢复

在远程更新页面点击“授权小组件脚本”，搜索并选择脚本后确认。脚本会立即出现在“已授权的小组件脚本”中。随后添加桌面小组件、选择同一脚本和参数、开启远程更新，再返回刷新。配置登记后出现目标，token 仍可能等待系统提供。授权不会自动添加桌面小组件。

重命名保留脚本身份；复制或重新创建脚本需要重新授权。移除小组件会停用对应配置。旧回调不能恢复已撤销目标；显式重新授权会创建新的目标 ID，外部发送权限也需要更新。

遇到 `VERSION_CONFLICT`，读取最新快照后判断业务变更是否仍应提交。超时后用保存的原请求和幂等键重试；新事件使用新键。每日额度和操作状态见[概览](scripting://doc?title=Remote%20Updates%20Overview)。
