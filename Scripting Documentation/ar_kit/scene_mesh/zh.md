在兼容的后置 LiDAR 设备上，世界跟踪可将房间重建为三角网格。先调用 `ARKit.getWorldTrackingCapabilities().sceneReconstruction` 查询 `mesh` 或 `meshWithClassification`，再在创建世界跟踪会话时选择模式。设备不支持时会报错。

```ts
if (ARKit.getWorldTrackingCapabilities().sceneReconstruction.mesh) {
  const session = ARKit.createWorldTrackingSession({ sceneReconstruction: "mesh" })
  try {
    await session.start()
    await session.nextFrame()
    const { anchors } = session.getSceneMeshAnchors()
    const entry = anchors.find(anchor => anchor.triangleCount > 0)
    if (entry) {
      const mesh = session.copySceneMesh({ id: entry.id })
      console.log(mesh?.geometry?.vertices.length)
    }
  } finally {
    session.close()
  }
}
```

网格锚点有独立清单，提供 ID、几何修订号、变换与计数。比较前后两份清单可获知增删和变化。正在同步锚点或锚点超出预算时，`complete` 为 `false`，此时不能仅凭 ID 缺失就判断被移除。清单反映当前的原生锚点事件，不与之前读取的某帧相机时间绑定。

按需复制几何。`copySceneMesh()` 返回独立的 TypedArray，坐标位于锚点局部空间，用该锚点的变换换算成世界坐标。每三个索引构成一个三角形。若启用了分类并且 ARKit 提供结果，原始分类字节与三角形顺序一致：0 未分类、1 墙、2 地板、3 天花板、4 桌、5 座椅、6 窗、7 门。其他数值视为未知。

锚点被移除后，复制可能返回 `null`。有锚点但没有有效几何时，读取 `geometryError`。如需复制清单中的确切版本，可传入 `revision`；遇到 `staleRevision` 时重新列举。暂停后重启会重置场景；已复制数组仍可使用，保留期间占用脚本的网格预算。

示例绘制一个锚点的局部线框，并用文字显示锚点和三角形数量。扫描地面和墙面，观察网格如何逐渐完善。
