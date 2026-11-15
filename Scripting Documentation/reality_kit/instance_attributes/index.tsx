import {
  Button, Navigation, NavigationStack, RealityView, Script, ScrollView, Text, VStack,
  useEffect, useState,
} from "scripting"

// iOS library compiled from the surface shader shown in the documentation.
const compiledShader = "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dGFhaXIudmlzaWJsZV9mdW5jdGlvbl9yZWZlcmVuY2VyZWFsaXR5a2l0OjpzdXJmYWNlOjphcGk6OmNvbG9ycmVhbGl0eWtpdDo6c3VyZmFjZTo6YXBpOjpzZXRfZW1pc3NpdmVfY29sb3IAhkUAAAAAAAAwghARIwiSM4IQFSMIkTGCEB0jCBEyghAlIwiRMoIQLSMIETOCEDUjCAQwgvAMIwhIMMNwBdgMQyZoMwzbcM0wbAQ3w7AV3AzDZnAzDNvRzTBsiDfDsCXfDIEyw3CBQRjMQCxaFgYzBMwMQTND4MwAzGCEwQNF0jRDUAczDGJAB3Yww0CNQTXDQJGBdWMAcBzHcRzHcRzHcZwYiIEYiIEYiIEYiIEYWG7gBpZlQXrA0QEayEhggjJiY7Nrc2l7I6tjK3MxYws7mxslIYMyMIMzQIM0UIM1YINU2Njs2lzSyMrc6EYJ2iCXsDQ5F7syubm0N7dRAjdIKixNzoUtzO2sLuys7MuuTG4u7c1tlOANcgpLk3MZe2uDS2Mr+3qDo0t7c5sbZYCDOJCDXMLS5Fzs0ubSxNjKRgnsIL+wNDkXu7S5NDG2si+zOrcxurQ3ty+5MrMyuTK3sbK5UYQ7wAMAqRgAACUAAAALCnIoh3eAB3pYcJhDPbjDOLBDOdDDguYcxqEN6EEewsEd5iEd6CEd3sEdFjTjYA7nUA/hIA/kQA/hIA/nUA70sICBB3koh3BgB3Z4h3EIB3ooB3JYcJzDOLQBO6SDPZTDAmsc2CEc3OEc3CAc5GEc3CAc6IEewmEc0KEcyGEcwoEd2GHBAQ/0IA/hUA/0gA4AAAAA0RAAAAYAAAAHzDykgzucAzuUAz2ggzyUQziQwwEAAABhIAAADwAAABMEQSwQAAAAAwAAADTHGoBAoDYaAAAAACMGxhCCYOEfzjMMMgTCMGJgECEIFv6xSMGIgVGEIBgcVGAoAHEgAAADAAAAMg4QIoQAgwYAAAAAAAAAAGUMAAA9AAAAEgOU6AEAAAADAAAAogAAAAsAAABMAAAAAQAAAFgAAAAAAAAAWAAAAAQAAAC4AAAAAgAAAK0AAAAZAAAAAAAAABYAAAAWAAAAAAAAAOgAAAAAAAAAAAAAAAQAAAAAAAAAAAAAABYAAAAAAAAAFgAAAP////8AJAAAFgAAAD8AAAAWAAAAPwAAAP////8MJAAAVQAAABsAAABVAAAAGwAAAP////8IJAAAcAAAADIAAABwAAAAMgAAAP////8MJAAAAAAAAAAAAAAWAAAAAAAAAMYAAAAWAAAAAAAAAAAAAAAWAAAAAAAAAMYAAAAWAAAAAAAAAF0MAAA6AAAAEgOUvAEAAABzY3JpcHRpbmdJbnN0YW5jZUNvbG9ycmVhbGl0eWtpdDo6c3VyZmFjZTo6YXBpOjpzZXRfZW1pc3NpdmVfY29sb3IuTVRMX1ZJU0lCTEVfRk5fUkVGYWlyLmNvbnZlcnQuZi52M2YxNi5mLnYzZjMycmVhbGl0eWtpdDo6c3VyZmFjZTo6YXBpOjpjb2xvci5NVExfVklTSUJMRV9GTl9SRUYzMjAyMy45MjIuNGFpcjY0X3YyOS1hcHBsZS1pb3MyNy4wLjBhaXIuZXh0ZXJuYWxseV9kZWZpbmVkAAAAAAAAAAAAAAAA"
const orange: RealityKit.RGBA = [1, 0.24, 0.07, 1]
const cyan: RealityKit.RGBA = [0.07, 0.76, 1, 1]

