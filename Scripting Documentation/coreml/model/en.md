`Model.load(source, configuration?, options?)` accepts an absolute local `.mlmodel`, `.mlpackage` or `.mlmodelc` path, or a `ModelAsset`. Uncompiled sources are compiled as needed. Models need not be in the App bundle. Models and all visible dependencies must be readable by the script. By default, external compiled `.mlmodelc` input and linked compiled models are rejected because their private dependency references cannot be inspected. For models and dependencies you trust, pass `{ trustCompiledModels: true }` in the final options argument. A validated `ModelAsset` created by this runtime can be reused without this flag. Explicit trust does not prove dependency containment or make arbitrary compiled models safe. Loading may fail for unsupported operators, target systems, missing custom implementations or encrypted-model key retrieval; the original native error is preserved where available.

```ts
async function main() {
  const model = await CoreML.Model.load('/path/to/array-model.mlpackage', {
    computeUnits: 'all'
  })
  const input = CoreML.MultiArray.fromTypedArray(new Float32Array([1, 2, 3, 4, 5, 6]), {
    dtype: 'float32', shape: [2, 3]
  })
  try {
    if (!model.isAllowedValue('x', { type: 'multiArray', value: input })) {
      throw new Error('Input does not satisfy model constraints')
    }
    const result = await model.predict({ x: { type: 'multiArray', value: input } })
    const y = result.y
    if (y.type === 'multiArray') {
      try { console.log(y.value.shape, y.value.copyToTypedArray()) }
      finally { if (y.value !== input) y.value.dispose() }
    }
  } finally {
    input.dispose()
    model.dispose()
  }
}
main().catch(console.error)
```

Names, shapes and types in this example must match the chosen model. Read `model.description.inputs` and `.outputs` first when integrating a model. The description also includes optional features, image constraints, shape constraints, state and training features, class labels, metadata, and available parameter descriptions.

`model.isAllowedValue(name, feature, { kind? })` checks the selected input, output or training feature against its actual model constraint; kind defaults to input. Unknown feature names and malformed values throw. An allowed value does not guarantee successful inference for every model/operator/device.

`model.isWritable` reports native model-writing support. When true, `await model.save(newPath, options?)` writes to a new absolute `.mlmodelc` directory, validates the saved model and publishes without overwriting an existing destination. Other models reject with unsupported. ModelAsset is an asset handle, not a promise that every loaded model can be exported.

## Features and numeric precision

Inputs are objects keyed by model feature name. Every feature has an explicit `type`:

| Type | Value |
| --- | --- |
| `int64` | `value`: a canonical signed decimal string, for example `'9223372036854775807'`. |
| `double` | `value`: a JavaScript number; model constraints still apply. |
| `string` | `value`: a string. |
| `multiArray` | `value`: a `CoreML.MultiArray`. |
| `image` | `value`: a global `PixelBuffer` or `UIImage`. UIImage conversion uses the model's image constraint and optional `imageOptions`. |
| `dictionary` | `keyType`: `'string'` or `'int64'`; `entries`: `[key, numericValue][]`. Both key kinds use strings in JavaScript. |
| `sequence` | `elementType`: `'string'` or `'int64'`; `values`: `string[]`. |
| `undefined` | `featureType`: the underlying feature type. Valid only when allowed by the model. |

Omitting an optional input and explicitly providing an undefined feature are different operations. Outputs preserve their native feature kind. Image outputs are native PixelBuffers. Int64 values, dictionary keys, sequence entries and integer class labels remain decimal strings so that JavaScript does not round them. Dictionary entries avoid special object-key handling, including `__proto__`.

For UIImage features, `imageOptions.cropAndScale` is `'scaleFill'`, `'scaleFit'` or `'centerCrop'`; the default conversion uses scale fill. An optional `cropRect` uses normalized image coordinates with a lower-left origin. UIImage orientation is applied before conversion. This conversion does not replace model-specific normalization; do not apply preprocessing twice if it is already part of the model. See [PixelBuffer](scripting://doc?title=PixelBuffer) for explicit pixel formats and color spaces.

`predict()` includes image conversion when you supply a `UIImage`, even when its dimensions already match the model. For repeated predictions, prepare a `PixelBuffer` that matches the model's dimensions, pixel format, and preprocessing and pass it as `{ type: 'image', value: pixels }`. If your image source already supplies a compatible `PixelBuffer`, pass it directly. Scripting passes the native buffer to Core ML, which may still convert it for execution. `computeUnits` selects the processors Core ML can use. Measure image preparation, prediction with prepared inputs, and output copying separately when comparing latency.

Run the [image input demo](index.tsx) to compare both inputs and verify their output pixels.

## Related documentation

- [CoreML overview](scripting://doc?title=CoreML%20Overview)
- [CoreML.ModelAsset](scripting://doc?title=CoreML.ModelAsset)
- [CoreML.MultiArray](scripting://doc?title=CoreML.MultiArray)
- [CoreML.State](scripting://doc?title=CoreML.State)
