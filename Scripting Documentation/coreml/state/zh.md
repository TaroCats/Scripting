iOS 18+ 可通过 `model.makeState()` 创建绑定到当前模型及函数实例的状态，再传给 `predict(inputs, { state })`。`state.copyBuffer(name)` 返回独立 MultiArray；`writeBuffer(name, data)` 将逻辑值复制到指定状态缓冲。原生推理过程中禁止读取、写入或重置状态。共享同一状态的推理按顺序执行。失败或取消可能已推进原生状态，再次使用前应 `reset()`；reset 创建全新状态，不代表回滚上次运算。

`predictBatch(inputs)` 保留输入顺序，一次返回整批结果。不接受用一个共享 State 或 outputBackings 模拟原生 stateful batch。

单次推理的 `outputBackings` 将输出名映射到形状与类型匹配的 MultiArray 或 PixelBuffer。Core ML 可能选择其他分配；比较返回资源对象与传入 backing 的身份可判断是否实际复用。输入与可写 backing 不能共享重叠存储，不同 wrapper 指向相同存储也遵循同一规则。原生使用中的资源在完成前不能修改或拷出。不保证零拷贝或强制复用。

## 相关文档

- [CoreML 概览](scripting://doc?title=CoreML%20Overview)
- [CoreML.Model](scripting://doc?title=CoreML.Model)
- [CoreML.MultiArray](scripting://doc?title=CoreML.MultiArray)
- [生命周期与错误](scripting://doc?title=CoreML%20Lifecycle)
