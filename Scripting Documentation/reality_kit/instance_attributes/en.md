# Per-instance mesh attributes

Give copies of the same dynamic mesh different colors, UV coordinates or other mesh attributes. Check `RealityKit.getCapabilities().meshInstanceAttributes` in a supported foreground App script on iOS 27 or later. Use `InstanceData` separately to choose how many copies to draw and where to place them.

## Share a color across two copies

This example uses one triangle, four instance transforms and two color entries. The color stream advances after every two instances. Compile this surface function for the target platform and put it in a `.metallib` before running the TypeScript example.

```metal
#include <metal_stdlib>
#include <RealityKit/RealityKit.h>
using namespace metal;

[[visible]]
void scriptingInstanceColor(realitykit::surface_parameters parameters) {
  parameters.surface().set_emissive_color(half3(parameters.geometry().color().xyz));
}
```

```ts
const device = Metal.Device.getDefault()
const capabilities = RealityKit.getCapabilities()
if (device && capabilities.meshInstanceAttributes && capabilities.customMaterials) {
  const library = await device.loadLibrary("/path/to/instance-attributes.metallib")
  const material = RealityKit.Material.custom({
    surface: { library, name: "scriptingInstanceColor" },
    lightingModel: "unlit",
  })
  library.dispose()

  const mesh = RealityKit.Mesh.dynamic({
    vertexCount: 3, vertexCapacity: 3, indexCount: 3, indexCapacity: 3,
    indexType: "uint32", indices: new Uint32Array([0, 1, 2]),
    instanceCapacity: 4,
    layouts: [
      { bufferIndex: 0, bufferStride: 12 },
      { bufferIndex: 1, bufferStride: 16, stepFunction: "perInstance", stepRate: 2 },
    ],
    attributes: [
      { semantic: "position", format: "float3", layoutIndex: 0, offset: 0 },
      { semantic: "color", format: "float4", layoutIndex: 1, offset: 0 },
    ],
    vertexBuffers: [
      new Float32Array([-0.18, -0.25, 0, 0.18, -0.25, 0, 0, 0.25, 0]),
      new Float32Array([1, 0.24, 0.07, 1, 0.07, 0.76, 1, 1]),
    ],
    parts: [{ indexCount: 3, min: [-0.19, -0.26, 0], max: [0.19, 0.26, 0] }],
  })
  const transforms = new Float32Array(4 * 16)
  for (const [index, x] of [-0.78, -0.26, 0.26, 0.78].entries()) {
    transforms.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, 0, 0, 1], index * 16)
  }
  const instances = RealityKit.InstanceData.create({ capacity: 4, transforms })
  const entity = RealityKit.Entity.create()
  entity.setModel(mesh, [material])
  entity.setMeshInstances({ instances })
  const scene = RealityKit.Scene.create()
  scene.add(entity)

  mesh.update({
    vertexBuffers: [{ bufferIndex: 1, byteOffset: 16, data: new Float32Array([0.25, 1, 0.35, 1]) }],
  })
}
```

## Lay out and update the streams

- Use the explicit buffer layout of `Mesh.dynamic`. Keep `position` in a `perVertex` layout. Use `stepFunction: "perInstance"` for a stream that advances by instance. Its `stepRate` defaults to 1. Each row serves that many consecutive instances, so a stream needs `Math.ceil(instanceCapacity / stepRate)` rows. Use byte offsets and strides in the layout.
- Layouts sharing a buffer use the same step function and rate.
- Supply all rows when creating the mesh. `mesh.info.instanceCapacity` reports the mesh limit and is zero for a regular mesh. The capacity of every bound `InstanceData` must fit within the mesh limit when it has per-instance streams. The separate `InstanceData.info.count` determines how many copies to draw. Lowering the count preserves the remaining attribute rows and transforms.
- Use `mesh.update({ vertexBuffers })` for byte patches. In `mesh.compute`, use `kind: "vertices"` to bind the same stream by its `bufferIndex`. These buffers belong to the mesh, so an update reaches entities and clones that share it. Use `instances.update` or `instances.compute` to change transforms or the number of visible copies.

Choose a material that consumes the semantic you supply. The demo uses a custom surface shader to read `geometry().color()`. A custom shader can use the corresponding geometry accessor for UV coordinates.

Run Demo shows two orange and two cyan triangles. Use the buttons to swap the group colors and switch between two and four copies. The status text describes the current groups.

[RealityKit Meshes](scripting://doc?title=RealityKit%20Meshes) · [RealityKit Mesh Instancing](scripting://doc?title=RealityKit%20Mesh%20Instancing) · [RealityKit Custom Metal Materials](scripting://doc?title=RealityKit%20Custom%20Metal%20Materials)
