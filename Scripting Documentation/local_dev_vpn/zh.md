# VPN 与 LocalDevVPN

`VPN` 是 App、小组件与控制小组件脚本，以及分享、键盘、通知、翻译 UI 扩展中的全局对象，无需 import。App 脚本使用原生 VPN 服务，保留原有离线行为。

扩展通过 HTTP 调用相同的 `VPN.*` 方法。在当前配置声明 `http-api`，或通过 **Network → 功能 → HTTP API** 编辑，然后连接 Scripting VPN。默认使用 HTTP，可选 HTTPS。内置调用自动使用有效地址和密钥，无需传参；HTTPS 会验证服务证书，不会降级为 HTTP。配置与外部客户端用法见 [HTTP API](../vpn_http_api/)。

App 和扩展中的 VPN 管理方法均无需脚本权限授权。键盘调用仍需要“允许完全访问”。`VPN.localDevVPN` 与 RSD 继续使用独立的 `localDevVPN` 权限。

直接在现有小组件动作或 App Intent 脚本中调用即可，具体行为由实际执行宿主决定。在扩展执行时，HTTP API 未开启或不可用会导致 Promise 拒绝；`start()`、`stop()` 及 `localDevVPN` 方法返回 `VPN_HTTP_UNSUPPORTED`，`VPN.configuration` 不可用。在 App 执行时仍使用原生 API，包括 VPN 启停、LocalDevVPN/RSD 及受支持的配置面板。`localDevVPN` 仍使用独立权限。

小组件时间线由系统调度，网速是采样值。扩展受系统执行时限约束。请捕获错误；操作超时后先查询再决定是否重试，因为已受理的变更可能已经保存。HTTP 错误包括 `VPN_HTTP_API_DISABLED`、`VPN_HTTP_API_UNAVAILABLE`、`VPN_HTTP_TIMEOUT` 和 `VPN_HTTP_FULL_ACCESS_REQUIRED`。

下面仅适用于 App 的示例会启动 **Scripting 自身 VPN**。已有外部 VPN 提供反射时，请跳过这段，直接使用下方 RSD 隧道 API。

```ts
import { Script } from "scripting"

async function main() {
  console.log(await VPN.start())
  const granted = await Script.requestAccess(["localDevVPN"])
  if (granted.includes("localDevVPN")) {
    const before = await VPN.localDevVPN.getState()
    await VPN.localDevVPN.setEnabled(true, {expectedState: before.expectedState})
  }
}

void main()
```

`start()` 在系统报告已连接后完成；connecting、reasserting、disconnecting 过渡态拒绝重复启动。`stop()` 在停止偏好处理完成且系统断开后完成，并关闭绑定 Scripting 反射的 RSD 会话。脚本退出不会停止已接受的设备级控制操作。等待超时可能在操作仍继续时拒绝，应先查询状态再决定是否重试。已连接不代表流量成功。

| VPNState 字段 | 含义 |
| --- | --- |
| status / active | Scripting 自身 VPN 状态；active 仅在 connected 时为 true。 |
| selectedConfigurationId / selectedConfigurationName | 实际选中配置的 ID、名称，或 null。 |
| providerBundleId | 本 App 的 VPN provider 标识，或 null。 |
| effectiveConfigurationId | 由 provider 诊断验证的生效配置 ID，无法验证时为 null。 |
| operation / problem | starting、stopping 或 null；错误说明或 null。 |

在主 App 中，读取已保存的配置失败时，`getState()` 返回的 Promise 会拒绝。

`VPN.localDevVPN.getState()` 查询保存意图和实际回环反射状态。`setEnabled(enabled, {expectedState?})` 只修改设备意图，保留地址；断开时修改不会启动 VPN，配置切换和脚本退出也不会清除意图。控制本地设备意图及 RSD 使用 `localDevVPN` 权限。权限错误保留适用的 code、reason、permission、permissionScope 字段。

