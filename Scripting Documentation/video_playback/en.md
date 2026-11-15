`VideoPlaybackController` plays local files and HTTP(S) media in main App scripts on iOS/iPadOS 17+. Use `VideoPlaybackPlayer` for video with built-in controls, or `VideoPlaybackView` for video with your own controls. Keep the controller alive while its view is mounted, then await `dispose()` when finished.

## Open and control

```tsx
import { VideoPlaybackPlayer, VideoPlaybackView } from "scripting"

const player = new VideoPlaybackController()
await SharedAudioSession.setCategory("playback", ["mixWithOthers"])
await SharedAudioSession.setActive(true)
await player.open("/path/movie.mkv")
await player.play()
// Render inside your component:
// <VideoPlaybackPlayer controller={player} title="My movie" />
```

`open(source, { backend?, decoder?, headers?, audioOutput? })` prepares without automatically playing. Sources are local paths, `file:` URLs or HTTP(S) URLs. File access follows the script's file permissions. Request headers are bounded and must not contain control characters.

- `backend: "auto"` uses native playback for ordinary media, system playback for HLS without custom headers, and a system/remux path for supported HDR sources. Declared Profile7 dual-layer sources use native reconstruction. DASH and custom-header requests use the native path. Inspect `mediaInfo.backend` to see the selected path.
- `backend: "native"` requests native decode/output; `decoder` accepts `"auto"`, `"hardware"`, or `"software"`. Hardware requests fail if unavailable. Native playback pauses in the background unless active Picture in Picture or the background-audio preference permits it.
- `backend: "system"` requests system playback. `backend: "remux"` preserves H.264/HEVC video in a bounded local HLS window. Compatible AAC/AC3/EAC3/ALAC and up to 24-bit FLAC remain compressed; other supported audio, including TrueHD/DTS, is converted to 48 kHz stereo AAC. Remux supports source-time seeks by rebuilding the corresponding window. System/remux require `decoder: "auto"`. Custom headers are supported by native/remux; explicit system playback rejects headers.

Use `play()`, `pause()`, `seek(seconds)`, `stop()` and `dispose()`. `stop()` permits opening another source; `dispose()` is terminal. To replay ended native media, seek to zero before playing. `playbackRate` accepts 0.25–4; `volume` accepts 0–1; `muted` is independent. Configure your script's shared audio session according to its audio policy.

`play()` requests playback; it can enter `buffering` while preparing enough media. Observe `state` or its events to determine when playback has actually started.

`state`, `position`, `duration` and `mediaInfo` are readable properties. Duration can be `null`. Subscribe with `on("state" | "progress" | "ready" | "ended" | "seeked" | "tracks" | "error" | "overlayError" | "interaction", callback)`; each subscription returns an unsubscribe function. Progress is periodic, not a per-frame callback. Await async operations and handle errors. Superseded opens/seeks and operations after disposal reject. A system seek that cannot complete rejects instead of staying pending; handle the error before retrying.

## Formats and output

The native path includes MP4/MKV/MOV/WebM demuxing, H.264/HEVC/AV1/VP9 video, and AAC/AC3/EAC3/TrueHD/DTS/FLAC/ALAC/Opus/Vorbis/MP3 audio, subject to supported stream configuration and resource limits. HTTP(S), HLS and DASH are separate source paths. Format names alone do not guarantee every profile, damaged file, DRM stream or output route is playable.

`mediaInfo.audioTranscoded` identifies compatibility conversion; `preservesCompressedAudio`, `outputAudioCodec`, `outputAudioChannels` and `outputAudioSampleRate` describe the output separately from the original track information. Converted AAC is lossy stereo and does not preserve Atmos/DTS:X objects.

