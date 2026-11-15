# 屏幕采集：会话与授权

`ScreenCapture` 是 iOS/iPadOS 27 及以上的全局 API，用于仍在运行的主 App 脚本。打开系统选择器、录制预览时，需要该脚本自己的可见前台界面。小组件、扩展、工作线程 JS 上下文不能展示这些界面。`isSupported` 表示运行时支持，`isAvailable` 还考虑 App 请求开关和系统当前状态；二者都不是授权结果。

设置 → 权限 → 允许请求屏幕采集决定脚本能否发起请求；每个脚本还需 `screenCapture` 权限。每个新会话均由 Apple 内容共享选择器授权，用户选择共享内容及是否启用麦克风/相机。App 开关不代表永久系统授权，关闭后会停止已有会话。麦克风、相机各自需要系统权限；写文件还需要脚本 `fileSystem` 权限。只有另行保存到照片图库时才需要照片权限。

| 入口 | 行为 |
| --- | --- |
| `createSession(options?)` | 授权后返回 `ready` 会话，不启动。可在 `start()` 前挂载录像/原始输出，包含最初样本。 |
| `start(options?)` | 授权并启动，返回运行中的会话。 |
| `capture(options?)` | 授权、启动、可选延时、返回一张新画面，成功失败均停止。 |
| `presentRecordingEditor(path)` | 展示已完成本地录像的系统编辑器，关闭后完成 Promise。 |

`scope` 默认 `display`，请求整个屏幕并核对返回结果；`app` 使用应用内共享，`system` 交给系统决定选择样式。`session.selection` 返回实际样式、内容矩形、像素比例及麦克风/相机选择结果。`picker.showsMicrophoneControl`、`showsCameraControl` 只是显示系统选项，不会强行启用设备。相机效果要求 `app` 范围。

状态为 `ready → starting → running → stopping → stopped/failed`。`stop()` 幂等，停止输出并等待原生采集终止、录制文件完成，再返回 `ScreenCaptureEnd`。`closed` 在正常或系统终止后返回相同结果。原生停止失败时拒绝 `stopFailed`，保留所有权供重试；输出错误与会话错误分别报告。`closed.recordings` 只含终止时附着的录像；之前独立移除的录像使用其 `finished` 获取结果。

`signal` 管理整个会话生命周期：选择过程中 abort 会取消该请求，创建后 abort 会停止该会话。访问权限撤销后仍可停止和释放。系统终止后重新采集需要新会话和新授权，不会自动重连。

继续阅读：[图片](images/zh.md)、[原始样本与时钟](samples/zh.md)、[录像与预览](recording/zh.md)、[滚动片段](clips/zh.md)、[相机效果](camera/zh.md)、[HDR](hdr/zh.md)。

## 配置与事件

省略配置字段时保留原生默认值。系统可能调整或拒绝请求的尺寸和音频格式；请同时查看样本的实际格式与 `session.configuration`。

| 配置 | 用途 |
| --- | --- |
| `width`、`height` | 请求的输出尺寸，必须为正整数。 |
| `capturesAudio` | 包含系统声音；麦克风仍由系统选择器单独选择。 |
| `sampleRate`、`channelCount` | 请求的系统音频采样率和声道数，必须为正整数。 |
| `excludesCurrentProcessAudio` | 从系统声音中排除本 App 自身的声音。 |
| `captureDynamicRange` | `sdr` 或 `hdrCanonicalDisplay`。 |
| `preset` | `hdrRecordingPreservedSDRHDR10`，单独提供的字段覆盖预设。 |

`onStateChanged`、`onFrameStatusChanged` 和 `onActivityChanged` 分别报告生命周期、原生帧状态及活动状态。将回调设为 `null` 可移除监听。活动状态与可用性用于诊断；实际样本或已完成文件才证明采集成功。`getStatistics()` 报告当前样本输出与已知丢失，不代表原生框架的全部内存占用。

处理 `ScreenCaptureError.code` 及可选的 `nativeDomain`、`nativeCode`。用户取消对应 `userCancelled`，信号取消对应 `aborted`，参数错误对应 `invalidArgument`；系统失败保留原生错误信息。失败会话不能重启，应完成清理后新建会话并重新进行系统选择。使用 `try/finally` 并等待停止完成；捕获到错误本身不代表原生采集已经停止。

## index.tsx

请在主 App 中运行示例。系统选择器需要用户操作；“Stop / Cancel”按钮和关闭脚本都会清理该脚本拥有的会话。

点击文档的示例入口即可运行，完整代码见同级 [index.tsx](index.tsx)。
