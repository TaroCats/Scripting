# External textures

Use `RealityKit.ExternalTexture` to display a snapshot of a `PixelBuffer` or `AVCaptureVideoFrame` on a RealityKit material. This API is available on iOS 27 or later. Check `RealityKit.getCapabilities().externalTextures` before use.

## Create and bind a snapshot

`await RealityKit.ExternalTexture.create(source, { signal? })` copies the source pixels into an independent BGRA8 texture snapshot. It accepts BGRA plane 0. Use `'bgra8'` with `PixelBuffer.create` or request `{ pixelFormat: 'bgra8' }` when creating an `AVCaptureVideoDataOutput`. Keep a camera frame valid until the operation finishes. The texture samples the source BGRA values directly. Convert the image before creating the snapshot if your workflow needs color-profile conversion.

```ts
const source = PixelBuffer.create({
  width: 2, height: 1, format: 'bgra8',
  data: new Uint8Array([0, 80, 255, 255, 255, 160, 0, 255]),
})
let external: RealityKit.ExternalTexture
try {
  external = await RealityKit.ExternalTexture.create(source)
} finally {
  source.dispose()
}

const material = RealityKit.Material.create({
  kind: 'unlit', baseColor: [1, 1, 1, 1],
  baseColorTexture: { texture: external.texture },
})
const plane = RealityKit.Entity.create()
plane.setModel(RealityKit.Mesh.primitive({ type: 'plane', width: 1, height: 0.5, vertical: true }), [material])
```

Changing or disposing the source after a successful operation leaves the published snapshot intact. `info` reports its width and height in pixels, `pixelFormat: 'bgra8Unorm'`, `storage: 'snapshot'`, a revision string, and `source` (`'pixelBuffer'` or `'camera'`). Camera snapshots may also report `timestamp` as a `MediaTime`, `rotationAngle` in degrees, and `mirrored`. Rotation and mirroring describe changes already applied by the capture output.

## Replace the snapshot

`await external.replace(source, { expectedRevision?, signal? })` publishes another snapshot and returns its revision string. The same `external.texture` can stay bound to the material. Pass the revision you observed as `expectedRevision` to reject a replacement if another operation already changed the texture.

Await each replacement before starting another. A cancelled or rejected replacement leaves the previous snapshot and revision available. A successful replacement publishes the texture for subsequent rendering. Dispose source buffers or frames when the operation finishes, and call `external.dispose()` when you are finished replacing snapshots. Existing texture handles and material bindings can retain the last snapshot.

Snapshots from earlier replacements count toward the runtime's RealityKit resource limit while the texture is still referenced. For continuous frame updates, use [RealityKit Low-Level Textures](scripting://doc?title=RealityKit%20Low-Level%20Textures).

## Capture a camera snapshot

Pass the frame directly from a running capture session with a BGRA video output. The frame can be released once the replacement finishes.

```ts
async function captureSnapshot(output: AVCaptureVideoDataOutput, external: RealityKit.ExternalTexture) {
  const frame = await output.nextFrame()
  try {
    return await external.replace(frame, { expectedRevision: external.info.revision })
  } finally {
    frame.dispose()
  }
}
```

Run the demo to switch a single material between two generated patterns. The status text identifies the pattern and its revision.

[PixelBuffer](scripting://doc?title=PixelBuffer) · [Live Camera Frames](scripting://doc?title=Live%20Camera%20Frames)
