`Accelerate.vector` 提供逐元素运算与归约。精度由输入 a 决定：全部视图都使用 float32，或全部使用 float64。重载接受精度匹配的 TypedArray 与驻留缓冲。

## 运算

| 方法 | 输入 |
| --- | --- |
| `add`、`subtract`、`multiply`、`divide` | a、b，按元素执行对应运算。 |
| `multiplyAdd` | a、b、c，逐元素计算 `a * b + c`。 |
| `abs`、`square`、`sqrt`、`exp`、`log`、`sin`、`cos`、`tanh` | a。 |
| `reduce` | a 及 operation：sum、mean、min、max 或 sumSquares，返回 number。 |

全部输入为 count 匹配的 VectorView。逐元素方法接受可选 out；显式输出必须与输入精度/count 匹配，返回值就是该 data 对象。未提供 out 时返回新的连续 TypedArray。每个方法接受 signal。输入与输出不能重叠，请使用独立目标。

允许空向量。空输入的 sum、sumSquares 返回 0；mean、min、max 会拒绝空输入。

## 示例

```ts
async function main() {
  const a = new Float64Array([1, 2, 3])
  const b = new Float64Array([2, 4, 8])
  const c = new Float64Array([10, 10, 10])
  const output = new Float64Array(3)
  const result = await Accelerate.vector.multiplyAdd({
    a: { data: a, count: 3 }, b: { data: b, count: 3 },
    c: { data: c, count: 3 }, out: { data: output, count: 3 }
  })
  console.log(result === output, result)
  console.log(await Accelerate.vector.reduce({
    a: { data: result, count: 3 }, operation: 'sum'
  }))
}
main().catch(console.error)
```

## 相关文档

- [Accelerate 概览](scripting://doc?title=Accelerate%20Overview)
- [缓冲](scripting://doc?title=Accelerate%20Buffers)
- [生命周期与错误](scripting://doc?title=Accelerate%20Lifecycle)
