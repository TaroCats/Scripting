import { Button, Navigation, NavigationStack, Script, Text, VStack, useEffect, useRef, useState } from "scripting"

const source = `
#include <metal_stdlib>
using namespace metal;
kernel void inspect_nv12(texture2d<float,access::read> luma [[texture(0)]],
                         texture2d<float,access::read> chroma [[texture(1)]],
                         device uint *out [[buffer(0)]]) {
  uint2 p(luma.get_width()/2,luma.get_height()/2);
  out[0] = uint(round(luma.read(p).r*255));
  float2 cbcr = chroma.read(p/2).rg;
  out[1] = uint(round(cbcr.x*255));
  out[2] = uint(round(cbcr.y*255));
}
`

function CameraTextureDemo() {
  const dismiss = Navigation.useDismiss()
  const active = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState("Capture one frame to read its center Y, Cb and Cr values on the GPU.")
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; active.current?.abort() }
  }, [])

  async function capture() {
    if (active.current) return
    const device = Metal.Device.getDefault()
    const camera = AVCaptureDevice.default("video")
    if (!device || !camera) { setStatus("A Metal device and camera are required."); return }
    const abort = new AbortController()
    active.current = abort
    const { signal } = abort
    const resources: { dispose(): void }[] = []
    let session: AVCaptureSession | undefined
    let output: AVCaptureVideoDataOutput | undefined
    setBusy(true)
    try {
      setStatus("Preparing the Metal kernel.")
      const library = await device.compileLibrary(source, { signal })
      resources.push(library)
      const pipeline = await library.makeComputePipeline("inspect_nv12", { signal })
      resources.push(pipeline)
      const buffer = await device.makeBuffer({ length: 12, signal })
      resources.push(buffer)
      const capture = new AVCaptureSession()
      const frames = new AVCaptureVideoDataOutput({ pixelFormat: "nv12VideoRange" })
      session = capture
      output = frames
      capture.configure(() => {
        capture.sessionPreset = "medium"
        capture.addInput(new AVCaptureDeviceInput(camera))
        capture.addOutput(frames)
      })
      if (signal.aborted) return
      setStatus("Waiting for a camera frame.")
      await capture.startRunning()
      const frame = await frames.nextFrame({ signal })
      try {
        const y = device.makeTextureView({ cameraFrame: frame, plane: 0 })
        resources.push(y)
        const uv = device.makeTextureView({ cameraFrame: frame, plane: 1 })
        resources.push(uv)
        const read = pipeline.dispatch({
          threadgroups: { width: 1 }, threadsPerThreadgroup: { width: 1 },
          textures: [{ index: 0, texture: y }, { index: 1, texture: uv }], buffers: [{ index: 0, buffer }], signal,
        })
        frame.dispose()
        await read
      } finally { frame.dispose() }
      const bytes = await buffer.read({ signal })
      const [y, cb, cr] = new Uint32Array(bytes.buffer, bytes.byteOffset, 3)
      if (mounted.current && !signal.aborted) setStatus(`Center pixel: Y ${y}, Cb ${cb}, Cr ${cr}.`)
    } catch (error) {
      if (mounted.current) setStatus(signal.aborted ? "Capture cancelled." : String(error))
    } finally {
      for (const resource of resources.reverse()) resource.dispose()
      output?.dispose()
      try { await session?.stopRunning() } catch {}
      session?.dispose()
      active.current = null
      if (mounted.current) setBusy(false)
    }
  }

  return <NavigationStack><VStack spacing={12} padding navigationTitle="Metal camera textures">
    <Text>{status}</Text>
    <Button title="Capture one frame" disabled={busy} action={() => { void capture() }} />
    <Button title="Cancel capture" disabled={!busy} action={() => active.current?.abort()} />
    <Button title="Done" action={dismiss} />
  </VStack></NavigationStack>
}

async function run() {
  try { await Navigation.present({ element: <CameraTextureDemo /> }) }
  finally { Script.exit() }
}
void run()
