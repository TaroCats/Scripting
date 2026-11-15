`Accelerate.fft` 支持 Float32 和 Float64 的一维傅里叶变换。输入使用 TypedArray 或驻留缓冲的向量视图。每次变换都会返回与输入精度相同的新 TypedArray。

| 函数 | 输入与结果 |
| --- | --- |
| `forward` 与 `inverse` | 传入等长的实部和虚部视图，返回分开存储实部与虚部的完整频谱或时域信号。 |
| `realForward` | 传入实数信号，返回 `floor(length / 2) + 1` 个非负频率点。 |
| `realInverse` | 传入半频谱的实部、虚部及原始信号 `length`，返回重建后的实数信号。 |
| `supportsLength` | 查询原生实现是否支持指定的正整数长度，可选 `dtype` 和 `kind`，默认分别为 `float32` 和 `complex`。 |

频谱包含 `real`、`imaginary` 和 `length`。第 0 个频率点是直流分量。偶数长度的实数变换中，最后一个频率点为奈奎斯特频率。`realInverse` 将直流和奈奎斯特分量的虚部视为零。已知采样率时，实数频谱第 `k` 点的频率为 `k * sampleRate / length`。完整复数频谱的后半段按索引回绕表示负频率。

## 归一化

| 选项 | 正变换缩放 | 逆变换缩放 |
| --- | --- | --- |
| `backward`（默认） | 1 | `1 / length` |
| `forward` | `1 / length` | 1 |
| `orthonormal` | `1 / sqrt(length)` | `1 / sqrt(length)` |
| `none` | 1 | 1 |

正变换使用负指数，逆变换使用正指数。正反变换采用同一归一化选项时，可在数值精度范围内重建输入。使用 `none` 时，重建结果会乘以 `length`。

用 `supportsLength` 查询原生支持的长度。分析允许补零时，可把不支持的长度补到支持的长度，计算频率时使用补零后的长度。运算遵守 Accelerate 的任务数与字节上限。`AbortSignal` 可取消排队或正在运行的结果交付。资源所有权和取消行为见 [Accelerate 生命周期](scripting://doc?title=Accelerate%20Lifecycle)。

## 示例

示例输出 80 Hz 和 200 Hz 两个频谱峰，并报告重建的最大误差。

```ts
const length = 128
const sampleRate = 1024
const samples = Float64Array.from({ length }, (_, i) =>
  Math.sin(2 * Math.PI * 80 * i / sampleRate) + 0.4 * Math.cos(2 * Math.PI * 200 * i / sampleRate)
)
const spectrum = await Accelerate.fft.realForward({ real: { data: samples, count: length } })
const peaks = Array.from(spectrum.real, (real, index) => ({
  frequency: index * sampleRate / length,
  magnitude: Math.hypot(real, spectrum.imaginary[index]),
})).sort((a, b) => b.magnitude - a.magnitude).slice(0, 2)
const reconstructed = await Accelerate.fft.realInverse({
  length: spectrum.length,
  real: { data: spectrum.real, count: spectrum.real.length },
  imaginary: { data: spectrum.imaginary, count: spectrum.imaginary.length },
})
console.log(`Peak frequencies: ${peaks.map(peak => peak.frequency).join(", ")} Hz`)
console.log(`Maximum reconstruction error: ${Math.max(...samples.map((sample, i) =>
  Math.abs(sample - reconstructed[i])
))}`)
```
