# RealityKit 网格变形栈

网格变形栈可在 iOS 27 或更新版本的前台 App 脚本中，按顺序对网格应用多个变形阶段。使用前检查 `RealityKit.getCapabilities()` 返回的 `meshDeformationStacks` 和 `customMeshDeformers`。

## 选择目标和阶段

用 `entity.deformationTargets()` 查看标准网格资源的模型名、实例名和部件名。每条栈包含一个或多个目标，以及按执行顺序排列的阶段。

- `{ kind: "all" }` 选择整个网格。
- `{ kind: "model", name, part? }` 选择指定模型及其所有实例。
- `{ kind: "instance", name, part? }` 选择一个实例。省略 `part` 时包含该实例的所有部件。

同一个渲染部件只能被一个目标选中。目标或阶段无效时，替换操作保留当前栈。未选中的部件保留已有的变形阶段。用 `entity.deformationStacks()` 查看配置。调用 `entity.removeDeformationStacks()` 可恢复安装脚本栈之前的配置。

| 阶段 | 使用的几何或数据 |
| --- | --- |
| `blendShapes` | 所有选中部件的混合形状。通过 `entity.setBlendShapeWeights()` 设置权重。 |
| `skinning` | 蒙皮权重和骨架。设为 `tangentFrame: true` 时同时变形切线框架。 |
| `subdivision` | 导入网格保留的细分拓扑，可通过 `hasSubdivisionTopology` 查询。 |
| `renormalize` | 运行 RealityKit 原生切线框架阶段。 |
| `bounds` | 更新用于渲染裁剪的包围盒。放在修改顶点位置的阶段之后。 |
| `custom` | 使用 `MeshDeformer` 在 CPU 或 GPU 上修改顶点位置。 |

在 27.2 的自定义位置变形实测中，经过 `renormalize` 后光照仍使用资产原有的法线。`bounds` 阶段影响渲染可见性，`entity.bounds()` 仍返回原始几何的范围。

## CPU 顶点位移

创建阶段时可提供统一平移、连续排列的 XYZ 偏移，或同时提供两者。每个选中部件的顶点数须与偏移数据匹配。可复用同一个阶段，在交互时更新参数。更新会作用于该阶段的所有引用。

```ts
function movePart(entity: RealityKit.Entity, name: string, part: string) {
  const deformer = RealityKit.MeshDeformer.cpuDisplacement({ translation: [0, 0.1, 0] })
  entity.setDeformationStacks([{
    targets: [{ kind: "model", name, part }],
    stages: [{ kind: "custom", deformer }, { kind: "bounds" }],
  }])
  deformer.setDisplacement({ translation: [0, 0.2, 0] })
  return deformer
}
```

## Metal 内核

为脚本运行的平台编译可信的本地 `.metallib` 文件。真机与 Simulator 使用各自的构建产物。加载时提供本地文件路径、内核名称和 Float32 参数个数。每个线程写入一个顶点位置，并用 `vertexCount` 检查顶点索引。

| 缓冲区索引 | 内核声明 |
| --- | --- |
| 0 | `device const packed_float3 *input` |
| 1 | `device packed_float3 *output` |
| 2 | `constant uint &vertexCount` |
| 3 | 参数个数大于零时使用 `constant float *parameters` |

内核接收当前部件连续排列的位置缓冲区。输出的初始值为输入位置。可通过 `setParameters()` 传入最多 256 个有限数值，顺序由内核约定。把 Metal 阶段和使用逐顶点偏移的 CPU 阶段放在细分之前。

```ts
async function twist(entity: RealityKit.Entity, path: string) {
  const kernel = await RealityKit.MeshDeformer.loadMetal({
    path, functionName: "twistPositions", parameterCount: 1,
  })
  kernel.setParameters(new Float32Array([0.5]))
  entity.setDeformationStacks([{
    targets: [{ kind: "all" }],
    stages: [{ kind: "custom", deformer: kernel }, { kind: "bounds" }],
  }])
}
```

将下面的代码保存为 `Twist.metal`，使用 Xcode 的 Metal 工具链编译为 `Twist.metallib`，再把文件路径传给 `twist`。

```metal
#include <metal_stdlib>
using namespace metal;

kernel void twistPositions(device const packed_float3 *input [[buffer(0)]],
                           device packed_float3 *output [[buffer(1)]],
                           constant uint &vertexCount [[buffer(2)]],
                           constant float *parameters [[buffer(3)]],
                           uint index [[thread_position_in_grid]]) {
  if (index >= vertexCount) return;
  float3 p = float3(input[index]);
  float angle = p.y * parameters[0];
  float c = cos(angle);
  float s = sin(angle);
  output[index] = packed_float3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
}
```

iPhone 或 iPad 使用 `iphoneos` SDK。为 Simulator 编译时使用 `iphonesimulator`。

```sh
xcrun --sdk iphoneos metal -c Twist.metal -o Twist.air
xcrun --sdk iphoneos metallib Twist.air -o Twist.metallib
```

参阅 [Apple 网格变形文档](https://developer.apple.com/documentation/realitykit/scene-content-mesh-deformation)。
