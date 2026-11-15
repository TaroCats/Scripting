在 iOS 18 或更高版本上，可以为 RealityKit 场景中的实体添加原生粒子。使用前先检查 `RealityKit.getCapabilities().particles`，然后用 `RealityView` 挂载场景。[RealityKit 渲染与交互](scripting://doc?title=RealityKit%20Rendering%20and%20Interaction)

## 创建或更新发射器

调用 `entity.setParticles(options)` 创建发射器或更新当前设置。选择 `preset` 可使用 RealityKit 的 `fireworks`、`impact`、`magic`、`rain`、`snow` 或 `sparks` 预设，然后覆盖需要调整的字段。省略预设时，未填写的字段保留当前值。新发射器采用 RealityKit 默认值。

```ts
const emitter = RealityKit.Entity.create({ name: "Sparks" })
emitter.setParticles({
  preset: "sparks",
  isEmitting: false,
  burstCount: 36,
  burstCountVariation: 0,
  mainEmitter: {
    lifeSpan: 0.6,
    lifeSpanVariation: 0,
    color: { type: "constant", value: { type: "single", color: [0.1, 0.9, 0.7, 1] } },
  },
})
// Call from a control after mounting the scene containing the emitter.
function showBurst() {
  emitter.particleAction("burst")
}
```

## 配置粒子外观和运动

| 设置 | 选项 |
| --- | --- |
| 粒子从哪里出现 | `emitterShape` 支持点、平面、盒体、球体、圆锥、圆柱和环面。用 `emitterShapeSize` 设置尺寸，用 `birthLocation` 选择表面、体积内部或顶点网格。网格使用 `{ type: "vertices", count: [x, y, z] }`。 |
| 粒子如何移动 | `birthDirection` 可使用世界方向、局部方向或法线方向。用 `emissionDirection`、`speed`、`speedVariation`、`radialAmount` 和 `torusInnerRadius` 调整发射。`particlesInheritTransform` 和 `fieldSimulationSpace` 控制粒子运动如何跟随实体和作用场。 |
| 粒子何时出现 | 在 `timing.type` 中选择 `"once"` 或 `"repeating"`。两者都接受 `emit: { duration, variation? }` 和可选的 `warmUp`。循环时序还可设置 `idle`。时长和寿命均以秒为单位。 |
| 主粒子和子粒子 | `mainEmitter` 控制主粒子。`spawnedEmitter` 添加子粒子，通过 `spawnOccasion` 选择在主粒子出现、更新或消亡时生成。用生成速度、扩散和颜色继承字段调整子粒子与主粒子的关系。设置 `spawnedEmitter: null` 可移除子发射器。 |

每个发射器可设置生成速率、寿命、尺寸、颜色、透明度曲线、混合模式、排序、光照和粒子朝向。用加速度、阻尼、质量、噪声、吸引、涡旋、扩散角和角运动调整粒子的移动方式。`color` 使用 `{ type: "constant", value }` 或 `{ type: "evolving", start, end }`。每个颜色值可使用 `{ type: "single", color }` 或 `{ type: "random", a, b }`，RGBA 各分量取 0 到 1。

用 `image` 指定 `RealityKit.Texture`。用 `imageSequence` 设置纹理图集的 `rowCount`、`columnCount`、起始帧、帧速率和动画模式（`"playOnce"`、`"looping"` 或 `"autoReverse"`）。帧索引从零开始。将 `image` 或 `imageSequence` 设为 `null` 可清除对应设置。脚本释放纹理句柄后，发射器仍保留已绑定的纹理。

## 控制发射

- 设置 `isEmitting: false` 会关闭自动生成，已有粒子继续运行到寿命结束。
- 使用 `particleAction("burst")` 可触发一次发射，即使自动生成已关闭。用 `burstCount` 和 `burstCountVariation` 控制数量。
- 使用 `"pause"` 暂停模拟，`"play"` 继续模拟，`"stop"` 停止模拟并清除粒子。使用 `"restart"` 重置发射时序。
- 用 `particlesInfo()` 读取当前设置。实体没有发射器时返回 `null`。预设纹理、导入纹理或已释放句柄的纹理仍可通过 `hasImage` 确认存在，此时脚本的 `image` 值为 `null`。用 `removeParticles()` 移除组件。

无效更新会保留先前的发射器。生成速率、寿命、顶点网格、图集尺寸和单次发射数量受可用资源限制。如果设置抛出 `resourceLimit`，可降低粒子工作量。

示例启动时保持静止，只有主动操作才短暂发射。使用带标签的按钮显示或清除粒子，并通过文字状态了解结果。
