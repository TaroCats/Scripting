import { Button, Navigation, NavigationStack, RealityView, Script, ScrollView, Text, VStack, useEffect, useRef, useState } from 'scripting'

const sourceWidth = 8
const sourceHeight = 4
const outputWidth = 128
const outputHeight = 64
const groupSize = 8

const shader = `
#include <metal_stdlib>
using namespace metal;

kernel void resize_image(texture2d<float, access::read> input [[texture(0)]],
                         texture2d<float, access::write> output [[texture(1)]],
                         constant uint &swapRedBlue [[buffer(0)]],
                         uint2 position [[thread_position_in_grid]]) {
  const uint2 outputSize = uint2(output.get_width(), output.get_height());
  if (any(position >= outputSize)) return;
  const uint2 inputSize = uint2(input.get_width(), input.get_height());
  const uint2 sourcePosition = position * inputSize / outputSize;
  const float4 pixel = input.read(sourcePosition);
  output.write(swapRedBlue != 0 ? pixel.bgra : pixel, position);
}
`

function sourceBytes() {
  const bytes = new Uint8Array(sourceWidth * sourceHeight * 4)
  for (let y = 0; y < sourceHeight; y++) {
    for (let x = 0; x < sourceWidth; x++) {
      const color = (x + y) % 2 === 0 ? [245, 110, 12, 255] : [12, 50, 245, 255]
      bytes.set(color, (y * sourceWidth + x) * 4)
    }
  }
  return bytes
}

function resize(pipeline: Metal.ComputePipeline, input: RealityKit.LowLevelTexture, output: RealityKit.LowLevelTexture,
                swapRedBlue: boolean, signal?: AbortSignal) {
  return output.compute(pipeline, {
    textureIndex: 1,
    inputs: [{ index: 0, texture: input }],
    expectedRevision: output.info.revision,
    signal,
    dispatch: {
      threadgroups: { width: Math.ceil(outputWidth / groupSize), height: Math.ceil(outputHeight / groupSize) },
      threadsPerThreadgroup: { width: groupSize, height: groupSize },
      bytes: [{ index: 0, data: new Uint32Array([swapRedBlue ? 1 : 0]) }],
    },
  })
}

function TexturePreview({ input, output, pipeline, renderer }: {
  input: RealityKit.LowLevelTexture
  output: RealityKit.LowLevelTexture
  pipeline: Metal.ComputePipeline
  renderer: RealityKit.Renderer
}) {
  const [preview, setPreview] = useState({ swapped: false, revision: output.info.revision })
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const pending = useRef<AbortController | null>(null)

  useEffect(() => () => {
    pending.current?.abort()
    pending.current = null
  }, [])

  async function show(swapped: boolean) {
    if (pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    setStatus('Resizing on the GPU.')
    try {
      const revision = await resize(pipeline, input, output, swapped, controller.signal)
      if (pending.current === controller) {
        setPreview({ swapped, revision })
        setStatus('')
      }
    } catch (error) {
      if (pending.current === controller) {
        const cancelled = typeof error === 'object' && error !== null && 'code' in error && error.code === 'cancelled'
        setStatus(cancelled ? 'Resize cancelled. The previous result is displayed.' : String(error))
      }
    } finally {
      if (pending.current === controller) {
        pending.current = null
        setBusy(false)
      }
    }
  }

  function cancel() {
    const controller = pending.current
    if (!controller || controller.signal.aborted) return
    setStatus('Cancelling resize.')
    controller.abort()
  }

  return <NavigationStack>
    <ScrollView navigationTitle="Metal texture resize">
      <VStack spacing={12} padding>
        <RealityView renderer={renderer} frame={{ height: 230 }} accessibilityHidden />
        <Text>{`Resized ${sourceWidth} by ${sourceHeight} to ${outputWidth} by ${outputHeight}. ${preview.swapped ? 'Red and blue swapped.' : 'Original colors.'} Revision ${preview.revision}.`}</Text>
        <Button title="Resize with original colors" disabled={busy || !preview.swapped} action={() => { void show(false) }} />
        <Button title="Resize and swap red and blue" disabled={busy || preview.swapped} action={() => { void show(true) }} />
        <Button title="Cancel resize" disabled={!busy || pending.current?.signal.aborted === true} action={cancel} />
        {status ? <Text>{status}</Text> : null}
      </VStack>
    </ScrollView>
  </NavigationStack>
}

async function run() {
  const resources: Array<{ dispose(): void }> = []
  try {
    if (!RealityKit.getCapabilities().lowLevelTextureCompute) {
      await Dialog.alert({ message: 'Low-level textures are unavailable in this script context.' })
      return
    }
    const device = Metal.Device.getDefault()
    if (!device) throw Error('No Metal device is available.')
    const library = await device.compileLibrary(shader)
    resources.push(library)
    const pipeline = await library.makeComputePipeline('resize_image')
    resources.push(pipeline)
    const input = await RealityKit.LowLevelTexture.create({
      width: sourceWidth, height: sourceHeight, pixelFormat: 'rgba8Unorm', usage: ['shaderRead'],
    })
    resources.push(input)
    await input.update(sourceBytes())
    const output = await RealityKit.LowLevelTexture.create({
      width: outputWidth, height: outputHeight, pixelFormat: 'rgba8Unorm', usage: ['shaderRead', 'shaderWrite'],
    })
    resources.push(output)
    await resize(pipeline, input, output, false)

    const texture = output.texture
    resources.push(texture)
    const material = RealityKit.Material.create({ kind: 'unlit', baseColor: [1, 1, 1, 1],
      baseColorTexture: { texture, sampler: { minFilter: 'nearest', magFilter: 'nearest' } } })
    resources.push(material)
    const mesh = RealityKit.Mesh.primitive({ type: 'plane', width: 1.36, height: 0.68, vertical: true })
    const plane = RealityKit.Entity.create({ name: 'Resized texture preview' })
    plane.setModel(mesh, [material])
    const scene = RealityKit.Scene.create()
    scene.add(plane)
    const renderer = RealityKit.Renderer.create(scene, {
      camera: { position: [0, 0, 2.25], target: [0, 0, 0], fieldOfView: 40 },
      background: [0.04, 0.08, 0.11, 1], orbit: false,
    })
    await Navigation.present({ element: <TexturePreview input={input} output={output} pipeline={pipeline} renderer={renderer} /> })
  } catch (error) {
    await Dialog.alert({ title: 'Metal texture resize', message: String(error) })
  } finally {
    try {
      for (const resource of resources.reverse()) resource.dispose()
    } finally {
      Script.exit()
    }
  }
}

void run()
