全局 `ARKit` API 可在支持的 iPhone 和 iPad 上用前摄跟踪人脸。用 `ARKit.getFaceTrackingCapabilities()` 查询设备支持、视频格式、可跟踪人数上限，以及人脸会话是否能同时跟踪设备在世界中的位姿。

```ts
const support = ARKit.getFaceTrackingCapabilities()
if (support.supported) {
  const session = ARKit.createFaceTrackingSession({ maximumFaces: 1 })
  try {
    await session.start()
    const frame = await session.nextFrame()
    for (const face of frame.faces) {
      if (!face.tracked) continue
      console.log(face.geometry.vertices.length / 3, face.blendShapes.jawOpen)
    }
  } finally {
    session.close()
  }
}
```

## 网格和坐标

每帧提供秒单位的采样时间和当前会话代次内的序号。画面没有人脸时，`faces` 可以为空。锚标识用于识别会话内的人脸锚。根据 `tracked` 判断是否应用当前姿态。

- `geometry.vertices` 是人脸坐标空间中以米为单位连续排列的 XYZ 三元组。`textureCoordinates` 提供蒙皮纹理所用的 UV 对。`triangleIndices` 每三个无符号索引对应一个三角形。可以复用拓扑并逐帧更新顶点。与其他头部模型的对应关系取决于各模型。
- `anchorTransform` 将人脸坐标转换为会话世界坐标。双眼矩阵和估算的注视点 `lookAtPoint` 都以人脸为参考。左右以被摄者为准。矩阵按列主序排列。不可用或非有限的估计返回 `null`。
- `blendShapes` 保留原生表情名称和系数。检测到的系数可以为零。没有键表示原生没有提供该值。

设置 `viewport` 可按指定尺寸和方向得到原生视图矩阵、投影矩阵与 `displayTransform`。投影网格顶点时，先依次应用人脸变换、视图矩阵和投影矩阵，再除以 W。显示变换将归一化原始图像坐标映射到归一化视口坐标，可用于摆放相机画面。网格 UV 用于材质贴图。显示尺寸或方向改变时，可以用新视口重新建立会话。

## 图像与会话

设置 `captureImage: true` 可取得同帧原始相机图像的独立副本。使用前请读取像素格式、色彩附件和平面尺寸。每个平面的 `bytesPerRow` 对应返回的紧排 `Data`，`nativeBytesPerRow` 是输入行宽。像素保留传感器方向。格式不支持或复制预算不足时，帧仍交付跟踪数据，并通过 `imageError` 报告原因。

请在前台启动并允许相机访问。相机控制脚本不能启动人脸跟踪会话。同一时间只保留一个待完成的 `nextFrame()`，可用 `AbortSignal` 取消读取。短时间不读取时，会话会保留最新快照。开启另一个相机会话前先暂停或关闭本会话。重新启动会重置跟踪并进入新的代次。通过 `addStateListener()` 观察中断，用 `getLastError()` 读取失败原因。

可运行示例会绘制投影后的人脸网格，并显示跟踪人数和张嘴系数。面对相机，尝试张嘴、眨眼和转头。示例在本地使用帧数据，提供独立的开始、停止和完成按钮。
