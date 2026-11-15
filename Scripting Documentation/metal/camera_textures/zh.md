在前台 App 脚本中，用 `device.makeTextureView({ cameraFrame: frame, plane })` 从 Metal 读取实时 `AVCaptureVideoFrame`。设备能映射所选平面时，视图共享原始 IOSurface。相机控制脚本不能用此方式。

| 帧格式 | 平面 | Metal 格式 |
| --- | --- | --- |
| BGRA8 | 0 | `bgra8Unorm` |
| 全范围或视频范围 NV12 | 0，亮度 | `r8Unorm` |
| 全范围或视频范围 NV12 | 1，CbCr | `rg8Unorm` |

在 `dispatch()` 或 `dispatchBatch()` 中使用只读 `texture2d` 绑定。NV12 色度平面的宽高各为亮度平面的一半。视图保留已交付的图像、颜色范围和原始平面顺序，不额外旋转或镜像。需要 RGB 时，在内核中使用正确的 YCbCr 矩阵和范围。需要旋转、镜像或颜色附件时，在释放帧前读取其元数据。

提交命令前保持原帧可用。纹理视图本身不会延长丢弃的相机帧的寿命。不再需要相机帧时，可在调用 dispatch 后立即释放；已接纳的 GPU 工作会持有它直到完成。一个视图不能换绑其他帧。用完后释放视图，并检查映射和提交产生的错误。

原生提交前撤销相机权限，dispatch 会失败。命令一旦提交，即使随后变更权限导致 Promise 被拒绝，GPU 仍可能写入输出缓冲区。

示例捕获一张 NV12 帧，让 Metal 读取中心的 Y、Cb、Cr，并用文字显示结果。
