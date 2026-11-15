On iOS 18+, `Tensor.fromTypedArray` / `fromData` create native computation objects. Tensor supports float16/float32, bool, signed and unsigned 8/16/32-bit integers; these differ from MultiArray dtypes. Bool input uses Uint8Array bytes 0 or 1; float16 uses Uint16Array raw half bits. Operations require compatible dtypes/shapes and follow the specific native operator's supported types. Matrix multiplication and mean require float16/float32; abs, sign and square require numeric dtypes. Bool min, max and product remain available. Bool sum/cumulativeSum reject because native systems disagree on their representation; cast to int32 for counts or use any for a logical OR. Materialization uses `await tensor.copyToTypedArray()` or `copyToData()`.

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

Factories include `full(shape, value, { dtype?, computeUnits? })`, `zeros`, `ones`, `randomNormal`, `randomUniform`, `range` and `linspace`; `concatenate(tensors, axis?)` and `stack(tensors, axis?)` combine tensors. Random seeds are canonical unsigned 64-bit decimal strings. Normal random values and linspace use float16/float32. Uniform random and range also support signed/unsigned integer dtypes: uniform float bounds exclude the upper value, while integer bounds include both ends. Range excludes its end; linspace includes its endpoints. Explicit `computeUnits` uses the native computation policy rather than promising a particular device.

| Operation | Arguments and result |
| --- | --- |
| `split`, `unstack` | `split({ axis?, sizes?, count? })` or `unstack(axis?)` returns Tensor arrays. |
| `topK` | `topK(k)` returns `{ values, indices }` tensors. |
| `slice` | An array of `{ type: 'all' }`, `newAxis`, `squeeze`, `index` with `index`, or `range` with `start`, `end`, optional `stride`. |
| `gather`, `gatherND`, `scatter` | Await these methods: they validate materialized int32 indices in the background and return Promise&lt;Tensor&gt;. Optional axis for gather/scatter; all accept a signal. Scatter also takes a replacement tensor. |
| `replaceWhere` | A bool mask and a replacement tensor. |
| `pad` | Per-axis `[before, after]` pairs; mode `constant`, `reflection` or `symmetric`, with an optional constant value. |
| `resized` | `height`, `width`, optional `nearestNeighbor`/`bilinear` method and `alignCorners`. |
| `clamp`, `bandPart` | Numeric lower/upper limits, or native lower/upper matrix-band sizes. |
| `toMultiArray` | Async native array materialization, with optional output dtype and signal. |

Named operations also include arithmetic/comparisons, matrix multiplication, floating-point math, logical bool operations, reshape/transpose, reductions, cumulative sums/products and sorting. `MultiArray.toTensor()` creates a native tensor from a compatible array. `model.predictTensors(inputs, { state?, signal? })` accepts and returns named native Tensor dictionaries on iOS 18+. It does not substitute for scalar, image, dictionary or sequence feature conversion. Use the current TypeScript declarations for each operation's options. Tensors do not provide autograd, arbitrary native shader compilation or a guarantee that every dtype is accepted by every operator.

## Related documentation

- [CoreML overview](scripting://doc?title=CoreML%20Overview)
- [CoreML.MultiArray](scripting://doc?title=CoreML.MultiArray)
- [CoreML.Model](scripting://doc?title=CoreML.Model)
- [Lifecycle and Errors](scripting://doc?title=CoreML%20Lifecycle)
