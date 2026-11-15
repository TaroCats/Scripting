# AirPlay

Added in Scripting 3.2.2. Use `AirPlay`, `AVRouteDetector`, `SharedAudioSession` and `AVPlayer` as globals; import the JSX `AirPlayRoutePicker` from `"scripting"`.

The selection panel, route detector and new session operations require the main App script context. Selection and playback preparation require a foreground, visible script. Widgets, App extensions, remote renderers and background JS threads do not provide these UI capabilities. Existing audio-session methods retain their behavior.

Access denial rejects Promise operations or throws for synchronous controls with `name: "NotAllowedError"` and `code: "ERR_PRO_REQUIRED"`. Closing a panel, disabling detection and disposing resources remain available for cleanup.

## Choose an output

```ts
async function main() {
  await AirPlay.presentRoutePicker({ prioritizesVideoDevices: true })
}

main().catch(console.error)
```

This opens a panel containing Apple's AirPlay button. **Tap the button to open the system destination menu.** The Promise resolves when the panel closes, including cancellation. It does not report the selected device, a successful connection, or successful playback. Unsupported environments, a missing foreground host and another open panel reject with an Error. Invalid options reject with TypeError. `prioritizesVideoDevices` defaults to false. Opening the panel does not configure or activate audio, or start playback.

For an output button directly in a script page, see [AirPlayRoutePicker](../views/airplay_route_picker/en.md).

## Configure the shared audio session

```ts
async function main() {
  await SharedAudioSession.configure({
    category: "playback",
    mode: "moviePlayback",
    routeSharingPolicy: "longFormVideo"
  })
  const policy = await SharedAudioSession.routeSharingPolicy
  console.log(policy)
}

main().catch(console.error)
```

`configure(options): Promise<void>` sets category, mode, policy and category options in one system call. `category` is required. Defaults are `mode: "default"`, `routeSharingPolicy: "default"`, `options: []`. It does not activate the session. Configuration affects every script using the process's shared session; it is not automatically restored when this script exits. Existing `setCategory` and `setMode` remain available. When mixing setters, read the current configuration rather than assuming an earlier policy remains active.

Writable policies: `default`, `longFormAudio`, `longFormVideo`. The read-only policy can additionally be `independent` (managed by the system) or `unknown` for a future system value. Long-form policies require category `playback`, mode `default`, `moviePlayback` or `spokenAudio`, and no category options. Explicit `allowAirPlay` requires `playAndRecord`; `playback` supports AirPlay implicitly. Invalid arguments reject with TypeError; native configuration errors reject with Error. No invalid option is silently discarded.

Before long-form video playback, use this helper with an `AVPlayer` that your script has already created and loaded:

```ts
async function preparePlayerForAirPlay(player: AVPlayer) {
  const preparation = await SharedAudioSession.prepareRouteSelectionForPlayback()
  if (preparation.shouldStartPlayback) {
    await SharedAudioSession.setActive(true)
    player.play()
  }
}
```

Call `preparePlayerForAirPlay(player).catch(console.error)` from your playback setup. Here, `player` is your existing player; keep it alive and dispose it with the rest of your playback resources.

This returns `Promise<{shouldStartPlayback: boolean, routeSelection: "none" | "local" | "external" | "unknown"}>`. The system may ask for a destination when `longFormVideo` is configured; it does not show a menu on every call. A result permits playback to start; it does not prove media reached the receiver. Losing the foreground host rejects a still-live request. A disposed script receives no continuation.

## Observe audio routing

Reuse `await SharedAudioSession.currentRoute` and `addRouteChangeListener` / `removeRouteChangeListener`. An output whose `portType` is `"airPlay"` identifies an AirPlay audio route. This is independent of video external playback and does not prove the receiver is producing sound. See [SharedAudioSession](../shared_audio_session/en.md) for route and listener types.

## AVPlayer external video playback

| Member | Meaning |
| --- | --- |
| `allowsExternalPlayback: boolean` | Allows external video playback; defaults to true. Setting false does not disconnect session audio from AirPlay. |
| `readonly isExternalPlaybackActive: boolean` | Whether this player is in external video playback mode. It is not an audio-route or wireless-only status. |
| `usesExternalPlaybackWhileExternalScreenIsActive: boolean` | Automatically switches to external video playback while an external screen is active. Defaults to false; requires allowsExternalPlayback. |
| `externalPlaybackVideoGravity` | `"resize"`, `"resizeAspect"` (default), or `"resizeAspectFill"`. Applies to external video. |
| `onExternalPlaybackActiveChanged` | A `(active: boolean) => void` callback, or null. Changes only, with no initial callback. |

Set the writable properties before `setSource` if desired; they persist across source replacements. Register the callback and then read the current property for the initial state. `dispose()` clears observers and callbacks, releases playback resources. Call `setSource` before playing again, and reinstall callbacks as needed. External-playback controls run in the main App script context. Boolean controls require actual booleans; unknown gravity values and invalid callbacks throw TypeError.

Use these with `VideoPlayer` or either rendering mode of `AVPlayerView`. Layer mode needs an explicit picker because it has no native playback controls. Format, DRM, authenticated media, request headers, local files and receiver reachability can affect playback; local playback success does not guarantee external playback. Now Playing and remote commands remain available through the existing `MediaPlayer` API.

## Detect additional routes

```ts
const detector = new AVRouteDetector()
detector.onMultipleRoutesDetectedChanged = detected => console.log(detected)
detector.isRouteDetectionEnabled = true
console.log(detector.multipleRoutesDetected)
// When finished:
detector.dispose()
```

Detection defaults to off and consumes additional power. `multipleRoutesDetected` is a read-only boolean indicating an additional playback route; it is not a device list or proof that an AirPlay receiver can connect. False while disabled or awaiting discovery does not prove there are no receivers. Do not hide the picker solely because this property is false.

The callback reports changes only. Disable detection when unnecessary. It stops when the App resigns active, the script minimizes, or the handle/script is disposed; re-enable explicitly after returning. `dispose()` is idempotent and terminal, clears callbacks and stops detection. Retain the detector while needed. Invalid enable values/callbacks throw an Error; enabling outside a foreground App script throws an Error. Pure observation does not request microphone access.

Independent image and script UI presentation on external displays is outside this release's API.

[Independent image and JSX display](../external_display/en.md) uses the system’s screen-mirroring connection.
