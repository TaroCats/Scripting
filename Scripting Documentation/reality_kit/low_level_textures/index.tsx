import { Button, Navigation, NavigationStack, RealityView, Script, ScrollView, Text, VStack, useEffect, useRef, useState } from 'scripting'

const size = 4
const patterns = {
  orange: { name: 'Orange stripes', color: [240, 78, 12], axis: 'column' },
  blue: { name: 'Blue stripes', color: [12, 132, 244], axis: 'row' },
} as const

type Pattern = keyof typeof patterns

function textureBytes(pattern: Pattern) {
  const { color, axis } = patterns[pattern]
  const bytes = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const shade = (axis === 'row' ? y : x) % 2 === 0 ? 1 : 0.35
      bytes.set([Math.round(color[0] * shade), Math.round(color[1] * shade), Math.round(color[2] * shade), 255], (y * size + x) * 4)
    }
  }
  return bytes
}

function TexturePreview({ backing, renderer }: { backing: RealityKit.LowLevelTexture; renderer: RealityKit.Renderer }) {
  const [current, setCurrent] = useState<Pattern>('orange')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(`Orange stripes. First texel: 240, 78, 12, 255. Revision ${backing.info.revision}.`)
  const pending = useRef<AbortController | null>(null)

  useEffect(() => () => {
    pending.current?.abort()
    pending.current = null
  }, [])

  async function show(next: Pattern) {
    if (pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    setStatus(`Loading ${patterns[next].name.toLowerCase()}.`)
    try {
      const revision = await backing.update(textureBytes(next), {
        expectedRevision: backing.info.revision,
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      setCurrent(next)
      const texel = await backing.read({ width: 1, height: 1, expectedRevision: revision, signal: controller.signal })
      if (!controller.signal.aborted) setStatus(`${patterns[next].name}. First texel: ${texel.join(', ')}. Revision ${revision}.`)
    } catch (error) {
      if (!controller.signal.aborted) setStatus(String(error))
    } finally {
      if (pending.current === controller) {
        pending.current = null
        setBusy(false)
      }
    }
  }

  return <NavigationStack>
    <ScrollView navigationTitle="Low-level textures">
      <VStack spacing={12} padding>
        <RealityView renderer={renderer} frame={{ height: 230 }} accessibilityHidden />
        <Text>{status}</Text>
        <Button title="Show orange vertical stripes" disabled={busy || current === 'orange'} action={() => { void show('orange') }} />
        <Button title="Show blue horizontal stripes" disabled={busy || current === 'blue'} action={() => { void show('blue') }} />
      </VStack>
    </ScrollView>
  </NavigationStack>
}

async function run() {
  let backing: RealityKit.LowLevelTexture | undefined
  try {
    if (!RealityKit.getCapabilities().lowLevelTextures) {
      await Dialog.alert({ message: 'Low-level textures are unavailable in this script context.' })
      return
    }
    backing = await RealityKit.LowLevelTexture.create({ width: size, height: size, pixelFormat: 'rgba8Unorm' })
    await backing.update(textureBytes('orange'))
    const material = RealityKit.Material.create({
      kind: 'unlit', baseColor: [1, 1, 1, 1],
      baseColorTexture: { texture: backing.texture, sampler: { minFilter: 'nearest', magFilter: 'nearest' } },
    })
    const mesh = RealityKit.Mesh.primitive({ type: 'plane', width: 1.1, height: 1.1, vertical: true })
    const entity = RealityKit.Entity.create({ name: 'Stripe preview' })
    entity.setModel(mesh, [material])
    const scene = RealityKit.Scene.create()
    scene.add(entity)
    const renderer = RealityKit.Renderer.create(scene, {
      camera: { position: [0, 0, 2.2], target: [0, 0, 0], fieldOfView: 40 },
      background: [0.04, 0.08, 0.11, 1], orbit: false,
    })
    await Navigation.present({ element: <TexturePreview backing={backing} renderer={renderer} /> })
  } catch (error) {
    await Dialog.alert({ title: 'Low-level textures', message: String(error) })
  } finally {
    backing?.dispose()
    Script.exit()
  }
}

void run()
