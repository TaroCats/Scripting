import { Button, Navigation, NavigationStack, SampleBufferView, Script, Text, VStack, useEffect, useRef, useState } from "scripting"

const width = 160
const height = 96

type DisplayResources = {
  pixels: PixelBuffer
  renderer: AVSampleBufferDisplayLayer
  clock: AVSampleBufferRenderSynchronizer
}

function makePatch(color: "red" | "blue") {
  const bytes = new Uint8Array(56 * 56 * 4)
  for (let index = 0; index < bytes.length; index += 4) {
    bytes[index] = color === "blue" ? 255 : 0
    bytes[index + 2] = color === "red" ? 255 : 0
    bytes[index + 3] = 255
  }
  return bytes
}

function PixelDisplayDemo() {
  const dismiss = Navigation.useDismiss()
  const active = useRef<DisplayResources | null>(null)
  const [renderer, setRenderer] = useState<AVSampleBufferDisplayLayer | null>(null)
  const [message, setMessage] = useState("Choose a color for the square.")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let pixels: PixelBuffer | undefined
    let display: AVSampleBufferDisplayLayer | undefined
    let clock: AVSampleBufferRenderSynchronizer | undefined
    try {
      const background = new Uint8Array(width * height * 4)
      for (let index = 0; index < background.length; index += 4) {
        background[index] = 38
        background[index + 1] = 38
        background[index + 2] = 38
        background[index + 3] = 255
      }
      pixels = PixelBuffer.create({ width, height, data: background })
      display = new AVSampleBufferDisplayLayer()
      clock = new AVSampleBufferRenderSynchronizer()
      clock.addRenderer(display)
      clock.setRate(1, MediaTime.zero())
      active.current = { pixels, renderer: display, clock }
      setRenderer(display)
    } catch (error) {
      setMessage(String(error))
    }
    return () => {
      active.current = null
      display?.dispose()
      clock?.dispose()
      pixels?.dispose()
    }
  }, [])

  async function update(color: "red" | "blue") {
    const resources = active.current
    if (!resources || busy) return
    setBusy(true)
    try {
      resources.pixels.writePlanes([{ plane: 0, x: 52, y: 20, width: 56, height: 56, data: makePatch(color) }])
      const delay = MediaTime.make({ value: 1, timescale: 30 })
      await resources.renderer.enqueuePixelBuffer(resources.pixels, resources.clock.currentTime.plus(delay))
      if (active.current === resources) setMessage(`${color === "red" ? "Red" : "Blue"} square submitted.`)
    } catch (error) {
      if (active.current === resources) setMessage(String(error))
    } finally {
      if (active.current === resources) setBusy(false)
    }
  }

  return <NavigationStack>
    <VStack spacing={12} padding navigationTitle="PixelBuffer display">
      {renderer && <SampleBufferView renderer={renderer} frame={{ height: 180 }} accessibilityLabel="Pixel buffer preview" />}
      <Text>{message}</Text>
      <Button title="Show red square" disabled={!renderer || busy} action={() => { void update("red") }} />
      <Button title="Show blue square" disabled={!renderer || busy} action={() => { void update("blue") }} />
      <Button title="Done" action={dismiss} />
    </VStack>
  </NavigationStack>
}

async function run() {
  try { await Navigation.present({ element: <PixelDisplayDemo /> }) }
  finally { Script.exit() }
}

void run()
