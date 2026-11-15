# 三维人体姿态

在 iOS 17 或更高版本上，使用 `Vision.detectBodyPose3D(image, options?)` 估计静态照片中最显著人物的姿态。请选择能看到完整身体的照片。检测到姿态时返回含一条观测的数组，未检测到时返回空数组。

```ts
const image = UIImage.fromFile('/path/to/full-body-photo.jpg')
if (image && Vision.getCapabilities().requests.bodyPose3D.supported) {
  const [result] = await Vision.perform(image, [Vision.Request.bodyPose3D()])
  const pose = result?.kind === 'bodyPose3D' ? result.observations[0] : undefined
  const wrist = pose?.joints.leftWrist
  if (wrist) {
    const [x, y, z] = wrist.modelTransform.slice(12, 15)
    console.log('Left wrist position in meters', x, y, z)
    console.log('Projection in the image', wrist.imagePoint)
  }
}
```

请求支持通用的 `revision` 和 `regionOfInterest` 选项。可向 `Vision.detectBodyPose3D` 或 `Vision.perform` 传入 `signal` 取消操作。使用 `Vision.getCapabilities().requests.bodyPose3D` 查询支持的请求修订版本、关节名称和分组。

## 变换与坐标

- `joints` 包含命名关节及其 `parentJoint`。原生布局有 17 个关节。`root` 位于髋部中央，没有父关节。`jointGroups` 列出各原生分组的关节，`jointGroups.all` 包含本次返回的全部关节。
- `modelTransform` 表示关节在模型坐标系中的变换。`localTransform` 表示关节相对于父关节的变换。`cameraRelativeTransform` 在可用时提供相机坐标系中的变换。
- `cameraOriginMatrix` 是 Vision 从模型根节点到相机投影中心的变换。这四种变换都采用列主序 4 × 4 矩阵。索引 12–14 表示平移，单位为米。
- `imagePoint` 是关节在按显示方向处理后的完整图像上的投影，使用左下角为原点的归一化坐标。它可以为 `null`。可用时，可以通过 `Vision.imagePointToView` 将投影点叠加到等比缩放预览上。
- `bodyHeight` 的单位为米，`heightEstimation` 表示其来源。`reference` 使用 Vision 的 1.8 米参考身高。`measured` 表示基于深度的估计。`unknown` 用于未来出现的原生取值。

此 API 接收 `UIImage` 并分析按显示方向处理后的像素。图像输入不会向 Vision 传递内嵌或配对的深度数据，请按参考身高使用结果。运行示例可以选取照片，查看投影骨架、关节数量和身高估计来源。

[Vision](scripting://doc?title=Vision) · [Apple 三维人体姿态指南](https://developer.apple.com/documentation/vision/identifying-3d-human-body-poses-in-images)
