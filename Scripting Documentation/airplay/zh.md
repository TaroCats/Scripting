# AirPlay

Scripting 3.2.2 新增。`AirPlay`、`AVRouteDetector`、`SharedAudioSession` 和 `AVPlayer` 是原生全局 API；JSX 控件 `AirPlayRoutePicker` 从 `"scripting"` 导入。

选择面板、路由检测器和新增会话操作需要主 App 脚本环境。选择与播放路由准备还要求脚本处于前台且可见。小组件、App 扩展、远程渲染和后台 JS 线程不提供这些 UI 能力。原有音频会话方法保持既有行为。

访问被拒绝时，Promise 操作会被拒绝，同步控制会抛出异常，错误具有 `name: "NotAllowedError"` 和 `code: "ERR_PRO_REQUIRED"`。关闭面板、停止检测和释放资源仍可用于清理。

## 选择输出

```ts
async function main() {
  await AirPlay.presentRoutePicker({ prioritizesVideoDevices: true })
}

main().catch(console.error)
```

此方法打开一个包含 Apple 原生 AirPlay 按钮的面板。**还需点击按钮，才会打开系统目的地菜单。** Promise 在面板关闭（包括取消）时完成，不返回所选设备，不表示连接或播放成功。环境不支持、没有前台宿主或已有面板打开时以 Error 拒绝；参数无效时以 TypeError 拒绝。`prioritizesVideoDevices` 默认为 false。打开面板不会配置、激活音频会话或开始播放。

在脚本页面直接显示输出按钮，参见 [AirPlayRoutePicker](../views/airplay_route_picker/zh.md)。

## 配置共享音频会话

```ts
async function main() {
  await SharedAudioSession.configure({
    category: "playback",
    mode: "moviePlayback",
    routeSharingPolicy: "longFormVideo"
  })
  const policy = await SharedAudioSession.routeSharingPolicy
  console.log(policy)
}

main().catch(console.error)
```

`configure(options): Promise<void>` 通过一次系统调用设置 category、mode、policy 和类别选项。`category` 必填，其余默认值是 `mode: "default"`、`routeSharingPolicy: "default"`、`options: []`，不会自动激活会话。配置影响当前进程内共用会话的所有脚本，脚本退出时不会自动恢复。原有 `setCategory`、`setMode` 继续可用；混用 setter 后应读取当前实际配置，不应假定之前的策略仍然有效。

可写策略为 `default`、`longFormAudio`、`longFormVideo`。只读策略还可能是系统管理的 `independent`，或未来系统值对应的 `unknown`。长内容策略要求 category 为 `playback`，mode 为 `default`、`moviePlayback` 或 `spokenAudio`，且不带类别选项。显式 `allowAirPlay` 只适用于 `playAndRecord`；`playback` 隐式支持 AirPlay。无效参数以 TypeError 拒绝，系统配置错误以 Error 拒绝，不会静默丢弃无效选项。

播放长视频前，可将脚本中已经创建并加载媒体的 `AVPlayer` 传入以下辅助函数：

```ts
async function preparePlayerForAirPlay(player: AVPlayer) {
  const preparation = await SharedAudioSession.prepareRouteSelectionForPlayback()
  if (preparation.shouldStartPlayback) {
    await SharedAudioSession.setActive(true)
    player.play()
  }
}
```

在已有播放流程中调用 `preparePlayerForAirPlay(player).catch(console.error)`。这里的 `player` 是你已有的播放器；播放期间保持其存活，并在原有播放清理流程中释放。

返回 `Promise<{shouldStartPlayback: boolean, routeSelection: "none" | "local" | "external" | "unknown"}>`。配置 `longFormVideo` 时，系统可能询问目的地，但不会每次调用都弹出菜单。结果表示可以开始播放，不证明媒体已送达接收端。若调用期间失去前台宿主，仍存活的请求会被拒绝；脚本销毁后不再执行 continuation。

## 观察音频路由

继续使用 `await SharedAudioSession.currentRoute` 及 `addRouteChangeListener` / `removeRouteChangeListener`。输出的 `portType` 为 `"airPlay"` 表示 AirPlay 音频路由；它独立于视频外部播放，也不能证明接收端已经发声。路由与监听器类型参见 [SharedAudioSession](../shared_audio_session/zh.md)。

## AVPlayer 视频外部播放

| 成员 | 含义 |
| --- | --- |
| `allowsExternalPlayback: boolean` | 是否允许视频外部播放，默认 true。设为 false 不会断开共享会话的 AirPlay 音频。 |
| `readonly isExternalPlaybackActive: boolean` | 当前播放器是否处于视频外部播放模式；不表示音频路由，也不限于无线输出。 |
| `usesExternalPlaybackWhileExternalScreenIsActive: boolean` | 外部屏幕活动期间自动切换到视频外部播放，默认 false，要求 allowsExternalPlayback 为 true。 |
| `externalPlaybackVideoGravity` | `"resize"`、`"resizeAspect"`（默认）或 `"resizeAspectFill"`，作用于外部视频。 |
| `onExternalPlaybackActiveChanged` | `(active: boolean) => void` 回调或 null；仅通知变化，不发送初始回调。 |

可在 `setSource` 前设置属性，换源后设置保留。先注册回调，再读取属性获取初始状态。`dispose()` 清理观察者和回调、释放播放资源。再次播放前先调用 `setSource`，并按需重新注册回调。外部播放控制在主 App 脚本环境执行。布尔属性要求真实布尔值，无效缩放模式或回调抛出 TypeError。

可配合 `VideoPlayer` 或两种渲染模式的 `AVPlayerView` 使用。Layer 模式没有原生播放控件，需要显式添加选择器。格式、DRM、鉴权媒体、请求 headers、本地文件及接收端可达性都可能影响播放；本机成功不保证外部播放成功。Now Playing 信息和远程命令继续使用现有 `MediaPlayer` API。

## 检测额外播放路由

```ts
const detector = new AVRouteDetector()
detector.onMultipleRoutesDetectedChanged = detected => console.log(detected)
detector.isRouteDetectionEnabled = true
console.log(detector.multipleRoutesDetected)
// 使用结束后：
detector.dispose()
```

检测默认关闭，会增加功耗。只读布尔值 `multipleRoutesDetected` 提示发现额外播放路由，不是设备清单，也不保证 AirPlay 接收器可连接。检测关闭或尚未发现时的 false 不证明附近没有接收器，不应仅据此隐藏选择器。

回调仅通知变化。不需要时应停止检测。App 失去 active 状态、脚本最小化或句柄/脚本销毁时会停止，返回后需显式重新开启。`dispose()` 幂等且不可复用，清空回调并停止检测；使用期间应保留检测器。无效启用值或回调抛出 Error，在非前台 App 脚本中启用也会抛出 Error。仅观察不会申请麦克风权限。

独立外屏图片和脚本 UI 展示不在本次 API 范围内。

[独立图片与 JSX 外屏展示](../external_display/zh.md) 使用系统的屏幕镜像连接。
