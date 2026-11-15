On iOS 18 or later, call `RealityKit.OffscreenRenderer.setPostProcess(options)` to run a Metal compute kernel on each rendered image. Pass `null` to clear the effect. Use a pipeline created with [Metal](scripting://doc?title=Metal%20Compute).

- The kernel reads the rendered color in a `texture2d<float, access::read>` or `texture2d<half, access::read>` at `sourceColorIndex` (default 0).
- It writes to a separate `texture2d<float, access::write>` or `texture2d<half, access::write>` at `targetColorIndex` (default 1). Pixels that the kernel leaves alone keep the original color.
- `uniforms` provides copied, read-only bytes at each Metal buffer index. Use the same size and alignment as your Metal declaration. Each uniform accepts up to 4096 bytes.
- Threads cover the whole target, including pixels outside the optional render viewport. Check bounds with `get_width()` and `get_height()`.
- Output stays in the render call's BGRA8 or RGBA16Float format. The effect can be replaced when rendering is idle.

This example assumes a pipeline with both default color texture indices and a single float uniform at buffer index 0. The demo compares a rendered scene before and after changing its color channels.

```ts
function setColorPass(renderer: RealityKit.OffscreenRenderer, pipeline: Metal.ComputePipeline) {
  const amount = new Float32Array([0.75])
  renderer.setPostProcess({ pipeline, uniforms: [{ index: 0, data: amount }] })
}
```
