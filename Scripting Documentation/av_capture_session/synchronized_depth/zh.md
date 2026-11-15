# 同步视频与深度

将 `AVCaptureSynchronizedVideoDepthOutput` 添加到脚本创建的 `AVCaptureSession`。每次 `nextFrame()` 返回一组原生同步数据。使用 TrueDepth 或 LiDAR 等支持深度的相机，并检查视频格式是否提供 `supportedDepthDataFormats`。

```ts
const camera = AVCaptureDevice.defaultDevice("builtInTrueDepthCamera", "video", "front")
if (!camera) throw Error("No TrueDepth camera is available.")
const videoFormat = camera.formats.find(format => format.supportedDepthDataFormats.length > 0)
if (!videoFormat) throw Error("No compatible video format is available.")

const session = new AVCaptureSession()
let output: AVCaptureSynchronizedVideoDepthOutput | undefined
try {
  const frames = new AVCaptureSynchronizedVideoDepthOutput({ pixelFormat: "bgra8", filteringEnabled: false })
  output = frames
  const input = new AVCaptureDeviceInput(camera)
  session.configure(() => {
    session.addInput(input)
    camera.setActiveFormat(videoFormat)
    const depthFormat = camera.activeFormat.supportedDepthDataFormats[0]
    if (!depthFormat) throw Error("The active video format has no depth format.")
    session.setActiveDepthDataFormat(input, depthFormat)
    session.addOutput(frames)
  })
  await session.startRunning()
  const signal = AbortSignal.timeout(5_000)
  while (!signal.aborted) {
    const pair = await frames.nextFrame({ signal })
    try {
      const depth = pair.depthFrame
      if (!pair.videoFrame || !depth) continue
      const map = depth.copyMap()
      console.log(pair.info.timestamp.seconds, map.width, map.height, map.unit)
      break
    } finally {
      pair.dispose()
    }
  }
} finally {
  output?.dispose()
  try { await session.stopRunning() } finally { session.dispose() }
}
```

## 同步与生命周期

- `primary` 可设为 `"video"`（默认）或 `"depth"`。两种设置都可能返回缺少其中一个成员的集合。读取 `pair.info.video` 和 `pair.info.depth`，区分 `ready`、`dropped` 和 `missing`。丢帧成员包含时间戳、原因和原生原因代码。丢弃的深度成员仍可能提供原生格式和校准。可用成员包含时间戳和帧句柄，释放后句柄不可用。视频自身的呈现时间可从 `pair.videoFrame.info` 读取。需要无损时间戳时，读取集合或成员的 `timestampDetails`：它包含原生值、时间尺度、epoch 和 flags，值与 epoch 使用十进制字符串。
- 同一时间保留一次拉取，最多持有两个集合。脚本忙碌时，输出保留最新集合。传入中止信号可取消拉取。用完后释放集合。释放集合、停止或重配会话都会使借用的帧句柄失效。已复制的像素可继续使用。
- 在同一会话中，同步采集与独立的 `AVCaptureVideoDataOutput` 二选一。

## 深度像素与校准

- `depth.info` 包含格式、尺寸、实际旋转与镜像、准确度、质量、过滤状态以及支持的转换格式。过滤会平滑深度图并填补缺失值。未过滤的缺失采样可能为 NaN。
- `depth.copyMap()` 返回紧密排列的 `Data`，每行的字节数由 `bytesPerRow` 给出。格式为 `depthFloat16`、`depthFloat32`、`disparityFloat16` 或 `disparityFloat32`。深度单位是米，视差单位是逆米。`relative` 准确度表示深度图内的相对距离。
- `copyMap({ format, orientation })` 可转换到 `depth.info.availableFormats` 中的格式，并额外应用 EXIF 方向。原始深度图已应用输出连接的方向。转换结果会附带对应的校准数据（若有）。
- `depth.calibration` 可能为 `null`。内参使用 `intrinsicMatrixReferenceDimensions` 下的像素坐标，参考尺寸可能与深度图尺寸不同。3 × 3 内参矩阵和 3 × 4 外参矩阵均按列排列。外参平移和 `pixelSize` 的单位是毫米。畸变中心和可选查找表可用于校正原生深度图的镜头畸变。

运行示例可获取一组同步帧并读取深度图的中心采样。点击 **Capture video and depth** 后开始采集。

视频帧的像素平面和色彩信息见 [实时相机帧](scripting://doc?title=Live%20Camera%20Frames)。
