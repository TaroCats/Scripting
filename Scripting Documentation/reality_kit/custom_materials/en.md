# Custom Metal materials

Use `RealityKit.Material.custom` to supply Metal surface shaders and geometry modifiers. The surface shader controls material output. The geometry modifier offsets vertices as the model is drawn. Check `RealityKit.getCapabilities().customMaterials` before use. Custom materials are available on iOS 17 or later in the foreground app.

## Create and update a material

Compile your shaders for the target platform with the RealityKit Metal headers, then pass the precompiled `.metallib` to `device.loadLibrary` as a local path or `Data`. Use the exported names in the `surface` and `geometry` descriptions. The example assumes a library containing the two functions from Run Demo. The surface shader uses the first three components of `custom.value` for color, and the geometry modifier uses the fourth for horizontal displacement. [Apple's guide to custom material shaders](https://developer.apple.com/documentation/realitykit/modifying-realitykit-rendering-using-custom-materials)

```ts
const device = Metal.Device.getDefault()
if (device && RealityKit.getCapabilities().customMaterials) {
  const library = await device.loadLibrary('/path/to/custom-material.metallib')
  try {
    const material = RealityKit.Material.custom({
      surface: { library, name: 'scriptingTestColor' },
      geometry: { library, name: 'scriptingTestDisplace' },
      lightingModel: 'unlit',
      parameters: { custom: { value: [1, 0.24, 0.07, 0] } },
    })
    const mesh = RealityKit.Mesh.primitive({ type: 'plane', width: 0.84, height: 0.84, vertical: true })
    const entity = RealityKit.Entity.create()
    entity.setModel(mesh, [material])
    const scene = RealityKit.Scene.create()
    scene.add(entity)

    const { revision } = material.customInfo()
    material.updateCustom({ custom: { value: [0.07, 0.76, 1, 0.28] } }, { expectedRevision: revision })
  } finally {
    library.dispose()
  }
}
```

`material.customInfo()` returns the lighting model, the current four-component value and a decimal revision string. `material.updateCustom(parameters, options?)` applies a partial patch and returns the new revision. Pass `expectedRevision` to reject an update based on an older revision. The update reaches existing model slots that share this material, including slots in entity clones. The material retains its shader libraries and textures while bound. You can dispose the original script handles after binding.

## Parameters

| Field | Value |
| --- | --- |
| `baseColor`, `emissiveColor` | `{ tint, texture }` and `{ color, texture }` respectively. Colors are RGBA values. |
| `metallic`, `roughness`, `specular`, `clearcoat`, `clearcoatRoughness` | `{ scale, texture }`. |
| `normal`, `ambientOcclusion` | Texture inputs. |
| `blending`, `opacityThreshold` | `'opaque'` or `{ opacity: { scale, texture } }`, plus an optional alpha threshold. |
| `faceCulling`, `primaryUV`, `secondaryUV` | Culling is `'none'`, `'front'` or `'back'`. UV transforms accept `offset`, `scale` and `rotation`. |
| `custom` | `{ value, texture }` for a four-component value and one additional texture. |
| `clearcoatNormal`, `triangleFillMode`, `readsDepth`, `writesDepth` | Additional texture, fill mode (`'fill'` or `'lines'`) and depth controls on iOS 18 or later. |

Omitted parameters and nested fields keep their current values. Pass `null` to clear a texture or `opacityThreshold`. Scalar material scales and `opacityThreshold` range from 0 to 1. A texture input is a 2D `RealityKit.Texture` in a format compatible with floating-point sampling. Use `{ texture, swizzle }` to select four channels on iOS 18 or later. Swizzle names are `red`, `green`, `blue`, `alpha`, `zero` and `one`. Sampling and UV selection in custom shader code follow the MSL sampler and coordinates you specify.

## Existing material slots and reusable programs

Call `entity.materialCount()` to inspect the number of material slots. `entity.material(slot)` returns the current material or `null`, using zero-based slots. Pass it as `from` to `Material.custom` to inherit the native material's parameters and lighting model. A geometry-only conversion uses the base material's native surface shader, when available. Apply the new material with `entity.setMaterial(slot, material)` to replace that slot and keep the mesh.

On iOS 18 or later, check `RealityKit.getCapabilities().customMaterialPrograms` to use `CustomMaterialProgram.create({ surface, geometry, lightingModel, blendMode, signal })`. A program selects `'lit'`, `'unlit'` or `'clearcoat'` lighting and can use `'opaque'`, `'alpha'` or `'additive'` blending. On iOS 18 or later, shader descriptions can provide named Boolean and numeric Metal function constants. `program.info` reports the lighting and blend modes and the function names. Its `geometry` field is `null` when no modifier is set. Call `Material.fromCustomProgram(program, { parameters })` to create materials with independent parameters. Dispose the program handle when you finish creating materials from it.

## Render the effect

For unlit output, write emissive color in the surface shader. Geometry modifiers move the rendered vertices. Mesh bounds and collision shapes remain separate. Provide suitable bounds and update collision geometry separately when your scene needs it. The script parameter interface provides the built-in material fields, one four-component value and one custom texture. Native structured uniform argument buffers use a separate Swift and Metal layout and are outside this interface.

Run Demo changes the color and horizontal position of a plane using two buttons. The status text reports the current color, position and revision. [Metal Compute](scripting://doc?title=Metal%20Compute) · [RealityKit Assets and Materials](scripting://doc?title=RealityKit%20Assets%20and%20Materials)
