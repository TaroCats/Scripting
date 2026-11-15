全局 `Accelerate` API 提供 CPU 向量运算、BLAS 矩阵运算、线性方程求解、最小二乘与傅里叶变换，支持 float32 和 float64。无需从 `scripting` 导入。

数值运算返回 Promise。可使用 TypedArray 输入快照，也可用驻留 FloatBuffer/DoubleBuffer 保存多次运算复用的数据。通过 `Accelerate.getCapabilities()` 查询可用能力与上限。

## 文档

| API | 内容 |
| --- | --- |
| [缓冲](scripting://doc?title=Accelerate%20Buffers) | 驻留 float32/float64 数据、上传、拷贝与释放。 |
| [BLAS](scripting://doc?title=Accelerate%20BLAS) | 矩阵/向量视图及按精度区分的 BLAS 运算。 |
| [向量](scripting://doc?title=Accelerate%20Vector) | 逐元素计算、数学函数与归约。 |
| [线性代数](scripting://doc?title=Accelerate%20Linear%20Algebra) | 线性方程、最小二乘、秩与数值错误。 |
| [傅里叶变换](scripting://doc?title=Accelerate%20Fourier%20Transforms) | 实数与复数变换、归一化和支持的长度。 |
| [生命周期与错误](scripting://doc?title=Accelerate%20Lifecycle) | 快照、输出提交、重叠、取消与上限。 |

## 相关文档

- [CoreML.MultiArray](scripting://doc?title=CoreML.MultiArray)
- [CoreML.Tensor](scripting://doc?title=CoreML.Tensor)
