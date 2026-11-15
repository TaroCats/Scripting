# 输入、Tap、Sink 与语音处理

设备输入通过 `engine.getInputNode()` 申请麦克风权限。在配置共享音频会话和语音处理后，读取实际输出格式；采样率和声道数由设备及路由决定。手动输入节点使用提交的 PCM，不使用麦克风。

## 观察音频

`node.installTap({bus, format, maximumFrameCount, slotCount, overflow})` 观察输出总线，不改变图中的音频。每条总线只允许一个 Tap；关闭观察器或调用 `removeTap(bus)` 后再安装。Sink 没有输出总线，不能安装 Tap。

`AVAudioSinkNode.create({format, maximumFrameCount, slotCount, overflow})` 创建输入链接收器。attach 后使用声明的格式连接，并与设备输入链匹配。Sink 不转换格式，也不支持手动渲染。`sink.close()` 停止接收；detach/dispose 后释放原生节点的回调存储。

`read()` 返回独立 PCM 块；当前没有排队数据或观察器已关闭时返回 null。运行中的流返回 null 本身不代表输入结束。每个返回的缓冲区都需 dispose。数据块包含复制的音频时间、精确十进制字符串序号、discontinuity 和 renderEpoch；引擎重置或配置变化会划分渲染代次。缺少时间戳不等于时间为零。

观察队列有界。`dropOldest` 在队列满时保留较新数据；`latest` 用最新块替换排队观察；`error` 在溢出时明确报错。监测时检查统计和 discontinuity；不能接受缺口的录制选择 error，读取不及时时应停止并报告失败。失败队列需要关闭重建。系统可能提供不同于请求值的 Tap 块大小；maximumFrameCount 是存储上限，超限原生块明确失败，请按设备和格式选择足够上限。

## 语音处理

语音处理要求输入节点的输出格式与输出节点的输入格式在采样率、声道数上完全一致。应在停止状态下，将最后的混音节点用麦克风输入格式显式连接到 `await engine.getOutputNode()`；混音节点自动建立的输出连接可能使用不同格式。

更改 enabled 前先停止引擎。`configureVoiceProcessing()` 还控制旁路、自动增益、输入静音和其它音频的压低策略。切换模式后重新读取输入格式和连接；`getVoiceProcessing()` 返回实际状态。

`setSpeechActivityHandler()` 接收 Apple 在启用语音处理并用 inputMuted 静音输入时提供的说话活动通知。它不是通用语音检测或转写 API。事件为 started/ended，经过有界收集后异步交付；传 null 解除监听。回调不在音频渲染线程运行。Tap/Sink 的 JS 读取也在渲染线程之外，不能用这类观察接口同步生成当前渲染块。

## 完整 index.tsx

示例将 EQ 处理后的麦克风数据保存为临时 CAF，对比处理前后的 RMS，并支持语音处理和文件试听。默认关闭监听；佩戴耳机后再明确启用。丢失数据块会计为 discontinuity，不会隐藏缺口。停止后完成文件；路由变化/中断会停止采集，路由就绪后重新开始，以实际格式重建图。关闭页面前另存需要保留的文件。示例会激活/停用共享会话，请不要与其它设备音频脚本同时运行。

点击文档的示例入口即可运行，完整代码见同级 [index.tsx](index.tsx)。
