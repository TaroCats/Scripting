import {
  Button, Image, Navigation, NavigationStack, Script, ScrollView, Text, VStack,
  useEffect, useRef, useState,
} from 'scripting'

const outputWidth = 288
const outputHeight = 224
const size = 8
const chinese = Device.systemLanguageCode === 'zh'
const copy = chinese ? {
  title: '离屏外部纹理',
  unavailable: '此脚本环境无法使用离屏外部纹理。该功能需要 iOS 27 或更高版本。',
  image: '离屏渲染的四色方格',
  render: '渲染另一种图案',
  rendering: '正在渲染。',
  failed: '渲染失败。',
  done: '完成',
  status: (pattern: number, frame: string) => `图案 ${pattern + 1}，第 ${frame} 帧。`,
} : {
  title: 'Offscreen external textures',
  unavailable: 'Offscreen external textures are unavailable in this script context. They require iOS 27 or later.',
  image: 'Four colored squares rendered offscreen',
  render: 'Render the other pattern',
  rendering: 'Rendering.',
  failed: 'Rendering failed.',
  done: 'Done',
  status: (pattern: number, frame: string) => `Pattern ${pattern + 1}, frame ${frame}.`,
}

const colors = [
  [20, 85, 245, 255], [50, 226, 20, 255],
  [245, 120, 20, 255], [16, 200, 240, 255],
] as const
const patterns = [[0, 1, 2, 3], [2, 0, 3, 1]] as const
type Pattern = 0 | 1

function pixels(pattern: Pattern) {
  const bytes = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const quadrant = (y < size / 2 ? 0 : 2) + (x < size / 2 ? 0 : 1)
      bytes.set(colors[patterns[pattern][quadrant]], (y * size + x) * 4)
    }
  }
  return bytes
}

async function render(renderer: RealityKit.OffscreenRenderer, source: PixelBuffer, pattern: Pattern,
                      signal?: AbortSignal) {
  source.writePlanes([{ plane: 0, data: pixels(pattern) }])
  const frame = await renderer.renderWithExternalTexture(source, {
    width: outputWidth, height: outputHeight, pixelFormat: 'bgra8Unorm',
    surface: { width: 1.6, height: 1.6, sampler: { minFilter: 'nearest', magFilter: 'nearest' } },
    signal,
  })
  const image = UIImage.fromPixels({
    width: frame.width, height: frame.height, bytesPerRow: frame.bytesPerRow,
    data: frame.data, format: 'bgra8', alphaMode: 'opaque',
  })
  return { image, frameIndex: frame.frameIndex, pattern }
}

function Preview({ renderer, source, firstFrame }: {
  renderer: RealityKit.OffscreenRenderer
  source: PixelBuffer
  firstFrame: Awaited<ReturnType<typeof render>>
}) {
  const dismiss = Navigation.useDismiss()
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
      const next = await render(renderer, source, frame.pattern === 0 ? 1 : 0, controller.signal)
      if (pending.current !== controller) return
      setFrame(next)
      void Accessibility.announce(copy.status(next.pattern, next.frameIndex)).catch(() => {})
    } catch (failure) {
      if (pending.current !== controller) return
      setError(`${copy.failed} ${String(failure)}`)
      void Accessibility.announce(copy.failed).catch(() => {})
    } finally {
      if (pending.current === controller) {
        pending.current = null
        setBusy(false)
      }
    }
  }

  return <NavigationStack>
    <ScrollView navigationTitle={copy.title}>
      <VStack spacing={12} padding>
        <Image image={frame.image} resizable aspectRatio={{ value: outputWidth / outputHeight, contentMode: 'fit' }}
          frame={{ maxWidth: 420 }} accessibilityLabel={copy.image} />
        <Text>{copy.status(frame.pattern, frame.frameIndex)}</Text>
        {busy ? <Text>{copy.rendering}</Text> : null}
        {error ? <Text>{error}</Text> : null}
        <Button title={copy.render} disabled={busy} controlSize="large" action={() => { void advance() }} />
        <Button title={copy.done} controlSize="large" action={dismiss} />
      </VStack>
    </ScrollView>
  </NavigationStack>
}

async function run() {
  const resources: Array<{ dispose(): void }> = []
  try {
    if (!RealityKit.getCapabilities().offscreenExternalTextures) {
      await Dialog.alert({ message: copy.unavailable })
      return
    }
    const source = PixelBuffer.create({ width: size, height: size, format: 'bgra8' })
    resources.push(source)
    const scene = RealityKit.Scene.create()
    resources.push(scene)
    const renderer = RealityKit.OffscreenRenderer.create(scene, {
      camera: { position: [0, 0, 3], target: [0, 0, 0], fieldOfView: 40 },
      background: [0.04, 0.08, 0.11, 1],
    })
    resources.push(renderer)
    const firstFrame = await render(renderer, source, 0)
    console.log('RealityKit offscreen external texture ready')
    await Navigation.present({ element: <Preview renderer={renderer} source={source} firstFrame={firstFrame} /> })
  } catch (failure) {
    await Dialog.alert({ title: copy.title, message: String(failure) })
  } finally {
    try {
      for (const resource of resources.reverse()) resource.dispose()
    } finally {
      Script.exit()
    }
  }
}

void run()
