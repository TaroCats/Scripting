`Mesh.primitive` 创建立方体、球体、平面和文字，iOS 18 或更新版本还支持圆锥和圆柱。`Mesh.generate` 接受紧密排列的 Float32 位置、法线、切线和 UV 数据，以及三角形、多边形或三角形与四边形。分配材质时使用 `mesh.info.materialSlotCount`。

iOS 18 或更新版本中的 `Mesh.dynamic` 创建容量固定的可复用缓冲。普通属性采用紧密排列的 Float32。高级布局可指定字节偏移、步长、格式和独立缓冲。子网格的 `indexOffset` 以索引为单位，更新区间以字节为单位。子网格的包围盒需要包含其索引引用的顶点。

`mesh.update` 在发布前验证更新后的索引、数量和包围盒，并返回十进制版本字符串。传入 `expectedRevision` 可以拒绝过期更新。共享网格的克隆实体会看到同一更新。碰撞几何需要随之改变时，显式重建碰撞形状。

下面的示例修改三角形的一个顶点。使用 `entity.setModel(mesh, [material])` 将网格放入场景中显示。

```ts
const mesh = RealityKit.Mesh.dynamic({
  positions: new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]),
  indices: new Uint16Array([0, 1, 2]),
  indexType: "uint16",
  parts: [{ indexCount: 3, min: [-1, -1, 0], max: [1, 1, 0] }],
})

mesh.update({
  expectedRevision: mesh.info.revision,
  vertexBuffers: [{ bufferIndex: 0, byteOffset: 24, data: new Float32Array([0, 0.5, 0]) }],
})
```

[网格 GPU 写入](scripting://doc?title=RealityKit%20Mesh%20Compute)演示了如何用 Metal 更新动态网格的顶点和索引。

在 iOS 27 或更高版本上，动态网格还可提供[逐实例属性](scripting://doc?title=RealityKit%20Per-Instance%20Mesh%20Attributes)。
