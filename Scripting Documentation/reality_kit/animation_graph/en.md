# RealityKit Animation Graphs

Animation graphs run in foreground App scripts on iOS 27 or later. Check `RealityKit.getCapabilities().animationGraph` before using them. A graph can share a set of animations between characters while each character keeps its own inputs and playback state.

## Import a Reality Composer Pro scene

Export a `.reality` scene with its graph assigned to a character. Load the file with `RealityKit.Entity.load(path, { trustExternalReferences: true })` for assets you trust. Find the entity with the graph. In a hierarchy, it may be a child of the imported root. Keep the hierarchy intact during import so the graph can find its authored bindings.

```ts
async function importCharacter(path: string, scene: RealityKit.Scene) {
  const root = await RealityKit.Entity.load(path, { trustExternalReferences: true })
  function findGraph(entity: RealityKit.Entity): RealityKit.AnimationGraphInstance | null {
    const attached = entity.animationGraph()
    if (attached) return attached
    for (const child of entity.info.children) {
      const graph = findGraph(child)
      if (graph) return graph
    }
    return null
  }
  const graph = findGraph(root)
  if (!graph) throw new Error("The scene has no animation graph.")
  scene.add(root)
  if (graph.graph.info.parameterNames.includes("moving")) {
    graph.setParameters([{ name: "moving", type: "bool", value: true }])
  }
  return graph
}
```

Use the parameter types defined by the graph author. Imported graphs expose parameter names. Refer to the author’s settings for types and read-only parameters.

## Compile a graph from JSON

Pass RealityKit's native graph definition as UTF-8 `Data`, a `SkeletonResource` and any clip mappings. A node object has one key naming the native node type, such as `RootNodeDefinition`. Its value contains the node fields. An ID field is an object such as `{ "id": 1 }`. Use decimal strings for IDs beyond JavaScript's safe integer range. Use the same ID in a clip mapping.

The following definition evaluates the bind pose. For a layered graph, run the example from this page to see the complete definition for a clip, a blend mask, and a float parameter.

```ts
async function attachBindPose(model: RealityKit.Entity) {
  const skeleton = RealityKit.SkeletonResource.fromEntity(model)
  const definition = Data.fromString(JSON.stringify({
    nodes: [
      { RootNodeDefinition: { id: { id: 1 }, name: "Root", childID: { id: 2 } } },
      { BindPoseNodeDefinition: { id: { id: 2 }, name: "Rest" } },
    ],
  }))
  if (!definition) throw new Error("Could not encode the graph.")
  const input = { definition, skeleton }
  const result = await RealityKit.AnimationGraph.validate(input)
  if (!result.valid) throw new Error(result.diagnostics.join("\n"))
  const graph = await RealityKit.AnimationGraph.compile(input)
  return model.setAnimationGraph(graph)
}
```

A Reality Composer Pro project file and a graph definition are different file formats. Export the project as `.reality` for the import workflow. Compile accepts up to 1 MiB of graph JSON and 512 nodes. Validation reports malformed definitions and native compiler diagnostics. Compilation rejects if validation fails. You can pass an `AbortSignal` to either operation.

For an `AnimationClipNodeDefinition`, supply `clips: [{ nodeID, clip }]`. RealityKit expects a Timeline resource for the clip node. A sampled joint clip made with `RealityKit.AnimationClip.sampled` works. Some animation resources exposed by imported assets are AnimationScene resources, which the compiler rejects with a diagnostic.

The native format includes these node families.

| Behavior | Definition keys |
| --- | --- |
| Final and initial poses | `RootNodeDefinition`, `BindPoseNodeDefinition` |
| Clips and timing | `AnimationClipNodeDefinition`, `SpeedScaleNodeDefinition` |
| Blending | `Blend1DNodeDefinition`, `BlendMaskNodeDefinition`, `AdditiveNodeDefinition`, `SubtractNodeDefinition` |
| State transitions | `StateMachineNodeDefinition` |
| Root motion | `MotionWarpingNodeDefinition`, `RootMotionGenerationNodeDefinition` |
| IK | `FullBodyIKNodeDefinition`, `FootPlacementNodeDefinition` |

Use the native fields of each node. For example, a state machine's `states` refer to pose nodes by `child_node`. The starting state has `start_state: true`. A transition's `target` is a state or conduit ID. Condition and parameter definitions also use one native type key per object.

See [AnimationGraphResource](https://developer.apple.com/documentation/realitykit/animationgraphresource) and [Working with the Animation Graph](https://developer.apple.com/documentation/realitycomposerpro/working-with-the-animation-graph).

## Attach, drive and inspect

- `entity.animationGraph()` reads the entity's graph instance. `entity.setAnimationGraph(graph)` installs a graph on a model with a compatible mesh skeleton. It supports both imported models and skinned models created with `Mesh.deformable`. An imported graph can be reused when the source entity supplies an unambiguous mesh skeleton. `graph.info.canAttach` reports whether the bridge has skeleton metadata for reuse.
- `instance.setParameters(updates)` applies a batch of typed updates to one entity. `instance.parameter(name, type)` reads a bound value or returns `null` if no value is available. Compiled graphs expose declared types, read-only settings and option choices in `graph.info.parameters`. Use `bool`, `float`, `int`, `vector3`, `rotation` or `option` for entity bindings. Use `instance.trigger(name)` to fire a Trigger parameter. RealityKit clears it after consumption.
- The graph evaluates while the entity is active in a mounted `RealityView`. `instance.state.ready` reports whether the current snapshot contains evaluated nodes. Read the active nodes, state machine nodes, clip nodes and tags after a render update. Node, state, transition and tag IDs are signed decimal strings. A repeating clip's cycle can exceed 1. Tags describe the latest evaluation.
- Use `entity.removeAnimationGraph()` to stop graph evaluation and invalidate its instance. Replacing the mesh clears the graph. Disposing an instance releases the script handle. The graph stays on the entity and can be accessed again through `entity.animationGraph()`. Ordinary clips that target other properties can still play. Remove competing skeletal playback or IK components before installing a graph on the same skeleton.

## Joint masks and IK

Create a skeleton with `withEvaluation({ blendMasks })` and reference a mask by name from `BlendMaskNodeDefinition`. A weight of 0 preserves the base joint and 1 fully uses the layered joint at full graph weight. Omitted joints have a mask weight of 1. The node's float input controls the overall layer weight.

An imported graph keeps its authored native nodes and bindings. When compiling a graph with a Full Body IK node, RealityKit must resolve the referenced rig name in the skeleton's evaluation asset. Script-created `IKRig` resources use an automatic solver identity. The JSON compiler can report an unresolved authored rig name for these resources. For procedural IK outside a graph, use `Entity.setIK` and `Entity.updateIKTargets` after removing the graph from that entity.
