Model structure and compute-plan inspection require iOS 17.4 or later. They query local model information and do not run a benchmark.

`getModelStructure(source)` returns supported Program functions/blocks/operations, neural-network layers or pipeline submodels. `getComputePlan(source, configuration?)` adds native device usage and optional estimated cost. Uninspectable values and types are explicitly `opaque`; unsupported structure remains unsupported. Cost weights are estimates, not latency measurements or proof of actual GPU/ANE use. This API does not edit model graphs or assign devices to individual operations.

Native Core ML may reject compute-plan inspection for a model that can still run predictions, including multifunction models on some systems. Such failures preserve the native error. Successful inference does not guarantee that a compute plan is available for the same model and function.

## Related documentation

- [CoreML overview](scripting://doc?title=CoreML%20Overview)
- [CoreML.ModelAsset](scripting://doc?title=CoreML.ModelAsset)
- [CoreML.Model](scripting://doc?title=CoreML.Model)
- [Lifecycle and Errors](scripting://doc?title=CoreML%20Lifecycle)
