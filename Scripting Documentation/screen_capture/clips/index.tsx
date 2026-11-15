import { AbortController, Button, Image, List, Navigation, NavigationStack, Path, Script, Text, useState } from "scripting"

let session: ScreenCaptureSession | null = null
let controller: AbortController | null = null
let alive = true
let runningAction = false
async function stop() {
  controller?.abort()
  const owned = session
  if (owned) { await owned.stop(); if (session === owned) session = null }
}
function Demo() {
  const dismiss = Navigation.useDismiss()
  const [message, setMessage] = useState("Ready · iOS 27+")
  const [image, setImage] = useState<UIImage | null>(null)
  const [busy, setBusy] = useState(false)
  const report = (text: string) => { if (alive) setMessage(text) }
  const show = (value: UIImage) => { if (alive) setImage(value) }
  async function run(action: () => Promise<void>) {
    if (runningAction) return
    runningAction = true; setBusy(true)
    try { await action() } catch (error) { report(String(error)) }
    finally { runningAction = false; if (alive) setBusy(false) }
  }
  async function prepare(options: ScreenCaptureOptions) {
    await stop()
    controller = new AbortController()
    const owned = await ScreenCapture.createSession({ ...options, signal: controller.signal })
    session = owned
    owned.onStateChanged = state => report(state)
    void owned.closed.then(end => report(end.error ? end.error.message : end.reason))
    return owned
  }
  const [buffer, setBuffer] = useState<ScreenCaptureClipBuffer | null>(null)
  async function begin() {
    const owned = await prepare({ scope: "display", configuration: { capturesAudio: true } })
    await owned.start()
    const clips = await owned.addClipBufferingOutput()
    setBuffer(clips)
    clips.onStateChanged = state => report(`Clip buffer: ${state}`)
    clips.onError = error => report(error.message)
    report(`Clip buffer: ${clips.state}. Let at least 5 seconds accumulate.`)
  }
  async function exportRecent() {
    if (!buffer || buffer.state !== "buffering") throw new Error("Start buffering and wait first")
    const filePath = Path.join(FileManager.documentsDirectory, `clip-${Date.now()}.mp4`)
    const file = await buffer.exportClip({ filePath, duration: 5 })
    report(`${file.duration.toFixed(2)} s · ${file.fileSize} bytes · ${file.filePath}`)
    await ScreenCapture.presentRecordingEditor(file.filePath)
  }
  return <NavigationStack><List navigationTitle="Rolling Clips" toolbar={{ cancellationAction: <Button title="Close" action={dismiss} /> }}>
    <Text>{message}</Text>
    <Button title="Start rolling buffer" action={() => { void run(begin) }} disabled={busy || !ScreenCapture.isSupported} />
    <Button title="Export last 5 seconds and preview" action={() => { void run(exportRecent) }} disabled={busy || !ScreenCapture.isSupported} />
    <Button title="Stop / Cancel" action={() => { void stop().catch(error => report(String(error))) }} />
    {image ? <Image image={image} resizable scaleToFit /> : null}
  </List></NavigationStack>
}
async function main() {
  try { await Navigation.present({ element: <Demo /> }) }
  finally { alive = false; try { await stop() } finally { Script.exit() } }
}
void main()
