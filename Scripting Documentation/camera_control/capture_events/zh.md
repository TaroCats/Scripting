# 实体拍摄事件

iOS 18+ 可给主 App 中可见的相机页面添加 `onCameraCaptureEvent`。参数为 `isEnabled`（默认 true）、`primaryAction(event)` 和可选的 `secondaryAction(event)`（默认调用 primaryAction）。事件包含 `phase: "began" | "ended" | "cancelled"` 与 `kind: "primary" | "secondary"`。

必须有正在运行的相机会话。修饰符跟随页面生命周期，scene 不活跃时禁用，不能作为后台全局热键。secondary 不表示相机键半按。不要同时给同一页面附加 `AVCaptureEventInteraction`。触控按钮应调用同一个拍摄函数，等待拍摄时同时禁用两种入口。

停止采集后，脚本不会收到硬件拍摄事件。仅注册此修饰符不会启动相机，也不保证满足系统的拍摄入口要求。将自定义脚本设为系统相机目标前，请阅读[系统拍摄入口要求](../)；这些事件分发规则不代表每次停止相机都会终止 App。

Camera Control 设置覆盖层由系统绘制，通过现有会话 API 配置缩放、曝光和自定义控件；主 App 页面由脚本绘制。同级 `index.tsx` 示例同时包含资源交付和实时拍照界面。


将交互附着在稳定的页面容器上，避免滚动或替换预览时移除交互。拍摄体验中保持可见取景，查看已拍文件时也保留它；操作等待期间禁用拍摄。此示例通过关闭页面结束相机控制拍摄，后续恢复会重新准备相机，不创建重复会话。

## 完整 index.tsx 示例

点击文档的示例入口即可运行，完整代码见同级 [index.tsx](index.tsx)。
