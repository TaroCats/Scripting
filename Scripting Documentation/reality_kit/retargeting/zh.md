# RealityKit 骨骼重定向

iOS 27 或更新版本可用 `RetargetingConfiguration.automatchBiped()` 或 `automatchQuadruped()` 在兼容角色之间迁移动作。两个工厂都接收源骨架和目标骨架。RealityKit 根据两个关节层级识别解剖关节。同一匹配配置可用于源骨架的多个动画片段。

```ts
function retargetWalk(
  source: RealityKit.Entity,
  target: RealityKit.Entity,
  walk: RealityKit.AnimationClip,
) {
  const sourceRig = RealityKit.SkeletonResource.fromEntity(source)
  const targetRig = RealityKit.SkeletonResource.fromEntity(target)
  const mapping = RealityKit.RetargetingConfiguration.automatchBiped(sourceRig, targetRig)
  return walk.processSkeletal({ name: "目标步行", retargeting: mapping })
}
```

用 `sourceTransform` 和 `targetTransform` 对齐匹配时的根姿势。用 `jointOffsets` 为目标关节添加旋转偏移，四元数顺序为 `[x, y, z, w]`。关节名称和路径从目标骨架读取。播放时选择活动姿势与目标骨架匹配的模型。

`clip.info.sampledSkeletal` 表示片段能否提供采样关节数据。遇到其他导入动画定义时，可将源动作烘焙为固定时间间隔、关节局部空间的变换，再通过 `AnimationClip.sampled()` 提供。采样的关节名须与源骨架的 `nativeName` 一致。匹配失败时可读取 RealityKit 的诊断信息。

示例内含两个人形资产。可以并排播放源动作和迁移后的动作，也可以跳到固定姿势进行比较。
