import { Button, Navigation, NavigationStack, Script, Text, VStack, useEffect, useRef, useState } from "scripting"

const shader = `
#include <metal_stdlib>
using namespace metal;
kernel void sample_pixel(texture2d<half,access::read> image [[texture(0)]],
                         device float *out [[buffer(0)]], uint2 p [[thread_position_in_grid]]) {
  out[p.y * 2 + p.x] = float(image.read(p).r);
}
`

function Demo() {
  const dismiss = Navigation.useDismiss()
  const controller = useRef<AbortController | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState("Read the same Float16 storage from Core ML and Metal.")
  useEffect(() => {
    void sample()
    return () => { controller.current?.abort() }
  }, [])

  async function sample() {
    if (controller.current) return
    const abort = new AbortController()
    controller.current = abort
    const { signal } = abort
    const resources: { dispose(): void }[] = []
    setBusy(true)
    setStatus("Preparing a shared pixel buffer.")
    try {
      const device = Metal.Device.getDefault()
      if (!device) throw Error("No Metal device is available.")
      const pixels = PixelBuffer.create({ width: 2, height: 2, format: "gray16Float", metalCompatible: true })
      resources.push(pixels)
      const input = CoreML.MultiArray.fromPixelBuffer(pixels, [2, 2])
      resources.push(input)
      const texture = device.makeTextureView({ pixelBuffer: pixels })
      resources.push(texture)
      input.fill(3.5)
      const lib = await device.compileLibrary(shader, { signal })
      resources.push(lib)
      const pipeline = await lib.makeComputePipeline("sample_pixel", { signal })
      resources.push(pipeline)
      const output = await device.makeBuffer({ length: 16, signal })
      resources.push(output)
      await pipeline.dispatch({
        threadgroups: { width: 2, height: 2 }, threadsPerThreadgroup: { width: 1 },
        textures: [{ index: 0, texture }], buffers: [{ index: 0, buffer: output }], signal,
      })
      const bytes = await output.read({ signal })
      const values = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)
      const result = `Values from Metal: ${values.join(", ")}.`
      if (!signal.aborted) { setStatus(result); console.log(result) }
    } catch (error) {
      if (!signal.aborted) setStatus(String(error))
    } finally {
      for (const resource of resources.reverse()) resource.dispose()
      if (controller.current === abort) {
        controller.current = null
        if (!signal.aborted) setBusy(false)
      }
    }
  }

  return <NavigationStack><VStack spacing={12} padding navigationTitle="Shared PixelBuffer textures">
    <Text>{status}</Text>
    <Button title="Read values on the GPU" action={() => { void sample() }} disabled={busy} />
    <Button title="Done" action={dismiss} />
  </VStack></NavigationStack>
}

async function run() {
  try { await Navigation.present({ element: <Demo /> }) }
  finally { Script.exit() }
}

void run()
