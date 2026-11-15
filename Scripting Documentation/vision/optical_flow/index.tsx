import { Button, Image, Navigation, NavigationStack, Script, Text, VStack } from "scripting"

const width = 192
const height = 160

function imageAt(step: number): UIImage {
  const bytes = new Uint8Array(width * height * 4)
  function fill(x: number, y: number, w: number, h: number, r: number, g: number, b: number) {
    for (let row = height - y - h; row < height - y; ++row) {
      for (let col = x; col < x + w; ++col) {
        const index = (row * width + col) * 4
        bytes[index] = r
        bytes[index + 1] = g
        bytes[index + 2] = b
        bytes[index + 3] = 255
      }
    }
  }
  fill(0, 0, width, height, 13, 18, 25)
  for (let y = 0; y < 12; ++y) {
    for (let x = 0; x < 13; ++x) {
      if ((y * 17 + x * 7) % 13 < 7) {
        fill(22 + step * 4 + x * 10, 22 + step * 2 + y * 9, 6, 7, 40 + ((x + y) % 6) * 30, 76 + ((x * y) % 7) * 16, 51)
      }
    }
  }
  const image = UIImage.fromRGBA(width, height, bytes)
  if (!image) throw Error("Unable to create the example frame.")
  return image
}

function FlowDemo({ image, info, vector }: { image: UIImage; info: Vision.OpticalFlowFieldInfo; vector: { x: number; y: number } }) {
  const dismiss = Navigation.useDismiss()
  return <NavigationStack>
    <VStack padding spacing={12} navigationTitle="Vision optical flow">
      <Image image={image} resizable scaleToFit frame={{ maxHeight: 240 }} accessibilityLabel="Pattern shifted four pixels right and two pixels up" />
      <Text>{`Flow field ${info.width} by ${info.height}. ${info.componentFormat}.`}</Text>
      <Text>{`Center vector x ${vector.x.toFixed(2)}, y ${vector.y.toFixed(2)}.`}</Text>
      <Button title="Done" action={dismiss} />
    </VStack>
  </NavigationStack>
}

async function run() {
  try {
    const first = imageAt(0), second = imageAt(1)
    const session = Vision.createOpticalFlowSession({ accuracy: "low", format: "float16" })
    let info: Vision.OpticalFlowFieldInfo
    let vector: { x: number; y: number }
    try {
      await session.process(first, { presentationTime: MediaTime.zero() })
      const [result] = await session.process(second, { presentationTime: MediaTime.make({ value: 1, timescale: 30 }) })
      if (!result) throw Error("Vision did not return an optical-flow field.")
      const field = result.field
      try {
        info = field.info
        vector = field.vectorAt(Math.floor(info.width / 2), Math.floor(info.height / 2))
      } finally { field.dispose() }
    } finally { session.close() }
    console.log("Vision optical flow ready", info.width, info.height, vector.x, vector.y)
    await Navigation.present({ element: <FlowDemo image={second} info={info} vector={vector} /> })
  } catch (error) {
    console.error(error)
  } finally {
    Script.exit()
  }
}

void run()
