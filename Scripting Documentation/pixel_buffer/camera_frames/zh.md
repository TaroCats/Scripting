`PixelBuffer.fromCaptureFrame(frame, options?)` 将有效的[相机帧](scripting://doc?title=Live%20Camera%20Frames)复制到独立的缓冲区。调用返回后即可释放原帧。复制后的像素可用于 [CoreML](scripting://doc?title=CoreML)，也可用 `writePlanes` 修改或转换为 UIImage。

- 默认保留相机交付的 BGRA 或 NV12 格式、尺寸及可传播的色彩附件。原样复制时也可明确指定原帧的 NV12 格式。其他相机布局在 Core Image 支持时会转换为 BGRA。
- RGB/BGR 模型可用 `format: 'bgra8'`。灰度模型按要求使用 `'gray8'` 或 `'gray16Float'`。灰度转换采用 gamma 2.2。BGRA 转换默认使用 sRGB，也支持 Display P3。
- `orientation` 是对交付像素额外施加的 EXIF 变换，默认为 `'up'`。旋转 90 度时默认宽高互换。`width` 和 `height` 将已调整方向的图像拉伸到指定尺寸。变换时若省略格式，将输出 BGRA。
- 要把推理结果或画面关联到原帧，在释放帧之前读取 `frame.info.presentationTime`。复制是同步的，可直接使用模型输入尺寸，并通过 `nextFrame` 一次处理一帧。

示例假设相机会话已启动，且模型的 `image` 输入为 224 × 224 的彩色图像。可从模型描述中读取实际输入名称与约束。返回的输出由调用者持有。

```ts
async function predictCameraImage(
  model: CoreML.Model,
  frames: AVCaptureVideoDataOutput,
  signal: AbortSignal,
) {
  const frame = await frames.nextFrame({ signal })
  const time = frame.info.presentationTime
  let pixels: PixelBuffer
  try {
    pixels = PixelBuffer.fromCaptureFrame(frame, {
      format: 'bgra8', width: 224, height: 224, orientation: 'up',
    })
  } finally {
    frame.dispose()
  }
  try {
    const outputs = await model.predict({ image: { type: 'image', value: pixels } }, { signal })
    return { time, outputs }
  } finally {
    pixels.dispose()
  }
}
```

Demo 采集一帧，显示原始布局和缩放后的 BGRA 预览，无需下载模型。
