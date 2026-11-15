在 iOS 18 及以上，可通过 `RealityKit.OffscreenRenderer.setPostProcess(options)` 对每张离屏画面执行 Metal compute kernel。传入 `null` 清除效果。pipeline 由 [Metal](scripting://doc?title=Metal%20Compute) 创建。

- kernel 在 `sourceColorIndex`（默认 0）用 `texture2d<float, access::read>` 或 `texture2d<half, access::read>` 读取渲染后的颜色。
- 在 `targetColorIndex`（默认 1）用独立的 `texture2d<float, access::write>` 或 `texture2d<half, access::write>` 写出颜色。未写入的像素保留原色。
- `uniforms` 将复制后的只读字节绑定到各 Metal buffer 索引，大小与对齐须与 Metal 声明匹配。每项最多 4096 字节。
- 线程覆盖整个输出，包括可选渲染 viewport 之外的像素。用 `get_width()` 和 `get_height()` 检查边界。
- 输出沿用渲染调用指定的 BGRA8 或 RGBA16Float 格式。渲染空闲时可更换效果。

示例假定 pipeline 使用默认颜色纹理索引，并在 buffer 索引 0 接收一个 float 常量。Demo 展示同一个场景在颜色通道变换前后的效果。

```ts
function setColorPass(renderer: RealityKit.OffscreenRenderer, pipeline: Metal.ComputePipeline) {
  const amount = new Float32Array([0.75])
  renderer.setPostProcess({ pipeline, uniforms: [{ index: 0, data: amount }] })
}
```
