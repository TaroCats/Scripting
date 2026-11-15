import { Button, Navigation, NavigationStack, RealityView, Script, Text, VStack, useState } from "scripting"

function SkeletonDemo({ renderer, model, summary }: {
  renderer: RealityKit.Renderer
  model: RealityKit.Entity
  summary: string
}) {
  const [raised, setRaised] = useState(false)
  function setReach(up: boolean) {
    model.updateIKTargets([
      { constraint: "base", target: {}, animationOverridePosition: 1 },
      { constraint: "reach", target: { position: up ? [0, 0.65, 0] : [0.65, 0, 0] }, animationOverridePosition: 1 },
    ])
    setRaised(up)
  }
  return <NavigationStack>
    <VStack spacing={16} padding navigationTitle="Skeleton resources">
      <Text>{summary}</Text>
      <RealityView renderer={renderer} frame={{ height: 260 }} accessibilityHidden />
      <Text>{raised ? "Target above the root" : "Target beside the root"}</Text>
      <Button title="Reach up" action={() => setReach(true)} disabled={raised} />
      <Button title="Reach sideways" action={() => setReach(false)} disabled={!raised} />
    </VStack>
  </NavigationStack>
}

async function run() {
  try {
    if (!RealityKit.getCapabilities().skeletonResources) {
      await Dialog.alert({ message: "Skeleton resources require iOS 27 or later in the foreground app." })
      return
    }
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    const inverseTip = [...identity]
    inverseTip[12] = -0.65
    const mesh = RealityKit.Mesh.deformable({
      skeletons: [{ id: "Arm", joints: [
        { name: "root", restPoseTransform: {}, inverseBindPoseMatrix: identity },
        { name: "tip", parentIndex: 0, restPoseTransform: { position: [0.65, 0, 0] }, inverseBindPoseMatrix: inverseTip },
      ] }],
      parts: [{
        id: "Strip",
        positions: new Float32Array([0, -0.10, 0, 0.78, -0.10, 0, 0.78, 0.10, 0, 0, 0.10, 0]),
        indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
        skin: { skeletonID: "Arm", influencesPerVertex: 1,
          jointIndices: new Uint32Array([0, 1, 1, 0]), weights: new Float32Array([1, 1, 1, 1]) },
      }],
    })
    const scene = RealityKit.Scene.create()
    const model = RealityKit.Entity.create()
    model.setModel(mesh, [RealityKit.Material.create({ kind: "unlit", baseColor: [0.2, 0.85, 0.62, 1] })])
    scene.add(model)
    const skeleton = RealityKit.SkeletonResource.fromEntity(model)
    const rig = RealityKit.IKRig.create(skeleton, { maxIterations: 24, globalFKWeight: 0.05, constraints: [
      { kind: "point", name: "base", jointName: "root", positionWeight: [30, 30, 30] },
      { kind: "point", name: "reach", jointName: "tip", positionWeight: [8, 8, 8] },
    ] })
    const evaluated = skeleton.withEvaluation({
      blendMasks: [{ name: "Tip only", jointWeights: [{ joint: "root", weight: 0 }] }],
      ikRigs: [rig],
    })
    model.setIK(rig)
    const info = evaluated.info
    const renderer = RealityKit.Renderer.create(scene, {
      camera: { projection: "orthographic", position: [0.24, 0.24, 2], target: [0.24, 0.24, 0], scale: 1.3 },
      background: [0.11, 0.13, 0.18, 1],
    })
    const summary = `${info.joints.length} joints · ${info.blendMasks[0].name} mask · ${info.ikRigCount} IK rig`
    await Navigation.present({ element: <SkeletonDemo renderer={renderer} model={model} summary={summary} /> })
  } catch (error) {
    console.error(String(error))
    await Dialog.alert({ title: "Skeleton demo", message: String(error) })
  } finally {
    Script.exit()
  }
}

void run()
