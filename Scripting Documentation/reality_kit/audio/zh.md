在主 App 前台脚本的 RealityKit 场景中，从实体播放声音。通过全局 RealityKit API 创建音频资源和播放控制器，从 `scripting` 导入 `RealityView` 挂载场景。

## 加载和播放音频

调用 `RealityKit.AudioResource.load(path, options)`，传入脚本可读取的本地音频文件。默认的 `loadingStrategy: "preload"` 在播放前加载音频。较长的文件可以用 `"stream"`。流式资源存续期间，运行时保留已授权源文件的私有副本。

```ts
async function prepareTone(path: string, emitter: RealityKit.Entity) {
  const sound = await RealityKit.AudioResource.load(path, { loadingStrategy: "stream" })
  const playback = emitter.prepareAudio(sound, { gain: -8 })
  const completed = playback.onCompleted(info => console.log(info.state))
  return { sound, playback, completed }
}
```

发声实体所在的场景挂载后，调用 `playback.play()`，或用 `emitter.playAudio(sound)` 同时准备和启动播放。同一资源可以创建多个播放实例。每个实例可分别控制速率、增益、完成订阅以及播放、暂停和停止。速率范围为 0.25 到 4。增益以分贝为单位，0 为标称电平，`"silent"` 表示静音。通过 `fade({ gain, duration })` 随时间调整增益。`seek(seconds)` 需要 iOS 18 或更新版本。

`playback.info` 返回请求的播放状态、原生 `isPlaying`、增益和速率。使用 `onCompleted()` 观察自然播放结束。释放订阅会停止回调，释放播放句柄会停止音频。移除发声实体或卸载渲染表面也会停止活动播放。重新挂载后可再次调用播放方法。

## PCM 和文件组

使用 `AudioResource.fromPCM(buffer)` 将同一脚本中的 `AVAudioPCMBuffer` 转为资源。该方法复制有效帧。Promise 完成后，可以编辑或释放原缓冲区。音频文件和 PCM 均可开启循环。iOS 18 或更新版本还支持随机开始位置、动态归一化、校准和命名混音组。

iOS 18 或更新版本上，可以通过 `AudioResource.fileGroup(resources)` 组合文件资源。原生引擎会在播放时从组中选择文件。使用 `sound.info` 查看资源类型、加载策略和系统提供的时长。

## 空间音源和监听器

iOS 18 或更新版本上，可用 `entity.setAudioSource()` 选择空间、环境或声道渲染。空间音源支持整体增益、直达声与混响电平、0 到 1 的指向性集中程度和距离衰减。RealityKit 使用单声道进行空间化，必要时会先混合多个输入声道。

```ts
const emitter = RealityKit.Entity.create({ transform: { position: [-1, 0, 0] } })
if (RealityKit.getCapabilities().spatialAudioConfiguration) {
  emitter.setAudioSource({ kind: "spatial", beamFocus: 0.3, rolloff: 1, reverbLevel: -12 })
}
```

默认使用活动相机作为监听器。调用 `renderer.setAudioListener(entity)`，可使用同一场景中指定实体的位置和方向。省略参数可恢复默认监听器。iOS 18 或更新版本上，使用 `scene.setAudioReverb()` 选择混响预设，例如 `"concertHall"`、`"smallRoom"` 或 `"anechoic"`。

## 资源库和混音组

iOS 18 或更新版本上，`entity.audioLibrary()` 可以读取导入或脚本配置的原生命名资源库。使用 `setAudioLibrary([{ name, resource }])` 安装资源库，名称应唯一。调用 `removeAudioLibrary()` 清除资源库。

通过 `AudioResource.load` 加载的文件，其 `resource.info.name` 是去掉扩展名的文件名。来自导入音频库的文件资源使用库条目的名称。为已有资源添加库别名时，资源的 `info.name` 保持原值。

使用 `setAudioMixGroup({ name, gain, speed, muted })` 在场景实体上配置命名混音组。在资源的 `mixGroup` 选项中使用该名称。通过 `audioMixGroup(name)` 读取混音组，通过 `fadeAudioMixGroup()` 随时间调整增益，通过 `removeAudioMixGroup(name)` 删除指定组。

运行文档示例，可以播放提示音，并将音源从场景一侧移到另一侧。控件会显示音源位置和播放状态。
