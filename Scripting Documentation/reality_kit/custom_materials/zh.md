# 自定义 Metal 材质

使用 `RealityKit.Material.custom` 提供 Metal 表面着色器和几何修改器。表面着色器控制材质输出，几何修改器在模型绘制时移动顶点。调用前检查 `RealityKit.getCapabilities().customMaterials`。自定义材质适用于 iOS 17 或更高版本的前台 App。

## 创建与更新材质

使用 RealityKit 的 Metal 头文件为目标平台编译着色器，再将预编译的 `.metallib` 通过本地路径或 `Data` 传给 `device.loadLibrary`。在 `surface` 与 `geometry` 描述中填写导出的函数名。以下示例需要包含运行示例中两个函数的着色器库。表面着色器使用 `custom.value` 的前三个分量作为颜色，几何修改器使用第四个分量作为水平位移。 [Apple 自定义材质着色器指南](https://developer.apple.com/documentation/realitykit/modifying-realitykit-rendering-using-custom-materials)

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

`material.customInfo()` 返回光照模型、当前四分量值和十进制修订版本字符串。`material.updateCustom(parameters, options?)` 应用局部补丁并返回新修订版本。传入 `expectedRevision` 可拒绝基于旧版本的更新。共享该材质的现有模型槽都会看到更新，包括克隆实体中的槽。材质在绑定期间保留着色器库与纹理，绑定后可释放原脚本句柄。

## 参数

| 字段 | 值 |
| --- | --- |
| `baseColor`、`emissiveColor` | 分别为 `{ tint, texture }` 与 `{ color, texture }`。颜色使用 RGBA 值。 |
| `metallic`、`roughness`、`specular`、`clearcoat`、`clearcoatRoughness` | `{ scale, texture }`。 |
| `normal`、`ambientOcclusion` | 纹理输入。 |
| `blending`、`opacityThreshold` | `'opaque'` 或 `{ opacity: { scale, texture } }`，以及可选透明度阈值。 |
| `faceCulling`、`primaryUV`、`secondaryUV` | 面剔除可选 `'none'`、`'front'` 或 `'back'`。UV 变换接受 `offset`、`scale` 与 `rotation`。 |
| `custom` | `{ value, texture }`，用于传递四分量值与一张附加纹理。 |
| `clearcoatNormal`、`triangleFillMode`、`readsDepth`、`writesDepth` | iOS 18 或更高版本支持的额外纹理、填充模式（`'fill'` 或 `'lines'`）与深度控制。 |

省略参数或其子字段时保留当前值。传入 `null` 可清除纹理或 `opacityThreshold`。材质标量的 `scale` 和 `opacityThreshold` 取值范围为 0 至 1。纹理输入为格式兼容浮点采样的二维 `RealityKit.Texture`。iOS 18 或更高版本还可用 `{ texture, swizzle }` 选择四个通道。通道名为 `red`、`green`、`blue`、`alpha`、`zero` 与 `one`。自定义着色器按 MSL 中指定的采样器和坐标采样纹理。

## 现有材质槽与可复用程序

通过 `entity.materialCount()` 查询材质槽数量。`entity.material(slot)` 返回当前材质或 `null`，槽索引从零开始。将它作为 `from` 传给 `Material.custom`，可继承原生材质的参数和光照模型。只传几何修改器时，会在可用的情况下沿用原材质的原生表面着色器。使用 `entity.setMaterial(slot, material)` 替换该槽并保留网格。

在 iOS 18 或更高版本上，检查 `RealityKit.getCapabilities().customMaterialPrograms` 后可调用 `CustomMaterialProgram.create({ surface, geometry, lightingModel, blendMode, signal })`。程序可选择 `'lit'`、`'unlit'` 或 `'clearcoat'` 光照，以及 `'opaque'`、`'alpha'` 或 `'additive'` 混合。iOS 18 或更高版本的着色器描述可传入按名称指定的布尔或数值 Metal 函数常量。`program.info` 提供光照与混合模式及函数名。未设置几何修改器时，`geometry` 为 `null`。调用 `Material.fromCustomProgram(program, { parameters })` 可创建参数独立的材质。完成创建后可释放程序句柄。

## 渲染效果

非光照模式通过表面着色器的自发光颜色输出画面。几何修改器移动渲染顶点，网格包围盒和碰撞形状各自独立。场景有需要时，应提供适当包围盒并单独更新碰撞几何。脚本参数接口支持内置材质字段、一个四分量值及一张自定义纹理。原生结构化 uniform 参数缓冲区需要独立的 Swift 和 Metal 布局，属于其他接口范围。

运行示例可用两个按钮改变平面的颜色和水平位置。状态文本会报告当前颜色、位置与修订版本。 [Metal 计算](scripting://doc?title=Metal%20Compute) · [RealityKit 资源与材质](scripting://doc?title=RealityKit%20Assets%20and%20Materials)
