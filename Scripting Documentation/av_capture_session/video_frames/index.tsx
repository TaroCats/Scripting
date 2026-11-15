import { Button, Image, Navigation, NavigationStack, Script, Text, VStack, useEffect, useRef, useState } from "scripting"

function CameraFrameDemo() {
  const dismiss = Navigation.useDismiss()
  const mounted = useRef(true)
  const active = useRef<{ session: AVCaptureSession; controller: AbortController } | null>(null)
  const [status, setStatus] = useState("Capture one frame from the camera.")
  const [image, setImage] = useState<UIImage | null>(null)
  const [busy, setBusy] = useState(false)

  function stop() {
    const capture = active.current
    if (!capture) return
    capture.controller.abort()
    void capture.session.stopRunning().catch(() => {})
  }

  useEffect(() => () => {
    mounted.current = false
    stop()
  }, [])

  async function capture() {
    if (active.current) return
    const camera = AVCaptureDevice.default("video")
    if (!camera) {
      setStatus("This device does not have a camera available.")
      return
    }
    const session = new AVCaptureSession()
    const controller = new AbortController()
    active.current = { session, controller }
    setBusy(true)
    setStatus("Starting the camera.")
    let output: AVCaptureVideoDataOutput | undefined
    try {
      const frames = new AVCaptureVideoDataOutput({ pixelFormat: "bgra8" })
      output = frames
      const input = new AVCaptureDeviceInput(camera)
      session.configure(() => {
        session.sessionPreset = "medium"
        session.addInput(input)
        session.addOutput(frames)
      })
      await session.startRunning()
      if (controller.signal.aborted) return
      const frame = await frames.nextFrame({ signal: controller.signal })
      try {
        const info = frame.info
        const pixels = frame.copyPlanes()[0]
        const snapshot = UIImage.fromPixels({ width: info.width, height: info.height,
          data: pixels.data, bytesPerRow: pixels.bytesPerRow, format: "bgra8", alphaMode: "opaque" })
        if (mounted.current) {
          setImage(snapshot)
          setStatus(`Frame ${info.sequence}, ${info.width} by ${info.height} pixels, ${info.rotationAngle} degrees${info.mirrored ? ", mirrored" : ""}.`)
        }
      } finally {
        frame.dispose()
      }
    } catch (error) {
      if (mounted.current) setStatus(controller.signal.aborted ? "Capture cancelled." : String(error))
    } finally {
      output?.dispose()
      try { await session.stopRunning() } catch {}
      session.dispose()
      active.current = null
      if (mounted.current) setBusy(false)
    }
  }

  return <NavigationStack>
    <VStack spacing={12} padding navigationTitle="Camera frame">
      <Text>{status}</Text>
      {image && <Image image={image} resizable aspectRatio={{ contentMode: "fit" }}
        accessibilityLabel="Captured camera frame" />}
      <Button title="Capture frame" disabled={busy} action={() => { void capture() }} />
      {busy && <Button title="Cancel capture" action={stop} />}
      <Button title="Done" action={dismiss} />
    </VStack>
  </NavigationStack>
}

async function run() {
  try { await Navigation.present({ element: <CameraFrameDemo /> }) }
  finally { Script.exit() }
}

void run()
