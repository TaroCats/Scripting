import { Button, List, Navigation, NavigationStack, Script, Text, useState } from "scripting"

let engine: AVAudioEngine | null = null
let players: AVAudioPlayerNode[] = []
let buffers: AVAudioPCMBuffer[] = []
let pending: Promise<void> | null = null
let cancelled = false
let alive = true
async function release() {
  await engine?.stop(); await engine?.dispose(); engine = null
  for (const player of players) await player.dispose(); players = []
  for (const buffer of buffers) await buffer.dispose(); buffers = []
  await SharedAudioSession.setActive(false)
}
async function stop() { cancelled = true; await engine?.stop(); await pending; await release() }
async function sharedStartTime(output: AVAudioOutputNode) {
  for (let n = 0; n < 20; n++) {
    const time = await output.getLastRenderTime()
    if (time?.hostTime) return new AVAudioTime({ hostTime: String(BigInt(time.hostTime) + BigInt(AVAudioTime.hostTimeForSeconds(0.5))) })
    await new Promise<void>(resolve => setTimeout(resolve, 25))
  }
  throw new Error("The device did not provide a valid render clock")
}
function Demo() {
  const dismiss = Navigation.useDismiss()
  const [message, setMessage] = useState("Ready · left 330 Hz / right 660 Hz")
  const [busy, setBusy] = useState(false)
  const [running, setRunning] = useState(false)
  const report = (text: string) => { if (alive) setMessage(text) }
  async function start(stagger: boolean) {
    if (pending || engine) return
    cancelled = false; setBusy(true)
    pending = (async () => {
      await SharedAudioSession.setCategory("playback", [])
      await SharedAudioSession.setActive(true)
      engine = await AVAudioEngine.create()
      if (cancelled) return
      const format = new AVAudioFormat({ sampleRate: 48000, channelCount: 1 })
      const mixer = await engine.getMainMixerNode()
      for (let index = 0; index < 2; index++) {
        const player = await AVAudioPlayerNode.create(); players.push(player)
        await engine.attach(player); await engine.connect(player, mixer, { format })
        await player.setMixing({ volume: 0.7, pan: index === 0 ? -1 : 1 })
        const data = new Float32Array(24000), frequency = index === 0 ? 330 : 660
        for (let n = 0; n < data.length; n++) data[n] = Math.sin(2 * Math.PI * frequency * n / 48000) * 0.1
        const buffer = await AVAudioPCMBuffer.fromChannels([data], format); buffers.push(buffer)
        const ticket = await player.scheduleBuffer(buffer, {
          loops: true, completionType: "dataRendered",
          ...(stagger && index === 1 ? { at: new AVAudioTime({ sampleTime: 12000, sampleRate: 48000 }) } : {})
        })
        void ticket.finished.then(result => report(`Track ${index + 1}: ${JSON.stringify(result)}`))
      }
      if (cancelled) return
      await engine.start()
      const time = await sharedStartTime(await engine.getOutputNode())
      if (cancelled) return
      await Promise.all(players.map(player => player.play(time)))
      if (alive) setRunning(true)
      report(`Scheduled both players at host tick ${time.hostTime}\nSecond track offset: ${stagger ? "12000 samples / 250 ms" : "0 samples"}\nLooping until Stop; dataRendered tickets remain pending for loops.`)
    })().catch(async error => { report(String(error)); await release() }).finally(async () => {
      if (cancelled) await release()
      pending = null; if (alive) setBusy(false)
    })
    await pending
  }
  async function panSecond(pan: number) {
    try { await players[1]?.setMixing({ pan }); report(`Second track pan: ${pan}`) } catch (error) { report(String(error)) }
  }
  async function stopAndReport() { try { await stop(); if (alive) setRunning(false); report("Stopped; loop tickets cancelled") } catch (error) { report(String(error)) } }
  return <NavigationStack><List navigationTitle="Multitrack Scheduling" toolbar={{ cancellationAction: <Button title="Close" action={dismiss} /> }}>
    <Text>{message}</Text>
    <Button title="Start tracks together" action={() => { void start(false) }} disabled={busy || running} />
    <Button title="Start second track 250 ms later" action={() => { void start(true) }} disabled={busy || running} />
    <Button title="Second track: center pan" action={() => { void panSecond(0) }} disabled={!running} />
    <Button title="Second track: right pan" action={() => { void panSecond(1) }} disabled={!running} />
    <Button title="Stop" action={() => { void stopAndReport() }} />
  </List></NavigationStack>
}
async function main() { try { await Navigation.present({ element: <Demo /> }) } finally { try { alive = false; await stop(); } finally { Script.exit() } } }
void main()
