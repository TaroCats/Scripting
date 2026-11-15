# 读取和管理样本

`await MediaSampleReader.create(asset, "video" | "audio", { decoded: true, trackIndex: 0 })` 打开一条轨道。系统视频解码输出 BGRA，AV1 软件解码输出 NV12/P010，音频输出交错 Float32 PCM。`decoded: false` 保留压缩包和原始编码描述，压缩样本能否渲染由系统决定；已有 AVAssetReader 图片／数组接口不变。

解码视频还可设置 `decoder: "auto" | "system" | "software"`。默认 auto 模式在系统缺少解码器时，可对支持的本地 AV1 MP4 使用软件解码。`getCapabilities()` 提供能力提示；可选的 `prepare()` 和只读 `info` 用于查看实际后端，不会消耗首帧。限制和完整示例见 [AV1 MP4 解码](../av1/zh.md)。

`copyNextSampleBuffer()` 返回独立持有的 MediaSample，仅正常读完时返回 null。取消和解码失败会拒绝 Promise。同一读取器只能有一个待完成读取。样本提供 mediaType、presentationTime、decodeTime、duration、sampleCount 和 disposed；时间使用 MediaTime 保留原生精度。duration 可能无效或不确定，使用前应检查。enqueue 结束后在 finally 中 dispose，原生渲染队列独立保留所需数据。

iOS 27 的 `ScreenCapture.Sample.toMediaSample()` 可创建独立样本，无需转成 UIImage／JS 数组。视频仅允许转换完整帧，仍遵循捕获源授权，且需把捕获时间戳锚定到播放时钟。释放捕获源样本不会释放转换后的句柄。

每个脚本最多持有 128 个样本及 64 MiB 样本数据；渲染队列另有限额。这不代表系统解码器的总内存上限。句柄只属于当前脚本，不可跨执行环境传递。

直通读取保留无媒体负载的排空／空编辑标记，通过 isMarker 识别。仍应按原顺序提交这些标记，使用其时间前检查 isNumeric。

## index.tsx

点击文档的示例入口即可运行，完整代码见同级 [index.tsx](index.tsx)。
