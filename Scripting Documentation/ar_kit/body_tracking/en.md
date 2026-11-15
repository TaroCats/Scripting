`ARKit.createBodyTrackingSession()` tracks a person in the rear camera's view in a foreground App script. Keep the whole subject in view. `ARKit.getCapabilities()` reports device support, support for 2D detection, and available video formats. The session uses gravity-aligned world coordinates. A new `start()` after `pause()` or failure starts a new generation and resets world tracking.

## Session lifecycle

Use `start()` to request camera access and run the native session. `running` means ARKit accepted the start request. Use `nextFrame()` to wait for captured data. A session may also report `starting`, `interrupted`, `paused`, `failed`, or `closed`. `addStateListener` returns a token for `removeStateListener`. Read `getLastError()` after a failure for the code and message. A system interruption retains camera ownership while ARKit can recover. Wait for `running` before reading again. Leaving the app pauses the session. Use `close()` to release the session when you are done.

When a script `AVCaptureSession` or the recorder owns the camera, `start()` can reject with `cameraBusy`. Stop that capture first. A recorder preview can continue owning the camera after recording ends. Only one `nextFrame()` may wait at a time. The session keeps the latest unused frame and replaces older unread frames. `getStats()` returns exact decimal counts for received, replaced and invalid frames in the current generation. An `AbortSignal` can cancel a pending read.

## Skeleton data

Each frame has a generation, a capture timestamp in seconds, camera intrinsics and tracking state, and the body anchors seen by ARKit. Compare timestamps within one generation. Anchor IDs identify a tracked body within that generation. Optional `detectedBody` holds separate 2D landmarks in upper-left normalized camera-image coordinates and uses its own joint ordering. Map coordinates to any displayed preview using its orientation, cropping and mirroring.

A 3D joint occupies 16 floats in column-major order. Local transforms are relative to the parent joint. Model transforms are relative to the body anchor. To get a world transform, multiply the anchor matrix by the joint's model matrix. Translation occupies indices 12–14. `jointFlags` bit 1 records tracking, bit 2 marks a finite local matrix, and bit 4 marks a finite model matrix. For 2D, bit 8 marks a finite landmark. Some untracked joints still carry finite transforms. Use both tracking and validity before measuring a joint. `getBodySkeletonDefinition('body3D')` provides native names, parent indices and an independent reference T-pose. `estimatedScaleFactor` is ARKit's scale estimate relative to its reference skeleton.

```ts
async function readBodyFrame(signal?: AbortSignal) {
  const capabilities = ARKit.getCapabilities()
  if (!capabilities.bodyTracking) return null
  const tracker = ARKit.createBodyTrackingSession({ detectBody2D: capabilities.bodyDetection2D })
  try {
    await tracker.start()
    return await tracker.nextFrame({ signal })
  } finally {
    tracker.close()
  }
}
```

The demo measures the left knee angle and counts a bent-to-straight movement. It resets its movement state when tracking is lost. Keep the hip, knee, and ankle visible and select Stop tracking to release the camera.
