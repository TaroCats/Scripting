# 格式、PCM 与转换

`AVAudioFormat` 描述采样率、声道/布局、样本类型和交错方式。PCM 数组支持 float32、float64、int16、int32。平面数据每声道一个数组；交错数据按帧排列，例如 L,R,L,R。也可通过原生文件/编码设置创建压缩格式；这种格式不能直接读取 PCM 样本。

`AVAudioChannelLayout` 接受布局标签、声道位图或各声道描述，`copyData()` 返回独立的原生布局快照。`AVAudioTime` 可提供主机时钟、样本时间或两者。主机时钟以十进制字符串保存完整 UInt64 精度；样本时间使用 JavaScript 可精确表达的整数。

`AVAudioPCMBuffer.allocate()` 的初始 frameLength 为 0，容量中的样本已清零。使用样本前设置长度。`fromChannels()` / `fromInterleaved()` 会复制数组，此后修改源数组不会改变原生音频。`copyChannels()`、`copyInterleaved()`、`copy()` 也返回独立副本。原生使用结束后应 dispose；播放器仍持有的排期缓冲区不能修改或销毁。

## 分块处理

使用较小的 PCM 块。能力报告列出每脚本及每操作的保护限额；过大的复制或过多活动缓冲区会被拒绝。Source/manual-input 的 enqueue 明确返回接纳帧数，调用者应保留并继续提交未接纳的尾部；队列满时不会无限缓存。

`AVAudioCompressedBuffer` 保存复制后的压缩包及可选的可变包描述，不把编码数据当作 PCM。PCM/编码转换使用 `AVAudioConverter`：先配置，再调用 `convert(inputs, outputCapacity)`；容量根据输出格式表示 PCM 帧或压缩包。原生尚未请求的输入留待后续调用。只在最后一个输入标记 `endOfStream: true`，然后用 `convert([], capacity)` 排空至 endOfStream。失败后先 reset 再输入；不要每块都 reset，否则会丢弃转换状态和待处理输入。选择编码专属选项前先读取实际能力和配置。

## 音频文件

使用 AVAudioFile.openForReading(path,options) 打开本地文件，或用 openForWriting(path,settings,options) 创建写入句柄。写 PCM 前读取 processingFormat，缓冲区格式必须匹配；fileFormat 表示保存的编码格式。getState() 返回长度、游标、模式和关闭状态；read(frameCount) 返回独立 PCM（EOF 为零帧），seek(frame) 移动游标，write(buffer) 编码原生 PCM 块。数据格式不匹配时，可先用 Converter 转为文件的处理格式。

写入使用自有临时文件，close() 完成编码并发布；除非明确 overwrite，否则不会覆盖已有目标。应在 finally 中明确 close；未关闭的写入句柄被回收/退出时，只丢弃其自身尚未发布的临时文件。读取句柄的关闭不申请新的文件权限。排队操作执行前若文件权限发生变化，会拒绝执行；写入句柄在失去文件权限后关闭时，只完成临时文件，不替换目标，并以 permissionDenied 拒绝，partialFilePath 提供保留的恢复文件。重新授权后，可对仍保留的句柄再次明确 close 发布，或通过文件访问复制恢复文件。文件收尾失败时，也应继续清理其它音频图资源。

## 完整 index.tsx

示例不使用麦克风或设备播放，演示独立 PCM 副本、Float32 转 Int16，以及可选的临时 CAF 写入、读取、定位与 EOF 往返。文件按钮另申请文件访问；关闭示例时删除其自有临时文件。

点击文档的示例入口即可运行，完整代码见同级 [index.tsx](index.tsx)。
