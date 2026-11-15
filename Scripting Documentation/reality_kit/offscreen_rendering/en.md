# Offscreen rendering

Use [RealityKit Offscreen Post-Processing](scripting://doc?title=RealityKit%20Offscreen%20Post-Processing) to apply a Metal color pass before reading back the frame.

Use `RealityKit.OffscreenRenderer` to render a scene into pixels for a preview, image export, or frame-by-frame animation. It is available on iOS 18 or later in supported script contexts. Check `RealityKit.getCapabilities().offscreenRendering` before creating it.

## Render an image

```ts
if (RealityKit.getCapabilities().offscreenRendering) {
  const scene = RealityKit.Scene.create()
  const mesh = RealityKit.Mesh.primitive({ type: 'plane', width: 1, height: 1, vertical: true })
  const material = RealityKit.Material.create({ kind: 'unlit', baseColor: [1, 0.28, 0.06, 1] })
  const entity = RealityKit.Entity.create()
  let renderer: RealityKit.OffscreenRenderer | undefined
  try {
    entity.setModel(mesh, [material])
    scene.add(entity)
    renderer = RealityKit.OffscreenRenderer.create(scene, { background: [0.04, 0.08, 0.11, 1] })
    const frame = await renderer.render({ width: 288, height: 192 })
    const image = UIImage.fromPixels({
      width: frame.width, height: frame.height, bytesPerRow: frame.bytesPerRow,
      data: frame.data, format: 'bgra8', alphaMode: 'opaque',
    })
    console.log(frame.frameIndex, image.width, image.height)
  } finally {
    renderer?.dispose()
    entity.dispose()
    material.dispose()
    mesh.dispose()
    scene.dispose()
  }
}
```

The demo displays a rendered frame and lets you advance the animation in quarter-second steps.

## Camera and lighting

Pass `camera` to `create` or call `setCamera(camera)` to change the view. `configure(options)` changes the settings you supply. The default background is opaque black, tone mapping is on, and antialiasing is `'none'`. Set `antialiasing: 'multisample4X'` for 4× multisampling.

`background` accepts an RGBA color or `'outputTexture'` to use the pixels in the output texture as the background. For image-based lighting, await `setEnvironment(image, { intensityExponent: 0 })` with an upright 2:1 equirectangular UIImage up to 2048 pixels wide. Call `setEnvironment(null)` to clear the lighting environment.

Extended dynamic range is off by default. Set `edr: { headroom: 2 }` to enable it and render with `'rgba16Float'`. Pass `edr: null` to turn it off. The headroom range is 1 to 16, with a default of 2 when enabled.

## Frame data

`render` takes positive integer `width` and `height` in pixels. Each call renders one target and returns `width`, `height`, `bytesPerRow`, `pixelFormat`, `frameIndex`, and `data`. The row stride is tightly packed. The frame index is a decimal string that advances on successful delivery.

- `'bgra8Unorm'` is the default. Each pixel contains four bytes in blue, green, red, alpha order. Use `UIImage.fromPixels` with `format: 'bgra8'` to display an opaque frame as shown above.
- `'rgba16Float'` stores four 16-bit floating-point channels in red, green, blue, alpha order for eight bytes per pixel. Use the raw frame data when working with this format.
- `dataType` defaults to `'uint8Array'`. Use `'data'` to receive `Data`.
- `viewport` uses fractions of the output dimensions. Its origin defaults to `(0, 0)` and its size to `(1, 1)`, which covers the full frame. Specify positive `width` and `height` to render into a different area.
- `initialPixels` accepts `Uint8Array` or `Data` in the same format and must contain exactly `height * bytesPerRow` bytes. The target starts with zero-filled pixels when you omit it. With `'outputTexture'` as the background, you can pass an earlier matching frame as the initial pixels.

## Time and scene ownership

Start playback with `entity.playAnimation(clip)` after attaching the scene to the offscreen renderer. Call `update(deltaTime)` to advance the simulation without producing a frame. Pass `deltaTime` to `render` to advance and capture in one call. Time steps are finite nonnegative seconds. The default for `render` is zero.

A scene can belong to one onscreen or offscreen renderer at a time. Render one frame at a time and await it before changing the renderer settings. `render` and `setEnvironment` accept an `AbortSignal`. If a frame is cancelled after the simulation step has started, the scene may already have advanced.

Call `dispose()` when you finish. If a frame is still rendering, the scene becomes available for reuse when that work ends.

## Related documentation

- [RealityKit Rendering and Interaction](scripting://doc?title=RealityKit%20Rendering%20and%20Interaction)
- [RealityKit Animation](scripting://doc?title=RealityKit%20Animation)
- [UIImage](scripting://doc?title=UIImage)
