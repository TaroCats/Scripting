import { Button, Navigation, NavigationStack, RealityView, Script, ScrollView, Text, VStack, useEffect, useState } from "scripting"

function makeTone(): Uint8Array {
  const rate = 24000
  const length = Math.round(rate * 0.45)
  const bytes = new Uint8Array(44 + length * 2)
  const view = new DataView(bytes.buffer)
  const writeLabel = (index: number, label: string) => {
    for (let i = 0; i < label.length; i++) bytes[index + i] = label.charCodeAt(i)
  }
  writeLabel(0, "RIFF")
  view.setUint32(4, bytes.length - 8, true)
  writeLabel(8, "WAVE")
  writeLabel(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeLabel(36, "data")
  view.setUint32(40, length * 2, true)
  for (let i = 0; i < length; i++) {
    const fade = Math.min(1, i / 400, (length - 1 - i) / 1000)
    const value = Math.round(6700 * fade * Math.sin(i * 2 * Math.PI * 550 / rate))
    view.setInt16(44 + i * 2, value, true)
  }
  return bytes
}

function AudioDemo({ renderer, emitter, playback }: {
  renderer: RealityKit.Renderer
  emitter: RealityKit.Entity
  playback: RealityKit.AudioPlayback
}) {
  const [side, setSide] = useState("left")
  const [status, setStatus] = useState("Ready to play a short tone.")

  useEffect(() => {
    const subscription = playback.onCompleted(() => setStatus("The tone finished."))
    return () => subscription.dispose()
  }, [playback])

  function play() {
    try {
      playback.stop()
      playback.play()
      setStatus("Playing the tone.")
    } catch (error) {
      setStatus(String(error))
    }
  }

  function move() {
    try {
      const next = side === "left" ? "right" : "left"
      emitter.setTransform({ position: [next === "left" ? -0.65 : 0.65, 0, 0] })
      setSide(next)
    } catch (error) {
      setStatus(String(error))
    }
  }

  return <NavigationStack>
    <ScrollView navigationTitle="Spatial audio">
      <VStack spacing={12} padding>
        <RealityView renderer={renderer} frame={{ height: 240 }} accessibilityHidden />
        <Text>{`Sound source on the ${side}.`}</Text>
        <Text>{status}</Text>
        <Button title="Play tone" action={play} />
        <Button title={side === "left" ? "Move source right" : "Move source left"} action={move} />
      </VStack>
    </ScrollView>
  </NavigationStack>
}

async function run() {
  const file = FileManager.temporaryDirectory + "/RealityAudio-" + UUID.string() + ".wav"
  try {
    const capabilities = RealityKit.getCapabilities()
    if (!capabilities.entityAudio) {
      await Dialog.alert({ message: "Entity audio requires RealityKit in the foreground app." })
      return
    }
    await FileManager.writeAsBytes(file, makeTone())
    const tone = await RealityKit.AudioResource.load(file)
    const scene = RealityKit.Scene.create()
    const emitter = RealityKit.Entity.create({ name: "Tone", transform: { position: [-0.65, 0, 0] } })
    emitter.setModel(RealityKit.Mesh.primitive({ type: "sphere", radius: 0.22 }), [
      RealityKit.Material.create({ kind: "unlit", baseColor: [0.34, 0.72, 0.98, 1] }),
    ])
    if (capabilities.spatialAudioConfiguration) emitter.setAudioSource({ kind: "spatial", reverbLevel: "silent" })
    scene.add(emitter)
    const renderer = RealityKit.Renderer.create(scene, { background: [0.12, 0.15, 0.21, 1] })
    const playback = emitter.prepareAudio(tone, { gain: -8 })
    try {
      await Navigation.present({ element: <AudioDemo renderer={renderer} emitter={emitter} playback={playback} /> })
    } finally {
      playback.dispose()
      tone.dispose()
      scene.dispose()
    }
  } catch (error) {
    console.error(String(error))
    await Dialog.alert({ title: "Spatial audio", message: String(error) })
  } finally {
    if (FileManager.existsSync(file)) await FileManager.remove(file)
    Script.exit()
  }
}

void run()
