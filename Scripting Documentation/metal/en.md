# Metal compute

The global `Metal` API runs Metal Shading Language (MSL) compute kernels. Get the default device with `Metal.Device.getDefault()`. It returns `null` when a Metal device is unavailable. Use `device.info` to inspect the device's limits and support for nonuniform threadgroups.

## Add two integer vectors

This example compiles a kernel, submits one threadgroup and reads four integers from a private GPU buffer.

```ts
const device = Metal.Device.getDefault()
if (device) {
  const resources: Array<{ dispose(): void }> = []
  try {
    const library = await device.compileLibrary(`
#include <metal_stdlib>
using namespace metal;
kernel void add_vectors(device const uint *a [[buffer(0)]],
                        device const uint *b [[buffer(1)]],
                        device uint *out [[buffer(2)]],
                        constant uint &count [[buffer(3)]],
                        uint i [[thread_position_in_grid]]) {
  if (i < count) out[i] = a[i] + b[i];
}
`)
    resources.push(library)
    const pipeline = await library.makeComputePipeline('add_vectors')
    resources.push(pipeline)

    const left = new Uint32Array([2, 7, 4, 9])
    const right = new Uint32Array([4, 3, 8, 2])
    const a = await device.makeBuffer({ length: left.byteLength, data: left })
    resources.push(a)
    const b = await device.makeBuffer({ length: right.byteLength, data: right })
    resources.push(b)
    const out = await device.makeBuffer({ length: left.byteLength, storageMode: 'private' })
    resources.push(out)

    await pipeline.dispatch({
      threadgroups: { width: 1 },
      threadsPerThreadgroup: { width: left.length },
      buffers: [{ index: 0, buffer: a }, { index: 1, buffer: b }, { index: 2, buffer: out }],
      bytes: [{ index: 3, data: new Uint32Array([left.length]) }],
    })
    const bytes = await out.read()
    const result = new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / Uint32Array.BYTES_PER_ELEMENT)
    console.log(Array.from(result)) // [6, 10, 12, 11]
  } finally {
    for (const resource of resources.reverse()) resource.dispose()
  }
}
```

## Buffers and byte ranges

- `device.makeBuffer({ length, storageMode, data, signal })` creates a resident buffer of up to 64 MiB, within device and script limits. Length and offsets count bytes. `storageMode` defaults to `shared`. Choose `private` for GPU-only storage and use `read` and `write` to transfer its bytes.
- Buffers start filled with zeroes. The optional `data` initializes bytes starting at offset zero. Supply `Data` or a supported integer or floating-point TypedArray. A TypedArray subview supplies only its own byte range.
- `buffer.write(data, { offset, signal })` writes at a byte offset that defaults to zero. `buffer.read({ offset, length, signal })` returns an independent `Uint8Array`. With no length, it reads the remaining bytes from the chosen offset. To interpret the bytes as numbers, create a view using the returned byte offset and the element count for your numeric type.

There is no separate fixed per-transfer limit below the buffer size. The available range and remaining memory budget limit each transfer. A script's Metal resources and temporary transfers share 192 MiB, with up to 8 operations in progress. A `shared` read copies directly into the returned `Uint8Array`. A `private` read first transfers the requested bytes to a staging buffer on the GPU. The returned array remains usable after the Metal buffer is disposed. Passing `Data` can avoid copying a TypedArray into a native snapshot for a write; it still uses the transfer budget. If a transfer exceeds the remaining budget, await transfers one at a time, release unused GPU resources, or use smaller byte ranges. For example, read a large buffer with `await buffer.read({ offset, length: Math.min(8 * 1024 * 1024, buffer.length - offset) })` while `offset < buffer.length`; advance `offset` by the returned byte count. The 4096-byte limit below applies only to inline kernel bindings.

## Libraries and pipelines

`device.compileLibrary(source, options?)` compiles MSL on the current device. Use standard Metal headers such as `<metal_stdlib>` and place custom functions in the source string. Pass `enableFastMath` to choose the compiler's fast math behavior. For precompiled shaders, call `device.loadLibrary(source, options?)` with a compatible local `.metallib` path or its bytes. Use `library.functionNames` to inspect the exported names and `library.makeComputePipeline(name, options?)` to select a compute kernel. Keep a pipeline for repeated dispatches. [Apple's guide to Metal functions and libraries](https://developer.apple.com/library/archive/documentation/3DDrawing/Conceptual/MTLBestPracticesGuide/FunctionsandLibraries.html)

## Dispatch work

- Supply either `threadgroups` for the number of groups or `threads` for the exact grid size. Both require `threadsPerThreadgroup`. Each size specifies `width`, with `height` and `depth` defaulting to 1. Use `threads` on devices with `device.info.supportsNonUniformThreadgroups`. When a grid covers more elements than your input, guard those indices in the kernel.
- Check `pipeline.info.maxTotalThreadsPerThreadgroup` for the pipeline's group-size limit. `pipeline.info.threadExecutionWidth` gives the native execution width. For a dynamic threadgroup memory binding, supply its index and length in bytes. Lengths must be multiples of 16. The total must fit the device's limit alongside the pipeline's static threadgroup memory.
- Supply every used buffer and dynamic threadgroup binding exactly once. Match `buffers` and inline `bytes` to the kernel's `[[buffer(index)]]` declarations. Buffer offsets are byte offsets. Indices range from 0 through 30. Inline bytes are limited to 4096 bytes per binding. Use the same layout and alignment as your kernel, including bounds on every memory access. This dispatch API supports plain buffers, inline values and dynamic threadgroup memory. [Apple's guide to compute grid sizes](https://developer.apple.com/documentation/metal/calculating-threadgroup-and-grid-sizes)

Use [RealityKit Metal Texture Compute](scripting://doc?title=RealityKit%20Metal%20Texture%20Compute) to dispatch kernels with texture bindings on iOS 18 or later.

Use `pipeline.dispatchBatch({ commands, signal })` when several commands use the same pipeline. Pass 1 to 32 command objects with the same fields as `dispatch()`; supply the optional cancellation signal on the batch. Commands run in order and may read a buffer that an earlier command wrote. The total thread limit is 67,108,864, including all threads in whole threadgroups. The entire list is validated before it is submitted; awaiting the batch waits for GPU completion. A batch reduces submissions; it does not guarantee parallel GPU execution. Run Demo chains two additions in a single batch.

## Completion and cleanup

Keep the App in the foreground while submitting GPU work. This applies to `dispatch()` and transfers to or from `private` buffers. Running through `scripting-ts` does not grant background GPU access. If the App moves into the background and Metal rejects a command, catch the error and resume from the foreground. Command errors may include the native Metal `notPermitted` code. CPU copies through `shared` buffers don't submit GPU commands but can't keep an app running while iOS suspends it. [Apple's background GPU guidance](https://developer.apple.com/documentation/metal/preparing-your-metal-app-to-run-in-the-background)

Await completion before reusing a buffer. A read, write or dispatch that uses a buffer already in use rejects with `resourceBusy`. Pass an abort `signal` to cancel an operation. A command already submitted to the GPU can finish and write to its buffers even when the script stops awaiting it. Native failures include the failing `phase` and may include `nativeDomain` and `nativeCode`. Dispose buffers, libraries and pipelines when finished. Run Demo shows the exact integer result as text.

See [Metal PixelBuffer Textures](scripting://doc?title=Metal%20PixelBuffer%20Textures) for shared Float16 or BGRA8 texture views.

See [Metal Camera Textures](scripting://doc?title=Metal%20Camera%20Textures) for zero-copy views of live camera frames.
