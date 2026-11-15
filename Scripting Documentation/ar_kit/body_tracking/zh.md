`ARKit.createBodyTrackingSession()` 在前台 App 脚本中，通过后置摄像头跟踪画面中的人体。请让被摄者全身入镜。`ARKit.getCapabilities()` 返回设备是否支持全身跟踪与二维检测，以及可用的视频格式。会话使用与重力对齐的世界坐标。暂停或失败后再次调用 `start()` 会启动新的采集代次，并重置世界跟踪。

## 会话生命周期

使用 `start()` 请求相机权限并运行原生会话。`running` 表示已向 ARKit 提交启动请求，使用 `nextFrame()` 等待实际采集结果。会话也可能处于 `starting`、`interrupted`、`paused`、`failed` 或 `closed`。`addStateListener` 返回可交给 `removeStateListener` 的令牌。失败后可通过 `getLastError()` 读取错误代码及消息。系统中断期间，会话保留相机使用权供 ARKit 恢复，状态回到 `running` 后再读取。离开 App 时会话暂停。用完后调用 `close()` 释放会话。

脚本 `AVCaptureSession` 或录像器正在占用相机时，`start()` 可能以 `cameraBusy` 拒绝。先停止相应采集。录像结束后，保留的预览仍可能占用相机。一次只允许一个 `nextFrame()` 等待。会话保留最新未读取的帧，并替换更早的未读取帧。`getStats()` 用十进制字符串返回当前代次接收、替换和无效帧的准确计数。`AbortSignal` 可以取消正在等待的读取。

## 骨架数据

每帧包含采集代次、以秒为单位的时间戳、相机内参和跟踪状态，以及 ARKit 当时的身体锚。在同一代次内比较时间戳。锚 ID 标识该代次中的跟踪对象。可选的 `detectedBody` 包含独立的二维关节，采用左上原点的归一化相机图像坐标，并有自己的关节顺序。映射到预览时应考虑预览方向、裁剪和镜像。

每个三维关节占 16 个列主序浮点数。局部变换相对于父关节，模型变换相对于身体锚。用锚的矩阵乘以关节模型矩阵可得到世界变换，平移位于索引 12–14。`jointFlags` 的位掩码 `1` 表示跟踪，`2` 表示局部矩阵有限，`4` 表示模型矩阵有限。二维关节用 `8` 表示点坐标有限。部分未跟踪关节仍有有限变换，测量前应同时检查跟踪标志和有效性。`getBodySkeletonDefinition('body3D')` 提供原生关节名、父索引和独立的参考 T-pose。`estimatedScaleFactor` 是 ARKit 相对于参考骨架给出的比例估计。

```ts
async function readBodyFrame(signal?: AbortSignal) {
  const capabilities = ARKit.getCapabilities()
  if (!capabilities.bodyTracking) return null
  const tracker = ARKit.createBodyTrackingSession({ detectBody2D: capabilities.bodyDetection2D })
  try {
    await tracker.start()
    return await tracker.nextFrame({ signal })
  } finally {
    tracker.close()
  }
}
```

Demo 测量左膝角度并统计从弯曲到伸直的动作。失去跟踪时会清除上一次弯曲状态。保持髋、膝和踝可见，结束时选择停止跟踪以释放相机。
