Use the global `ARKit` API to track faces with the front camera on supported iPhone and iPad devices. Use `ARKit.getFaceTrackingCapabilities()` to check support, video formats, the face limit, and whether device world tracking can run in the face session.

```ts
const support = ARKit.getFaceTrackingCapabilities()
if (support.supported) {
  const session = ARKit.createFaceTrackingSession({ maximumFaces: 1 })
  try {
    await session.start()
    const frame = await session.nextFrame()
    for (const face of frame.faces) {
      if (!face.tracked) continue
      console.log(face.geometry.vertices.length / 3, face.blendShapes.jawOpen)
    }
  } finally {
    session.close()
  }
}
```

## Geometry and coordinates

Each frame has a time in seconds and a sequence number within its session generation. An empty `faces` array is normal if no face is visible. An anchor's identifier identifies the face anchor within the session. Use `tracked` to decide whether to apply the latest pose.

- `geometry.vertices` contains consecutive XYZ triples in meters in face coordinates. `textureCoordinates` contains UV pairs for applying a texture to the mesh. `triangleIndices` contains unsigned triples indexing the vertices. Reuse topology while updating positions. Coordinate correspondence with another head model is model specific.
- `anchorTransform` transforms face coordinates to session world coordinates. Eye transforms and the estimated `lookAtPoint` are relative to the face. Left and right are the subject's left and right. Matrices use column-major order. An unavailable or nonfinite estimate is `null`.
- `blendShapes` uses native names and coefficients. An observed coefficient can be zero. A missing name has no reported value.

Give the session a `viewport` to get the native view and projection matrices and `displayTransform` for its size and orientation. To project a mesh vertex, multiply by projection × view × face transform, then divide by W. The display transform maps normalized raw image coordinates to normalized view coordinates. Use it to position the camera image. Mesh UVs serve material mapping. Start a session with a new viewport when the display size or orientation changes.

## Images and camera lifecycle

Set `captureImage: true` to receive a copy of the raw camera image from the same frame. Read its format, color attachments and plane sizes before using the bytes. Each plane's `bytesPerRow` describes its packed `Data`, and `nativeBytesPerRow` describes the input row. The bytes use the sensor orientation. If the format is unavailable or the copy budget is exhausted, the frame still reports tracking data and sets `imageError`.

Start in the foreground and grant camera access. Camera Control scripts cannot start a face tracking session. Keep one pending `nextFrame()` and use an `AbortSignal` to cancel a read. If you stop reading briefly, the session keeps the most recent snapshot. Pause or close before starting another camera session. A new start resets tracking and begins a new stream generation. Use `addStateListener()` to watch for interruptions and `getLastError()` to inspect failures.

The runnable example draws a projected face mesh and reports tracked faces and the jaw coefficient. Facing the camera, open your mouth, blink, and turn your head to try it. The example uses local frame data and provides separate Start, Stop and Done controls.
