Numerical operations run asynchronously and accept `{ signal: AbortSignal }`. Buffer upload and copies are synchronous. Use the API from the main script executor.

## Inputs and outputs

TypedArray inputs are snapshotted for an operation. View offsets, strides and leading dimensions use elements, not bytes; layouts, dimensions and complete spans are checked before native access. Precision must match; implicit float32/float64 mixing and negative strides are rejected.

Explicit TypedArray and resident-buffer outputs are committed only after successful completion. Failed or cancelled work does not commit output writes. Cancellation can reject before native computation has stopped; in-flight storage remains owned until native completion. Do not mutate a supplied output while its operation is pending.

`axpy`, `scal` and copy permit input/output aliasing only for exactly matching views: the same storage, starting position, count and stride. Partial overlap and input/output overlap in other operations are rejected.

## Lifetime and limits

Dispose resident buffers when no longer needed. Handles belong to one script run and cannot be shared with another run. A buffer can be busy while native work uses it; do not use disposal to assume the underlying allocation is already free.

`getCapabilities()` returns dtypes, maximumBytes, maximumResources, maximumJobs and features. Read these values instead of assuming an unlimited resident buffer pool or queue. Limits do not promise a particular execution time.

## Errors and scope

Errors include code; linear-algebra errors may include lapackInfo. Distinguish invalid views, precision mismatch, busy/disposed resources, cancellation, resource limits, singular matrices and numerical failures.

This CPU API does not provide a complete Accelerate framework binding. FFT, complex arithmetic, sparse matrices, vImage and BNNS are outside this API. It does not create a GPU surface or guarantee a speedup for every operation.

## Related documentation

- [Accelerate overview](scripting://doc?title=Accelerate%20Overview)
- [Accelerate Buffers](scripting://doc?title=Accelerate%20Buffers)
- [Accelerate BLAS](scripting://doc?title=Accelerate%20BLAS)
- [Accelerate Linear Algebra](scripting://doc?title=Accelerate%20Linear%20Algebra)
