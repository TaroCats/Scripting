`CoreML.ModelAsset` 持有本地模型资产。函数描述查询和多函数模型的函数选择需要 iOS 18 或更新系统。

`ModelAsset.fromFile(path)` 与 `Model.compile(path)` 返回脚本持有的 `ModelAsset`。`ModelAsset.fromData(specification, { blobMapping })` 接受 Data 或 Uint8Array；须显式提供 ML Program 的全部外部 blob，名称与 specification 中的引用保持一致。内存 blobMapping 需要 iOS 18。fromData 的 options 还可使用 baseDirectory 解析相对 linked 引用，并通过 trustCompiledModels 显式信任 opaque linked compiled 模型。源选项适用于 Model.load、Model.compile、ModelAsset.fromFile、ModelAsset.load、getModelStructure、getComputePlan，与原生 ModelConfiguration 分开。若 configuration 新增了需要显式信任的 linked 模型参数覆盖，请在 `asset.load(configuration?, options?)` 的最后一个 options 参数中设置源选项。模型引用不会自动触发下载。内存资产可能使用设备上的私有编译文件，不保证整个流程完全不写磁盘。

## 函数

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

## 配置

一个模型实例在加载时选择一个函数，不同函数使用各自实例与状态。`computeUnits` 可选 `'all'`、`'cpuOnly'`、`'cpuAndGPU'`、`'cpuAndNeuralEngine'`，不保证实际使用 ANE 或特定速度。`getComputeDevices({ all: true })` 查询原生设备，返回的 GPU `id` 可用作 `preferredMetalDevice`。其他配置包括 `modelDisplayName`、`allowLowPrecisionAccumulationOnGPU`、`optimizationHints.reshapeFrequency`（iOS 17.4+）、`optimizationHints.specializationStrategy`（iOS 18+）及带显式类型的参数 entries。不支持的字段与系统版本会明确报错。

`getParameter({ name, scope? })` 查询支持的模型参数。配置与更新参数通过 `'int64'`、`'double'`、`'boolean'` 或 `'string'` 指定类型；整数参数使用十进制字符串。具体 key 与约束以 `model.description.parameters` 为准。

## 已加载模型的配置

`model.configuration` 返回实际原生配置，包括 computeUnits、可用的 optimizationHints，以及可为 null 的显示名称、函数名称和 GPU 标识。参数保留 key/scope 与带类型的数值 metadata：int64 为十进制字符串，double 为 number，boolean 为 true/false。该快照与加载时传入的配置对象分开。

## 编译缓存

`getCacheInfo(options?)` 返回包含 key、sourceName、sourceBytes、diskBytes、inUse 的缓存条目。`clearCache(options?)` 删除未使用条目并返回数量，不会使仍持有缓存租约的模型或资产失效。缓存不保证保存每个大型模型。显式信任的 opaque compiled 模型可能引用不可见的外部依赖，仅凭目录内容不足以安全复用缓存。

## 相关文档

- [CoreML 概览](scripting://doc?title=CoreML%20Overview)
- [CoreML.Model](scripting://doc?title=CoreML.Model)
- [CoreML.UpdateTask](scripting://doc?title=CoreML.UpdateTask)
- [模型检查](scripting://doc?title=CoreML%20Model%20Inspection)
- [生命周期与错误](scripting://doc?title=CoreML%20Lifecycle)
