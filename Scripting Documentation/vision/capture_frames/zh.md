`Vision.perform`、`Vision.detectFaces`、`Vision.detectFaceLandmarks`、`Vision.detectBodyPose`、`Vision.detectBodyPose3D` 和 `Vision.detectHandPose` 都接受 `AVCaptureVideoFrame`。Vision 读取原始相机样本及其附件。可读取帧序号和 `presentationTime`，把观察结果与采集时间关联起来。相机配置见[实时相机帧](scripting://doc?title=Live%20Camera%20Frames)。

## 方向与坐标

默认按交付像素分析。采集连接已经应用的旋转和镜像包含在这些像素中。如果人物仍然横置或倒置，可以用 `orientation` 指定分析方向。支持 EXIF 的 `up`、`down`、`left`、`right`，以及相应的 `upMirrored`、`downMirrored`、`leftMirrored`、`rightMirrored`。

归一化观察值和 `regionOfInterest` 以分析方向下的图像为准，原点在左下角。使用 `left`、`right` 或其镜像方向时，将归一化结果换算成该方向的像素坐标需要交换宽高。`inputFaces` 可以复用同一个有效帧、同一分析方向检测到的人脸。如果在预览上绘制，还需要按预览的裁剪和镜像调整坐标。

## 采集与分析生命周期

保留帧直到分析结束，并在 `finally` 中调用 `dispose()`。取消操作、停止或重新配置采集、释放帧都会阻止结果交付。分析过程中，采集可以替换尚未读取的帧。处理完一帧并释放后再请求下一帧，可控制延迟与内存。每次调用独立分析，最多可同时保留两项任务，每批最多八个请求。

```ts
async function analyze(output: AVCaptureVideoDataOutput, signal?: AbortSignal) {
  const frame = await output.nextFrame({ signal })
  try {
    const { presentationTime } = frame.info
    const results = await Vision.perform(frame, [Vision.Request.faces(), Vision.Request.bodyPose()], { signal })
    return { presentationTime, results }
  } finally {
    frame.dispose()
  }
}
```

Demo 每次分析一帧并报告人脸、人体姿态及手部数量。请允许使用相机，并选择能让被摄人物直立的分析方向。结果类型和坐标工具见 [Vision](scripting://doc?title=Vision)。
