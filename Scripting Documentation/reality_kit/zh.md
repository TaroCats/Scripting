在主 App 前台脚本中创建和编辑三维场景。通过全局 `RealityKit` API 操作场景、实体和资源，从 `scripting` 导入 `RealityView` 显示场景。

使用随系统或设备变化的功能前，先调用 `RealityKit.getCapabilities()`。动态网格、正交相机组件、表面查询和 ShaderGraph 材质需要 iOS 18 或更新版本。

动画图、可复用骨架、骨骼重定向和网格变形栈适用于 iOS 27 或更新版本。

通过[物理与碰撞](scripting://doc?title=RealityKit%20Physics%20and%20Collisions)添加刚体、触发器和胶囊角色。局部物理模拟需要 iOS 18 或更新版本。

通过[粒子发射器](scripting://doc?title=RealityKit%20Particle%20Emitters)设置爆发和播放状态来绘制效果。

使用[自定义 Metal 材质](scripting://doc?title=RealityKit%20Custom%20Metal%20Materials)控制表面着色和顶点位置。

通过[低层纹理](scripting://doc?title=RealityKit%20Low-Level%20Textures)更新和读回纹理区域。

通过 [Metal 纹理计算](scripting://doc?title=RealityKit%20Metal%20Texture%20Compute)在纹理上直接运行 GPU 内核。

通过[离屏渲染](scripting://doc?title=RealityKit%20Offscreen%20Rendering)获取场景像素并逐步推进动画。

通过[网格实例化](scripting://doc?title=RealityKit%20Mesh%20Instancing)绘制同一网格的多个实例。

通过[视频表面](scripting://doc?title=RealityKit%20Video%20Surfaces)在三维网格或按视频尺寸设置的屏幕上播放视频。

通过[空间音频](scripting://doc?title=RealityKit%20Spatial%20Audio)从场景实体播放声音。

```tsx
import { Button, Navigation, RealityView, Script, VStack } from "scripting"

const scene = RealityKit.Scene.create()
const mesh = RealityKit.Mesh.primitive({ type: "box", size: [1, 1, 1] })
const material = RealityKit.Material.create({ kind: "unlit", baseColor: [0.2, 0.7, 1, 1] })
const cube = RealityKit.Entity.create({ name: "Cube" })
cube.setModel(mesh, [material])
cube.setCollision({ shape: "box", size: [1, 1, 1] })
cube.setAccessibility({ label: "Cube" })
scene.add(cube)

const renderer = RealityKit.Renderer.create(scene, { orbit: true })

function Preview() {
  return (
    <VStack>
      <RealityView renderer={renderer} frame={{ height: 340 }} />
      <Button title="Reset camera" action={() => renderer.resetCamera()} />
      <Button title="Zoom in" action={() => renderer.zoom(1.2)} />
      <Button title="Zoom out" action={() => renderer.zoom(1 / 1.2)} />
    </VStack>
  )
}

try {
  await Navigation.present({ element: <Preview /> })
} finally {
  renderer.dispose()
  scene.dispose()
  cube.dispose()
  mesh.dispose()
  material.dispose()
  Script.exit()
}
```