| VPNLocalDevState 字段 | 含义 |
| --- | --- |
| enabled / active | 保存意图 / 已验证的实际反射生效状态。 |
| vpnStatus / effectiveStatus | Scripting 自身状态 / inactive、pending、active、error、unavailable。 |
| addresses / resolvedAddresses / effectiveAddresses | 保存地址 / 当前组合后的期望地址 / 已验证的安装地址。 |
| expectedState | 不透明 CAS token，写入时原样回传。 |
| profileId / problem | 实际配置 ID / 错误说明，或 null。 |

过期 token 拒绝且不覆盖意图。省略 token 时以原子写入前的状态为基准。采样期间发生并发变化也会拒绝。保存成功后若查询失败，Promise 仍可能拒绝；应重新查询确认，而非认为没有保存。

## 网速和路由模式

用 `VPN.getTrafficRate()` 采样当前 Scripting VPN 的流量。结果包含两次隧道采样之间的 `uploadBytesPerSecond` 和 `downloadBytesPerSecond`。两次采样之间等待约 1.25 秒，完整调用还需要读取样本。没有两份可用样本时返回 `null`。隧道空闲且样本有效时，速率为零。

`VPN.getRoutingMode()` 读取保存的基础模式。`VPN.setRoutingMode(mode)` 为当前配置保存模式，并返回保存结果。`direct` 表示直连，`global` 表示全局代理，`rules` 表示规则分流。全局代理要求当前配置有节点。网络条件可以临时覆盖基础选择。

```ts
await VPN.setRoutingMode("rules")
const rate = await VPN.getTrafficRate()
if (rate) console.log(rate.downloadBytesPerSecond)
```

已授权的小组件和控制动作可直接调用这些方法。时间线可显示采样网速及采样时间。

使用过 **Set Proxy** 的快捷指令可将该动作替换为 Scripting 脚本。关闭代理时调用 `VPN.setRoutingMode("direct")`，开启时按需选用 `"global"` 或 `"rules"`。

## 全局代理节点和策略组

列表针对当前配置。节点和成员返回 `{ id, name }`，策略组返回 `{ id, name, members, selectable }`。`selectable` 表示策略组是否支持手动选择成员。

节点、策略组和成员请使用同一次脚本运行中最新列表里的 ID。主 App 脚本与 HTTP 各自生成这些 ID，扩展脚本使用 HTTP 的 ID。配置变更可能使之前的 ID 失效。收到 `stale` 后，重新读取列表并确认目标，再使用新的 ID。

```ts
const node = (await VPN.listProxyNodes()).find(item => item.name === "Office")
if (node) await VPN.setRoutingMode("global", { nodeId: node.id })

const group = (await VPN.listPolicyGroups()).find(item => item.name === "Work")
const member = group?.members.find(item => item.name === "Office")
if (group?.selectable && member) await VPN.setPolicyGroupMember(group.id, member.id)
```

传入节点 ID 会同时保存全局模式和节点，已经处于全局模式时也可以用它换节点。无效 ID 会保留两项原值。`setPolicyGroupMember(groupId, memberId)` 适用于手动选择组。`updatePolicyGroup(groupId, patch)` 支持修改可编辑组的 `hidden`、`category`、`iconURL`、`noAlert`。省略字段会保留原值，传入 `null` 会清除字段。这两个方法分别返回更新后的组或选中的成员，格式为 `{ id, name }`。

## 读取选择、测速和读取流量总量

`VPN.getGlobalProxyNode()` 读取全局代理模式选中的节点或默认节点，返回 `{ id, name }`。没有可用节点时返回 `null`。任何路由模式下都可读取这项选择。`VPN.getPolicyGroupSelection(groupId)` 读取手动选择组当前选中的直接成员或默认成员。没有可用成员时返回 `null`，自动组和 筛选别名返回 `notSelectable` 错误。

