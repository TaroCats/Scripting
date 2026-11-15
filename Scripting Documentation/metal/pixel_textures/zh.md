用 `device.makeTextureView({ pixelBuffer })` 将已有 `PixelBuffer` 共享给 Metal 计算。视图沿用原有像素存储，绑定时无需把字节复制到 JavaScript。自己创建缓冲时可传入 `metalCompatible: true`。源缓冲必须有可映射的 IOSurface；无法共享时会报错。

此视图支持两种格式：`bgra8` → `bgra8Unorm` 和 `gray16Float` → `r16Float`，都使用第 0 平面。在内核使用只读二维纹理绑定，例如 `texture2d<half, access::read>`。在 `dispatch()` 或批次命令中传入 `textures: [{ index: 0, texture }]`。纹理沿用原始像素尺寸，不缩放、旋转或转换色彩。

Core ML 的图像输出是 `PixelBuffer`。以预测实际返回的 `feature.value` 作为纹理源。单次预测通过 `outputBackings` 提供匹配缓冲时，用 `feature.value === backing` 检查 Core ML 是否返回了它。模型也可能返回其他缓冲，包括没有共享表面的缓冲。请处理映射错误，需要时显式复制像素。`CoreML.MultiArray` 只有在 `pixelBuffer` 存在且可映射时才能共享。纹理视图不决定 Core ML 如何准备或执行模型。

需要用视图提交新命令时，请保持源缓冲可用。等 Metal 完成后，再修改源或在另一次预测里使用共享存储。释放源后不能提交新命令；已接纳的 GPU 命令仍持有资源直到完成。用完请释放纹理视图，归还共享存储预算。

示例通过 Float16 MultiArray 写入四个值，再用 Metal 内核从同一像素存储读取，并用文字展示结果。

实时相机帧的共享视图用法见 [Metal 相机纹理](scripting://doc?title=Metal%20Camera%20Textures)。
