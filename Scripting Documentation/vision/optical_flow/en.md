# Vision Optical Flow

Use `Vision.createOpticalFlowSession()` on iOS 17 or later to read a field of displacement vectors between consecutive images. Set `accuracy` to `low`, `medium`, `high`, or `veryHigh`. Use `format: "float32"` for the default, `"float16"` for half precision, or `"network"` for the raw model output.

```ts
const session = Vision.createOpticalFlowSession({ accuracy: "low", format: "float16" })
try {
  await session.process(first, { presentationTime: MediaTime.zero() })
  const [observation] = await session.process(second, {
    presentationTime: MediaTime.make({ value: 1, timescale: 30 }),
  })
  if (observation) {
    const { field } = observation
    try {
      const { width, height } = field.info
      console.log(field.vectorAt(Math.floor(width / 2), Math.floor(height / 2)))
    } finally { field.dispose() }
  }
} finally { session.close() }
```

The first frame establishes a reference. Pass an increasing `MediaTime` with every `UIImage`. BGRA8 and 8-bit NV12 `AVCaptureVideoFrame` inputs carry their own timestamps and accept optional `orientation`. Keep a consistent source, dimensions, orientation and pixel format. Await each result before processing the next frame. Call `reset()` to change source or start again, and pass an abort `signal` to cancel processing.

The optional normalized `regionOfInterest` uses the bottom-left origin of the oriented input. The returned field reports its actual width, height, native row stride and FourCC. ROI and raw network mode can affect its layout. `vectorAt(column, row)` uses the stored row order and preserves the two native components. `copyBytes()` returns independent packed data with two interleaved Float32 values or two Float16 bit patterns per pixel. Use `bytesPerRow` for that packed copy. `networkOutput` identifies raw results, whose dimensions and vector scale can differ from the regular field.

Raw network output is available when Vision reports an interleaved two-component Float32 or Float16 buffer. Other native layouts return `unsupportedPixelFormat`.

Close the session and dispose fields you no longer need. At most one optical-flow session can be open per script. The session can return `busy` when another script is computing flow. `Vision.getOpticalFlowCapabilities()` lists options and the input size limit. If large inputs reach the storage limit, resize the sequence and release earlier results.
