# Low-level textures

Use `RealityKit.LowLevelTexture` to create a texture from raw texels, update a region and read its bytes back. A material bound to its `texture` property sees successful updates. Check `RealityKit.getCapabilities().lowLevelTextures` before use. This API is available on iOS 18 or later.

## Create and bind a texture

```ts
const backing = await RealityKit.LowLevelTexture.create({
  type: '2d', width: 2, height: 2, pixelFormat: 'rgba8Unorm',
})
await backing.update(new Uint8Array([
  255, 64, 0, 255, 255, 64, 0, 255,
  255, 64, 0, 255, 255, 64, 0, 255,
]))
const material = RealityKit.Material.create({
  kind: 'unlit', baseColor: [1, 1, 1, 1],
  baseColorTexture: { texture: backing.texture },
})
const mesh = RealityKit.Mesh.primitive({ type: 'plane', width: 1, height: 1, vertical: true })
const entity = RealityKit.Entity.create()
entity.setModel(mesh, [material])

const revision = backing.info.revision
await backing.update(new Uint8Array([0, 128, 255, 255]), {
  x: 1, y: 1, width: 1, height: 1, expectedRevision: revision,
})
const bytes = await backing.read()
console.log(bytes.length) // 16 tightly packed RGBA bytes
```

`create` initializes every allocated mip level and slice to zero. The descriptor takes `width` and optional `height`, `depth`, `arrayLength` and `mipmapLevelCount`. Each optional count defaults to `1`. `type` defaults to `2d`. Choose `2dArray` for layers, `3d` for a volume, or `cube` or `cubeArray` for square cube faces. In a cube array, `arrayLength` counts cubes and each cube has six consecutive slices in Metal face order. In a 3D texture, select depth planes with `z` and `depth`.

`pixelFormat` defaults to `rgba8Unorm`. Supported formats include `r8Unorm`, `r8Uint`, `rg8Unorm`, `rgba8Unorm`, `rgba8Unorm_srgb`, `bgra8Unorm`, `bgra8Unorm_srgb`, and the `r`, `rg` and `rgba` variants of `16Float` and `32Float`. Supply bytes in the selected native format, including its channel order and component encoding. Choose a format that the destination material can sample. The descriptor also accepts `usage` flags (`shaderRead`, `shaderWrite`, `renderTarget`, `pixelFormatView`) and a four-channel `swizzle`. By default, the usage is `shaderRead` and the channel mapping is RGBA.

## Update and read regions

- `update(data, options?)` takes a `Uint8Array` view or packed `Data`. A typed array subview supplies only its own bytes. Use `bytesPerRow` if rows in the source are padded. The default is the region width multiplied by the format's bytes per texel. For 3D data, each plane begins after `bytesPerRow * height` bytes. Padding after the final row is optional.
- Both `update` and `read` use zero-based `slice`, `level`, `x`, `y` and `z`, defaulting to zero. `width`, `height` and `depth` default to the remainder of the chosen mip level from that origin. Supply each mip level you want to populate. Updates leave other levels and slices intact.
- `read(options?)` returns an independent `Uint8Array` in the selected format. Rows and depth planes are tightly packed, with the x coordinate changing first. Byte transfers preserve the raw channel values.
- `info` reports the type, format, dimensions, mipmap and array counts, `sliceCount`, `byteCount`, `usage`, `swizzle` and current `revision`. A successful update resolves to the new decimal revision string. Pass `expectedRevision` to reject a read or update if the revision changed. Creation, reads and updates accept an abort `signal`. Rejected updates preserve the previously published texture and revision.

Await each operation on a texture before starting another. `dispose()` releases the low-level script handle. Existing texture handles and material bindings can retain the last published texture.

Run the demo to switch a single material between two texture patterns and read the updated texel bytes. The status text reports the pattern, texel values and revision. [RealityKit Assets and Materials](scripting://doc?title=RealityKit%20Assets%20and%20Materials)
