import { Button, List, Navigation, NavigationStack, Path, Script, Text, useState } from "scripting"

const folder = Path.join(FileManager.temporaryDirectory, `audio-input-${Date.now()}-${Math.random().toString(16).slice(2)}`)
let created = false
let engine: AVAudioEngine | null = null
let pending: Promise<void> | null = null
let cancelled = false
let alive = true
const preview = new AVPlayer()
async function stop() { cancelled = true; await engine?.stop() }
function Demo() {
  const dismiss = Navigation.useDismiss()
  const [message, setMessage] = useState("Microphone → high-pass EQ → output. Monitoring is off by default.")
  const [busy, setBusy] = useState(false)
  const [monitor, setMonitor] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const report = (text: string) => { if (alive) setMessage(text) }
  async function run(voiceProcessing: boolean) {
    if (pending) return
    cancelled = false; setBusy(true); setResult(null); preview.pause()
    pending = (async () => {
      let dry: AVAudio.Observation | null = null, wet: AVAudio.Observation | null = null
      let eq: AVAudioUnitEQ | null = null, writer: AVAudioFile | null = null
      let unsubscribe: (() => void) | null = null
      let written = 0, gaps = 0
      try {
        if (!created) { await FileManager.createDirectory(folder, true); created = true }
        const path = Path.join(folder, `recording-${Date.now()}.caf`)
        await SharedAudioSession.configure({ category: "playAndRecord", mode: voiceProcessing ? "voiceChat" : "default", options: ["defaultToSpeaker"] })
        await SharedAudioSession.setActive(true)
        engine = await AVAudioEngine.create()
        const input = await engine.getInputNode()
        if (cancelled) return
        if (voiceProcessing) await input.configureVoiceProcessing({ enabled: true, automaticGainControl: true })
        const format = await input.getOutputFormat(0)
        eq = await AVAudioUnitEQ.create({ numberOfBands: 1 }); await engine.attach(eq)
        await eq.configureBand(0, { filterType: "highPass", frequency: 180, bypass: false })
        const mixer = await engine.getMainMixerNode(); await mixer.setOutputVolume(monitor ? 0.15 : 0)
        await engine.connect(input, eq, { format }); await engine.connect(eq, mixer, { format })
        if (voiceProcessing) await engine.connect(mixer, await engine.getOutputNode(), { format })
        dry = await input.installTap({ format, slotCount: 8, overflow: "latest" })
        const outputFormat = await eq.getOutputFormat(0)
        wet = await eq.installTap({ format: outputFormat, slotCount: 8, overflow: "dropOldest" })
        writer = await AVAudioFile.openForWriting(path, outputFormat.settings)
        unsubscribe = engine.onEvent(event => {
          if (["configurationChanged", "interruption", "mediaServicesReset"].includes(event.type)) {
            cancelled = true
            report(`${event.type}: recording stopped. After the route/permission is ready, start a fresh recording.`)
            void engine?.stop().catch(error => report(String(error)))
          }
        })
        if (cancelled) return
        await engine.start()
        while (!cancelled) {
          let dryRMS = 0
          const before = await dry.read()
          if (before) {
            try {
              const samples = await before.buffer.copyInterleaved()
              for (const sample of samples) dryRMS += sample * sample
              dryRMS = Math.sqrt(dryRMS / Math.max(1, samples.length))
            } finally { await before.buffer.dispose() }
          }
          const after = await wet.read()
          if (after) {
            try {
              await writer.write(after.buffer); written += after.buffer.frameLength
              if (after.discontinuity) gaps++
              const samples = await after.buffer.copyInterleaved()
              let sum = 0; for (const sample of samples) sum += sample * sample
              report(`${voiceProcessing ? "Voice processing" : "Microphone"}: ${format.sampleRate} Hz / ${format.channelCount} channels\nBefore EQ RMS ${dryRMS.toFixed(4)} · after EQ RMS ${Math.sqrt(sum / Math.max(1, samples.length)).toFixed(4)}\nSaved ${written} frames · discontinuities ${gaps}\nMonitoring ${monitor ? "on at 15%" : "off"}`)
            } finally { await after.buffer.dispose() }
          }
          await new Promise<void>(resolve => setTimeout(resolve, 50))
        }
        await writer.close(); writer = null
        if (written && alive) setResult(path)
        report(`Stopped. Saved ${written} frames; discontinuities ${gaps}. A discontinuity means the file has a gap. Start again to rebuild for a new route.`)
      } finally {
        unsubscribe?.(); await engine?.stop(); await dry?.close(); await wet?.close()
        await writer?.close().catch(error => {
          const failure = error as AVAudio.Error
          report(`${String(error)}${failure.partialFilePath ? `\nRecovery file: ${failure.partialFilePath}` : ""}`)
        })
        await engine?.dispose(); engine = null; await eq?.dispose()
        await SharedAudioSession.setActive(false)
      }
    })().catch(error => report(String(error))).finally(() => { pending = null; if (alive) setBusy(false) })
    await pending
  }
  async function playResult() {
    try {
      if (!result) return
      await SharedAudioSession.setCategory("playback", []); await SharedAudioSession.setActive(true)
      preview.onReadyToPlay = () => preview.play()
      if (!preview.setSource(result)) throw Error("Cannot open the recording")
    } catch (error) { report(String(error)) }
  }
  return <NavigationStack><List navigationTitle="Record and Process" toolbar={{ cancellationAction: <Button title="Close" action={dismiss} /> }}>
    <Text>{message}</Text>
    <Text>Use headphones before enabling live monitoring to avoid acoustic feedback. Recordings are temporary; copy a file elsewhere before closing to keep it.</Text>
    <Button title={monitor ? "Disable monitoring for next recording" : "Enable quiet monitoring for next recording"} action={() => setMonitor(!monitor)} disabled={busy} />
    <Button title="Record microphone with EQ" action={() => { void run(false) }} disabled={busy} />
    <Button title="Record with voice processing and EQ" action={() => { void run(true) }} disabled={busy} />
    <Button title="Stop recording" action={() => { void stop().catch(error => report(String(error))) }} />
    <Button title="Play saved recording" action={() => { void playResult() }} disabled={busy || !result} />
    <Button title="Pause preview" action={() => preview.pause()} />
    {result ? <Text>{result}</Text> : null}
  </List></NavigationStack>
}
async function main() {
  try { await Navigation.present({ element: <Demo /> }) }
  finally { try { alive = false; await stop(); await pending; preview.dispose(); await SharedAudioSession.setActive(false); if (created) await FileManager.remove(folder); } finally { Script.exit() } }
}
void main()
