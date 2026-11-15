import { Button, Image, Navigation, NavigationStack, Script, Text, VStack } from "scripting"

const side = 320

function imageAt(step: number, points?: readonly { x: number; y: number }[]): UIImage {
  const pixels = new Uint8Array(side * side * 4)
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = 8
    pixels[index + 1] = 10
    pixels[index + 2] = 15
    pixels[index + 3] = 255
  }
  function circle(x: number, y: number, radius: number, color: readonly number[]) {
    const col = Math.round(x), row = side - 1 - Math.round(y)
    for (let dy = -radius; dy <= radius; ++dy) {
      for (let dx = -radius; dx <= radius; ++dx) {
        if (dx * dx + dy * dy > radius * radius || col + dx < 0 || col + dx >= side || row + dy < 0 || row + dy >= side) continue
        const index = ((row + dy) * side + col + dx) * 4
        pixels[index] = color[0]
        pixels[index + 1] = color[1]
        pixels[index + 2] = color[2]
      }
    }
  }
  if (step >= 4 && step <= 26) {
    const t = step - 4
    circle(31 + 11 * t, 35 + 13 * t - 0.56 * t * t, 5, [245, 176, 46])
  }
  for (const point of points ?? []) circle(point.x * side, point.y * side, 4, [56, 215, 226])
  const image = UIImage.fromRGBA(side, side, pixels)
  if (!image) throw Error("Unable to create trajectory frame.")
  return image
}

function TrajectoryDemo({ image, result }: { image: UIImage; result: Vision.TrajectoryObservation }) {
  const dismiss = Navigation.useDismiss()
  const { a, b, c } = result.equationCoefficients
  return <NavigationStack>
    <VStack padding spacing={12} navigationTitle="Vision trajectory">
      <Image image={image} resizable scaleToFit frame={{ maxHeight: 300 }} accessibilityLabel="Yellow ball and blue fitted trajectory points" />
      <Text>{`${result.detectedPoints.length} measured positions over ${result.timeRange.duration.seconds.toFixed(2)} seconds.`}</Text>
      <Text>{`Equation coefficients a ${a.toFixed(3)}, b ${b.toFixed(3)}, c ${c.toFixed(3)}.`}</Text>
      <Button title="Done" action={dismiss} />
    </VStack>
  </NavigationStack>
}

async function run() {
  try {
    const session = Vision.createTrajectorySession({ trajectoryLength: 8, objectMinimumNormalizedRadius: 0.007, objectMaximumNormalizedRadius: 0.05 })
    let result: Vision.TrajectoryObservation | undefined
    let step = 0
    try {
      for (; step < 24; ++step) {
        const [trajectory] = await session.process(imageAt(step), { presentationTime: MediaTime.make({ value: step, timescale: 30 }) })
        if (trajectory) { result = trajectory; break }
      }
    } finally {
      session.close()
    }
    if (!result) throw Error("Vision did not detect the sample trajectory.")
    console.log("Vision trajectory ready", result.detectedPoints.length, result.timeRange.duration.seconds)
    await Navigation.present({ element: <TrajectoryDemo image={imageAt(step, result.projectedPoints)} result={result} /> })
  } catch (error) {
    console.error(error)
  } finally {
    Script.exit()
  }
}

void run()
