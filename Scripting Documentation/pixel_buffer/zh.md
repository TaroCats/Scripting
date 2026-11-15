全局 `PixelBuffer` 类为模型输入、输出及 outputBackings 持有原生图像存储，无需从 `scripting` 导入。推理见 [CoreML](scripting://doc?title=CoreML)；普通 UIImage 像素的创建与读取见 [UIImage](scripting://doc?title=UIImage)。

参见 [PixelBuffer 更新与显示](scripting://doc?title=PixelBuffer%20Updates%20and%20Display)，了解如何创建 NV12 平面、更新局部像素并提交显示快照。

使用[PixelBuffer 相机帧](scripting://doc?title=PixelBuffer%20Camera%20Frames)为模型准备实时相机像素。

## 创建缓冲

`PixelBuffer.create({ width, height, format?, data?, bytesPerRow?, colorSpace? })` 创建缓冲。宽高以像素为单位，format 默认为 `'bgra8'`，颜色空间默认为 `'sRGB'`。未提供 data 时初始化为零。

| 格式 | 原始像素 |
| --- | --- |
| `bgra8` | 每像素四字节，顺序为蓝、绿、红、alpha。 |
| `gray8` | 每像素一字节。 |
| `gray16Float` | 每像素一个 IEEE 754 half 值，以两字节原始位存储。 |

`data` 接受 Data、Uint8Array 或 Uint16Array 原始字节。Uint16Array 保存位模式，不会自动转换成 half 数值。`bytesPerRow` 描述输入行布局，不能小于紧密排列的行字节数。提供 data 时，其字节数必须正好为 `bytesPerRow * height`；输入行填充不会复制进像素。返回缓冲的原生行 stride 可能不同。

```ts
const pixels = PixelBuffer.create({
  width: 2, height: 1, format: 'bgra8',
  data: new Uint8Array([0, 0, 255, 255, 0, 255, 0, 255])
})
try {
  console.log(pixels.description)
  const plane = pixels.copyPlanes()[0]
  console.log(plane.bytesPerRow, plane.data)
} finally {
  pixels.dispose()
}
```

## 转换图像

`PixelBuffer.fromImage(image, { width?, height?, format?, colorSpace? })` 应用 UIImage 方向，可选缩放到指定尺寸并渲染进原生存储。省略的宽高保留方向变换后的像素尺寸。缩放会填满目标矩形；需要其他裁剪/缩放策略时，先裁剪图像或使用模型的 image feature options。颜色空间可选 `'sRGB'` 或 `'displayP3'`。

```ts
const image = UIImage.fromFile('/path/to/photo.jpg')
if (image) {
  const pixels = PixelBuffer.fromImage(image, {
    width: 224, height: 224, format: 'bgra8', colorSpace: 'sRGB'
  })
  try {
    const preview = pixels.toImage()
    console.log(preview.width, preview.height)
  } finally {
    pixels.dispose()
  }
}
```

## 检查与拷出

`description` 返回宽、高、format、原生 `pixelFormatCode` 及各 plane 的实际尺寸与行 stride。原生模型输出可能使用其他格式，此时报告 `format: 'native:<code>'`，仍可作为原生推理资源继续使用。

`copyPlanes()` 为支持的 plane 返回紧密排列的 Uint8Array 字节。`copyPlanes({ dataType: 'data' })` 改为返回 Data。每项包含 `width`、`height`、紧密行 `bytesPerRow` 及 `data`。拷出不包含原生行填充，也不暴露缓冲内的实时指针。half plane 仍导出原始字节，不是 Float32Array。原始拷出与 `toImage()` 仅支持上表格式，其他格式明确报错。

`toImage()` 渲染出新的 UIImage。这是颜色渲染转换，不保证逐位保留任意 HDR 值或全部附件，也不提供持续更新的 GPU 视图。

`CoreML.MultiArray.fromPixelBuffer(pixels, shape)` 与 `array.pixelBuffer` 暴露兼容格式的共享原生存储。float16 路径使用 `gray16Float`，iOS 26+ 还支持用 `gray8` 存储 int8 数组。shape 最后一维等于宽，其余各维乘积等于高，例如宽 4、高 6 时可用 `[2, 3, 4]`。它不能转换到任意数组 dtype。共享 wrapper 与原始存储遵循相同的在途访问及别名约束。

## 所有权

不再使用时请 dispose。传给原生推理的缓冲会保留到原生完成，包括 Promise 取消或 `dispose()` 之后。读、写和 outputBacking 不能与相同存储的在途访问冲突。handle 属于一次脚本运行。分配失败、无效布局、不支持的格式与资源超限均通过错误报告；可用 `CoreML.getCapabilities()` 查询当前上限。

需要共享 Float16 或 BGRA8 纹理时，参见 [Metal PixelBuffer 纹理](scripting://doc?title=Metal%20PixelBuffer%20Textures)。