`VPN.testProxyNodes(ids)` 接受当前配置最多 128 个节点 ID，并合并重复 ID。`VPN.testPolicyGroup(groupId)` 测试一个组中最多 128 个直接成员。成员为子组时，沿用手动测速解析为该成员选出的出口。标准 DIRECT 使用现有直连测试，拒绝策略和指定接口的直连策略返回 `skipped`。两种方法使用当前配置的测速设置。脚本可以用结果展示延迟或选择节点。

每项结果包含 `id`、`name`、`status`、`latencyMs` 和 `metric`。状态为 `reachable`、`failed`、`unavailable` 或 `skipped`。延迟和测量口径可以为 `null`。比较延迟时使用同一测量口径。配置变更可能使进行中的测试返回 `stale`，此时可重新读取列表获取当前 ID。

```ts
const nodes = await VPN.listProxyNodes()
const results = nodes.length ? await VPN.testProxyNodes(nodes.slice(0, 8).map(node => node.id)) : []
const today = await VPN.getTrafficTotals("today")
```

`VPN.getTrafficTotals()` 返回当前 Scripting VPN 隧道会话的累计 `uploadedBytes` 和 `downloadedBytes`。传入 `"today"` 可读取按设备时区计算的今日已记录总量。`incomplete` 表示记录可能存在缺口。无新鲜隧道样本时，会话结果为 `null`。流量历史已停用或今天还没有记录时，今日结果为 `null`。

## 启用脚本和模块

`VPN.listScripts()` 包含独立 Network 脚本和模块声明的脚本，每项返回 `{ id, name, status, editable, ownership }`。`ownership` 为 `"standalone"`（独立脚本）或 `"module"`（模块脚本）。模块脚本还返回 `moduleId`，在同一配置修订下与 `VPN.listModules()` 中所属模块的 ID 一致。独立脚本省略 `moduleId`。

`VPN.listModules()` 返回当前配置和库中未关联模块的 `{ id, name, status }`。状态为 `enabled`（启用）、`disabled`（停用）或 `unattached`（未关联）。模块内脚本的状态也受所属模块的开关控制。

如果界面只展示可独立启停的脚本，请筛选 `editable: true` 的条目，再用 `VPN.setScriptsEnabled(ids, enabled)` 修改。要控制模块内的脚本，用所属模块的 ID 调用 `VPN.setModulesEnabled(ids, enabled)`。远程子模块为只读。未关联的模块需要先关联到配置。每次调用接受对应类型的 1 至 128 个 ID，整批一次保存。遇到过期或只读的 ID 时整批拒绝。

访问同一台 VPN 设备时，App 脚本、扩展和 HTTP 客户端取得相同的脚本和模块 ID。活动配置、发布版本及条目修订相同时，脚本重跑或服务重启后仍可使用同一个 ID。改变状态或从使用会话 ID 的旧版升级后，请刷新对应列表。写入返回 `stale` 时，重新列出并确认目标，再决定是否重试。

```ts
const ids = (await VPN.listModules())
  .filter(item => item.status === "enabled" && item.name.startsWith("Work"))
  .map(item => item.id)
if (ids.length) await VPN.setModulesEnabled(ids, false)
```

这些方法可在支持的脚本环境中使用。

扩展调用返回 `VPN_HTTP_TIMEOUT` 时，设置可能已经生效。例如，`VPN.setRewriteEnabled(false)` 超时后，先调用 `VPN.getRewriteEnabled()` 复核，再决定是否重试。

通过 `VPN.configuration.importScript()` 导入的脚本保存在单脚本模块中。关联配置后，可以在模块列表中找到并启用它。

## MITM、重写、流量脚本与抓包

支持的脚本环境可读取和设置这些开关。方法返回保存的布尔值。每个设置方法接受 `true` 或 `false`。App 可在 VPN 断开时保存开关；扩展调用需要 HTTP 服务正在运行。

