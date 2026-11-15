import {
  Button, Navigation, NavigationStack, RealityView, Script, ScrollView, Text, VStack,
  useEffect, useRef, useState,
} from "scripting"

const source = `
#include <metal_stdlib>
using namespace metal;

kernel void move_instance(const device float4x4 *source [[buffer(0)]],
                          device float4x4 *target [[buffer(1)]],
                          constant float &deltaX [[buffer(2)]],
                          uint id [[thread_position_in_grid]]) {
  if (id != 0) return;
  float4x4 transform = source[1];
  transform[3].x += deltaX;
  target[1] = transform;
}
`

function shiftMiddle(instances: RealityKit.InstanceData, pipeline: Metal.ComputePipeline, deltaX: number,
                     count: number, signal?: AbortSignal) {
  return instances.compute({
    pipeline,
    sourceBufferIndex: 0,
    targetBufferIndex: 1,
    start: 1,
    length: 1,
    count,
    expectedRevision: instances.info.revision,
    signal,
    dispatch: {
      threadgroups: { width: 1 },
      threadsPerThreadgroup: { width: 1 },
      bytes: [{ index: 2, data: new Float32Array([deltaX]) }],
    },
  })
}

function InstancePreview({ instances, pipeline, renderer }: {
  instances: RealityKit.InstanceData
  pipeline: Metal.ComputePipeline
  renderer: RealityKit.Renderer
}) {
  const dismiss = Navigation.useDismiss()
  const [preview, setPreview] = useState({ count: instances.info.count, shifted: true, revision: instances.info.revision })
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState("")
  const pending = useRef<AbortController | null>(null)

  useEffect(() => {
    let reported = false
    const listener = renderer.on("update", () => {
      if (reported) return
      reported = true
      console.log("RealityKit instance compute ready")
    })
    return () => {
      listener.dispose()
      pending.current?.abort()
      pending.current = null
    }
  }, [])

  async function change(action: "move" | "hide" | "show") {
    if (pending.current) return
    const controller = new AbortController()
    pending.current = controller
    const count = action === "hide" ? 0 : 3
    const shifted = action === "move" ? !preview.shifted : preview.shifted
    const deltaX = action === "move" ? (shifted ? 0.375 : -0.375) : 0
    setBusy(true)
    setStatus("Updating both rows.")
    try {
      const revision = await shiftMiddle(instances, pipeline, deltaX, count, controller.signal)
      if (pending.current === controller) {
        setPreview({ count, shifted, revision })
        setStatus("")
        const message = count === 0 ? "Both rows hidden." :
          `Three spheres per row. The middle spheres are ${shifted ? "shifted right" : "centered"}.`
        void Accessibility.announce(message).catch(() => {})
      }
    } catch (error) {
      if (pending.current === controller) {
        setStatus(`Could not update the instances. ${String(error)}`)
        void Accessibility.announce("Could not update the instances.").catch(() => {})
      }
    } finally {
      if (pending.current === controller) {
        pending.current = null
        setBusy(false)
      }
    }
  }

  const result = preview.count === 0 ? "Both rows hidden." :
    `Three spheres per row. The middle spheres are ${preview.shifted ? "shifted right" : "centered"}.`
  return <NavigationStack>
    <ScrollView navigationTitle="RealityKit instance compute">
      <VStack spacing={12} padding>
        <RealityView renderer={renderer} frame={{ height: 230 }} accessibilityHidden />
        <Text>{`Two entities share these transforms. ${result} Revision ${preview.revision}.`}</Text>
        {status ? <Text>{status}</Text> : null}
        <Button title={preview.shifted ? "Center the middle spheres" : "Move the middle spheres right"}
          controlSize="large" disabled={busy || preview.count === 0} action={() => { void change("move") }} />
        <Button title={preview.count === 0 ? "Show both rows" : "Hide both rows"}
          controlSize="large" disabled={busy} action={() => { void change(preview.count === 0 ? "show" : "hide") }} />
        <Button title="Done" controlSize="large" action={dismiss} />
      </VStack>
    </ScrollView>
  </NavigationStack>
}

async function run() {
  const resources: Array<{ dispose(): void }> = []
  try {
    if (!RealityKit.getCapabilities().instanceCompute) {
      await Dialog.alert({ message: "Instance compute requires a foreground script with Metal on iOS 26 or later." })
      return
    }
    const device = Metal.Device.getDefault()
    if (!device) throw Error("No Metal device is available.")
    const library = await device.compileLibrary(source)
    resources.push(library)
    const pipeline = await library.makeComputePipeline("move_instance")
    resources.push(pipeline)
    const instances = RealityKit.InstanceData.create({
      capacity: 3,
      count: 0,
      transforms: new Float32Array([
        1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -0.75, 0, 0, 1,
        1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0,     0, 0, 0, 1,
        1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0,  0.75, 0, 0, 1,
      ]),
    })
    resources.push(instances)

    const mesh = RealityKit.Mesh.primitive({ type: "sphere", radius: 0.14 })
    resources.push(mesh)
    const scene = RealityKit.Scene.create()
    resources.push(scene)
    const rows: Array<{ name: string; y: number; color: RealityKit.RGBA }> = [
      { name: "Upper row", y: 0.26, color: [0.22, 0.90, 0.67, 1] },
      { name: "Lower row", y: -0.26, color: [0.98, 0.73, 0.23, 1] },
    ]
    for (const { name, y, color } of rows) {
      const material = RealityKit.Material.create({ kind: "unlit", baseColor: color })
      resources.push(material)
      const entity = RealityKit.Entity.create({ name, transform: { position: [0, y, 0] } })
      resources.push(entity)
      entity.setModel(mesh, [material])
      entity.setMeshInstances({ instances })
      scene.add(entity)
    }

    const revision = await shiftMiddle(instances, pipeline, 0.375, 3)
    const transforms = instances.copyTransforms()
    if (revision !== instances.info.revision || instances.info.count !== 3 ||
        transforms.length !== 48 || transforms[12] !== -0.75 || transforms[28] !== 0.375 || transforms[44] !== 0.75) {
      throw Error("The GPU did not publish the expected instance transforms.")
    }

    const renderer = RealityKit.Renderer.create(scene, {
      camera: { position: [0, 0, 3.6], target: [0, 0, 0], fieldOfView: 42 },
      background: [0.05, 0.10, 0.18, 1], orbit: false,
    })
    resources.push(renderer)
    await Navigation.present({ element: <InstancePreview instances={instances} pipeline={pipeline} renderer={renderer} /> })
  } catch (error) {
    await Dialog.alert({ title: "RealityKit instance compute", message: String(error) })
  } finally {
    try {
      for (const resource of resources.reverse()) resource.dispose()
    } finally {
      Script.exit()
    }
  }
}

void run()
