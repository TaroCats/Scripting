import { Button, Image, Navigation, NavigationStack, Script, ScrollView, Text, VStack, useEffect, useRef, useState } from "scripting"

function findDepthCamera() {
  const cameras = AVCaptureDevice.discoverySession({
    deviceTypes: ["builtInTrueDepthCamera", "builtInLiDARDepthCamera", "builtInDualCamera", "builtInDualWideCamera", "builtInTripleCamera"],
    mediaType: "video",
  }).devices
  for (const camera of cameras) {
    const videoFormat = camera.formats
      .filter(format => format.supportedDepthDataFormats.length > 0)
      .sort((a, b) => Math.abs(a.width - 960) - Math.abs(b.width - 960))[0]
    if (videoFormat) return { camera, videoFormat }
  }
}

async function start(session: AVCaptureSession, signal: AbortSignal) {
  signal.throwIfAborted()
  let onAbort: (() => void) | undefined
  try {
    const cancelled = new Promise<never>((_, reject) => {
      onAbort = () => reject(signal.reason)
      signal.addEventListener("abort", onAbort)
    })
    await Promise.race([cancelled, session.startRunning()])
  } finally {
    if (onAbort) signal.removeEventListener("abort", onAbort)
  }
}

function SynchronizedDepthDemo() {
  const dismiss = Navigation.useDismiss()
  const mounted = useRef(false)
  const active = useRef<{ controller: AbortController; session?: AVCaptureSession } | null>(null)
  const [status, setStatus] = useState("Capture a video frame with its matching depth map.")
  const [image, setImage] = useState<UIImage | null>(null)
  const [busy, setBusy] = useState(false)

  function cancelAndRelease() {
    const capture = active.current
    capture?.controller.abort()
    capture?.session?.dispose()
  }

  useEffect(() => {
    mounted.current = true
    console.log("Synchronized depth demo ready")
    return () => {
      mounted.current = false
      cancelAndRelease()
    }
  }, [])

  async function capture() {
    if (active.current) return
    const controller = new AbortController()
    const capture: { controller: AbortController; session?: AVCaptureSession } = { controller }
    active.current = capture
    setBusy(true)
    setImage(null)
    setStatus("Looking for a depth camera.")
    let output: AVCaptureSynchronizedVideoDepthOutput | undefined
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 12_000)
    try {
      const choice = findDepthCamera()
      if (!choice) {
        setStatus("No camera with synchronized depth is available on this device.")
        return
      }
      const { camera, videoFormat } = choice
      const captureSession = new AVCaptureSession()
      capture.session = captureSession
      const input = new AVCaptureDeviceInput(camera)
      const frames = new AVCaptureSynchronizedVideoDepthOutput({ pixelFormat: "bgra8", filteringEnabled: false })
      output = frames
      captureSession.configure(() => {
        if (!captureSession.canAddInput(input)) throw Error("Cannot attach the depth camera.")
        captureSession.addInput(input)
        camera.setActiveFormat(videoFormat)
        const depthFormat = camera.activeFormat.supportedDepthDataFormats[0]
        if (!depthFormat) throw Error("The active video format has no matching depth format.")
        captureSession.setActiveDepthDataFormat(input, depthFormat)
        captureSession.addOutput(frames)
      })
      setStatus("Waiting for a synchronized video and depth frame.")
      await start(captureSession, controller.signal)
      while (true) {
        const pair = await frames.nextFrame({ signal: controller.signal })
        try {
          const { videoFrame: video, depthFrame: depth } = pair
          if (!video || !depth) continue
          const info = depth.info
          const float32 = info.unit === "meters" ? "depthFloat32" : "disparityFloat32"
          const depthFormat = info.availableFormats.includes(float32) ? float32 : info.pixelFormat
          const map = depth.copyMap({ format: depthFormat })
          const bytes = map.data.toUint8Array()
          if (!bytes) throw Error("The captured depth pixels could not be read.")
          const sampleBytes = map.bytesPerRow / map.width
          const center = Math.floor(map.height / 2) * map.bytesPerRow + Math.floor(map.width / 2) * sampleBytes
          const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
          const value = sampleBytes === 4 ? view.getFloat32(center, true) : decodeHalf(view.getUint16(center, true))
          const units = map.unit === "meters" ? "meters" : "inverse meters"
          const measurement = Number.isFinite(value) ? `${value.toFixed(3)} ${units}` : "unavailable"
          const { width, height } = video.info
          const [plane] = video.copyPlanes()
          const snapshot = UIImage.fromPixels({ width, height, data: plane.data, bytesPerRow: plane.bytesPerRow,
            format: "bgra8", alphaMode: "opaque" })
          if (mounted.current) {
            setImage(snapshot)
            setStatus(`Captured a ${map.width} by ${map.height} depth map. Center sample ${measurement}. ${map.accuracy} accuracy.`)
          }
          return
        } finally {
          pair.dispose()
        }
      }
    } catch (error) {
      if (mounted.current) {
        setStatus(timedOut ? "No synchronized pair arrived in time." : controller.signal.aborted ? "Capture cancelled." : String(error))
      }
    } finally {
      clearTimeout(timeout)
      output?.dispose()
      if (mounted.current) {
        try { await capture.session?.stopRunning() } catch {}
      }
      capture.session?.dispose()
      active.current = null
      if (mounted.current) setBusy(false)
    }
  }

  return <NavigationStack>
    <ScrollView navigationTitle="Synchronized depth">
      <VStack spacing={12} padding>
        <Text>{status}</Text>
        {image && <Image image={image} resizable aspectRatio={{ contentMode: "fit" }}
          accessibilityLabel="Video frame captured with the depth map" />}
        <Button title="Capture video and depth" controlSize="large" disabled={busy} action={() => { void capture() }} />
        {busy && <Button title="Cancel capture" controlSize="large" action={() => active.current?.controller.abort()} />}
        <Button title="Done" controlSize="large" action={() => { cancelAndRelease(); dismiss() }} />
      </VStack>
    </ScrollView>
  </NavigationStack>
}

function decodeHalf(bits: number) {
  const sign = bits & 0x8000 ? -1 : 1
  const exponent = (bits >> 10) & 0x1f
  const fraction = bits & 0x3ff
  if (exponent === 31) return fraction === 0 ? sign * Infinity : NaN
  if (exponent === 0) return sign * fraction * 2 ** -24
  return sign * (1 + fraction / 1024) * 2 ** (exponent - 15)
}

async function run() {
  try { await Navigation.present({ element: <SynchronizedDepthDemo /> }) }
  finally { Script.exit() }
}

void run()