| 读取 | 设置 | 范围 |
| --- | --- | --- |
| `VPN.getMITMEnabled()` | `VPN.setMITMEnabled(enabled)` | 本机 MITM。由关闭切换为开启时需要已信任的证书。遇到 `certificateSetupRequired` 时，在 App 中完成证书设置。 |
| `VPN.getRewriteEnabled()` | `VPN.setRewriteEnabled(enabled)` | 当前配置的重写。保留每条重写规则的开关。 |
| `VPN.getScriptingEnabled()` | `VPN.setScriptingEnabled(enabled)` | 本机 Network 流量脚本。要控制单条脚本，使用 `setScriptsEnabled(ids, enabled)`。 |
| `VPN.getCaptureEnabled()` | `VPN.setCaptureEnabled(enabled)` | 本机抓包。开启时创建或保留当前会话，关闭时结束会话。 |

```ts
const captureEnabled = await VPN.getCaptureEnabled()
if (!captureEnabled) await VPN.setCaptureEnabled(true)
```

开关在 VPN 处理匹配流量时生效。App 脚本需要连接 VPN 时，可单独调用 `VPN.start()`。

## 管理 VPN 配置

在开发构建中，从 App 主动运行已保存的脚本时可以使用 `VPN.configuration`。每次变更都会打开原生确认面板。新导入的资源默认关闭，当前配置保持选中。

| 方法 | 输入与结果 |
| --- | --- |
| `importModule(options)` | 传入 `text`，可选 `format: "ini" \| "plugin"`。模块引用脚本时，用 `scripts` 提供从声明的相对路径到 JavaScript 正文的映射。 |
| `importScript(options)` | 传入 `name` 和 `source`。默认触发方式是手动运行（`generic`）。`request` 和 `response` 的 `trigger` 必须包含 `urlPattern`，可选 `requiresBody`。还可传入 `argument` 和以秒为单位的 `timeout`。 |
| `attach([resource, …])` | 在面板选择一份配置，也可一次完成新建并关联。重复关联会保留已有设置。 |
| `create({ suggestedName? })` | 新建空白配置。可在面板编辑名称。 |
| `updateModule(resource, options)` / `updateScript(resource, options)` | 替换未关联的资源。按导入时的格式传入完整新内容。成功后返回新的引用。 |
| `deleteModule(resource)` / `deleteScript(resource)` | 删除未关联的资源。关闭的关联仍算关联，请先在 Network 中解除关联。 |

模块可以包含受支持的离线分流规则，以及 Generic、Request 和 Response 脚本。通过 `scripts` 一并提供脚本依赖。绝对路径、远程依赖和不支持的模块段落会导致导入失败。Request 和 Response 脚本在 Network 启用后可以读取流量，请先检查内容。

导入和更新返回 `{ status: "saved", resource }` 或 `{ status: "cancelled" }`。新建和关联只返回状态。删除返回 `deleted` 或 `cancelled`。操作失败会拒绝并提供错误码。资源引用只在收到它的脚本运行中有效，更新后请用新引用。配置名称、ID 和已有资源内容在 App 内管理。 同一次运行内重复导入相同内容时，如果先前导入的资源未修改，就复用该资源。错误码包括 `invalidInput`、`resourceUnavailable`、`unavailable` 和 `busy`。

```ts
const configuration = VPN.configuration
if (configuration) {
  const saved = await configuration.importScript({
    name: "Example response",
    source: "$done({})",
    trigger: { type: "response", urlPattern: "^https://example[.]invalid/" },
  })
  if (saved.status === "saved") {
    await configuration.attach([saved.resource])
  }
}
```

## RSD 隧道

### 本机反射与普通联网

`VPN.localDevVPN.setEnabled(true)` 只启用本机反射意图；`VPN.start()` 启动的是**当前选中的完整 Scripting 代理配置**，包含其路由规则与 DNS 策略。启用反射不会自动把该配置变成仅反射隧道，也不会自动允许其他流量直连。请确保所选配置允许普通联网；拒绝其他目的地址的隔离测试配置不适合地理编码和网页请求。

