在支持的后置 LiDAR 设备上，ARKit 世界跟踪可以返回场景深度。先用 `ARKit.getWorldTrackingCapabilities().sceneDepth` 查询原始、平滑及同时启用两种深度的能力。创建会话时显式选择模式；设备不支持时会报错。

```ts
if (ARKit.getWorldTrackingCapabilities().sceneDepth.raw) {
  const session = ARKit.createWorldTrackingSession({ sceneDepth: "raw" })
  try {
    await session.start()
    const frame = await session.nextFrame()
    const depth = frame.sceneDepth
    if (depth) {
      const index = Math.floor(depth.height / 2) * depth.width + Math.floor(depth.width / 2)
      const distance = depth.distances[index]
      if (Number.isFinite(distance) && distance > 0) console.log(distance, depth.confidence?.[index])
    }
  } finally {
    session.close()
  }
}
```

深度值是到相机平面的距离，单位为米。`distances` 为按行紧排的 `Float32Array`，深度图使用原生分辨率与传感器方向。相机内参使用采集图像的像素坐标。若要在旋转或裁切后的预览上叠加深度，需要做坐标对齐和缩放。原始深度来自当前帧；平滑深度经过原生时间平滑，使用同一帧的时间戳。

可选的 `confidence` 是同尺寸的原生字节（0 低、1 中、2 高）。零值和非有限距离会原样保留，可按用途过滤这些数值与低置信样本。`nativePixelFormatCode` 和 `nativeBytesPerRow` 描述原始缓冲格式和步长，返回数组不含行填充。

未启用或这一帧没有深度时，对应字段是 `null`。复制或分配深度失败时，可读取 `sceneDepthError` 或 `smoothedSceneDepthError`，其他帧数据仍可读取。若仅置信图失败，距离数据仍可用，并通过 `confidenceError` 报告。保留的深度样本共用存储预算，请及时释放不再使用的帧。

可运行示例会显示深度图中央的距离和置信度。将后摄朝向一个表面，靠近或远离它，比较原始与平滑读数。
