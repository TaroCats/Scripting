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
  async function oneShot() {
    await stop(); controller = new AbortController()
    report("Choose full display, then switch apps within 3 seconds.")
    const frame = await ScreenCapture.capture({ scope: "display", signal: controller.signal, delayMs: 3000, image: { dynamicRange: "sdr" } })
    show(frame.image); report(`Frame ${frame.sequence}: ${frame.image.width} × ${frame.image.height}`)
  }
  async function live() {
    const owned = await prepare({ scope: "display" }); await owned.start()
    const fresh = await owned.nextFrame({ image: { maxDimension: 1000 } })
    show(fresh.image)
    const cached = await owned.latestFrame({ maxAgeMs: Infinity })
    report(cached ? `Cached frame ${cached.sequence}` : "No cached frame")
  }
  return <NavigationStack><List navigationTitle="Capture Images" toolbar={{ cancellationAction: <Button title="Close" action={dismiss} /> }}>
    <Text>{message}</Text>
    <Button title="Capture after 3 seconds" action={() => { void run(oneShot) }} disabled={busy || !ScreenCapture.isSupported} />
    <Button title="Start and compare fresh / cached" action={() => { void run(live) }} disabled={busy || !ScreenCapture.isSupported} />
    <Button title="Stop / Cancel" action={() => { void stop().catch(error => report(String(error))) }} />
    {image ? <Image image={image} resizable scaleToFit /> : null}
  </List></NavigationStack>
}
async function main() {
  try { await Navigation.present({ element: <Demo /> }) }
  finally { alive = false; try { await stop() } finally { Script.exit() } }
}
void main()
