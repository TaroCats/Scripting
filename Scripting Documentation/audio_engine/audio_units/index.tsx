import { AudioUnitView, Button, List, Navigation, NavigationStack, Script, Text, useState } from "scripting"

let engine: AVAudioEngine | null = null
let unit: AVAudioUnit | null = null
let player: AVAudioPlayerNode | null = null
let buffer: AVAudioPCMBuffer | null = null
let editor: AVAudioUnitViewController | null = null
let observer: AVAudio.ParameterObserver | null = null
let pending: Promise<void> | null = null
let polling: Promise<void> | null = null
let pollActive = false
let alive = true
let savedState: Uint8Array | null = null
function flatten(node: AVAudio.ParameterGroup | AVAudio.Parameter): AVAudio.Parameter[] {
  return "address" in node ? [node] : node.children.flatMap(flatten)
}
async function release() {
  pollActive = false; await polling; polling = null
  await observer?.close(); observer = null; await editor?.dispose(); editor = null
  await engine?.stop(); await engine?.dispose(); engine = null
  await player?.dispose(); player = null; await unit?.dispose(); unit = null
  await buffer?.dispose(); buffer = null; savedState = null
  await SharedAudioSession.setActive(false)
}
function Demo() {
  const dismiss = Navigation.useDismiss()
  const [message, setMessage] = useState("Find an effect or instrument installed on this device.")
  const [components, setComponents] = useState<readonly AVAudio.Component[]>([])
  const [parameters, setParameters] = useState<readonly AVAudio.Parameter[]>([])
  const [values, setValues] = useState<Readonly<Record<string, number>>>({})
  const [presets, setPresets] = useState<readonly AVAudio.Preset[]>([])
  const [controller, setController] = useState<AVAudioUnitViewController | null>(null)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [instrument, setInstrument] = useState(false)
  const report = (text: string) => { if (alive) setMessage(text) }
  async function refresh() {
    if (!unit) return
    const entries = await unit.getParameterValues(parameters.map(parameter => parameter.address))
    if (alive) setValues(Object.fromEntries(entries.map(entry => [entry.address, entry.value])))
  }
  async function execute(action: () => Promise<void>) {
    if (pending) return
    setBusy(true)
    pending = action().catch(error => report(`${(error as AVAudio.Error).code ?? "error"}: ${String(error)}`)).finally(() => { pending = null; if (alive) setBusy(false) })
    await pending
  }
  async function find(type: number) {
    const entries = await AVAudioUnit.findComponents({ type })
    setComponents(entries); report(`${entries.length} registered components. Tap a name to load it. Loading can still fail.`)
  }
  async function load(component: AVAudio.Component) {
    setController(null); setReady(false); await release(); setParameters([]); setValues({}); setPresets([])
    const description = { type: component.type, subtype: component.subtype, manufacturer: component.manufacturer }
    try {
      const isInstrument = component.type === 0x61756d75
      unit = isInstrument ? await AVAudioUnitMIDIInstrument.create(description) : await AVAudioUnit.instantiate(description)
      setInstrument(isInstrument)
      const tree = await unit.getParameterTree(), metadata = tree ? flatten(tree) : []
      // A concise native-control alternative remains usable without a plugin editor.
      const visible = metadata.slice(0, 8); setParameters(visible)
      const current = await unit.getParameterValues(visible.map(parameter => parameter.address)); setValues(Object.fromEntries(current.map(entry => [entry.address, entry.value])))
      setPresets((await unit.getFactoryPresets()).slice(0, 12))
      const buses = await unit.getBusState()
      await SharedAudioSession.setCategory("playback", []); await SharedAudioSession.setActive(true)
      engine = await AVAudioEngine.create(); await engine.attach(unit)
      const format = new AVAudioFormat({ sampleRate: 48000, channelCount: 2 })
      await engine.connect(unit, await engine.getMainMixerNode(), { format })
      if (!isInstrument) {
        player = await AVAudioPlayerNode.create(); await engine.attach(player); await engine.connect(player, unit, { format })
        const samples = new Float32Array(48000)
        for (let frame = 0; frame < samples.length; frame++) samples[frame] = Math.sin(2 * Math.PI * 440 * frame / 48000) * 0.1 * Math.exp(-(frame % 12000) / 2500)
        buffer = await AVAudioPCMBuffer.fromChannels([samples, samples], format); await player.scheduleBuffer(buffer, { loops: true }); await player.setMixing({ volume: 0.3 })
      }
      await engine.start(); setReady(true)
      editor = await unit.requestView(); setController(editor)
      report(`${component.name}\n${buses.inputs.length} inputs / ${buses.outputs.length} outputs · latency ${buses.latency}s\n${editor ? "Native editor below." : "No native editor. Use the parameter controls."}`)
      if (tree) {
        observer = await unit.observeParameters({ queueSize: 128 }); const activeObserver = observer, activeUnit = unit
        pollActive = true
        polling = (async () => {
          while (pollActive && alive) {
            const changes = await activeObserver.next()
            if (changes?.length) {
              const entries = await activeUnit.getParameterValues(visible.map(parameter => parameter.address))
              if (alive) setValues(Object.fromEntries(entries.map(entry => [entry.address, entry.value])))
            }
            await new Promise<void>(resolve => setTimeout(resolve, 200))
          }
        })().catch(error => { pollActive = false; report(`Parameter observation stopped: ${String(error)}. Reload the component if its tree changed.`) })
      }
    } catch (error) { setController(null); setReady(false); await release(); throw error }
  }
  async function setParameter(parameter: AVAudio.Parameter, fraction: number) {
    await unit?.setParameterValues([{ address: parameter.address, value: parameter.minimum + (parameter.maximum - parameter.minimum) * fraction }]); await refresh()
  }
  return <NavigationStack><List navigationTitle="Audio Unit Host" toolbar={{ cancellationAction: <Button title="Close" action={dismiss} /> }}>
    <Text>{message}</Text>
    <Button title="Find effects" action={() => { void execute(() => find(0x61756678)) }} disabled={busy} />
    <Button title="Find instruments" action={() => { void execute(() => find(0x61756d75)) }} disabled={busy} />
    {components.map(component => <Button key={`${component.type}-${component.subtype}-${component.manufacturer}`} title={`Load ${component.name}`} action={() => { void execute(() => load(component)) }} disabled={busy} />)}
    <Button title={instrument ? "Play instrument note 60" : "Play generated tone through effect"} action={() => { void execute(async () => { if (instrument) await (unit as AVAudioUnitMIDIInstrument).startNote(60, 80); else await player?.play() }) }} disabled={!ready || busy} />
    <Button title="Stop notes or pause tone" action={() => { void execute(async () => { if (instrument) await (unit as AVAudioUnitMIDIInstrument).allNotesOff(); else await player?.pause() }) }} disabled={!ready || busy} />
    <Button title="Save state snapshot in memory" action={() => { void execute(async () => { if (unit) savedState = await unit.getStateData({ forDocument: true }); report("State snapshot saved until this component is unloaded") }) }} disabled={!ready || busy} />
    <Button title="Restore saved state" action={() => { void execute(async () => { if (unit && savedState) { pollActive = false; await polling; polling = null; await observer?.close(); observer = null; await unit.setStateData(savedState, { forDocument: true }); await refresh(); report("Restored. Reload if the plugin changed its parameter tree.") } else report("Save a state snapshot first") }) }} disabled={!ready || busy} />
    {presets.map(preset => <Button key={preset.number} title={`Factory preset: ${preset.name}`} action={() => { void execute(async () => { await unit?.setCurrentPreset(preset); await refresh(); report(`Selected preset ${preset.name}. Plugin changes may arrive asynchronously.`) }) }} disabled={!ready || busy} />)}
    {parameters.map(parameter => <><Text key={`${parameter.address}-value`}>{`${parameter.name}: ${values[parameter.address] ?? "—"} · ${parameter.address}`}</Text>
      <Button key={`${parameter.address}-min`} title={`Set ${parameter.name} to minimum`} action={() => { void execute(() => setParameter(parameter, 0)) }} disabled={!ready || busy || !(parameter.flags & 0x80000000)} />
      <Button key={`${parameter.address}-mid`} title={`Set ${parameter.name} to midpoint`} action={() => { void execute(() => setParameter(parameter, 0.5)) }} disabled={!ready || busy || !(parameter.flags & 0x80000000)} />
      <Button key={`${parameter.address}-max`} title={`Set ${parameter.name} to maximum`} action={() => { void execute(() => setParameter(parameter, 1)) }} disabled={!ready || busy || !(parameter.flags & 0x80000000)} />
    </>)}
    {controller ? <AudioUnitView controller={controller} frame={{ minHeight: 280 }} /> : null}
    <Button title="Unload component and release audio" action={() => { void execute(async () => { setController(null); setReady(false); await release(); setParameters([]); report("Unloaded") }) }} disabled={busy} />
  </List></NavigationStack>
}
async function main() { try { await Navigation.present({ element: <Demo /> }) } finally { try { alive = false; await engine?.stop(); await pending; await release(); } finally { Script.exit() } } }
void main()
