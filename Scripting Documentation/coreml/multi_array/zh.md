`MultiArray.create`、`fromTypedArray` 和 `fromData` 分配原生存储。dtype 包括 `float16`、`float32`、`float64`、`int32`，以及 iOS 26+ 的 `int8`。TypedArray 必须匹配 dtype：float16 对应保存 **IEEE 754 half 原始位** 的 `Uint16Array`，其余分别对应 `Float32Array`、`Float64Array`、`Int32Array`、`Int8Array`。Data 包含原始元素字节，并须显式指定 dtype 与 shape；传入 Uint16 数值不会自动转换成半精度浮点。

`shape`、`strides`、`dtype`、`count` 描述实际原生数组。stride 以元素为单位，count 为逻辑元素数，不包含行填充。自定义目标 strides 需要 iOS 18。即使目标存在自定义 strides，工厂方法或 `write` 接收的源字节仍应为按 C 顺序紧密排列的逻辑值。桥接会检查尺寸并拒绝可写存储重叠的布局。

可使用 `get(indices)`、`set(indices, value)`、`write(data)`、`fill(value)`、`converted(dtype)` 和 `MultiArray.concatenate(arrays, { axis, dtype })`。`sliced(ranges)` 返回保持 rank 的独立逻辑拷贝：每轴传入一个 `{ start, count, step? }`，count、step 均至少为 1，step 默认 1。该方法支持全部 MultiArray dtype，不暴露实时原生指针。`copyToTypedArray()` 与 `copyToData()` 显式拷出逻辑值，不包含原生行填充。输出可保留在原生侧，直接作为下一个模型的输入。`pixelBuffer` 与 `MultiArray.fromPixelBuffer(pixel, shape)` 提供兼容格式的共享存储入口，并非任意图像与数组格式间的通用转换。

数据按逻辑行优先顺序连续摆放时，可以使用默认步幅，一次复制整段数据。自定义步幅下，复制仍按逻辑顺序进行，包括带行填充或改变了轴存储顺序的数组。

## int8 兼容性

可创建 int8 存储，不代表特定模型在当前系统与计算单元上一定支持 int8 输入或输出。推理会保留 Core ML 的原始错误，不会静默改变模型 dtype。

## 相关文档

- [CoreML 概览](scripting://doc?title=CoreML%20Overview)
- [CoreML.Model](scripting://doc?title=CoreML.Model)
- [CoreML.Tensor](scripting://doc?title=CoreML.Tensor)
- [PixelBuffer](scripting://doc?title=PixelBuffer)
