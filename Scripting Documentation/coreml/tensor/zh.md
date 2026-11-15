iOS 18+ 的 `Tensor.fromTypedArray` / `fromData` 创建原生计算对象。Tensor 支持 float16/float32、bool 和有符号/无符号 8/16/32 位整数，与 MultiArray 的 dtype 集合不同。bool 输入使用值为 0 或 1 的 Uint8Array，float16 使用包含 half 原始位的 Uint16Array。操作要求 dtype 与形状兼容，并遵循具体原生算子的类型支持范围。矩阵乘法与 mean 需要 float16/float32；abs、sign、square 需要数值 dtype；bool 仍可使用 min、max、product。不同原生系统对 bool 求和的表示不一致，因此 sum/cumulativeSum 会拒绝；计数请先 cast 到 int32，逻辑或请使用 any。使用 `await tensor.copyToTypedArray()` 或 `copyToData()` 物化结果。

```ts
async function main() {
  const a = CoreML.Tensor.fromTypedArray(new Float32Array([1, 2, 3, 4]), {
    dtype: 'float32', shape: [2, 2]
  })
  const b = a.transpose()
  const c = a.matmul(b, { computeUnits: 'cpuOnly' })
  const indices = CoreML.Tensor.fromTypedArray(new Int32Array([1, 0]), {
    dtype: 'int32', shape: [2]
  })
  let rows: CoreML.Tensor | undefined
  try {
    rows = await c.gather(indices, { axis: 0 })
    console.log(await rows.copyToTypedArray())
  } finally {
    rows?.dispose(); indices.dispose(); c.dispose(); b.dispose(); a.dispose()
  }
}
main().catch(console.error)
```

工厂方法包括 `full(shape, value, { dtype?, computeUnits? })`、`zeros`、`ones`、`randomNormal`、`randomUniform`、`range`、`linspace`；`concatenate(tensors, axis?)` 与 `stack(tensors, axis?)` 合并张量。随机 seed 使用规范的无符号 64 位十进制字符串。正态随机值与 linspace 使用 float16/float32。均匀随机和 range 还支持有符号/无符号整数 dtype：浮点均匀区间不包含上界，整数均匀区间包含两端。range 不包含终点，linspace 包含两端。显式 computeUnits 使用原生计算策略，不保证实际运行设备。

| 操作 | 参数与结果 |
| --- | --- |
| `split`、`unstack` | `split({ axis?, sizes?, count? })` 或 `unstack(axis?)` 返回 Tensor 数组。 |
| `topK` | `topK(k)` 返回 `{ values, indices }` 张量。 |
| `slice` | 接受数组：`{ type: 'all' }`、newAxis、squeeze、带 index 的 index，或带 start/end 及可选 stride 的 range。 |
| `gather`、`gatherND`、`scatter` | 须 await：后台物化并验证 int32 索引，返回 Promise&lt;Tensor&gt;。gather/scatter 可选 axis，均支持 signal；scatter 还需 replacement 张量。 |
| `replaceWhere` | 接受 bool mask 与 replacement 张量。 |
| `pad` | 每轴 `[before, after]`；mode 为 constant、reflection 或 symmetric，可选常量 value。 |
| `resized` | height、width，可选 nearestNeighbor/bilinear method 与 alignCorners。 |
| `clamp`、`bandPart` | 数值上下界，或原生矩阵上下带宽。 |
| `toMultiArray` | 异步物化原生数组，可选输出 dtype 与 signal。 |

命名方法还包括算术与比较、矩阵乘法、浮点数学、bool 逻辑、reshape/transpose、归约、累积和/积及排序。`MultiArray.toTensor()` 从兼容数组创建原生张量。iOS 18+ 的 `model.predictTensors(inputs, { state?, signal? })` 接受并返回按名称组织的原生 Tensor 字典，不能代替 scalar、image、dictionary 或 sequence 特征转换。每个操作的 options 以最新 TypeScript 声明为准。Tensor 不提供 autograd、任意原生 shader 编译，也不保证所有算子都支持每种 dtype。

## 相关文档

- [CoreML 概览](scripting://doc?title=CoreML%20Overview)
- [CoreML.MultiArray](scripting://doc?title=CoreML.MultiArray)
- [CoreML.Model](scripting://doc?title=CoreML.Model)
- [生命周期与错误](scripting://doc?title=CoreML%20Lifecycle)