外部 App 提供反射时，保持其 VPN 连接，直接调用 `openRSDTunnel`。普通联网由外部 App 的规则与 DNS 决定，Scripting 不修改这些设置。此时 Scripting 的 `effectiveStatus: "inactive"` 属于预期状态。

`Location.reverseGeocode` 使用系统地理编码服务。`kCLErrorDomain` 错误 2 可能表示网络问题，也可能是 App 级限频。应缓存结果、合并进行中查询，避免地图相机每次更新都查询，也不要快速连续重试。错误 8 表示没有匹配结果。排查时，以低频率对同一公共坐标分别测试无 VPN、允许普通流量 DIRECT 的配置以及外部 VPN。网页请求成功不能单独证明地理编码服务的后端路径正常，还要记录反查本身的结果。

### 打开与收发

`VPN.localDevVPN.openRSDTunnel({host, port, preSharedKey, identity?, mtu?})` 需要当前路由可达的数字 IPv4 反射地址、`localDevVPN` 权限和配对流程已获取的 32 字节 PSK（Uint8Array 或 ArrayBuffer）。identity 可选，为不超过 128 字节的 UTF-8 字符串。MTU 默认 16000，范围 1280–16384。它提供 CDTunnel 传输及有界的私有 IPv6 TCP 连接，不负责 Apple 设备发现、配对或服务专用业务命令；已打开的隧道可以查询 RSD 服务目录。

```ts
// VPN 为注入的全局对象，无需 import。
// 配对流程提供本次会话的 PSK 和新申请的一次性 listener 端口。
// servicePort 和 request 必须遵循已发现服务的协议。
async function exchangeRSDService({host, port, preSharedKey, servicePort, request}: {
  host: string; port: number; preSharedKey: Uint8Array;
  servicePort: number; request: Uint8Array;
}): Promise<Uint8Array | null> {
  const tunnel = await VPN.localDevVPN.openRSDTunnel({host, port, preSharedKey})
  try {
    const connection = await tunnel.connect({port: servicePort})
    try {
      await connection.write(request)
      return await connection.read(16384) // 一块响应数据；对端 EOF 时为 null
    } finally { await connection.close() }
  } finally { await tunnel.close() }
}
```

最多共享一条原生隧道，容纳四个 TCP 连接（含挂起建连）和 16 个存活或清理中的句柄。每次读写最多 16384 字节，每个连接最多一个待完成读取和写入。read 的 maximum 为 1–16384，空闲读取 120 秒超时。所有操作仅允许原始活跃脚本。脚本退出只释放自己的句柄及连接；自身 VPN 停止及相关意图/配置变化只关闭绑定 Scripting 反射的会话。close 等待当前句柄清理；最后一个句柄释放并完成子连接清理后回收底层隧道，旧句柄不能关闭替代会话。传输失败时已验证的缓存字节仍可先读出，再报告错误。getState 提供协商地址、MTU、RSD 端口、状态和有界缓存数量。请保留句柄并在结束时关闭。

## 迁移

独立全局 `LocalDevVPN` 已移除。将 `LocalDevVPN.getState()`、`LocalDevVPN.setEnabled(...)` 改为 `VPN.localDevVPN.getState()`、`VPN.localDevVPN.setEnabled(...)`；移除从 scripting 导入这些 API 的代码，参考最新文档与 SDK 的全局声明。设备意图/RSD 权限仍为 localDevVPN，VPN 启停方法无需脚本授权。

VPN 的状态查询、启动和停止分别最多允许一个待完成请求；启动期间仍可查询状态或停止。隧道最多允许四个待完成的连接请求；隧道的状态查询与关闭、连接的 end 与 close 分别最多允许一个同类待完成请求。再次发起同类请求前请等待完成。

### 外部 VPN 提供本机反射

