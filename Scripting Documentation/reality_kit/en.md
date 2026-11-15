Create and edit 3D scenes in a foreground App script. Use the global `RealityKit` API for scenes, entities and resources. Import `RealityView` from `scripting` to display the scene.

Call `RealityKit.getCapabilities()` before using features that vary by system or device. Dynamic meshes, orthographic camera components, surface queries and ShaderGraph materials require iOS 18 or later.

Animation graphs, reusable skeletons, skeletal retargeting and mesh deformation stacks require iOS 27 or later.

Use [Physics and Collisions](scripting://doc?title=RealityKit%20Physics%20and%20Collisions) to add rigid bodies, triggers and capsule characters. Local physics simulations require iOS 18 or later.

Configure [Particle Emitters](scripting://doc?title=RealityKit%20Particle%20Emitters) to render effects with bursts and playback controls.

Apply [Custom Metal Materials](scripting://doc?title=RealityKit%20Custom%20Metal%20Materials) to change surface shading and vertex positions.

Update and read texture regions with [Low-Level Textures](scripting://doc?title=RealityKit%20Low-Level%20Textures).

Run GPU kernels directly on textures with [Metal Texture Compute](scripting://doc?title=RealityKit%20Metal%20Texture%20Compute).

Render scene pixels and step animations with [Offscreen Rendering](scripting://doc?title=RealityKit%20Offscreen%20Rendering).

Draw many copies of a mesh with [Mesh Instancing](scripting://doc?title=RealityKit%20Mesh%20Instancing).

Play video on 3D meshes or sized screens with [Video Surfaces](scripting://doc?title=RealityKit%20Video%20Surfaces).

Play sounds from scene entities with [Spatial Audio](scripting://doc?title=RealityKit%20Spatial%20Audio).

```tsx
import { Button, Navigation, RealityView, Script, VStack } from "scripting"

const scene = RealityKit.Scene.create()
const mesh = RealityKit.Mesh.primitive({ type: "box", size: [1, 1, 1] })
const material = RealityKit.Material.create({ kind: "unlit", baseColor: [0.2, 0.7, 1, 1] })
const cube = RealityKit.Entity.create({ name: "Cube" })
cube.setModel(mesh, [material])
cube.setCollision({ shape: "box", size: [1, 1, 1] })
cube.setAccessibility({ label: "Cube" })
scene.add(cube)

const renderer = RealityKit.Renderer.create(scene, { orbit: true })

function Preview() {
  return (
    <VStack>
      <RealityView renderer={renderer} frame={{ height: 340 }} />
      <Button title="Reset camera" action={() => renderer.resetCamera()} />
      <Button title="Zoom in" action={() => renderer.zoom(1.2)} />
      <Button title="Zoom out" action={() => renderer.zoom(1 / 1.2)} />
    </VStack>
  )
}

try {
  await Navigation.present({ element: <Preview /> })
} finally {
  renderer.dispose()
  scene.dispose()
  cube.dispose()
  mesh.dispose()
  material.dispose()
  Script.exit()
}
```
