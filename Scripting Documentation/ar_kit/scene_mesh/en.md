On a supported rear LiDAR device, world tracking can reconstruct the room as a triangle mesh. Check `ARKit.getWorldTrackingCapabilities().sceneReconstruction` for `mesh` or `meshWithClassification`. Request the mode when creating a world tracking session. Unsupported requests fail explicitly.

```ts
if (ARKit.getWorldTrackingCapabilities().sceneReconstruction.mesh) {
  const session = ARKit.createWorldTrackingSession({ sceneReconstruction: "mesh" })
  try {
    await session.start()
    await session.nextFrame()
    const { anchors } = session.getSceneMeshAnchors()
    const entry = anchors.find(anchor => anchor.triangleCount > 0)
    if (entry) {
      const mesh = session.copySceneMesh({ id: entry.id })
      console.log(mesh?.geometry?.vertices.length)
    }
  } finally {
    session.close()
  }
}
```

Mesh anchors have their own list. The list contains IDs, geometry revisions, transforms and counts; use successive lists to notice additions, removals and changes. The list is incomplete (`complete: false`) while reconciling anchors or when the scene exceeds the anchor budget. It cannot establish that a missing anchor was removed. The list reflects live native anchor events and isn't tied to a previously read camera frame.

Request only the geometry you need. Each `copySceneMesh()` returns fresh typed arrays in the anchor's coordinate space. Use its transform for world placement. Indices are triangle triples. If requested and provided by ARKit, classifications are native bytes in the same order as triangles: 0 unclassified, 1 wall, 2 floor, 3 ceiling, 4 table, 5 seat, 6 window, 7 door. Treat other values as unknown.

The copy may return `null` after removal, or `geometry: null` with a `geometryError` when the anchor has no valid retained geometry. To copy exactly the revision you saw in the list, pass it as `revision`. On `staleRevision`, list the anchors again. Pausing and restarting resets the scene. Previously copied arrays stay usable but count toward the script's mesh budget while retained.

The demo renders part of one anchor in a local wireframe and reports the number of anchors and triangles in text. Scan a floor and then walls to see the mesh refine.
