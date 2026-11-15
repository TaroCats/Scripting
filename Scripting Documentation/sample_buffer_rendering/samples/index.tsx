import { Button, Navigation, NavigationStack, Script, Text, VStack, SampleBufferView, useState } from "scripting"

let clock: AVSampleBufferRenderSynchronizer | null = null
let video: AVSampleBufferDisplayLayer | null = null
let audio: AVSampleBufferAudioRenderer | null = null
let readers: MediaSampleReader[] = []
let asset: AVAsset | null = null
let cancelled = false
let running: Promise<void> | null = null
let alive = true
let paused = false
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
function stop() {
  cancelled = true
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
  const [message, setMessage] = useState("Choose a local movie or audio file. No microphone or camera is used.")
  const [busy, setBusy] = useState(false)
  const [isPaused, setPaused] = useState(false)
  const report = (text: string) => { if (alive) setMessage(text) }
  async function play() {
    if (running) return
    const paths = await DocumentPicker.pickFiles({ types: ["public.movie", "public.audio"], allowsMultipleSelection: false })
    if (!paths.length || !alive) return
    stop(); cancelled = false; paused = false; setPaused(false); setBusy(true)
    running = (async () => {
      asset = new AVAsset(paths[0])
      const [vTracks, aTracks] = await Promise.all([asset.loadTracks("video"), asset.loadTracks("audio")])
      if (cancelled) return
      clock = new AVSampleBufferRenderSynchronizer()
      const outputs: { reader: MediaSampleReader; renderer: SampleBufferRenderer; first: MediaSample | null }[] = []
      if (vTracks.length) {
        video = new AVSampleBufferDisplayLayer(); clock.addRenderer(video); setRenderer(video)
        const reader = await MediaSampleReader.create(asset, "video")
        readers.push(reader); outputs.push({ reader, renderer: video, first: await reader.copyNextSampleBuffer() })
      }
      if (aTracks.length) {
        audio = new AVSampleBufferAudioRenderer(); audio.volume = 0.3; clock.addRenderer(audio)
        const reader = await MediaSampleReader.create(asset, "audio")
        readers.push(reader); outputs.push({ reader, renderer: audio, first: await reader.copyNextSampleBuffer() })
      }
      if (cancelled) { outputs.forEach(x => x.first?.dispose()); return }
      const firstTimes = outputs.flatMap(x => x.first?.presentationTime.isNumeric ? [x.first.presentationTime] : [])
      if (!outputs.some(x => x.first)) throw new Error("No playable samples")
      const origin = firstTimes.length ? firstTimes.reduce((a, b) => a.lt(b) ? a : b) : MediaTime.zero()
      const activeClock = clock
      activeClock.setRate(0, origin)
      // Playback borrows the existing shared session. Activate it explicitly without
      // deactivating other script/session owners during cleanup.
      await SharedAudioSession.setActive(true)
      await Promise.all(outputs.map(async output => {
        if (output.first) { try { await output.renderer.enqueue(output.first) } finally { output.first.dispose() } }
      }))
      if (cancelled) return
      activeClock.setRate(1, origin)
      report("Playing. Pause briefly, Resume, or Stop. Restart by choosing the file again.")
      let lastTime = origin.seconds
      await Promise.all(outputs.map(async output => {
        while (!cancelled) {
          while (paused && !cancelled) await wait(50)
          if (cancelled) break
          const sample = await output.reader.copyNextSampleBuffer()
          if (!sample) break
          try {
            const duration = sample.duration.isNumeric ? Math.max(0, sample.duration.seconds) : 0
            if (sample.presentationTime.isNumeric) lastTime = Math.max(lastTime, sample.presentationTime.seconds + duration)
            await output.renderer.enqueue(sample)
          } finally { sample.dispose() }
        }
      }))
      // Reading EOF is not rendering completion. Keep the clock alive until the
      // final timestamp; this does not acknowledge hardware presentation.
      while (!cancelled && activeClock.currentTime.seconds < lastTime) await wait(50)
      if (!cancelled) report("Reached the final media timestamp.")
    })().catch(error => { if (!cancelled) report(String(error)) }).finally(() => {
      stop(); running = null
      if (alive) { setRenderer(null); setBusy(false); setPaused(false) }
    })
    await running
  }
  function togglePause() {
    if (!clock) return
    paused = !paused; clock.setRate(paused ? 0 : 1, clock.currentTime); setPaused(paused)
    report(paused ? "Paused. Resume within 30 seconds if a submission is pending, or Stop." : "Playing")
  }
  return <NavigationStack><VStack spacing={12} padding navigationTitle="Sample Buffer Playback" toolbar={{ cancellationAction: <Button title="Close" action={dismiss} /> }}>
    <Text>{message}</Text>
    {renderer ? <SampleBufferView renderer={renderer} frame={{ height: 240 }} accessibilityLabel="Video playback" /> : <Text>No video loaded</Text>}
    <Button title="Choose and play media" action={play} disabled={busy} />
    <Button title={isPaused ? "Resume" : "Pause"} action={togglePause} disabled={!busy} />
    <Button title="Stop and release" action={() => { stop(); report("Stopped") }} disabled={!busy} />
  </VStack></NavigationStack>
}
async function main() {
  try { await Navigation.present({ element: <Demo /> }) }
  finally { alive = false; stop(); await running; Script.exit() }
}
main()
