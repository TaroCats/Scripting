# Metal compute on RealityKit meshes

Use `mesh.compute(options)` to update a dynamic mesh’s vertex streams and indices with a Metal compute kernel. Entities already using the mesh display its published geometry. Check `RealityKit.getCapabilities().meshCompute` in a supported foreground App script on iOS 18 or later with a Metal device.

## Move a triangle

This example adds an X offset to three packed positions. It reads the mesh’s current positions at Metal buffer index 0 and writes the updated positions at index 1. Both bindings refer to the mesh’s vertex stream 0.

```ts
const device = Metal.Device.getDefault()
if (device && RealityKit.getCapabilities().meshCompute) {
  const mesh = RealityKit.Mesh.dynamic({
    positions: new Float32Array([-0.25, -0.35, 0, 0.25, -0.35, 0, 0, 0.35, 0]),
    indices: new Uint32Array([0, 1, 2]),
    indexType: "uint32",
    parts: [{ indexCount: 3, min: [-1, -0.5, 0], max: [1, 0.5, 0] }],
  })
  const library = await device.compileLibrary(`
#include <metal_stdlib>
using namespace metal;

kernel void move_triangle(const device packed_float3 *source [[buffer(0)]],
                          device packed_float3 *target [[buffer(1)]],
                          constant float &deltaX [[buffer(2)]],
                          uint vertexID [[thread_position_in_grid]]) {
  if (vertexID >= 3) return;
  float3 position = float3(source[vertexID]);
  position.x += deltaX;
  target[vertexID] = packed_float3(position);
}
`)
  const pipeline = await library.makeComputePipeline("move_triangle")
  try {
    const revision = await mesh.compute({
      pipeline,
      reads: [{ kind: "vertices", bufferIndex: 0, index: 0 }],
      writes: [{ kind: "vertices", bufferIndex: 0, index: 1 }],
      expectedRevision: mesh.info.revision,
      dispatch: {
        threadgroups: { width: 1 },
        threadsPerThreadgroup: { width: 4 },
        bytes: [{ index: 2, data: new Float32Array([0.5]) }],
      },
    })
    console.log(revision)
    // Attach mesh with entity.setModel(mesh, [material]) to display it.
  } finally {
    pipeline.dispose()
    library.dispose()
  }
}
```

## Bind streams and indices

- Use `{ kind: "vertices", bufferIndex, index }` for a vertex stream and `{ kind: "indices", index }` for the index buffer. `bufferIndex` selects a mesh stream. `index` identifies a Metal `[[buffer(index)]]` slot. Each Metal buffer slot belongs to one binding, including any buffers or inline bytes supplied through `dispatch`.
- `reads` use the published mesh bytes. Provide at least one write binding and at most one per mesh stream. Each write starts from a copy of the published bytes. Optional `byteOffset` and `byteLength` select the bytes to publish within the full buffer bound to the kernel. Bytes outside the selected range are preserved. Index ranges must begin and end on whole indices. Use distinct Metal slots when reading and writing the same mesh stream.
- Match the MSL element type, stride and offsets to the mesh descriptor. A packed position stream has a 12-byte stride, matching `packed_float3`. Match index bindings to the mesh’s `uint16` or `uint32` format. Provide a grid and a bounds check for any extra threads. [Metal compute grid sizes](https://developer.apple.com/documentation/metal/calculating-threadgroup-and-grid-sizes)
- Supply read-only Metal buffers through `dispatch.buffers`. Use `textures: [{ index, texture }]` to bind a `LowLevelTexture` with `shaderRead` usage to a read-only shader texture slot. Use resources from the same script and Metal device.

## Validate and publish

The GPU updates a candidate before the visible mesh changes. Native code checks the result on the CPU without passing the bytes back to JavaScript. The geometry must satisfy the same constraints as `mesh.update`. Active indices must reference active vertices, and each part’s bounds must contain its indexed geometry. Pass `vertexCount`, `indexCount` or `parts` in the same operation if the result needs different active ranges or bounds. The buffer capacities and layouts are fixed at creation. [Mesh deformation stacks](scripting://doc?title=RealityKit%20Mesh%20Deformation%20Stacks) use standard meshes.

`compute` returns the new revision as a decimal string once the mesh is committed. The renderer displays it in a subsequent frame. Pass `expectedRevision` to base the update on a specific revision. Put the optional abort `signal` alongside `dispatch`. A rejected or cancelled operation preserves the last published geometry and revision. Await an update before starting another update on the same mesh. Rebuild collision shapes separately if they need to follow the new geometry.

Run Demo moves a triangle left and right by writing its vertex stream. It also flips the triangle by updating its indices and part bounds together. The controls and status text describe the position and direction and report errors.

[RealityKit Meshes](scripting://doc?title=RealityKit%20Meshes) · [Metal Compute](scripting://doc?title=Metal%20Compute)
