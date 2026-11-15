# 对 RealityKit 纹理执行 Metal 计算

使用 `LowLevelTexture.compute(pipeline, options)` 在 GPU 上处理 RealityKit 低层纹理。材质可以通过同一个 `texture` 属性显示结果。此 API 适用于 iOS 18 或更高版本，并且需要在前台 App 中可用的 Metal 设备和低层纹理功能。

## 缩放纹理

此示例读取输入纹理的两个 RGBA 纹素，并用最近邻采样将其放大。材质可以显示结果，后续更新时也可以继续绑定同一输出。

```ts
const device = Metal.Device.getDefault()
if (device && RealityKit.getCapabilities().lowLevelTextureCompute) {
  const library = await device.compileLibrary(`
#include <metal_stdlib>
using namespace metal;
kernel void resize_texture(texture2d<float, access::read> source [[texture(0)]],
                            texture2d<float, access::write> target [[texture(1)]],
                            uint2 p [[thread_position_in_grid]]) {
  const uint2 outputSize = uint2(target.get_width(), target.get_height());
  if (any(p >= outputSize)) return;
  const uint2 inputSize = uint2(source.get_width(), source.get_height());
  target.write(source.read(p * inputSize / outputSize), p);
}
`)
  const pipeline = await library.makeComputePipeline('resize_texture')
  const input = await RealityKit.LowLevelTexture.create({
    width: 2, height: 1, pixelFormat: 'rgba8Unorm', usage: ['shaderRead'],
  })
  await input.update(new Uint8Array([255, 72, 0, 255, 0, 124, 255, 255]))
  const output = await RealityKit.LowLevelTexture.create({
    width: 32, height: 16, pixelFormat: 'rgba8Unorm', usage: ['shaderRead', 'shaderWrite'],
  })

  const revision = await output.compute(pipeline, {
    textureIndex: 1,
    inputs: [{ index: 0, texture: input }],
    expectedRevision: output.info.revision,
    dispatch: {
      threadgroups: { width: 4, height: 2 },
      threadsPerThreadgroup: { width: 8, height: 8 },
    },
  })

  const material = RealityKit.Material.create({
    kind: 'unlit', baseColor: [1, 1, 1, 1],
    baseColorTexture: { texture: output.texture },
  })
  const plane = RealityKit.Entity.create()
  plane.setModel(RealityKit.Mesh.primitive({ type: 'plane', width: 1.2, height: 0.6, vertical: true }), [material])
  const scene = RealityKit.Scene.create()
  scene.add(plane)

  const firstTexel = await output.read({ x: 0, y: 0, width: 1, height: 1, expectedRevision: revision })
  console.log(Array.from(firstTexel)) // [255, 72, 0, 255]
  input.dispose()
  pipeline.dispose()
  library.dispose()
}
```

## 绑定纹理与提交计算

- `pipeline.info.textureBindings` 列出内核的纹理索引、纹理类型和访问模式。访问模式为 `'read'`、`'write'` 或 `'readWrite'`。选择与着色器绑定类型匹配的 Metal 纹理类型和像素格式。
- 在输出纹理上调用 `compute`。`textureIndex` 选择其写入或读写绑定。输出使用 `shaderWrite`，若着色器会读取或材质会采样，还需包含 `shaderRead`。`inputs` 的每项按索引提供只读绑定，创建这些输入纹理时需指定 `shaderRead`。输出纹理应与输入分开，每个绑定索引须唯一。同一输入纹理可以用于多个只读绑定。所有纹理、缓冲区和管线必须属于同一脚本与 Metal 设备。
- `dispatch` 接受 Metal 网格、缓冲区、内联字节与线程组内存。选择 `threads` 或 `threadgroups`，并提供 `threadsPerThreadgroup`。着色器需检查可能超出纹理或缓冲区范围的索引。输出尺寸在创建纹理时确定。缩放图像时，写入所需尺寸的目标纹理。 [Metal 计算网格尺寸](https://developer.apple.com/documentation/metal/calculating-threadgroup-and-grid-sizes)

读写绑定还取决于 `device.info.readWriteTextureTier` 和像素格式。 [Apple 读写纹理格式](https://developer.apple.com/documentation/metal/mtlreadwritetexturetier/tier2)

## 发布、读取与取消

GPU 工作完成且输出可供绑定材质使用后，`compute` 返回新的十进制修订版本字符串。更新以此前发布的纹素为起点，着色器未写入的纹素保留原值。

传入 `expectedRevision` 可基于指定的输出修订版本更新。把用于取消的 `signal` 放在与 `dispatch` 同级的外层计算选项中。操作被拒绝或取消时，保留上一次发布的纹素和修订版本。读取输出或启动其他会使用同一纹理或缓冲区的操作前，请等待当前操作完成。

运行示例将 8 × 4 的输入放大到 128 × 64。按钮可切换原色和交换红蓝通道的结果。同一材质会显示每次完成的结果，状态文本会报告当前结果、修订版本和取消状态。

[Metal 计算](scripting://doc?title=Metal%20Compute) · [RealityKit 低层纹理](scripting://doc?title=RealityKit%20Low-Level%20Textures)
