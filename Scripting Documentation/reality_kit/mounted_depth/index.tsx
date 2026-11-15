import { Button, Navigation, NavigationStack, RealityView, Script, ScrollView, Text, VStack, useEffect, useState } from "scripting"

const source = `
#include <metal_stdlib>
using namespace metal;

kernel void tintByDepth(texture2d<half, access::read> source [[texture(0)]],
                        texture2d<half, access::write> target [[texture(1)]],
                        depth2d<float, access::read> depth [[texture(2)]],
                        uint2 p [[thread_position_in_grid]]) {
  if (p.x >= target.get_width() || p.y >= target.get_height()) return;
  float z = depth.read(p);
  if (!isfinite(z) || z <= 0.0) return;
  half amount = half(smoothstep(0.0025, 0.004, z));
  half3 tint = mix(half3(0.08, 0.30, 0.90), half3(0.96, 0.35, 0.08), amount);
  target.write(half4(tint, source.read(p).a), p);
}`

function Demo({ renderer, pipeline }: { renderer: RealityKit.Renderer; pipeline: Metal.ComputePipeline }) {
  const dismiss = Navigation.useDismiss()
  const [enabled, setEnabled] = useState(true)
  const [status, setStatus] = useState("Waiting for a rendered frame.")

  useEffect(() => {
    let lastState: RealityKit.MountedPostProcessInfo["state"] | undefined
    let reported = false
    const listener = renderer.on("update", () => {
      const { state } = renderer.postProcessInfo()
      if (state === lastState) return
      lastState = state
      if (state === "applied") setStatus("Depth effect applied. The nearer and farther planes have different tints.")
      if (state === "bypassed") setStatus("The depth effect was skipped. Showing the original colors.")
      if (state === "unavailable") setStatus("Could not transfer the original colors for this frame.")
      if (!reported && (state === "applied" || state === "bypassed")) {
        reported = true
        console.log("Mounted RealityKit depth demo ready")
      }
    })
    return () => listener.dispose()
  }, [])

  function toggle() {
    const next = !enabled
    renderer.setPostProcess(next ? { pipeline, sourceDepthIndex: 2 } : null)
    setEnabled(next)
    setStatus(next ? "Waiting for a rendered frame." : "Showing the original colors.")
  }

  return <NavigationStack>
    <ScrollView navigationTitle="RealityKit depth effect">
      <VStack padding spacing={12}>
        <RealityView renderer={renderer} frame={{ height: 280 }} accessibilityLabel="Two planes at different distances from the camera" />
        <Text>{status}</Text>
        <Button title={enabled ? "Clear depth effect" : "Apply depth effect"} controlSize="large" action={toggle} />
        <Button title="Done" controlSize="large" action={dismiss} />
      </VStack>
    </ScrollView>
  </NavigationStack>
}

async function run() {
  let library: Metal.Library | undefined
  let pipeline: Metal.ComputePipeline | undefined
  let scene: RealityKit.Scene | undefined
  let renderer: RealityKit.Renderer | undefined
  try {
    const device = Metal.Device.getDefault()
    if (!device) throw Error("No Metal device is available.")
    library = await device.compileLibrary(source, { enableFastMath: false })
    pipeline = await library.makeComputePipeline("tintByDepth")
    scene = RealityKit.Scene.create()
    const planeMesh = RealityKit.Mesh.primitive({ type: "box", size: [0.85, 1.1, 0.01] })
    const material = RealityKit.Material.create({ kind: "unlit", baseColor: [0.5, 0.5, 0.5, 1] })
    for (const [x, z] of [[-0.53, 0.5], [0.73, -1]]) {
      const plane = RealityKit.Entity.create({ transform: { position: [x, 0, z] } })
      plane.setModel(planeMesh, [material])
      scene.add(plane)
    }
    renderer = RealityKit.Renderer.create(scene, { camera: { position: [0, 0, 3] }, background: [0.04, 0.04, 0.04, 1] })
    renderer.setPostProcess({ pipeline, sourceDepthIndex: 2 })
    await Navigation.present({ element: <Demo renderer={renderer} pipeline={pipeline} /> })
  } catch (error) {
    console.error(error)
  } finally {
    renderer?.dispose()
    scene?.dispose()
    pipeline?.dispose()
    library?.dispose()
    Script.exit()
  }
}

void run()
