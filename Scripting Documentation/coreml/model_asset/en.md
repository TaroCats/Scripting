`CoreML.ModelAsset` owns a local model asset. Function inspection and selecting among multiple model functions require iOS 18 or later.

`ModelAsset.fromFile(path)` and `Model.compile(path)` return an owned `ModelAsset`. `ModelAsset.fromData(specification, { blobMapping })` accepts `Data` or `Uint8Array`; supply every external ML Program blob explicitly, with reference names matching the specification. In-memory blob mapping requires iOS 18. `fromData` options also accept `baseDirectory` for relative linked references and `trustCompiledModels` for opaque linked compiled models. Source options apply to `Model.load`, `Model.compile`, `ModelAsset.fromFile`, `ModelAsset.load`, `getModelStructure` and `getComputePlan`; they are separate from native `ModelConfiguration`. Use the final options argument of `asset.load(configuration?, options?)` when configuration introduces linked-model overrides that require explicit trust. No model reference is automatically downloaded. Memory assets may use private on-device compiled files; this API does not guarantee disk-free operation.

## Functions

```ts
async function main() {
  const asset = await CoreML.ModelAsset.fromFile('/path/to/multifunction.mlpackage')
  let model: CoreML.Model | undefined
  try {
    const functions = await asset.getFunctionNames()
    console.log(functions)
    console.log(await asset.getDescription('double'))
    model = await asset.load({ functionName: 'double', computeUnits: 'cpuOnly' })
    console.log(model.description.inputs)
  } finally {
    model?.dispose()
    asset.dispose()
  }
}
main().catch(console.error)
```

## Configuration

A model instance selects one function when it loads; separate functions have separate instances and state. `computeUnits` permits `'all'`, `'cpuOnly'`, `'cpuAndGPU'` or `'cpuAndNeuralEngine'`. It does not guarantee ANE execution or a particular speed. `getComputeDevices({ all: true })` queries native devices; a returned GPU `id` can be used as `preferredMetalDevice`. Other configuration fields include `modelDisplayName`, `allowLowPrecisionAccumulationOnGPU`, `optimizationHints.reshapeFrequency` (iOS 17.4+), `optimizationHints.specializationStrategy` (iOS 18+), and typed parameter entries. Unsupported fields and OS versions fail explicitly.

`getParameter({ name, scope? })` queries supported model parameters. Configuration and update parameter values carry an explicit `'int64'`, `'double'`, `'boolean'` or `'string'` type. Use decimal strings for integer parameters. Inspect `model.description.parameters` for the model's actual keys and constraints.

## Loaded model configuration

`model.configuration` returns the actual native configuration, including compute units, optional optimization hints, and nullable display name, function name and GPU identifier. Parameters retain their key/scope and typed numeric metadata: int64 uses decimal strings, double uses numbers, and boolean uses true/false. This snapshot is separate from the configuration accepted when loading.

## Compilation cache

`getCacheInfo(options?)` returns cache rows with key, sourceName, sourceBytes, diskBytes and inUse. `clearCache(options?)` removes unused entries and returns the count; it does not invalidate models or assets still holding a cache lease. This cache does not promise to cache every large model. Explicitly trusted opaque compiled models can reference hidden external dependencies, so their directory contents alone do not justify cache reuse.

## Related documentation

- [CoreML overview](scripting://doc?title=CoreML%20Overview)
- [CoreML.Model](scripting://doc?title=CoreML.Model)
- [CoreML.UpdateTask](scripting://doc?title=CoreML.UpdateTask)
- [Model Inspection](scripting://doc?title=CoreML%20Model%20Inspection)
- [Lifecycle and Errors](scripting://doc?title=CoreML%20Lifecycle)
