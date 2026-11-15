# 低层纹理

使用 `RealityKit.LowLevelTexture` 从原始纹素创建纹理、更新区域并读取字节。绑定其 `texture` 属性的材质会显示更新成功后的内容。调用前检查 `RealityKit.getCapabilities().lowLevelTextures`。此 API 适用于 iOS 18 或更高版本。

## 创建和绑定纹理

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

`create` 会将已分配的所有 mip 层级和切片初始化为零。描述符接受 `width` 及可选的 `height`、`depth`、`arrayLength` 和 `mipmapLevelCount`。各可选数量默认是 `1`。`type` 默认是 `2d`，多层纹理使用 `2dArray`，体纹理使用 `3d`，正方形立方体面使用 `cube` 或 `cubeArray`。立方体数组的 `arrayLength` 表示立方体个数，每个立方体按 Metal 的面顺序占用连续六个切片。三维纹理使用 `z` 和 `depth` 选择深度平面。

`pixelFormat` 默认是 `rgba8Unorm`。支持 `r8Unorm`、`r8Uint`、`rg8Unorm`、`rgba8Unorm`、`rgba8Unorm_srgb`、`bgra8Unorm`、`bgra8Unorm_srgb`，以及 `16Float` 和 `32Float` 的 `r`、`rg`、`rgba` 变体。按所选原生格式的通道顺序和分量编码提供字节，并选择目标材质可采样的格式。描述符还接受 `usage` 标志（`shaderRead`、`shaderWrite`、`renderTarget`、`pixelFormatView`）和四通道 `swizzle`。默认用法是 `shaderRead`，通道映射为 RGBA。

## 更新和读取区域

- `update(data, options?)` 接受 `Uint8Array` 视图或打包的 `Data`。类型化数组子视图仅提供自身范围内的字节。如果源数据行有填充，设置 `bytesPerRow`。默认行字节数为区域宽度乘以格式的每纹素字节数。三维数据每个平面占用 `bytesPerRow * height` 字节。最后一行的末尾填充可以省略。
- `update` 和 `read` 的 `slice`、`level`、`x`、`y` 和 `z` 均从零开始，默认值为零。`width`、`height` 和 `depth` 默认使用所选 mip 层级从原点开始的剩余范围。分别提供需要填充的 mip 层级。更新会保留其他层级和切片。
- `read(options?)` 返回所选格式的独立 `Uint8Array`。行与深度平面紧密排列，x 坐标变化最快。字节传输保留原始通道值。
- `info` 提供类型、格式、尺寸、mip 层级和数组数量、`sliceCount`、`byteCount`、`usage`、`swizzle` 以及当前 `revision`。更新成功后返回新的十进制修订版本字符串。传入 `expectedRevision` 可在修订版本已改变时拒绝读取或更新。创建、读取和更新都接受用于取消操作的 `signal`。更新被拒绝时，已发布的纹理及修订版本均保持原样。

对同一纹理，等待当前操作完成后再发起下一次操作。`dispose()` 释放低层纹理的脚本句柄。已有的纹理句柄和材质绑定可保留最后一次发布的纹理。

运行示例可在同一材质上切换两种纹理图案，并读取更新后的纹素字节。状态文本会报告当前图案、纹素值和修订版本。 [RealityKit 资源与材质](scripting://doc?title=RealityKit%20Assets%20and%20Materials)
