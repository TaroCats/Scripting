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
  async function begin() {
    const owned = await prepare({ scope: "display", configuration: { preset: "hdrRecordingPreservedSDRHDR10", captureDynamicRange: "hdrCanonicalDisplay" } })
    await owned.start()
    const frame = await owned.nextFrame({ image: { dynamicRange: "preserve", maxDimension: 1200 } })
    show(frame.image)
    report(JSON.stringify(frame.sourceFormat, (_, value) => typeof value === "bigint" ? value.toString() : value))
  }
  async function sdr() {
    if (!session) throw new Error("Start HDR capture first")
    const frame = await session.nextFrame({ image: { dynamicRange: "sdr", maxDimension: 1200 } })
    show(frame.image); report("Explicit SDR tone mapping")
  }
  return <NavigationStack><List navigationTitle="HDR Capture" toolbar={{ cancellationAction: <Button title="Close" action={dismiss} /> }}>
    <Text>{message}</Text>
    <Button title="Request HDR and inspect format" action={() => { void run(begin) }} disabled={busy || !ScreenCapture.isSupported} />
    <Button title="Compare explicit SDR image" action={() => { void run(sdr) }} disabled={busy || !ScreenCapture.isSupported} />
    <Button title="Stop / Cancel" action={() => { void stop().catch(error => report(String(error))) }} />
    {image ? <Image image={image} resizable scaleToFit /> : null}
  </List></NavigationStack>
}
async function main() {
  try { await Navigation.present({ element: <Demo /> }) }
  finally { alive = false; try { await stop() } finally { Script.exit() } }
}
void main()
