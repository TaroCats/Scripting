import { Button, Navigation, NavigationStack, Picker, Script, Text, VStack, useEffect, useRef, useState } from "scripting"

function CameraVisionDemo() {
  const dismiss = Navigation.useDismiss()
  const mounted = useRef(true)
  const active = useRef<AbortController | null>(null)
  const [orientation, setOrientation] = useState<Vision.FrameOrientation>("up")
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState("Keep a person or hand in view, then analyze a camera frame.")

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      active.current?.abort()
    }
  }, [])

  async function analyze() {
    if (active.current) return
    const camera = AVCaptureDevice.default("video")
    if (!camera) {
      setStatus("No camera is available on this device.")
      return
    }
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    setStatus("Starting the camera and analyzing a frame.")
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
      const signal = controller.signal
      const frame = await frames.nextFrame({ signal })
      try {
        const sequence = frame.info.sequence
        const observations = await Vision.perform(frame, [
          Vision.Request.faces(), Vision.Request.bodyPose(), Vision.Request.handPose(),
        ], { orientation, signal })
        const count = (kind: Vision.RequestKind) => observations.find(result => result.kind === kind)?.observations.length ?? 0
        if (mounted.current) {
          setStatus(`Frame ${sequence}. Faces ${count("faces")}. Body poses ${count("bodyPose")}. Hands ${count("handPose")}.`)
        }
      } finally {
        frame.dispose()
      }
    } catch (error) {
      if (mounted.current) setStatus(controller.signal.aborted ? "Analysis cancelled." : String(error))
    } finally {
      output?.dispose()
      try { await session?.stopRunning() } catch {}
      session?.dispose()
      active.current = null
      if (mounted.current) setBusy(false)
    }
  }

  return <NavigationStack>
    <VStack spacing={12} padding navigationTitle="Camera Vision">
      <Picker title="Analysis direction" value={orientation} disabled={busy}
        onChanged={(value: string) => setOrientation(value as Vision.FrameOrientation)}>
        <Text tag="up">As captured</Text>
        <Text tag="right">Rotate right</Text>
        <Text tag="left">Rotate left</Text>
        <Text tag="down">Rotate 180 degrees</Text>
      </Picker>
      <Text>{status}</Text>
      <Button title="Analyze camera frame" disabled={busy} action={() => { void analyze() }} />
      {busy && <Button title="Cancel analysis" action={() => active.current?.abort()} />}
      <Button title="Done" action={dismiss} />
    </VStack>
  </NavigationStack>
}

async function run() {
  try { await Navigation.present({ element: <CameraVisionDemo /> }) }
  finally { Script.exit() }
}

void run()