Native audio defaults to stereo PCM. Set `audioOutput: "multichannel"` for native output to preserve supported layouts up to eight channels; unknown/unsupported layouts fail explicitly. System/remux requests reject this option. Default stereo/multichannel decoding of a source labeled Atmos or DTS:X does not preserve object-based output. For supported TrueHD Atmos objects, use the explicit spatial mode below. Explicit native playback supports 10-bit BT.2020 PQ/HLG and forwards supported HDR10+ per-frame metadata to the system renderer for display adaptation; automatic selection keeps its system/remux policy for ordinary HDR and single-layer Dolby Vision. System HDR10/HLG/Dolby behavior depends on the source, OS, display and audio route. The remux path accepts single-layer Dolby Vision profiles 5/8 where the system can play them. Supported Profile7 MEL/FEL sources use native reconstruction with combined or separate base/enhancement tracks, including in-band enhancement configuration. Automatic selection also uses this path. Explicit system/remux requests for dual-layer files are rejected; missing or mismatched layers fail explicitly. TrueHD Atmos passthrough and profile conversion are not provided. Actual HDR10+ rendering depends on the OS and output route; forwarded metadata alone does not certify the display. `getCapabilities()` reports implementation boundaries; it cannot certify the connected display/receiver.

For reconstructed Profile7, `mediaInfo.dolbyVisionReconstructed` confirms layer composition, `dolbyVisionLayers` identifies `combined`/`separate` input, and `dolbyVisionEnhancement` reports `mel`/`fel`. Output is `hdrOutput: "linearBT2020"`; it preserves floating-point HDR pictures rather than the original Dolby bitstream. `getCapabilities().native.dualLayerDolbyAvailable` reports component availability. The supported input uses 10-bit HEVC layers, 12-bit VDR and standard single-partition mappings; unsupported configurations fail instead of displaying only the base layer. Use `decoder: "software"` for HEVC variants the device cannot decode in hardware.

`MediaProbe.inspect(source)` reads tracks, codecs, resolution, frame rate, bitrate, bit depth when known, chapters and metadata without starting playback. Dolby configuration and spatial-format labels describe the source, not verified output. System playback also exposes available track format details, common metadata and chapters. Details the system does not expose remain absent; ambiguous alternative audio options are not assigned another track’s channel information. Probe IDs are local to that inspection. To select playback tracks, use IDs from that controller's `getTracks()`; IDs expire after opening another source.

## Tracks and subtitles

Use `selectAudioTrack(id)` and `selectSubtitleTrack(id | null)`. Native/remux subtitles use a separate bounded reader; backward seeks may require rescanning sparse sources and can fail on resource/time limits. System track selection follows the source's available media-selection groups.

```ts
await player.loadSubtitles(srtText, "srt") // srt, vtt, ass, ssa
player.subtitleDelay = 0.4 // positive values display cues later
player.setSubtitleStyle({ fontSize: 28, color: "#FFFF00", position: "bottom" })
player.subtitlesEnabled = true
await player.loadSubtitleFile("/path/captions.sup")
await player.loadSubtitleFile("/path/captions.idx") // keep the sibling .sub beside it
player.clearSubtitles()
```

SRT displays plain text, removing basic markup. Text and local-file WebVTT support STYLE `::cue` and `::cue(.class)` with color/background-color, local font-family, px/em/percent font-size, normal/bold font-weight, normal/italic font-style and none/underline text-decoration. Cue line/position/size/align/vertical settings and REGION width/lines/anchors are supported; scrolling regions update without animation. Inline b/i/u/c/v/lang tags are supported. Other CSS, selectors and markup reject explicitly. Embedded WebVTT in Matroska and MP4 (`wvtt`, including fragmented MP4) also preserves these cue settings, inline styles and header styles when present in the source. MP4 supports multiple cues per sample and empty samples that clear subtitles. Unsupported embedded packet layouts or styling return an error; MP4 cue-time extensions (`ctim`) are not supported. ASS/SSA preserve authored styles by default; explicit font/color/position changes apply to ordinary dialogue while positioned signs retain source layout. `assFontScale` accepts 0.5–3. Bitmap subtitles retain their authored pixels. Use UTF-8 for external text subtitle files. Local subtitle files support SRT/VTT/ASS/SSA, PGS `.sup` and VobSub `.idx`/`.sub`. Import both VobSub files together. Loading external subtitles disables the selected embedded subtitle; opening/stopping a source clears overlays.

