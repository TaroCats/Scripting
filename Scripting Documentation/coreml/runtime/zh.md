## 取消与释放

异步操作接受 `{ signal: AbortSignal }`。取消会拒绝 Promise，但不表示硬件已立即停止；在途存储会保留到原生完成。请对不再使用的数组、图像、模型、资产、状态、更新任务和张量显式调用 `dispose()`。handle 属于一次脚本运行，不能跨运行传递。已释放资源不能继续访问，取消后仍可清理。

## 能力与上限

队列、对象及受管内存上限可从 capabilities 查询。内存 specification/blob 快照累计上限为 256 MiB，文件快照另有 4 GiB 磁盘上限，不代表原生模型工作内存被限制在 256 MiB。capabilities 还报告 updates、tensorComputation、computePlans、modelStructure、tensorDTypes、maximumActiveUpdates（8）及 maximumTrainingBatchSize（4096），实际模块与 dtype 随运行系统变化。maximumMemorySnapshotBytes、maximumDiskSnapshotBytes 和 compiledModelPolicy 描述这些边界。

## 错误

错误包含 `code`，系统提供时还包括 `nativeDomain`、`nativeCode` 与 `cause`。请区分取消、特征或状态无效、系统版本不可用、资源上限及原生模型失败，不要对所有错误都自动换 compute 配置重试。

## 范围

此 CoreML 命名空间不提供实时相机帧采集、Vision CoreML request 或 ARKit 跟踪。它加载本地模型，不下载缺失模型、不安装任意原生自定义 layer、不做格式转换或模型量化。

## 相关文档

- [CoreML 概览](scripting://doc?title=CoreML%20Overview)
- [CoreML.ModelAsset](scripting://doc?title=CoreML.ModelAsset)
- [CoreML.State](scripting://doc?title=CoreML.State)
- [CoreML.Tensor](scripting://doc?title=CoreML.Tensor)
