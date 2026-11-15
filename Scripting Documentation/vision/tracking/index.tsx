import { Button, Image, Navigation, NavigationStack, Script, ScrollView, Text, VStack, useEffect, useRef, useState } from "scripting"

const side = 192
const seed = { x: 36 / side, y: 64 / side, width: 72 / side, height: 64 / side }

function imageAt(offset: number) {
  const pixels = new Uint8Array(side * side * 4)
  function fill(x: number, y: number, width: number, height: number, rgb: [number, number, number]) {
    for (let row = side - y - height; row < side - y; ++row) {
      for (let column = x; column < x + width; ++column) {
        const index = (row * side + column) * 4
        pixels[index] = rgb[0]
        pixels[index + 1] = rgb[1]
        pixels[index + 2] = rgb[2]
        pixels[index + 3] = 255
      }
    }
  }
  fill(0, 0, side, side, [13, 18, 25])
  fill(36 + offset, 64, 72, 64, [242, 242, 229])
  for (let row = 0; row < 6; ++row) {
    for (let column = 0; column < 7; ++column) {
      if ((row * 11 + column * 7) % 5 < 3) fill(41 + offset + column * 9, 68 + row * 9, 6, 7, [51, 102, 25])
    }
  }
  return UIImage.fromRGBA(side, side, pixels)
}

function TrackingDemo() {
  const dismiss = Navigation.useDismiss()
  const active = useRef<AbortController | null>(null)
  const tracker = useRef<Vision.TrackingSession | null>(null)
  const step = useRef(0)
  const mounted = useRef(true)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<UIImage | null>(null)
  const [status, setStatus] = useState("Track a patterned rectangle as it moves right.")

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      active.current?.abort()
      tracker.current?.close()
    }
  }, [])

  async function next() {
    if (active.current) return
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    try {
      let session = tracker.current
      if (!session) {
        session = Vision.createTrackingSession()
        tracker.current = session
        session.addObject(seed)
        session.addRectangle({
          topLeft: { x: seed.x, y: seed.y + seed.height },
          topRight: { x: seed.x + seed.width, y: seed.y + seed.height },
          bottomRight: { x: seed.x + seed.width, y: seed.y },
          bottomLeft: { x: seed.x, y: seed.y },
        })
      }
      const image = imageAt(step.current * 4)
      const results = await session.process(image, { signal: controller.signal })
      if (mounted.current) {
        const positions = results.map(row => {
          const point = row.observation?.boundingBox.x
          return point === undefined ? `${row.kind} unavailable` : `${row.kind} starts at ${Math.round(point * side)} pixels`
        })
        setPreview(image)
        setStatus(`Frame ${step.current + 1}. ${positions.join(". ")}.`)
      }
      step.current += 1
      if (step.current === 8) {
        session.close()
        tracker.current = null
        step.current = 0
      }
    } catch (error) {
      tracker.current?.close()
      tracker.current = null
      step.current = 0
      if (mounted.current) setStatus(controller.signal.aborted ? "Tracking cancelled." : String(error))
    } finally {
      active.current = null
      if (mounted.current) setBusy(false)
    }
  }

  return <NavigationStack>
    <ScrollView navigationTitle="Vision tracking">
      <VStack spacing={12} padding>
        <Text>{status}</Text>
        {preview && <Image image={preview} resizable scaleToFit frame={{ maxHeight: 192 }} accessibilityLabel="Patterned rectangle in the current frame" />}
        <Button title="Track next frame" disabled={busy} action={() => { void next() }} />
        {busy && <Button title="Cancel tracking" action={() => active.current?.abort()} />}
        <Button title="Done" action={dismiss} />
      </VStack>
    </ScrollView>
  </NavigationStack>
}

async function run() {
  try { await Navigation.present({ element: <TrackingDemo /> }) }
  finally { Script.exit() }
}

void run()
