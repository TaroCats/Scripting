# 手动渲染与离线导出

引擎停止时调用 enableManualRendering({mode, format, maximumFrameCount})，再排期声源并启动。offline 使用 renderOffline(frameCount)；realtime 使用 getManualRenderer().render(frameCount)。两者都返回原生状态、实际 PCM frameLength、sampleTime 和 renderEpoch，返回的 PCM 需 dispose。实时手动渲染器由调用者明确驱动，不会自行把音频送到扬声器，也不会在音频线程调用 JS。重置/切换模式会使旧渲染器失效，需要重新获取。

setManualInput() 在手动模式下向输入节点提供有界 PCM 队列，渲染前先填充。silence 欠载时填入并统计静音，insufficientData 保留原生输入不足状态。部分系统会缓存同一渲染时间上的空输入结果，仅 enqueue 可能无法恢复；必要时明确 reset/重建，并注意 reset 会取消其它播放器。桥接不会自行重置音频图。

## 导出任务

offline 图运行后调用 exportAudio({filePath, settings, frameCount, tailFrames?, chunkFrames?, overwrite?, partialFile?})。同一引擎同时只允许一个导出驱动，不要并行调用 renderOffline。chunkFrames 必须不超过手动渲染上限。文件 processingFormat 需与手动图匹配；配置相同的采样率、声道和样本类型，或明确使用 AVAudioConverter 做其它处理格式转换。

frameCount 渲染主体，tailFrames 继续渲染额外的图帧。为了保留效果尾音，有限声源应在尾音开始前结束；tailFrames 不会自动停止循环声源。getProgress() 返回 renderedFrames、writtenFrames、totalFrames；finished 返回最终路径、实际写入帧数和文件格式。原生不足/失败/部分渲染结果会明确失败，不会静默补零或无限重试。

任务写入自有同目录临时文件，成功关闭后才发布到目标。除非 overwrite 为 true，否则保护已有目标。cancel() 等待清理；stop/reset、撤权及脚本退出也会取消旧任务。partialFile 默认 remove；keep 在确有部分文件时通过错误的 partialFilePath 提供恢复路径。最终发布已经开始后，取消不能撤回已发布文件，应检查 finished 的实际结果。保留了可恢复文件也不会把失败当作成功。导出完成后图仍保留配置，使用结束需 stop/dispose。

## 完整 index.tsx

示例本地生成测试音，经混响导出 30 秒，再保留两秒尾音。提供进度、取消、两种部分文件策略及结果试听。渲染无需麦克风或设备音频会话；试听时才激活播放。设备速度快时可能来不及取消。关闭示例仅删除其自有临时目录，包括保留的部分文件；需要长期保留的结果请先复制到其它位置。

点击文档的示例入口即可运行，完整代码见同级 [index.tsx](index.tsx)。
