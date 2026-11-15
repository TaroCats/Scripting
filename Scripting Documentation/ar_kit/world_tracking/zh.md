使用全局 `ARKit` API，以后置摄像头跟踪设备的位置和方向，并估计周围表面。先在设备上调用 `ARKit.getWorldTrackingCapabilities()` 查询支持情况。从前台 App 启动并允许相机访问；先暂停或关闭其他相机会话。相机控制脚本不能启动此会话。

```ts
if (ARKit.getWorldTrackingCapabilities().supported) {
  const session = ARKit.createWorldTrackingSession({ detectVerticalPlanes: false })
  try {
    await session.start()
    const frame = await session.nextFrame()
    console.log(frame.worldMappingStatus, frame.anchors.filter(anchor => anchor.plane !== null).length)
  } finally {
    session.close()
  }
}
```

### 平面与帧

默认检测水平和垂直平面。同一帧提供原始时间戳、相机变换与内参、跟踪质量、锚点和地图状态。会话开始运行时，跟踪可能尚在初始化或受到限制。暂停后再次启动会重置空间。同一时间只等待一次 `nextFrame()`；暂时不读取时，会话保留最新快照。

位置以米表示，矩阵使用列主序。平面中心、顶点和边界都在锚点的局部 XZ 坐标中，用 `anchor.transform` 变换到世界坐标。仅绘制包围矩形时，才绕中心应用 `rotationOnYAxis`。分类可能不可用或尚未确定。

只需要平面范围和分类时，设 `planeGeometry: false`。如果帧超过几何预算，部分平面的几何为 `null`，并通过 `geometryError` 报告原因。`omittedAnchorCount` 大于零时，快照不完整，不能仅凭 ID 缺失就判断锚点移除。ARKit 可能合并平面，移除的平面不一定由同一 ID 接替。

### 射线与锚点

射线的原点和非零方向使用世界坐标，分别传入三个元素的 `Float32Array`。结果保留原生顺序，也可能为空。默认命中已有平面的几何区域，还可选择其无限外延或估算平面。估算命中可能没有锚点。

```ts
const session = ARKit.createWorldTrackingSession()
try {
  await session.start()
  // 扫描目标表面后执行查询。
  const [hit] = session.raycast({
    origin: new Float32Array([0, 1, 0]),
    direction: new Float32Array([0, -1, 0]),
    alignment: "horizontal",
  })
  if (hit?.worldTransform) {
    const id = session.addAnchor({ name: "地面标记", transform: hit.worldTransform })
    // 锚点会出现在后续帧中。用完后按 ID 移除。
    session.removeAnchor(id)
  }
} finally {
  session.close()
}
```

`removeAnchor` 只能移除本会话当前代次添加的锚点，锚点变动反映在后续帧。需要相机输出时，可启用 `captureImage`，或设置固定 `viewport` 获取投影和图像显示变换，详见[人脸跟踪](scripting://doc?title=ARKit%20Face%20Tracking)。

运行示例后，缓慢转动后置摄像头扫描房间，等界面显示平面数量。将摄像头朝向已检测表面，点击 **Place anchor ahead** 放置锚点，再用 **Remove demo anchor** 删除。示例用文字报告位置，无需打开相机预览。

需要保存并恢复扫描空间时，可使用 [ARKit 世界地图](scripting://doc?title=ARKit%20World%20Maps)。

支持后置 LiDAR 的设备可通过 [ARKit 场景深度](scripting://doc?title=ARKit%20Scene%20Depth) 读取距离图。

支持 LiDAR 的设备也可以通过 [ARKit 场景网格](scripting://doc?title=ARKit%20Scene%20Mesh) 读取重建表面和分类。