可以先连接其他代理 App 或 wloc 的本机隧道，再直接调用全局 `VPN.localDevVPN.openRSDTunnel`，无需 import，也无需调用 `VPN.start()` 或要求 `effectiveStatus === "active"`。`getState()` 仍只描述 Scripting 自身，不读取或控制其他 App 的 VPN。实际 PSK 握手和服务回包用于证明可达性；不会提前探测一次性 listener。host 必须是有效的数值 IPv4，特殊、环回、组播及 FakeIP 地址会拒绝。配对流程需先取得本次 PSK 和新的 listener 端口。

脚本退出和显式 close 会释放所有路径的会话。只有绑定已验证 Scripting 反射的会话会随自身 VPN 停止或相关配置变更关闭；外部路由会话不受这些开关影响，真实传输失败仍会报告。`VPN.stop()` 只停止 Scripting 自身。


## RSD 生命周期诊断

`await tunnel.getState()` 通过 `closedReason` 表示显式生命周期清理，通过 `terminalError` 保留**首次底层终止故障**，没有故障时为 `null`。后续显式清理不会抹掉此前故障。诊断包含 `code`、`stage`、`nativeDomain`、`nativeCode`，可选 `networkErrorCategory` 与数字 `networkErrorCode`。RSD Promise 的错误也附带相同诊断字段，已关闭会话的 reject 还提供 `closedReason`；权限错误保留原有权限字段。

常见错误为 `RSD_SESSION_CLOSED`、`RSD_STREAM_CLOSED`、`RSD_TRANSPORT_EOF`、`RSD_TRANSPORT_TIMEOUT`、`RSD_TCP_TIMEOUT`、`RSD_PEER_RESET`、`RSD_NETWORK_FAILURE`、`RSD_PROTOCOL_ERROR`、`RSD_CANCELLED`。不能仅凭 NSError 数字（包括 0）判断 iOS 已终止或挂起 App。单条 TCP reset 不一定关闭整个隧道，应同时查看操作错误和隧道状态；保活状态不能代替该检查。

```ts
// VPN 为全局对象；tunnel 来自上文 openRSDTunnel 的返回值。
async function inspectTunnel(tunnel: VPNRSDTunnel) {
  const state = await tunnel.getState()
  console.log(state.state, state.closedReason, state.terminalError)
}
```

## 处理访问错误

网络操作会在开始前检查访问权限，可能抛出或拒绝并返回 `error.code === "ERR_PRO_REQUIRED"`。连接或监听前应安装 socket/server 错误回调，并捕获 Bonjour、VPN API 的 Promise 拒绝。请将清理放在 `finally` 中：访问权限到期后仍可关闭 socket 和 RSD 会话、停止 Bonjour 资源、调用 `VPN.stop()` 或关闭 `VPN.localDevVPN`。

## 打开期限与取消

`openRSDTunnel({...options, timeout:5000})` 可设置毫秒期限（100...120000 的整数），从授权完成开始，覆盖旧连接清理等待、路由采样、TLS 和会话发布，权限弹窗耗时不计入。省略时保留原有策略，包括 transport 的 10 秒启动计时。到期拒绝，错误为 `RSD_OPEN_TIMEOUT` / `TimeoutError`。

`await VPN.localDevVPN.cancelRSDTunnelOpening()` 只取消当前 context 的待打开或附着请求并等待原生清理；已建立会话仍需用 `tunnel.close()`。打开请求以 `RSD_CANCELLED` / `AbortError` 拒绝。若脚本权限弹框在等待用户，取消会阻止网络准入，完成仍需等弹框结束。访问失效后仍可清理；重试前必须重新创建配对 listener。

期限到达会触发取消；拒绝需等待必要原生清理完成，因此实际返回可能稍晚。

## 跨脚本共享与按端口关闭

若脚本 A 使用全局 `ScriptSession.serve` 提供 `ensureTunnel` 服务，调用方可以先请求准备，再取得自己的句柄。A 应从服务回调返回并继续保留自身句柄；调用 `Script.exit(result)` 会释放 A 的资源。这个服务命令由 A 实现，不是 VPN 内置命令。

