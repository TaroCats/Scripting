import { Button, Navigation, NavigationStack, RealityView, Script, ScrollView, Text, VStack, useEffect, useState } from "scripting"

function makeBox(name: string, size: RealityKit.Vector3, position: RealityKit.Vector3, color: RealityKit.RGBA) {
  const entity = RealityKit.Entity.create({ name, transform: { position } })
  entity.setModel(RealityKit.Mesh.primitive({ type: "box", size }), [
    RealityKit.Material.create({ kind: "unlit", baseColor: color }),
  ])
  entity.setCollision({ shape: "box", size })
  entity.setPhysicsBody({ mode: "static" })
  return entity
}

function PhysicsDemo({ renderer, ball, player }: {
  renderer: RealityKit.Renderer
  ball: RealityKit.Entity
  player: RealityKit.Entity
}) {
  const [ballStatus, setBallStatus] = useState("The blue ball rests on the floor.")
  const [playerStatus, setPlayerStatus] = useState("The green character is to the left of the wall.")
  const [error, setError] = useState("")

  useEffect(() => {
    const subscription = ball.onCollision(event => {
      if (event.entityB.info.name !== "Floor") return
      if (event.phase === "began") setBallStatus("The ball touched the floor.")
      if (event.phase === "ended") setBallStatus("The ball left the floor.")
    })
    return () => subscription.dispose()
  }, [ball])

  function launch() {
    try {
      ball.applyPhysicsAction({ kind: "linearImpulse", vector: [0, 4, 0] })
      setBallStatus("An upward impulse was applied to the ball.")
      setError("")
    } catch (error) {
      setError(String(error))
    }
  }

  function move() {
    try {
      const result = player.moveCharacter({ delta: [1.7, -0.12, 0], deltaTime: 0.25 })
      const wall = result.collisions.some(hit => hit.entity.info.name === "Wall")
      setPlayerStatus(wall || result.side ? "The wall blocked the character." : "The character moved toward the wall.")
      setError("")
    } catch (error) {
      setError(String(error))
    }
  }

  function reset() {
    try {
      player.teleportCharacter({ position: [-0.9, 0.45, 0.35] })
      setPlayerStatus("The character returned to the left of the wall.")
      setError("")
    } catch (error) {
      setError(String(error))
    }
  }

  return <NavigationStack>
    <ScrollView navigationTitle="Physics and collisions">
      <VStack spacing={12} padding>
        <RealityView renderer={renderer} frame={{ height: 270 }} accessibilityHidden />
        <Text>{ballStatus}</Text>
        <Button title="Launch ball upward" action={launch} />
        <Text>{playerStatus}</Text>
        <Button title="Move character toward wall" action={move} />
        <Button title="Reset character" action={reset} />
        {error ? <Text>{error}</Text> : null}
      </VStack>
    </ScrollView>
  </NavigationStack>
}

async function run() {
  try {
    const capabilities = RealityKit.getCapabilities()
    if (!capabilities.physics || !capabilities.characterController) {
      await Dialog.alert({ message: "Physics and character controllers require RealityKit in the foreground app." })
      return
    }
    const scene = RealityKit.Scene.create()
    scene.add(makeBox("Floor", [3.4, 0.12, 1.9], [0, -0.06, 0], [0.27, 0.34, 0.42, 1]))
    scene.add(makeBox("Wall", [0.13, 0.85, 0.7], [0.25, 0.425, 0.35], [0.89, 0.62, 0.33, 1]))

    const ball = RealityKit.Entity.create({ name: "Ball", physics: true, transform: { position: [0.9, 0.18, -0.28] } })
    ball.setModel(RealityKit.Mesh.primitive({ type: "sphere", radius: 0.17 }), [
      RealityKit.Material.create({ kind: "unlit", baseColor: [0.39, 0.69, 0.99, 1] }),
    ])
    ball.setCollision({ shape: "sphere", radius: 0.17 })
    ball.setPhysicsBody({ mass: 1, material: { restitution: 0.2 } })
    scene.add(ball)

    const player = RealityKit.Entity.create({ name: "Character", transform: { position: [-0.9, 0.45, 0.35] } })
    player.setModel(RealityKit.Mesh.primitive({ type: "box", size: [0.34, 0.84, 0.34] }), [
      RealityKit.Material.create({ kind: "unlit", baseColor: [0.35, 0.88, 0.61, 1] }),
    ])
    player.setCharacterController({ radius: 0.17, height: 0.84, skinWidth: 0.02, stepLimit: 0.1 })
    scene.add(player)

    const renderer = RealityKit.Renderer.create(scene, {
      camera: { position: [2.2, 2.3, 4.4], target: [0, 0.55, 0], fieldOfView: 37 },
      background: [0.11, 0.15, 0.21, 1],
    })
    await Navigation.present({ element: <PhysicsDemo renderer={renderer} ball={ball} player={player} /> })
  } catch (error) {
    console.error(String(error))
    await Dialog.alert({ title: "Physics and collisions", message: String(error) })
  } finally {
    Script.exit()
  }
}

void run()
