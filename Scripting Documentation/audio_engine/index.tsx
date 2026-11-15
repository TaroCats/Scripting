import { Button, List, Navigation, NavigationStack, Script, Text, useState } from "scripting"

let engine: AVAudioEngine | null = null
let player: AVAudioPlayerNode | null = null
let eq: AVAudioUnitEQ | null = null
let delay: AVAudioUnitDelay | null = null
let reverb: AVAudioUnitReverb | null = null
let buffer: AVAudioPCMBuffer | null = null
let pending: Promise<void> | null = null
let unsubscribe: (() => void) | null = null
let cancelled = false
let alive = true
async function stop() { cancelled = true; await engine?.stop() }
async function release() {
  unsubscribe?.(); unsubscribe = null
  await engine?.stop(); await engine?.dispose(); engine = null
  await player?.dispose(); player = null; await eq?.dispose(); eq = null
  await delay?.dispose(); delay = null; await reverb?.dispose(); reverb = null
  await buffer?.dispose(); buffer = null
  await SharedAudioSession.setActive(false)
}
function Demo() {
  const dismiss = Navigation.useDismiss()
  const [message, setMessage] = useState("Ready · quiet generated tones, no microphone")
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [effects, setEffects] = useState(true)
  const [quiet, setQuiet] = useState(true)
  const report = (text: string) => { if (alive) setMessage(text) }
  async function execute(action: () => Promise<void>) {
    if (pending) return
    setBusy(true)
    pending = action().catch(async error => { report(String(error)); if (alive) setReady(false); await release() }).finally(() => { pending = null; if (alive) setBusy(false) })
    await pending
  }
  async function prepare() {
    await release(); cancelled = false; setReady(false)
    await SharedAudioSession.setCategory("playback", []); await SharedAudioSession.setActive(true)
    engine = await AVAudioEngine.create()
    player = await AVAudioPlayerNode.create(); eq = await AVAudioUnitEQ.create({ numberOfBands: 1 })
    delay = await AVAudioUnitDelay.create(); reverb = await AVAudioUnitReverb.create()
    const format = new AVAudioFormat({ sampleRate: 48000, channelCount: 1 })
    for (const node of [player, eq, delay, reverb]) await engine.attach(node)
    await eq.configureBand(0, { filterType: "lowPass", frequency: 1800, bypass: false })
    await delay.configure({ delayTime: 0.2, feedback: 15, wetDryMix: 18 })
    await reverb.loadFactoryPreset("mediumHall"); await reverb.configure({ wetDryMix: 22 })
    await engine.connect(player, eq, { format }); await engine.connect(eq, delay, { format })
    await engine.connect(delay, reverb, { format }); await engine.connect(reverb, await engine.getMainMixerNode(), { format })
    await player.setMixing({ volume: 0.35 }); setQuiet(true); setEffects(true)
    const samples = new Float32Array(96000)
    for (let n = 0; n < samples.length; n++) {
      const position = n % 24000, frequency = [261.63, 329.63, 392, 523.25][Math.floor(n / 24000)]
      samples[n] = Math.sin(2 * Math.PI * frequency * n / 48000) * 0.15 * Math.exp(-position / 4500)
    }
    buffer = await AVAudioPCMBuffer.fromChannels([samples], format)
    await player.scheduleBuffer(buffer, { loops: true })
    unsubscribe = engine.onEvent(event => {
      if (event.type !== "state") { report(`${event.type}: ${event.state.state}`); if (event.state.state === "needsRebuild") { cancelled = true; setReady(false) } }
    })
    if (cancelled) { await release(); return }
    await engine.start()
    if (cancelled) { await release(); return }
    await player.play(); setReady(true); report("Playing Player → EQ → Delay → Reverb → Mixer. Stop before leaving.")
  }
  async function toggleEffects() {
    const next = !effects; await eq?.setBypass(!next); await delay?.setBypass(!next); await reverb?.setBypass(!next)
    setEffects(next); report(next ? "Effects enabled" : "Effects bypassed")
  }
  return <NavigationStack><List navigationTitle="Audio Effects" toolbar={{ cancellationAction: <Button title="Close" action={dismiss} /> }}>
    <Text>{message}</Text>
    <Button title="Build graph and play melody" action={() => { void execute(prepare) }} disabled={busy} />
    <Button title={effects ? "Bypass effects" : "Enable effects"} action={() => { void execute(toggleEffects) }} disabled={!ready || busy} />
    <Button title={quiet ? "Set volume to 60 percent" : "Set volume to 35 percent"} action={() => { void execute(async () => { await player?.setMixing({ volume: quiet ? 0.6 : 0.35 }); setQuiet(!quiet) }) }} disabled={!ready || busy} />
    <Button title="Pause melody" action={() => { void execute(async () => { await player?.pause(); report("Paused · Resume preserves the player timeline") }) }} disabled={!ready || busy} />
    <Button title="Resume melody" action={() => { void execute(async () => { await player?.play(); report("Playing") }) }} disabled={!ready || busy} />
    <Button title="Stop and release graph" action={() => { cancelled = true; void execute(async () => { await release(); setReady(false); report("Stopped · build a new graph to play again") }) }} disabled={busy} />
  </List></NavigationStack>
}
async function main() {
  try { await Navigation.present({ element: <Demo /> }) }
  finally { try { alive = false; await stop(); await pending; await release(); } finally { Script.exit() } }
}
void main()
