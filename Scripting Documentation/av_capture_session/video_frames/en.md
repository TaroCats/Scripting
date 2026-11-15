# Live camera frames

Add a global `AVCaptureVideoDataOutput` to an `AVCaptureSession` you create in the script. Use `nextFrame` to pull the latest camera frame. Use this alongside the existing capture preview, photo, and metadata outputs.

```ts
const camera = AVCaptureDevice.default("video")
if (!camera) throw new Error("No camera is available.")
const session = new AVCaptureSession()
const input = new AVCaptureDeviceInput(camera)
const output = new AVCaptureVideoDataOutput({ pixelFormat: "nv12VideoRange" })
try {
  session.configure(() => {
    session.addInput(input)
    session.addOutput(output)
  })
  await session.startRunning()
  const frame = await output.nextFrame()
  try {
    const [luma, chroma] = frame.copyPlanes()
    console.log(frame.info.presentationTime.seconds, luma.width, chroma.width)
  } finally {
    frame.dispose()
  }
} finally {
  output.dispose()
  try { await session.stopRunning() } finally { session.dispose() }
}
```

## Pixel formats and timing

- `native` uses the camera's native format. `bgra8`, `nv12VideoRange`, and `nv12FullRange` request specific formats. The camera and its active configuration determine availability. Check `frame.info.pixelFormatCode` for the native FourCC.
- `copyPlanes()` returns tightly packed copies for BGRA and 8-bit NV12. For NV12, plane 0 contains luma samples. Plane 1 contains interleaved Cb and Cr samples, two bytes per sample. Copied arrays remain usable after the frame is disposed.
- `frame.info` includes presentation time, duration, dimensions, and the output connection's rotation and mirror state. The output has already applied those changes to its pixels. The preview can use a different orientation.
- `frame.info.color` reports native color primaries, transfer function, YCbCr matrix, and chroma location when available. The values are the camera buffer’s native attachment strings.

## Pulling and releasing frames

Pass `{ signal }` to cancel a pull. Keep one pull pending at a time and dispose each frame as soon as you finish using it. The output keeps the newest frame when the producer gets ahead of the script. `frameStats` reports replacements and native drops for the life of the output. Stopping or reconfiguring the session invalidates old frame handles.

Run the demo to capture one BGRA frame and display a copy of its pixels.

For a video frame and its matching depth map, see [Synchronized Video and Depth](scripting://doc?title=Synchronized%20Video%20and%20Depth).
