# 网格逐实例属性

为同一个动态网格的多个副本提供不同的颜色、UV 坐标或其他网格属性。在 iOS 27 或更高版本上，可在受支持的前台 App 脚本中通过 `RealityKit.getCapabilities().meshInstanceAttributes` 检查可用性。另用 `InstanceData` 设置绘制数量和每个副本的位置。

## 让两个副本共享一种颜色

此示例使用一个三角形、四个实例变换和两项颜色数据。颜色流每经过两个实例前进一项。运行 TypeScript 示例前，请为目标平台编译以下表面着色函数，并将其放入 `.metallib`。

```metal
#include <metal_stdlib>
#include <RealityKit/RealityKit.h>
using namespace metal;

[[visible]]
void scriptingInstanceColor(realitykit::surface_parameters parameters) {
  parameters.surface().set_emissive_color(half3(parameters.geometry().color().xyz));
}
```

```ts
const device = Metal.Device.getDefault()
const capabilities = RealityKit.getCapabilities()
if (device && capabilities.meshInstanceAttributes && capabilities.customMaterials) {
  const library = await device.loadLibrary("/path/to/instance-attributes.metallib")
  const material = RealityKit.Material.custom({
    surface: { library, name: "scriptingInstanceColor" },
    lightingModel: "unlit",
  })
  library.dispose()

  const mesh = RealityKit.Mesh.dynamic({
    vertexCount: 3, vertexCapacity: 3, indexCount: 3, indexCapacity: 3,
    indexType: "uint32", indices: new Uint32Array([0, 1, 2]),
    instanceCapacity: 4,
    layouts: [
      { bufferIndex: 0, bufferStride: 12 },
      { bufferIndex: 1, bufferStride: 16, stepFunction: "perInstance", stepRate: 2 },
    ],
    attributes: [
      { semantic: "position", format: "float3", layoutIndex: 0, offset: 0 },
      { semantic: "color", format: "float4", layoutIndex: 1, offset: 0 },
    ],
    vertexBuffers: [
      new Float32Array([-0.18, -0.25, 0, 0.18, -0.25, 0, 0, 0.25, 0]),
      new Float32Array([1, 0.24, 0.07, 1, 0.07, 0.76, 1, 1]),
    ],
    parts: [{ indexCount: 3, min: [-0.19, -0.26, 0], max: [0.19, 0.26, 0] }],
  })
  const transforms = new Float32Array(4 * 16)
  for (const [index, x] of [-0.78, -0.26, 0.26, 0.78].entries()) {
    transforms.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, 0, 0, 1], index * 16)
  }
  const instances = RealityKit.InstanceData.create({ capacity: 4, transforms })
  const entity = RealityKit.Entity.create()
  entity.setModel(mesh, [material])
  entity.setMeshInstances({ instances })
  const scene = RealityKit.Scene.create()
  scene.add(entity)

  mesh.update({
    vertexBuffers: [{ bufferIndex: 1, byteOffset: 16, data: new Float32Array([0.25, 1, 0.35, 1]) }],
  })
}
```

## 布局与更新数据流

- 使用 `Mesh.dynamic` 的显式缓冲区布局，将 `position` 放在 `perVertex` 布局中。为按实例前进的数据流指定 `stepFunction: "perInstance"`。`stepRate` 默认为 1。每行数据服务于相应数量的连续实例，因此一个数据流需要 `Math.ceil(instanceCapacity / stepRate)` 行。布局的偏移和步长以字节为单位。
- 共享同一缓冲区的布局须使用相同的步进方式和步进速率。
- 创建网格时提供全部行。`mesh.info.instanceCapacity` 返回网格的实例上限，普通网格返回 0。网格包含逐实例流时，每个绑定的 `InstanceData` 容量均须在该上限内。单独用 `InstanceData.info.count` 查看绘制数量。减少绘制数量会保留其余属性行和变换。
- 使用 `mesh.update({ vertexBuffers })` 按字节更新。在 `mesh.compute` 中，用 `kind: "vertices"` 和对应的 `bufferIndex` 绑定同一数据流。这些缓冲区属于网格，共享网格的实体和克隆都会看到更新。使用 `instances.update` 或 `instances.compute` 更改变换或可见副本数量。

选用能够读取所提供语义的材质。示例通过自定义表面着色函数读取 `geometry().color()`。自定义着色函数也可以使用对应的几何访问方法读取 UV 坐标。

运行示例会显示两个橙色三角形和两个青色三角形。按钮可互换两组颜色，并切换显示两个或四个副本。状态文本会说明当前分组。

[RealityKit 网格](scripting://doc?title=RealityKit%20Meshes) · [RealityKit 网格实例](scripting://doc?title=RealityKit%20Mesh%20Instancing) · [RealityKit 自定义 Metal 材质](scripting://doc?title=RealityKit%20Custom%20Metal%20Materials)
