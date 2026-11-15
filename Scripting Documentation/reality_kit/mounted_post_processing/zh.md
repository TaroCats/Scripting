# RealityKit 视图后处理

使用 `renderer.setPostProcess()` 为 `RealityView` 显示的场景应用 Metal 颜色效果。编译带可读源纹理和可写目标纹理的计算管线。传入 `null` 恢复原始颜色。设置 `frameUniformIndex` 后，内核可以读取原生相机投影矩阵和场景已用时间。

```metal
#include <metal_stdlib>
using namespace metal;
struct FrameUniforms {
  float4x4 projection;
  float elapsedTime;
};

kernel void tintBand(texture2d<half, access::read> source [[texture(0)]],
                     texture2d<half, access::write> target [[texture(1)]],
                     constant FrameUniforms &frame [[buffer(2)]],
                     uint2 p [[thread_position_in_grid]]) {
  if (p.x >= target.get_width() || p.y >= target.get_height()) return;
  float x = (float(p.x) + 0.5) / float(target.get_width());
  float halfWidth = clamp(abs(frame.projection[0][0]) * 0.12, 0.08, 0.45);
  if (abs(x - 0.5) >= halfWidth) return;
  half4 color = source.read(p);
  half amount = half(mix(0.6, 1.0, smoothstep(0.0, 1.5, frame.elapsedTime)));
  target.write(half4(mix(color.rgb, color.bgr, amount), color.a), p);
}
```

```ts
declare const renderer: RealityKit.Renderer
declare const pipeline: Metal.ComputePipeline
renderer.setPostProcess({ pipeline, sourceColorIndex: 0, targetColorIndex: 1, frameUniformIndex: 2 })
const info = renderer.postProcessInfo()
if (info.state === "applied") console.log(info.projection, info.elapsedTime)
```

内核接收完整的渲染帧。可写纹理采用线性的 RGBA16Float。内核未写入的像素保留源颜色。可选的 `uniforms` 按 Metal 缓冲区索引传入常量字节，重新设置效果即可替换常量。效果配置期间，渲染器会保留所用的管线。

将 `frameUniformIndex` 设为内核中 80 字节只读常量块的索引。取值范围为 0 到 30，且该索引须在 `uniforms` 中空闲。运行时每帧提供此常量块。`projection` 按列主序占用前 64 字节，`elapsedTime` 位于字节偏移 64，以 32 位浮点数表示秒。最后 12 字节用于对齐。时间来自挂载场景的时钟。

`postProcessInfo()` 等待兼容的挂载帧时返回 `pending`，效果已编码时返回 `applied`，沿用原始画面时返回 `bypassed`。`unavailable` 表示该帧的颜色传递失败，`disabled` 表示效果已清除。配置 `frameUniformIndex` 后，`applied` 帧包含 `projection` 和 `elapsedTime`，分别是按列主序排列的 16 个值和原生双精度秒数。用 `RealityKit.getCapabilities().mountedPostProcessing` 查询宿主支持。

可运行示例用投影矩阵控制色带宽度，并随场景时间逐渐混合色带内的红蓝通道。按钮可以清除或重新应用效果。
