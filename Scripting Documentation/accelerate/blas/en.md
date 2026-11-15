BLAS names retain their precision prefix: `s` uses Float32Array/FloatBuffer; `d` uses Float64Array/DoubleBuffer. All operands in one operation must have matching precision.

## Views

A `VectorView32` or `VectorView64` is `{ data, count, offset?, stride? }`. Offset and stride count elements. Offset defaults to 0 and stride to 1; stride must be positive. The requested span must fit the data.

A `MatrixView32` or `MatrixView64` is `{ data, rows, columns, layout?, leadingDimension?, offset? }`. Rows and columns describe the stored matrix before transpose. Layout defaults to `rowMajor`; the other option is `columnMajor`. Leading dimension counts elements between stored rows or columns and defaults to the contiguous dimension. Padding is allowed when the whole span fits. Negative strides and overlapping writable layouts are rejected.

## Operations

| Methods | Calculation |
| --- | --- |
| `sgemv`, `dgemv` | `y = alpha * op(a) * x + beta * y`; optional `transpose`. |
| `sgemm`, `dgemm` | `c = alpha * op(a) * op(b) + beta * c`; optional `transposeA` and `transposeB`. |
| `saxpy`, `daxpy` | `y = alpha * x + y`; writes y. |
| `sscal`, `dscal` | `x = alpha * x`; writes x; alpha is required. |
| `scopy`, `dcopy` | Copies x to optional out. |
| `sdot`, `ddot` | Dot product of x and y; returns a number. |

Use the TypeScript option objects for each method. GEMV/GEMM accept alpha and beta; a nonzero beta requires an explicit y/c. Vector counts and matrix dimensions must match the operation after transpose.

Empty vectors and empty matrix multiplication are allowed when their dimensions agree. View ranges still must be valid.

When an explicit destination is supplied, the Promise returns its `data` object, including any padding and elements outside the written view. Without a destination, copy/GEMV/GEMM return a new contiguous TypedArray; allocated GEMM output uses row-major order. All methods accept `signal`. See lifecycle rules for overlap and commit behavior.

## Example

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

## Related documentation

- [Accelerate overview](scripting://doc?title=Accelerate%20Overview)
- [Accelerate Buffers](scripting://doc?title=Accelerate%20Buffers)
- [Accelerate Lifecycle](scripting://doc?title=Accelerate%20Lifecycle)
