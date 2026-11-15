import { Button, Image, Navigation, NavigationStack, Script, ScrollView, Text, VStack, useEffect, useRef, useState } from "scripting"

function CameraPixelsDemo() {
  const dismiss = Navigation.useDismiss()
  const active = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<UIImage | null>(null)
  const [status, setStatus] = useState("Capture one frame to copy and resize its pixels.")

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      active.current?.abort()
    }
  }, [])

  async function captureFrame() {
    if (active.current) return
    const camera = AVCaptureDevice.default("video")
    if (!camera) {
      setStatus("No camera is available on this device.")
      return
    }
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    setStatus("Waiting for a camera frame.")
    let session: AVCaptureSession | undefined
    let output: AVCaptureVideoDataOutput | undefined
    try {
      const capture = new AVCaptureSession()
      session = capture
      const frames = new AVCaptureVideoDataOutput({ pixelFormat: "nv12VideoRange" })
      output = frames
      const input = new AVCaptureDeviceInput(camera)
      capture.configure(() => {
        capture.sessionPreset = "medium"
        capture.addInput(input)
        capture.addOutput(frames)
      })
      await capture.startRunning()
      const frame = await frames.nextFrame({ signal: controller.signal })
      let native: PixelBuffer | undefined
      let resized: PixelBuffer | undefined
      try {
        try {
          native = PixelBuffer.fromCaptureFrame(frame)
          const width = 224
          const height = Math.max(1, Math.round(width * frame.info.height / frame.info.width))
          resized = PixelBuffer.fromCaptureFrame(frame, { format: "bgra8", width, height })
        } finally {
          frame.dispose()
        }
        if (mounted.current) {
          setPreview(resized.toImage())
          setStatus(`Copied ${native.description.format}, ${native.description.width} × ${native.description.height}. Preview is BGRA, ${resized.description.width} × ${resized.description.height}.`)
        }
      } finally {
        native?.dispose()
        resized?.dispose()
      }
    } catch (error) {
      if (mounted.current) setStatus(controller.signal.aborted ? "Capture cancelled." : String(error))
    } finally {
      output?.dispose()
      try { await session?.stopRunning() } catch {}
      session?.dispose()
      active.current = null
      if (mounted.current) setBusy(false)
    }
  }

  return <NavigationStack>
    <ScrollView navigationTitle="Camera pixels">
      <VStack spacing={12} padding>
        <Text>{status}</Text>
        {preview && <Image image={preview} resizable scaleToFit frame={{ maxHeight: 240 }} accessibilityLabel="Copied camera frame" />}
        <Button title="Capture frame" disabled={busy} action={() => { void captureFrame() }} />
        {busy && <Button title="Cancel capture" action={() => active.current?.abort()} />}
        <Button title="Done" action={dismiss} />
      </VStack>
    </ScrollView>
  </NavigationStack>
}

async function run() {
  try { await Navigation.present({ element: <CameraPixelsDemo /> }) }
  finally { Script.exit() }
}

void run()
