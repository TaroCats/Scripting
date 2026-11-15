# RealityKit skeletal retargeting

On iOS 27 or later, use `RetargetingConfiguration.automatchBiped()` or `automatchQuadruped()` to transfer an animation between compatible characters. Each factory takes source and target skeleton resources. RealityKit identifies anatomical joints from each hierarchy. The same configuration can process several clips from the source skeleton.

```ts
function retargetWalk(
  source: RealityKit.Entity,
  target: RealityKit.Entity,
  walk: RealityKit.AnimationClip,
) {
  const sourceRig = RealityKit.SkeletonResource.fromEntity(source)
  const targetRig = RealityKit.SkeletonResource.fromEntity(target)
  const mapping = RealityKit.RetargetingConfiguration.automatchBiped(sourceRig, targetRig)
  return walk.processSkeletal({ name: "Target Walk", retargeting: mapping })
}
```

Use `sourceTransform` and `targetTransform` to align the roots during matching. Use `jointOffsets` to adjust specific target joints with quaternions in `[x, y, z, w]` order. Read the joint names and paths from the target skeleton. Play the result on a model with the matching target skeleton as its active pose.

`clip.info.sampledSkeletal` reports whether the clip provides sampled joint data. When an imported definition uses another format, you can bake the authored movement to fixed-interval, joint-local transforms and supply those through `AnimationClip.sampled()`. Match the sample joint names to the source skeleton's `nativeName` values. A matching error includes RealityKit's diagnostic.

The demo includes two humanoid assets. Play their original and transferred motion side by side, or select a fixed pose to compare them.
