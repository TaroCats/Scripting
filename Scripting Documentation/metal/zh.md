# Metal 计算

使用全局 `Metal` API 运行 Metal 着色语言（MSL）计算内核。通过 `Metal.Device.getDefault()` 获取默认设备，没有可用的 Metal 设备时返回 `null`。通过 `device.info` 查询设备限制和非均匀线程组支持。

## 两个整数向量相加

此示例编译一个内核，提交一个线程组，再从 GPU 私有缓冲区读回四个整数。

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

## 缓冲区与字节范围

- `device.makeBuffer({ length, storageMode, data, signal })` 创建最大为 64 MiB 的驻留缓冲区，仍受设备和脚本资源限制。长度与偏移量均以字节为单位。`storageMode` 默认为 `shared`。选择 `private` 可使用 GPU 私有存储，并通过 `read` 与 `write` 传输字节。
- 缓冲区初始填充为零。可选的 `data` 从偏移量零开始初始化字节。支持 `Data` 和受支持的整数或浮点 TypedArray。TypedArray 子视图仅提供自身字节范围。
- `buffer.write(data, { offset, signal })` 从指定字节偏移量写入，默认为零。`buffer.read({ offset, length, signal })` 返回独立的 `Uint8Array`。省略长度时，读取指定偏移量之后的所有剩余字节。将字节解释为数值时，使用返回的字节偏移量和对应数值类型的元素数量创建视图。

单次传输没有另设一个比缓冲区更小的固定上限。可用的字节范围和剩余内存预算共同限制一次传输。每个脚本的 Metal 资源与临时传输共用 192 MiB 预算，最多有 8 项操作同时进行。`shared` 读回直接复制到返回的 `Uint8Array`。`private` 读回先通过 GPU 把指定字节传到暂存缓冲区。释放 Metal 缓冲区后，返回的数组仍可使用。写入时传 `Data` 可省去将 TypedArray 复制为原生快照的步骤，仍受传输预算约束。如果超出预算，可以逐个等待传输释放、释放未使用的 GPU 资源，或缩小每次传输的范围。例如在 `offset < buffer.length` 时用 `await buffer.read({ offset, length: Math.min(8 * 1024 * 1024, buffer.length - offset) })` 读取，按返回的字节数增大 `offset`。下文的 4096 字节限制只适用于内联内核绑定。

## 着色器库与计算管线

`device.compileLibrary(source, options?)` 在当前设备上编译 MSL。可以使用 `<metal_stdlib>` 等标准 Metal 头文件，将自定义函数放在源码字符串中。通过 `enableFastMath` 选择编译器的快速数学运算模式。要使用预编译着色器，通过 `device.loadLibrary(source, options?)` 加载脚本可访问的兼容 `.metallib` 路径或预编译字节。使用 `library.functionNames` 查询导出的名称，并通过 `library.makeComputePipeline(name, options?)` 选取计算内核。重复提交时可以复用计算管线。 [Apple Metal 函数与库指南](https://developer.apple.com/library/archive/documentation/3DDrawing/Conceptual/MTLBestPracticesGuide/FunctionsandLibraries.html)

## 提交计算

- 使用 `threadgroups` 指定线程组数量，或使用 `threads` 指定精确的线程网格大小。两种方式均需提供 `threadsPerThreadgroup`。每个尺寸包含 `width`，`height` 与 `depth` 默认为 1。在 `device.info.supportsNonUniformThreadgroups` 为真时使用 `threads`。如果网格覆盖的数据超出输入范围，在内核中检查索引边界。
- 通过 `pipeline.info.maxTotalThreadsPerThreadgroup` 查询管线的每组线程数上限，`pipeline.info.threadExecutionWidth` 提供原生执行宽度。绑定动态线程组内存时，提供索引与以字节计的长度。长度必须为 16 的倍数，且总长度加上管线的静态线程组内存须符合设备限制。
- 内核使用的每项缓冲区与动态线程组内存都须绑定一次。`buffers` 与内联 `bytes` 的索引对应内核中的 `[[buffer(index)]]` 声明。缓冲区偏移量以字节计，索引范围为 0 至 30，每个内联绑定最多 4096 字节。使用与内核一致的布局与对齐方式，并在内核中检查每次内存访问的边界。此提交接口支持普通缓冲区、内联值与动态线程组内存。 [Apple 计算网格尺寸指南](https://developer.apple.com/documentation/metal/calculating-threadgroup-and-grid-sizes)

在 iOS 18 或更高版本上，使用 [RealityKit Metal 纹理计算](scripting://doc?title=RealityKit%20Metal%20Texture%20Compute)运行包含纹理绑定的内核。

多条命令使用同一个管线时，可调用 `pipeline.dispatchBatch({ commands, signal })`。传入 1 到 32 条命令，每条使用与 `dispatch()` 相同的参数；可选取消信号设在批次上。命令按顺序执行，可以读取前一条写入的缓冲区。总线程数最多为 67,108,864，按整组提交时计入线程组内的全部线程。整批在提交前完成校验，等待批次会等到 GPU 完成。批次可以减少提交次数，但不保证 GPU 并行执行。运行示例在同一批次执行两次相互依赖的向量加法。

## 完成与释放

提交 GPU 工作时请保持 App 在前台，包括调用 `dispatch()` 和读写 `private` 缓冲区。通过 `scripting-ts` 运行不会获得后台 GPU 权限。App 进入后台后，Metal 可能拒绝提交；请捕获错误并回到前台后再继续。原生错误可能包含 Metal 的 `notPermitted` 错误码。`shared` 缓冲区的 CPU 复制不提交 GPU 命令，iOS 暂停 App 后也不能保证脚本继续运行。[Apple 后台 GPU 指南](https://developer.apple.com/documentation/metal/preparing-your-metal-app-to-run-in-the-background)

等操作完成后再复用缓冲区。如果读取、写入或计算使用了正在占用的缓冲区，将返回 `resourceBusy`。可传入 `signal` 取消操作。已经提交到 GPU 的命令即使在脚本停止等待后，也可能完成并写入缓冲区。原生失败会提供失败的 `phase`，并可能包含 `nativeDomain` 与 `nativeCode`。使用结束后释放缓冲区、着色器库与管线。运行示例会以文字显示确切的整数结果。

需要共享 Float16 或 BGRA8 纹理时，参见 [Metal PixelBuffer 纹理](scripting://doc?title=Metal%20PixelBuffer%20Textures)。

实时相机帧的共享视图用法见 [Metal 相机纹理](scripting://doc?title=Metal%20Camera%20Textures)。
