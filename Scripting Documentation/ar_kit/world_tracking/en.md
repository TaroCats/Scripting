Use the global `ARKit` API to track the device and estimate surfaces with the rear camera. Run `ARKit.getWorldTrackingCapabilities()` on the device first. Start from the app in the foreground, allow camera access, and close or pause any other camera session. Camera Control scripts cannot start this session.

```ts
if (ARKit.getWorldTrackingCapabilities().supported) {
  const session = ARKit.createWorldTrackingSession({ detectVerticalPlanes: false })
  try {
    await session.start()
    const frame = await session.nextFrame()
    console.log(frame.worldMappingStatus, frame.anchors.filter(anchor => anchor.plane !== null).length)
  } finally {
    session.close()
  }
}
```

### Planes and frames

Horizontal and vertical plane detection are on by default. Each frame includes the original timestamp, camera transform and intrinsics, tracking quality, anchors, and world mapping status. A running session can still be initializing or have limited tracking. A fresh start after pausing resets the world. Read one `nextFrame()` at a time. When you skip reads, the session keeps the latest snapshot.

Positions use meters and matrices use column-major order. The plane center, vertices, and boundary are in anchor-local XZ coordinates; transform them to world coordinates with `anchor.transform`. Apply `rotationOnYAxis` around the center only when drawing the extent rectangle. Classification may be unavailable or still underdetermined.

For just the plane bounds or classification, set `planeGeometry: false`. If a frame exceeds the geometry budget, some plane geometries are `null` with a `geometryError`. A nonzero `omittedAnchorCount` means the snapshot is incomplete; an absent ID alone is then insufficient to determine that an anchor was removed. ARKit can merge planes. A removed plane may have no replacement with the same ID.

### Rays and anchors

Use a world-space origin and a nonzero direction, each as three elements in a `Float32Array`. A ray returns the native ordered hits, which can be empty. The default target is the geometry of an existing plane; also available are its infinite extension or an estimated plane. An estimated hit may have no anchor.

```ts
const session = ARKit.createWorldTrackingSession()
try {
  await session.start()
  // Run the query after scanning the surface.
  const [hit] = session.raycast({
    origin: new Float32Array([0, 1, 0]),
    direction: new Float32Array([0, -1, 0]),
    alignment: "horizontal",
  })
  if (hit?.worldTransform) {
    const id = session.addAnchor({ name: "Floor marker", transform: hit.worldTransform })
    // This anchor appears in a subsequent frame. Remove it by this ID when finished.
    session.removeAnchor(id)
  }
} finally {
  session.close()
}
```

`removeAnchor` only removes an anchor added by this session in its current generation. Changes to anchors appear in subsequent frames. For camera output, enable `captureImage` or set a fixed `viewport` for projection and the image display transform, as described in [Face Tracking](scripting://doc?title=ARKit%20Face%20Tracking).

In the demo, slowly aim the rear camera around a room until planes appear in the count. Point it at a detected surface, choose **Place anchor ahead**, then **Remove demo anchor**. The demo reports location in text and uses no camera preview.

Save a map to restore a scanned space with [ARKit World Maps](scripting://doc?title=ARKit%20World%20Maps).

Use [ARKit Scene Depth](scripting://doc?title=ARKit%20Scene%20Depth) for distance maps from the rear LiDAR scanner.

Use [ARKit Scene Mesh](scripting://doc?title=ARKit%20Scene%20Mesh) to read and classify reconstructed surfaces.
