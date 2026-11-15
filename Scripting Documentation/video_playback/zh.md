`VideoPlaybackController` 可在 iOS/iPadOS 17+ 的主 App 脚本中播放本地文件和 HTTP(S) 媒体。使用 `VideoPlaybackPlayer` 显示画面和内置控制层，或使用 `VideoPlaybackView` 搭配自己的控件。视图显示期间保留控制器，用完后等待 `dispose()` 完成。

## 打开与控制

```tsx
import { VideoPlaybackPlayer, VideoPlaybackView } from "scripting"

const player = new VideoPlaybackController()
await SharedAudioSession.setCategory("playback", ["mixWithOthers"])
await SharedAudioSession.setActive(true)
await player.open("/path/movie.mkv")
await player.play()
// 在组件内渲染：
// <VideoPlaybackPlayer controller={player} title="My movie" />
```

`open(source, { backend?, decoder?, headers?, audioOutput? })` 准备媒体，默认不自动播放。支持本地路径、`file:` URL 和 HTTP(S) URL；文件访问遵循脚本的文件权限。请求头有数量和大小限制，不得包含控制字符。

- `backend: "auto"` 对普通媒体使用原生播放，对不带自定义请求头的 HLS 使用系统播放，对支持的 HDR 源使用系统或转封装输出；已声明的 Profile7 双层源使用原生重建。DASH 和自定义请求头使用原生路径。通过 `mediaInfo.backend` 查看实际路径。
- `backend: "native"` 请求原生解码与输出；`decoder` 可选 `"auto"`、`"hardware"`、`"software"`。无法提供硬解时明确报错。App 进入后台时原生播放暂停。
- `backend: "system"` 请求系统播放。`backend: "remux"` 将 H.264/HEVC 视频保留在有容量限制的本地 HLS 窗口中，兼容的 AAC/AC3/EAC3/ALAC 和不超过 24-bit 的 FLAC 音轨保持压缩码流；其他支持解码的音轨（包括 TrueHD/DTS）转换为 48 kHz 立体声 AAC，通过重建相应窗口支持按原片时间跳转。系统和转封装路径要求 `decoder: "auto"`。自定义请求头由原生/转封装支持，显式系统播放会拒绝请求头。

使用 `play()`、`pause()`、`seek(seconds)`、`stop()` 和 `dispose()`。`stop()` 后可重新打开媒体；`dispose()` 后不可再用。重播已经结束的原生媒体时，先跳到零秒再播放。`playbackRate` 范围为 0.25–4，`volume` 为 0–1，`muted` 独立控制静音。请按脚本的音频策略配置共享音频会话。

`play()` 表示请求播放；准备足够数据时可能先进入 `buffering`。通过 `state` 或状态事件判断是否已经实际开始播放。

可读取 `state`、`position`、`duration` 和 `mediaInfo`；时长可能为 `null`。通过 `on("state" | "progress" | "ready" | "ended" | "seeked" | "tracks" | "error" | "overlayError" | "interaction", callback)` 订阅事件，每次订阅返回取消函数。进度是定期通知，不是逐帧回调。请等待异步操作并处理错误；被后续操作取代的打开/跳转，以及释放后的操作会拒绝。系统跳转无法完成时会拒绝操作，不会一直等待；请先处理错误再重试。

## 格式与输出

原生路径包含 MP4/MKV/MOV/WebM 解封装、H.264/HEVC/AV1/VP9 视频以及 AAC/AC3/EAC3/TrueHD/DTS/FLAC/ALAC/Opus/Vorbis/MP3 音频，实际可用性取决于流配置和资源限制。HTTP(S)、HLS 和 DASH 是不同的输入路径。格式名称不代表任意编码档次、损坏文件、DRM 内容或输出设备都能播放。

`mediaInfo.audioTranscoded` 表示是否经过兼容转换；`preservesCompressedAudio`、`outputAudioCodec`、`outputAudioChannels` 和 `outputAudioSampleRate` 分别描述实际输出，原始轨道信息仍保留。转换后的 AAC 为有损立体声，不保留 Atmos/DTS:X 对象。

