`Renderer.create(scene, options)` 创建渲染控制器，使用 `<RealityView renderer={renderer} />` 挂载。场景同一时间由一个渲染控制器持有。挂载后可通过 `renderer.viewport` 获取视图大小与缩放比例。`pause()` 释放当前渲染表面，`resume()` 在可见时恢复。

`project` 和 `ray` 在视图点与世界坐标间转换。`pick` 查询碰撞形状。在支持的系统上，`pickSurface` 查询模型表面并返回原生子网格及图元标识。`update` 表示一次场景更新。等待 `snapshot()` 可获取渲染后的 UIImage。

通过 [RealityKit 视图后处理](scripting://doc?title=RealityKit%20View%20Post-Processing)为已挂载场景应用 Metal 颜色处理。

在 iOS 18 或更高版本，可为 CAD 预览等场景使用正交相机。通过 `await renderer.setEnvironment(image, { skybox: true, intensityExponent: 0 })` 添加基于图像的照明和天空盒。图像须为正向的 2:1 等距柱状投影 UIImage，宽度最多 2048 像素。用 `skybox: false` 保留纯色背景，或调用 `await renderer.setEnvironment(null)` 清除环境。

`orbit: true` 启用拖动、平移和捏合相机控制。请提供有标签的普通控件执行等效操作，例如 `renderer.resetCamera()`、`renderer.zoom(1.2)` 或设置具体相机位置。用 `setAccessibility` 为可选实体设置标签，并提供可通过 VoiceOver 操作的选择列表。关闭视图时释放事件订阅。
