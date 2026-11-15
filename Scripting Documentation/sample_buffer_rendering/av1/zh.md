# AV1 MP4 解码

系统缺少合适的解码器时，`MediaSampleReader` 可用软件解码本地 AV1 MP4 视频。音频继续通过现有系统读取器处理。需要在 iOS 17 或更高版本的主 App 中运行。

## 选择解码器

创建解码后的**视频**读取器时可传入 `decoder`：

- `"auto"`（默认）：先尝试系统解码；在交付解码结果前发现系统缺少 AV1 解码器时，改用软件解码。
- `"system"`：只走系统路径；解码器不可用时拒绝操作，不会自动改用软件。
- `"software"`：使用 AV1 软件解码器；其它视频编码以 `unsupportedCodec` 拒绝。

音频或 `decoded: false` 不能显式设置 decoder。`decoded: false` 仍返回原始压缩样本和标记。软件解码目前要求本地 `.mp4` 或 `.m4v` 文件；这项功能不新增 WebM/MKV、网络流或受保护媒体支持。

## 准备和查看信息

`await MediaSampleReader.getCapabilities()` 返回 `av1.hardwareDecodeSupported` 和 `av1.softwareDecodeAvailable`。它们只是能力提示，不保证某个文件可播放或达到实时速度。

`await reader.prepare()` 选择后端，并为后续读取保留初始样本；重复调用不会消耗帧。它是可选的，首次 `copyNextSampleBuffer()` 会隐式准备。准备前 `reader.info` 为 null，之后提供：

| 字段 | 含义 |
|---|---|
| `codec` | 源编码的四字符标识，如 `av01` |
| `decoded` | 是否输出解码后的样本 |
| `decoderBackend` | `system`、`dav1d` 或 `passthrough` |
| `hardwareAccelerated` | 软件为 false；系统路径无法报告实际使用情况时为 null |
| `width`、`height` | 可用时的视频尺寸 |
| `bitDepth`、`pixelFormat` | 可用时的准备输出特征，格式为 BGRA、NV12 或 P010 |

## 输出、限制与错误

软件输出支持尺寸为偶数、最大 3840 × 2160 的 4:2:0 8/10-bit 视频，保留源时间戳和全范围/视频范围。支持的颜色信息会保留；不支持的配置、颜色编码或辅助元数据会明确拒绝，不会静默改变画面。AV1 码流中的 HDR 母版元数据，以及 ITU-T T.35 辅助元数据暂不支持。HDR 显示效果和实时性能取决于媒体与设备。软件播放，尤其是 4K 10-bit，可能丢帧；支持该格式不代表能流畅实时播放。

解码器限制参考帧内存，使用四个输出缓冲区。每次 enqueue 完成后应 dispose 样本。输出缓冲区仍被持有时，读取会等待空位；关闭可取消等待，超过 30 秒会以 `resourceLimit` 拒绝。同时限制每脚本两个、每进程四个软件解码器。这些是保护限制，不代表吞吐能力。

错误区分 `decoderUnavailable`、`unsupportedCodec`、`unsupportedFormat`、`unsupportedContainer`、`invalidData`、`resourceLimit` 和关闭/无效状态。自动回退不会掩盖损坏数据、权限拒绝或取消，也不会在播放中途切换后端。只有正常 EOF 返回 null。发生错误或失去访问权限后，也应释放读取器和样本。

## 运行示例

点击文档的示例入口即可运行，完整代码见同级 [index.tsx](index.tsx)。选择 Auto、System 或 Software，再选择 AV1 MP4。页面显示实际后端、视频和文件中系统支持的音轨，并提供暂停、继续、停止及关闭。在缺少系统 AV1 解码器的设备上，System 应报告错误，Auto/Software 可解码支持的文件。示例不使用顶层 await，也不需要外部下载。

示例先预载音视频，再启动共享时钟，并限制提前提交的范围。单次预读让解码与提交重叠；清理时取消预读并释放迟到的样本。暂停/继续只改变速率，不改变播放位置。读取结束后保留最后画面，直到停止、关闭或选择其它文件；到达时间戳不代表硬件已确认画面呈现。

示例借用共享音频会话，关闭时不会停用其它脚本的会话。大尺寸、高帧率视频可能消耗较多 CPU 和内存；能力查询不保证所有设备都能流畅播放 4K。