原生音频默认输出立体声 PCM；原生路径可设置 `audioOutput: "multichannel"` 保留支持的布局，最多 8 声道，未知或不支持的布局会明确失败。系统/转封装请求会拒绝该选项。默认立体声和多声道模式解码标注 Atmos 或 DTS:X 的源时，不保留对象音频输出；显式对象模式见下文。显式原生播放支持 10-bit BT.2020 PQ/HLG，并向系统渲染器传递支持的 HDR10+ 逐帧元数据以适配显示器；普通 HDR 和单层杜比的自动选择继续使用系统/转封装策略。系统 HDR10/HLG/杜比效果取决于源、系统、显示器和音频路由。转封装路径接受系统可播放的单层杜比视界 Profile5/8。支持的 Profile7 MEL/FEL 使用原生重建，接受合并或独立的基础层/增强层轨道，包括增强层内携带初始化参数的形式；自动选择也使用该路径。显式 system/remux 会拒绝双层文件；层缺失或时间戳不匹配会明确失败。不提供 TrueHD Atmos 直通或Profile 转换。实际 HDR10+ 渲染取决于系统和输出路由，传递元数据不代表显示器认证。`getCapabilities()` 描述实现边界，不能认证当前连接的显示器或功放。

重建 Profile7 时，`mediaInfo.dolbyVisionReconstructed` 表示已完成两层合成，`dolbyVisionLayers` 为 `combined`/`separate`，`dolbyVisionEnhancement` 为 `mel`/`fel`。输出为 `hdrOutput: "linearBT2020"`，保留浮点 HDR 画面，不保留原始杜比码流。`getCapabilities().native.dualLayerDolbyAvailable` 表示组件可用性。输入支持10-bit HEVC层、12-bit VDR和常规单分区映射；不支持的配置会拒绝，不会只显示基础层。设备无法硬解的HEVC变体可选择 `decoder: "software"`。

`MediaProbe.inspect(source)` 可在不开始播放的情况下读取轨道、编码、分辨率、帧率、码率、已知色深、章节和元数据。杜比配置和空间音频标签描述源，不代表已验证的输出。系统播放也会提供可读取的轨道格式、常用元数据与章节；系统未暴露的值保持缺失，不会把某条音轨的声道信息猜配给其他备选音轨。探测得到的 ID 仅属于该次探测；选择播放轨道时，应使用该控制器 `getTracks()` 返回的 ID。打开新媒体后旧 ID 失效。

## 轨道与字幕

使用 `selectAudioTrack(id)` 和 `selectSubtitleTrack(id | null)`。原生/转封装字幕使用独立且有资源限制的读取器；回退跳转可能需要重新扫描稀疏字幕源，并可能触发资源或时间限制。系统轨道切换遵循媒体提供的可选轨道组。

```ts
await player.loadSubtitles(srtText, "srt") // srt、vtt、ass、ssa
player.subtitleDelay = 0.4 // 正值使字幕稍后显示
player.setSubtitleStyle({ fontSize: 28, color: "#FFFF00", position: "bottom" })
player.subtitlesEnabled = true
await player.loadSubtitleFile("/path/captions.sup")
await player.loadSubtitleFile("/path/captions.idx") // 同目录保留配套 .sub
player.clearSubtitles()
```

SRT 显示纯文本并移除基本标记。文本与本地文件 WebVTT 支持 STYLE 的 `::cue`、`::cue(.class)`，可设置 color/background-color、本地 font-family、px/em/百分比 font-size、normal/bold font-weight、normal/italic font-style 和 none/underline text-decoration；支持 cue 的 line/position/size/align/vertical 和 REGION 的宽度、行数及锚点，滚动区域无动画更新。支持 b/i/u/c/v/lang 内联标记，其他 CSS、选择器或标记会明确拒绝。Matroska 和 MP4（`wvtt`，含 fragmented MP4）内嵌 WebVTT 也保留源文件中的这些定位、内联样式和头样式。MP4 支持单样本多条字幕及用于清空字幕的空样本。不支持的内嵌包布局或样式会报错；暂不支持 MP4 字幕时间扩展（`ctim`）。ASS/SSA 默认保留原样式；显式字体/颜色/位置设置覆盖普通对白，带明确定位的标牌保留源布局，`assFontScale` 范围为 0.5–3。位图字幕保持原始像素。外挂文本字幕请使用 UTF-8。本地字幕文件支持 SRT/VTT/ASS/SSA、PGS `.sup` 和 VobSub `.idx`/`.sub`，VobSub 两个文件需要一起导入。加载外挂字幕会关闭已选中的内嵌字幕；打开或停止媒体会清空叠加内容。

