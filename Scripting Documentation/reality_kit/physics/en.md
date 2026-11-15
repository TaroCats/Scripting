Use colliders, rigid bodies and capsule characters in a foreground RealityKit scene. Inspect the actual simulation state through the entity, and observe contact events while the scene is mounted in a running `RealityView`.

## Colliders and triggers

Call `entity.setCollision()` with a box, sphere, capsule or a mesh-based shape. Use `setColliders({ shapes, ...options })` to combine up to 32 box, sphere and capsule shapes. Sizes are in meters. Each shape can have a local `offset` and quaternion `rotation` in `[x, y, z, w]` order. Capsule height includes both caps.

A filter uses unsigned 32-bit `group` and `mask` bit fields. Choose matching bits on both sides of a pair. The `trigger` mode reports overlaps and allows objects through. Install triggers without a rigid body. The `default` mode uses RealityKit's default interaction, and `colliding` enables solid collider behavior on iOS 18 or later. On that system, `static` is an optional collision optimization hint, and `fullContactInformation` asks RealityKit to include contact points. Use `collisionInfo()` to inspect the installed collider.

```ts
const checkpoint = RealityKit.Entity.create({ name: "Checkpoint" })
checkpoint.setCollision({
  shape: "box", size: [1.2, 2, 0.4], mode: "trigger", filter: { group: 2, mask: 4 },
})
const listener = checkpoint.onCollision(event => {
  if (event.phase === "began") console.log(event.other.info.name)
})
```

`onCollision()` returns a subscription. Call `dispose()` to stop listening. In each callback, `entityA` is the entity you subscribed to and `entityB` is the other entity, also available as `other`. `began` and `updated` include the average position and impulse. The position is in the nearest physics simulation's coordinates. On iOS 18 or later, RealityKit can include contact points and normals in scene coordinates. The normal points from `entityB` toward `entityA`. `ended` identifies the pair. Contact updates are delivered in bounded batches, so use `updated` to observe contact as it changes.

## Rigid bodies

Install collision shapes, then call `setPhysicsBody()`. A static body acts as fixed geometry. A kinematic body moves with its authored velocity. A dynamic body responds to forces, impulses and gravity. Give a body a mass in kilograms or density in kilograms per cubic meter. RealityKit computes the mass properties from the current shapes. You can override inertia, center of mass and inertia orientation, set friction and restitution, lock translation or rotation axes, and enable continuous collision detection. Gravity per body and linear and angular damping are available on iOS 18 or later.

```ts
const ball = RealityKit.Entity.create({ name: "Ball", physics: true })
ball.setCollision({ shape: "sphere", radius: 0.17 })
ball.setPhysicsBody({ mass: 1, material: { staticFriction: 0.5, restitution: 0.25 } })
// After the scene is mounted:
ball.applyPhysicsAction({ kind: "linearImpulse", vector: [0, 4, 0] })
```

`setPhysicsMotion()` sets linear velocity in meters per second and angular velocity in radians per second for dynamic or kinematic bodies, in simulation coordinates. `physicsBodyInfo()` reports the native mode, mass properties, motion and supported force actions. Its material fields describe material values set through this API. A change to collider geometry preserves the body's mass properties. Call `setPhysicsBody()` again to recalculate them from the new shapes. To remove a collider installed alongside a script-configured rigid body, call `removePhysicsBody()` first.

`applyPhysicsAction()` supports force, torque, linear and angular impulse, clearing forces and torques, and resetting a dynamic body's physics transform. Use `point` to apply a force or linear impulse at a specific point, and `relativeTo` to specify an entity in the same scene as the reference frame. Omitting `relativeTo` uses scene coordinates for these actions. Call actions after the body is active. Use `Entity.create({ physics: true })` when building a body that needs these actions. On imported bodies, check `physicsBodyInfo().supportsForceActions` to see whether the native entity supports them.

## Local simulations

On iOS 18 or later, use `setPhysicsSimulation()` on a parent entity to define a local physics world. Descendants use their nearest simulation. Each world can have a gravity vector in the root's local coordinates, collision reporting for kinematic pairs, solver iterations and an optional `AnimationClock`. Keep bodies that should interact in the same world.

```ts
const world = RealityKit.Entity.create({ name: "Sideways gravity" })
if (RealityKit.getCapabilities().localPhysicsSimulations) {
  world.setPhysicsSimulation({ gravity: [4, 0, 0], reportKinematicVsStatic: true })
}
const member = RealityKit.Entity.create({ name: "Local body" })
member.setCollision({ shape: "sphere", radius: 0.2 })
member.setPhysicsBody()
world.add(member)
```

Inspect or remove the component with `physicsSimulationInfo()` and `removePhysicsSimulation()`.

## Capsule characters

Install `setCharacterController()` on an entity, and optionally attach a visual model. A character controller owns its collision capsule, so remove its collider and rigid body components first. Configure radius, total height, skin width, step height, slope limit in radians, up direction and collision filter as needed.

When mounted, call `moveCharacter({ delta, deltaTime, relativeTo })` with a displacement, time in seconds, and optional reference entity in the same scene. Omitting the reference uses scene coordinates. The return value gives immediate `side`, `top` and `bottom` collision flags and reported hits. Each hit includes the other entity, position, normal and movement details in simulation coordinates. Read the solved transform, velocity and ground state after the next physics step. Use `teleportCharacter()` to place the capsule without sweeping along the path.

Open the runnable example to launch a ball, move a character toward a wall and reset its position. The example shows the result in text alongside the scene.

Connect bodies and scan collision shapes with [Physics Joints and Casts](../physics_joints/).