```ts
// ScriptSession 与 VPN 均为全局 API，无需导入。
async function usePreparedTunnel<T>(use: (tunnel: VPNRSDTunnel) => Promise<T>): Promise<T> {
  await ScriptSession.call({ name: "A", message: { command: "ensureTunnel" }, timeout: 180000 })
  const tunnel = await VPN.localDevVPN.attachRSDTunnel()
  if (!tunnel) throw Error("The prepared tunnel is no longer available")
  try { return await use(tunnel) }
  finally { await tunnel.close() }
}
```

服务回复是 JSON 状态，不是可转交的隧道句柄或配对密钥。接收者仍需独立取得设备访问授权。若 A 希望交接后退出，应在成功 attach 后，再向 A 确认交接完成。

接收脚本可以调用 `VPN.localDevVPN.attachRSDTunnel()`，取得 Scripting 已就绪原生隧道的独立句柄，无需接收配对凭据或打开参数。每个接收脚本都需独立申请 `localDevVPN` 权限。没有就绪的原生隧道（包括正在打开或关闭）时返回 `null`；权限拒绝或传输失效则拒绝。它不会新建隧道。创建脚本需保留句柄直到接收脚本附着成功；之后任一脚本关闭或退出不会关闭另一方的句柄，最后一个句柄释放后回收原生隧道。

共享仅限同一 App 主进程，不包括扩展进程或其他 App 内存中的隧道。外部 VPN 可以提供反射，但仍需先由 Scripting 脚本打开原生 RSD 隧道；脚本之间不传递句柄或配对密钥。`attachRSDTunnel()` 在授权完成后有 30 秒期限，`cancelRSDTunnelOpening()` 也可取消当前 context 待完成的附着。每个 context 的打开和附着合计只能有一个待完成请求。

```ts
// 以下 API 和类型均为全局定义，无需导入。
async function querySharedDevice(): Promise<DeviceServices.PlistValue | null> {
  const tunnel = await VPN.localDevVPN.attachRSDTunnel()
  if (!tunnel) return null // 先由创建流程打开隧道。
  let session: DeviceServices.RSDSession | undefined
  try {
    session = await DeviceServices.openRSDSession(tunnel)
    const service = await session.openService({
      serviceName: "com.apple.mobile.diagnostics_relay.shim.remote",
    })
    await service.connection.writePlist({ Request: "IORegistry", EntryClass: "IOPMPowerSource" })
    return await service.connection.readPlist()
  } finally {
    await session?.close()
    await tunnel.close()
  }
}
```

仍支持携带匹配参数的 `openRSDTunnel` 路径。匹配指外层 host/port、协商后的 `preSharedKey` 字节、identity 和请求的 MTU 一致，不是仅使用同一份保存的配对记录或同一个内部服务端口。配置或路由安全绑定不匹配时明确拒绝，不替换已有使用者的隧道。

整条原生隧道最多 16 个存活或清理中的句柄，最多 4 条连接（包括挂起建连）。共享句柄遵循以下规则：

```ts
async function closeOwnedPort(tunnel: VPNRSDTunnel, port: number) {
  await tunnel.closeConnections({ port })
  // 句柄保持打开；之后 connect 可创建新的独立连接。
}
```

按端口关闭仅作用于接收调用的句柄，包含实际处理关闭时已经登记的匹配挂起建连，不关闭其他句柄连向同一端口的连接。关闭指定的一条流使用 `connection.close()`。父句柄关闭也会关闭已被 DeviceServices/AFC 接管的流。连接数为零时，只要仍持有句柄就不回收隧道。脚本退出或显式 close 释放自己的句柄及连接；最后一个句柄释放并清理完子连接后自动回收原生隧道，不关闭外部 VPN 或其他功能仍在使用的 Scripting VPN。`getState()` 的连接数和缓冲字节数仅统计当前句柄。

