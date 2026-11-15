`Model.load(source, configuration?, options?)` 接受绝对本地 `.mlmodel`、`.mlpackage`、`.mlmodelc` 路径或 `ModelAsset`。未编译的源模型会按需编译，模型无需放入 App bundle。模型及全部可见依赖必须允许当前脚本读取。默认拒绝外部编译 `.mlmodelc` 及 linked compiled 模型，因为无法通过公开格式检查其私有依赖引用。仅对你信任的模型及依赖，在最后的 options 参数中传入 `{ trustCompiledModels: true }`。由此运行时从已验证源创建的 ModelAsset 可直接复用，无需该选项。显式信任不代表依赖已被证明受限，也不能让任意编译模型自动变得安全。不支持的算子、目标系统、缺少自定义实现或加密模型取密钥失败均可能导致加载失败；系统提供原生错误时会尽量保留。

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

示例中的名称、形状与类型必须与所选模型一致。接入模型时先读取 `model.description.inputs` 与 `.outputs`。描述还包含 optional 特征、图像与形状约束、状态和训练特征、类别标签、metadata 及模型参数描述。

`model.isAllowedValue(name, feature, { kind? })` 按模型实际约束检查 input、output 或 training 特征，kind 默认为 input。未知名称及格式无效的值会抛错；返回允许不代表所有模型、算子或设备上的推理必定成功。

`model.isWritable` 报告原生模型写入能力。为 true 时，`await model.save(newPath, options?)` 写入新的绝对 `.mlmodelc` 目录，验证可加载后发布，不覆盖已有目标。其他模型会以 unsupported 拒绝。ModelAsset 是资产 handle，不代表每个加载的模型都可以导出。

## 特征与数值精度

输入对象以模型特征名称为 key，每个特征显式指定 `type`：

| 类型 | 值 |
| --- | --- |
| `int64` | `value` 为规范的带符号十进制字符串，例如 `'9223372036854775807'`。 |
| `double` | `value` 为 JavaScript number，仍须满足模型约束。 |
| `string` | `value` 为字符串。 |
| `multiArray` | `value` 为 `CoreML.MultiArray`。 |
| `image` | `value` 为全局 `PixelBuffer` 或 `UIImage`。UIImage 根据模型的图像约束及可选 `imageOptions` 转换。 |
| `dictionary` | `keyType` 为 `'string'` 或 `'int64'`；`entries` 为 `[key, numericValue][]`。两种 key 在 JavaScript 中均使用字符串。 |
| `sequence` | `elementType` 为 `'string'` 或 `'int64'`；`values` 为 `string[]`。 |
| `undefined` | `featureType` 指明底层特征类型，仅可用于模型允许的缺失值。 |

省略 optional 输入与显式传入 undefined 特征是不同操作。输出保留实际原生特征类型；图像输出为原生 PixelBuffer。int64 值、字典整数 key、序列整数和整数类别标签均保留十进制字符串，避免 JavaScript number 舍入。字典采用 entries 表示，`__proto__` 等字符串也不会被当作对象的特殊属性。

UIImage 特征的 `imageOptions.cropAndScale` 可为 `'scaleFill'`、`'scaleFit'` 或 `'centerCrop'`，默认使用 scale fill。可选 `cropRect` 使用左下原点的归一化图像坐标。转换前会应用 UIImage 方向。该转换不能代替模型自身的归一化；模型中已有预处理时不要重复执行。显式像素格式与颜色空间见 [PixelBuffer](scripting://doc?title=PixelBuffer)。

传入 `UIImage` 时，`predict()` 包含图像转换，即使原图尺寸已经匹配模型。重复推理时，可以准备符合模型尺寸、像素格式和预处理要求的 `PixelBuffer`，通过 `{ type: 'image', value: pixels }` 传入。如果图像来源已经提供兼容的 `PixelBuffer`，可以直接使用。Scripting 会将原生缓冲传给 Core ML，Core ML 仍可按执行需要转换格式。`computeUnits` 指定 Core ML 可用的处理器。比较耗时时，分别测量图像准备、使用已准备输入的预测和输出复制。

运行[图像输入示例](index.tsx)，对比两种输入并核验输出像素。

## 相关文档

- [CoreML 概览](scripting://doc?title=CoreML%20Overview)
- [CoreML.ModelAsset](scripting://doc?title=CoreML.ModelAsset)
- [CoreML.MultiArray](scripting://doc?title=CoreML.MultiArray)
- [CoreML.State](scripting://doc?title=CoreML.State)
