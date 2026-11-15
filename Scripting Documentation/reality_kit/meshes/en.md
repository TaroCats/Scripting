`Mesh.primitive` creates boxes, spheres, planes, text, and on iOS 18 or later, cones and cylinders. `Mesh.generate` accepts packed Float32 position, normal, tangent and UV streams, plus triangles, polygons, or triangles and quads. Use `mesh.info.materialSlotCount` when assigning materials.

On iOS 18 or later, `Mesh.dynamic` creates reusable buffers with fixed capacities. Packed attributes use tightly packed Float32 elements. The advanced layout accepts byte offsets and strides, explicit formats and separate buffers. Submesh `indexOffset` counts indices. Patch offsets count bytes. A part’s bounding box must contain its indexed vertices.

`mesh.update` validates the resulting indices, counts and bounds before publishing the update. It returns the new revision as a decimal string. Pass `expectedRevision` to reject a stale update. Entity clones that share the mesh see its updates. Regenerate collision shapes explicitly when the collision geometry needs to change.

This example changes one vertex in a triangle. Attach the mesh with `entity.setModel(mesh, [material])` to display it in a scene.

```ts
const mesh = RealityKit.Mesh.dynamic({
  positions: new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]),
  indices: new Uint16Array([0, 1, 2]),
  indexType: "uint16",
  parts: [{ indexCount: 3, min: [-1, -1, 0], max: [1, 1, 0] }],
})

mesh.update({
  expectedRevision: mesh.info.revision,
  vertexBuffers: [{ bufferIndex: 0, byteOffset: 24, data: new Float32Array([0, 0.5, 0]) }],
})
```

[Mesh Compute](scripting://doc?title=RealityKit%20Mesh%20Compute) shows how to generate dynamic vertex or index data with Metal.

On iOS 27 or later, a dynamic mesh can also supply [per-instance attributes](scripting://doc?title=RealityKit%20Per-Instance%20Mesh%20Attributes).
