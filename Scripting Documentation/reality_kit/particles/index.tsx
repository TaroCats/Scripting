import { Button, Navigation, NavigationStack, RealityView, Script, ScrollView, Text, VStack, useState } from "scripting"

function ParticlePreview({ emitter, renderer }: { emitter: RealityKit.Entity; renderer: RealityKit.Renderer }) {
  const [status, setStatus] = useState("The preview is still. You can show a brief particle burst.")

  function showBurst() {
    try {
      emitter.particleAction("play")
      emitter.particleAction("burst")
      setStatus("A brief burst of turquoise particles was requested.")
    } catch (error) {
      setStatus(String(error))
    }
  }

  function clearParticles() {
    try {
      emitter.particleAction("stop")
      setStatus("The particle preview is stopped.")
    } catch (error) {
      setStatus(String(error))
    }
  }

  return <NavigationStack>
    <ScrollView navigationTitle="Particle preview">
      <VStack spacing={12} padding>
        <RealityView renderer={renderer} frame={{ height: 230 }} accessibilityHidden />
        <Text>{status}</Text>
        <Button title="Show brief particle burst" action={showBurst} />
        <Button title="Stop and clear particles" action={clearParticles} />
      </VStack>
    </ScrollView>
  </NavigationStack>
}

async function run() {
  try {
    if (!RealityKit.getCapabilities().particles) {
      await Dialog.alert({ message: "Particles require iOS 18 or later and RealityKit in the foreground app." })
      return
    }
    const scene = RealityKit.Scene.create()
    const emitter = RealityKit.Entity.create({ name: "Particle source" })
    emitter.setParticles({
      emitterShape: "box",
      emitterShapeSize: [0.22, 0.12, 0.02],
      birthLocation: "volume",
      birthDirection: "local",
      emissionDirection: [0, 1, 0],
      isEmitting: false,
      simulationState: "stop",
      speed: 0.5,
      speedVariation: 0.1,
      burstCount: 36,
      burstCountVariation: 0,
      mainEmitter: {
        birthRate: 0,
        birthRateVariation: 0,
        size: 0.055,
        sizeVariation: 0.015,
        lifeSpan: 0.6,
        lifeSpanVariation: 0,
        spreadingAngle: 0.45,
        opacityCurve: "linearFadeOut",
        isLightingEnabled: false,
        color: { type: "constant", value: { type: "single", color: [0.1, 0.9, 0.7, 1] } },
      },
    })
    scene.add(emitter)
    const renderer = RealityKit.Renderer.create(scene, {
      camera: { position: [0, 0.2, 2.3], target: [0, 0.2, 0], fieldOfView: 40 },
      background: [0.04, 0.08, 0.11, 1],
      orbit: false,
    })
    await Navigation.present({ element: <ParticlePreview emitter={emitter} renderer={renderer} /> })
  } catch (error) {
    await Dialog.alert({ title: "Particle preview", message: String(error) })
  } finally {
    Script.exit()
  }
}

void run()
