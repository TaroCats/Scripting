# AVPlayerView

`AVPlayerView` displays video using a native controller or a video layer. In Scripting 3.2.2, normal pages default to `AVPlayerViewController`, while custom `contextMenu.preview` subtrees default to `AVPlayerLayer`. An explicit `renderingMode` overrides this default.

The PiP, native controls, full-screen and Now Playing configuration described below applies to **controller mode**. The caller owns the AVPlayer in both modes.

## New options in 3.2.2

| Property | Behavior |
| --- | --- |
| `showsPlaybackControls?: boolean` | Shows native controls in controller mode; defaults to true. Ignored in layer mode. Hiding controls still uses the native controller. |
| `renderingMode?: "controller" \| "layer"` | Controller mode supplies native playback UI. Layer mode displays video without native controls, full-screen transitions or Now Playing management. Custom context-menu previews use layer by default; their source view and menu items keep their own mode. |
| `pictureInPictureController?: VideoPictureInPictureController` | Enables explicit JS PiP start/stop in layer mode. Requires explicit `renderingMode="layer"`; other combinations throw. See the [controller API and complete example](../../video_picture_in_picture/en.md). |

In layer mode, `allowsPictureInPicturePlayback`, `canStartPictureInPictureAutomaticallyFromInline`, `updatesNowPlayingInfoCenter`, `entersFullScreenWhenPlaybackBegins` and `exitsFullScreenWhenPlaybackEnds` are ignored. Without an explicit PiP handle, layer mode creates no PiP controller and does not update `pipStatus`; the property is still required. With a handle, lifecycle updates reach `pipStatus`, and failures reach the handle's `onStateChanged`. Neither mode stops/disposes your player or removes your media files when the view disappears.

For a dynamic long-press preview, use the contextual layer default or explicitly choose layer. For a page with system playback controls, use the controller default. For JS-driven PiP, use explicit layer plus a stable PiP handle and keep the source view mounted.

---

## 1. When to Use AVPlayerView

Use `AVPlayerView` when you need:

* System Picture in Picture (PiP) for video
* Native playback controls
* Integration with Now Playing / Control Center / Lock Screen
* Automatic PiP when entering background
* Fine-grained observation of PiP lifecycle

If you do **not** need PiP, `VideoPlayer` remains a lighter alternative.

---

## 2. Core Properties Explained

### 2.1 `player`

```ts
player: AVPlayer
```

* The underlying media player
* Fully managed by the developer
* Supports local files, remote URLs, HLS streams, etc.

`AVPlayerView` **does not own the player lifecycle**.
The player must remain alive while PiP is active.

---

### 2.2 `pipStatus`

```ts
pipStatus: Observable<PIPStatus>
```

Provides real-time updates for the PiP lifecycle.

Possible values:

| Value              | Meaning               |
| ------------------ | --------------------- |
| `willStart`        | PiP is about to start |
| `didStart`         | PiP has started       |
| `willStop`         | PiP is about to stop  |
| `didStop`          | PiP has stopped       |
| `undefined / null` | No PiP activity yet   |

This value is **system-controlled**.
You should **observe it only**, never assign values manually.

---

## 3. Picture in Picture Configuration

### 3.1 `allowsPictureInPicturePlayback`

* Enables or disables PiP entirely
* Default: `true`

When set to `false`:

* PiP controls are hidden
* PiP cannot be activated

---

### 3.2 `canStartPictureInPictureAutomaticallyFromInline`

* If enabled, PiP starts automatically when:

  * The app moves to background
  * Video is playing inline
* Default: `false`

Recommended for:

* Media apps
* Continuous playback experiences

---

### 3.3 `updatesNowPlayingInfoCenter`

* Controls automatic updates to:

  * Lock screen
  * Control Center
  * External playback controls
* Default: `true`

Should generally remain enabled for video playback apps.

---

## 4. Full-Screen Playback Behavior

### 4.1 `entersFullScreenWhenPlaybackBegins`

* Automatically enters full screen on play
* Default: `false`

---

### 4.2 `exitsFullScreenWhenPlaybackEnds`

* Automatically exits full screen on completion
* Default: `false`

---

## 5. Video Scaling (`videoGravity`)

```ts
videoGravity?: AVLayerVideoGravity
```

| Value              | Behavior                                    |
| ------------------ | ------------------------------------------- |
| `resize`           | Stretch to fill (no aspect ratio)           |
| `resizeAspect`     | Preserve aspect ratio, fit inside (default) |
| `resizeAspectFill` | Preserve aspect ratio, fill and crop        |

---

## 6. Complete Demo Example

The following example demonstrates:

* Creating and configuring `AVPlayer`
* Activating audio playback session
* Observing PiP lifecycle
* Controlling playback state
* Proper cleanup

```tsx
import { AVPlayerView, Button, Navigation, NavigationStack, PIPStatus,
  Script, VStack, useEffect, useMemo, useObservable, useRef, useState } from "scripting"

function Example() {
  const player = useMemo(() => new AVPlayer(), [])
  const pipStatus = useObservable<PIPStatus>()
  const alive = useRef(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void (async () => {
      await SharedAudioSession.setCategory("playback", [])
      await SharedAudioSession.setActive(true)
      if (!alive.current) return
      setReady(player.setSource(
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
      ))
    })().catch(error => console.log(error))
    return () => {
      alive.current = false
      player.stop()
      player.dispose()
    }
  }, [])

  return <NavigationStack><VStack>
    <AVPlayerView player={player} pipStatus={pipStatus}
      renderingMode="controller" showsPlaybackControls
      canStartPictureInPictureAutomaticallyFromInline />
    <Button title="Play" action={() => { if (ready) player.play() }} />
    <Button title="Pause" action={() => player.pause()} />
  </VStack></NavigationStack>
}

async function run() {
  try { await Navigation.present({ element: <Example /> }) }
  finally { Script.exit() }
}
run()
```

---

## 7. PiP Lifecycle Notes

Typical PiP state progression:

1. `willStart`
2. `didStart`
2. PiP running
4. `willStop`
5. `didStop`

The system may skip stages in error or interruption scenarios.
Always treat `didStart` and `didStop` as authoritative.

---

## 8. Important Notes and Constraints

### 8.1 AVPlayerView PiP is System-Level PiP

* Uses native video PiP
* Completely separate from Scripting’s custom PiP View Modifiers
* These two mechanisms must not be mixed

---

### 8.2 Audio Session Is Required

For PiP to work reliably:

* An active audio session is required
* Category should be `playback`
* Background audio capability must be enabled

Failing to configure the audio session may cause PiP to fail silently.

---

### 8.3 Do Not Dispose AVPlayer While PiP Is Active

* Disposing or replacing `AVPlayer` during PiP
* Will force PiP to stop unexpectedly
* May result in system errors

Always wait until `pipStatus` reaches `didStop` before releasing the player.

---

## 9. Recommended Best Practices

* Use `AVPlayerView` exclusively for video PiP
* Treat `pipStatus` as read-only state
* Keep `AVPlayer` lifecycle stable during PiP
* Configure audio session explicitly
* Avoid frequent player replacement
* Clean up resources only after PiP has fully stopped


## AirPlay in Scripting 3.2.2

See [AirPlay](../../airplay/en.md) for shared-session route policies, playback preparation, AVPlayer external-video controls, route detection, and both output-picker entry points. Audio routing and external video playback have independent states.