文本字幕最多 8 MiB、50000 条；ASS 最多 2 MiB、10000 个事件，同时显示最多 32 个事件。文本查找最多显示 128 条活动字幕。渲染另有像素、缓存和合成工作量限制，流式读取还有时间限制。图形字幕不会自动生成可朗读文本；请在完成的 UI 中做真实 VoiceOver 验证。

## 弹幕

```ts
await player.loadDanmaku([{ id: "one", time: 2, text: "你好", mode: "scroll", color: "#FFFFFF", fontSize: 24 }])
await player.injectDanmaku([{ time: player.position + 1, text: "新弹幕", mode: "top" }])
player.setDanmakuStyle({ speed: 1, area: 0.5, blockedWords: ["剧透"], blockedAuthors: ["blocked-id"] })
player.danmakuOpacity = 0.8
player.danmakuEnabled = false
```

模式为 `scroll`（从右向左）、`reverse`（从左向右）、`top`、`bottom` 和 `animated`。时间、暂停、跳转和倍速都跟随媒体。速度范围为 0.4–2，显示区域为 0.1–1，透明度为 0–1。最多加载 50000 条、8 MiB，每次最多注入 1024 条，每条最多 512 字符。拥挤轨道或过长文本可能被省略，以限制渲染开销。过滤使用不区分大小写的普通子串匹配和作者 ID，可使用下述关键帧结构编排动画，不支持第三方脚本动画。系统开启“减弱动态效果”时隐藏滚动和动画弹幕。`getActiveDanmaku()` 提供最多 64 条当前未屏蔽的文字，可用于无障碍替代界面；移动弹幕不会持续自动朗读。

导入本地 UTF-8 文件或文本：

```ts
const report = await player.loadDanmakuFile("/comments.xml")
await player.loadDanmakuText(JSON.stringify([{ time: 1, text: "你好", mode: "reverse" }]), "json")
console.log(report.format, report.loaded, report.skipped, report.unsupportedModes)
```

JSON 使用与 `loadDanmaku` 相同的弹幕数组。XML 接受 Bilibili 兼容的 `i/d` 文档和弹弹play 的 `ArrayOfVisualDmItem` 文档。Bilibili 模式 1/4/5/6 对应滚动/底部/顶部/反向。高级、脚本及其他未知 XML 模式会被跳过并在结果中报告，内容不会执行。文件必须是最多 8 MiB 的普通 UTF-8 `.json` 或 `.xml` 文件；其他扩展名可显式传入可选的 `format`。文档畸形时拒绝导入，保留现有弹幕。后发的加载、注入、清空或媒体源切换会使先前导入失效。


使用 `animated` 和归一化的文字中心坐标编排动画：

```ts
await player.injectDanmaku([{ time: 3, text: "你好", mode: "animated", animation: [
  { at: 0, x: 0.2, y: 0.3, opacity: 0 },
  { at: 2, x: 0.8, y: 0.6, opacity: 1, rotation: 90, scale: 1.5 },
] }])
```

每条使用 2–32 个 `at` 严格递增的关键帧，从相对弹幕开始时间的 0 秒开始，最后一帧为 0.1–20 秒。`x`/`y` 范围 0–1，透明度 0–1，旋转 -3600–3600 度，缩放 0.25–4。外观默认透明度 1、旋转 0、缩放 1。属性随媒体时间线性插值，普通弹幕速度不会拉伸动画时长。动画使用作者指定的位置，可能与其他弹幕重叠。整份文档在 8 MiB 预算内最多含 100000 个关键帧。仅 `animated` 模式可提供 `animation`；动画结构不合法时整次操作拒绝，保留现有弹幕。JSON 导入接受相同结构，Bilibili 模式 7 和脚本模式仍会跳过并报告。


## 后台音频

```ts
await SharedAudioSession.setCategory("playback", ["mixWithOthers"])
await SharedAudioSession.setActive(true)
player.backgroundAudioEnabled = true
player.on("backgroundAudio", value => console.log(value.videoSuspended))
player.on("backgroundAudioError", value => console.log(value.message))
```

偏好默认为 `false`，共享音频会话仍由脚本配置。原生媒体有选定音轨时，开启后会在 App 失去活动状态时切换为仅解码音频，返回前台后按当前媒体时间恢复视频。暂停、倍速和源时间跳转保持原有含义。`mediaInfo.videoSuspended` 及原生播放状态快照反映当前模式，不代表当前一定有可听声音；视频暂停输出期间，截图或当前帧读取可能不可用。

