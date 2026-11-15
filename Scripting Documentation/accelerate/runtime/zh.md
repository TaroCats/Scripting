数值运算异步执行，并接受 `{ signal: AbortSignal }`；缓冲上传与拷贝为同步操作。请在主脚本执行器调用。

## 输入与输出

运算会为 TypedArray 输入创建快照。视图 offset、stride、leadingDimension 以元素为单位，不是字节；访问原生存储前检查布局、维度与完整跨度。输入精度必须一致，不进行隐式 float32/float64 混用，也不接受负 stride。

显式 TypedArray 与驻留缓冲输出仅在成功完成后提交写入；失败或取消不会提交结果。取消可能在原生计算停止前就使 Promise 拒绝，在途存储会保持到原生完成。运算尚未完成时，不要修改传入的输出。

axpy、scal、copy 仅允许输入与输出为完全一致的视图：存储、起始位置、count、stride 均相同。部分重叠及其他运算的输入/输出重叠均拒绝。

## 生命周期与上限

不再需要驻留缓冲时调用 dispose。handle 属于一次脚本运行，不能跨运行共享。原生工作使用中的缓冲可能处于 busy 状态；调用 dispose 不代表底层分配已立即释放。

getCapabilities() 返回 dtypes、maximumBytes、maximumResources、maximumJobs、features。请读取实际值，不要假设驻留缓冲池或队列没有上限。这些上限不承诺特定执行时间。

## 错误与范围

错误包含 code，线性代数错误还可能包含 lapackInfo。请区分视图无效、精度不匹配、资源忙碌或已释放、取消、资源上限、奇异矩阵和数值失败。

此 CPU API 不完整映射整个 Accelerate framework，不提供 FFT、复数运算、稀疏矩阵、vImage 或 BNNS；也不创建 GPU 绘图表面，不保证每种操作都能获得性能提升。

## 相关文档

- [Accelerate 概览](scripting://doc?title=Accelerate%20Overview)
- [缓冲](scripting://doc?title=Accelerate%20Buffers)
- [BLAS](scripting://doc?title=Accelerate%20BLAS)
- [线性代数](scripting://doc?title=Accelerate%20Linear%20Algebra)
