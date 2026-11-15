# 屏幕采集：HDR 与配置

`configuration` 支持 `width`、`height`、`capturesAudio`、`sampleRate`、`channelCount`、`excludesCurrentProcessAudio`、`captureDynamicRange` 和 `preset`。未提供的字段保留原生默认值。系统声音采样率/通道数不强制麦克风格式。`session.configuration` 返回解析后的配置，各样本实际 `format` 决定输出细节。

动态范围为 `sdr | hdrCanonicalDisplay`；`hdrRecordingPreservedSDRHDR10` 使用系统 HDR 录像预设，显式配置字段随后覆盖预设。仍受原生来源、设备、编码限制，发起 HDR 请求不证明内容实际为 HDR；应检查位深、像素格式、颜色/HDR attachments。iOS 框架不支持 hdrLocalDisplay、目标原生帧率、自选像素格式、源/目标裁剪或实时重配置，因此 API 不会暗中模拟。

`toImage({dynamicRange: "preserve"})` 和图片快捷入口在 UIImage 中保留扩展范围，`sdr` 才显式色调映射。后续使用仅支持 SDR 的编码/展示路径可能降低范围。`copyPixelPlanes()` 保留原始字节及颜色附件供高级处理。HDR 录像从 `getRecordingCapabilities()` 选取支持的编码容器，保留原生输出，避免通过 JPEG 中转。整屏或受保护内容仍由系统控制。

## index.tsx

请在主 App 中运行示例。系统选择器需要用户操作；“Stop / Cancel”按钮和关闭脚本都会清理该脚本拥有的会话。

点击文档的示例入口即可运行，完整代码见同级 [index.tsx](index.tsx)。
