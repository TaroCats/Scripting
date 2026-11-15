# RealityKit 动画

用 `RealityKit.Entity.load()` 加载模型，再调用 `entity.animations({ recursive: true })` 查找 RealityKit 导入的片段。每条结果包含所属实体和片段。iOS 18 或更新版本还可返回动画库键及默认片段标记。片段可能无名，也可能重名。使用结果中的所属实体播放片段。保留原实体层级可以保留导入片段使用的绑定路径。

也可用 `AnimationClip.fromToBy()`、`sampled()` 或 `orbit()` 创建片段。用 `group()` 并行播放，用 `sequence()` 顺序播放，用 `blend()` 混合绑定目标和数据布局一致的轨道。采样片段以秒为单位使用固定帧间隔，支持线性插值和保持。用 `view()` 裁切片段或调整播放选项，用 `repeat()` 设置重复次数或时长。

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

实体进入可见的 `RealityView` 或[离屏渲染器](scripting://doc?title=RealityKit%20Offscreen%20Rendering)后即可调用 `playAnimation()`。每次播放都有独立的暂停、继续、定位、速度、混合权重和停止控制。`waitForEnd()` 返回结束原因。取消信号只取消本次等待，播放仍可控制。`completed` 表示自然播完，`terminated` 也覆盖停止或移除。移除实体或渲染视图会结束播放。重新挂载后，可以创建新的播放器并定位到保存的时间。

iOS 18 或更新版本支持设置命名动画库、淡出、选择交接策略以及监听 `started`。属性绑定支持透明度、受支持的材质属性、骨骼姿势、混合形状权重和子实体 IK 约束。播放前请配置相应组件。`AnimationClip.action()` 可创建原生启用或旋转动作。iOS 26 或更新版本的 `entity.animate()` 可对变换或透明度变化插值。

iOS 27 或更新版本的 `processSkeletal()` 可移除指定关节动画、将采样关节片段转换为叠加动画、提取根运动，或在兼容的源和目标骨架之间重定向片段。用 `setRootMotionPolicy("report")` 和 `onRootMotion()` 自行处理位移。用 `"applyAndReport"` 让 RealityKit 移动实体并返回位移。重新挂载视图后请再次设置策略。

在脚本界面中提供带标签的播放、暂停和进度控制。装饰性动画应遵循减少动态效果设置，保留检查场景所需的操作。
