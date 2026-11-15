import { Button, Navigation, NavigationStack, RealityView, Script, ScrollView, Text, VStack, useState } from "scripting"

function DeformationDemo({ renderer, deformer }: {
  renderer: RealityKit.Renderer
  deformer: RealityKit.MeshDeformer
}) {
  const [raised, setRaised] = useState(false)
  const [error, setError] = useState("")

  function change(value: boolean) {
    try {
      deformer.setDisplacement({ offsets: new Float32Array([0, 0, 0, 0, 0, 0, 0, value ? 0.42 : 0, 0]) })
      setRaised(value)
      setError("")
    } catch (error) {
      setError(String(error))
    }
  }

  return <NavigationStack>
    <ScrollView navigationTitle="Mesh deformation">
      <VStack spacing={12} padding>
        <RealityView renderer={renderer} frame={{ height: 260 }} accessibilityHidden />
        <Text>{raised ? "The left triangle's top vertex is raised. The right triangle stays in place." : "Both triangles are at their original height."}</Text>
        <Button title="Raise left triangle" action={() => change(true)} disabled={raised} />
        <Button title="Restore left triangle" action={() => change(false)} disabled={!raised} />
        {error ? <Text>{error}</Text> : null}
      </VStack>
    </ScrollView>
  </NavigationStack>
}

async function run() {
  try {
    if (!RealityKit.getCapabilities().customMeshDeformers) {
      await Dialog.alert({ message: "Mesh deformers require iOS 27 or later in the foreground app." })
      return
    }
    const mesh = RealityKit.Mesh.deformable({ name: "Panels", parts: [
      {
        id: "Left", positions: new Float32Array([-0.8, -0.3, 0, -0.15, -0.3, 0, -0.475, 0.3, 0]),
        indices: new Uint32Array([0, 1, 2]),
      },
      {
        id: "Right", materialIndex: 1, positions: new Float32Array([0.15, -0.3, 0, 0.8, -0.3, 0, 0.475, 0.3, 0]),
        indices: new Uint32Array([0, 1, 2]),
      },
    ] })
    const entity = RealityKit.Entity.create({ name: "Two panels" })
    entity.setModel(mesh, [
      RealityKit.Material.create({ kind: "unlit", baseColor: [0.32, 0.87, 0.72, 1] }),
      RealityKit.Material.create({ kind: "unlit", baseColor: [0.55, 0.68, 0.94, 1] }),
    ])
    const target = entity.deformationTargets().models[0]
    const deformer = RealityKit.MeshDeformer.cpuDisplacement({ offsets: new Float32Array(9) })
    entity.setDeformationStacks([{
      targets: [{ kind: "model", name: target.name, part: "Left" }],
      stages: [{ kind: "custom", deformer }, { kind: "bounds" }],
    }])
    const scene = RealityKit.Scene.create()
    scene.add(entity)
    const renderer = RealityKit.Renderer.create(scene, {
      camera: { projection: "orthographic", position: [0, 0.16, 3], target: [0, 0.16, 0], scale: 2.15 },
      background: [0.10, 0.12, 0.17, 1],
    })
    await Navigation.present({ element: <DeformationDemo renderer={renderer} deformer={deformer} /> })
  } catch (error) {
    console.error(String(error))
    await Dialog.alert({ title: "Mesh deformation", message: String(error) })
  } finally {
    Script.exit()
  }
}

void run()
