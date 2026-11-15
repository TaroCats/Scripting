# Metal compute on RealityKit textures

Use `LowLevelTexture.compute(pipeline, options)` to process low-level RealityKit textures on the GPU. The result is available through the same `texture` property used by materials. Use this API on iOS 18 or later, with a Metal device and low-level textures available in the foreground app.

## Resize a texture

This example reads two RGBA texels from an input texture and scales them up with nearest-neighbor sampling. A material can display the result or stay bound to the output during further updates.

```ts
const device = Metal.Device.getDefault()
if (device && RealityKit.getCapabilities().lowLevelTextureCompute) {
  const library = await device.compileLibrary(`
#include <metal_stdlib>
using namespace metal;
kernel void resize_texture(texture2d<float, access::read> source [[texture(0)]],
                            texture2d<float, access::write> target [[texture(1)]],
                            uint2 p [[thread_position_in_grid]]) {
  const uint2 outputSize = uint2(target.get_width(), target.get_height());
  if (any(p >= outputSize)) return;
  const uint2 inputSize = uint2(source.get_width(), source.get_height());
  target.write(source.read(p * inputSize / outputSize), p);
}
`)
  const pipeline = await library.makeComputePipeline('resize_texture')
  const input = await RealityKit.LowLevelTexture.create({
    width: 2, height: 1, pixelFormat: 'rgba8Unorm', usage: ['shaderRead'],
  })
  await input.update(new Uint8Array([255, 72, 0, 255, 0, 124, 255, 255]))
  const output = await RealityKit.LowLevelTexture.create({
    width: 32, height: 16, pixelFormat: 'rgba8Unorm', usage: ['shaderRead', 'shaderWrite'],
  })

  const revision = await output.compute(pipeline, {
    textureIndex: 1,
    inputs: [{ index: 0, texture: input }],
    expectedRevision: output.info.revision,
    dispatch: {
      threadgroups: { width: 4, height: 2 },
      threadsPerThreadgroup: { width: 8, height: 8 },
    },
  })

  const material = RealityKit.Material.create({
    kind: 'unlit', baseColor: [1, 1, 1, 1],
    baseColorTexture: { texture: output.texture },
  })
  const plane = RealityKit.Entity.create()
  plane.setModel(RealityKit.Mesh.primitive({ type: 'plane', width: 1.2, height: 0.6, vertical: true }), [material])
  const scene = RealityKit.Scene.create()
  scene.add(plane)

  const firstTexel = await output.read({ x: 0, y: 0, width: 1, height: 1, expectedRevision: revision })
  console.log(Array.from(firstTexel)) // [255, 72, 0, 255]
  input.dispose()
  pipeline.dispose()
  library.dispose()
}
```

## Bind textures and dispatch

- `pipeline.info.textureBindings` lists the kernel's texture indices, texture types and access modes. Access is `'read'`, `'write'` or `'readWrite'`. Match the Metal texture kind and pixel format to the binding's shader type.
- Call `compute` on the output texture. `textureIndex` selects its write or read-write binding. Use `shaderWrite` for the output and include `shaderRead` if a shader reads or a material samples it. Each `inputs` entry supplies a read-only binding by index. Create these input textures with `shaderRead`. Use a separate output texture and unique binding indices. One input texture can fill several read-only bindings. All textures, buffers and the pipeline belong to the same script and Metal device.
- `dispatch` accepts the Metal grid, buffers, inline bytes and threadgroup memory. Supply either `threads` or `threadgroups` and include `threadsPerThreadgroup`. Write bounds checks in the shader for any thread that could exceed a texture or buffer range. The output size is set when you create the texture. To resize an image, write into a target with the desired dimensions. [Metal compute grid sizes](https://developer.apple.com/documentation/metal/calculating-threadgroup-and-grid-sizes)

Read-write bindings also depend on `device.info.readWriteTextureTier` and the pixel format. [Apple read-write texture formats](https://developer.apple.com/documentation/metal/mtlreadwritetexturetier/tier2)

## Publish, read and cancel

`compute` returns the new decimal revision string after the GPU work completes and the output becomes available to bound materials. An update starts with the previously published texels. Any texels the shader leaves untouched are preserved.

Pass `expectedRevision` to base the update on a particular output revision. Pass an abort `signal` in the outer compute options alongside `dispatch`. A rejected or cancelled operation preserves the last published texels and revision. Await completion before reading the output or starting another operation that uses the same textures or buffers.

Run Demo resizes an 8 by 4 source into a 128 by 64 output. The buttons switch between the original colors and swapped red and blue channels. The same material displays each completed result. The text reports the current result, revision and cancellation status.

[Metal Compute](scripting://doc?title=Metal%20Compute) · [RealityKit Low-Level Textures](scripting://doc?title=RealityKit%20Low-Level%20Textures)
