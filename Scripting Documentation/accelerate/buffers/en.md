`Accelerate.FloatBuffer` stores float32 values; `Accelerate.DoubleBuffer` stores float64 values. Both are owned by one script run and use private constructors.

## Create and upload

`create(length)` allocates the given number of elements. `from(data)` copies a matching Float32Array or Float64Array, or raw `Data`. Data must contain whole IEEE 754 elements of the selected precision; it does not convert integer byte values to floating-point numbers.

`length` counts elements; `byteLength` counts bytes. `upload(data, { offset? })` writes matching input values starting at an element offset. The destination offset defaults to 0; inputs must fit inside the buffer. Float32 and float64 inputs cannot be mixed.

## Read and dispose

`copyToTypedArray({ offset?, count? })` returns an independent matching TypedArray. `copyToData` copies raw element bytes. Ranges use elements, not bytes; omitted ranges select the entire buffer. Copies do not expose a live native pointer.

Call `dispose()` when finished. A disposed handle cannot be used again; storage still needed by in-flight work remains retained until that work completes.

## Example

```ts
const source = Accelerate.DoubleBuffer.from(new Float64Array([1, 2, 3]))
const copy = Accelerate.DoubleBuffer.from(source.copyToData())
try {
  copy.upload(new Float64Array([10]), { offset: 1 })
  console.log(copy.copyToTypedArray({ offset: 1, count: 2 }))
} finally {
  copy.dispose()
  source.dispose()
}
```

## Related documentation

- [Accelerate overview](scripting://doc?title=Accelerate%20Overview)
- [Accelerate BLAS](scripting://doc?title=Accelerate%20BLAS)
- [Accelerate Lifecycle](scripting://doc?title=Accelerate%20Lifecycle)
