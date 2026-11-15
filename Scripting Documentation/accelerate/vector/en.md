`Accelerate.vector` applies elementwise operations and reductions. Precision follows input a: all views must use float32 or all must use float64. The overloads accept matching TypedArrays and resident buffers.

## Operations

| Methods | Inputs |
| --- | --- |
| `add`, `subtract`, `multiply`, `divide` | a and b; computes the elementwise operation. |
| `multiplyAdd` | a, b and c; computes `a * b + c` elementwise. |
| `abs`, `square`, `sqrt`, `exp`, `log`, `sin`, `cos`, `tanh` | a. |
| `reduce` | a and operation: `sum`, `mean`, `min`, `max` or `sumSquares`; returns a number. |

All inputs are VectorViews with matching counts. Elementwise methods accept optional out; a supplied destination must match the input precision/count, and the result is that exact data object. Without out, the result is a contiguous new TypedArray. Every method accepts signal. Input/output overlap is rejected; use a separate destination.

Empty vectors are allowed. `sum` and `sumSquares` return 0 for empty input; `mean`, `min` and `max` reject empty input.

## Example

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

## Related documentation

- [Accelerate overview](scripting://doc?title=Accelerate%20Overview)
- [Accelerate Buffers](scripting://doc?title=Accelerate%20Buffers)
- [Accelerate Lifecycle](scripting://doc?title=Accelerate%20Lifecycle)
