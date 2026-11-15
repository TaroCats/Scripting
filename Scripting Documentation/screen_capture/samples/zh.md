# 屏幕采集：视频、音频与时钟

需要最初样本时，在启动前挂载 `addVideoOutput({maxFPS?, buffering?})` 和 `addAudioOutput({source, buffering?})`。音频来源为 `system` 或 `microphone`。系统声音要求 `configuration.capturesAudio`，麦克风要求用户在选择器启用。麦克风实际格式独立于系统音频的 sampleRate/channelCount 配置。

每个输出提供单消费者异步序列 `samples`、`closed`、`getStatistics()`、`onError` 和 `dispose()`。退出迭代仅移除该输出，不停止会话，也不释放脚本仍持有的样本。每个已交付样本务必在 `finally` 中 dispose。复制方法返回独立 `Data`，释放原样本不影响已复制数据。

视频提供 `hasImage`、可空 `format`、帧 `metadata`、`toImage()`、`copyPixelPlanes()` 和 `dispose()`。仅状态样本可能没有像素，先检查 `hasImage`。各平面保留原生宽高、`bytesPerRow` 和行填充。格式/FourCC、位深及 attachments 描述实际缓冲区，不要假设 RGBA、固定格式或 SDR。

音频提供实际 ASBD 字段、可选通道布局字节、`sampleCount`；`copyAudioBuffers()` 返回原生缓冲数据和通道数。不要假设交错布局、Float32 或固定麦克风格式。`discontinuity: true` 标识已知桥接交付丢失，`null` 表示原生连续性未知。需结合时间戳检查来源不连续并进行下游重同步。

默认视频 capacity=1 / `dropOldest`，音频 capacity=32 / `error`。可自定义容量及 `overflow: dropOldest | dropNewest | error`。队列在派发 JS 前即有界，原生不会等待 JS。`maxFPS` 仅限制视频交付频率，不修改原生采集频率。慢消费者明确丢弃或失败，原生录像不经过这些 JS 队列；脚本自行持有样本产生的内存由脚本负责。

时钟使用原生 CMTime：`value`/`epoch` 为 bigint，同时保留 timescale、flags 和可空 seconds。同步时保留有理数。`session.timing.currentTime()` 在可用时读取流时钟；仅可转换时返回 `hostTimeSeconds`。不能用回调到达顺序推断音视频同步。结合帧状态、activity、selection、metadata 和统计诊断。

## index.tsx

请在主 App 中运行示例。系统选择器需要用户操作；“Stop / Cancel”按钮和关闭脚本都会清理该脚本拥有的会话。

点击文档的示例入口即可运行，完整代码见同级 [index.tsx](index.tsx)。
