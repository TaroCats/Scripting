# 渲染器、时钟和恢复

使用 new 创建视频／音频渲染器和同步器，enqueue 前先 `clock.addRenderer(renderer)`。每个渲染器只能属于一个时钟。视频使用 `<SampleBufferView renderer={video} videoGravity="resizeAspect" />`；还支持 resizeAspectFill 和 resize。同一视频渲染器仅允许在主 App 中挂载一个视图。支持标准无障碍修饰符，应提供有标签的播放控制按钮。

`clock.setRate(0, time)` 暂停并锚定时间，有限正速率用于播放。MediaTime.invalid() 可保留当前时间线；第三个参数可指定数值 hostTime，把媒体时间锚定到主机时钟。继续时使用 clock.currentTime 避免跳转。使用源 presentationTime，不要直接使用墙上时钟秒数。先提交音视频初始样本再启动时钟，然后并行泵送两条轨道，避免先填满暂停的视频轨道导致另一条轨道无法启动。

`await renderer.enqueue(sample)` 只表示原生队列接收，不表示已经显示、发声或排空。每个渲染器最多 8 个待完成提交／64 MiB；等待超过 30 秒会拒绝。应逐个 await，不要对无限样本使用 Promise.all。音频提供 volume（0...1）和 muted，两类渲染器提供 status/error，视频另有 requiresFlushToResumeDecoding。原生失败或授权失效会拒绝待完成提交。

`await renderer.flush()` 取消待完成提交并清空排队媒体，已经显示的视频图像可能保留。flush 不移动读取器和时钟。重新播放时重建读取器、清空渲染器并重新锚定时钟。`await clock.removeRenderer(renderer)` 清空后解除绑定，可再次绑定。销毁时钟会停止播放并销毁仍绑定的渲染器。dispose 可重复调用，授权失效后仍可清理。

以下完整示例在读取 EOF 后等待最终媒体时间戳，仅代表时间线检查，不保证硬件已经呈现最后一个样本。

## index.tsx

点击文档的示例入口即可运行，完整代码见同级 [index.tsx](index.tsx)。
