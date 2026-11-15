ARKit 世界地图保存世界跟踪会话的空间数据和静态锚点，可用来在回到同一房间后恢复原来的坐标系。请等跟踪正常，地图状态达到 `extending` 或 `mapped` 后再捕获。

```ts
const session = ARKit.createWorldTrackingSession()
try {
  await session.start()
  // 扫描房间，等地图状态就绪后捕获。
  const map = await session.captureWorldMap()
  const path = FileManager.temporaryDirectory + "/world-map.bin"
  await FileManager.writeAsData(path, map)
  session.close()

  const restored = ARKit.createWorldTrackingSession({ initialWorldMap: await FileManager.readAsData(path) })
  try {
    await restored.start()
    const frame = await restored.nextFrame()
    console.log(frame.camera.tracking, frame.anchors.length)
  } finally {
    restored.close()
  }
} finally {
  session.close()
}
```

一个会话只能同时捕获一张地图。暂停、关闭或中断会话会取消等待。归档是原生二进制 `Data`，最大 32 MiB，运行时不会自动写文件。地图包含房间空间信息，请从可信来源读取归档。房间变化、光线不足或载入其他地点的地图，都可能导致重定位失败。

`start()` 完成表示采集已启动。等跟踪恢复正常且保存的锚点出现，再确认重定位成功。要放弃恢复，关闭会话，再创建不带 `initialWorldMap` 的新会话。恢复后的锚点可从帧中读取；`removeAnchor()` 只能移除当前运行期间由脚本添加的锚点。

运行示例后启动扫描，脚本会放置一个标记。扫描房间后点击 **Save map**，再点击 **Reopen saved map**。后摄缓慢扫过同一区域，观察界面是否确认找回标记。每次保存会覆盖脚本目录中的示例地图。