Text subtitles allow 8 MiB/50000 cues; ASS allows 2 MiB/10000 events and at most 32 simultaneous events. Text lookup displays at most 128 active cues. Rendering has pixel, cache and composition budgets; streamed reads also have deadlines. Bitmap subtitles have no automatically generated spoken text. Physical VoiceOver usability must be checked in your finished UI.

## Danmaku

```ts
await player.loadDanmaku([{ id: "one", time: 2, text: "Hello", mode: "scroll", color: "#FFFFFF", fontSize: 24 }])
await player.injectDanmaku([{ time: player.position + 1, text: "New comment", mode: "top" }])
player.setDanmakuStyle({ speed: 1, area: 0.5, blockedWords: ["spoiler"], blockedAuthors: ["blocked-id"] })
player.danmakuOpacity = 0.8
player.danmakuEnabled = false
```

Modes are `scroll` (right to left), `reverse` (left to right), `top`, `bottom` and `animated`. Time, pause, seek and rate follow media playback. Speed accepts 0.4–2; area accepts 0.1–1; opacity accepts 0–1. Load at most 50000 comments/8 MiB, inject at most 1024 per call, and use at most 512 characters per comment. Crowded lanes or oversized text can be omitted to keep rendering bounded. Filtering uses plain case-insensitive substring matching and author IDs. Authored keyframe animation uses the structure below; third-party script animation is unsupported. Reduce Motion suppresses scrolling and animated comments. `getActiveDanmaku()` provides up to 64 active unblocked texts for an accessible alternative; moving comments do not continuously announce themselves.

Import a local UTF-8 file or a text document:

```ts
const report = await player.loadDanmakuFile("/comments.xml")
await player.loadDanmakuText(JSON.stringify([{ time: 1, text: "Hello", mode: "reverse" }]), "json")
console.log(report.format, report.loaded, report.skipped, report.unsupportedModes)
```

JSON uses the same comment array as `loadDanmaku`. XML accepts Bilibili-compatible `i/d` documents and dandanplay `ArrayOfVisualDmItem` documents. Bilibili modes 1/4/5/6 map to scroll/bottom/top/reverse. Advanced, script and other unknown XML modes are skipped and reported; their payloads are never executed. Files must be regular UTF-8 `.json` or `.xml` files up to 8 MiB; pass the optional `format` to read another extension. Malformed documents reject without replacing current comments. A later load, injection, clear or media source change supersedes an earlier import.


For authored motion, use `animated` with normalized text-center coordinates:

```ts
await player.injectDanmaku([{ time: 3, text: "Hello", mode: "animated", animation: [
  { at: 0, x: 0.2, y: 0.3, opacity: 0 },
  { at: 2, x: 0.8, y: 0.6, opacity: 1, rotation: 90, scale: 1.5 },
] }])
```

Use 2–32 keyframes with strictly increasing `at` values. Start at 0 and end at 0.1–20 seconds relative to the comment. `x`/`y` range from 0 to 1, opacity from 0 to 1, rotation from -3600 to 3600 degrees, and scale from 0.25 to 4. Appearance defaults to opacity 1, rotation 0 and scale 1. Values interpolate linearly with media time; ordinary danmaku speed does not stretch the animation. Animated text uses authored positioning and can overlap other comments. A document may contain at most 100000 keyframes within its 8 MiB budget. Supply `animation` only with `animated`; malformed animation rejects atomically. The same structure is accepted in JSON imports, while Bilibili mode 7 and script modes remain skipped and reported.


## Background audio

```ts
await SharedAudioSession.setCategory("playback", ["mixWithOthers"])
await SharedAudioSession.setActive(true)
player.backgroundAudioEnabled = true
player.on("backgroundAudio", value => console.log(value.videoSuspended))
player.on("backgroundAudioError", value => console.log(value.message))
```

The preference defaults to `false`; your script owns the shared audio-session configuration. For native media with a selected audio track, enabling it switches to audio-only decoding when the App becomes inactive and restores video at the current media time on return. Pause, rate and source-time seeks retain their normal meaning. `mediaInfo.videoSuspended` and native playback snapshots report the current mode; it does not mean sound is currently audible. Screenshots/current-frame reads may be unavailable while video is suspended.

