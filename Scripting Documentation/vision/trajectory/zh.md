# Vision 轨迹检测

`Vision.createTrajectorySession()` 可检测物体在连续帧中的抛物线轨迹。结果包含实际质心、拟合点、方程 `y = a*x*x + b*x + c` 的系数、移动平均半径以及以 `MediaTime` 表示的时间范围。

```ts
const session = Vision.createTrajectorySession({
  trajectoryLength: 8,
  objectMinimumNormalizedRadius: 0.01,
  objectMaximumNormalizedRadius: 0.05,
})
try {
  for (const [index, image] of images.entries()) {
    const rows = await session.process(image, {
      presentationTime: MediaTime.make({ value: index, timescale: 30 }),
    })
    for (const row of rows) console.log(row.equationCoefficients, row.timeRange.duration.seconds)
  }
} finally {
  session.close()
}
```

采样时间必须递增。每张 `UIImage` 需要传入 `MediaTime`，也可以输入同一 `AVCaptureVideoDataOutput` 的 BGRA8 或 8 位 NV12 相机帧，使用帧自带的时间。相机帧可选传入 `orientation`。调用 `reset()` 前，保持来源、尺寸、方向和像素格式一致，每帧处理完成后再提交下一帧。

测量轨迹时保持相机固定。`trajectoryLength` 指检测所需的点数，`minimumLatencyFrameCount` 是当前请求配置的原生最少帧数。`frameAnalysisSpacing` 设置参与分析的样本最小时间间隔，`targetFrameTime` 根据处理时间调节下一帧的精度。指定 `regionOfInterest` 时，点使用区域内的归一化坐标。区域及其中的点以左下角为原点。方程系数和归一化半径保留 Vision 报告的值。

每次调用返回 Vision 当前报告的观测。积累证据时可能返回空数组，后续帧也可能重复返回相同标识和时间范围的观测。可用时间范围判断轨迹是否延伸。用 `Vision.getTrajectoryCapabilities()` 查询版本和长度限制。传入 `signal` 取消正在进行的调用，重新开始前重置会话，用完后关闭会话。
