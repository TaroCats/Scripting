# 对 RealityKit 实例执行 Metal 计算

使用 `instances.compute(options)` 通过 Metal 计算内核更新 `RealityKit.InstanceData` 中的变换。绑定了该实例数据的所有模型部件和实体都会使用发布后的结果。在 iOS 26 或更高版本上，需要可用的 Metal 设备，并可在受支持的前台 App 脚本中通过 `RealityKit.getCapabilities().instanceCompute` 检查可用性。

## 移动一个实例

每个槽位存储一个以实体局部坐标表示的 64 字节矩阵，类型为按列优先排列的 `float4x4`。平移量位于矩阵的第四列。此示例沿实体的局部 X 轴移动第二个实例，仅发布槽位 1，保留槽位 0。

```ts
const device = Metal.Device.getDefault()
if (device && RealityKit.getCapabilities().instanceCompute) {
  const instances = RealityKit.InstanceData.create({
    capacity: 2,
    count: 2,
    transforms: new Float32Array([
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -0.6, 0, 0, 1,
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0,    0, 0, 0, 1,
    ]),
  })
  const library = await device.compileLibrary(`
#include <metal_stdlib>
using namespace metal;

kernel void move_instance(const device float4x4 *source [[buffer(0)]],
                          device float4x4 *target [[buffer(1)]],
                          constant float &deltaX [[buffer(2)]],
                          uint id [[thread_position_in_grid]]) {
  if (id != 0) return;
  float4x4 transform = source[1];
  transform[3].x += deltaX;
  target[1] = transform;
}
`)
  const pipeline = await library.makeComputePipeline("move_instance")
  try {
    const revision = await instances.compute({
      pipeline,
      sourceBufferIndex: 0,
      targetBufferIndex: 1,
      start: 1,
      length: 1,
      expectedRevision: instances.info.revision,
      dispatch: {
        threadgroups: { width: 1 },
        threadsPerThreadgroup: { width: 1 },
        bytes: [{ index: 2, data: new Float32Array([0.375]) }],
      },
    })
    console.log(revision, instances.copyTransforms()[28])
    // After assigning a model, bind with entity.setMeshInstances({ instances }).
  } finally {
    pipeline.dispose()
    library.dispose()
  }
}
```

## 绑定缓冲区与选择槽位

- `targetBufferIndex` 指定可写的 `[[buffer(index)]]` 槽位。目标缓冲区以当前变换为起点。如需单独读取已发布的变换，可用 `sourceBufferIndex` 指定另一个只读槽位。
- 两个缓冲区都包含 `capacity` 个矩阵。在内核中使用槽位索引访问矩阵，确保索引在容量范围内。`start` 和 `length` 选择要发布的槽位。`start` 默认为 0，`length` 默认为 `capacity - start`。范围须在容量内，且至少包含一个槽位。范围以外的槽位和内核未改写的槽位都保留原值。
- `dispatch` 接受 Metal 计算网格、内联字节、只读辅助缓冲区和线程组内存。着色器反射中要求的每个绑定都须提供一次。使用属于同一脚本和 Metal 设备的管线与缓冲区。

## 修改绘制数量与发布结果

`count` 决定绘制多少个实例，默认为当前数量，可在 0 到容量之间取值。内核可以更新未激活的槽位，减少绘制数量会保留这些槽位的变换。已绑定且数量为 0 的部件不会绘制副本。

原生代码在发布前检查变换中各数值是否有限。变换与绘制数量提交后，`compute` 返回新的十进制修订版本字符串，渲染器会在后续帧中显示结果。传入 `expectedRevision` 可基于指定版本执行更新。把用于取消的可选 `signal` 放在与 `dispatch` 同级的位置。操作被拒绝或取消时，保留上一次发布的变换、数量和修订版本。

等待计算完成期间，`copyTransforms()` 仍读取上一次发布的版本。等待计算完成后，再对同一实例数据调用 `compute()` 或 `update()`。如果在 `setMeshInstances()` 中指定了包围盒，请确保实体局部空间中的包围盒能包含变换后的几何。

运行示例会使用同一份实例数据绘制两排球体。控件可以同时移动两排中间的球体、隐藏两排球体，再按原位置显示。文本会说明当前结果。

[RealityKit 网格实例](scripting://doc?title=RealityKit%20Mesh%20Instancing) · [Metal 计算](scripting://doc?title=Metal%20Compute)
