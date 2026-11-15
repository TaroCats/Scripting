import { Button, List, Navigation, NavigationStack, Script, Text, useState } from "scripting"

let engine: AVAudioEngine | null = null
let environment: AVAudioEnvironmentNode | null = null
let players: AVAudioPlayerNode[] = []
let buffers: AVAudioPCMBuffer[] = []
let pending: Promise<void> | null = null
let cancelled = false
let alive = true
async function release() {
  await engine?.stop(); await engine?.dispose(); engine = null
  for (const player of players) await player.dispose(); players = []
  for (const buffer of buffers) await buffer.dispose(); buffers = []
  await environment?.dispose(); environment = null
  await SharedAudioSession.setActive(false)
}
async function stop() { cancelled = true; await engine?.stop(); await pending; await release() }
function Demo() {
  const dismiss = Navigation.useDismiss()
  const [message, setMessage] = useState("Two mono sources: left 330 Hz, right 440 Hz")
  const [busy, setBusy] = useState(false)
  const [running, setRunning] = useState(false)
  const report = (text: string) => { if (alive) setMessage(text) }
  async function move(x: number) {
    try {
      if (!environment) return
      await environment.configure({ listenerPosition: { x, y: 0, z: 0 } })
      const state = await environment.getConfiguration()
      report(`Listener: ${JSON.stringify(state.listenerPosition)}\nLeft source: (-2, 0, -2), 330 Hz\nRight source: (2, 0, -2), 440 Hz`)
    } catch (error) { report(String(error)) }
  }
  async function start() {
    if (pending || engine) return
    cancelled = false; setBusy(true)
    pending = (async () => {
      await SharedAudioSession.setCategory("playback", [])
      await SharedAudioSession.setActive(true)
      engine = await AVAudioEngine.create()
      if (cancelled) return
      environment = await AVAudioEnvironmentNode.create()
      await engine.attach(environment)
      await engine.connect(environment, await engine.getMainMixerNode())
      await environment.configure({ listenerPosition: { x: 0, y: 0, z: 0 }, distanceAttenuation: { model: "inverse", referenceDistance: 1, maximumDistance: 100, rolloffFactor: 1 } })
      const format = new AVAudioFormat({ sampleRate: 48000, channelCount: 1 })
      const config = await environment.getConfiguration()
      const algorithm = config.applicableRenderingAlgorithms.includes(2) ? 2 : config.applicableRenderingAlgorithms[0]
      for (const [x, frequency] of [[-2, 330], [2, 440]]) {
        const player = await AVAudioPlayerNode.create(); players.push(player)
        await engine.attach(player)
        const bus = (await environment.getConfiguration()).nextAvailableInputBus
        await engine.connect(player, environment, { toBus: bus, format })
        await player.setMixing({ position: { x, y: 0, z: -2 }, ...(algorithm === undefined ? {} : { renderingAlgorithm: algorithm }) })
        const data = new Float32Array(24000)
        for (let n = 0; n < data.length; n++) data[n] = Math.sin(2 * Math.PI * frequency * n / 48000) * 0.12
        const buffer = await AVAudioPCMBuffer.fromChannels([data], format); buffers.push(buffer)
        await player.scheduleBuffer(buffer, { loops: true })
      }
      if (cancelled) return
      await engine.start()
      if (cancelled) return
      for (const player of players) { if (cancelled) return; await player.play() }
      if (alive) setRunning(true)
      report(`Running · rendering algorithm ${algorithm ?? "native default"}\nMove the listener with the buttons. Headphones make the comparison easier.`)
    })().catch(async error => { report(String(error)); await release() }).finally(async () => {
      if (cancelled) await release()
      pending = null; if (alive) setBusy(false)
    })
    await pending
  }
  async function stopAndReport() { try { await stop(); if (alive) setRunning(false); report("Stopped") } catch (error) { report(String(error)) } }
  return <NavigationStack><List navigationTitle="3D Audio Scene" toolbar={{ cancellationAction: <Button title="Close" action={dismiss} /> }}>
    <Text>{message}</Text>
    <Button title="Start two sources" action={() => { void start() }} disabled={busy || running} />
    <Button title="Listener left: x = -2" action={() => { void move(-2) }} disabled={!running} />
    <Button title="Listener center: x = 0" action={() => { void move(0) }} disabled={!running} />
    <Button title="Listener right: x = 2" action={() => { void move(2) }} disabled={!running} />
    <Button title="Stop" action={() => { void stopAndReport() }} />
  </List></NavigationStack>
}
async function main() { try { await Navigation.present({ element: <Demo /> }) } finally { try { alive = false; await stop(); } finally { Script.exit() } } }
void main()