激活的画中画优先保留视频；开启此偏好时，关闭浮窗可接续后台音频。后台打开另一个原生源需要先开启此偏好且媒体包含音轨；准备过程恰遇退后台而被中断时，操作可能拒绝，可重试。系统/转封装播放请求系统尽力继续，关闭偏好后恢复系统自动策略，仍受设备、音频会话和系统限制。后台关闭偏好且没有活动画中画窗口时会暂停播放。可选控制栏的设置菜单也提供此偏好。后台偏好本身不改变音频输出模式；默认立体声和多声道模式不保留 Atmos/DTS:X 对象信息，显式对象模式见下文。

## 画中画

先打开视频并保持其 `VideoPlaybackView` 挂载。通过 `player.getPictureInPictureState()` 读取实际的 `supported`、`possible`、`active` 状态。平台支持时，可选控制栏的设置菜单也提供画中画入口。

```ts
const off = player.on("pictureInPicture", state => console.log(state.active))
if (player.getPictureInPictureState().possible) await player.startPictureInPicture()
player.stopPictureInPicture()
off()
```

启动操作在系统窗口激活后完成；不可用、取消、超时或媒体源被替换时拒绝，不会自动启动。原生、系统和转封装视频复用各自的播放输出。原生播放可在画中画激活时退后台继续，没有激活窗口时退后台会暂停；不需要浮窗时，可使用下面的后台音频偏好。浮窗显示视频，不包含自有字幕、弹幕和控制栏叠层。收到 `pictureInPictureRestoreRequested` 时可导航回包含视频视图的页面，恢复成功取决于该视图是否已挂载。`pictureInPictureError` 提供错误消息。替换媒体、停止或销毁控制器会关闭浮窗。可用性取决于设备和当前播放状态。

## 图像与原始帧

`await snapshot()` 返回不含字幕、弹幕和控件的视频图像；系统源可能拒绝暂不可用或受保护的图像。`await extractFrame(seconds)` 独立解码覆盖或紧随指定时间的第一帧，返回帧包含实际显示时间。原生 PQ/HLG 帧提取保留支持的10-bit像素和色彩信息，支持的Profile7提取返回重建后的HDR画面；其他不支持的杜比配置或受保护图像仍可能拒绝。

`copyCurrentFrame()` 返回原生/系统/转封装后端的当前帧，尚无可用画面时为 `null`。原生显示帧读取要求 iOS/iPadOS 17.4+ 且处于暂停状态，请先调用 `pause()`；无法从渲染器获得准确时间时，其时间为 `null`，转封装时间对应原片。`VideoFrame` 包含尺寸、像素格式、平面数量、`copyPlane(index)` 和 `toImage()`；使用 `toImage({ dynamicRange: "hdr" })` 可将高光保留在半浮点扩展线性 BT.2020 图像中，普通调用保持原有图像转换。后续图像编码决定是否继续保留该范围。平面副本支持 BGRA/ARGB/RGBA/ABGR、RGBA-half、NV12 和 P010，保留行跨度并将填充字节置零。软件输出会根据尺寸和精度选择布局：4K 级 8 位 SDR 可使用 NV12，支持的 10 位 SDR 使用 P010 保留精度；较小的 8 位画面保留原有 BGRA 路径。读取平面数据前先检查 `pixelFormat`、`planeCount` 和 `bytesPerRow`；其他原生格式可能拒绝平面复制。请及时调用 `frame.dispose()`：每个控制器最多保留两个活动帧，共享 64 MiB 帧预算，且同一时间只允许一个图像/截帧操作。释放控制器会使它的帧失效。

`pixelFormat` 使用 FourCC：`420v`/`420f` 分别表示有限/完整范围 NV12，`x420`/`xf20` 分别表示有限/完整范围 P010。两者均先提供 Y 平面，再提供交织的 CbCr 平面。P010 每个采样值以小端无符号 16 位存储，有效 10 位位于高位，右移 6 位即可读取采样值。

## 播放器与自定义视图

`VideoPlaybackView` 本身没有控制栏；每个控制器只挂载一个播放表面。`videoGravity` 可选 `resizeAspect`、`resizeAspectFill` 或 `resize`；`rotation`、`mirrored` 和 `zoom`（1–8）控制视频。字幕和弹幕在视口中保持正向。

