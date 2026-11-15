# Live Activity 远程更新

## 准备 Live Activity 渲染模板

在 `live_activity.tsx` 使用 `LiveActivity.register` 定义渲染函数并导出工厂。调用 `createDeliveryActivity().prepareRemoteStart(...)` 准备远程启动。

准备过程会在接收设备上编译并固定可达的渲染模块和明确声明的资源。推送只携带 JSON 数据，不下发 JavaScript。接收设备必须已经安装准确的 `templateVersion`，不能靠推送临时下载并授权缺失模板。

脚本源码可以继续存放在 iCloud。准备时由 App 将冻结包和已验证的渲染身份保存到本机；Live Activity 扩展只用该包渲染，不读取 iCloud 或源码目录。远程渲染中的 `Script.directory` 指向冻结包，声明的资源请通过 `LiveActivity.resourcePath` 访问。

渲染函数应同步执行，仅根据状态和已准备的资源构建界面，不能依赖 App 脚本中的变量、网络请求、凭据或可变文件。支持静态本地模块导入；动态模块查找或依赖原生能力的包会在准备时拒绝。`sampleState` 只检查一个示例，不能证明未来所有状态均可渲染。

<!-- example: live_activity.tsx -->
```tsx
// live_activity.tsx
import {
  LiveActivity, LiveActivityUI,
  LiveActivityUIExpandedCenter, Text,
} from "scripting"

export type DeliveryState = { message: string }
export const createDeliveryActivity = LiveActivity.register<DeliveryState>(
  "Delivery",
  state => (
    <LiveActivityUI
      content={<Text>{state.message}</Text>}
      compactLeading={<Text>Delivery</Text>}
      compactTrailing={<Text>…</Text>}
      minimal={<Text>📦</Text>}
    >
      <LiveActivityUIExpandedCenter>
        <Text>{state.message}</Text>
      </LiveActivityUIExpandedCenter>
    </LiveActivityUI>
  )
)
```

## 本地启动后远程更新

通过 `remoteUpdates: true` 主动启用。本地启动先向服务端预留唯一实例，再请求 ActivityKit 创建可接收推送的活动。`start()` 返回 `true` 表示本地创建成功，不表示远程更新 token 已到达。

`activity.remoteUpdates.getTarget()` 查询就绪状态；`waitUntilReady` 默认等待 15 秒，允许 0–60,000 毫秒，可能抛出 `TOKEN_PENDING`。这不会取消或重新启动活动。需要在后续脚本运行中恢复对象时，保存原生 `activityId`，并在注册 builder 后调用 `LiveActivity.from<DeliveryState>(activityId, "Delivery")`。

<!-- example: local_activity.tsx -->
```tsx
// local_activity.tsx
import { createDeliveryActivity } from "./live_activity"

// Run in the app. This file starts one business activity, once.
const activity = createDeliveryActivity()
const started = await activity.start({ message: "Preparing" }, {
  remoteUpdates: true,
  businessKey: "delivery:42",
  businessGeneration: "1",
  idempotencyKey: "delivery:42:start:1",
})
if (!started) throw new Error("Activity was not created")
console.log("Native activity ID:", activity.activityId)

// A timeout only means the update token is not ready yet. Do not start again.
const target = await activity.remoteUpdates.waitUntilReady({ timeoutMs: 15000 })
if (target.status !== "ready") throw new Error(`Target is ${target.status}`)
const snapshot = await activity.remoteUpdates.getSnapshot()
await activity.update({ message: "On the way" }, {
  expectedRevision: snapshot.revision,
  idempotencyKey: "delivery:42:update:1",
})
console.log("Remote target ID:", target.targetId)
// Later, await activity.end() to end locally with its last valid state.
```

远程管理的活动通过 `activity.update` 提交到服务端统一排序，再经 APNs 更新，不会同时执行另一条竞争的原生本地 update。先读取快照，再传 `expectedRevision` 和稳定的 `idempotencyKey`。离线 update 会失败，不会悄悄变成第二个写入来源。

`activity.end()` 使用最近状态立即结束本地实例，不等待网络，并保留待同步的清理意图。结束另一台设备上远程启动的实例时，使用 `RemotePush.liveActivities.end({ targetId, idempotencyKey })`，这条请求需要网络。没有主动启用远程管理的现有活动保留原来的本地行为。

## 从服务器远程启动

新建一个脚本，放入上面的 `live_activity.tsx` 和下面的 `index.tsx`。在接收设备的 App 内运行，确认脚本授权；iOS 询问实时活动权限时请选择允许。准备不会启动活动。从输出保存 `startTargetId` 和 `templateVersion`，等到 `status: "ready"` 再请求远程启动。若 token 尚未就绪，保留同一脚本，稍后再次运行准备即可。

<!-- example: index.tsx -->
```tsx
// index.tsx
import { Script } from "scripting"
import { createDeliveryActivity } from "./live_activity"

async function main() {
  try {
    const prepared = await createDeliveryActivity().prepareRemoteStart({
      sampleState: { message: "Preparing" },
    })
    console.log(JSON.stringify(prepared, null, 2))
  } catch (error) {
    console.error(error)
  } finally {
    Script.exit()
  }
}
main()
```

