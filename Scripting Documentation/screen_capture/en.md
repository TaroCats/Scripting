# Screen Capture: Sessions and Authorization

`ScreenCapture` is a global API for iOS/iPadOS 27 and later. It runs in a live main App script, with that script's visible foreground interface required to open the picker or recording editor. Widgets, extensions and worker JS contexts cannot present these interfaces. `isSupported` reports runtime support; `isAvailable` additionally reflects the App request switch and current system availability, and does not grant authorization.

Use Settings → Permissions → Allow Screen Capture Requests to control whether scripts may request capture. Each script also needs `screenCapture` permission. Every new session uses Apple's content-sharing picker; the user selects the shared content and whether to enable microphone/camera. The App switch does not silently authorize future requests. Disabling it stops existing sessions. Microphone and camera access require their separate system grants; recording to a file needs script `fileSystem` access. Photos access is needed only if another API saves to Photos.

| Entry | Behavior |
| --- | --- |
| `createSession(options?)` | Authorize and prepare a `ready` session, without starting capture. Attach recording/raw outputs before `start()` to include initial samples. |
| `start(options?)` | Authorize and start; returns a running session. |
| `capture(options?)` | Authorize, start, optionally delay, return one fresh image, then stop even on failure. |
| `presentRecordingEditor(path)` | Present Apple's editor for a finished local recording; resolves on dismissal. |

`scope` defaults to `display`: request the entire display and verify the selection. `app` uses in-app sharing; `system` leaves the selection style to the system. Read `session.selection` for the actual style, content rectangle, pixel scale and microphone/camera choices. `picker.showsMicrophoneControl` and `showsCameraControl` expose system choices rather than forcibly enabling devices. Camera effects require `app` scope.

A session progresses `ready → starting → running → stopping → stopped/failed`. `stop()` is idempotent, releases outputs, waits for native capture shutdown and final recording writes, and returns `ScreenCaptureEnd`; `closed` resolves with the same result, including system/user termination. A failed native stop rejects `stopFailed`, retains ownership and can be retried. Output errors are separate from session errors. `closed.recordings` contains completion results for the recording attached at termination; an independently removed recording has its own `finished` Promise.

The optional `signal` governs the entire session lifetime. Aborting during the picker cancels that request; aborting after acquisition stops its session. Stop and resource disposal remain callable after access revocation. New capture requires a new system selection; there is no automatic reconnection after system termination.

See [images](images/en.md), [raw samples and clocks](samples/en.md), [recordings and editor](recording/en.md), [rolling clips](clips/en.md), [camera effects](camera/en.md) and [HDR](hdr/en.md).

## Configuration and events

Omit configuration fields to keep the native defaults. Requested dimensions and audio formats may be adjusted or rejected by the system; inspect each sample's actual format and `session.configuration`.

| Configuration | Purpose |
| --- | --- |
| `width`, `height` | Requested positive integer output dimensions. |
| `capturesAudio` | Include system audio. Microphone choice remains separate. |
| `sampleRate`, `channelCount` | Requested positive integer system-audio format. |
| `excludesCurrentProcessAudio` | Exclude this App's own audio from system audio. |
| `captureDynamicRange` | `sdr` or `hdrCanonicalDisplay`. |
| `preset` | `hdrRecordingPreservedSDRHDR10`; individual fields override the preset. |

`onStateChanged`, `onFrameStatusChanged` and `onActivityChanged` report lifecycle, native frame status and activity. Set a callback to `null` to remove it. Activity/availability are diagnostics; actual samples or completed files establish successful capture. `getStatistics()` reports attached sample outputs and known delivery loss; it does not account for all native framework memory.

Handle `ScreenCaptureError.code` and optional `nativeDomain`/`nativeCode`. User cancellation is `userCancelled`, signal cancellation is `aborted`, invalid caller options are `invalidArgument`, and system/native failures retain their native error information. A failed session cannot restart: finish cleanup and request a new session/system selection. Prefer `try/finally` and always await stop; do not treat a caught error as proof native capture has stopped.

## index.tsx

Run it inside the main App; the system picker requires user interaction. The Stop / Cancel button and closing the script release its session.

Open the documentation’s example entry to run the demo, or view the complete [index.tsx](index.tsx).
