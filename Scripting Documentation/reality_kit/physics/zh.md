在主 App 前台脚本的 RealityKit 场景中创建碰撞体、刚体和胶囊角色。通过实体读取物理解算后的状态。场景挂载在运行中的 `RealityView` 时，可以订阅接触事件。

## 碰撞体和触发器

调用 `entity.setCollision()` 设置盒体、球体、胶囊体或由网格生成的形状。使用 `setColliders({ shapes, ...options })` 可组合最多 32 个盒体、球体或胶囊体。尺寸以米为单位。每个形状可设置局部 `offset` 偏移和 `rotation` 四元数，四元数顺序为 `[x, y, z, w]`。胶囊体高度包含两端半球。

过滤器使用无符号 32 位的 `group` 和 `mask` 位字段，参与交互的双方应有匹配的位。`trigger` 模式报告重叠并允许物体穿过。触发器无需刚体。`default` 使用 RealityKit 的默认交互，`colliding` 在 iOS 18 或更新版本上提供实体碰撞。在这些版本上，`static` 可提供静态碰撞优化提示，`fullContactInformation` 请求 RealityKit 提供接触点。使用 `collisionInfo()` 查看已安装的碰撞体。

```ts
const checkpoint = RealityKit.Entity.create({ name: "检查点" })
checkpoint.setCollision({
  shape: "box", size: [1.2, 2, 0.4], mode: "trigger", filter: { group: 2, mask: 4 },
})
const listener = checkpoint.onCollision(event => {
  if (event.phase === "began") console.log(event.other.info.name)
})
```

`onCollision()` 返回订阅。调用 `dispose()` 停止监听。每个回调的 `entityA` 是订阅的实体，`entityB` 是另一实体，也可用 `other` 访问。`began` 和 `updated` 包含平均位置和冲量。位置使用最近的物理模拟坐标。iOS 18 或更新版本上，RealityKit 可以返回场景坐标中的接触点和法线，法线从 `entityB` 指向 `entityA`。`ended` 标识接触结束的双方。事件按有界批次交付，可以用 `updated` 观察接触的变化。

## 刚体

先安装碰撞形状，再调用 `setPhysicsBody()`。静态刚体是固定的几何体，运动学刚体按设定的速度移动，动态刚体会响应力、冲量和重力。可以指定质量（千克）或密度（千克每立方米），RealityKit 根据当前形状计算质量属性。还可以设置惯量、质心、惯量方向、摩擦、弹性、平移或旋转轴锁定和连续碰撞检测。iOS 18 或更新版本支持单个刚体的重力开关以及线性和角阻尼。

```ts
const ball = RealityKit.Entity.create({ name: "球", physics: true })
ball.setCollision({ shape: "sphere", radius: 0.17 })
ball.setPhysicsBody({ mass: 1, material: { staticFriction: 0.5, restitution: 0.25 } })
// 在场景挂载后执行。
ball.applyPhysicsAction({ kind: "linearImpulse", vector: [0, 4, 0] })
```

`setPhysicsMotion()` 设置动态或运动学刚体的线速度和角速度，单位分别为米每秒和弧度每秒，向量使用模拟坐标。`physicsBodyInfo()` 返回原生模式、质量属性、速度和动作支持情况。材质字段对应通过此 API 设置的值。更换碰撞几何体时保留刚体的质量属性。再次调用 `setPhysicsBody()` 可根据新形状计算。移除脚本配置的刚体所用的碰撞体前，先调用 `removePhysicsBody()`。

`applyPhysicsAction()` 支持施力、扭矩、线冲量、角冲量、清除力与扭矩和重置动态刚体的物理变换。通过 `point` 可在指定位置施力或施加线冲量。使用同一场景中的实体作为 `relativeTo` 参考坐标，省略时使用场景坐标。刚体激活后可以执行这些动作。用 `Entity.create({ physics: true })` 创建需要接受动作的脚本实体。对于导入的刚体，可通过 `physicsBodyInfo().supportsForceActions` 查询原生实体是否支持这些动作。

## 局部模拟

在 iOS 18 或更新版本上，在父实体上调用 `setPhysicsSimulation()` 创建局部物理世界。后代实体使用最近的模拟。每个世界可以设置根实体局部坐标中的重力方向、运动学刚体碰撞报告、求解迭代次数及可选的 `AnimationClock`。将需要相互碰撞的刚体放在同一个世界。

```ts
const world = RealityKit.Entity.create({ name: "侧向重力" })
if (RealityKit.getCapabilities().localPhysicsSimulations) {
  world.setPhysicsSimulation({ gravity: [4, 0, 0], reportKinematicVsStatic: true })
}
const member = RealityKit.Entity.create({ name: "局部刚体" })
member.setCollision({ shape: "sphere", radius: 0.2 })
member.setPhysicsBody()
world.add(member)
```

通过 `physicsSimulationInfo()` 查看组件，通过 `removePhysicsSimulation()` 移除组件。

## 胶囊角色

在实体上调用 `setCharacterController()`，还可给它附加可见模型。角色控制器管理自己的碰撞胶囊体，安装前移除实体上已有的碰撞体和刚体。可按需设置半径、总高度、皮肤宽度、台阶高度、以弧度表示的坡度限制、向上方向和碰撞过滤器。

挂载后，调用 `moveCharacter({ delta, deltaTime, relativeTo })`。传入位移、以秒为单位的时间和可选的同场景参考实体，省略参考实体时使用场景坐标。返回值立即给出 `side`、`top` 和 `bottom` 碰撞标志及命中结果。每个命中包含对方实体，以及模拟坐标中的位置、法线和移动信息。下一次物理步进后读取解算后的变换、速度和接地状态。使用 `teleportCharacter()` 可以直接放置胶囊体。

运行文档示例，可以将球向上抛出、控制角色走向墙面并重置角色的位置。画面旁的文字会报告动作结果。

使用[物理关节与扫描](../physics_joints/)连接刚体并查询碰撞形状。
