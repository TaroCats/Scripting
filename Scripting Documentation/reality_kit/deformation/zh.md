# RealityKit 骨骼、混合形状与 IK

用 `entity.deformationInfo()` 检查模型的骨架、姿势和变形组件。兼容关节接口可用于提供默认关节姿势的模型。命名姿势、模型空间关节读取、程序创建可变形网格、混合形状和 IK 需要 iOS 18 或更新版本。

用 `entity.skeletons()` 查看关节名称和顺序、父索引，以及可用的静止变换和逆绑定矩阵。矩阵采用列主序。`getPose({ space: "model" })` 还会返回每个关节在模型空间中的精确矩阵。`setPose()` 接受一批按名称指定的关节局部变换。模型有多个骨架或姿势时，请指定对应 ID。姿势读取返回 RealityKit 姿势组件提供的变换。

`Mesh.deformable()` 根据显式三角形部件创建网格。蒙皮部件通过 ID 引用骨架，并为每个顶点提供固定数量的关节索引和权重。父关节排在子关节之前，每个顶点的权重之和为 1。混合形状为部件的每个顶点提供紧密排列的 XYZ 位移。用 `blendShapes()` 查看权重集 ID 和名称。更新时可以按名称传入权重，也可以提供与该组布局一致的 Float32 数据。

```ts
function setExpression(entity: RealityKit.Entity, amount: number) {
  const group = entity.blendShapes().find(item => item.weightNames.includes("Smile"))
  if (group) entity.setBlendShapeWeights([{ name: "Smile", value: amount }], { groupID: group.id })
}
```

为模型骨架创建 `IKRig`，用 `setIK()` 安装，再通过 `updateIKTargets()` 提交目标。默认使用模型空间，设置 `space: "world"` 可提交世界空间目标。下一帧渲染后可用 `ikState()` 查看求解器设置和已应用的目标。原生求解器使用动画姿势作为输入。更新目标时保持 rig 已安装，更换模型后安装匹配的 rig。用 `resetIK()` 重置求解状态，用 `removeIK()` 移除。
