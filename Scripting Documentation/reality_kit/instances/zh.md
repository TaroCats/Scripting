通过 RealityKit 网格实例，在同一个实体中绘制网格的多个副本。此 API 适用于 iOS 26 或更高版本。使用前先检查 `RealityKit.getCapabilities().meshInstances`。[RealityKit 网格](scripting://doc?title=RealityKit%20Meshes)

## 创建实例数据

`RealityKit.InstanceData.create({ capacity, count, transforms })` 创建可重复使用的实例组。容量固定。`count` 表示绘制的实例数，可在 0 到容量之间取值。省略 `count` 时，默认使用传入的矩阵数量。

每个变换由按列优先排列的 16 个 Float32 数值组成，可通过 `Float32Array` 或紧密排列的 `Data` 传入。以 0 为起点，矩阵的平移量位于第 12、13 和 14 项。未传入变换的槽位使用单位矩阵。用 `update({ start, transforms })` 更新一段槽位，或用 `update({ count })` 改变绘制数量。减小数量时，暂时停用的槽位保留原有矩阵。

```ts
const instances = RealityKit.InstanceData.create({
  capacity: 2,
  transforms: new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -0.6, 0, 0, 1,
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0,  0.6, 0, 0, 1,
  ]),
})
const mesh = RealityKit.Mesh.primitive({ type: "sphere", radius: 0.15 })
const material = RealityKit.Material.create({ kind: "unlit", baseColor: [0.2, 0.8, 0.7, 1] })
const entity = RealityKit.Entity.create({ name: "Two spheres" })
entity.setModel(mesh, [material])
entity.setMeshInstances({ instances })
```

用 `instances.info` 读取数量、容量和版本。传入 `expectedRevision` 可拒绝基于旧版本的更新。`copyTransforms({ start, count })` 将指定范围内的有效矩阵复制到独立的 `Float32Array`。省略选项时会复制所有有效矩阵。

## 选择部件与包围盒

调用 `entity.setMeshInstances({ instances, modelID })`，将同一个实例组应用到模型的全部部件。如果网格只有一个模型，可省略 `modelID`。通过 `entity.setMeshInstances({ parts: [{ modelID, partID, instances }] })` 可为单个部件指定不同的实例组。未绑定的部件会绘制一次原始几何。已绑定且数量为 0 的部件不会绘制副本。

`entity.meshInstanceParts({ modelID, offset, limit })` 返回包含 `parts` 和 `nextOffset` 的一页数据。所有选项都可省略。起始偏移默认为 0，页大小默认为 128。使用相同的模型筛选条件，将 `nextOffset` 传给下一次查询。`nextOffset` 为 `null` 时已到末页。每项包含模型和部件 ID、原生部件索引以及材质索引。未绑定部件的数量和容量为 `null`。

对于动态网格，`Part0` 等生成的 ID 跟随当前部件槽位。调整部件布局后，可以重新读取部件列表。应用到整个模型的绑定会跟随当前部件，包括更新时新增的部件。

省略 `bounds` 时，RealityKit 会处理裁剪。传入 `bounds: { min, max }` 时，请使用实体局部坐标，并包含该组所有经过变换的几何。如果后续变换或网格修改超出原范围，请用新的包围盒重新调用 `setMeshInstances()`。过小的包围盒可能裁掉原本可见的实例。

## 共享数据与移除绑定

所有引用同一个 `InstanceData` 的绑定都能看到其更新。实体克隆会共享实例数据。`removeMeshInstances()` 只清除当前实体的绑定，并恢复普通模型绘制。释放脚本句柄后，现有绑定仍会保留实例数据。

使用 `instances.compute()` 可通过 Metal 计算内核更新这些共享变换。[RealityKit 实例计算](scripting://doc?title=RealityKit%20Instance%20Compute)

在 iOS 27 或更高版本上，可用[网格逐实例属性](scripting://doc?title=RealityKit%20Per-Instance%20Mesh%20Attributes)为这些副本设置不同的颜色或 UV。

实例变换以实体的变换为基准。实例在同一个场景实体中绘制，碰撞组件属于该实体。

运行示例可以显示六个球体、清除它们，再使用同一批矩阵显示。控件会以文字显示当前数量。[RealityKit 渲染与交互](scripting://doc?title=RealityKit%20Rendering%20and%20Interaction)
