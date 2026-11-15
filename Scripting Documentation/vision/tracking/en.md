Use `Vision.createTrackingSession()` to follow objects or rectangles across successive UIImage images or [camera frames](scripting://doc?title=Live%20Camera%20Frames) on iOS 17 and later.

- `addObject(boundingBox, options?)` starts from a normalized box. `addRectangle(corners, options?)` starts from clockwise corners, beginning at the top left. All seed coordinates use a bottom-left origin.
- `process(source, { finishTracks?, signal? })` processes one frame. Camera frames may also specify an EXIF `orientation`. Await each result before submitting the next frame.
- Keep the source, frame dimensions, and orientation stable. Camera frames must come from the same capture stream in strictly increasing order. Call `reset()` and seed fresh tracks when changing streams.
- Each row includes the track ID, revision, optional native observation, and whether it was marked to finish. Rectangle observations also have four tracked corners. An absent result has a null observation. Use confidence and geometry to decide when to seed a fresh track. Add its old ID to `finishTracks` to retire the old track on that frame.
- Choose `fast` or `accurate` with `trackingLevel`. Native object tracking revision 2 uses the same algorithm for both. Read available revisions and limits with `Vision.getTrackingCapabilities()`.
- An error or cancellation after native processing begins clears all tracks in that sequence. The cancellation rejects promptly. While native processing finishes, a new frame or track may receive `busy`. Seed fresh tracks to continue, and call `close()` when finished.

The example tracks a box in an array of still frames. For a running camera, call `nextFrame()`, await `process(frame)`, and dispose that frame in a `finally` block.

```ts
async function trackObject(frames: readonly UIImage[], box: Vision.Rect) {
  const tracker = Vision.createTrackingSession()
  try {
    const id = tracker.addObject(box)
    const locations: Vision.TrackingObservation[] = []
    for (const [index, frame] of frames.entries()) {
      const [result] = await tracker.process(frame, {
        finishTracks: index === frames.length - 1 ? [id] : [],
      })
      if (result.observation) locations.push(result.observation)
    }
    return locations
  } finally {
    tracker.close()
  }
}
```

The demo moves a generated rectangle one frame at a time and reads both the object and rectangle results. It needs no camera.