使用主密钥调用 `POST /v1/remote-updates/sender-keys` 创建受限发送凭据。提供 `targets: [startTargetId]`、`created_from: [startTargetId]`，以及 `activities:start`、`activities:read-state`、`activities:update`、`activities:end` 权限和稳定的 `idempotency_key`，安全保存返回的 `credential`。只有 start 权限的凭据不能更新创建出来的活动；`created_from` 只覆盖同一凭据创建的实例。主密钥可读取管理元数据和执行不带新状态的结束清理；旧子密钥不能使用此协议。
远程启动必须提供 alert。启动结果为 `unknown` 时，请求可能已经到达 APNs，应核对同一次 launch，不能生成新请求盲目重发。businessKey 与 generation 用于防止同一业务实例被本地和远端竞争启动；真正进入新的业务生命周期时才显式使用新 generation。

App 脚本也可以通过 `RemotePush` 调用 `liveActivities.start/update/end/getSnapshot/listTargets` 执行同类操作。JS 选项使用 camelCase 和 `Date`；HTTP 使用 snake_case 和 UTC ISO 8601 字符串。例如 JS 的 `expiresAt: new Date(...)` 转换为 HTTP 的 `expires_at: "2026-10-18T13:00:00.000Z"`。业务 `state` 中的日期须先显式转成字符串。


## 参数

- `start`：`startTargetId`、`templateVersion`、`state`、`alert`、`idempotencyKey`；可选 `businessKey`、`businessGeneration`、`expiresAt`。
- `update`：`targetId`、`state`、`expectedRevision`、`idempotencyKey`；可选 `sourceVersion`、`staleAt`、`relevanceScore`、`priority`、`alert`、`expiresAt`。
- `end`：`targetId`、`idempotencyKey`；可选 `state`、`expectedRevision`、`dismissAt`、`expiresAt`。提供新结束状态时必须传 `expectedRevision`。

## 资源与状态 schema

使用位图资源时，在 `prepareRemoteStart({ resources: ["icon.png"], sampleState })` 声明相对源码目录的文件。在远程 Live Activity builder 中，`LiveActivity.resourcePath("icon.png")` 返回固定资源路径，供 `Image.filePath` 使用。资源路径仅在远程渲染中可用，不能使用绝对路径或路径穿越。资源必须事先明确准备，修改原文件不会改变正在运行实例使用的固定包。

远程渲染使用静态、适合 Widget 的界面。App 专属 WebView、视频/相机视图、依赖回调的 Canvas、SVG、远程图片 URL、网络 API、FileManager、Keychain 和 Data 不可用。请使用 SF Symbols、明确准备的位图、普通文本/布局/形状和 JSON 状态。提供 sampleState 时，不支持的界面或资源会在准备中失败；后续状态触发未测试过的分支时使用安全占位界面。渲染树有大小上限，但不承诺由 App 控制的 JavaScript CPU 硬超时。

`prepareRemoteStart({ sampleState, resources, schema })` 可将业务状态 schema 固定进渲染模板版本。不提供 schema 时仅检查 JSON 合法性、深度与大小；TypeScript 泛型不提供运行时校验。sample 只测试一个渲染样例；省略时仅检查 builder 已注册，作者仍需测试有代表性的状态。

支持的 schema 关键字：`type`（null、boolean、number、integer、string、array、object 之一）、基本值 `enum`、`properties`、`required`、布尔值 `additionalProperties`、`items`、`minItems`、`maxItems`、`minLength`、`maxLength`、`minimum`、`maximum`。遵循对应 JSON Schema 含义：属性和元素规则仅用于对象或数组，必须限定类型时应同时设置 `type`。默认属性可缺省、允许额外属性、不隐含类型。字符串长度按 Unicode 码点计数。schema 最深 12 层、最多 256 个节点，每节点最多 128 项属性或枚举值；整个启动 manifest 不超过 8 KiB。远程引用、正则、组合规则、默认值注入、类型转换和未知关键字报 `INVALID_STATE_SCHEMA`。这是有边界的子集，并非完整 JSON Schema 实现。状态不符时，在提交启动、更新或最终状态之前报 `STATE_SCHEMA_MISMATCH`。接收端独立校验固定 schema，失败使用安全占位界面。schema 变更会产生新模板版本，已有活动保留原 renderer 和 schema。

远程管理的本地 `start` 支持 `staleDate`（Date 或毫秒时间戳）及 `relevanceScore`（0 到 1）。其 `update` 将 `alert`、`sourceVersion`、`staleDate`、`relevanceScore` 交给服务端，不再同时调用本地 update。`RemotePush.liveActivities.update` 使用 `staleAt: Date`，也支持 `relevanceScore`。HTTP 日期采用 UTC ISO 8601，服务端转换为 APNs 整秒。本地 `end()` 即使离线也立即结束活动。`dismissTimeInterval` 单位为秒：省略使用系统默认策略，零或负数立即移除，正数请求在指定间隔后移除，受系统最长四小时限制。需要提交最终状态到云端时，使用带 `state` 和 `expectedRevision` 的 `RemotePush.liveActivities.end`；本地 end 保留为清理路径。

