import { Button, Image, Navigation, NavigationStack, Script, ScrollView, Text, VStack, useEffect, useRef, useState } from 'scripting'

const width = 288
const height = 192
const step = 0.25

async function capture(renderer: RealityKit.OffscreenRenderer, playback: RealityKit.AnimationPlayback,
                       deltaTime: number, signal?: AbortSignal) {
  const frame = await renderer.render({ width, height, pixelFormat: 'bgra8Unorm', deltaTime, signal })
  const image = UIImage.fromPixels({ width: frame.width, height: frame.height, bytesPerRow: frame.bytesPerRow,
    data: frame.data, format: 'bgra8', alphaMode: 'opaque' })
  return { image, index: frame.frameIndex, playback: playback.state }
}

function OffscreenPreview({ renderer, playback, firstFrame }: {
  renderer: RealityKit.OffscreenRenderer
  playback: RealityKit.AnimationPlayback
  firstFrame: Awaited<ReturnType<typeof capture>>
}) {
  const [frame, setFrame] = useState(firstFrame)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef<AbortController | null>(null)

  useEffect(() => () => {
    pending.current?.abort()
    pending.current = null
  }, [])

  async function advance() {
    if (pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    setError('')
    try {
      const next = await capture(renderer, playback, step, controller.signal)
      if (pending.current === controller) setFrame(next)
    } catch (error) {
      if (pending.current === controller) setError(String(error))
    } finally {
      if (pending.current === controller) {
        pending.current = null
        setBusy(false)
      }
    }
  }

  const completed = frame.playback.status === 'completed'
  const time = frame.playback.time
  const status = completed ? 'Animation complete.' : time === null ? '' : `Animation time ${time.toFixed(2)} seconds.`
  return <NavigationStack>
    <ScrollView navigationTitle="Offscreen animation">
      <VStack spacing={12} padding>
        <Image image={frame.image} resizable aspectRatio={{ value: width / height, contentMode: 'fit' }}
          frame={{ maxWidth: 420 }} accessibilityLabel="Rendered image of an orange square on a dark background" />
        <Text>{`Frame ${frame.index}. ${status}`}</Text>
        <Button title="Advance by a quarter second" disabled={busy || completed} action={() => { void advance() }} />
        {busy ? <Text>Rendering the next frame.</Text> : null}
        {error ? <Text>{error}</Text> : null}
      </VStack>
    </ScrollView>
  </NavigationStack>
}

async function run() {
  const resources: Array<{ dispose(): void }> = []
  try {
    if (!RealityKit.getCapabilities().offscreenRendering) {
      await Dialog.alert({ message: 'Offscreen rendering is unavailable in this script context.' })
      return
    }
    const scene = RealityKit.Scene.create()
    resources.push(scene)
    const mesh = RealityKit.Mesh.primitive({ type: 'plane', width: 0.6, height: 0.6, vertical: true })
    resources.push(mesh)
    const material = RealityKit.Material.create({ kind: 'unlit', baseColor: [1, 0.28, 0.06, 1] })
    resources.push(material)
    const entity = RealityKit.Entity.create({ name: 'Moving square', transform: { position: [-0.55, 0, 0] } })
    resources.push(entity)
    entity.setModel(mesh, [material])
    scene.add(entity)

    const renderer = RealityKit.OffscreenRenderer.create(scene, {
      camera: { position: [0, 0, 3], target: [0, 0, 0], fieldOfView: 40 },
      background: [0.04, 0.08, 0.11, 1],
    })
    resources.push(renderer)
    const clip = RealityKit.AnimationClip.fromToBy({
      name: 'Move across the frame', target: { kind: 'transform' }, valueType: 'transform',
      from: { position: [-0.55, 0, 0] }, to: { position: [0.55, 0, 0] },
      duration: 1, curve: 'linear', fillMode: 'forwards',
    })
    resources.push(clip)
    const playback = entity.playAnimation(clip)
    resources.push(playback)
    const firstFrame = await capture(renderer, playback, 0)
    console.log('Offscreen frame ready')
    await Navigation.present({ element: <OffscreenPreview renderer={renderer} playback={playback} firstFrame={firstFrame} /> })
  } catch (error) {
    await Dialog.alert({ title: 'Offscreen animation', message: String(error) })
  } finally {
    try {
      for (const resource of resources.reverse()) resource.dispose()
    } finally {
      Script.exit()
    }
  }
}

void run()
