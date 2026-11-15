`Scene.create()` 创建场景。`scene.add(entity)` 添加根实体，`entity.add(child)` 建立层级，`scene.query({ name, component })` 查找实体。`entity.info` 包含父节点、子节点、局部变换及组件名称，导入的组件可能使用原生类型名称。

位置和距离以米为单位。旋转用 [x, y, z, w] 四元数表示。矩阵采用列主序。`entity.matrix()` 返回世界矩阵。为 `matrix` 或 `convertPosition` 传入参考实体即可使用其坐标系。`entity.bounds()` 返回实体局部坐标中的包围盒。`scene.setTransforms` 会在改变任何变换前验证整个批次。

通过 `setModel`、`setLight`、`setCollision` 和 `setAccessibility` 添加组件。`clone()` 复制实体层级并共享模型资源。`remove()` 将实体从父节点移除。`dispose()` 释放脚本句柄，场景仍持有已挂载的实体及其资源。
