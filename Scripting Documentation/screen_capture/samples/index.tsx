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
    const owned = await prepare({ scope: "display", picker: { showsMicrophoneControl: true }, configuration: { capturesAudio: true } })
    const video = await owned.addVideoOutput({ maxFPS: 5, buffering: { capacity: 2, overflow: "dropOldest" } })
    const system = await owned.addAudioOutput({ source: "system" })
    const mic = owned.selection.isMicrophoneEnabled ? await owned.addAudioOutput({ source: "microphone" }) : null
    let videos = 0, planeBytes = 0, converted = false
    const audioBytes: Record<string, number> = { system: 0, microphone: 0 }
    async function readAudio(output: ScreenCaptureAudioOutput) {
      for await (const sample of output.samples) {
        try { for (const buffer of await sample.copyAudioBuffers()) audioBytes[output.source] += buffer.data.size }
        finally { sample.dispose() }
      }
    }
    const jobs: Promise<void>[] = [readAudio(system)]
    if (mic) jobs.push(readAudio(mic))
    jobs.push((async () => {
      for await (const sample of video.samples) {
        try {
          videos++
          if (sample.hasImage && !converted && ["complete", "started"].includes(sample.metadata.status)) {
            converted = true
            const planes = await sample.copyPixelPlanes()
            planeBytes = planes.reduce((total, plane) => total + plane.data.size, 0)
            show(await sample.toImage({ maxDimension: 800, dynamicRange: "sdr" }))
          }
          report(`Video ${videos} · system ${audioBytes.system} bytes · mic ${audioBytes.microphone} bytes · first pixel planes ${planeBytes} bytes · ${sample.timing.presentationTime.value}/${sample.timing.presentationTime.timescale}`)
        } finally { sample.dispose() }
      }
    })())
    void Promise.all(jobs).catch(error => { report(String(error)); void owned.stop().catch(console.error) })
    await owned.start()
  }
  return <NavigationStack><List navigationTitle="Raw Capture Samples" toolbar={{ cancellationAction: <Button title="Close" action={dismiss} /> }}>
    <Text>{message}</Text>
    <Button title="Start video + system audio + optional mic" action={() => { void run(begin) }} disabled={busy || !ScreenCapture.isSupported} />
    <Button title="Stop / Cancel" action={() => { void stop().catch(error => report(String(error))) }} />
    {image ? <Image image={image} resizable scaleToFit /> : null}
  </List></NavigationStack>
}
async function main() {
  try { await Navigation.present({ element: <Demo /> }) }
  finally { alive = false; try { await stop() } finally { Script.exit() } }
}
void main()
