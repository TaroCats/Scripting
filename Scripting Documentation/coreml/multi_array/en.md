`MultiArray.create`, `fromTypedArray` and `fromData` allocate native storage. Dtypes are `float16`, `float32`, `float64`, `int32`, and iOS 26+ `int8`. Match the TypedArray to the dtype: `Uint16Array` for float16 **raw IEEE 754 half bits**, `Float32Array`, `Float64Array`, `Int32Array` or `Int8Array`. `Data` is raw native element bytes with an explicit dtype and shape; float16 input is not a Uint16 numeric conversion.

`shape`, `strides`, `dtype` and `count` describe the actual native array. Strides count elements; count counts logical values, excluding row padding. Custom destination strides require iOS 18. Source bytes passed to the factories or `write` contain tightly packed logical values in C order, even when the destination has custom strides. The bridge checks sizes and rejects overlapping writable layouts.

Use `get(indices)`, `set(indices, value)`, `write(data)`, `fill(value)`, `converted(dtype)` and `MultiArray.concatenate(arrays, { axis, dtype })`. `sliced(ranges)` makes an independent logical copy that keeps rank: provide one `{ start, count, step? }` per axis; count and step must be at least 1, with step defaulting to 1. It supports every MultiArray dtype and does not expose a live native pointer. `copyToTypedArray()` and `copyToData()` explicitly copy logical values to JavaScript; they omit native padding. Outputs can stay native and be passed directly to another prediction. `pixelBuffer` and `MultiArray.fromPixelBuffer(pixel, shape)` expose compatible native image storage; this is not a generic conversion between all image and array formats.

Use the default strides for contiguous data in logical row-major order. This allows bulk copies when moving data in or out. Custom strides preserve the logical order when copying, including when rows contain padding or an axis is stored in a different order.

## int8 compatibility

int8 storage availability does not guarantee that a particular model accepts int8 inputs or outputs on the selected system and compute units. Prediction preserves the native Core ML error instead of silently changing the model's dtype.

## Related documentation

- [CoreML overview](scripting://doc?title=CoreML%20Overview)
- [CoreML.Model](scripting://doc?title=CoreML.Model)
- [CoreML.Tensor](scripting://doc?title=CoreML.Tensor)
- [PixelBuffer](scripting://doc?title=PixelBuffer)
