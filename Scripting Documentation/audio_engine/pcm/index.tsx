import { Button, List, Navigation, NavigationStack, Path, Script, Text, useState } from "scripting"

const folder = Path.join(FileManager.temporaryDirectory, `audio-pcm-${Date.now()}-${Math.random().toString(16).slice(2)}`)
let created = false
let pending: Promise<void> | null = null
let alive = true
function Demo() {
  const dismiss = Navigation.useDismiss()
  const [message, setMessage] = useState("Ready: no microphone or audio output")
  const [busy, setBusy] = useState(false)
  const report = (text: string) => { if (alive) setMessage(text) }
  async function run(withFile: boolean) {
    if (pending) return
    setBusy(true)
    pending = (async () => {
      // Complete asynchronous authorization before synchronous value constructors.
      await AVAudioEngine.capabilities()
      const format = new AVAudioFormat({ sampleRate: 48000, channelCount: 2, sampleType: "float32", interleaved: false })
      let buffer: AVAudioPCMBuffer | null = null, copied: AVAudioPCMBuffer | null = null
      let converted: AVAudioPCMBuffer | AVAudioCompressedBuffer | null = null, read: AVAudioPCMBuffer | null = null
      let converter: AVAudioConverter | null = null, writer: AVAudioFile | null = null, reader: AVAudioFile | null = null
      try {
        const left = new Float32Array([0.1, 0.2, 0.3, 0.4]), right = new Float32Array([-0.1, -0.2, -0.3, -0.4])
        buffer = await AVAudioPCMBuffer.fromChannels([left, right], format)
        left.fill(0); right.fill(0); copied = await buffer.copy(); await buffer.dispose(); buffer = null
        const packed = await copied.copyInterleaved(), channels = await copied.copyChannels()
        const int16 = new AVAudioFormat({ sampleRate: 48000, channelCount: 2, sampleType: "int16", interleaved: true })
        converter = await AVAudioConverter.create(format, int16, { primeMethod: "none" })
        const result = await converter.convert([{ buffer: copied, endOfStream: true }], 256); converted = result.buffer
        if (!(converted instanceof AVAudioPCMBuffer)) throw Error("Expected PCM conversion output")
        const integers = await converted.copyInterleaved()
        let fileMessage = ""
        if (withFile) {
          if (!created) { await FileManager.createDirectory(folder, true); created = true }
          const path = Path.join(folder, `roundtrip-${Date.now()}.caf`)
          writer = await AVAudioFile.openForWriting(path, format.settings); await writer.write(copied); await writer.close(); writer = null
          reader = await AVAudioFile.openForReading(path); read = await reader.read(4)
          const restored = await read.copyInterleaved()
          if (read.frameLength !== 4 || restored.some((value, index) => Math.abs(value - packed[index]) > 0.000001)) throw Error("File PCM round trip mismatch")
          await read.dispose(); read = null; await reader.seek(4); read = await reader.read(4)
          if (read.frameLength !== 0) throw Error("Expected zero frames at EOF")
          const state = await reader.getState(); fileMessage = `\nCAF round trip: ${state.length} frames, EOF ${read.frameLength}\n${path}`
        }
        report(`Independent copy: ${copied.frameLength} frames, ${copied.format.channelCount} channels\nPacked: ${Array.from(packed).map(v => v.toFixed(1)).join(", ")}\nLeft: ${Array.from(channels[0]).map(v => v.toFixed(1)).join(", ")}\nConverted Int16: ${Array.from(integers).join(", ")}${fileMessage}`)
      } finally {
        await writer?.close().catch(error => { const failure = error as AVAudio.Error; report(`${String(error)}${failure.partialFilePath ? `\nRecovery: ${failure.partialFilePath}` : ""}`) })
        await reader?.close(); await converter?.dispose(); await converted?.dispose(); await read?.dispose(); await buffer?.dispose(); await copied?.dispose()
      }
    })().catch(error => report(String(error))).finally(() => { pending = null; if (alive) setBusy(false) })
    await pending
  }
  return <NavigationStack><List navigationTitle="PCM, Files and Conversion" toolbar={{ cancellationAction: <Button title="Close" action={dismiss} /> }}>
    <Text>{message}</Text>
    <Button title="Copy PCM and convert Float32 to Int16" action={() => { void run(false) }} disabled={busy} />
    <Button title="Also write and read a temporary CAF" action={() => { void run(true) }} disabled={busy} />
  </List></NavigationStack>
}
async function main() { try { await Navigation.present({ element: <Demo /> }) } finally { try { alive = false; await pending; if (created) await FileManager.remove(folder); } finally { Script.exit() } } }
void main()
