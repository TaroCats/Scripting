import { Button, Navigation, NavigationStack, RealityView, Script, ScrollView, Text, VStack, useState } from "scripting"

function makeBody(name: string, position: RealityKit.Vector3, size: RealityKit.Vector3, color: RealityKit.RGBA, movable: boolean) {
  const body = RealityKit.Entity.create({ name, physics: movable, transform: { position } })
  body.setModel(RealityKit.Mesh.primitive({ type: "box", size }), [
    RealityKit.Material.create({ kind: "unlit", baseColor: color }),
  ])
  body.setCollision({ shape: "box", size })
  body.setPhysicsBody({ mode: movable ? "dynamic" : "static", mass: 1 })
  return body
}

function JointsDemo({ scene, renderer, carrier, joint }: {
  scene: RealityKit.Scene
  renderer: RealityKit.Renderer
  carrier: RealityKit.Entity
  joint: RealityKit.PhysicsJoint
}) {
  const [status, setStatus] = useState("The blue carriage is constrained to the horizontal rail.")

  function move(direction: number) {
    try {
      carrier.setPhysicsMotion({ linearVelocity: [0, 0, 0] })
      carrier.applyPhysicsAction({ kind: "linearImpulse", vector: [direction * 2, 0, 0] })
      setStatus(joint.info.active ? "The carriage is moving within the joint limits." : "The carriage is waiting for the next physics step.")
    } catch (error) {
      setStatus(String(error))
    }
  }

  function scan() {
    try {
      const hits = scene.convexCast({
        collider: { shape: "sphere", radius: 0.18 },
        from: [-1.65, 0.42, 0.27],
        to: [1.65, 0.42, 0.27],
        query: "nearest",
      })
      setStatus(hits[0] ? `The sweep hit ${hits[0].entity.info.name}.` : "The sweep found no object.")
    } catch (error) {
      setStatus(String(error))
    }
  }

  return <NavigationStack>
    <ScrollView navigationTitle="Physics joints and casts">
      <VStack spacing={12} padding>
        <RealityView renderer={renderer} frame={{ height: 260 }} accessibilityHidden />
        <Text>{status}</Text>
        <Button title="Slide carriage left" action={() => move(-1)} />
        <Button title="Slide carriage right" action={() => move(1)} />
        <Button title="Sweep along rail" action={scan} />
      </VStack>
    </ScrollView>
  </NavigationStack>
}

async function run() {
  try {
    if (!RealityKit.getCapabilities().physicsJoints) {
      await Dialog.alert({ message: "Physics joints require iOS 18 or later in the foreground app." })
      return
    }
    const scene = RealityKit.Scene.create()
    const world = RealityKit.Entity.create({ name: "Rail simulation" })
    world.setPhysicsSimulation({ gravity: [0, 0, 0] })
    const rail = makeBody("Rail", [0, 0.08, 0], [2.65, 0.16, 0.31], [0.58, 0.63, 0.71, 1], false)
    const carrier = makeBody("Carriage", [0, 0.42, 0], [0.38, 0.36, 0.32], [0.29, 0.69, 0.98, 1], true)
    world.add(rail)
    world.add(carrier)
    scene.add(world)
    const joint = RealityKit.PhysicsJoint.create({
      kind: "prismatic",
      first: { entity: rail, position: [0, 0.34, 0] },
      second: { entity: carrier },
      linearLimit: [-0.9, 0.9],
    })
    const renderer = RealityKit.Renderer.create(scene, {
      camera: { position: [1.65, 1.6, 4.1], target: [0, 0.30, 0], fieldOfView: 36 },
      background: [0.10, 0.13, 0.18, 1],
    })
    await Navigation.present({ element: <JointsDemo scene={scene} renderer={renderer} carrier={carrier} joint={joint} /> })
  } catch (error) {
    console.error(String(error))
    await Dialog.alert({ title: "Physics joints and casts", message: String(error) })
  } finally {
    Script.exit()
  }
}

void run()
