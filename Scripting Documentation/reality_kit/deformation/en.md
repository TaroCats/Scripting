# RealityKit skeletons, blend shapes and IK

Use `entity.deformationInfo()` to check a model's skeletons, poses and deformation components. The legacy joint API works with models that expose a default joint pose. Named poses, model-space joint reads, deformable mesh creation, blend shapes and IK require iOS 18 or later.

Use `entity.skeletons()` to inspect joint names and order, parent indices, rest transforms, and inverse bind matrices when available. The matrices are column-major. `getPose({ space: "model" })` also returns the exact model-space matrix for each joint. `setPose()` accepts a batch of named, joint-local transforms. Specify a skeleton or pose ID when the model has several. Pose reads report the transforms available through RealityKit's pose component.

`Mesh.deformable()` creates a mesh from explicit triangle parts. A skinned part refers to a skeleton by ID and supplies a fixed number of joint indices and weights per vertex. Parent joints precede their children, and each vertex's weights sum to one. A blend shape supplies packed XYZ offsets for each vertex of its part. Use `blendShapes()` to inspect group IDs and weight names. You can update named weights or send an ordered Float32 stream that matches the group's layout.

```ts
function setExpression(entity: RealityKit.Entity, amount: number) {
  const group = entity.blendShapes().find(item => item.weightNames.includes("Smile"))
  if (group) entity.setBlendShapeWeights([{ name: "Smile", value: amount }], { groupID: group.id })
}
```

Create an `IKRig` for the model's skeleton, attach it with `setIK()`, then submit targets with `updateIKTargets()`. Targets default to model space. Set `space: "world"` to submit world-space targets. Use `ikState()` after the next rendered frame to inspect the solver settings and applied targets. The native solver uses the animated skeletal pose as input. Keep the rig attached while updating targets, and attach a compatible rig after changing the model. Use `resetIK()` to reset solver state and `removeIK()` to remove it.
