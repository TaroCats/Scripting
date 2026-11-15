import {
  AbortController, Button, ImageRenderer, LiveTextView, Navigation,
  NavigationStack, Script, ScrollView, Text, VStack, useEffect, useRef, useState,
} from 'scripting'

const chinese = Device.systemLocales?.[0]?.startsWith('zh') ?? false
const title = chinese ? '实况文本' : 'Live Text'
const done = chinese ? '完成' : 'Done'

function errorCode(error: unknown): string {
  return (error as { code?: string } | null)?.code ?? 'nativeFailure'
}

function Demo({ image }: { image: UIImage }) {
  const dismiss = Navigation.useDismiss()
  const [selection, setSelection] = useState('')
  const [viewError, setViewError] = useState('')
  const [transcript, setTranscript] = useState<string>()
  const [analysisError, setAnalysisError] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const active = useRef<AbortController | undefined>(undefined)

  useEffect(() => () => { active.current?.abort() }, [])

  async function analyze() {
    if (active.current) return
    const request = new AbortController()
    active.current = request
    setAnalyzing(true)
    setAnalysisError('')
    try {
      const text = await LiveText.analyze(image, { signal: request.signal })
      if (!request.signal.aborted) setTranscript(text)
    } catch (error) {
      if (!request.signal.aborted) setAnalysisError(errorCode(error))
    } finally {
      active.current = undefined
      if (!request.signal.aborted) setAnalyzing(false)
    }
  }

  return <NavigationStack>
    <ScrollView navigationTitle={title} toolbar={{ cancellationAction: <Button title={done} action={dismiss} /> }}>
      <VStack alignment="leading" spacing={12} padding>
        <LiveTextView
          image={image}
          interaction="textAndDataDetectors"
          frame={{ height: 240 }}
          accessibilityLabel={chinese ? '实况文本示例卡片' : 'Live Text sample card'}
          onSelectionChange={setSelection}
          onError={setViewError}
        />
        {viewError ? <Text>{`${chinese ? '图片交互不可用' : 'Image interaction unavailable'} (${viewError})`}</Text> : null}
        <Text font="headline">{chinese ? '当前选区' : 'Selected text'}</Text>
        <Text>{selection || (chinese ? '在图片中选中文字。' : 'Select text in the image.')}</Text>
        <Button title={chinese ? '读取整图文字' : 'Read all text'} action={analyze} disabled={analyzing} />
        {analysisError ? <Text>{`${chinese ? '无法读取整图文字' : 'Could not read all text'} (${analysisError})`}</Text> : null}
        {transcript === undefined ? null : <Text>{transcript || (chinese ? '未识别到文字。' : 'No text recognized.')}</Text>}
      </VStack>
    </ScrollView>
  </NavigationStack>
}

async function run() {
  try {
    if (typeof LiveText === 'undefined' || !LiveText.isSupported()) {
      await Dialog.alert({ title, message: chinese ? '当前设备或脚本环境不支持实况文本。' : 'Live Text is unavailable on this device or in this script environment.' })
      return
    }

    const image = await ImageRenderer.toUIImage(
      <VStack spacing={12} frame={{ width: 320, height: 160 }} background="#ffffff">
        <Text font="largeTitle" foregroundStyle="#000000">Live Text</Text>
        <Text font="title2" foregroundStyle="#000000">Visit apple.com</Text>
      </VStack>,
      { scale: 2, opaque: true },
    )
    await Navigation.present({ element: <Demo image={image} /> })
  } catch (error) {
    const code = errorCode(error)
    const message = chinese ? `无法打开实况文本示例（${code}）。` : `Could not open the Live Text example (${code}).`
    await Dialog.alert({ title, message })
  } finally {
    Script.exit()
  }
}

void run()
