`Scene.create()` creates a scene. Add root entities with `scene.add(entity)`, build a hierarchy with `entity.add(child)`, and use `scene.query({ name, component })` to find entities. `entity.info` includes parent, children, the local transform, and component names. Imported component names may use their native type names.

Positions and distances use meters. Rotations are quaternions in [x, y, z, w] order. Matrices use column-major order. `entity.matrix()` returns a world matrix. Pass a reference entity to `matrix` or `convertPosition` to use its space. `entity.bounds()` returns a box in that entity’s local space. `scene.setTransforms` validates the complete batch before changing any transforms.

Use `setModel`, `setLight`, `setCollision`, and `setAccessibility` to attach components. `clone()` copies the entity hierarchy and shares model resources. `remove()` detaches the entity. `dispose()` releases the script handle, and the scene retains attached entities and their resources.
