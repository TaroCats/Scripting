# 离屏渲染

使用 [RealityKit 离屏后处理](scripting://doc?title=RealityKit%20Offscreen%20Post-Processing)在读取画面前应用 Metal 颜色处理。

用 `RealityKit.OffscreenRenderer` 将场景渲染为像素，用于预览、导出图像或逐帧推进动画。在支持的脚本环境中需要 iOS 18 或更高版本。创建前先检查 `RealityKit.getCapabilities().offscreenRendering`。

## 渲染图像

```ts
if (RealityKit.getCapabilities().offscreenRendering) {
  const scene = RealityKit.Scene.create()
  const mesh = RealityKit.Mesh.primitive({ type: 'plane', width: 1, height: 1, vertical: true })
  const material = RealityKit.Material.create({ kind: 'unlit', baseColor: [1, 0.28, 0.06, 1] })
  const entity = RealityKit.Entity.create()
  let renderer: RealityKit.OffscreenRenderer | undefined
  try {
    entity.setModel(mesh, [material])
    scene.add(entity)
    renderer = RealityKit.OffscreenRenderer.create(scene, { background: [0.04, 0.08, 0.11, 1] })
    const frame = await renderer.render({ width: 288, height: 192 })
    const image = UIImage.fromPixels({
      width: frame.width, height: frame.height, bytesPerRow: frame.bytesPerRow,
      data: frame.data, format: 'bgra8', alphaMode: 'opaque',
    })
    console.log(frame.frameIndex, image.width, image.height)
  } finally {
    renderer?.dispose()
    entity.dispose()
    material.dispose()
    mesh.dispose()
    scene.dispose()
  }
}
```

示例显示渲染后的画面，可通过按钮每次将动画推进四分之一秒。

## 相机和光照

创建时传入 `camera`，或调用 `setCamera(camera)` 改变视角。`configure(options)` 只更新传入的设置。默认使用不透明黑色背景，开启色调映射，抗锯齿设为 `'none'`。设置 `antialiasing: 'multisample4X'` 可启用 4 倍多重采样。

`background` 可以是 RGBA 颜色，也可以设为 `'outputTexture'`，使用输出纹理中的像素作背景。要添加基于图像的光照，将方向正立、宽高比为 2:1、宽度不超过 2048 像素的等距柱状投影 UIImage 传给 `await setEnvironment(image, { intensityExponent: 0 })`。调用 `setEnvironment(null)` 可清除环境光照。

默认关闭扩展动态范围。用 `edr: { headroom: 2 }` 启用，并以 `'rgba16Float'` 渲染。传入 `edr: null` 可关闭。`headroom` 范围为 1 到 16，启用时默认值为 2。

## 帧数据

`render` 接受以像素为单位的正整数 `width` 和 `height`。每次调用渲染到一个目标，并返回 `width`、`height`、`bytesPerRow`、`pixelFormat`、`frameIndex` 和 `data`。各行紧密排列。`frameIndex` 是十进制字符串，在帧成功返回时递增。

- 默认的 `'bgra8Unorm'` 每像素四字节，顺序为蓝、绿、红、Alpha。可以按上例用 `UIImage.fromPixels` 和 `format: 'bgra8'` 显示不透明帧。
- `'rgba16Float'` 按红、绿、蓝、Alpha 顺序存储四个 16 位浮点通道，每像素八字节。使用这种格式时请直接处理原始帧数据。
- `dataType` 默认为 `'uint8Array'`。设为 `'data'` 可取得 `Data`。
- `viewport` 以输出尺寸的比例表示，默认原点是 `(0, 0)`，尺寸是 `(1, 1)`，覆盖整帧。将 `width` 和 `height` 设为正值可渲染到其他区域。
- `initialPixels` 接受与输出格式一致的 `Uint8Array` 或 `Data`，长度必须恰好为 `height * bytesPerRow` 字节。省略时目标初始像素填零。背景为 `'outputTexture'` 时，可用尺寸与格式匹配的上一帧作为初始像素。

## 时间和场景归属

将场景交给离屏渲染器后，用 `entity.playAnimation(clip)` 开始播放。调用 `update(deltaTime)` 只推进模拟，不生成帧。将 `deltaTime` 传给 `render` 可在一次调用中推进并取帧。时间步长以秒为单位，须为有限的非负数，`render` 的默认值为零。

一个场景同时只能由一个屏上或离屏渲染器持有。逐帧调用 `render`，等待当前帧完成再修改渲染设置。`render` 和 `setEnvironment` 都接受 `AbortSignal`。若取消时模拟已开始，场景可能已经推进。

完成后调用 `dispose()`。如果还有帧在渲染，待该帧处理结束后即可重用场景。

## 相关文档

- [RealityKit 渲染和交互](scripting://doc?title=RealityKit%20Rendering%20and%20Interaction)
- [RealityKit 动画](scripting://doc?title=RealityKit%20Animation)
- [UIImage](scripting://doc?title=UIImage)
