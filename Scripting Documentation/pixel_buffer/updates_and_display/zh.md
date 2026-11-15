`PixelBuffer.writePlanes()` 可以原地更新原生像素缓冲区，支持整图、矩形区域和同一调用内的多个平面。`AVSampleBufferDisplayLayer.enqueuePixelBuffer()` 可通过 `SampleBufferView` 显示 BGRA8 或 8 位 NV12 的快照。

## 像素平面

`bgra8`、`gray8` 和 `gray16Float` 各有一个平面。对 `gray16Float`，`Uint16Array` 保存半精度浮点值的原始位。两种 NV12 要求图像宽高为偶数，并使用两个平面。平面 0 每个图像像素占一个亮度字节。平面 1 的宽高均减半，每个样本为交错的 Cb 和 Cr 两个字节。更新坐标使用各自平面的采样单位，第一行为 `y: 0`。

`nv12VideoRange` 的初始亮度为 16，`nv12FullRange` 为 0，两者的初始色度为 128，并使用 BT.709 色彩附件。从字节初始化时，可通过 `planes` 提供各平面的数据。单平面格式也支持已有的 `data` 和 `bytesPerRow`。`copyPlanes()` 返回紧凑的行，`description.planes` 提供原生行距。

## 更新区域

每项写入提供 `plane`、`data`，可选 `x`、`y`、`width`、`height` 和 `bytesPerRow`。省略矩形时写入整个平面。省略宽高时从起始坐标写到边缘。源数据行距默认为区域的紧凑行大小，数据应包含恰好 `bytesPerRow * height` 个字节。每次调用中每个平面最多出现一次，所有写入验证通过后才开始修改。如果同一存储正在被模型使用，写入会返回 `busy`。

```ts
const pixels = PixelBuffer.create({ width: 4, height: 4, format: 'nv12VideoRange' })
try {
  pixels.writePlanes([
    { plane: 0, x: 0, y: 0, width: 2, height: 2, data: new Uint8Array([180, 180, 180, 180]) },
    { plane: 1, x: 0, y: 0, width: 1, height: 1, data: new Uint8Array([90, 180]) },
  ])
  console.log(pixels.copyPlanes()[0].data)
} finally {
  pixels.dispose()
}
```

## 按媒体时间显示

将视频渲染器添加到 `AVSampleBufferRenderSynchronizer`。提交该时钟上的数值型 `MediaTime` 和可选的非负时长。队列保留独立快照，调用 `enqueuePixelBuffer` 后可以更新或释放源缓冲区。Promise 在 AVFoundation 接收样本后完成，画面随时钟显示。每个脚本的原始像素显示快照共用 64 MiB 预算。单个快照最多预留 32 MiB，为后续画面保留空间。时钟和视图用法见 [Sample Buffer Playback](scripting://doc?title=Sample%20Buffer%20Playback)。
