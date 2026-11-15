import {
  Button, Navigation, NavigationStack, RealityView, Script, ScrollView, Text, VStack,
  useEffect, useRef, useState,
} from 'scripting'

const size = 4
const patterns = {
  orange: { title: 'Orange vertical stripes', bgra: [18, 91, 238, 255] },
  blue: { title: 'Blue horizontal stripes', bgra: [236, 131, 17, 255] },
} as const

type Pattern = keyof typeof patterns

function makeSource(pattern: Pattern) {
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const columnOrRow = pattern === 'orange' ? x : y
      const color = columnOrRow % 2 === 0 ? patterns[pattern].bgra : [24, 18, 15, 255]
      data.set(color, (y * size + x) * 4)
    }
  }
  return PixelBuffer.create({ width: size, height: size, format: 'bgra8', data })
}

function statusFor(pattern: Pattern, revision: string) {
  return `${patterns[pattern].title}. Revision ${revision}.`
}

function Preview({ external, renderer }: { external: RealityKit.ExternalTexture; renderer: RealityKit.Renderer }) {
  const dismiss = Navigation.useDismiss()
  const pending = useRef<AbortController | null>(null)
  const [current, setCurrent] = useState<Pattern>('orange')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(statusFor('orange', external.info.revision))
  const [error, setError] = useState('')

  useEffect(() => {
    let reported = false
    const listener = renderer.on('update', () => {
      if (reported) return
      reported = true
      console.log('RealityKit external texture ready')
    })
    return () => {
      listener.dispose()
      pending.current?.abort()
      pending.current = null
    }
  }, [renderer])

  async function show(pattern: Pattern) {
    if (pending.current || pattern === current) return
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    setError('')
    let source: PixelBuffer | undefined
    try {
      source = makeSource(pattern)
      const revision = await external.replace(source, {
        expectedRevision: external.info.revision,
        signal: controller.signal,
      })
      if (pending.current !== controller) return
      const description = statusFor(pattern, revision)
      setCurrent(pattern)
      setStatus(description)
      void Accessibility.announce(description).catch(() => {})
    } catch (failure) {
      if (pending.current !== controller) return
      setError(`Could not replace the snapshot. ${String(failure)}`)
      void Accessibility.announce('Could not replace the snapshot.').catch(() => {})
    } finally {
      source?.dispose()
      if (pending.current === controller) {
        pending.current = null
        setBusy(false)
      }
    }
  }

  return <NavigationStack>
    <ScrollView navigationTitle="External textures">
      <VStack padding spacing={12}>
        <RealityView renderer={renderer} frame={{ height: 230 }} accessibilityHidden />
        <Text>{status}</Text>
        {busy ? <Text>Replacing the snapshot.</Text> : null}
        {error ? <Text>{error}</Text> : null}
        <Button title="Show orange vertical stripes" controlSize="large"
          disabled={busy || current === 'orange'} action={() => { void show('orange') }} />
        <Button title="Show blue horizontal stripes" controlSize="large"
          disabled={busy || current === 'blue'} action={() => { void show('blue') }} />
        <Button title="Done" controlSize="large" action={dismiss} />
      </VStack>
    </ScrollView>
  </NavigationStack>
}

async function run() {
  const resources: Array<{ dispose(): void }> = []
  try {
    if (!RealityKit.getCapabilities().externalTextures) {
      await Dialog.alert({ message: 'External textures are unavailable in this script context. They require iOS 27 or later.' })
      return
    }

    const source = makeSource('orange')
    let external: RealityKit.ExternalTexture
    try {
      external = await RealityKit.ExternalTexture.create(source)
    } finally {
      source.dispose()
    }
    resources.push(external)
    const texture = external.texture
    resources.push(texture)
    const material = RealityKit.Material.create({
      kind: 'unlit', baseColor: [1, 1, 1, 1],
      baseColorTexture: { texture, sampler: { minFilter: 'nearest', magFilter: 'nearest' } },
    })
    resources.push(material)
    const mesh = RealityKit.Mesh.primitive({ type: 'plane', width: 1.1, height: 1.1, vertical: true })
    resources.push(mesh)
    const entity = RealityKit.Entity.create({ name: 'Snapshot preview' })
    resources.push(entity)
    entity.setModel(mesh, [material])
    const scene = RealityKit.Scene.create()
    resources.push(scene)
    scene.add(entity)
    const renderer = RealityKit.Renderer.create(scene, {
      camera: { position: [0, 0, 2.2], target: [0, 0, 0], fieldOfView: 40 },
      background: [0.04, 0.08, 0.11, 1], orbit: false,
    })
    resources.push(renderer)
    await Navigation.present({ element: <Preview external={external} renderer={renderer} /> })
  } catch (error) {
    await Dialog.alert({ title: 'External textures', message: String(error) })
  } finally {
    try {
      for (const resource of resources.reverse()) resource.dispose()
    } finally {
      Script.exit()
    }
  }
}

void run()