Active Picture in Picture takes priority and keeps video running. Closing its window can continue as background audio when this preference is enabled. Opening another native source in the background requires this preference and an audio track; preparation interrupted while switching to the background can reject and be retried. System/remux playback requests the system’s best effort to continue, and restores its automatic policy when disabled. Device, audio-session and OS restrictions still apply. Disabling the preference in the background pauses playback when there is no active Picture in Picture window. The optional control menu also exposes the preference. The background preference retains the selected audio output mode. Default stereo and multichannel output do not preserve Atmos/DTS:X objects; see the explicit object mode below.

## Picture in Picture

Open video and keep its `VideoPlaybackView` mounted. Check `player.getPictureInPictureState()` for actual `supported`, `possible` and `active` values. The optional control menu includes Picture in Picture when the platform supports it.

```ts
const off = player.on("pictureInPicture", state => console.log(state.active))
if (player.getPictureInPictureState().possible) await player.startPictureInPicture()
player.stopPictureInPicture()
off()
```

Starting resolves when the system activates its window, and rejects if unavailable, cancelled, timed out or replaced. There is no automatic start. Native, system and remux video reuse their playback output. Native playback may continue in the background while Picture in Picture is active; it pauses on entering the background without an active window. For audio without a floating window, use the background-audio preference below. The floating window shows video without the custom subtitle, danmaku or control overlays. Handle `pictureInPictureRestoreRequested` by returning to the page containing the video view; restore success depends on that view being mounted. `pictureInPictureError` reports a message. Replacing media, stopping or disposing the controller closes its window. Availability varies by device and current playback state.

## Images and raw frames

`await snapshot()` returns the video image without overlays/controls. System sources can reject unavailable/protected images. `await extractFrame(seconds)` independently decodes the first frame covering or following that time; the returned frame reports its actual presentation time. Native PQ/HLG extraction preserves supported 10-bit pixels and color metadata. Supported Profile7 extraction returns reconstructed HDR pictures. Other unsupported Dolby configurations and protected images can still reject.

`copyCurrentFrame()` returns a current native/system/remux frame, or `null` while a frame is unavailable. Native displayed-frame readback requires iOS/iPadOS 17.4+ and paused playback; call `pause()` before reading it. Its exact presentation time is `null` when the renderer cannot report it; remux times refer to the original source. A `VideoFrame` exposes dimensions, pixel format, planes, `copyPlane(index)` and `toImage()`. Use `toImage({ dynamicRange: "hdr" })` to preserve highlight values in a half-float extended-linear BT.2020 image; ordinary calls keep the existing image conversion. Subsequent image encoding controls whether that range is retained. Plane copies support BGRA/ARGB/RGBA/ABGR, RGBA-half, NV12 and P010, retain row stride and zero-fill padding. Software output selects its layout by picture size and precision: UHD-sized 8-bit SDR can use NV12, and supported 10-bit SDR uses P010 to retain its precision; smaller 8-bit pictures keep the existing BGRA path. Read `pixelFormat`, `planeCount` and `bytesPerRow` before interpreting plane data. Other native formats can reject plane copying. Always call `frame.dispose()` promptly: each controller permits only two live frames and a 64 MiB frame budget, with one image/extraction operation at a time. Controller disposal invalidates its frames.

`pixelFormat` uses FourCC values: `420v`/`420f` mean video/full-range NV12; `x420`/`xf20` mean video/full-range P010. Both have a Y plane followed by interleaved CbCr. P010 stores each sample in a little-endian unsigned 16-bit value with its 10 valid bits in the high bits (shift right by 6 to read the sample).

## Player and custom views

`VideoPlaybackView` has no built-in control bar. Mount one surface per controller. `videoGravity` accepts `resizeAspect`, `resizeAspectFill` or `resize`; `rotation`, `mirrored` and `zoom` (1–8) affect the video. Subtitles/danmaku remain upright in the viewport.

