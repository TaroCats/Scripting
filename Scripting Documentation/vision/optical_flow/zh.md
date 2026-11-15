# Vision 光流

在 iOS 17 或更高版本中，使用 `Vision.createOpticalFlowSession()` 读取连续图像之间的位移向量场。`accuracy` 支持 `low`、`medium`、`high` 和 `veryHigh`。`format` 默认为 `"float32"`，也可指定半精度 `"float16"` 或原始模型输出 `"network"`。

```ts
const session = Vision.createOpticalFlowSession({ accuracy: "low", format: "float16" })
try {
  await session.process(first, { presentationTime: MediaTime.zero() })
  const [observation] = await session.process(second, {
    presentationTime: MediaTime.make({ value: 1, timescale: 30 }),
  })
  if (observation) {
    const { field } = observation
    try {
      const { width, height } = field.info
      console.log(field.vectorAt(Math.floor(width / 2), Math.floor(height / 2)))
    } finally { field.dispose() }
  }
} finally { session.close() }
```

首帧建立参照。每张 `UIImage` 需传入递增的 `MediaTime`。BGRA8 或 8 位 NV12 的 `AVCaptureVideoFrame` 自带采样时间，可选传入 `orientation`。保持来源、尺寸、方向和像素格式一致，每帧处理完成后再提交下一帧。调用 `reset()` 更换来源或重新开始，传入 `signal` 取消处理。

可选的归一化 `regionOfInterest` 以定向后输入的左下角为原点。流场报告实际宽高、原生行步长和 FourCC。分析区域与原始网络模式可能改变布局。`vectorAt(列, 行)` 按存储行顺序读取两个原生分量。`copyBytes()` 返回独立的紧排数据，每个像素包含两个交错的 Float32 值或 Float16 位模式。读取这份数据时使用 `bytesPerRow`。`networkOutput` 表示原始模型输出，其尺寸和向量尺度可能与常规流场不同。

Vision 返回交错双分量 Float32 或 Float16 缓冲时，可使用原始网络输出。其他原生布局会返回 `unsupportedPixelFormat`。

用完后关闭会话并释放流场。每个脚本最多开启一个光流会话，其他脚本正在计算光流时会返回 `busy`。使用 `Vision.getOpticalFlowCapabilities()` 查询选项和输入像素上限。大图触及内存限制时，可缩小整个序列并释放较早的结果。
