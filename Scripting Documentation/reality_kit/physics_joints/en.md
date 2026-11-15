Connect rigid bodies with native joints and query colliders in a mounted RealityKit scene. Joints require iOS 18 or later.

## Connect two bodies

Install collision shapes and physics bodies, then call `RealityKit.PhysicsJoint.create()` with two different entities in the same physics simulation. Each endpoint can specify an entity-local position and quaternion rotation, or select a named pin that the entity already has. Use meters for position and radians for angles.

```ts
const scene = RealityKit.Scene.create()
const fixed = RealityKit.Entity.create({ name: "Mount" })
const arm = RealityKit.Entity.create({ name: "Arm", physics: true, transform: { position: [0, 0.5, 0] } })
fixed.setCollision({ shape: "box", size: [0.2, 0.2, 0.2] })
fixed.setPhysicsBody({ mode: "static" })
arm.setCollision({ shape: "box", size: [0.15, 1, 0.15] })
arm.setPhysicsBody({ mass: 1 })
scene.add(fixed)
scene.add(arm)

const hinge = RealityKit.PhysicsJoint.create({
  kind: "revolute",
  first: { entity: fixed },
  second: { entity: arm, position: [0, -0.5, 0] },
  angularLimit: [-Math.PI / 3, Math.PI / 3],
})
```

| Joint kind | Motion |
| --- | --- |
| `fixed` | Keeps the pin positions and orientations together. |
| `revolute` | Rotates around the pin's local X axis with an optional `angularLimit`. |
| `prismatic` | Slides along the pin's local X axis with an optional `linearLimit`. |
| `spherical` | Rotates around a shared point. `angularLimitYZ` sets angular limits about local Y and Z. |
| `distance` | Keeps the endpoints within `distanceLimit`, with optional fractional `tolerance`. |
| `custom` | Configures each X, Y and Z axis of `linear` and `angular` motion as `"fixed"`, `"unlimited"` or a range. Omitted axes are fixed. |

Each range is `[minimum, maximum]`. The optional `checksForInternalCollisions` asks RealityKit to test contact between the connected bodies. Fixed joints use the native default.

Read `joint.info` to see whether the constraint is installed and solving. A configured joint can be installed before the first physics step. When the scene pauses, the handle remains valid. The constraint is restored after the scene resumes if both bodies still belong to the same world. Check `restoreError` for a native restoration failure.

Read `entity.physicsJoints()` for the native collection owned by a specific entity or `scene.physicsJoints()` for the default scene collection. Dispose the joint handle to remove the constraint and its endpoint pins. Body components remain on the entities.

## Cast through the scene

Call `scene.raycast()` with `from` and `to`, or with an `origin`, `direction` and optional `length` in meters. The direction is normalized and the default length is 100 meters. `scene.convexCast()` moves a box, sphere or capsule between two positions. Specify `fromOrientation` and `toOrientation` when the shape needs an orientation. Both casts use the native collision shapes and can hit triggers.

```ts
const scene = RealityKit.Scene.create()
function inspectMountedScene() {
  const hits = scene.convexCast({
    collider: { shape: "sphere", radius: 0.15 },
    from: [-1, 0.4, 0],
    to: [1, 0.4, 0],
    query: "nearest",
  })
  console.log(hits[0]?.entity.info.name ?? "No collision shape")
}
```

Use `query: "all"` for all results, `"nearest"` for the closest, or `"any"` for a single native match. Use a 32-bit unsigned `mask` to select collision groups. The optional `relativeTo` entity defines the coordinates of the inputs, output positions and output normals. Without it, the cast uses scene coordinates.

Every hit includes an entity, position, normal and native distance. On iOS 18 or later, results also include a shape index and any triangle face index and UV supplied by RealityKit. Convex casts require nonzero translation. A shape that starts intersecting a collider can return a special native position and distance, so keep initial-overlap handling separate from normal travel-distance measurements.

Run the example to slide a carriage along a rail and sweep the scene for its collision shape.
