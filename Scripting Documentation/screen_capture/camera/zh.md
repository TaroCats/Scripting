# 屏幕采集：相机效果

使用 `scope: "app"` 并配置 `picker.showsCameraControl: true`。用户在系统选择器启用相机后，检查 `selection.isCameraEnabled`，获取已有 `AVCaptureDevice` 并调用 `addVideoEffectOutput(device)`，同时需要独立相机系统权限。整屏共享不支持这种应用内相机输出。

系统管理浮动相机预览并自动挂到应用 key window；框架没有自定义 JSX 预览或可导出的原生 view。`cameraDevice` 读取当前设备，`setCameraDevice(device)` 切换其他已连接的视频设备，不限制只能使用前置相机。

通过 `state`、`onStateChanged`、`onError` 观察效果。`stop()` 移除效果并等待原生停止通知后才完成，确保可以安全替换；停止会话也会移除。需要文件或数据时在同一流挂载录像/原始输出，看到预览本身不代表已录制文件。

## index.tsx

请在主 App 中运行示例。系统选择器需要用户操作；“Stop / Cancel”按钮和关闭脚本都会清理该脚本拥有的会话。

点击文档的示例入口即可运行，完整代码见同级 [index.tsx](index.tsx)。
