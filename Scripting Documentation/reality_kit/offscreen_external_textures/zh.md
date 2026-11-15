# 离屏外部纹理

使用 `OffscreenRenderer.renderWithExternalTexture` 可以在一次离屏渲染中，将相机帧或像素缓冲绘制到一个平面上。使用前先检查 `RealityKit.getCapabilities().offscreenExternalTextures`。此 API 需要 iOS 27 或更高版本。

## 从像素缓冲渲染

```ts
if (RealityKit.getCapabilities().offscreenExternalTextures) {
  const pixels = PixelBuffer.create({
    width: 2, height: 2, format: 'bgra8',
    data: new Uint8Array([
      0, 64, 240, 255, 64, 210, 20, 255,
      240, 120, 20, 255, 0, 210, 240, 255,
    ]),
  })
  const scene = RealityKit.Scene.create()
  let renderer: RealityKit.OffscreenRenderer | undefined
  try {
    renderer = RealityKit.OffscreenRenderer.create(scene, {
      camera: { position: [0, 0, 3], target: [0, 0, 0] },
    })
    const frame = await renderer.renderWithExternalTexture(pixels, {
      width: 256, height: 192,
      surface: {
        width: 1.6, height: 1.6,
        sampler: { minFilter: 'nearest', magFilter: 'nearest' },
      },
    })
    const image = UIImage.fromPixels({
      width: frame.width, height: frame.height, bytesPerRow: frame.bytesPerRow,
      data: frame.data, format: 'bgra8', alphaMode: 'opaque',
    })
    console.log(frame.frameIndex, image.width, image.height)
  } finally {
    renderer?.dispose()
    scene.dispose()
    pixels.dispose()
  }
}
```

传入同一次脚本运行中的单平面 BGRA8 格式 `PixelBuffer` 或 `AVCaptureVideoFrame`。源像素必须位于兼容的 IOSurface 中。使用相机帧时，请在 `AVCaptureVideoDataOutput` 上指定 `{ pixelFormat: 'bgra8' }`。平面直接采样交付的像素，保留相机输出已应用的旋转和镜像。此方法使用原始 BGRA 值，不转换色彩配置。

## 放置平面和读取帧

必填的 `surface` 描述一个临时的无光照平面。`width` 和 `height` 为正数，单位与场景相同。使用 `transform` 移动、旋转或缩放平面，使用 `sampler` 控制源纹理的采样方式。这个平面只出现在本次渲染中，不会产生可访问的脚本实体或可复用的纹理句柄。

顶层的 `width` 和 `height` 是输出像素尺寸。其他输出选项和返回值与 `render` 一致，包括视口、帧时间步长以及返回 `Uint8Array` 或 `Data` 的选择。RealityKit 直接采样源纹理，并返回独立渲染的帧。已配置的离屏颜色后处理也会应用到输出。 [RealityKit 离屏渲染](scripting://doc?title=RealityKit%20Offscreen%20Rendering)

## 保持源数据有效

请保持源数据有效，等操作结束后再按需释放。渲染器读取期间，不能修改像素缓冲或与它共享的存储。请等待一帧完成后再开始下一帧。传入中止 `signal` 可以取消结果交付。取消后，已经提交的帧可能继续完成，场景也可能已经推进。

如果设备无法确认渲染完成，渲染器会关闭，源数据在完成前可能仍处于忙碌状态。请等待源数据恢复可用，再新建渲染器重试。

需要可复用的纹理绑定，或者无法直接借用源数据时，可使用外部纹理快照。单帧接口目前接受单平面 BGRA8 格式的源数据。 [RealityKit 外部纹理](scripting://doc?title=RealityKit%20External%20Textures) · [实时相机帧](scripting://doc?title=Live%20Camera%20Frames)

运行示例，用同一个像素缓冲依次渲染两种图案。可通过按钮更新图案，状态文字会显示上一次渲染的帧。
