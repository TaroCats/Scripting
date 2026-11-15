# 屏幕采集：滚动片段

采集启动后调用 `addClipBufferingOutput()` 建立 Apple 原生滚动缓冲。同一时刻只允许一个，使用 `onStateChanged` 等待 `state === "buffering"`；`maximumDuration` 为 15 秒。

`exportClip({filePath, duration, overwrite?})` 导出最近一段，要求 `0 < duration <= 15`。导出不会停止缓冲；结果返回实际文件时长和大小，历史不足时实际时长可不同于请求。使用获准访问的绝对路径，除非明确覆盖，否则采用独立文件名。

`stop()` 等待正在执行的导出，再移除缓冲、释放原生资源；停止会话也会清理。JS 原始队列溢出不影响原生缓冲。缓冲失败通过 `onError` 报告，不能用会话运行状态代替文件导出成功。

若将已完成短片保存到指定路径失败，`fileIO` 错误消息会包含保留的临时恢复路径。请先处理该文件，再丢弃错误；若其他写入者新建了同名目标，不会覆盖它。

## index.tsx

请在主 App 中运行示例。系统选择器需要用户操作；“Stop / Cancel”按钮和关闭脚本都会清理该脚本拥有的会话。

点击文档的示例入口即可运行，完整代码见同级 [index.tsx](index.tsx)。
