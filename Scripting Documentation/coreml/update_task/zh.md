`UpdateTask` 执行模型支持的端上更新。请使用具备更新能力及有效训练特征的模型；该 API 不能让任意模型变得可训练，也不能代替离线模型转换与训练工具。选择初始源模型时，可检查 `model.description.isUpdatable` 与 `.trainingInputs`。

`getUpdatedModel()` 返回的模型，其临时描述中的 `isUpdatable` 可能为 false。仍可将当前可写模型传给 `UpdateTask.create` 继续更新；原生 Core ML 会验证当前模型与训练数据是否支持该操作。不要要求该标记在更新后始终为 true。

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

任务初始为 suspended。`resume(parameters?)` 遵循原生任务语义；`cancel()` 请求取消。`description` 返回实际任务状态与错误。进度回调接收快照，并非任意异步训练数据回调。`finished` 在原生任务完成时 resolve；取消或释放会使其 reject，但不表示原生工作已经停止。save 将完成更新的模型保存到新的绝对 `.mlmodelc` 路径，并检查可重新加载，不覆盖源模型。训练资源应保持到原生任务结束。

## 相关文档

- [CoreML 概览](scripting://doc?title=CoreML%20Overview)
- [CoreML.Model](scripting://doc?title=CoreML.Model)
- [CoreML.ModelAsset](scripting://doc?title=CoreML.ModelAsset)
- [生命周期与错误](scripting://doc?title=CoreML%20Lifecycle)
