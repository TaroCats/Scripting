# 远程更新小组件和 Live Activity

远程更新把数据发送给已经授权的小组件配置或 Live Activity，由接收端脚本定义界面。App 中运行的脚本或外部服务器通过 Scripting 的 Remote Push 服务提交 JSON 状态。

普通通知密钥和 `/push` 用于发送通知，不会自动更新小组件或 Live Activity。本 API 使用独立的目标 ID 和受限发送凭据。APNs token 由原生代码管理，脚本不需要也不能自行提供。


## 工作流程

1. 在接收设备连接远程推送。
2. 授权小组件脚本，或准备 Live Activity 渲染模板。
3. 原生代码登记系统 token，生成逻辑目标 ID。
4. App 脚本或外部服务器提交 JSON 状态，由服务发送相应的 APNs 信号。

配置完成后，入口脚本可以退出。WidgetKit 和 ActivityKit 决定实际显示时机，APNs 接受请求不代表设备已显示更新。

## API

| API | 用途 |
|---|---|
| `Widget.remoteUpdates` | 授权小组件、查找目标、读取状态。 |
| `LiveActivity` 实例的 `remoteUpdates` | 准备远程启动、查询活动登记状态。 |
| `RemotePush.widgets` | 更新状态或请求刷新。 |
| `RemotePush.liveActivities` | 启动、更新和结束活动。 |
| `RemotePush.getCapabilities()` / `getOperation(id)` | 查询能力和发送进度。 |

小组件更新需要 iOS 26 或更高版本；本地启动可远程更新的活动需要 iOS 17，远程启动需要 iOS 17.2。请在接收设备检查能力。

## 每日额度

远程更新与普通通知共用账户的每日推送额度，按 UTC 日期计算。排队时预占额度，APNs 接受后按实际投递结算；不同接收设备分别计费；合并的小组件信号只计一次，内部重试不会重复扣除。明确失败或发送前取消会释放额度，结果不确定的投递保留其发送日的占用。不带新状态的结束和撤销属于免费清理操作。

## 标识、状态与回执

| 值 | 含义 |
|---|---|
| `targetId` | 一个小组件状态目标，或一个 Activity 实例，用于 update/end。 |
| `startTargetId` | 为将来远程启动准备的接收端/builder 授权，不是活动实例。 |
| `activityId` | 原生 ActivityKit 标识，用于本地 `LiveActivity` 对象。 |
| `launchRequestId` | 一次创建意图，用于核对不确定的启动结果。 |
| `templateVersion` | 不可变渲染包版本；现有实例继续使用固定的旧版本。 |

`RemoteTarget.status` 包含 `ready`、`pending`、`disabled`（可附 reason）和 `notConfigured`。ready 表示已登记远程操作地址，不表示已投递或已显示。正在结束或已结束的目标是 disabled。暂停不会结束活动，恢复也不会复活已结束实例。撤销后旧凭据和旧回调不能恢复权限；主动重新授权会创建新的权限范围。

写操作返回 `{ targetId, revision, stateCommitted, launchRequestId?, operation }`。`stateCommitted` 区分业务状态已持久化与推送传输进度。operation 状态为 `queued`、`dispatching`、`accepted`、`failed`、`unknown`、`superseded`、`cancelled` 或 `expired`。`RemotePush.getOperation(operationId)` 查询调用脚本有权访问的操作。较新的纯状态 update 可以替换较旧的排队 update；end 会取消等待中的 update。


## 详细文档

- [小组件远程更新](scripting://doc?title=Widget%20Remote%20Updates)
- [Live Activity 远程更新](scripting://doc?title=Live%20Activity%20Remote%20Updates)
- [服务端 HTTP API](scripting://doc?title=Remote%20Updates%20HTTP%20API)
