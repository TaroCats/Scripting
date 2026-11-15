# Metal compute on RealityKit instances

Use `instances.compute(options)` to update the transforms in a `RealityKit.InstanceData` with a Metal compute kernel. All model parts and entities bound to that instance data use the published result. Check `RealityKit.getCapabilities().instanceCompute` in a supported foreground App script on iOS 26 or later with a Metal device.

## Move one instance

Each slot stores a 64-byte, column-major `float4x4` in entity-local coordinates. The translation is in the fourth column. This example shifts the second instance along its local X axis. It publishes only slot 1 and keeps slot 0.

```ts
const device = Metal.Device.getDefault()
if (device && RealityKit.getCapabilities().instanceCompute) {
  const instances = RealityKit.InstanceData.create({
    capacity: 2,
    count: 2,
    transforms: new Float32Array([
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -0.6, 0, 0, 1,
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0,    0, 0, 0, 1,
    ]),
  })
  const library = await device.compileLibrary(`
#include <metal_stdlib>
using namespace metal;

kernel void move_instance(const device float4x4 *source [[buffer(0)]],
                          device float4x4 *target [[buffer(1)]],
                          constant float &deltaX [[buffer(2)]],
                          uint id [[thread_position_in_grid]]) {
  if (id != 0) return;
  float4x4 transform = source[1];
  transform[3].x += deltaX;
  target[1] = transform;
}
`)
  const pipeline = await library.makeComputePipeline("move_instance")
  try {
    const revision = await instances.compute({
      pipeline,
      sourceBufferIndex: 0,
      targetBufferIndex: 1,
      start: 1,
      length: 1,
      expectedRevision: instances.info.revision,
      dispatch: {
        threadgroups: { width: 1 },
        threadsPerThreadgroup: { width: 1 },
        bytes: [{ index: 2, data: new Float32Array([0.375]) }],
      },
    })
    console.log(revision, instances.copyTransforms()[28])
    // After assigning a model, bind with entity.setMeshInstances({ instances }).
  } finally {
    pipeline.dispose()
    library.dispose()
  }
}
```

## Bind buffers and select slots

- `targetBufferIndex` identifies the writable `[[buffer(index)]]` slot. The target starts with the current transforms. To read the published transforms separately, provide `sourceBufferIndex` for a different, read-only slot.
- Both buffers contain all `capacity` matrices. In the kernel, address a matrix by its slot index and keep each access within capacity. `start` and `length` select which slots to publish. `start` defaults to zero and `length` defaults to `capacity - start`. The range must contain at least one slot and fit the capacity. Slots outside the range and slots the kernel leaves untouched keep their values.
- `dispatch` uses the Metal grid, inline bytes, read-only auxiliary buffers and threadgroup memory. Supply each reflected binding once. Use a pipeline and buffers from the same script and Metal device.

## Change the draw count and publish

`count` controls how many instances to draw. It defaults to the current count and can range from zero to capacity. The kernel can update inactive slots, and reducing the count preserves their transforms. A bound part with count zero draws no copies.

Native code checks the resulting transforms for finite values before publishing. `compute` resolves to the new revision as a decimal string once the transforms and count have been committed. The renderer displays them in a subsequent frame. Pass `expectedRevision` to work from a specific revision. Put an optional abort `signal` alongside `dispatch`. A rejected or cancelled operation preserves the last published transforms, count and revision.

`copyTransforms()` reads the previous published version while compute is pending. Await completion before starting another compute or calling `update()` on the same instance data. If you provided bounds in `setMeshInstances()`, keep those entity-local bounds large enough to enclose the transformed geometry.

Run Demo displays two rows of spheres using the same instance data. The controls move the middle sphere in both rows, hide both rows, and show them again with their prior positions. The text reports the current result.

[RealityKit Mesh Instancing](scripting://doc?title=RealityKit%20Mesh%20Instancing) · [Metal Compute](scripting://doc?title=Metal%20Compute)
