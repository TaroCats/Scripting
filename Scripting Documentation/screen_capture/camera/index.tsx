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
  const [effect, setEffect] = useState<ScreenCaptureVideoEffect | null>(null)
  async function begin() {
    const owned = await prepare({ scope: "app", picker: { showsCameraControl: true } })
    if (!owned.selection.isCameraEnabled) throw new Error("Enable the camera in the system picker")
    const device = AVCaptureDevice.default("video")
    if (!device) throw new Error("No camera")
    const output = await owned.addVideoEffectOutput(device)
    setEffect(output)
    output.onStateChanged = state => report(`Camera: ${state}`)
    output.onError = error => report(error.message)
    await owned.start()
  }
  async function switchCamera() {
    if (!effect) throw new Error("Start camera capture first")
    const devices = AVCaptureDevice.discoverySession({ deviceTypes: ["builtInWideAngleCamera"], mediaType: "video" }).devices
    const next = devices.find(device => device.uniqueID !== effect.cameraDevice.uniqueID)
    if (!next) throw new Error("No second connected camera")
    await effect.setCameraDevice(next); report(next.localizedName)
  }
  return <NavigationStack><List navigationTitle="Camera Effect" toolbar={{ cancellationAction: <Button title="Close" action={dismiss} /> }}>
    <Text>{message}</Text>
    <Button title="Start in-app camera capture" action={() => { void run(begin) }} disabled={busy || !ScreenCapture.isSupported} />
    <Button title="Switch connected camera" action={() => { void run(switchCamera) }} disabled={busy || !ScreenCapture.isSupported} />
    <Button title="Stop / Cancel" action={() => { void stop().catch(error => report(String(error))) }} />
    {image ? <Image image={image} resizable scaleToFit /> : null}
  </List></NavigationStack>
}
async function main() {
  try { await Navigation.present({ element: <Demo /> }) }
  finally { alive = false; try { await stop() } finally { Script.exit() } }
}
void main()
