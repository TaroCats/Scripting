`Accelerate.linearAlgebra` 接受非空且精度匹配的 float32 或 float64 MatrixView，全部输入值必须有限，不改写输入矩阵。solution 是连续 rowMajor TypedArray，同时返回 rows、columns、info。

## solve

`solve({ a, b, signal? })` 求解 `a * x = b`。a 必须为方阵，b 与 a 行数相同，并可包含多个右端列。solution 的行数为 a.columns，列数为 b.columns。

奇异矩阵会以 `code: 'singularMatrix'` 拒绝，并提供 lapackInfo，不返回伪造的解。

## leastSquares

`leastSquares({ a, b, rcond?, signal? })` 使用 SVD 求解最小二乘，支持欠定、超定和秩亏系统。b.rows 必须等于 a.rows。结果包含 solution、rows、columns、info、rank、singularValues；solution 的行数为 a.columns，奇异值数量为 min(a.rows, a.columns)。

可选 rcond 控制确定秩时采用的相对奇异值阈值。省略时，采用原生求解器默认的机器精度阈值。秩亏会返回实际 rank，不自动作为错误；不收敛以 `code: 'numericalFailure'` 拒绝并提供 lapackInfo。请检查实际秩与错误，不要假设所有矩阵均满秩。

## 示例

```ts
async function main() {
  const result = await Accelerate.linearAlgebra.solve({
    a: { data: new Float64Array([3, 1, 1, 2]), rows: 2, columns: 2 },
    b: { data: new Float64Array([9, 8]), rows: 2, columns: 1 }
  })
  console.log(result.rows, result.columns, result.solution)
  const fit = await Accelerate.linearAlgebra.leastSquares({
    a: { data: new Float64Array([1, 0, 1, 1, 1, 2]), rows: 3, columns: 2 },
    b: { data: new Float64Array([1, 2, 3]), rows: 3, columns: 1 },
    rcond: 1e-12
  })
  console.log(fit.solution, fit.rank, fit.singularValues)
}
main().catch(console.error)
```

## 相关文档

- [Accelerate 概览](scripting://doc?title=Accelerate%20Overview)
- [缓冲](scripting://doc?title=Accelerate%20Buffers)
- [生命周期与错误](scripting://doc?title=Accelerate%20Lifecycle)