Opt in with `gestures: true`: single tap toggles playback; double tap seeks ±10 seconds according to the horizontal half; horizontal pan seeks; vertical pan adjusts player volume on the right and temporary screen brightness on the left; long press temporarily uses 2×; pinch zooms. Temporary brightness/rate are restored when the surface detaches if they have not been changed elsewhere. Screen-brightness behavior depends on the device. Equivalent play/pause/seek accessibility actions are exposed. Provide visible controls as well; test touch, focus and VoiceOver on your target devices.

`VideoPlaybackPlayer` combines video and an overlay with play/pause, skip, a continuous seek bar, time, speed, subtitles, audio tracks, chapters, danmaku, volume, background audio and Picture in Picture where available. Tap the picture to show or hide controls. Controls hide after three seconds of playback and remain visible while paused, loading, buffering or using VoiceOver. On iPhone and iPad, the full-screen button requests landscape for the current window and restores its previous orientation on exit. Drag the seek bar and release to jump to the selected position. Full-screen changes are unavailable while Picture in Picture is active.

It accepts `controller`, `title`, optional `queue`, `language: "en" | "zh"`, `onError`, `autoHideDelay` (seconds; `0` disables hiding), `showFullscreenButton`, and `onFullscreenChange`. `topTrailing` and `bottomTrailing` accept additional views. The video transform options and ordinary view modifiers are also supported. `gestures: false` disables seek/volume/brightness/long-press/pinch gestures while keeping tap-to-show controls. Set a frame when embedding it in a scrolling page. The component does not open/dispose the controller or configure the audio session.

```tsx
<VideoPlaybackPlayer
  controller={player}
  title="My movie"
  autoHideDelay={3}
  frame={{ height: 260 }}
  onError={error => console.log(String(error))}
/>
```

For a completely custom interface, render `VideoPlaybackView`, call the controller methods from your buttons, and subscribe to `state`/`progress`. Unsubscribe when the component unmounts. Do not mount the pure view alongside `VideoPlaybackPlayer` with the same controller.

## Playlist and history

`VideoPlaybackQueue`, `VideoPlaybackQueueItem` and `VideoPlaybackHistoryEntry` are available globally.

```ts
const queue = new VideoPlaybackQueue(player, [
  { id: "episode-1", source: "/path/1.mkv" },
  { id: "episode-2", source: "/path/2.mkv" },
])
queue.importHistory(savedHistory)
await queue.select(0) // resume when valid, then play
await queue.next()
queue.repeat = "all" // none, all, one
const history = queue.exportHistory() // persist with your chosen storage
queue.dispose() // removes queue listeners; caller still owns player
await player.dispose()
```

Playlists/history support 1000 items with unique IDs. `autoAdvance` defaults to true. `select(index, { autoplay?, resume? })`, `previous()`, `next()` and `replace(items)` are async. A later selection/replacement supersedes an earlier one. Queue errors from automatic advancement are delivered through `queue.onError`; provide a handler. Resume is attempted only for a known duration and a saved point before the end. History stays in memory until your script saves it. Neither the view nor controller silently writes a library/history database.


## Persistent files and offline playback

`await VideoPlaybackCache.open({ identifier?, maximumBytes?, maximumEntryBytes? })` opens a private cache for the current saved script. Save temporary scripts before using persistent caching. The identifier defaults to `"default"`. Capacity defaults to 1 GiB and the single-file limit to the smaller of 512 MiB and that capacity. Total capacity supports 1 MiB–32 GiB. Reopening the same identifier requires the same limits.

`prepare(url, { headers? })` downloads a complete HTTP(S) media file or reuses its ready entry. `resolve(url, { headers? })` only looks up a ready file and returns `null` on a miss. URL and headers identify the entry; changed credentials do not reuse another request's file. Ready entries remain until removed, cleared or evicted; these methods do not check whether the server has newer content. `prepare`/`resolve` do not accept streaming manifests. Use `prepareHLS`/`resolveHLS` or `prepareDASH`/`resolveDASH` below for supported HLS/DASH VOD. Protected stream licenses are not downloaded.

