# RealityKit 骨架资源

iOS 27 或更新版本可用 `RealityKit.SkeletonResource.create()` 定义可复用的关节层级，也可用 `fromEntity()` 复制模型的骨架。模型有多套骨架时，从 `entity.skeletons()` 选择 `skeletonID`。骨架资源保存静止姿势和求值设置。顶点权重和逆绑定矩阵仍由 `Mesh.deformable()` 或导入的蒙皮网格提供。

先列出唯一的根关节，每个子关节都放在父关节之后。静止变换采用父关节局部空间。`info.joints` 返回每个关节的路径、父索引和 `nativeName`。同一父关节下的名称须唯一。创建骨架时，不同分支上的同名关节会用完整路径作为原生名称。绑定采样片段和定义 IK 约束时使用 `nativeName`。

```ts
const skeleton = RealityKit.SkeletonResource.create({
  name: "手臂",
  joints: [
    { name: "root" },
    { name: "tip", parentIndex: 0, restPoseTransform: { position: [0, 0.4, 0] } },
  ],
})
const rig = RealityKit.IKRig.create(skeleton, {
  constraints: [{ kind: "point", name: "reach", jointName: "tip" }],
})
const evaluated = skeleton.withEvaluation({
  blendMasks: [{ name: "末端", jointWeights: [{ joint: ["root"], weight: 0 }] }],
  ikRigs: [rig],
})
console.log(evaluated.info.blendMasks, evaluated.info.ikRigCount)
```

`withEvaluation()` 返回新资源。省略字段会保留该设置，传入空数组可清除。权重范围是 `0–1`，遮罩中省略的关节采用原生默认权重 `1`。关节可用唯一的名称、`nativeName` 或 `info.joints` 中的路径指定。遮罩是供动画图使用的求值定义。可以用 `setIK()` 将兼容的 rig 直接安装到实体上。

运行示例后选择伸展目标，观察蒙皮条带的形变和保存的遮罩。示例控件会直接改变 rig 的目标。
