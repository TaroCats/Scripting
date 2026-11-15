# RealityKit View Post-Processing

Use `renderer.setPostProcess()` to apply a Metal color effect to a scene displayed by `RealityView`. Compile a compute pipeline with a readable source and a writable target. Pass `null` to restore the original colors. Set `frameUniformIndex` to read the native camera projection and elapsed scene time inside the kernel.

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

The kernel receives the full rendered frame. Its writable texture uses linear RGBA16Float. Pixels the kernel leaves untouched keep their source color. Optional `uniforms` pass constant bytes by Metal buffer index. Set the effect again to replace the constants. The renderer keeps the pipeline available while the effect is configured.

Set `frameUniformIndex` to the index of the kernel's 80-byte read-only constant block. Use an index from 0 through 30 that is free in `uniforms`. The runtime supplies the block each frame. `projection` occupies the first 64 bytes in column-major order. `elapsedTime` is a 32-bit float in seconds at byte offset 64. The remaining 12 bytes are alignment padding. The elapsed time follows the mounted scene's clock.

`postProcessInfo()` reports `pending` while waiting for a compatible mounted frame, `applied` when the pass is encoded, and `bypassed` when the original frame is used. `unavailable` indicates a frame whose color transfer failed. `disabled` means the effect has been cleared. With `frameUniformIndex` set, an `applied` frame includes `projection`, as 16 column-major values, and `elapsedTime`, in native double-precision seconds. Use `RealityKit.getCapabilities().mountedPostProcessing` to check host support.

In the runnable example, projection controls the width of the colored band. Elapsed time controls how far its red and blue channels blend into each other. The buttons clear and reapply the effect.