**行为变化：** `tunnel.close()` 现在释放当前句柄，不再强制断开共享原生隧道的所有使用者。单句柄脚本的清理效果一致；依赖全局断开的脚本应逐一关闭自己持有的句柄，RSD 句柄接口不提供跨所有者强制关闭操作；应用级 VPN 停止或安全绑定失效仍会使相应共享句柄失效。请参照本文和最新 SDK 更新生命周期处理。

## RSD 服务目录

`VPN`、`VPNRSDTunnel` 均为全局定义，无需导入。已打开的隧道可通过 `listServices()` 查询并缓存设备公布的服务目录。结果包含 `name`、`port`、`usesRemoteXPC` 和 `entitlement`；后者是设备公布的权限标识字符串，未提供时为 `null`，并不授予设备权限。

```ts
async function findServices(tunnel: VPNRSDTunnel) {
  const services = await tunnel.listServices()
  const instruments = await tunnel.resolveService({
    serviceName: "com.apple.instruments.dtservicehub",
  })
  return { services, instruments }
}

async function withRawInstruments<T>(
  tunnel: VPNRSDTunnel,
  use: (connection: VPNRSDConnection) => Promise<T>,
): Promise<T> {
  const connection = await tunnel.connect({
    serviceName: "com.apple.instruments.dtservicehub",
    timeout: 30000,
  })
  try {
    return await use(connection) // 使用脚本自己的 DTX 实现，不自动进行 plist check-in。
  } finally {
    await connection.close()
  }
}
```

名称精确匹配，不使用别名或猜测端口。`connect` 必须在 `port`、`serviceName` 中选一个，返回原有的原始字节连接。`timeout` 是解析及连接的总期限，单位毫秒，范围 1–300000，默认 30000。`resolveService` 仅解析名称，不连接具体服务；找不到时抛出 `RSD_SERVICE_NOT_FOUND`。

目录快照归共享的原生隧道所有；`listServices({ refresh: true })` 替换快照，新隧道不复用旧缓存。已有服务连接仍使用各自独立的流；修改返回的元数据不会修改原生缓存。查询失败不会永久缓存失败或重放业务请求。目录查询临时占用原有四连接额度中的一个，满额时抛出 `RSD_QUOTA`。每个句柄的 `listServices` 与 `resolveService` 合计最多 16 个待处理调用；所有查询调用（含打开服务时的查询）共享原生隧道的 64 个等待者上限。某个请求超时或句柄关闭不会取消其他等待者。DTX、RemoteXPC 业务消息等服务专用协议仍由脚本实现。

## 原生 Data 输入与流方法

`Data` 是 Scripting 注入的全局二进制对象，无须导入。`preSharedKey` 支持 `Data | Uint8Array | ArrayBuffer`，长度必须恰好 32 字节。`write` 与 `writeData` 在调用准入时取得字节快照，之后修改输入不会改变已提交操作。`writeData` 仅接收原生 `Data`，`write` 支持以上三种类型；每次写入仍最多 16384 字节。空写入不表示 EOF，应使用 `end()` 发送 FIN。

`readData(maximum?)` 返回原生 `Data` 数据块，对端 EOF 返回 `null`；一次调用不保证读完一条协议消息。`read` 保持返回 `Uint8Array | null`。两者默认最多读取 16384 字节，maximum 必须为 1–16384 的整数，并共用一个待处理读取槽；`write/writeData` 共用一个待处理写入槽，混用名称不能绕过并发限制。错误通过 reject 报告，不以 `null` 代替。连接被 adopt 或关闭后，两组方法均不能继续读写。

```ts
// VPN、Data 和 VPNRSDTunnel 都是全局定义；使用调用者自己的已打开隧道句柄。
async function exchangeNativeData(tunnel: VPNRSDTunnel, port: number, body: Data): Promise<Data | null> {
  const connection = await tunnel.connect({ port })
  try {
    await connection.writeData(body) // body.size 必须 <= 16384
    return await connection.readData(16384) // 一个数据块，不保证是完整响应
  } finally {
    await connection.close()
  }
}
```
