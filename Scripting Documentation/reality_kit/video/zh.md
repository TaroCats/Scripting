# RealityKit 视频表面

用 `RealityKit.Material.video(source)` 在带纹理坐标的网格上播放视频。用 `entity.setVideoPlayer(source)` 让 RealityKit 按视频尺寸创建屏幕。播放、音频与跳转继续由播放器控制。

- 已打开的 `AVPlayer` 可作为视频材质的来源。
- 视频播放器组件、样本缓冲来源，以及视频材质的深度、剔除和填充选项需要 iOS 18 或更新版本。
- 使用 system 或 remux 后端时，先打开 `VideoPlaybackController`，再绑定到 RealityKit。这两个后端使用 `AVPlayer`。使用 native 后端时，先绑定新建的控制器，再以 `{ backend: "native" }` 打开视频。
- `AVSampleBufferDisplayLayer` 可按同步器时钟提供视频帧。将第一份视频样本入队前，先把该层绑定到 RealityKit。将其加入 `AVSampleBufferRenderSynchronizer`，通过媒体 API 管理音频、字幕和时序。

## 在网格上播放视频

```ts
function addVideo(scene: RealityKit.Scene, path: string) {
  const player = new AVPlayer()
  if (!player.setSource(path)) throw new Error("无法打开视频。")
  const material = RealityKit.Material.video(player)
  const screen = RealityKit.Entity.create({ name: "视频网格" })
  screen.setModel(
    RealityKit.Mesh.primitive({ type: "plane", width: 1.6, height: 0.9, vertical: true }),
    [material],
  )
  scene.add(screen)
  player.play()
}
```

选择纹理坐标与画面匹配的网格。垂直平面朝向默认相机位置。

## 自动设置屏幕尺寸

```ts
function addVideo(scene: RealityKit.Scene, player: AVPlayer) {
  const screen = RealityKit.Entity.create({ name: "视频屏幕" })
  const events = screen.onVideoPlayerChange(event => {
    if (event.kind === "size") console.log(event.videoSize)
  })
  screen.setVideoPlayer(player)
  scene.add(screen)
  const info = screen.videoPlayerInfo()
}
```

安装组件后，`videoPlayerInfo()` 返回视频信息。未安装时返回 `null`。`videoSize` 是 RealityKit 报告的像素尺寸，可能与编码尺寸不同。`screenSize` 的单位是米。加载期间尺寸可能为零，原生状态可能晚于首帧画面更新，`viewingMode` 在系统给出模式前可能为 `null`。监听器在场景挂载后的更新中读取变化。如需初始尺寸，请在挂载后读取当前状态。结束监听时释放订阅。

## 来源生命周期

每个播放来源可以绑定到一个 RealityKit 材质或组件。同一个视频材质可以用于多个网格材质槽。如果需要独立的二维预览，请使用另一个播放器。把控制器或样本渲染器接到三维场景前，先移除它在二维界面上的播放视图。重新打开或替换来源后，请重新创建材质或设置播放器组件。替换或释放来源会清除当前的三维绑定。移除播放器组件会释放其绑定。实体使用的材质即使释放了脚本句柄，也会继续绑定播放来源。

首次打开 native 后端会保留预先建立的绑定。更换 native 来源时，请新建并绑定控制器，再打开视频。如果先启动 native 后端或先将样本入队，后续绑定可能抛出 `sourceAlreadyStarted`。

iOS 上的视频表面显示普通二维视频。使用样本缓冲时，视频表面负责显示画面，音频和字幕由媒体管线管理。

[RealityKit 概览](../zh.md)