```ts
const cache = await VideoPlaybackCache.open({ identifier: "movies" })
const url = "https://example.com/movie.mp4"
const source = await cache.resolve(url) ?? await cache.prepare(url)
await player.open(source, { backend: "auto" })
await source.dispose()
await player.play()
```

An opened player keeps its own hold on the file until stop, disposal or source replacement, so releasing `source` does not interrupt playback. Opening cached media follows normal local file permissions. Cached sources belong to their script and reject header overrides when passed to `player.open`.

`getStatus()` reports completed and pending bytes, reserved capacity, entry counts and limits. `getEntries()` lists keys, sizes and Unix timestamps. `remove(key)` returns `false` for a protected entry. `clear()` removes unheld complete files and returns their count. Release unused source handles before clearing; active players keep their files. `cancel()` stops this manager's pending operations. `await dispose()` also releases its source handles while preserving ready files and opened players.

## Preloading the next item

Set `queue.cache = cache`, then call `await queue.preloadNext()`. It returns `false` when no next item exists. Preloading prepares the full file without changing playback. Selection uses a ready cached item when available and otherwise opens the original source. Merely setting `queue.cache` performs lookups without starting downloads. Playlist items and exported history keep their original format.

```ts
queue.cache = cache
await queue.preloadNext()
await queue.next()
// Page cleanup:
queue.dispose()
await player.dispose()
await cache.dispose()
```

## Adjust HDR output

For an open native video, use `await player.setToneMapping({ mode: "reinhard", exposureEV: 0, whitePoint: 16 })` to map supported PQ, HLG or reconstructed Profile7 HDR pictures to SDR. `exposureEV` ranges from -8 to 8; `whitePoint` ranges from 0.25 to 256, relative to a 203-nit reference white. Defaults are 0 and 16. This is a global mapping; SDR pictures remain unchanged. Use `await player.setToneMapping({ mode: "system" })` to restore the original output, with no extra parameters. System/remux playback rejects this operation.

Settings persist across seeking and pause, and reset when another source opens. Read `mediaInfo.toneMappingMode`, `toneMappingApplied`, `toneMappingExposureEV` and `toneMappingWhitePoint`; `hdrOutput` describes the actual output while track color information still describes the source. Snapshots and current frames reflect mapped playback. Independent `extractFrame()` keeps the original HDR pictures. `getCapabilities().nativeToneMapping` reports available modes. Optional controls offer original HDR / SDR mapping for supported native HDR sources. This does not certify the display’s color accuracy.

## TrueHD object audio output

Use `await player.open(source, { backend: "native", audioOutput: "spatial" })` for supported 48 kHz TrueHD Atmos object tracks in Matroska/MKV sources. This renders the objects into a 12-channel 7.1.4 PCM bed. It changes the playback output; it does not change the source file or pass through the original compressed TrueHD bitstream. Default stereo output and the existing multichannel mode remain unchanged. DTS:X standard height output is described below; dynamic DTS:X objects and IMAX presentations are not provided.

`mediaInfo.objectAudioDecoded` confirms object-derived PCM; `outputSpatialLayout` is `"7.1.4"`, and `outputAudioChannels` / `outputAudioSampleRate` report the actual output. Tracks continue to describe the source. `getCapabilities().nativeObjectAudioFormats` and `nativeSpatialOutputLayouts` report available implementation support. The connected route controls actual spatial playback; `spatialAudio` remains `null` when that route result is unknown. Configure `SharedAudioSession` for your playback use.

Seek, pause, track selection and background-audio preferences retain the selected mode. Select another supported object track when changing audio; incompatible tracks reject. Sources without objects, damaged data, unsupported object controls or container trimming reject explicitly. Availability on a particular device/output route can still vary; output metadata alone does not certify headphones or an Atmos receiver.

## DTS:X standard height output

Use `await player.open(source, { backend: "native", audioOutput: "spatial" })` for supported 48 kHz DTS:X standard presentations. Output is 12-channel 7.1.4 PCM with the source height channels and their supported speaker positions; it is not compressed DTS passthrough or dynamic-object/IMAX rendering. Default stereo and multichannel behavior remains unchanged.

