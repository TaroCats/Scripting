# RealityKit 动画图

动画图适用于 iOS 27 或更新版本的前台 App 脚本。使用前可检查 `RealityKit.getCapabilities().animationGraph`。多个角色可以共用一套动画图，各自保有输入参数和播放状态。

## 导入 Reality Composer Pro 场景

为角色分配动画图，然后将场景导出为 `.reality`。对于来源可信的资产，使用 `RealityKit.Entity.load(path, { trustExternalReferences: true })` 加载。带图的实体可能位于导入根实体的下级。导入时保留层级，以便图找到制作时设置的绑定。

```ts
async function importCharacter(path: string, scene: RealityKit.Scene) {
  const root = await RealityKit.Entity.load(path, { trustExternalReferences: true })
  function findGraph(entity: RealityKit.Entity): RealityKit.AnimationGraphInstance | null {
    const attached = entity.animationGraph()
    if (attached) return attached
    for (const child of entity.info.children) {
      const graph = findGraph(child)
      if (graph) return graph
    }
    return null
  }
  const graph = findGraph(root)
  if (!graph) throw new Error("场景中没有动画图。")
  scene.add(root)
  if (graph.graph.info.parameterNames.includes("moving")) {
    graph.setParameters([{ name: "moving", type: "bool", value: true }])
  }
  return graph
}
```

参数类型以图作者的设置为准。导入的图提供参数名称。类型和只读设置以作者的配置为准。

## 从 JSON 编译动画图

传入 UTF-8 `Data` 格式的 RealityKit 原生图定义、一个 `SkeletonResource` 和所需的片段映射。每个节点对象的唯一键是原生节点类型，例如 `RootNodeDefinition`，键值是节点字段。ID 字段是形如 `{ "id": 1 }` 的对象。超过 JavaScript 安全整数范围的 ID 用十进制字符串表示，片段映射使用同一个 ID。

以下定义计算骨架的绑定姿势。本页可运行示例包含片段、关节遮罩和浮点输入的完整定义。

```ts
async function attachBindPose(model: RealityKit.Entity) {
  const skeleton = RealityKit.SkeletonResource.fromEntity(model)
  const definition = Data.fromString(JSON.stringify({
    nodes: [
      { RootNodeDefinition: { id: { id: 1 }, name: "Root", childID: { id: 2 } } },
      { BindPoseNodeDefinition: { id: { id: 2 }, name: "Rest" } },
    ],
  }))
  if (!definition) throw new Error("无法编码动画图。")
  const input = { definition, skeleton }
  const result = await RealityKit.AnimationGraph.validate(input)
  if (!result.valid) throw new Error(result.diagnostics.join("\n"))
  const graph = await RealityKit.AnimationGraph.compile(input)
  return model.setAnimationGraph(graph)
}
```

Reality Composer Pro 项目文件和原生图定义使用不同的格式。导入项目场景时，从编辑器导出 `.reality`。编译接受最多 1 MiB 的图 JSON 和 512 个节点。验证会报告定义格式问题和原生编译诊断。验证失败时，编译会返回错误。两个操作均可传入 `AbortSignal`。

为 `AnimationClipNodeDefinition` 提供 `clips: [{ nodeID, clip }]`。RealityKit 要求片段节点使用 Timeline 资源。可以传入 `RealityKit.AnimationClip.sampled` 创建的采样关节片段。部分导入资产提供的动画属于 AnimationScene 资源，编译器会返回相应诊断。

原生格式包含以下节点。

| 用途 | 定义键 |
| --- | --- |
| 最终姿势和绑定姿势 | `RootNodeDefinition`、`BindPoseNodeDefinition` |
| 片段和速度 | `AnimationClipNodeDefinition`、`SpeedScaleNodeDefinition` |
| 混合 | `Blend1DNodeDefinition`、`BlendMaskNodeDefinition`、`AdditiveNodeDefinition`、`SubtractNodeDefinition` |
| 状态转移 | `StateMachineNodeDefinition` |
| 根运动 | `MotionWarpingNodeDefinition`、`RootMotionGenerationNodeDefinition` |
| IK | `FullBodyIKNodeDefinition`、`FootPlacementNodeDefinition` |

字段遵循各节点的原生定义。例如，状态机的 `states` 通过 `child_node` 引用姿势节点。起始状态设置 `start_state: true`，转移通过 `target` 引用状态或连接节点的 ID。条件和参数定义也采用单一原生类型键。

参阅 [AnimationGraphResource](https://developer.apple.com/documentation/realitykit/animationgraphresource) 和 [Working with the Animation Graph](https://developer.apple.com/documentation/realitycomposerpro/working-with-the-animation-graph)。

## 安装、控制和查看状态

- `entity.animationGraph()` 获取实体上的动画图实例。`entity.setAnimationGraph(graph)` 将图安装到网格骨架兼容的模型上。模型可以来自导入资产，也可以用 `Mesh.deformable` 创建。导入图的源实体有明确的网格骨架时，可以复用该图。`graph.info.canAttach` 表示是否具备用于复用的骨架信息。
- `instance.setParameters(updates)` 批量设置同一个实体的类型化参数。`instance.parameter(name, type)` 读取已绑定的值，没有可用值时返回 `null`。编译得到的图可通过 `graph.info.parameters` 查看声明类型、只读设置和选项。实体参数绑定支持 `bool`、`float`、`int`、`vector3`、`rotation` 和 `option`。用 `instance.trigger(name)` 触发 Trigger 参数。RealityKit 消费后会清除它。
- 实体在挂载的 `RealityView` 中处于活动状态时，图会求值。`instance.state.ready` 表示当前快照中有已求值的节点。渲染更新后可读取活动节点、状态机节点、片段节点和标签。节点、状态、转移和标签 ID 使用有符号十进制字符串。循环播放时，片段的周期值可能大于 1。标签反映最近一次求值。
- 使用 `entity.removeAnimationGraph()` 停止图求值并使原实例失效。替换网格也会清除图。释放实例句柄后，图仍保留在实体上，可以再次调用 `entity.animationGraph()` 获取。普通动画仍可驱动其他属性。在同一骨架安装图之前，移除会同时写入该骨架的播放实例或 IK 组件。

## 关节遮罩和 IK

通过 `withEvaluation({ blendMasks })` 为骨架定义遮罩，然后在 `BlendMaskNodeDefinition` 中按名称引用。图层权重为 1 时，遮罩权重为 0 的关节保留底层姿势，权重为 1 的关节完全使用图层姿势。省略的关节使用 1。节点的浮点参数控制整体图层权重。

导入图会保留制作时设置的原生节点和绑定。编译含 Full Body IK 节点的图时，RealityKit 需要在骨架的求值资源中找到节点引用的 rig 名称。脚本创建的 `IKRig` 使用自动生成的求解器标识。使用这类资源时，JSON 编译器可能报告无法解析作者设置的 rig 名称。需要在图外使用程序化 IK 时，可移除该实体上的动画图，再调用 `Entity.setIK` 和 `Entity.updateIKTargets`。