通过 `gestures: true` 启用手势：单击播放/暂停；双击按画面左右半区后退/前进 10 秒；横向拖动跳转；右侧竖向拖动调节播放器音量，左侧调节临时屏幕亮度；长按临时使用 2 倍速；双指缩放。表面移除时，如果亮度/倍速未被其他操作改变，会恢复临时设置。屏幕亮度行为取决于设备。播放、暂停和跳转也提供无障碍操作；请同时提供可见控件，并在目标设备验证触摸、焦点和 VoiceOver。

`VideoPlaybackPlayer` 将画面与悬浮控制层整合，提供播放/暂停、前后跳转、连续进度条、时间、倍速、字幕、音轨、章节、弹幕、音量、后台音频及可用的画中画入口。单击画面显示或隐藏控件，播放中默认三秒后隐藏；暂停、加载、缓冲或开启 VoiceOver 时保持显示。全屏按钮切换显示方式，不重新打开媒体；画中画活动期间不可切换全屏。

接受 `controller`、`title`、可选 `queue`、`language: "en" | "zh"`、`onError`、`autoHideDelay`（秒，`0` 关闭自动隐藏）、`showFullscreenButton` 和 `onFullscreenChange`。`topTrailing`、`bottomTrailing` 可插入自己的视图，也支持画面变换参数和通用视图修饰。`gestures: false` 关闭跳转、音量、亮度、长按和缩放手势，仍可单击显示控制层。在滚动页面中建议设置高度。组件不负责打开/释放控制器或配置音频会话。

```tsx
<VideoPlaybackPlayer
  controller={player}
  title="我的影片"
  autoHideDelay={3}
  frame={{ height: 260 }}
  onError={error => console.log(String(error))}
/>
```

需要完全自定义界面时，显示 `VideoPlaybackView`，通过自己的按钮调用控制器，并订阅 `state`/`progress`；组件卸载时取消订阅。不要对同一控制器同时挂载纯视图和 `VideoPlaybackPlayer`。

## 播放列表与历史

`VideoPlaybackQueue`、`VideoPlaybackQueueItem` 和 `VideoPlaybackHistoryEntry` 可直接全局使用。

```ts
const queue = new VideoPlaybackQueue(player, [
  { id: "episode-1", source: "/path/1.mkv" },
  { id: "episode-2", source: "/path/2.mkv" },
])
queue.importHistory(savedHistory)
await queue.select(0) // 续播有效进度，然后播放
await queue.next()
queue.repeat = "all" // none、all、one
const history = queue.exportHistory() // 用自行选择的存储方式持久化
queue.dispose() // 移除列表监听，player 仍由调用方拥有
await player.dispose()
```

播放列表和历史最多 1000 项，ID 必须唯一。`autoAdvance` 默认为 true。`select(index, { autoplay?, resume? })`、`previous()`、`next()` 和 `replace(items)` 都是异步方法；后续选择/替换会取代之前的操作。自动切集错误通过 `queue.onError` 传递，请提供处理函数。仅在当前时长已知且记录进度未到结尾时尝试续播。历史在脚本保存之前仅保留在内存中，视图和控制器不会自行写入媒体库或历史数据库。


## 持久文件缓存与离线播放

`await VideoPlaybackCache.open({ identifier?, maximumBytes?, maximumEntryBytes? })` 打开当前已保存脚本的私有缓存；临时代码须先保存为脚本。identifier 默认为 `"default"`；总容量默认为 1 GiB，单文件上限默认为 512 MiB 与总容量中的较小值。总容量支持 1 MiB–32 GiB；重新打开同一 identifier 时须使用相同上限。

`prepare(url, { headers? })` 完整下载 HTTP(S) 媒体单文件，已有就绪条目时直接复用；`resolve(url, { headers? })` 仅查找已就绪文件，未命中返回 `null`。URL 和请求头共同标识条目，凭据不同的请求不会混用文件。就绪条目一直保留到删除、清理或容量淘汰，不会检查服务器是否已有更新内容。`prepare`/`resolve` 不接收流清单；HLS 点播可使用下文的 `prepareHLS`/`resolveHLS`。DASH 点播可使用下文的 `prepareDASH`/`resolveDASH`；受保护流许可证的离线下载仍不支持。

