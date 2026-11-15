Add native particles to an entity in a RealityKit scene on iOS 18 or later. Check `RealityKit.getCapabilities().particles` before using these APIs. Mount the scene with `RealityView`. [RealityKit Rendering and Interaction](scripting://doc?title=RealityKit%20Rendering%20and%20Interaction)

## Create or update an emitter

Call `entity.setParticles(options)` to create an emitter or update its current settings. Choose a `preset` to start from RealityKit's `fireworks`, `impact`, `magic`, `rain`, `snow` or `sparks` settings, then override the fields you need. With no preset, omitted fields keep their current values. A new emitter starts with RealityKit defaults.

```ts
const emitter = RealityKit.Entity.create({ name: "Sparks" })
emitter.setParticles({
  preset: "sparks",
  isEmitting: false,
  burstCount: 36,
  burstCountVariation: 0,
  mainEmitter: {
    lifeSpan: 0.6,
    lifeSpanVariation: 0,
    color: { type: "constant", value: { type: "single", color: [0.1, 0.9, 0.7, 1] } },
  },
})
// Call from a control after mounting the scene containing the emitter.
function showBurst() {
  emitter.particleAction("burst")
}
```

## Choose how particles look and move

| Setting | Options |
| --- | --- |
| Where particles start | `emitterShape` supports point, plane, box, sphere, cone, cylinder and torus. Set `emitterShapeSize` and `birthLocation` to use a surface, volume or vertex grid. A grid uses `{ type: "vertices", count: [x, y, z] }`. |
| How particles move | Set `birthDirection` to world, local or normal. Use `emissionDirection`, `speed`, `speedVariation`, `radialAmount` and `torusInnerRadius` to shape the emission. `particlesInheritTransform` and `fieldSimulationSpace` control how particle motion follows the entity and its fields. |
| When particles appear | Set `timing` to `"once"` or `"repeating"` using the `type` field. Both accept `emit: { duration, variation? }` and optional `warmUp`. Repeating timing also accepts `idle`. Durations and lifetimes use seconds. |
| Main and secondary particles | `mainEmitter` controls the original particles. `spawnedEmitter` adds secondary particles at `onBirth`, `onUpdate` or `onDeath`, selected by `spawnOccasion`. Use the spawn velocity, spread and color inheritance fields to control how the secondary particles follow the originals. Set `spawnedEmitter: null` to remove it. |

Each emitter can set its birth rate, lifetime, size, color, opacity curve, blend mode, sort order, lighting and billboard orientation. Use acceleration, damping, mass, noise, attraction, vortex, spreading and angular motion to shape its movement. Use `color` with `{ type: "constant", value }` or `{ type: "evolving", start, end }`. Each color value is `{ type: "single", color }` or `{ type: "random", a, b }`, with RGBA components between 0 and 1.

Use `image` with a `RealityKit.Texture` for textured particles. Set `imageSequence` to describe a texture atlas with `rowCount`, `columnCount`, starting frame, frame rate and animation mode (`"playOnce"`, `"looping"` or `"autoReverse"`). Frame indices begin at zero. Set `image` or `imageSequence` to `null` to clear it. The emitter retains its attached texture when the script disposes the texture handle.

## Control emission

- Set `isEmitting: false` to stop automatic births while allowing existing particles to finish.
- Use `particleAction("burst")` for a one-time burst even while automatic emission is off. `burstCount` and `burstCountVariation` control its size.
- Use `"pause"` to freeze the simulation, `"play"` to resume it, and `"stop"` to stop it and clear particles. Use `"restart"` to reset the emitter's timing.
- Use `particlesInfo()` to read current settings, or `null` when no emitter exists. `hasImage` reports a native texture even when a preset, imported texture or disposed handle has no live script `image` value. Use `removeParticles()` to remove the component.

An invalid update leaves the previous emitter in place. Keep rates, lifetimes, vertex grids, atlas sizes and bursts within the available resource budget. Reduce the workload if configuration raises `resourceLimit`.

The example starts still and runs a brief burst only when requested. Use the labeled controls to show or clear the particles, and read the text status without relying on the preview.
