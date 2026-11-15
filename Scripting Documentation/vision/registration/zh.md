# Vision 图像配准

`Vision.createRegistrationSession()` 在 iOS 17 或更高版本中对齐连续图像。`kind: "translation"` 估计横纵位移，`kind: "homography"` 估计透视变换。`Vision.getRegistrationCapabilities()` 可查询原生版本、默认版本、最少帧数和会话上限。分析局部区域时，可提交裁剪到同一矩形的图像，结果坐标相对于裁剪后的图像。

```ts
const session = Vision.createRegistrationSession({ kind: "translation" })
try {
  await session.process(first, { presentationTime: MediaTime.zero() })
  const results = await session.process(second, {
    presentationTime: MediaTime.make({ value: 1, timescale: 30 }),
  })
  for (const result of results) {
    if (result.kind === "translation") console.log(result.transform.tx, result.transform.ty)
  }
} finally {
  session.close()
}
```

每张 `UIImage` 都需传入 `MediaTime`。`AVCaptureVideoFrame` 自带采样时间，可选传入 `orientation`。相机帧使用 BGRA8 或 8 位 NV12。同一会话保持输入来源、图像尺寸和方向一致。相机帧应来自同一采集流并保持像素格式一致。时间必须递增，每帧处理完成后再提交下一帧。

首帧建立参照并返回空数组。后续结果保留 Vision 原生变换，将当前定向图像对齐到参照帧。平移结果包含六个仿射系数，位移单位为图像像素。单应矩阵采用列优先的 3 × 3 布局，坐标单位为图像像素。用矩阵乘以 `[x, y, 1]`，再除以结果的第三个分量。例如第二帧内容向右移动四像素时，配准的 `tx` 约为 `-4`。

更换来源或重新开始序列时调用 `reset()`。传入 `signal` 可以取消处理。处理已开始时，取消会清除参照。用完后调用 `close()`。可运行示例使用同一组生成图像展示平移和透视配准的结果。

大图出现 `resourceLimit` 时，先将序列中的图像缩小到统一分辨率。旋转图像和矢量图像可能需要额外的光栅内存。
