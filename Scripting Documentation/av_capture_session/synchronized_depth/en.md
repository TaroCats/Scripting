# Synchronized Video and Depth

Add `AVCaptureSynchronizedVideoDepthOutput` to an `AVCaptureSession` created by your script. Each `nextFrame()` delivers one native synchronized collection. Use a depth-capable camera, such as TrueDepth or LiDAR, and check that its video format exposes `supportedDepthDataFormats`.

```ts
const camera = AVCaptureDevice.defaultDevice("builtInTrueDepthCamera", "video", "front")
if (!camera) throw Error("No TrueDepth camera is available.")
const videoFormat = camera.formats.find(format => format.supportedDepthDataFormats.length > 0)
if (!videoFormat) throw Error("No compatible video format is available.")

const session = new AVCaptureSession()
let output: AVCaptureSynchronizedVideoDepthOutput | undefined
try {
  const frames = new AVCaptureSynchronizedVideoDepthOutput({ pixelFormat: "bgra8", filteringEnabled: false })
  output = frames
  const input = new AVCaptureDeviceInput(camera)
  session.configure(() => {
    session.addInput(input)
    camera.setActiveFormat(videoFormat)
    const depthFormat = camera.activeFormat.supportedDepthDataFormats[0]
    if (!depthFormat) throw Error("The active video format has no depth format.")
    session.setActiveDepthDataFormat(input, depthFormat)
    session.addOutput(frames)
  })
  await session.startRunning()
  const signal = AbortSignal.timeout(5_000)
  while (!signal.aborted) {
    const pair = await frames.nextFrame({ signal })
    try {
      const depth = pair.depthFrame
      if (!pair.videoFrame || !depth) continue
      const map = depth.copyMap()
      console.log(pair.info.timestamp.seconds, map.width, map.height, map.unit)
      break
    } finally {
      pair.dispose()
    }
  }
} finally {
  output?.dispose()
  try { await session.stopRunning() } finally { session.dispose() }
}
```

## Synchronization and lifetime

- Set `primary` to `"video"` (the default) or `"depth"`. Either setting can deliver collections with one member absent. Use `pair.info.video` and `pair.info.depth` to distinguish `ready`, `dropped`, and `missing`. A dropped member includes its timestamp, reason, and native reason code. A dropped depth member can still report its native format and calibration. A ready member has a timestamp and a frame handle until it is disposed. For an exact timestamp, read `timestampDetails` on the collection or member; it contains the native value, timescale, epoch, and flags. The value and epoch are decimal strings. The video's own presentation time is available on `pair.videoFrame.info`.
- Keep one pull pending and hold at most two collections. The output keeps the newest collection while the script is busy. Pass an abort signal to cancel a pull. Dispose each collection when finished. Disposing the collection, stopping the session, or changing its configuration invalidates its borrowed frame handles. Copied pixels remain usable.
- Use either synchronized capture or a standalone `AVCaptureVideoDataOutput` in the same session.

## Depth pixels and calibration

- `depth.info` reports its format, dimensions, physical rotation and mirroring, accuracy, quality, filtering state, and supported conversions. Filtering smooths the map and fills missing values. Unfiltered missing samples may be NaN.
- `depth.copyMap()` returns tightly packed `Data` with `bytesPerRow` for reading each row. The format is `depthFloat16`, `depthFloat32`, `disparityFloat16`, or `disparityFloat32`. Depth uses meters. Disparity uses inverse meters. Values reported with `relative` accuracy describe relative distance within the map.
- `copyMap({ format, orientation })` can convert to a format in `depth.info.availableFormats` and apply an additional EXIF orientation. The original map already reflects the output connection's orientation. A converted map includes the corresponding calibration, if available.
- `depth.calibration` may be `null`. Intrinsics are in pixels at `intrinsicMatrixReferenceDimensions`, which may differ from the map dimensions. The 3 × 3 intrinsic and 3 × 4 extrinsic matrices are column-major. Extrinsic translation and `pixelSize` are in millimeters. The distortion center and optional lookup tables support rectification of the native lens-distorted map.

Run the demo to capture a synchronized pair and read the depth map's center sample. Capture starts when you tap **Capture video and depth**.

See [Live Camera Frames](scripting://doc?title=Live%20Camera%20Frames) for the video frame's pixel planes and color information.
