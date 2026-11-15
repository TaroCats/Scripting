`Accelerate.fft` runs one-dimensional Fourier transforms in Float32 and Float64. Pass vector views of typed arrays or resident buffers. Each transform returns new typed arrays of the input precision.

| Function | Input and result |
| --- | --- |
| `forward` and `inverse` | Equal-length real and imaginary views. The result contains the full split complex spectrum or signal. |
| `realForward` | A real-valued signal. The result contains `floor(length / 2) + 1` nonnegative-frequency bins. |
| `realInverse` | The real and imaginary half-spectrum and the original signal `length`. The result is the reconstructed real signal. |
| `supportsLength` | Tests native support for a positive integer length with the requested `dtype` and `kind`. Defaults to `float32` and `complex`. |

The spectrum has `real`, `imaginary` and `length` fields. Bin zero is DC. For an even-length real transform, the final bin is Nyquist. `realInverse` uses zero imaginary values for DC and Nyquist. When you know the sample rate, bin `k` represents `k * sampleRate / length` in a real spectrum. The second half of a full complex spectrum uses wrapped negative frequencies.

## Normalization

| Option | Forward scale | Inverse scale |
| --- | --- | --- |
| `backward` (default) | 1 | `1 / length` |
| `forward` | `1 / length` | 1 |
| `orthonormal` | `1 / sqrt(length)` | `1 / sqrt(length)` |
| `none` | 1 | 1 |

The forward transform uses a negative exponent and the inverse uses a positive exponent. Using the same normalization in both directions reconstructs the input within numerical precision. With `none`, the reconstructed signal is multiplied by `length`.

Use `supportsLength` to check native length availability. For an unsupported length, choose a supported transform length and explicitly zero-pad if your analysis allows it. Use that length when interpreting the frequency bins. Operations honor the shared Accelerate job and byte budgets. An `AbortSignal` cancels delivery of a queued or running result. See [Accelerate Lifecycle](scripting://doc?title=Accelerate%20Lifecycle) for ownership and cancellation.

## Example

The example prints peaks at 80 Hz and 200 Hz, and reports the maximum reconstruction error.

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
