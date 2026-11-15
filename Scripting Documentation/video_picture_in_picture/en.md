# VideoPictureInPictureController

Added in Scripting 3.2.2. This global class lets JavaScript request system video Picture in Picture (PiP) from a layer-backed `AVPlayerView`. Use it directly, without importing it from `"scripting"`. It is separate from the custom UI PiP view modifiers.

## API

```ts
class VideoPictureInPictureController {
  constructor()
  static isSupported(): boolean
  readonly isPossible: boolean
  readonly isActive: boolean
  readonly isSuspended: boolean
  readonly lastError: string | null
  start(): boolean
  stop(): void
  dispose(): void
  onStateChanged?: ((state: "willStart" | "didStart" | "willStop" | "didStop" | "failedToStart") => void) | null
  onPossibleChanged?: ((possible: boolean) => void) | null
}
```

| Member | Meaning |
| --- | --- |
| `isSupported()` | Whether this device/system supports video PiP. This is a method, not a property. |
| `isPossible` | Whether the bound source view is on screen and the native controller currently allows PiP. Capability support alone does not imply readiness. |
| `isActive` | Whether system PiP is currently active. |
| `isSuspended` | Whether system PiP is currently suspended. |
| `lastError` | Latest rejected-start or asynchronous start error; initially null and cleared when a new start request is submitted. |
| `start()` | Returns true when the request is submitted, or a start is already pending/active while possible. It does not guarantee that PiP has started. Returns false when disposed, unbound, off screen or not possible; no queued retry. Call from a user action. |
| `stop()` | Requests PiP stop; it does not pause the AVPlayer. |
| `dispose()` | Idempotently stops/releases PiP and clears callbacks. The handle cannot be reused; the AVPlayer remains caller-owned. |
| `onPossibleChanged` | Reports current readiness changes; use it to update your UI and check `isPossible` when starting. |
| `onStateChanged` | Reports `willStart`, `didStart`, `willStop`, `didStop`, or `failedToStart`. Read `lastError` on failure. Use `didStart`/`didStop` to confirm transitions. |

## Binding and lifetime

Pass the handle as `pictureInPictureController` with **explicit** `renderingMode="layer"`. Omitting the mode or using `"controller"` with this handle throws, even inside a context-menu preview whose default mode is layer. One handle can bind to only one source view at a time.

Keep the handle stable across renders, and keep the source view mounted and the AVPlayer alive during PiP. Removing the source view stops and unbinds PiP; this API does not keep PiP running after dismissing the page or exiting the script. Configure `SharedAudioSession` for playback explicitly; the SDK does not change the global audio session for you. Layer mode provides no playback controls, automatic PiP, full-screen transitions or Now Playing management. `pipStatus` is still required and receives lifecycle updates when a handle is attached; start failures are reported through `onStateChanged`.

When leaving the page, dispose the PiP handle before stopping/disposing your player. Keep temporary media files until the player is released. Do not delete a user-selected source file.

## Complete example

Choose a local video, wait for readiness, then tap Start PiP. Keep the page open. This example loads one video per run; reopen it to choose another video. In your own app, stop PiP and wait for `didStop` before replacing the video. Actual PiP availability depends on the device and playback state.

```tsx
import { AVPlayerView, Button, Navigation, NavigationStack, Script, Text, VStack,
  useEffect, useObservable, useRef, useState, PIPStatus } from "scripting";

function Demo() {
  const playerRef = useRef<AVPlayer | null>(null);
  const pipRef = useRef<VideoPictureInPictureController | null>(null);
  const alive = useRef(true);
  const hasSource = useRef(false);
  if (!playerRef.current) playerRef.current = new AVPlayer();
  if (!pipRef.current) pipRef.current = new VideoPictureInPictureController();
  const player = playerRef.current;
  const pip = pipRef.current;
  const pipStatus = useObservable<PIPStatus>();
  const [loaded, setLoaded] = useState(false);
  const [possible, setPossible] = useState(false);
  const [message, setMessage] = useState("Choose a local video, then start PiP. Keep this page open.");

  useEffect(() => {
    pip.onPossibleChanged = value => { if (alive.current) setPossible(value); };
    pip.onStateChanged = state => {
      if (alive.current) setMessage(state === "failedToStart" ? (pip.lastError ?? state) : state);
    };
    return () => {
      alive.current = false;
      pip.dispose();
      player.stop();
      player.dispose();
    };
  }, []);

  const chooseVideo = async () => {
    if (hasSource.current) { setMessage("Reopen this example to choose another video."); return; }
    try {
      const paths = await DocumentPicker.pickFiles({ types: ["public.movie"], allowsMultipleSelection: false });
      if (!alive.current || hasSource.current || !paths[0]) return;
      await SharedAudioSession.setCategory("playback", []);
      await SharedAudioSession.setActive(true);
      if (!alive.current || hasSource.current) return;
      if (!player.setSource(paths[0])) { setMessage("Unable to load video"); return; }
      hasSource.current = true;
      setLoaded(true);
      setPossible(pip.isPossible);
      player.play();
      setMessage("Wait until PiP is possible, then tap Start PiP.");
    } catch (error) {
      if (alive.current) setMessage(String(error));
    }
  };

  return <NavigationStack><VStack spacing={16} padding={16}>
    <Text>Video PiP</Text>
    <Text>{VideoPictureInPictureController.isSupported() ? "PiP supported" : "PiP unsupported"}</Text>
    {loaded ? <AVPlayerView player={player} pipStatus={pipStatus}
      renderingMode="layer" pictureInPictureController={pip} frame={{ height: 240 }} /> : <Text>No video loaded</Text>}
    <Button title="Choose and play video" action={chooseVideo} />
    <Text>{possible ? "PiP possible" : "PiP not possible"}</Text>
    <Button title="Start PiP" action={() => { if (!pip.start()) setMessage(pip.lastError ?? "Cannot start PiP"); }} />
    <Button title="Stop PiP" action={() => pip.stop()} />
    <Text>{message}</Text>
  </VStack></NavigationStack>;
}

async function run() {
  try { await Navigation.present({ element: <Demo /> }); }
  finally { Script.exit(); }
}
run();
```
