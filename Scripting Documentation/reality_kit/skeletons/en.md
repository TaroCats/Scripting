# RealityKit skeleton resources

On iOS 27 or later, use `RealityKit.SkeletonResource.create()` to define a reusable joint hierarchy or `fromEntity()` to copy a model's skeleton. If the model has several skeletons, pass a `skeletonID` from `entity.skeletons()`. A skeleton resource contains rest poses and evaluation settings. Continue using `Mesh.deformable()` or an imported skinned mesh for vertex weights and inverse bind matrices.

List one root first, then each joint after its parent. Rest transforms are parent-local. The returned `info.joints` contains each joint's path, parent index, and `nativeName`. Siblings need distinct names. When a created skeleton repeats a name in different branches, the bridge qualifies those native names with their paths. Use `nativeName` when binding a sampled clip or defining an IK constraint.

```ts
const skeleton = RealityKit.SkeletonResource.create({
  name: "Arm",
  joints: [
    { name: "root" },
    { name: "tip", parentIndex: 0, restPoseTransform: { position: [0, 0.4, 0] } },
  ],
})
const rig = RealityKit.IKRig.create(skeleton, {
  constraints: [{ kind: "point", name: "reach", jointName: "tip" }],
})
const evaluated = skeleton.withEvaluation({
  blendMasks: [{ name: "Tip only", jointWeights: [{ joint: ["root"], weight: 0 }] }],
  ikRigs: [rig],
})
console.log(evaluated.info.blendMasks, evaluated.info.ikRigCount)
```

`withEvaluation()` returns a new resource. Omit a field to preserve it or pass an empty array to clear it. Weights range from `0` to `1`; joints omitted from a mask have the native default weight of `1`. A selector can use a unique joint name, its `nativeName`, or the path from `info.joints`. A mask is a reusable evaluation definition for a graph. Use `setIK()` to install a compatible rig on an entity now.

In the demo, choose a reach target to move a skinned strip and inspect the stored mask. The controls change the rig's target directly.
