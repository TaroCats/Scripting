import { Button, List, Navigation, NavigationStack, Path, Script, Text, useState } from "scripting"

const folder = Path.join(FileManager.temporaryDirectory, `audio-engine-export-${Date.now()}-${Math.random().toString(16).slice(2)}`)
let created = false
let engine: AVAudioEngine | null = null
let task: AVAudio.ExportTask | null = null
let pending: Promise<void> | null = null
let cancelled = false
let alive = true
const preview = new AVPlayer()
async function cancel() { cancelled = true; await task?.cancel(); await engine?.stop() }
function Demo() {
  const dismiss = Navigation.useDismiss()
  const [message, setMessage] = useState("Ready · offline rendering requires no microphone")
  const [busy, setBusy] = useState(false)
  const [resultPath, setResultPath] = useState<string | null>(null)
  const report = (text: string) => { if (alive) setMessage(text) }
  async function run(keep: boolean) {
    if (pending) return
    cancelled = false; setBusy(true); setResultPath(null); preview.dispose()
    pending = (async () => {
      let player: AVAudioPlayerNode | null = null
      let reverb: AVAudioUnitReverb | null = null
      let buffer: AVAudioPCMBuffer | null = null
      try {
        if (!created) { await FileManager.createDirectory(folder, true); created = true }
        engine = await AVAudioEngine.create()
        if (cancelled) return
        const format = new AVAudioFormat({ sampleRate: 48000, channelCount: 1 })
        player = await AVAudioPlayerNode.create(); reverb = await AVAudioUnitReverb.create()
        await engine.attach(player); await engine.attach(reverb)
        await reverb.loadFactoryPreset("mediumHall"); await reverb.configure({ wetDryMix: 30 })
        await engine.connect(player, reverb, { format })
        await engine.connect(reverb, await engine.getMainMixerNode(), { format })
        await engine.enableManualRendering({ mode: "offline", format, maximumFrameCount: 1024 })
        const samples = new Float32Array(48000)
        for (let n = 0; n < samples.length; n++) samples[n] = Math.sin(2 * Math.PI * 440 * n / 48000) * 0.1 * Math.max(0, 1 - n / 24000)
        buffer = await AVAudioPCMBuffer.fromChannels([samples], format)
        // Reuse one immutable buffer for 30 finite schedules, keeping copies small.
        for (let n = 0; n < 30; n++) { if (cancelled) return; await player.scheduleBuffer(buffer) }
        if (cancelled) return
        await engine.start(); await player.play()
        if (cancelled) return
        task = await engine.exportAudio({
          filePath: Path.join(folder, `render-${Date.now()}.caf`), settings: format.settings,
          frameCount: 48000 * 30, tailFrames: 48000 * 2, chunkFrames: 1024,
          partialFile: keep ? "keep" : "remove"
        })
        let done = false
        void task.finished.then(() => { done = true }, () => { done = true })
        while (!done && !cancelled) {
          const progress = await task.getProgress()
          report(`Rendered ${progress.renderedFrames} / ${progress.totalFrames} frames\nWritten ${progress.writtenFrames} frames`)
          await new Promise<void>(resolve => setTimeout(resolve, 50))
        }
        const result = await task.finished
        if (alive) setResultPath(result.filePath)
        report(`Finished: ${result.frameCount} frames\n${result.filePath}`)
      } catch (error) {
        const failure = error as AVAudio.Error
        if (failure.partialFilePath && alive) setResultPath(failure.partialFilePath)
        report(`${failure.code ?? "error"}: ${String(error)}${failure.partialFilePath ? `\nPartial file: ${failure.partialFilePath}` : ""}`)
      } finally {
        await task?.cancel(); task = null
        await engine?.stop(); await engine?.dispose(); engine = null
        await player?.dispose(); await reverb?.dispose(); await buffer?.dispose()
      }
    })().finally(() => { pending = null; if (alive) setBusy(false) })
    await pending
  }
  async function playResult() {
    try {
      if (!resultPath) return
      await SharedAudioSession.setCategory("playback", []); await SharedAudioSession.setActive(true)
      preview.onReadyToPlay = () => preview.play()
      preview.onEnded = () => report("Preview finished")
      if (!preview.setSource(resultPath)) throw new Error("Cannot open the exported audio")
    } catch (error) { report(String(error)) }
  }
  return <NavigationStack><List navigationTitle="Offline Export" toolbar={{ cancellationAction: <Button title="Close" action={dismiss} /> }}>
    <Text>{message}</Text>
    <Button title="Export 30 seconds: remove partial on cancel" action={() => { void run(false) }} disabled={busy} />
    <Button title="Export 30 seconds: keep partial on cancel" action={() => { void run(true) }} disabled={busy} />
    <Button title="Cancel export" action={() => { void cancel().catch(error => report(String(error))) }} />
    <Button title="Play result or partial" action={() => { void playResult() }} disabled={busy || !resultPath} />
    <Button title="Pause preview" action={() => preview.pause()} />
  </List></NavigationStack>
}
async function main() {
  try { await Navigation.present({ element: <Demo /> }) }
  finally { try { alive = false; await cancel(); await pending; preview.dispose(); await SharedAudioSession.setActive(false); if (created) await FileManager.remove(folder); } finally { Script.exit() } }
}
void main()
