# RealityKit 视图深度后处理

已挂载的 `RealityView` 可以让 Metal 效果同时读取当前帧的场景深度和渲染颜色。将 `sourceDepthIndex` 设为核函数中只读 `depth2d<float, access::read>` 的纹理索引。索引范围为 0 至 127，需与源颜色和目标颜色纹理的索引区分开。

```ts
declare const renderer: RealityKit.Renderer
declare const pipeline: Metal.ComputePipeline
renderer.setPostProcess({ pipeline, sourceColorIndex: 0, targetColorIndex: 1, sourceDepthIndex: 2 })
const info = renderer.postProcessInfo()
if (info.state === "applied") console.log(info.sourceDepthPixelFormatCode)
```

深度和颜色共用当前帧的像素坐标。深度值处于相机的投影深度范围内。示例采用反向 Z 的透视投影，离相机越近，深度值越大。需要还原视图空间坐标时，可通过 `frameUniformIndex` 读取同一帧的投影矩阵。遇到深度无效的像素时，可以保留原始颜色。如果核函数需要检查非有限值，编译着色器库时请设置 `enableFastMath: false`。

效果使用视图提供的兼容单采样 `depth32Float` 纹理。当某一帧没有兼容的深度纹理且颜色直通成功时，画面保留原始颜色，状态为 `bypassed`。深度效果完成编码后，可以查看 `sourceDepthPixelFormatCode`。已在搭载 iPadOS 27.2 的 iPad mini（第六代）上验证。已测试的 iPadOS 26.5 和 iOS 27.0 模拟器会跳过效果。

运行示例可以查看两个平面随场景深度呈现的不同颜色。状态文字会说明当前是否应用了效果。用按钮可以在原始画面和深度效果之间切换。
