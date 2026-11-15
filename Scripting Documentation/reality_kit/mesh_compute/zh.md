# 对 RealityKit 网格执行 Metal 计算

使用 `mesh.compute(options)` 在 Metal 计算内核中更新动态网格的顶点流和索引。已使用该网格的实体会显示发布后的几何体。此 API 适用于 iOS 18 或更高版本，需要可用的 Metal 设备。在受支持的前台 App 脚本中，可通过 `RealityKit.getCapabilities().meshCompute` 检查可用性。

## 移动三角形

此示例为三个紧密排列的顶点位置加上 X 轴偏移。Metal 缓冲区索引 0 读取网格的当前位置，索引 1 写入更新后的位置。两者都对应网格的顶点流 0。

```ts
const device = Metal.Device.getDefault()
if (device && RealityKit.getCapabilities().meshCompute) {
  const mesh = RealityKit.Mesh.dynamic({
    positions: new Float32Array([-0.25, -0.35, 0, 0.25, -0.35, 0, 0, 0.35, 0]),
    indices: new Uint32Array([0, 1, 2]),
    indexType: "uint32",
    parts: [{ indexCount: 3, min: [-1, -0.5, 0], max: [1, 0.5, 0] }],
  })
  const library = await device.compileLibrary(`
#include <metal_stdlib>
using namespace metal;

kernel void move_triangle(const device packed_float3 *source [[buffer(0)]],
                          device packed_float3 *target [[buffer(1)]],
                          constant float &deltaX [[buffer(2)]],
                          uint vertexID [[thread_position_in_grid]]) {
  if (vertexID >= 3) return;
  float3 position = float3(source[vertexID]);
  position.x += deltaX;
  target[vertexID] = packed_float3(position);
}
`)
  const pipeline = await library.makeComputePipeline("move_triangle")
  try {
    const revision = await mesh.compute({
      pipeline,
      reads: [{ kind: "vertices", bufferIndex: 0, index: 0 }],
      writes: [{ kind: "vertices", bufferIndex: 0, index: 1 }],
      expectedRevision: mesh.info.revision,
      dispatch: {
        threadgroups: { width: 1 },
        threadsPerThreadgroup: { width: 4 },
        bytes: [{ index: 2, data: new Float32Array([0.5]) }],
      },
    })
    console.log(revision)
    // Attach mesh with entity.setModel(mesh, [material]) to display it.
  } finally {
    pipeline.dispose()
    library.dispose()
  }
}
```

## 绑定顶点流和索引

- 使用 `{ kind: "vertices", bufferIndex, index }` 绑定顶点流，使用 `{ kind: "indices", index }` 绑定索引缓冲区。`bufferIndex` 选择网格的顶点流，`index` 对应 Metal 的 `[[buffer(index)]]` 槽位。每个 Metal 缓冲区槽位只能绑定一次，包括通过 `dispatch` 提供的缓冲区和内联字节。
- `reads` 读取已发布的网格数据。至少提供一个写入绑定，每个网格数据流最多提供一个。每次写入以已发布数据的副本为起点。可用 `byteOffset` 和 `byteLength` 指定要发布的字节范围，内核仍绑定完整缓冲区。范围以外的字节保留原值，索引范围须按完整索引对齐。读取并写入同一个网格顶点流时，分别使用两个 Metal 槽位。
- MSL 元素类型、步幅与偏移量须与网格描述一致。紧密排列的位置流采用 12 字节步幅，对应 `packed_float3`。索引绑定须与网格的 `uint16` 或 `uint32` 格式一致。配置计算网格，并在内核中为超出范围的线程做边界检查。 [Metal 计算网格尺寸](https://developer.apple.com/documentation/metal/calculating-threadgroup-and-grid-sizes)
- 通过 `dispatch.buffers` 提供只读 Metal 缓冲区。使用 `textures: [{ index, texture }]` 将具有 `shaderRead` 用途的 `LowLevelTexture` 绑定到只读着色器纹理槽位。使用属于同一脚本和 Metal 设备的资源。

## 验证与发布

GPU 先更新候选数据。原生代码在 CPU 上验证结果，无需将网格字节传回 JavaScript。结果必须满足与 `mesh.update` 相同的几何约束。有效索引须引用有效顶点，每个网格部件的包围盒须包含其索引引用的几何体。结果需要不同的有效范围或包围盒时，可在同一次操作中传入 `vertexCount`、`indexCount` 或 `parts`。缓冲区容量和布局在创建时固定。[网格变形栈](scripting://doc?title=RealityKit%20Mesh%20Deformation%20Stacks)使用标准网格。

`compute` 在网格更新提交后返回新的十进制修订版本字符串，渲染器会在后续帧中显示结果。传入 `expectedRevision` 可基于指定修订版本执行更新。把用于取消的可选 `signal` 放在与 `dispatch` 同级的位置。操作被拒绝或取消时，保留上一次发布的几何体和修订版本。等待更新完成后，再对同一网格发起另一次更新。如果碰撞形状也需要匹配新几何体，请单独重建。

运行示例可写入顶点流，让三角形左右移动；也可同时更新索引和部件包围盒，让三角形改变朝向。按钮和状态文本会说明位置、朝向和错误。

[RealityKit 网格](scripting://doc?title=RealityKit%20Meshes) · [Metal 计算](scripting://doc?title=Metal%20Compute)
