# Captured files and resume delivery

`Script.cameraControlParameter: CameraControlParameter | null` contains the batch handed to the initial `index.tsx` invocation. A later batch delivered to an existing camera script arrives in `Script.onResume(event)` as `event.cameraControlParameter`. The initial property is not a live queue. Other launches/resume events have null camera parameters. Keep existing `queryParameters` for your own inputs.

```ts
import type { CameraControlParameter } from "scripting"
// Shape of CameraControlParameter:
// { captureId: string, assets: CameraControlAsset[] }
// Each asset:
// { id, type: "photo" | "video", filePath, typeIdentifier, capturedAt,
//   width?, height?, duration? }
```

| Field | Meaning |
| --- | --- |
| `captureId` | Stable batch ID, including on an explicit retry. Use it for application-specific idempotency. |
| `assets` | Completed files in capture order. A Lock Screen capture session supports up to 128 items; a built-in fallback capture supplies its completed photo or video. |
| `id` | Asset ID within the batch. |
| `type` | `photo` or `video`. |
| `filePath` | An absolute, readable local path in the main app after file import completes. |
| `typeIdentifier` | The actual file UTI. Photos use `public.jpeg`; Lock Screen videos use `com.apple.quicktime-movie`. A built-in fallback video reports the returned file’s actual type. |
| `capturedAt` | The recorded capture time in milliseconds since the Unix epoch. |
| `width`, `height` | Encoded pixel dimensions when known. Apply normal image/video orientation metadata for display. |
| `duration` | Video duration in seconds when known; absent for photos. |

Read photos lazily with `UIImage.fromFile`. Use a local path with `AVPlayer`/`VideoPlayer`, `AVAsset`, Photos, or a file-processing/upload API. Do not base64-encode whole videos just to pass them between pages.

A null camera parameter on resume is not a new file batch. Restore your capture UI when returning through the camera entry; keep any files already received without processing them again. The example queues this restoration if an earlier capture or stop is still pending. File-only handoff starts with capture off; receiving new files while a visible capture is already running keeps that viewfinder active.

The resume event does not itself restart the camera, and a null parameter is not proof of a system camera launch. Receiving files alone does not require a new camera session. If a system camera entry also brings the script back to capture, your script must restore that experience. See [System capture entry requirements](../) for the main-app termination risk and the limits of the documented rules.

This example chooses to restore its viewfinder on an empty resume in `camera_control`. That is the example's script policy, not a native guarantee identifying the launch source.

## Delivery and retention

Scripting waits for the system's files, imports the whole batch, and only then runs/resumes the camera script. Duplicate system notifications do not automatically execute the batch again. This does not guarantee exactly-once effects in your script after a crash: if you upload or charge for something, record success using `captureId` and implement your own retry policy.

Captured files stay on this device after `Script.exit()`. Open **More → Default Scripts → Camera Control → Captured Files** to retry, run again, export the original files, or explicitly delete a batch. Export and deletion remain available without a selected script. Close the camera script first if it is still using that batch. **Sent to Script** means delivery occurred, not that script processing succeeded. Keep your own copy if you need a file after the user deletes the saved batch.

If there is no selected script, its selection changed, or it is missing or fails to start, files are preserved for selection and retry. Merely dismissing the capture extension does not run a script. Video recording must finish saving before the process button becomes available. Photos permission is only requested when saving to or reading the photo library; microphone access is only needed when recording video with audio enabled.

The full example handles both initial and resumed batches. A new batch also cancels a camera start still waiting for permission, so the script can display the files without unexpectedly starting the camera later.


Cancelling system authentication preserves completed files and does not run a script automatically. On returning to the capture page, continue capturing or tap Let Scripting Process again. Processing is unavailable while recording or saving. The files can arrive after the main app opens; Scripting waits for the matching batch, so scripts do not need to poll extension directories.

## Complete index.tsx example

Open the documentation’s example entry to run the demo, or view the complete [index.tsx](index.tsx).