`mediaInfo.heightAudioDecoded` becomes `true` after actual decoded heights reach PCM output. `objectAudioDecoded` remains `false` for this channel presentation, `outputSpatialLayout` is `"7.1.4"`, and `spatialAudio` remains `null` when the route result is unknown. `getCapabilities().nativeHeightAudioFormats` lists `"dtsXStandard"` when the implementation is available. These values do not certify an external receiver or headphones.

The decoder retains its normal initial 512-sample filter warmup after opening or seeking. This preserves the initial PCM and time; those warmup heights do not count as actual decoded height output. A source that ends without real height output rejects. Missing/corrupt extensions, unsupported layouts, IMAX and discontinuous timestamps reject rather than silently switching to a bed-only path. Pause, seek, supported audio-track changes, Picture in Picture and the background-audio preference retain the chosen output mode.

## HLS VOD offline files

`prepareHLS(url, { headers?, maximumBitRate? })` saves a complete, unencrypted, self-contained HLS VOD as a local media file. It accepts MPEG-TS segments or fragmented MP4 with one initialization segment, and requires a finite playlist with `ENDLIST`. For a master playlist, it selects the highest supported self-contained variant within `maximumBitRate` (bits per second), or the highest when omitted. `maximumBitRate` requires a master playlist; it is a variant-selection limit, not a network speed limit.

```ts
const cache = await VideoPlaybackCache.open({ identifier: "offline" })
const options = { maximumBitRate: 4_000_000 }
const preparing = cache.prepareHLS("https://example.com/master.m3u8", options)
// While preparing, poll cache.getStatus() from your UI as needed.
const source = await preparing
await player.open(source)
await source.dispose() // the player keeps its own file lease
// After a restart, including without a network connection:
const saved = await cache.resolveHLS("https://example.com/master.m3u8", options)
if (saved) { await player.open(saved); await saved.dispose() }
```

`resolveHLS` never downloads; URL, headers and bitrate option must match the original preparation. `getStatus()` reports `hlsPreparing`, `downloadedSegments`, `totalSegments` and the existing `pendingBytes`. Segment totals remain zero while resolving the playlist and reset when a preparation finishes. Progress aggregates active preparations; completion is the resolution of `prepareHLS`.

`cancel`, `dispose`, capacity limits, active-file protection and cleanup follow the existing cache API. Preparation has a 30-minute resource deadline. Ready files can play offline; partially downloaded files are not exposed. Caller headers are carried only to same-origin resources, and are removed on cross-origin redirects. The index stores neither source URLs nor headers.

This first HLS snapshot supports one master level, up to 256 variants, 10000 media segments, 1 MiB per playlist, 8 MiB of resolved resource addresses and 24 hours of declared media. Separate audio/video/subtitle renditions, encryption/DRM, live playlists, byte ranges, discontinuities, changing initialization segments and unsupported playlist extensions reject explicitly. Content is not transcoded, and the saved file must pass media-container inspection. Queue automatic preloading remains limited to complete HTTP media files. `getCapabilities().persistentHLSCache` reports implementation availability; background download continuity is not guaranteed.


## Static DASH offline cache

`prepareDASH(url, { headers?, maximumBitRate? })` saves a complete, unencrypted, single-Period static DASH presentation as a local MP4. It selects the highest supported video representation within `maximumBitRate` (bits/s), plus the highest supported audio representation when audio is declared. Omitting the limit selects the highest supported video rate. Audio is preserved; content is copied without transcoding.

```ts
const cache = await VideoPlaybackCache.open({
  identifier: "offline-dash",
  maximumBytes: 1024 * 1024 * 1024,
  maximumEntryBytes: 512 * 1024 * 1024,
})
const options = { maximumBitRate: 4_000_000 }
const saved = await cache.prepareDASH("https://example.com/media.mpd", options)
await player.open(saved, { backend: "native" })
await saved.dispose() // the player retains its own lease until stop/dispose
// Later, including offline:
const hit = await cache.resolveDASH("https://example.com/media.mpd", options)
if (hit) { await player.open(hit); await hit.dispose() }
```

