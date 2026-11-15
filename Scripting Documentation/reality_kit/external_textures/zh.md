# 外部纹理

使用 `RealityKit.ExternalTexture` 可以在 RealityKit 材质上显示 `PixelBuffer` 或 `AVCaptureVideoFrame` 的快照。此 API 需要 iOS 27 或更高版本。使用前先检查 `RealityKit.getCapabilities().externalTextures`。

## 创建和绑定快照

`await RealityKit.ExternalTexture.create(source, { signal? })` 将源像素复制为独立的 BGRA8 纹理快照。它接受第 0 个 BGRA 平面。调用 `PixelBuffer.create` 时选择 `'bgra8'`，或者在创建 `AVCaptureVideoDataOutput` 时传入 `{ pixelFormat: 'bgra8' }`。使用相机帧时，请保持该帧有效，直到操作完成。纹理直接采样源 BGRA 数值。需要转换色彩配置时，请在创建快照前转换图像。

```ts
const source = PixelBuffer.create({
  width: 2, height: 1, format: 'bgra8',
  data: new Uint8Array([0, 80, 255, 255, 255, 160, 0, 255]),
})
let external: RealityKit.ExternalTexture
try {
  external = await RealityKit.ExternalTexture.create(source)
} finally {
  source.dispose()
}

const material = RealityKit.Material.create({
  kind: 'unlit', baseColor: [1, 1, 1, 1],
  baseColorTexture: { texture: external.texture },
})
const plane = RealityKit.Entity.create()
plane.setModel(RealityKit.Mesh.primitive({ type: 'plane', width: 1, height: 0.5, vertical: true }), [material])
```

操作成功后，修改或释放源数据都不会影响已发布的快照。`info` 提供以像素为单位的宽高、`pixelFormat: 'bgra8Unorm'`、`storage: 'snapshot'`、修订号字符串和来源 `source`（`'pixelBuffer'` 或 `'camera'`）。相机快照还可能包含 `MediaTime` 类型的 `timestamp`、以度为单位的 `rotationAngle` 和 `mirrored`。这些旋转和镜像已由相机输出应用到像素。

## 替换快照

`await external.replace(source, { expectedRevision?, signal? })` 发布下一份快照并返回新的修订号字符串。同一个 `external.texture` 可以继续绑定在材质上。将上次读到的修订号传给 `expectedRevision`，如果其他操作已更新纹理，本次替换就会被拒绝。

请等待一次替换完成后再开始下一次。取消或失败时，之前的快照和修订号仍然可用。成功替换会发布纹理，供后续渲染使用。操作完成后即可释放源缓冲区或相机帧。无需继续替换时，调用 `external.dispose()`。已有的纹理句柄和材质绑定可以继续保留最后一份快照。

只要纹理仍被引用，以前替换留下的快照就会计入 RealityKit 资源限额。需要持续更新视频帧时，请使用 [RealityKit 低级纹理](scripting://doc?title=RealityKit%20Low-Level%20Textures)。

## 捕获相机快照

从正在运行的采集会话中，通过 BGRA 视频输出取帧并直接传入。替换完成后即可释放该帧。

```ts
async function captureSnapshot(output: AVCaptureVideoDataOutput, external: RealityKit.ExternalTexture) {
  const frame = await output.nextFrame()
  try {
    return await external.replace(frame, { expectedRevision: external.info.revision })
  } finally {
    frame.dispose()
  }
}
```

运行示例，在同一个材质上切换两种生成的图案。状态文字会显示当前图案和修订号。

[PixelBuffer](scripting://doc?title=PixelBuffer) · [实时相机帧](scripting://doc?title=Live%20Camera%20Frames)
