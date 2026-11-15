import { Button, Navigation, NavigationStack, RealityView, Script, ScrollView, Text, VStack, useEffect, useRef, useState } from "scripting"

const source = `
#include <metal_stdlib>
using namespace metal;
struct FrameUniforms {
  float4x4 projection;
  float elapsedTime;
};

kernel void tintBand(texture2d<half, access::read> source [[texture(0)]],
                     texture2d<half, access::write> target [[texture(1)]],
                     constant FrameUniforms &frame [[buffer(2)]],
                     uint2 p [[thread_position_in_grid]]) {
  if (p.x >= target.get_width() || p.y >= target.get_height()) return;
  float x = (float(p.x) + 0.5) / float(target.get_width());
  float halfWidth = clamp(abs(frame.projection[0][0]) * 0.12, 0.08, 0.45);
  if (abs(x - 0.5) >= halfWidth) return;
  half4 color = source.read(p);
  half amount = half(mix(0.6, 1.0, smoothstep(0.0, 1.5, frame.elapsedTime)));
  target.write(half4(mix(color.rgb, color.bgr, amount), color.a), p);
}`

function Demo({ renderer, pipeline }: { renderer: RealityKit.Renderer; pipeline: Metal.ComputePipeline }) {
  const dismiss = Navigation.useDismiss()
  const [enabled, setEnabled] = useState(true)
  const [status, setStatus] = useState("Waiting for a rendered frame.")
  const lastState = useRef<"applied" | "bypassed" | "unavailable" | undefined>(undefined)
  useEffect(() => {
    let reported = false
    const listener = renderer.on("update", () => {
      const info = renderer.postProcessInfo()
      if (info.state === "pending" || info.state === "disabled") {
        lastState.current = undefined
        return
      }
      if (info.state === lastState.current) return
      if (info.state === "applied") {
        const { projection, elapsedTime } = info
        if (projection?.length !== 16 || elapsedTime === undefined || !Number.isFinite(elapsedTime)) return
        setStatus("Color effect applied. Camera projection sets the band width. Frame time blends its colors.")
        if (!reported) {
          reported = true
          console.log("Mounted RealityKit post-process ready")
        }
      } else {
        setStatus("The color effect is unavailable for this frame.")
      }
      lastState.current = info.state
    })
    return () => listener.dispose()
  }, [])

  function toggle() {
    const next = !enabled
    renderer.setPostProcess(next ? { pipeline, frameUniformIndex: 2 } : null)
    lastState.current = undefined
    setEnabled(next)
    setStatus(next ? "Waiting for a rendered frame." : "Original colors restored.")
  }

  return <NavigationStack>
    <ScrollView navigationTitle="RealityKit color effect">
      <VStack padding spacing={12}>
        <RealityView renderer={renderer} frame={{ height: 250 }} accessibilityLabel="A box centered against a contrasting background" />
        <Text>{status}</Text>
        <Button title={enabled ? "Clear color effect" : "Apply color effect"} controlSize="large" action={toggle} />
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
    library = await device.compileLibrary(source)
    pipeline = await library.makeComputePipeline("tintBand")
    scene = RealityKit.Scene.create()
    const box = RealityKit.Entity.create({ name: "Red box" })
    box.setModel(RealityKit.Mesh.primitive({ type: "box", size: [1, 1, 1] }),
      [RealityKit.Material.create({ kind: "unlit", baseColor: [1, 0, 0, 1] })])
    scene.add(box)
    renderer = RealityKit.Renderer.create(scene, { camera: { position: [0, 0, 3] }, background: [0, 0, 1, 1] })
    renderer.setPostProcess({ pipeline, frameUniformIndex: 2 })
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