`resolveDASH` never downloads. The URL, headers and bitrate option must match preparation. `getStatus().dashPreparing` counts running DASH preparations; `downloadedSegments`/`totalSegments` aggregate HLS and DASH media segments, excluding initialization files. `pendingBytes` includes staged input and output. Downloaded segment counts can be complete while MP4 preparation is still running; await the preparation Promise.

Preparation temporarily reserves **twice `maximumEntryBytes`** for the downloaded tracks and final file. Their combined input size and the final MP4 must each fit the single-entry limit; insufficient capacity rejects the request. Completed entries use the same cache capacity, eviction, restart and active-lease protection as other cached media. Cancellation/failure leaves no playable partial entry. This API does not resume an interrupted download or promise continued downloading while the App is suspended.

The initial scope supports H.264/HEVC video with optional AAC/AC3/EAC3 audio in separate fMP4 tracks, one video and at most one audio adaptation set, a zero-start Period up to 24 hours, and `SegmentTemplate` using Number/Time with fixed duration or finite contiguous zero-start `SegmentTimeline` repeats. Base URLs and template inheritance are supported. Manifests are limited to 1 MiB, 256 representations, 10,000 total media segments and 8 MiB of resolved resource addresses. Live streams, encryption/DRM, multiple Periods or same-type adaptation sets, subtitles, multiplexed tracks, SegmentList/SegmentBase, negative repeats, presentation offsets and unsupported extensions are rejected. `getCapabilities().persistentDASHCache` reports implementation availability. Queue automatic preloading continues to accept complete HTTP media files only.


## danmu_api service

Configure your own [danmu_api](https://github.com/huangxd-/danmu_api) compatible service. `baseURL` is the deployment root, including any deployment or token path prefix; the client appends `/api/v2/…`. Optional headers apply only to that service. Cross-origin and protocol-changing redirects are rejected. No public server is built in.

```ts
const service = { baseURL: "https://example.com/your-prefix" }
const matches = await DanmuAPI.match(service, "Example.S01E01.mkv")
if (matches.length) {
  const details = await DanmuAPI.getBangumi(service, matches[0].animeId)
  // Open the corresponding video first, then load its comments:
  await player.open("/path/to/movie.mkv")
  const report = await player.loadDanmakuFromAPI(service, { episodeId: matches[0].episodeId })
}
```

`DanmuAPI.search(service, keyword)` lists matching titles. `match(service, fileName)` requests filename matching, `searchEpisodes(service, { anime, episode? })` searches episodes, and `getBangumi(service, animeId)` returns title details and available episodes. Returned IDs are canonical strings; ID inputs also accept positive safe integers. Empty searches/matches return an empty array. Service and HTTP failures reject with a stable error code.

`player.loadDanmakuFromAPI(service, { episodeId }, { segmented? })` also accepts `{ url: videoPageURL }` instead of the episode ID. Default loading requests the complete episode. With `segmented: true`, segment descriptions are sent back to the same service and all bounded segments are fetched sequentially before comments appear. `DanmuAPI.getComments` takes the same arguments and returns the converted `comments` array with the report, for manual filtering or `player.loadDanmaku(batch.comments)`.

The report contains `loaded`, `skipped`, `unsupportedModes`, `segments`, and `videoDuration` (positive server duration or `null`). Duration is informational and does not change the player's media duration. Four-field service attributes and standard eight/nine-field attributes are converted to scrolling, reverse, top and bottom comments. Unsupported modes, including executable/advanced script formats, are skipped and counted; scripts are never executed. Identical overlapping comments are deduplicated. Extra gradients/likes/source-specific fields are not rendered.

Loading is atomic: a failed response preserves existing comments. A later load/injection, clear, stop, source change or controller disposal invalidates an older service load. Once loaded, normal playback, pause, seek, style, filtering and text alternatives use the existing danmaku timeline. There is no ongoing background segment fetching or automatic retry.

Limits: two active service operations, 120 seconds per operation, 1 MiB per catalog response, 8 MiB cumulative comment responses, 256 segments and 50,000 input comments; metadata and individual comments are also bounded. Oversized or malformed results reject. This supports the service contract; availability and provider coverage depend on the configured instance.
