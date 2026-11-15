# RealityKit View Depth Post-Processing

A Metal effect on a mounted `RealityView` can read the current scene depth alongside the rendered color. Set `sourceDepthIndex` to the index of a read-only `depth2d<float, access::read>` texture in the kernel. Use an index from 0 through 127 that differs from the source and target color indices.

```ts
declare const renderer: RealityKit.Renderer
declare const pipeline: Metal.ComputePipeline
renderer.setPostProcess({ pipeline, sourceColorIndex: 0, targetColorIndex: 1, sourceDepthIndex: 2 })
const info = renderer.postProcessInfo()
if (info.state === "applied") console.log(info.sourceDepthPixelFormatCode)
```

Depth and color share the current frame's pixel coordinates. Depth values are in the camera's projected depth range. With the reverse-Z perspective projection used in the example, closer geometry has larger depth values. To reconstruct view-space positions, use the same frame's projection matrix via `frameUniformIndex`. Preserve the source color at pixels with no usable depth. If the kernel checks for nonfinite values, compile its library with `enableFastMath: false`.

The pass uses a compatible single-sample `depth32Float` input supplied by the view. A frame without a compatible depth texture keeps the original colors and reports `bypassed` if the color transfer succeeds. `sourceDepthPixelFormatCode` is available when the depth pass is encoded. The iPad mini (6th generation) on iPadOS 27.2 has been verified. The tested iPadOS 26.5 and iOS 27.0 simulators bypass the effect.

Run the example to tint two planes according to their scene depth. The status text reports whether the effect is active or the original colors are shown. Use the button to switch between the two views of the scene.
