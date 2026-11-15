import { Button, Image, Navigation, NavigationStack, Script, Text, VStack } from "scripting"

const width = 216
const height = 184

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
    for (let x = 0; x < 15; ++x) {
      if ((y * 17 + x * 7) % 13 < 7) {
        fill(24 + step * 4 + x * 10, 24 + step * 3 + y * 10, 6, 7, 40 + ((y + x) % 6) * 30, 76 + ((y * x) % 7) * 16, 51)
      }
    }
  }
  const result = UIImage.fromRGBA(width, height, bytes)
  if (!result) throw Error("Unable to create example image.")
  return result
}

function RegistrationDemo({ first, second, status }: { first: UIImage; second: UIImage; status: string }) {
  const dismiss = Navigation.useDismiss()
  return <NavigationStack>
    <VStack padding spacing={12} navigationTitle="Image registration">
      <Image image={first} resizable scaleToFit frame={{ maxHeight: 160 }} accessibilityLabel="Reference pattern" />
      <Image image={second} resizable scaleToFit frame={{ maxHeight: 160 }} accessibilityLabel="Pattern moved right and up" />
      <Text>{status}</Text>
      <Button title="Done" action={dismiss} />
    </VStack>
  </NavigationStack>
}

async function run() {
  try {
    const first = imageAt(0), second = imageAt(1)
    const translation = Vision.createRegistrationSession()
    let homography: Vision.RegistrationSession | undefined
    let status: string
    try {
      homography = Vision.createRegistrationSession({ kind: "homography" })
      await translation.process(first, { presentationTime: MediaTime.zero() })
      await homography.process(first, { presentationTime: MediaTime.zero() })
      const options = { presentationTime: MediaTime.make({ value: 1, timescale: 30 }) }
      const [offset] = await translation.process(second, options)
      const [warp] = await homography.process(second, options)
      if (offset?.kind !== "translation" || warp?.kind !== "homography" || Math.abs(offset.transform.tx + 4) > 1) {
        throw Error("The shifted pattern could not be aligned.")
      }
      status = `Translation x ${offset.transform.tx.toFixed(2)}, y ${offset.transform.ty.toFixed(2)} pixels. Perspective x ${warp.matrix[6].toFixed(2)}, y ${warp.matrix[7].toFixed(2)} pixels.`
      console.log("Vision registration ready", status)
    } finally {
      translation.close()
      homography?.close()
    }
    await Navigation.present({ element: <RegistrationDemo first={first} second={second} status={status} /> })
  } catch (error) {
    console.error(error)
  } finally {
    Script.exit()
  }
}

void run()
