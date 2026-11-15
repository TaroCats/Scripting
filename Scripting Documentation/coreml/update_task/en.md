`UpdateTask` performs the on-device updates supported by a model. Use a model with updating support and valid training features; this does not make arbitrary models trainable or replace offline model conversion and training tools. Inspect `model.description.isUpdatable` and `.trainingInputs` when choosing an initial source model.

A model returned by `getUpdatedModel()` can report `isUpdatable: false` in its temporary description. You can pass that current writable model to `UpdateTask.create` for a subsequent update; native Core ML validates whether the model and training data support the operation. Do not require this flag to remain true after an update.

```ts
async function main() {
  const model = await CoreML.Model.load('/path/to/updatable_knn.mlmodel')
  const x = CoreML.MultiArray.fromTypedArray(new Float32Array([2]), {
    dtype: 'float32', shape: [1]
  })
  let task: CoreML.UpdateTask | undefined
  let updated: CoreML.Model | undefined
  try {
    task = await CoreML.UpdateTask.create(model, [{
      x: { type: 'multiArray', value: x },
      label: { type: 'string', value: 'owned-new' }
    }], { events: ['trainingBegin', 'epochEnd'] })
    task.onProgress = progress => console.log(progress.event, progress.metrics)
    task.resume()
    await task.finished
    updated = task.getUpdatedModel()
    await task.save('/path/to/new-updated.mlmodelc')
    console.log(updated.description.isUpdatable)
  } finally {
    updated?.dispose()
    task?.dispose()
    x.dispose()
    model.dispose()
  }
}
main().catch(console.error)
```

Tasks start suspended. `resume(parameters?)` uses native task semantics; `cancel()` requests cancellation. `description` reports the actual task state/error. Progress handlers receive snapshots; they are not an arbitrary asynchronous training-data callback. `finished` resolves on native completion; cancellation or disposal rejects it without promising that native work has already stopped. Save writes a completed update to a new absolute `.mlmodelc` path and verifies that it loads; it does not overwrite the source model. Keep training resources alive until the native task is finished.

## Related documentation

- [CoreML overview](scripting://doc?title=CoreML%20Overview)
- [CoreML.Model](scripting://doc?title=CoreML.Model)
- [CoreML.ModelAsset](scripting://doc?title=CoreML.ModelAsset)
- [Lifecycle and Errors](scripting://doc?title=CoreML%20Lifecycle)
