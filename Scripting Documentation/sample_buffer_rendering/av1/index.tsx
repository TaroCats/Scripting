import { Button, Navigation, NavigationStack, Script, Text, VStack, SampleBufferView, ScrollView, useState } from "scripting"

import { uptime } from "node:os"

async function pumpSamples(reader: MediaSampleReader, consume: (sample: MediaSample) => Promise<void>, shouldStop: () => boolean) {
  // One pending read overlaps decode with submission; errors are observed immediately.
  const read = () => Promise.resolve().then(() => reader.copyNextSampleBuffer()).then(sample => ({ sample }), error => ({ error }))
  let pending: ReturnType<typeof read> | null = read()
  try {
    while (!shouldStop()) {
      const result = await pending!
      pending = null
      if ("error" in result) throw result.error
      const sample = result.sample
      if (!sample) break
      try {
        pending = read()
        if (!shouldStop()) await consume(sample)
      } finally { sample.dispose() }
    }
  } finally {
    // Cancel before draining: the read may be waiting on retained renderer buffers.
    reader.dispose()
    if (pending) {
      const result = await pending
      if ("sample" in result) result.sample?.dispose()
    }
  }
}

let clock: AVSampleBufferRenderSynchronizer | null = null
let video: AVSampleBufferDisplayLayer | null = null
let audio: AVSampleBufferAudioRenderer | null = null
let readers: MediaSampleReader[] = []
let initialSamples: MediaSample[] = []
let asset: AVAsset | null = null
let cancelled = false
let running: Promise<void> | null = null
let selecting = false
let alive = true
let paused = false
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
function stop() {
  cancelled = true
  initialSamples.forEach(sample => sample.dispose()); initialSamples = []
  for (const reader of readers) reader.dispose()
  readers = []
  clock?.dispose(); clock = null
  video?.dispose(); video = null
  audio?.dispose(); audio = null
  asset?.dispose(); asset = null
}
function Demo() {
  const dismiss = Navigation.useDismiss()
  const [renderer, setRenderer] = useState<AVSampleBufferDisplayLayer | null>(null)
  const [message, setMessage] = useState("Choose a local AV1 MP4 file. The demo uses no microphone or camera.")
  const [preference, setPreference] = useState<MediaDecoderPreference>("auto")
  const [details, setDetails] = useState("Select Auto, System or Software, then choose a local AV1 MP4.")
  const [busy, setBusy] = useState(false)
  const [isPaused, setPaused] = useState(false)
  const report = (text: string) => { if (alive) setMessage(text) }
  async function play() {
    if (running || selecting) return
    selecting = true; setBusy(true)
    let paths: string[]
    try { paths = await DocumentPicker.pickFiles({ types: ["public.mpeg-4"], allowsMultipleSelection: false }) }
    catch (error) { report(String(error)); return }
    finally { selecting = false; if (alive) setBusy(false) }
    if (!paths.length || !alive) return
    stop(); cancelled = false; paused = false; setPaused(false); setBusy(true)
    let completed = false
    running = (async () => {
      const capabilities = await MediaSampleReader.getCapabilities()
      if (cancelled) return
      setDetails(`AV1 hardware hint: ${capabilities.av1.hardwareDecodeSupported}; software available: ${capabilities.av1.softwareDecodeAvailable}`)
      asset = new AVAsset(paths[0])
      const [vTracks, aTracks] = await Promise.all([asset.loadTracks("video"), asset.loadTracks("audio")])
      if (cancelled) return
      clock = new AVSampleBufferRenderSynchronizer()
      const outputs: { reader: MediaSampleReader; renderer: SampleBufferRenderer; first: MediaSample | null }[] = []
      if (vTracks.length) {
        video = new AVSampleBufferDisplayLayer(); clock.addRenderer(video); setRenderer(video)
        const reader = await MediaSampleReader.create(asset, "video", { decoder: preference })
        if (cancelled) { reader.dispose(); return }
        readers.push(reader)
        const info = await reader.prepare()
        if (cancelled) return
        setDetails(`${info.codec} → ${info.decoderBackend}; ${info.width}×${info.height}; ${info.bitDepth ?? "?"}-bit ${info.pixelFormat ?? ""}`)
        outputs.push({ reader, renderer: video, first: await reader.copyNextSampleBuffer().then(sample => { if (sample) initialSamples.push(sample); return sample }) })
      }
      if (aTracks.length) {
        audio = new AVSampleBufferAudioRenderer(); audio.volume = 0.3; clock.addRenderer(audio)
        const reader = await MediaSampleReader.create(asset, "audio")
        if (cancelled) { reader.dispose(); return }
        readers.push(reader); outputs.push({ reader, renderer: audio, first: await reader.copyNextSampleBuffer().then(sample => { if (sample) initialSamples.push(sample); return sample }) })
      }
      if (cancelled) { outputs.forEach(x => x.first?.dispose()); return }
      const firstTimes = outputs.flatMap(x => x.first?.presentationTime.isNumeric ? [x.first.presentationTime] : [])
      if (!outputs.some(x => x.first)) throw new Error("No playable samples")
      const firstTime = firstTimes.length ? firstTimes.reduce((a, b) => a.lt(b) ? a : b) : MediaTime.zero()
      const origin = firstTime.lt(MediaTime.zero()) ? MediaTime.zero() : firstTime
      const activeClock = clock
      activeClock.setRate(0, origin)
      // Playback borrows the existing shared session. Activate it explicitly without
      // deactivating other script/session owners during cleanup.
      await SharedAudioSession.setActive(true)
      let lastTime = origin.seconds
      await Promise.all(outputs.map(output => pumpSamples(output.reader, async sample => {
        const duration = sample.duration.isNumeric ? Math.max(0, sample.duration.seconds) : 0
        if (sample.presentationTime.isNumeric) lastTime = Math.max(lastTime, sample.presentationTime.seconds + duration)
        // Bound submission lead and keep a user pause effective during an in-flight read.
        while (!cancelled && (paused || sample.presentationTime.isNumeric && sample.presentationTime.seconds - activeClock.currentTime.seconds > 0.10)) await wait(10)
        if (!cancelled) await output.renderer.enqueue(sample)
      }, () => cancelled)))
      // Renderers own the enqueued buffers independently of readers and assets.
      readers.forEach(reader => reader.dispose()); readers = []
      asset?.dispose(); asset = null
      // Reading EOF is not rendering completion. Keep the clock alive until the
      // final timestamp; this does not acknowledge hardware presentation.
      while (!cancelled && activeClock.currentTime.seconds < lastTime) await wait(50)
      if (!cancelled) { completed = true; report("Reached the final media timestamp. Stop or Close to release the player.") }
    })().catch(error => { if (!cancelled) report(String(error)) }).finally(() => {
      // EOF/clock time is not a presentation acknowledgement. Do not flush the
      // renderer at that boundary; keep it alive until Stop, Close or the next file.
      if (!completed || cancelled || !alive) stop()
      running = null
      if (alive) { if (!completed || cancelled) setRenderer(null); setBusy(false); setPaused(false) }
    })
    await running
  }
  function togglePause() {
    if (!clock) return
    paused = !paused; clock.setRate(paused ? 0 : 1, MediaTime.invalid()); setPaused(paused)
    report(paused ? "Paused. Resume within 30 seconds if a submission is pending, or Stop." : "Playing")
  }
  return <NavigationStack><ScrollView><VStack spacing={12} padding navigationTitle="AV1 MP4 Playback" toolbar={{ cancellationAction: <Button title="Close" action={dismiss} /> }}>
    <Text>{message}</Text>
    <Text>{details}</Text>
    <Button title="Auto" accessibilityAddTraits={preference === "auto" ? "isSelected" : []} action={() => setPreference("auto")} disabled={busy} />
    <Button title="System" accessibilityAddTraits={preference === "system" ? "isSelected" : []} action={() => setPreference("system")} disabled={busy} />
    <Button title="Software" accessibilityAddTraits={preference === "software" ? "isSelected" : []} action={() => setPreference("software")} disabled={busy} />
    {renderer ? <SampleBufferView renderer={renderer} frame={{ height: 240 }} accessibilityLabel="Video playback" /> : <Text>No video loaded</Text>}
    <Button title="Choose and play media" action={play} disabled={busy} />
    <Button title={isPaused ? "Resume" : "Pause"} action={togglePause} disabled={!busy} />
    <Button title="Stop and release" action={() => { stop(); setRenderer(null); report("Stopped") }} disabled={!busy && !renderer} />
  </VStack></ScrollView></NavigationStack>
}
async function main() {
  try { await Navigation.present({ element: <Demo /> }) }
  finally { alive = false; stop(); await running; Script.exit() }
}
main()
