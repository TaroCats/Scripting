Draw multiple copies of a mesh through one entity with RealityKit mesh instances. This API is available on iOS 26 or later. Check `RealityKit.getCapabilities().meshInstances` before using it. [RealityKit Meshes](scripting://doc?title=RealityKit%20Meshes)

## Create instance data

`RealityKit.InstanceData.create({ capacity, count, transforms })` creates a reusable group. Capacity is fixed. Count is the number of instances drawn and can range from zero to capacity. If you omit count, it defaults to the number of supplied matrices.

Provide each transform as 16 Float32 values in column-major order, using a `Float32Array` or packed `Data`. Translation occupies elements 12, 13 and 14 of each matrix, using zero-based indexing. Slots with no supplied transform start at the identity matrix. Update a range of slots with `update({ start, transforms })`, or change the drawn count with `update({ count })`. Reducing count preserves the matrices in inactive slots.

```ts
const instances = RealityKit.InstanceData.create({
  capacity: 2,
  transforms: new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -0.6, 0, 0, 1,
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0,  0.6, 0, 0, 1,
  ]),
})
const mesh = RealityKit.Mesh.primitive({ type: "sphere", radius: 0.15 })
const material = RealityKit.Material.create({ kind: "unlit", baseColor: [0.2, 0.8, 0.7, 1] })
const entity = RealityKit.Entity.create({ name: "Two spheres" })
entity.setModel(mesh, [material])
entity.setMeshInstances({ instances })
```

Read `instances.info` for the count, capacity and revision. Pass `expectedRevision` to reject updates based on an older revision. `copyTransforms({ start, count })` returns a separate `Float32Array` containing the requested active matrices. With no options it copies all active matrices.

## Select parts and bounds

Call `entity.setMeshInstances({ instances, modelID })` to apply one instance group to every part of a model. You can omit `modelID` if the mesh has one model. To assign different groups to individual parts, use `entity.setMeshInstances({ parts: [{ modelID, partID, instances }] })`. Parts without a binding draw their original geometry once. A bound part with count zero draws no copies.

`entity.meshInstanceParts({ modelID, offset, limit })` returns a page with `parts` and `nextOffset`. All options are optional. The default offset is 0 and the default page size is 128. Pass `nextOffset` as the next offset with the same model filter, or stop when it is `null`. Each row includes the model and part IDs, native part index and material index. Count and capacity are `null` for unbound parts.

For a dynamic mesh, generated IDs such as `Part0` follow the current part slots. Inspect the inventory again after editing the part layout. A model-wide binding follows the model's current parts, including parts added by an update.

RealityKit handles culling when you omit `bounds`. If you supply `bounds: { min, max }`, use entity-local coordinates and enclose all transformed geometry for that group. Call `setMeshInstances()` with an updated box if later transforms or mesh edits extend beyond it. A box that is too small can hide visible instances.

## Share data and remove bindings

Every binding to the same `InstanceData` sees its updates. Entity clones share the instance data. `removeMeshInstances()` clears only that entity's binding and restores ordinary model drawing. A binding retains its data if you dispose the script handle.

Use `instances.compute()` to update those shared transforms with a Metal kernel. [RealityKit Instance Compute](scripting://doc?title=RealityKit%20Instance%20Compute)

On iOS 27 or later, use [per-instance mesh attributes](scripting://doc?title=RealityKit%20Per-Instance%20Mesh%20Attributes) to vary colors or UVs across those copies.

The instance transforms are relative to the entity's transform. Instances are drawn within one scene entity, and collision components belong to the entity.

Run the example to display six spheres, clear them, and display them again using the same matrices. The controls show the current count as text. [RealityKit Rendering and Interaction](scripting://doc?title=RealityKit%20Rendering%20and%20Interaction)
