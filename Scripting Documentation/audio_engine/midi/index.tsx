import { Button, List, Navigation, NavigationStack, Path, Script, Text, useState } from "scripting"

const folder = Path.join(FileManager.temporaryDirectory, `audio-engine-midi-${Date.now()}-${Math.random().toString(16).slice(2)}`)
let created = false
let engine: AVAudioEngine | null = null
let sampler: AVAudioUnitSampler | null = null
let sequence: AVAudioSequencer | null = null
let tracks: readonly AVMusicTrack[] = []
let pending: Promise<void> | null = null
let alive = true
async function stop() { await sequence?.stop(); await sampler?.allNotesOff() }
async function release() {
  await stop(); await sequence?.dispose(); sequence = null; tracks = []
  await engine?.stop(); await engine?.dispose(); engine = null
  await sampler?.dispose(); sampler = null
  await SharedAudioSession.setActive(false)
}
function Demo() {
  const dismiss = Navigation.useDismiss()
  const [message, setMessage] = useState("Prepare the local sample first. No download or microphone needed.")
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [bpm, setBpm] = useState(120)
  const [loop, setLoop] = useState(false)
  const report = (text: string) => { if (alive) setMessage(text) }
  async function execute(action: () => Promise<void>) {
    if (pending) return
    setBusy(true)
    pending = action().catch(error => report(String(error))).finally(() => { pending = null; if (alive) setBusy(false) })
    await pending
  }
  async function prepare() {
    await release()
    if (!created) { await FileManager.createDirectory(folder, true); created = true }
    await AVAudioEngine.capabilities()
    const format = new AVAudioFormat({ sampleRate: 48000, channelCount: 1 })
    const samples = new Float32Array(24000)
    for (let n = 0; n < samples.length; n++) samples[n] = Math.sin(2 * Math.PI * 261.6256 * n / 48000) * 0.18 * Math.exp(-n / 7000)
    const buffer = await AVAudioPCMBuffer.fromChannels([samples], format)
    const path = Path.join(folder, "local-tone.caf")
    const file = await AVAudioFile.openForWriting(path, format.settings, { overwrite: true })
    try { await file.write(buffer) } finally { await file.close(); await buffer.dispose() }
    if (!alive) return
    await SharedAudioSession.setCategory("playback", []); await SharedAudioSession.setActive(true)
    engine = await AVAudioEngine.create(); sampler = await AVAudioUnitSampler.create()
    await sampler.loadAudioFiles([path]); await engine.attach(sampler)
    await engine.connect(sampler, await engine.getMainMixerNode()); await sampler.setMixing({ volume: 0.4 })
    sequence = await AVAudioSequencer.create(engine)
    const track = await sequence.createTrack(); tracks = [track]
    await track.configure({ destination: sampler, lengthInBeats: 4 })
    await track.addEvents([60, 64, 67, 72].map((note, beat) => ({ beat, event: { type: "note" as const, channel: 0, note, velocity: 90, duration: 0.5 } })))
    await (await sequence.getTempoTrack()).addEvents([{ beat: 0, event: { type: "extendedTempo", bpm: 120 } }])
    await engine.start()
    if (alive) { setReady(true); setBpm(120); setLoop(false) }
    report("Ready: press Note On / Note Off, or start the four-beat sequence")
  }
  async function note(number: number, on: boolean) {
    if (!sampler) return
    if (on) await sampler.startNote(number, 90, 0); else await sampler.stopNote(number, 0)
    report(`MIDI note ${number}: ${on ? "on" : "off"}`)
  }
  async function tempo(value: number) {
    if (!sequence) return
    const wasPlaying = (await sequence.getState()).isPlaying
    await stop()
    const track = await sequence.getTempoTrack()
    await track.clear({ startBeat: 0, endBeat: Number.MAX_SAFE_INTEGER })
    await track.addEvents([{ beat: 0, event: { type: "extendedTempo", bpm: value } }])
    await sequence.setPosition({ beats: 0 })
    if (alive) setBpm(value)
    if (wasPlaying) await sequence.start()
    report(`Tempo ${value} BPM; sequence reset to beat 0`)
  }
  async function toggleLoop() {
    for (const track of tracks) await track.configure({ loopStart: 0, loopDuration: 4, numberOfLoops: -1, loopEnabled: !loop })
    if (alive) setLoop(!loop)
    report(`Four-beat loop ${!loop ? "enabled" : "disabled"}`)
  }
  async function importMIDI() {
    if (!sequence || !sampler) return
    await stop()
    const paths = await DocumentPicker.pickFiles({ types: ["public.midi-audio"] })
    if (!paths[0] || !alive) return
    await sequence.load(paths[0], { preserveTracks: true })
    // load replaces tracks. Obtain fresh handles and bind each destination again.
    tracks = await sequence.getTracks()
    for (const track of tracks) await track.configure({ destination: sampler })
    if (alive) setLoop(false)
    report(`Imported ${tracks.length} tracks; native MIDI tempo map retained`)
  }
  async function loadSoundBank() {
    if (!sampler) return
    await stop()
    const paths = await DocumentPicker.pickFiles({ types: ["public.data"] })
    if (!paths[0] || !alive) return
    await sampler.loadSoundBank(paths[0], { program: 0, bankMSB: 121, bankLSB: 0 })
    report("Loaded selected SoundFont/DLS bank, melodic program 0")
  }
  async function exportMIDI() {
    if (!sequence) return
    const path = Path.join(folder, `sequence-${Date.now()}.mid`)
    await sequence.write(path, { timeResolution: 960 })
    report(`MIDI exported with 960 ticks per quarter note\n${path}`)
  }
  return <NavigationStack><List navigationTitle="Sampler and MIDI" toolbar={{ cancellationAction: <Button title="Close" action={dismiss} /> }}>
    <Text>{message}</Text>
    <Button title="Prepare generated local sample" action={() => { void execute(prepare) }} disabled={busy} />
    {[60, 64, 67].map(number => <Button key={`on-${number}`} title={`Note ${number} On`} action={() => { void execute(() => note(number, true)) }} disabled={!ready || busy} />)}
    {[60, 64, 67].map(number => <Button key={`off-${number}`} title={`Note ${number} Off`} action={() => { void execute(() => note(number, false)) }} disabled={!ready || busy} />)}
    <Button title="Sustain On" action={() => { void execute(async () => { await sampler?.sendController(64, 127, 0); report("Sustain enabled") }) }} disabled={!ready || busy} />
    <Button title="Sustain Off" action={() => { void execute(async () => { await sampler?.sendController(64, 0, 0); report("Sustain disabled") }) }} disabled={!ready || busy} />
    <Button title="Start sequence from beat 0" action={() => { void execute(async () => { await sequence?.setPosition({ beats: 0 }); await sequence?.prepareToPlay(); await sequence?.start(); report("Sequence started") }) }} disabled={!ready || busy} />
    <Button title={`Tempo: ${bpm} BPM — use ${bpm === 120 ? 90 : 120}`} action={() => { void execute(() => tempo(bpm === 120 ? 90 : 120)) }} disabled={!ready || busy} />
    <Button title={`Loop: ${loop ? "On" : "Off"}`} action={() => { void execute(toggleLoop) }} disabled={!ready || busy} />
    <Button title="Stop sequence and all notes" action={() => { void stop().then(() => report("Stopped; sustain and voices cleared")).catch(error => report(String(error))) }} />
    <Button title="Import MIDI file" action={() => { void execute(importMIDI) }} disabled={!ready || busy} />
    <Button title="Load selected SoundFont or DLS" action={() => { void execute(loadSoundBank) }} disabled={!ready || busy} />
    <Button title="Export MIDI file" action={() => { void execute(exportMIDI) }} disabled={!ready || busy} />
  </List></NavigationStack>
}
async function main() {
  try { await Navigation.present({ element: <Demo /> }) }
  finally { try { alive = false; await stop(); await pending; await release(); if (created) await FileManager.remove(folder); } finally { Script.exit() } }
}
void main()
