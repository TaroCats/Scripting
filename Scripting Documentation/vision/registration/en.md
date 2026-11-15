# Vision Image Registration

`Vision.createRegistrationSession()` aligns consecutive images on iOS 17 or later. Choose `kind: "translation"` for an x/y shift or `kind: "homography"` for a perspective transform. `Vision.getRegistrationCapabilities()` lists native revisions, the default revision, minimum frame latency and the session limit. To analyze a region, submit images cropped to the same rectangle and use coordinates relative to that crop.

```ts
const session = Vision.createRegistrationSession({ kind: "translation" })
try {
  await session.process(first, { presentationTime: MediaTime.zero() })
  const results = await session.process(second, {
    presentationTime: MediaTime.make({ value: 1, timescale: 30 }),
  })
  for (const result of results) {
    if (result.kind === "translation") console.log(result.transform.tx, result.transform.ty)
  }
} finally {
  session.close()
}
```

Pass a `MediaTime` with each `UIImage`. An `AVCaptureVideoFrame` already carries its own presentation time and accepts an optional `orientation`. Use BGRA8 or 8-bit NV12 camera frames. Keep one input source, size and orientation per session. Camera frames must come from the same stream and pixel format. Times must increase. Await each frame before submitting the next.

The first frame establishes a reference and returns an empty array. Later observations retain Vision's native transform from the current oriented image toward its reference. Translation reports the six affine coefficients in image pixels. Homography reports a column-major 3 × 3 matrix in image pixel coordinates. Apply it to `[x, y, 1]` and divide by the third component. For example, content shifted four pixels right in the second frame yields an alignment near `tx = -4`.

Use `reset()` when changing source or restarting the sequence. Pass `signal` to cancel an in-flight call. If processing has already started, cancellation clears the reference. Close the session when finished. The runnable example compares translation and perspective alignment on the same synthetic frames.

If a large image returns `resourceLimit`, resize the images to a common smaller resolution before processing. Rotated and vector images can require additional raster storage.