原生凭据续期不会破坏同一接收安装内的本地启动幂等恢复。明确断开连接会退休旧安装，已被接受但迟到的启动不能登记到新连接。重命名保留脚本绑定，内容不变时也保留 renderer 版本；在 App 内删除或替换脚本会退休旧绑定，仅保留旧模板文件不能恢复该身份。iCloud 文件暂不可读不会被当成删除；在 App 外发生的文件变动需要由 App 核对，离线扩展无法立即识别云端删除。

## 测试与排查

1. 准备上述两个文件，再按下文创建受限发送凭据。依照 [HTTP API 测试](scripting://doc?title=Remote%20Updates%20HTTP%20API)，逐条执行 start、status、update、end。
2. 将 Scripting 切到后台。start 应显示“Preparing”，update 后锁屏和灵动岛应显示“Updated from server”，end 请求立即移除。被接受的状态投递使用共用每日推送额度。 同时检查锁屏是否仍有“允许”或“继续允许”实时活动的系统提示，处理后再检查 token 是否就绪，随后执行 update 或 end；启动界面已显示与更新 token 已登记是两项不同结果。
3. 目标 `ready` 表示 token 已登记；APNs 接受操作不代表活动已成功渲染或显示。异常时，打开远程推送 → 远程更新，查看活动的“设备快照”。“复制渲染诊断”包含目标、模板、版本和阶段码，不含业务状态或密钥。旧状态版本的报告不能代表最新更新；没有报告表示尚无可用的设备结果。
4. “检查渲染”测试当前活动固定的模板。仅当已安装源码可以重建完全相同版本时，才会修复缺失或损坏的包；不会发推送，也不会强制系统替换已有快照。检查成功后，使用新的业务事件发送一次更新。旧版本无法重建时，准备修改后的脚本并明确启动新活动，不会偷偷替换运行中活动的模板。 检查在 App 进程中执行，通过不代表小组件扩展渲染成功，也不会覆盖扩展诊断。
5. 渲染从 App Group 读取已准备的模板和非秘密授权记录，不依赖 iCloud 或 Keychain。升级后打开一次 Scripting 迁移已有授权；没有可信旧身份记录时，需要保持源码可访问以完成准备。无需更换主密钥、重新连接远程更新或重启设备。锁屏仍显示错误时，请同时提供错误码和复制的渲染诊断。

默认结束策略可能让卡片在锁屏保留最多四小时。在该设备使用“移除已结束活动”，或请求结束时将 `dismissAt` 设为当前时间，可立即移除。不带新状态的结束属于清理，不消耗推送额度。

## 更新顺序与恢复

每个携带状态的操作发送它自己已提交的完整快照。Activity 的显式提醒与该操作的状态绑定，后续更新不能悄悄替换提醒或状态。排队中的纯状态更新可以合并；显式提醒保留顺序，不自动重试，避免在投递结果不确定时重复提醒。结束优先于排队中的更新。操作被替代时可检查 `operation.supersededBy`，存在传输标识时可检查 `operation.apnsId`；这些可选字段都不证明设备已收到。

对已结束目标再次执行不带新状态的结束，返回 cancelled 操作及 `pendingReason: "already_ended"`，不会虚构 APNs 已接受。之前已请求结束的目标，可以用新的幂等键再次排队清理。最终状态属于新写入，需要当前 revision，且不能在目标进入终止流程后再追加。遇到 `SOURCE_VERSION_CONFLICT`、`STATE_SCHEMA_MISMATCH`、`PAYLOAD_TOO_LARGE` 或配额错误，应检查并修正请求，而不是原样反复重试。

本地 `end()` 优先保证离线时也能结束可见 Activity；其可选最终本地状态是尽力处理，后续清理可能使用云端最后已提交的状态。需要将最终状态提交到服务端时，使用 `RemotePush.liveActivities.end({ targetId, state, expectedRevision, idempotencyKey })`。若创建明确失败（`creation_failed`），先确认没有对应的 Activity，再通过新的工厂实例、新幂等键和新的业务代次主动重试。原实例会保留原来的创建意图。结果为 `unknown` 的启动不能这样重试。

`RemotePush.getCapabilities()` 返回支持的协议能力与限制，不代表获得授权。准备包上限为 16 MiB、256 个模块、254 个显式资源及 512 个文件。每个脚本绑定最多保留 64 个版本、256 MiB；已知 Activity 或授权引用的版本保持固定，未引用的包超过七天后才可清理。本地创建 Activity 还会在预留业务代次前，检查编码后的 attributes 与 content state 合计是否满足系统 4 KiB 限制。请保持状态精简，并测试长文本、转义字符及资源等代表性内容。

服务端调用和凭据配置见 [HTTP API](scripting://doc?title=Remote%20Updates%20HTTP%20API)，额度和操作状态见[概览](scripting://doc?title=Remote%20Updates%20Overview)。
