模型结构与计算计划查询需要 iOS 17.4 或更新系统，用于读取本地模型信息，不执行性能测试。

`getModelStructure(source)` 返回支持的 Program 函数/块/操作、神经网络层或 pipeline 子模型。`getComputePlan(source, configuration?)` 补充原生设备计划与可选估算开销。不可读取的值与类型会显式标记 `opaque`，不支持的结构仍报告 unsupported。cost weight 是估算值，不是延迟实测，也不能证明实际使用了 GPU/ANE。该 API 不编辑模型图，也不逐算子分配设备。

原生 Core ML 可能拒绝查询某些模型的计算计划，而这些模型仍能正常推理，例如部分系统上的多函数模型。这类失败会保留原生错误；推理成功不代表同一模型与函数必定可查询计算计划。

## 相关文档

- [CoreML 概览](scripting://doc?title=CoreML%20Overview)
- [CoreML.ModelAsset](scripting://doc?title=CoreML.ModelAsset)
- [CoreML.Model](scripting://doc?title=CoreML.Model)
- [生命周期与错误](scripting://doc?title=CoreML%20Lifecycle)
