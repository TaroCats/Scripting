`Accelerate.linearAlgebra` accepts nonempty MatrixViews of matching float32 or float64 precision. All input values must be finite. Input matrices remain unchanged. Solutions are contiguous, row-major TypedArrays with explicit rows, columns and info.

## solve

`solve({ a, b, signal? })` solves `a * x = b`. Matrix a must be square; b has the same number of rows and may contain multiple right-hand-side columns. The solution has a.columns rows and b.columns columns.

A singular matrix rejects with `code: 'singularMatrix'` and `lapackInfo`; it does not return a fabricated solution.

## leastSquares

`leastSquares({ a, b, rcond?, signal? })` uses SVD to solve least squares, including underdetermined, overdetermined and rank-deficient systems. b.rows must equal a.rows. The result includes solution, rows, columns, info, rank and singularValues. The solution has a.columns rows; singularValues has min(a.rows, a.columns) elements.

The optional rcond controls the relative singular-value threshold used to determine rank. When omitted, the native solver uses its default machine-precision cutoff. Rank deficiency returns a rank value; it is not automatically an error. Nonconvergence rejects with `code: 'numericalFailure'` and `lapackInfo`. Inspect the actual rank and error instead of assuming every matrix is full rank.

## Example

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

## Related documentation

- [Accelerate overview](scripting://doc?title=Accelerate%20Overview)
- [Accelerate Buffers](scripting://doc?title=Accelerate%20Buffers)
- [Accelerate Lifecycle](scripting://doc?title=Accelerate%20Lifecycle)
