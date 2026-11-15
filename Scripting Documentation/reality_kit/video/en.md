# RealityKit Video Surfaces

Use `RealityKit.Material.video(source)` to play video on a mesh with texture coordinates. Use `entity.setVideoPlayer(source)` to let RealityKit create a screen sized for the video. Your player continues to control playback, audio, and seeking.

- An open `AVPlayer` works with video materials on supported RealityKit hosts.
- Video player components, sample-buffer sources, and video material depth, culling, and fill options require iOS 18 or later.
- Open a `VideoPlaybackController` with the system or remux backend before binding it. Both backends use an `AVPlayer`. To use the native backend, bind a new controller first, then open it with `{ backend: "native" }`.
- An `AVSampleBufferDisplayLayer` can supply video samples on a synchronizer clock. Bind the layer to RealityKit before enqueueing its first video sample. Add it to an `AVSampleBufferRenderSynchronizer` and manage audio, captions, and timing with the media APIs.

## Video on a mesh

```ts
function addVideo(scene: RealityKit.Scene, path: string) {
  const player = new AVPlayer()
  if (!player.setSource(path)) throw new Error("Could not open the movie.")
  const material = RealityKit.Material.video(player)
  const screen = RealityKit.Entity.create({ name: "Video mesh" })
  screen.setModel(
    RealityKit.Mesh.primitive({ type: "plane", width: 1.6, height: 0.9, vertical: true }),
    [material],
  )
  scene.add(screen)
  player.play()
}
```

Choose a mesh whose UVs match the image. A vertical plane faces the camera at its default position.

## Automatic screen sizing

```ts
function addVideo(scene: RealityKit.Scene, player: AVPlayer) {
  const screen = RealityKit.Entity.create({ name: "Movie screen" })
  const events = screen.onVideoPlayerChange(event => {
    if (event.kind === "size") console.log(event.videoSize)
  })
  screen.setVideoPlayer(player)
  scene.add(screen)
  const info = screen.videoPlayerInfo()
}
```

`videoPlayerInfo()` returns `null` until a component is installed. `videoSize` reports RealityKit's video dimensions in pixels, which can differ from the encoded dimensions. `screenSize` is measured in meters. Sizes may be zero during loading. The native status can lag the first displayed frame, and `viewingMode` can be `null` until RealityKit reports a mode. The listener reads changes on updates from a mounted scene. Query the current state after mounting if you need the initial dimensions. Dispose the event subscription when you finish listening.

## Source lifetime

Use one RealityKit binding per playback source. You can assign a single video material to multiple mesh material slots. Use a separate player when you need an independent 2D preview. Remove a playback or sample-buffer view before binding its controller or renderer in 3D. Reopen or replace a source, then create a new material or set the player component again. Replacing or disposing the source clears its current 3D binding. Removing a player component releases its binding. A material remains bound while an entity uses it, even after its script handle is disposed.

The first native open keeps its prepared binding. For a new native source, create and bind a new controller before opening it. Starting native playback first or enqueueing samples before binding can raise `sourceAlreadyStarted`.

On iOS the video surfaces present ordinary 2D video. A sample-buffer surface presents video frames while your media pipeline handles audio and captions.

[RealityKit overview](../en.md)
