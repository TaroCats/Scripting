# 屏幕采集：图片

`session.nextFrame({timeoutMs?, signal?, image?})` 等待调用后收到的完整/开始图像。默认超时 5000 毫秒，0 表示无超时。同一会话仅允许一个图片读取，包括转换期间。单次读取 signal 只取消该次读取；创建会话的 signal 控制会话生命周期。

`latestFrame({maxAgeMs?, image?})` 立即返回符合年龄限制的缓存图片，没有时返回 `null`，不等待。默认 1000 毫秒，0 只允许当前样本，`Infinity` 不限制年龄。年龄基于原生单调接收时间。停止会清除缓存；已结束会话读取拒绝 `sessionEnded`。

结果包含 `image: UIImage`、原生 `timing`、`metadata`、来源格式和序号。图片已归一化方向。`image.maxDimension` 可选缩小，默认不限制尺寸；`image.dynamicRange` 默认 `preserve`，`sdr` 显式进行 SDR 色调映射。可把 `frame.image` 传给已有图片、OCR、条码 API。原始样本输出使用独立队列。

快捷入口 `capture({delayMs?, timeoutMs?, image?, ...sessionOptions})` 自动清理。延时从采集启动后算起，可被取消或系统停止打断。跨 App 采集时选择整个屏幕，在延时期间切换 App。受保护内容及系统限制仍然适用。

## index.tsx

请在主 App 中运行示例。系统选择器需要用户操作；“Stop / Cancel”按钮和关闭脚本都会清理该脚本拥有的会话。

点击文档的示例入口即可运行，完整代码见同级 [index.tsx](index.tsx)。
