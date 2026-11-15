import { Script } from "scripting"

async function main() {
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
}

main().catch(error => console.error(error)).finally(() => Script.exit())