```ts
const cache = await VideoPlaybackCache.open({ identifier: "movies" })
const url = "https://example.com/movie.mp4"
const source = await cache.resolve(url) ?? await cache.prepare(url)
await player.open(source, { backend: "auto" })
await source.dispose()
await player.play()
```

播放器打开后会独立保留文件直到停止、销毁或切换来源，因此释放 source 不会中断播放。打开缓存媒体沿用本地文件访问权限；缓存源仅供所属脚本使用，传入 player.open 时不能覆盖请求头。

`getStatus()` 返回已完成/准备中字节数、预留容量、条目数量和上限；`getEntries()` 返回条目 key、大小及 Unix 时间戳。`remove(key)` 对仍被使用的条目返回 `false`；`clear()` 只删除未被保留的完整文件并返回数量。清理前释放不再使用的缓存源对象，活动播放器仍会保护自己的文件。`cancel()` 停止该管理对象的待处理操作；`await dispose()` 还会释放它创建的源对象，保留完整文件和已打开的播放器。

## 下一项预加载

设置 `queue.cache = cache` 后调用 `await queue.preloadNext()`，没有下一项时返回 `false`。预加载完整文件而不改变当前播放；切换条目时优先使用已就绪缓存，否则打开原始来源。仅设置 queue.cache 只会查找缓存，不会自行启动下载。播放列表条目和导出历史的格式保持不变。

```ts
queue.cache = cache
await queue.preloadNext()
await queue.next()
// 页面关闭时清理：
queue.dispose()
await player.dispose()
await cache.dispose()
```

## 调整 HDR 输出

打开原生视频后，可使用 `await player.setToneMapping({ mode: "reinhard", exposureEV: 0, whitePoint: 16 })`，将支持的 PQ、HLG 或重建后的 Profile7 HDR 画面映射到 SDR。`exposureEV` 范围为 -8 到 8；`whitePoint` 范围为 0.25 到 256，以 203 尼特参考白为相对单位，默认分别为 0 和 16。这是全局映射，SDR 画面保持原样。使用 `await player.setToneMapping({ mode: "system" })` 恢复原始输出，不附加其他参数。系统／转封装播放会拒绝此操作。

设置在跳转、暂停后保留，打开其他源时重置。通过 `mediaInfo.toneMappingMode`、`toneMappingApplied`、`toneMappingExposureEV`、`toneMappingWhitePoint` 查看设置及实际应用状态；`hdrOutput` 表示实际输出，轨道色彩信息仍描述原片。截图和当前帧反映映射后的播放画面，独立的 `extractFrame()` 保留原片 HDR。`getCapabilities().nativeToneMapping` 返回可用模式。可选控制菜单为支持的原生 HDR 源提供原始 HDR／SDR 映射选择。这不代表显示器色彩准确性已获认证。

## TrueHD 对象音频输出

对于 Matroska/MKV 源中支持的 48 kHz TrueHD Atmos 对象音轨，使用 `await player.open(source, { backend: "native", audioOutput: "spatial" })`。该模式将对象渲染为 12 声道的 7.1.4 PCM，改变播放输出，不修改原文件，也不直通原始 TrueHD 压缩码流。默认立体声和已有多声道模式保持原样；DTS:X 标准高度输出见下文，动态 DTS:X 对象和 IMAX 呈现不包含在内。

`mediaInfo.objectAudioDecoded` 表示已生成对象渲染后的 PCM；`outputSpatialLayout` 为 `"7.1.4"`，`outputAudioChannels`／`outputAudioSampleRate` 报告实际输出，轨道信息仍描述原片。`getCapabilities().nativeObjectAudioFormats` 和 `nativeSpatialOutputLayouts` 报告实现能力。实际空间播放取决于连接的输出设备；无法确定路由结果时，`spatialAudio` 保持 `null`。请按播放用途配置 `SharedAudioSession`。

跳转、暂停、切换音轨和后台音频设置会保留该模式；切轨应选择另一条支持的对象音轨，不兼容音轨会被拒绝。无对象、数据损坏、不支持的对象控制或容器裁切信息会明确报错。具体设备／输出路由的可用性仍可能不同，输出元数据本身不代表耳机或 Atmos 接收设备已获验收。

## DTS:X 标准高度输出

