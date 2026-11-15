import { Button, Image, Navigation, NavigationStack, Script, ScrollView, Text, VStack, useRef, useState } from 'scripting'

const kernel = `
#include <metal_stdlib>
using namespace metal;
kernel void cycleColor(texture2d<float, access::read> src [[texture(0)]],
                       texture2d<float, access::write> dst [[texture(1)]],
                       uint2 p [[thread_position_in_grid]]) {
  if (p.x >= dst.get_width() || p.y >= dst.get_height()) return;
  float4 color = src.read(p);
  dst.write(float4(color.gbr, color.a), p);
}
`

async function image(renderer: RealityKit.OffscreenRenderer) {
  const frame = await renderer.render({ width: 240, height: 160 })
  return UIImage.fromPixels({ width: frame.width, height: frame.height, format: 'bgra8',
    bytesPerRow: frame.bytesPerRow, data: frame.data, alphaMode: 'opaque' })
}

function Preview({ renderer, pipeline, first }: {
  renderer: RealityKit.OffscreenRenderer
  pipeline: Metal.ComputePipeline
  first: UIImage
}) {
  const dismiss = Navigation.useDismiss()
  const running = useRef(false)
  const [preview, setPreview] = useState(first)
  const [status, setStatus] = useState('Original scene. Apply the effect to cycle its color channels.')
  const [busy, setBusy] = useState(false)

  async function update(enabled: boolean) {
    if (running.current) return
    running.current = true
    setBusy(true)
    try {
      renderer.setPostProcess(enabled ? { pipeline } : null)
      setPreview(await image(renderer))
      setStatus(enabled ? 'Color channels cycled.' : 'Original scene restored.')
    } catch (error) {
      setStatus(String(error))
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  return <NavigationStack>
    <ScrollView navigationTitle="Offscreen post-processing">
      <VStack spacing={12} padding>
        <Image image={preview} resizable scaleToFit frame={{ maxWidth: 420 }}
          accessibilityLabel="Square on a contrasting background" />
        <Text>{status}</Text>
        <Button title="Apply color effect" disabled={busy} action={() => { void update(true) }} />
        <Button title="Show original scene" disabled={busy} action={() => { void update(false) }} />
        <Button title="Done" action={dismiss} />
      </VStack>
    </ScrollView>
  </NavigationStack>
}

async function run() {
  const resources: Array<{ dispose(): void }> = []
  try {
    if (!RealityKit.getCapabilities().offscreenPostProcessing) {
      await Dialog.alert({ message: 'Offscreen post-processing is unavailable on this device.' })
      return
    }
    const device = Metal.Device.getDefault()
    if (!device) throw new Error('A Metal device is required.')
    const library = await device.compileLibrary(kernel)
    resources.push(library)
    const pipeline = await library.makeComputePipeline('cycleColor')
    resources.push(pipeline)
    const scene = RealityKit.Scene.create()
    resources.push(scene)
    const entity = RealityKit.Entity.create()
    resources.push(entity)
    const square = RealityKit.Mesh.primitive({ type: 'plane', width: 0.8, height: 0.8, vertical: true })
    resources.push(square)
    const red = RealityKit.Material.create({ kind: 'unlit', baseColor: [1, 0.1, 0.05, 1] })
    resources.push(red)
    entity.setModel(square, [red])
    scene.add(entity)
    const renderer = RealityKit.OffscreenRenderer.create(scene, {
      camera: { position: [0, 0, 2.5] }, background: [0.05, 0.2, 0.8, 1],
    })
    resources.push(renderer)
    const first = await image(renderer)
    renderer.setPostProcess({ pipeline })
    const processed = await image(renderer)
    renderer.setPostProcess(null)
    const originalBytes = first.toPixels().data
    if (processed.toPixels().data.every((byte, index) => byte === originalBytes[index])) {
      throw new Error('The rendered colors did not change.')
    }
    console.log('Offscreen post-process ready')
    await Navigation.present({ element: <Preview renderer={renderer} pipeline={pipeline} first={first} /> })
  } catch (error) {
    await Dialog.alert({ title: 'Offscreen post-processing', message: String(error) })
  } finally {
    try {
      for (const resource of resources.reverse()) resource.dispose()
    } finally {
      Script.exit()
    }
  }
}

void run()
