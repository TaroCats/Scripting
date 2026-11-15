# Offscreen external textures

Use `OffscreenRenderer.renderWithExternalTexture` to draw a camera frame or pixel buffer on a plane for one offscreen render. Check `RealityKit.getCapabilities().offscreenExternalTextures` before use. This API is available on iOS 27 or later.

## Render from a pixel buffer

```ts
if (RealityKit.getCapabilities().offscreenExternalTextures) {
  const pixels = PixelBuffer.create({
    width: 2, height: 2, format: 'bgra8',
    data: new Uint8Array([
      0, 64, 240, 255, 64, 210, 20, 255,
      240, 120, 20, 255, 0, 210, 240, 255,
    ]),
  })
  const scene = RealityKit.Scene.create()
  let renderer: RealityKit.OffscreenRenderer | undefined
  try {
    renderer = RealityKit.OffscreenRenderer.create(scene, {
      camera: { position: [0, 0, 3], target: [0, 0, 0] },
    })
    const frame = await renderer.renderWithExternalTexture(pixels, {
      width: 256, height: 192,
      surface: {
        width: 1.6, height: 1.6,
        sampler: { minFilter: 'nearest', magFilter: 'nearest' },
      },
    })
    const image = UIImage.fromPixels({
      width: frame.width, height: frame.height, bytesPerRow: frame.bytesPerRow,
      data: frame.data, format: 'bgra8', alphaMode: 'opaque',
    })
    console.log(frame.frameIndex, image.width, image.height)
  } finally {
    renderer?.dispose()
    scene.dispose()
    pixels.dispose()
  }
}
```

Pass a packed BGRA8 `PixelBuffer` or `AVCaptureVideoFrame` from the same script. Its pixels must have compatible IOSurface backing. For camera frames, request `{ pixelFormat: 'bgra8' }` on `AVCaptureVideoDataOutput`. The plane samples the captured pixels as delivered, including any rotation and mirroring already applied by the capture output. The method uses raw BGRA values without color-profile conversion.

## Place the plane and read the frame

The required `surface` describes a temporary unlit plane. Its `width` and `height` are positive sizes in scene units. Set `transform` to position, rotate, or scale the plane, and use `sampler` to control how the source texture is sampled. The plane appears only in this render. It has no script entity or reusable texture handle.

The top-level `width` and `height` are output pixels. The other output options and the result match `render`, including viewport, frame time, and the choice of `Uint8Array` or `Data`. RealityKit samples the source texture directly and returns a separately rendered frame. The configured offscreen color pass applies to the rendered output. [RealityKit Offscreen Rendering](scripting://doc?title=RealityKit%20Offscreen%20Rendering)

## Keep the source valid

Keep the source valid until the operation settles, then dispose it when no longer needed. A pixel buffer and its shared storage cannot be modified while the renderer is reading them. Await each frame before starting the next one. Pass an abort `signal` to cancel delivery. An already submitted frame may finish after cancellation, and a cancelled call may already have advanced the scene.

If the device cannot confirm that rendering finished, the renderer closes and the source can stay busy while it finishes. Wait for the source to become available before retrying with a new renderer.

Use an external texture snapshot for a reusable texture binding or when the source cannot be borrowed directly. The one-frame API currently accepts packed BGRA8 sources. [RealityKit External Textures](scripting://doc?title=RealityKit%20External%20Textures) · [Live Camera Frames](scripting://doc?title=Live%20Camera%20Frames)

Run the demo to render two patterns in turn from the same pixel buffer. The controls update the pattern and the status text reports the last rendered frame.