对支持的 48 kHz DTS:X 标准呈现，使用 `await player.open(source, { backend: "native", audioOutput: "spatial" })`。输出为 12 声道 7.1.4 PCM，包含源中的高度声道及其支持的扬声器位置；不直通 DTS 压缩码流，也不渲染动态对象或 IMAX 呈现。默认立体声和多声道行为保持原样。

实际解码的高度进入 PCM 输出后，`mediaInfo.heightAudioDecoded` 才变为 `true`。此声道呈现的 `objectAudioDecoded` 保持 `false`，`outputSpatialLayout` 为 `"7.1.4"`；无法确定路由结果时，`spatialAudio` 为 `null`。实现可用时，`getCapabilities().nativeHeightAudioFormats` 包含 `"dtsXStandard"`。这些值不代表外接功放或耳机已经验收。

打开或跳转后，解码器保留正常的前 512 样本滤波预热，保留初始 PCM 和时间；预热期间的高度不计为实际高度输出。源在没有产生真实高度时结束，会明确拒绝。扩展缺失或损坏、不支持的布局、IMAX 和不连续时间戳会报错，不会静默切成仅床通道输出。暂停、跳转、切换支持的音轨、画中画和后台音频偏好会保留所选输出模式。

## HLS 点播离线文件

`prepareHLS(url, { headers?, maximumBitRate? })` 将完整、未加密且自包含的 HLS 点播保存为本地媒体文件。支持 MPEG-TS 分片，或使用一个初始化段的 fragmented MP4；清单必须有限且包含 `ENDLIST`。主清单会选择不超过 `maximumBitRate`（比特/秒）的最高可支持自包含变体；省略则选最高档。该选项要求输入主清单，用于选择变体，不是下载限速。

```ts
const cache = await VideoPlaybackCache.open({ identifier: "offline" })
const options = { maximumBitRate: 4_000_000 }
const preparing = cache.prepareHLS("https://example.com/master.m3u8", options)
// 准备期间，可按界面需要轮询 cache.getStatus()。
const source = await preparing
await player.open(source)
await source.dispose() // 播放器保留自己的文件租约
// 重启后（包括断网时）查询：
const saved = await cache.resolveHLS("https://example.com/master.m3u8", options)
if (saved) { await player.open(saved); await saved.dispose() }
```

`resolveHLS` 不发起下载，URL、请求头和码率选项需与准备时一致。`getStatus()` 提供 `hlsPreparing`、`downloadedSegments`、`totalSegments` 及原有 `pendingBytes`。解析清单时段数为零，准备结束后归零；进度汇总当前准备任务，完成以 `prepareHLS` 的 Promise 成功为准。

取消、释放、容量限制、使用中文件保护和清理沿用原缓存 API。整个准备过程最长30分钟；仅就绪文件可离线打开，不暴露半文件。调用方请求头仅发往同源资源，跨源重定向时移除；索引不保存原URL或请求头。

首包支持一层主清单、最多256变体、10000媒体段、每清单1MiB、解析后资源地址总长8MiB及声明总时长24小时。分离音视频/字幕rendition、加密/DRM、直播、byterange、不连续时间轴、变更初始化段及未知清单扩展会明确拒绝。内容不转码，保存文件必须通过实际媒体容器探测。播放列表自动预加载仍只处理完整HTTP媒体文件。`getCapabilities().persistentHLSCache` 报告实现可用性，不保证后台下载连续运行。


## 静态 DASH 离线缓存

`prepareDASH(url, { headers?, maximumBitRate? })` 将完整、未加密且只有一个 Period 的静态 DASH 点播保存为本地 MP4。视频选择不超过 `maximumBitRate`（比特/秒）的最高可支持表示；声明了音轨时同时选择最高可支持音频表示。省略码率限制则选最高可支持视频档位。保留音频，内容不转码。

```ts
const cache = await VideoPlaybackCache.open({
  identifier: "offline-dash",
  maximumBytes: 1024 * 1024 * 1024,
  maximumEntryBytes: 512 * 1024 * 1024,
})
const options = { maximumBitRate: 4_000_000 }
const saved = await cache.prepareDASH("https://example.com/media.mpd", options)
await player.open(saved, { backend: "native" })
await saved.dispose() // 播放器持有独立租约，直到停止或释放
// 之后可离线查找：
const hit = await cache.resolveDASH("https://example.com/media.mpd", options)
if (hit) { await player.open(hit); await hit.dispose() }
```