function InstancePreview({ mesh, instances, renderer }: {
  mesh: RealityKit.Mesh
  instances: RealityKit.InstanceData
  renderer: RealityKit.Renderer
}) {
  const dismiss = Navigation.useDismiss()
  const [preview, setPreview] = useState({ swapped: false, count: instances.info.count })
  const [error, setError] = useState("")

  useEffect(() => {
    let reported = false
    const listener = renderer.on("update", () => {
      if (reported) return
      reported = true
      console.log("RealityKit instance attributes ready")
    })
    return () => listener.dispose()
  }, [])

  function describe(swapped: boolean, count: number) {
    const first = swapped ? "cyan" : "orange"
    const second = swapped ? "orange" : "cyan"
    return count === 2 ? `Two ${first} triangles.` : `Two ${first} triangles, then two ${second} triangles.`
  }

  function change(action: "swap" | "count") {
    const swapped = action === "swap" ? !preview.swapped : preview.swapped
    const count = action === "count" ? (preview.count === 4 ? 2 : 4) : preview.count
    try {
      if (action === "swap") {
        mesh.update({
          expectedRevision: mesh.info.revision,
          vertexBuffers: [{ bufferIndex: 1, data: new Float32Array(swapped ? [...cyan, ...orange] : [...orange, ...cyan]) }],
        })
      } else {
        instances.update({ count, expectedRevision: instances.info.revision })
      }
      setPreview({ swapped, count })
      setError("")
      void Accessibility.announce(describe(swapped, count)).catch(() => {})
    } catch (failure) {
      setError(String(failure))
      void Accessibility.announce("Could not update the triangles.").catch(() => {})
    }
  }

  return <NavigationStack>
    <ScrollView navigationTitle="Per-instance mesh colors">
      <VStack padding spacing={12}>
        <RealityView renderer={renderer} frame={{ height: 230 }} accessibilityHidden />
        <Text>{describe(preview.swapped, preview.count)}</Text>
        <Text>Each color entry is shared by two instances.</Text>
        {error ? <Text>{error}</Text> : null}
        <Button title="Swap group colors" controlSize="large" action={() => change("swap")} />
        <Button title={preview.count === 4 ? "Show two triangles" : "Show four triangles"}
          controlSize="large" action={() => change("count")} />
        <Button title="Done" controlSize="large" action={dismiss} />
      </VStack>
    </ScrollView>
  </NavigationStack>
}

async function run() {
  const resources: Array<{ dispose(): void }> = []
  try {
    const capabilities = RealityKit.getCapabilities()
    if (!capabilities.meshInstanceAttributes || !capabilities.customMaterials) {
      await Dialog.alert({ message: "Per-instance mesh colors require a foreground script with Metal on iOS 27 or later." })
      return
    }
    const device = Metal.Device.getDefault()
    if (!device) throw Error("No Metal device is available.")
    const data = Data.fromBase64String(compiledShader)
    if (!data) throw Error("The demo shader library could not be decoded.")
    const library = await device.loadLibrary(data)
    resources.push(library)
    const material = RealityKit.Material.custom({
      surface: { library, name: "scriptingInstanceColor" },
      lightingModel: "unlit",
    })
    resources.push(material)

    const mesh = RealityKit.Mesh.dynamic({
      vertexCount: 3,
      vertexCapacity: 3,
      indexCount: 3,
      indexCapacity: 3,
      indexType: "uint32",
      indices: new Uint32Array([0, 1, 2]),
      instanceCapacity: 4,
      layouts: [
        { bufferIndex: 0, bufferStride: 12 },
        { bufferIndex: 1, bufferStride: 16, stepFunction: "perInstance", stepRate: 2 },
      ],
      attributes: [
        { semantic: "position", format: "float3", layoutIndex: 0, offset: 0 },
        { semantic: "color", format: "float4", layoutIndex: 1, offset: 0 },
      ],
      vertexBuffers: [
        new Float32Array([-0.18, -0.25, 0, 0.18, -0.25, 0, 0, 0.25, 0]),
        new Float32Array([...orange, ...cyan]),
      ],
      parts: [{ indexCount: 3, min: [-0.19, -0.26, 0], max: [0.19, 0.26, 0] }],
    })
    resources.push(mesh)
    if (mesh.info.instanceCapacity !== 4) throw Error("The mesh did not retain its instance capacity.")

    const transforms = new Float32Array(4 * 16)
    for (const [index, x] of [-0.78, -0.26, 0.26, 0.78].entries()) {
      transforms.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, 0, 0, 1], index * 16)
    }
    const instances = RealityKit.InstanceData.create({ capacity: 4, transforms })
    resources.push(instances)
    const scene = RealityKit.Scene.create()
    resources.push(scene)
    const entity = RealityKit.Entity.create({ name: "Instanced triangles" })
    resources.push(entity)
    entity.setModel(mesh, [material])
    entity.setMeshInstances({ instances })
    scene.add(entity)
    const renderer = RealityKit.Renderer.create(scene, {
      camera: { position: [0, 0, 3.6], target: [0, 0, 0], fieldOfView: 42 },
      background: [0.05, 0.10, 0.18, 1], orbit: false,
    })
    resources.push(renderer)
    await Navigation.present({ element: <InstancePreview mesh={mesh} instances={instances} renderer={renderer} /> })
  } catch (error) {
    await Dialog.alert({ title: "Per-instance mesh colors", message: String(error) })
  } finally {
    try {
      for (const resource of resources.reverse()) resource.dispose()
    } finally {
      Script.exit()
    }
  }
}

void run()
