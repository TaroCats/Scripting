Use ARKit scene depth on devices with a supported rear LiDAR scanner. Check `ARKit.getWorldTrackingCapabilities().sceneDepth` for `raw`, `smoothed`, and `both`. Request a mode explicitly when creating a world tracking session. An unsupported request fails instead of switching modes.

```ts
if (ARKit.getWorldTrackingCapabilities().sceneDepth.raw) {
  const session = ARKit.createWorldTrackingSession({ sceneDepth: "raw" })
  try {
    await session.start()
    const frame = await session.nextFrame()
    const depth = frame.sceneDepth
    if (depth) {
      const index = Math.floor(depth.height / 2) * depth.width + Math.floor(depth.width / 2)
      const distance = depth.distances[index]
      if (Number.isFinite(distance) && distance > 0) console.log(distance, depth.confidence?.[index])
    }
  } finally {
    session.close()
  }
}
```

Each depth map represents distance from the camera plane in meters. `distances` is a tightly packed, row-major `Float32Array`. Dimensions describe the depth map at its native resolution, in sensor orientation. Camera intrinsics refer to captured-image pixels. Align or scale the data when drawing it over a rotated or cropped preview. Raw depth belongs to the captured frame; smoothed depth is processed over time and uses the same frame's timestamp.

Optional `confidence` contains native bytes of the same dimensions (0 low, 1 medium, 2 high). Nonfinite and zero distances are preserved. Filter them and low-confidence samples as appropriate. `nativePixelFormatCode` and `nativeBytesPerRow` describe the input buffer, including any row padding; the exported arrays have no padding.

A disabled mode or frame with no depth returns `null`. If copying or allocating a map fails, check `sceneDepthError` or `smoothedSceneDepthError`. Other frame data remains available. If only confidence fails, the depth map still has its distances and reports `confidenceError`. Avoid holding unnecessary frames, as retained depth samples share a storage limit.

The runnable demo reports the distance and confidence at the center of the map. Point the rear camera at a surface and change your distance from it to compare raw and smoothed readings.