`resolveDASH` 不下载，URL、请求头和码率选项需与准备时相同。`getStatus().dashPreparing` 为正在准备的 DASH 数；`downloadedSegments`/`totalSegments` 汇总 HLS 与 DASH 媒体段，不含初始化文件。`pendingBytes` 包含暂存输入及输出。段数完成时 MP4 仍可能在准备，应以准备 Promise 成功为准。

准备阶段为下载轨道和最终文件临时预留 **2 倍 `maximumEntryBytes`**。输入轨道总大小与最终 MP4 各自不得超过单条上限，容量不足会拒绝请求。完成后沿用原有缓存容量、淘汰、重启命中及活动租约保护。取消/失败不发布可播放的半成品。本 API 不提供中断续传，也不保证 App 挂起时继续下载。

首包支持独立 fMP4 轨道中的 H.264/HEVC 视频及可选 AAC/AC3/EAC3 音频，一个视频和最多一个音频 AdaptationSet，Period 从零开始且不超过24小时；支持 SegmentTemplate 的 Number/Time、固定 duration 或有限且从零连续的 SegmentTimeline 重复、BaseURL 和模板继承。清单最多1MiB、256表示、总计10000媒体段及解析后资源地址8MiB。直播、加密/DRM、多Period、多个同类型AdaptationSet、字幕、多路复用轨道、SegmentList/SegmentBase、负重复、presentation offset及未知扩展会明确拒绝。`getCapabilities().persistentDASHCache` 报告实现可用性。队列自动预加载仍仅接受完整 HTTP 媒体文件。


## danmu_api 弹幕服务

可配置自己的 [danmu_api](https://github.com/huangxd-/danmu_api) 兼容服务。`baseURL` 是部署根地址，包含需要保留的部署路径或 token 前缀；客户端追加 `/api/v2/…`。可选请求头仅用于该服务，跨域或变更协议的重定向会拒绝。不内置公共服务地址。

```ts
const service = { baseURL: "https://example.com/your-prefix" }
const matches = await DanmuAPI.match(service, "示例.S01E01.mkv")
if (matches.length) {
  const details = await DanmuAPI.getBangumi(service, matches[0].animeId)
  // 先打开对应影片，再加载弹幕：
  await player.open("/path/to/movie.mkv")
  const report = await player.loadDanmakuFromAPI(service, { episodeId: matches[0].episodeId })
}
```

`DanmuAPI.search(service, keyword)` 搜索作品；`match(service, fileName)` 按文件名匹配；`searchEpisodes(service, { anime, episode? })` 搜索剧集；`getBangumi(service, animeId)` 返回作品详情和可用剧集。返回的 ID 统一为字符串，ID 输入也接受正的安全整数。没有搜索/匹配结果时返回空数组，服务或 HTTP 失败以稳定错误码拒绝。

`player.loadDanmakuFromAPI(service, { episodeId }, { segmented? })` 也可用 `{ url: videoPageURL }` 代替剧集 ID。默认获取完整一集；`segmented: true` 将服务返回的分片描述发送回同一服务，顺序获取有界分片，全部完成后再显示。`DanmuAPI.getComments` 参数相同，返回转换后的 `comments` 数组及报告，便于手动过滤或调用 `player.loadDanmaku(batch.comments)`。

报告包括 `loaded`、`skipped`、`unsupportedModes`、`segments` 和 `videoDuration`（服务返回的正时长，否则 `null`）。时长仅供参考，不修改播放器的媒体时长。支持服务常用四字段属性及标准八/九字段属性，转换为滚动、反向、顶部、底部弹幕；可执行/高级脚本等不支持模式跳过并计数，不执行脚本。重叠分片中的相同弹幕会去重，不渲染额外渐变、点赞或来源专用扩展。

加载为原子操作：响应失败保留已有弹幕；后发加载/注入、清空、停止、切换源或释放控制器会使旧服务加载失效。完成后播放、暂停、跳转、样式、过滤和纯文本替代复用现有弹幕时间轴。不持续后台追取分片，不自动重试。

限制为同时两项服务操作、每项120秒、目录响应1MiB、弹幕响应累计8MiB、256分片及50000条输入弹幕；元数据与单条弹幕也有上限。超量或畸形结果会拒绝。本功能适配服务接口，实例可用性及各采集源覆盖由配置的服务决定。
