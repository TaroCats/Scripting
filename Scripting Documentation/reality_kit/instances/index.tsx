import { Button, Navigation, NavigationStack, RealityView, Script, ScrollView, Text, VStack, useState } from "scripting"

function InstancePreview({ instances, renderer }: { instances: RealityKit.InstanceData; renderer: RealityKit.Renderer }) {
  const [count, setCount] = useState(instances.info.count)
  const [error, setError] = useState("")

  function show(next: number) {
    try {
      instances.update({ count: next })
      setCount(instances.info.count)
      setError("")
    } catch (error) {
      setError(String(error))
    }
  }

  return <NavigationStack>
    <ScrollView navigationTitle="Mesh instances">
      <VStack spacing={12} padding>
        <RealityView renderer={renderer} frame={{ height: 230 }} accessibilityHidden />
        <Text>{`${count} instances`}</Text>
        <Button title="Show six instances" action={() => show(6)} disabled={count === 6} />
        <Button title="Clear instances" action={() => show(0)} disabled={count === 0} />
        {error ? <Text>{error}</Text> : null}
      </VStack>
    </ScrollView>
  </NavigationStack>
}

async function run() {
  try {
    if (!RealityKit.getCapabilities().meshInstances) {
      await Dialog.alert({ message: "Mesh instances require iOS 26 or later and RealityKit in the foreground app." })
      return
    }

    const positions: RealityKit.Vector3[] = [
      [-0.65, 0.28, 0], [0, 0.28, 0], [0.65, 0.28, 0],
      [-0.65, -0.28, 0], [0, -0.28, 0], [0.65, -0.28, 0],
    ]
    const transforms = new Float32Array(positions.length * 16)
    positions.forEach(([x, y, z], index) => {
      transforms.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1], index * 16)
    })

    const instances = RealityKit.InstanceData.create({ capacity: positions.length, transforms })
    const mesh = RealityKit.Mesh.primitive({ type: "sphere", radius: 0.145 })
    const material = RealityKit.Material.create({ kind: "unlit", baseColor: [0.2, 0.8, 0.7, 1] })
    const entity = RealityKit.Entity.create({ name: "Instanced spheres" })
    entity.setModel(mesh, [material])
    entity.setMeshInstances({ instances })

    const scene = RealityKit.Scene.create()
    scene.add(entity)
    const renderer = RealityKit.Renderer.create(scene, {
      camera: { position: [0, 0, 3], target: [0, 0, 0], fieldOfView: 39 },
      background: [0.04, 0.08, 0.11, 1],
      orbit: false,
    })
    await Navigation.present({ element: <InstancePreview instances={instances} renderer={renderer} /> })
  } catch (error) {
    await Dialog.alert({ title: "Mesh instances", message: String(error) })
  } finally {
    Script.exit()
  }
}

void run()
