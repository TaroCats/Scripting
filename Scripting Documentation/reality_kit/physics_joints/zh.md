使用原生关节连接刚体，并在已挂载的 RealityKit 场景中查询碰撞体。关节适用于 iOS 18 或更新版本。

## 连接两个刚体

先安装碰撞形状和刚体，再调用 `RealityKit.PhysicsJoint.create()`，传入同一物理模拟中的两个不同实体。每个端点可指定实体局部位置与四元数旋转，也可以选用实体已有的命名 pin。位置以米为单位，角度以弧度为单位。

```ts
const scene = RealityKit.Scene.create()
const fixed = RealityKit.Entity.create({ name: "底座" })
const arm = RealityKit.Entity.create({ name: "摆臂", physics: true, transform: { position: [0, 0.5, 0] } })
fixed.setCollision({ shape: "box", size: [0.2, 0.2, 0.2] })
fixed.setPhysicsBody({ mode: "static" })
arm.setCollision({ shape: "box", size: [0.15, 1, 0.15] })
arm.setPhysicsBody({ mass: 1 })
scene.add(fixed)
scene.add(arm)

const hinge = RealityKit.PhysicsJoint.create({
  kind: "revolute",
  first: { entity: fixed },
  second: { entity: arm, position: [0, -0.5, 0] },
  angularLimit: [-Math.PI / 3, Math.PI / 3],
})
```

| 关节类型 | 运动 |
| --- | --- |
| `fixed` | 将两个 pin 的位置和方向固定在一起。 |
| `revolute` | 绕 pin 局部 X 轴旋转，可设置 `angularLimit`。 |
| `prismatic` | 沿 pin 局部 X 轴滑动，可设置 `linearLimit`。 |
| `spherical` | 围绕共用点旋转，`angularLimitYZ` 可设置局部 Y、Z 轴的角度限制。 |
| `distance` | 将端点距离限制在 `distanceLimit` 范围内，可设置按比例计算的 `tolerance`。 |
| `custom` | 分别为 `linear` 和 `angular` 的 X、Y、Z 轴指定 `"fixed"`、`"unlimited"` 或范围。省略的轴保持固定。 |

范围使用 `[最小值, 最大值]`。可选的 `checksForInternalCollisions` 让 RealityKit 检查相连刚体之间的接触。固定关节使用原生默认值。

读取 `joint.info` 可查看关节是否已安装并参与解算。可以在第一次物理步进前安装关节。场景暂停时句柄仍然有效。恢复场景时，如果两个刚体仍属于同一个世界，运行时会恢复约束。原生恢复失败时可读取 `restoreError`。

使用 `entity.physicsJoints()` 查看指定实体持有的原生关节集合，使用 `scene.physicsJoints()` 查看场景的默认集合。释放关节句柄可移除约束及其端点 pin，实体上的刚体组件会保留。

## 扫描场景

调用 `scene.raycast()` 时，可以传入 `from` 和 `to`，也可以传入 `origin`、`direction` 与可选的 `length`。方向会归一化，默认长度为 100 米。`scene.convexCast()` 在两个位置之间移动盒体、球体或胶囊体，需要指定形状朝向时可以设置 `fromOrientation` 和 `toOrientation`。两种查询均使用原生碰撞形状，可以命中触发器。

```ts
const scene = RealityKit.Scene.create()
function inspectMountedScene() {
  const hits = scene.convexCast({
    collider: { shape: "sphere", radius: 0.15 },
    from: [-1, 0.4, 0],
    to: [1, 0.4, 0],
    query: "nearest",
  })
  console.log(hits[0]?.entity.info.name ?? "无碰撞形状")
}
```

`query: "all"` 返回所有结果，`"nearest"` 返回最近结果，`"any"` 返回一个原生匹配结果。使用无符号 32 位 `mask` 选择碰撞组。可选的 `relativeTo` 实体定义输入、命中位置和法线使用的坐标。省略时使用场景坐标。

每个命中包含实体、位置、法线和原生距离。在 iOS 18 或更新版本上，还会返回形状索引，以及 RealityKit 提供的三角面索引和 UV。凸形扫描要求非零平移。扫描形状起始时已与碰撞体相交，可能返回特殊的原生位置和距离，处理这类结果时需单独判断。

运行文档示例，可以沿轨道滑动小车，并扫描场景查询小车的碰撞形状。
