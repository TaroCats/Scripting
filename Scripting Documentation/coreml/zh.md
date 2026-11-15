全局 `CoreML` API 可运行本地 Core ML 模型、管理原生数组与状态、更新支持端上更新的模型，并读取模型结构与计算计划。无需从 `scripting` 导入。

请在主脚本执行器调用。加载、编译、推理和张量物化返回 Promise，模型运算在后台执行。此桥接从 iOS 17 起提供 Core ML 能力。函数描述查询、多函数、状态和 Tensor 计算需要 iOS 18；结构与计算计划查询需要 iOS 17.4。请结合 `CoreML.getCapabilities()` 和具体模型约束判断可用性。

## 文档

| API | 内容 |
| --- | --- |
| [CoreML.Model](scripting://doc?title=CoreML.Model) | 加载、推理、校验与保存模型，特征表示及数值精度。 |
| [CoreML.ModelAsset](scripting://doc?title=CoreML.ModelAsset) | 资产、模型函数、源选项、配置与编译缓存。 |
| [CoreML.MultiArray](scripting://doc?title=CoreML.MultiArray) | dtype、形状、步长、逻辑拷贝与像素缓冲存储。 |
| [CoreML.State](scripting://doc?title=CoreML.State) | 模型绑定状态、批量预测与输出缓冲。 |
| [CoreML.UpdateTask](scripting://doc?title=CoreML.UpdateTask) | 训练数据、进度、取消、保存与后续更新。 |
| [CoreML.Tensor](scripting://doc?title=CoreML.Tensor) | 工厂方法、运算、索引、物化与张量推理。 |
| [模型检查](scripting://doc?title=CoreML%20Model%20Inspection) | 模型结构、原生计算计划及可用性边界。 |
| [生命周期与错误](scripting://doc?title=CoreML%20Lifecycle) | 取消、资源释放、上限、错误与 API 范围。 |

## 相关文档

- [PixelBuffer](scripting://doc?title=PixelBuffer)
- [UIImage](scripting://doc?title=UIImage)
- [Vision](scripting://doc?title=Vision)
