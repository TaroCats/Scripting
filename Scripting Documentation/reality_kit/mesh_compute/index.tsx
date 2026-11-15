import {
  Button, Navigation, NavigationStack, RealityView, Script, ScrollView, Text, VStack,
  useEffect, useRef, useState,
} from "scripting"

const source = `
#include <metal_stdlib>
using namespace metal;

kernel void move_triangle(const device packed_float3 *source [[buffer(0)]],
                          device packed_float3 *target [[buffer(1)]],
                          constant float &deltaX [[buffer(2)]],
                          uint vertexID [[thread_position_in_grid]]) {
  if (vertexID >= 4) return;
  float3 position = float3(source[vertexID]);
  position.x += deltaX;
  target[vertexID] = packed_float3(position);
}

kernel void reshape_triangle(device uint *indices [[buffer(0)]],
                             constant uint &pointDown [[buffer(1)]],
                             uint id [[thread_position_in_grid]]) {
  if (id != 0) return;
  indices[0] = 0;
  indices[1] = pointDown ? 3 : 1;
  indices[2] = pointDown ? 1 : 2;
}
`

function part(pointDown: boolean): RealityKit.MeshPart {
  return pointDown
    ? { indexCount: 3, min: [-1, -0.74, 0], max: [1, -0.32, 0] }
    : { indexCount: 3, min: [-1, -0.37, 0], max: [1, 0.37, 0] }
}

function move(mesh: RealityKit.Mesh, pipeline: Metal.ComputePipeline, deltaX: number, signal?: AbortSignal) {
  return mesh.compute({
    pipeline,
    reads: [{ kind: "vertices", bufferIndex: 0, index: 0 }],
    writes: [{ kind: "vertices", bufferIndex: 0, index: 1 }],
    expectedRevision: mesh.info.revision,
    signal,
    dispatch: {
      threadgroups: { width: 1 },
      threadsPerThreadgroup: { width: 4 },
      bytes: [{ index: 2, data: new Float32Array([deltaX]) }],
    },
  })
}

function MeshPreview({ mesh, pipeline, reshapePipeline, renderer, initialRevision }: {
  mesh: RealityKit.Mesh
  pipeline: Metal.ComputePipeline
  reshapePipeline: Metal.ComputePipeline
  renderer: RealityKit.Renderer
  initialRevision: string
}) {
  const dismiss = Navigation.useDismiss()
  const [preview, setPreview] = useState({ side: "left", pointDown: false, revision: initialRevision })
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState("")
  const pending = useRef<AbortController | null>(null)

  useEffect(() => {
    let reported = false
    const listener = renderer.on("update", () => {
      if (reported) return
      reported = true
      console.log("RealityKit mesh compute ready")
    })
    return () => {
      listener.dispose()
      pending.current?.abort()
      pending.current = null
    }
  }, [])

  async function updateTriangle(action: "move" | "reshape") {
    if (pending.current) return
    const nextSide = action === "move" ? (preview.side === "left" ? "right" : "left") : preview.side
    const pointDown = action === "reshape" ? !preview.pointDown : preview.pointDown
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    setStatus("Updating the triangle.")
    try {
      const revision = action === "move"
        ? await move(mesh, pipeline, nextSide === "right" ? 1 : -1, controller.signal)
        : await mesh.compute({
          pipeline: reshapePipeline,
          expectedRevision: mesh.info.revision,
          signal: controller.signal,
          writes: [{ kind: "indices", index: 0 }],
          parts: [part(pointDown)],
          dispatch: {
            threadgroups: { width: 1 }, threadsPerThreadgroup: { width: 1 },
            bytes: [{ index: 1, data: new Uint32Array([pointDown ? 1 : 0]) }],
          },
        })
      if (pending.current === controller) {
        setPreview({ side: nextSide, pointDown, revision })
        setStatus("")
        void Accessibility.announce(`Triangle on the ${nextSide}, pointing ${pointDown ? "down" : "up"}.`).catch(() => {})
      }
    } catch (error) {
      if (pending.current === controller) {
        setStatus(`Could not update the triangle. ${String(error)}`)
        void Accessibility.announce("Could not update the triangle.").catch(() => {})
      }
    } finally {
      if (pending.current === controller) {
        pending.current = null
        setBusy(false)
      }
    }
  }

  return <NavigationStack>
    <ScrollView navigationTitle="RealityKit mesh compute">
      <VStack padding spacing={12}>
        <RealityView renderer={renderer} frame={{ height: 230 }} accessibilityHidden />
        <Text>{`Triangle on the ${preview.side}, pointing ${preview.pointDown ? "down" : "up"}. Mesh revision ${preview.revision}.`}</Text>
        {status ? <Text>{status}</Text> : null}
        <Button title={preview.side === "left" ? "Move triangle right" : "Move triangle left"}
          controlSize="large" disabled={busy} action={() => { void updateTriangle("move") }} />
        <Button title={preview.pointDown ? "Point triangle up" : "Point triangle down"}
          controlSize="large" disabled={busy} action={() => { void updateTriangle("reshape") }} />
        <Button title="Done" controlSize="large" action={dismiss} />
      </VStack>
    </ScrollView>
  </NavigationStack>
}

async function run() {
  const resources: Array<{ dispose(): void }> = []
  try {
    if (!RealityKit.getCapabilities().meshCompute) {
      await Dialog.alert({ message: "Mesh compute requires a foreground script with Metal on iOS 18 or later." })
      return
    }
    const device = Metal.Device.getDefault()
    if (!device) throw Error("No Metal device is available.")
    const library = await device.compileLibrary(source)
    resources.push(library)
    const pipeline = await library.makeComputePipeline("move_triangle")
    resources.push(pipeline)
    const reshapePipeline = await library.makeComputePipeline("reshape_triangle")
    resources.push(reshapePipeline)
    const mesh = RealityKit.Mesh.dynamic({
      positions: new Float32Array([-0.25, -0.35, 0, 0.25, -0.35, 0, 0, 0.35, 0, 0, -0.72, 0]),
      indices: new Uint32Array([0, 1, 2]),
      indexType: "uint32",
      parts: [part(false)],
    })
    resources.push(mesh)
    const initialRevision = await move(mesh, pipeline, -0.5)

    const material = RealityKit.Material.create({ kind: "unlit", baseColor: [0.18, 0.92, 0.53, 1] })
    resources.push(material)
    const scene = RealityKit.Scene.create()
    resources.push(scene)
    const entity = RealityKit.Entity.create({ name: "Triangle" })
    entity.setModel(mesh, [material])
    scene.add(entity)
    const renderer = RealityKit.Renderer.create(scene, {
      camera: { position: [0, 0, 3], target: [0, 0, 0], fieldOfView: 40 },
      background: [0.05, 0.10, 0.18, 1], orbit: false,
    })
    resources.push(renderer)
    await Navigation.present({ element: <MeshPreview mesh={mesh} pipeline={pipeline} reshapePipeline={reshapePipeline} renderer={renderer}
      initialRevision={initialRevision} /> })
  } catch (error) {
    await Dialog.alert({ title: "RealityKit mesh compute", message: String(error) })
  } finally {
    try {
      for (const resource of resources.reverse()) resource.dispose()
    } finally {
      Script.exit()
    }
  }
}

void run()
