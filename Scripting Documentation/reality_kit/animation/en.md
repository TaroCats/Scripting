# RealityKit animation

Load a model with `RealityKit.Entity.load()`, then call `entity.animations({ recursive: true })` to find the clips RealityKit imported. Each entry contains its owning entity and clip. On iOS 18 or later it can also contain a library key and indicate the default clip. Names can be empty or shared by multiple clips. Use the entry's owner to play it. Keeping the original entity hierarchy preserves the paths used by imported clips.

You can also create a clip with `AnimationClip.fromToBy()`, `sampled()` or `orbit()`. Use `group()` to play clips together, `sequence()` to play them in order, and `blend()` to mix tracks that share a target and value layout. A sampled clip uses a fixed interval in seconds and supports linear and hold interpolation. Use `view()` to trim a clip or change its playback options and `repeat()` to set a count or duration.

```ts
const travel = RealityKit.AnimationClip.fromToBy({
  name: "Travel",
  target: { kind: "transform" },
  valueType: "transform",
  to: { position: [0, 1, 0] },
  duration: 1,
  curve: "easeInOut",
  fillMode: "forwards",
})

function playTravel(entity: RealityKit.Entity) {
  return entity.playAnimation(travel, { transitionDuration: 0.15 })
}
```

Call `playAnimation()` after the entity is attached to a visible `RealityView` or an [OffscreenRenderer](scripting://doc?title=RealityKit%20Offscreen%20Rendering). The returned playback has its own pause, resume, seek, speed, blend factor and stop controls. `waitForEnd()` reports the end reason. An abort signal cancels the wait and leaves playback available. `completed` is a natural end. `terminated` also covers stopping or removal. Removing an entity or its rendering surface ends playback. On remount, start a new playback and seek to a saved time to continue.

On iOS 18 or later, you can configure a named animation library, fade out, choose a handoff policy, or subscribe to `started`. Property bindings include opacity, supported material values, skeletal poses, blend shape weights, and IK constraints on child entities. Set up the bound component before playing the clip. `AnimationClip.action()` creates native enabled or spin actions. On iOS 26 or later, `entity.animate()` interpolates transform or opacity changes.

On iOS 27 or later, `processSkeletal()` can remove joint animation, convert a sampled joint clip to additive motion, extract root motion, or retarget a clip with compatible source and destination skeletons. Use `setRootMotionPolicy("report")` and `onRootMotion()` to handle the displacement yourself. Use `"applyAndReport"` to let RealityKit move the entity and also report the displacement. Set the policy again after remounting the view.

Provide labeled Play, Pause and Seek controls when exposing animation in a script UI. Honor Reduce Motion for decorative movement and preserve controls needed to inspect the scene.
