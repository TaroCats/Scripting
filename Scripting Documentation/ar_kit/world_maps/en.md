An ARKit world map stores the spatial data and static anchors of a world tracking session. Use it to return to a room and restore the same coordinate space. Capture after tracking is normal and the map status is `extending` or `mapped`.

```ts
const session = ARKit.createWorldTrackingSession()
try {
  await session.start()
  // Scan the room and wait for sufficient mapping before capturing.
  const map = await session.captureWorldMap()
  const path = FileManager.temporaryDirectory + "/world-map.bin"
  await FileManager.writeAsData(path, map)
  session.close()

  const restored = ARKit.createWorldTrackingSession({ initialWorldMap: await FileManager.readAsData(path) })
  try {
    await restored.start()
    const frame = await restored.nextFrame()
    console.log(frame.camera.tracking, frame.anchors.length)
  } finally {
    restored.close()
  }
} finally {
  session.close()
}
```

One map capture may be active per session. Pausing, closing, or interrupting the session cancels its pending capture. The archive is native binary `Data` (up to 32 MiB); the runtime does not write files automatically. Read archives from trusted sources, since a map contains information about the room. A changed room, poor light, or a map of a different location can prevent relocalization.

`start()` starts capture. Watch for normal tracking and the appearance of your saved anchors to confirm relocalization. To abandon an unsuccessful restore, close the session and start a new one without `initialWorldMap`. An anchor restored from a map can be read from frames; `removeAnchor()` only removes an anchor you added in the current run.

The demo starts a scan and inserts a marker. After scanning a room, choose **Save map**, then **Reopen saved map**. Slowly point the rear camera at the same area and check for a message confirming the marker. Each save replaces the demo map in the script's folder.
