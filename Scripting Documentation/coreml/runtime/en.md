## Cancellation and disposal

Async operations accept `{ signal: AbortSignal }`. Cancellation rejects the operation; it does not prove that the hardware has stopped. In-flight native storage remains retained until native completion. Dispose unused arrays, images, models, assets, state, updates and tensors explicitly with `dispose()`. Handles belong to one script run and cannot be passed to another run. Disposed resources fail on subsequent access; cleanup remains possible after cancellation.

## Capabilities and limits

Queue, object and managed memory limits are available in capabilities. The memory specification/blob snapshot limit is 256 MiB; file snapshots have a separate 4 GiB disk limit. These limits do not impose a 256 MiB hard cap on native model working memory. Capabilities also report updates, tensorComputation, computePlans, modelStructure, tensorDTypes, maximumActiveUpdates (8), and maximumTrainingBatchSize (4096); available modules/dtypes follow the running OS. `maximumMemorySnapshotBytes`, `maximumDiskSnapshotBytes` and `compiledModelPolicy` report these boundaries.

## Errors

Errors carry a `code`, with `nativeDomain`, `nativeCode` and `cause` when supplied by the system. Distinguish cancellation, invalid features or state, unavailable versions, resource limits and native model failures; inspect the error instead of retrying every failure with a different compute configuration.

## Scope

This CoreML namespace does not provide live camera-frame capture, Vision CoreML requests or ARKit tracking. It loads local models and does not download missing models, install arbitrary native custom layers, convert formats or quantize models.

## Related documentation

- [CoreML overview](scripting://doc?title=CoreML%20Overview)
- [CoreML.ModelAsset](scripting://doc?title=CoreML.ModelAsset)
- [CoreML.State](scripting://doc?title=CoreML.State)
- [CoreML.Tensor](scripting://doc?title=CoreML.Tensor)
