BLAS 方法保留精度前缀：`s` 使用 Float32Array/FloatBuffer，`d` 使用 Float64Array/DoubleBuffer。同一次运算的操作数必须精度匹配。

## 视图

`VectorView32` 与 `VectorView64` 使用 `{ data, count, offset?, stride? }`。offset 与 stride 以元素为单位；offset 默认为 0，stride 默认为 1 且必须为正。请求的整个跨度必须落在数据范围内。

`MatrixView32` 与 `MatrixView64` 使用 `{ data, rows, columns, layout?, leadingDimension?, offset? }`。rows、columns 描述转置前的存储矩阵。layout 默认为 rowMajor，也可选 columnMajor。leadingDimension 是相邻存储行或列之间的元素间距，默认采用连续布局对应的维度。完整跨度有效时允许填充。不支持负 stride 或重叠的可写布局。

## 运算

| 方法 | 计算 |
| --- | --- |
| `sgemv`、`dgemv` | `y = alpha * op(a) * x + beta * y`；可选 transpose。 |
| `sgemm`、`dgemm` | `c = alpha * op(a) * op(b) + beta * c`；可选 transposeA、transposeB。 |
| `saxpy`、`daxpy` | `y = alpha * x + y`，写入 y。 |
| `sscal`、`dscal` | `x = alpha * x`，写入 x，alpha 必填。 |
| `scopy`、`dcopy` | 将 x 复制到可选 out。 |
| `sdot`、`ddot` | x 与 y 的点积，返回 number。 |

各方法使用 TypeScript 声明中的 options 对象。GEMV/GEMM 接受 alpha、beta；beta 非零时必须显式提供 y/c。向量 count 与矩阵维度必须符合转置后的运算要求。

维度匹配时允许空向量与空矩阵乘法，视图范围仍须有效。

显式提供输出时，Promise 返回输出的 data 对象，其中仍包含填充和写入视图之外的元素。未提供输出的 copy/GEMV/GEMM 返回新的连续 TypedArray；自动分配的 GEMM 输出为 rowMajor。全部方法接受 signal。重叠与结果提交规则见生命周期文档。

## 示例

```ts
async function main() {
  const matrix = Accelerate.FloatBuffer.from(new Float32Array([1, 2, 3, 4]))
  const output = Accelerate.FloatBuffer.create(2)
  try {
    const result = await Accelerate.blas.sgemv({
      a: { data: matrix, rows: 2, columns: 2, layout: 'rowMajor', leadingDimension: 2 },
      x: { data: new Float32Array([2, 1]), count: 2 },
      y: { data: output, count: 2 },
      alpha: 1, beta: 0
    })
    console.log(result === output, result.copyToTypedArray())
  } finally {
    output.dispose()
    matrix.dispose()
  }
}
main().catch(console.error)
```

## 相关文档

- [Accelerate 概览](scripting://doc?title=Accelerate%20Overview)
- [缓冲](scripting://doc?title=Accelerate%20Buffers)
- [生命周期与错误](scripting://doc?title=Accelerate%20Lifecycle)
