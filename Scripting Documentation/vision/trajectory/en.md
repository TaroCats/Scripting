# Vision Trajectory Detection

Use `Vision.createTrajectorySession()` to detect a moving object's parabolic path across frames. It returns measured centroids, fitted points, the coefficients of `y = a*x*x + b*x + c`, the moving average radius, and the observation's `MediaTime` range.

```ts
const session = Vision.createTrajectorySession({
  trajectoryLength: 8,
  objectMinimumNormalizedRadius: 0.01,
  objectMaximumNormalizedRadius: 0.05,
})
try {
  for (const [index, image] of images.entries()) {
    const rows = await session.process(image, {
      presentationTime: MediaTime.make({ value: index, timescale: 30 }),
    })
    for (const row of rows) console.log(row.equationCoefficients, row.timeRange.duration.seconds)
  }
} finally {
  session.close()
}
```

Use steadily increasing presentation times. Pass each `UIImage` with a `MediaTime`, or supply BGRA8 or 8-bit NV12 frames from one `AVCaptureVideoDataOutput` with their original timestamps. Camera frames accept an optional `orientation`. Keep one source, size, orientation and pixel format until `reset()`. Await each frame before submitting another.

Use a stationary camera when measuring a path. `trajectoryLength` is the number of points the detector needs. `minimumLatencyFrameCount` reports the configured request's native latency. `frameAnalysisSpacing` sets the minimum sample spacing for analysis. `targetFrameTime` adjusts the next frame's accuracy in response to processing time. With `regionOfInterest`, points use normalized coordinates within that region. The region and its points use a bottom-left origin. The coefficients and normalized radius preserve the values reported by Vision.

Each call returns the observations Vision currently reports. It can return an empty array while Vision gathers evidence, or repeat an observation on later frames with the same ID and time range. Use that range to tell whether the path advanced. Use `Vision.getTrajectoryCapabilities()` to query revisions and length limits. Cancel an in-flight call using `signal`, reset before restarting, and close the session when finished.
