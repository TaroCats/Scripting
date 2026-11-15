# 实时相机帧

将全局 `AVCaptureVideoDataOutput` 加入脚本创建的 `AVCaptureSession`，通过 `nextFrame` 拉取最新相机帧。可以与现有的采集预览、拍照和元数据输出一起使用。

```ts
const camera = AVCaptureDevice.default("video")
if (!camera) throw new Error("No camera is available.")
const session = new AVCaptureSession()
const input = new AVCaptureDeviceInput(camera)
const output = new AVCaptureVideoDataOutput({ pixelFormat: "nv12VideoRange" })
try {
  session.configure(() => {
    session.addInput(input)
    session.addOutput(output)
  })
  await session.startRunning()
  const frame = await output.nextFrame()
  try {
    const [luma, chroma] = frame.copyPlanes()
    console.log(frame.info.presentationTime.seconds, luma.width, chroma.width)
  } finally {
    frame.dispose()
  }
} finally {
  output.dispose()
  try { await session.stopRunning() } finally { session.dispose() }
}
```

## 像素格式与时间

- `native` 使用相机原生格式。`bgra8`、`nv12VideoRange` 和 `nv12FullRange` 请求指定格式。实际支持由相机和当前采集配置决定。通过 `frame.info.pixelFormatCode` 查看原生 FourCC。
- `copyPlanes()` 返回 BGRA 和 8 位 NV12 的紧排列复制。NV12 的第 0 个平面包含亮度采样，第 1 个平面包含交错排列的 Cb 和 Cr，每个采样占两个字节。释放帧后仍可使用复制出来的数组。
- `frame.info` 包含呈现时间、持续时间、尺寸，以及输出连接的旋转与镜像状态。输出已经将这些变化应用到像素上。预览可能使用不同的方向。
- `frame.info.color` 在有对应信息时提供原生色彩原色、传递函数、YCbCr 矩阵和色度采样位置。字段值来自相机缓冲区的原生附件字符串。

## 拉取和释放帧

传入 `{ signal }` 可以取消拉取。同一时间保持一个待处理请求，每帧用完后及时释放。相机产生帧比脚本处理更快时，输出保留最新帧。`frameStats` 提供本输出的替换及原生丢帧统计。停止或重配会使旧帧失效。

运行 Demo 可以采集一帧 BGRA 像素并显示其复制结果。

如需同时获取视频帧及其对应的深度图，参见 [同步视频与深度](scripting://doc?title=Synchronized%20Video%20and%20Depth)。
