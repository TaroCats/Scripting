使用 `Vision.Request.coreML(model, options?)` 将已加载的 [CoreML](scripting://doc?title=CoreML) 图像模型应用到 UIImage 或[实时相机帧](scripting://doc?title=Live%20Camera%20Frames)。将一个或多个请求传给 `Vision.perform`。同批可以执行模型、人脸、手部或人体姿态请求。支持 iOS 17 及以上。

## 配置请求

- `imageInputName` 选择由 Vision 填充的模型图像输入。模型有多个图像输入时请明确指定。其他必需输入通过 `additionalFeatures` 提供，沿用 Core ML 输入特征格式。
- `cropAndScale` 设置 Vision 如何处理像素。可选 `centerCrop`（默认）、`scaleFit`、`scaleFill`、`scaleFitRotate90CCW` 或 `scaleFillRotate90CCW`。
- `regionOfInterest` 是调整方向后的图像中的归一化矩形，原点在左下角。相机帧的额外方向 `orientation` 和可选的取消信号 `signal` 传给 `Vision.perform`。
- `revision` 选择可用的 Vision 请求版本。`preferBackgroundProcessing` 请求 Vision 优先降低资源占用。加载时指定的 Core ML 配置继续生效。需要状态句柄的模型使用 `CoreML.Model.predict`。

创建请求时会复制附加特征记录。重复使用请求时，其引用的原生句柄需要保持有效。两次执行之间对附加 PixelBuffer 或 MultiArray 的修改会应用到下一次执行。

## 读取结果

| `type` | 数据 |
| --- | --- |
| `classification` | 模型分类标签和置信度。 |
| `recognizedObject` | 原生归一化边界框、整体置信度、分类标签及 Vision 提供的分割遮罩。 |
| `image` | 模型输出尺寸的 PixelBuffer，以及可用的特征名称。 |
| `featureValue` | 带名称的 Core ML 特征，例如标量、字典或 MultiArray。 |

一个请求可返回多种结果。结果顺序和置信度由 Vision 提供。检测框采用所选裁剪模式和 ROI 对应的原生坐标。直接使用 Core ML 推理可取得模型的其他输出。结果可能复用已提供的 Core ML 缓冲或数组句柄。与输入相机帧共享存储的图像会复制后交付。结果缓冲和数组用完后应释放。

```ts
async function classifyPhoto(model: CoreML.Model, photo: UIImage, signal: AbortSignal) {
  const request = Vision.Request.coreML(model, { cropAndScale: 'centerCrop' })
  const [result] = await Vision.perform(photo, [request], { signal })
  if (result.kind !== 'coreML') throw new Error('Expected a model result.')
  const labels: Vision.CoreMLClassificationObservation[] = []
  for (const observation of result.observations) {
    if (observation.type === 'classification') labels.push(observation)
    if (observation.type === 'image') observation.pixelBuffer.dispose()
    if (observation.type === 'recognizedObject') observation.globalSegmentationMask?.pixelBuffer.dispose()
    if (observation.type === 'featureValue') {
      const feature = observation.value
      if (feature.type === 'image' || feature.type === 'multiArray') feature.value.dispose()
    }
  }
  return labels
}
```

Demo 内置一个小型离线分类模型。对同一张图分别选择红色和蓝色区域，观察结果变化。
