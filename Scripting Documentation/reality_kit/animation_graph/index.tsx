import { Button, Navigation, NavigationStack, RealityView, Script, ScrollView, Text, VStack, useState } from "scripting"

function MaskDemo({ graph, renderer }: {
  graph: RealityKit.AnimationGraphInstance
  renderer: RealityKit.Renderer
}) {
  const [weight, setWeight] = useState(0)
  const [error, setError] = useState("")
  function change(value: number) {
    try {
      graph.setParameters([{ name: "lift", type: "float", value }])
      setWeight(value)
      setError("")
    } catch (error) {
      setError(String(error))
    }
  }

  return <NavigationStack>
    <ScrollView navigationTitle="Animation graph">
      <VStack spacing={12} padding>
        <RealityView renderer={renderer} frame={{ height: 250 }} accessibilityHidden />
        <Text>{`Lift ${weight * 100}%. The root stays fixed. The middle joint receives half the lift of its clip.`}</Text>
        <Button title="Rest" action={() => change(0)} disabled={weight === 0} />
        <Button title="Half lift" action={() => change(0.5)} disabled={weight === 0.5} />
        <Button title="Full lift" action={() => change(1)} disabled={weight === 1} />
        {error ? <Text>{error}</Text> : null}
      </VStack>
    </ScrollView>
  </NavigationStack>
}

async function run() {
  try {
    if (!RealityKit.getCapabilities().animationGraph) {
      await Dialog.alert({ message: "Animation graphs require iOS 27 or later in the foreground app." })
      return
    }
    const inverseBind = (x: number) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, 0, 0, 1]
    const mesh = RealityKit.Mesh.deformable({
      skeletons: [{ id: "strip", joints: [
        { name: "root", inverseBindPoseMatrix: inverseBind(0), restPoseTransform: {} },
        { name: "middle", parentIndex: 0, inverseBindPoseMatrix: inverseBind(-0.3), restPoseTransform: { position: [0.3, 0, 0] } },
        { name: "tip", parentIndex: 1, inverseBindPoseMatrix: inverseBind(-0.6), restPoseTransform: { position: [0.3, 0, 0] } },
      ] }],
      parts: [{
        id: "strip",
        positions: new Float32Array([0, -0.06, 0, 0, 0.06, 0, 0.3, -0.06, 0, 0.3, 0.06, 0, 0.6, -0.06, 0, 0.6, 0.06, 0]),
        indices: new Uint32Array([0, 2, 1, 2, 3, 1, 2, 4, 3, 4, 5, 3]),
        skin: {
          skeletonID: "strip", influencesPerVertex: 1,
          jointIndices: new Uint32Array([0, 0, 1, 1, 2, 2]),
          weights: new Float32Array(6).fill(1),
        },
      }],
    })
    const model = RealityKit.Entity.create({ name: "Skinned strip" })
    model.setModel(mesh, [RealityKit.Material.create({ kind: "unlit", baseColor: [0.35, 0.88, 0.71, 1] })])
    const skeleton = RealityKit.SkeletonResource.fromEntity(model).withEvaluation({
      blendMasks: [{ name: "Lift joints", jointWeights: [{ joint: "root", weight: 0 }, { joint: "middle", weight: 0.5 }] }],
    })
    const raisedPose: RealityKit.Transform[] = [
      { position: [0.4, 0, 0] }, { position: [0.3, 0.2, 0] }, { position: [0.3, 0.3, 0] },
    ]
    const clip = RealityKit.AnimationClip.sampled({
      valueType: "joints", target: { kind: "jointTransforms" }, names: ["root", "middle", "tip"],
      frames: [raisedPose, raisedPose], frameInterval: 1 / 30,
    })
    const id = (id: number) => ({ id })
    const definition = Data.fromString(JSON.stringify({
      nodes: [
        { RootNodeDefinition: { id: id(1), childID: id(2), name: "Root" } },
        { BlendMaskNodeDefinition: {
          id: id(2), name: "Masked lift", baseChild: id(3), layeredChild: id(4), parameter: { id: id(5) },
          blendMaskName: { name: "Lift joints" }, blendSpace: "ParentSpace", blendTranslation: true, blendRotation: true,
        } },
        { BindPoseNodeDefinition: { id: id(3), name: "Rest" } },
        { AnimationClipNodeDefinition: { id: id(4), name: "Lift", resource: { resource_type: "Animation" } } },
      ],
      parameters: [{ FloatParameterDefinition: { id: id(5), name: "lift", startingValue: 0 } }],
    }))
    if (!definition) throw new Error("Could not encode the graph.")
    const graph = await RealityKit.AnimationGraph.compile({ definition, skeleton, clips: [{ nodeID: 4, clip }] })
    const instance = model.setAnimationGraph(graph)
    const scene = RealityKit.Scene.create()
    scene.add(model)
    const renderer = RealityKit.Renderer.create(scene, {
      camera: { projection: "orthographic", position: [0.3, 0.2, 2], target: [0.3, 0.2, 0], scale: 0.95 },
      background: [0.10, 0.12, 0.17, 1],
    })
    await Navigation.present({ element: <MaskDemo graph={instance} renderer={renderer} /> })
  } catch (error) {
    console.error(String(error))
    await Dialog.alert({ title: "Animation graph", message: String(error) })
  } finally {
    Script.exit()
  }
}

void run()
