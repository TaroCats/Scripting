在 iOS 17 及以上可用 `Vision.createTrackingSession()` 在连续 UIImage 或[实时相机帧](scripting://doc?title=Live%20Camera%20Frames)中跟踪物体和矩形。

- `addObject(boundingBox, options?)` 用归一化框开始跟踪。`addRectangle(corners, options?)` 用从左上开始的顺时针四角开始跟踪。初始坐标以左下角为原点。
- `process(source, { finishTracks?, signal? })` 处理一帧。相机帧还可指定 EXIF `orientation`。等待当前结果再送下一帧。
- 保持输入来源、帧尺寸与方向一致。相机帧须来自同一个采集流并严格递增。切换输入前调用 `reset()` 并重新登记轨迹。
- 每条结果包含轨迹 ID、版本、可选的原生观测和结束标记。矩形观测另含四个跟踪角点。没有观测时返回 null。可用置信度及几何位置判断何时重新登记。将旧 ID 加到 `finishTracks` 可在当前帧结束旧轨迹。
- `trackingLevel` 可选 `fast` 或 `accurate`。原生对象跟踪版本 2 对两个选项使用同一算法。用 `Vision.getTrackingCapabilities()` 查看版本及容量。
- 原生处理开始后的错误或取消会清空该序列的轨迹。取消会立即拒绝 Promise。在原生处理结束前，新帧或新轨迹可能收到 `busy`。之后可重新登记轨迹继续，用完后调用 `close()`。

示例跟踪一组静态帧中的边界框。相机输入可调用 `nextFrame()` 并等待 `process(frame)`，然后在 `finally` 中释放该帧。

```ts
async function trackObject(frames: readonly UIImage[], box: Vision.Rect) {
  const tracker = Vision.createTrackingSession()
  try {
    const id = tracker.addObject(box)
    const locations: Vision.TrackingObservation[] = []
    for (const [index, frame] of frames.entries()) {
      const [result] = await tracker.process(frame, {
        finishTracks: index === frames.length - 1 ? [id] : [],
      })
      if (result.observation) locations.push(result.observation)
    }
    return locations
  } finally {
    tracker.close()
  }
}
```

Demo 逐帧移动生成的矩形，并读取对象及矩形跟踪结果，无需相机。
