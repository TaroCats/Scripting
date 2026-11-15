`Accelerate.FloatBuffer` 存储 float32，`Accelerate.DoubleBuffer` 存储 float64。两者属于一次脚本运行，构造函数不公开。

## 创建与上传

`create(length)` 按元素数量分配存储。`from(data)` 复制对应的 Float32Array、Float64Array 或原始 Data。Data 必须包含所选精度的完整 IEEE 754 元素，不会将整数字节值自动转换为浮点数。

`length` 是元素数，`byteLength` 是字节数。`upload(data, { offset? })` 从指定元素偏移写入匹配的输入值；offset 默认为 0，全部输入必须落在缓冲范围内。不能混合 float32 与 float64 输入。

## 读取与释放

`copyToTypedArray({ offset?, count? })` 返回独立且精度匹配的 TypedArray；`copyToData` 拷出原始元素字节。范围以元素为单位，不是字节；省略范围时选择整个缓冲。拷贝不暴露实时原生指针。

使用完毕后调用 `dispose()`。已释放 handle 不能再次使用；在途运算仍需使用的存储会保留到原生运算结束。

## 示例

```ts
const source = Accelerate.DoubleBuffer.from(new Float64Array([1, 2, 3]))
const copy = Accelerate.DoubleBuffer.from(source.copyToData())
try {
  copy.upload(new Float64Array([10]), { offset: 1 })
  console.log(copy.copyToTypedArray({ offset: 1, count: 2 }))
} finally {
  copy.dispose()
  source.dispose()
}
```

## 相关文档

- [Accelerate 概览](scripting://doc?title=Accelerate%20Overview)
- [BLAS](scripting://doc?title=Accelerate%20BLAS)
- [生命周期与错误](scripting://doc?title=Accelerate%20Lifecycle)
