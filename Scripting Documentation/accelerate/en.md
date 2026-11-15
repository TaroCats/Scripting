The global `Accelerate` API provides CPU vector operations, BLAS matrix operations, linear-system solving, least squares and Fourier transforms with float32 and float64 data. Use it without importing `scripting`.

Numerical operations return Promises. Use TypedArrays for copied inputs or resident FloatBuffer/DoubleBuffer storage for data reused across calls. Check `Accelerate.getCapabilities()` for the available features and limits.

## Topics

| API | Contents |
| --- | --- |
| [Accelerate Buffers](scripting://doc?title=Accelerate%20Buffers) | Resident float32/float64 data, upload, copies and disposal. |
| [Accelerate BLAS](scripting://doc?title=Accelerate%20BLAS) | Matrix/vector views and precision-specific BLAS operations. |
| [Accelerate Vector](scripting://doc?title=Accelerate%20Vector) | Elementwise arithmetic, functions and reductions. |
| [Accelerate Linear Algebra](scripting://doc?title=Accelerate%20Linear%20Algebra) | Linear systems, least squares, rank and numerical errors. |
| [Accelerate Fourier Transforms](scripting://doc?title=Accelerate%20Fourier%20Transforms) | Real and complex transforms, normalization and supported lengths. |
| [Accelerate Lifecycle](scripting://doc?title=Accelerate%20Lifecycle) | Snapshots, output commits, overlap, cancellation and limits. |

## Related documentation

- [CoreML.MultiArray](scripting://doc?title=CoreML.MultiArray)
- [CoreML.Tensor](scripting://doc?title=CoreML.Tensor)
