# Screen Capture: Recording and Editor

Use `createSession()`, then `addRecordingOutput({filePath, videoCodecType?, outputFileType?, mixesAudioWithMicrophone?, overwrite?})`, then `start()`. Attaching before start includes the first captured sample. One native recording may be attached at a time. Codec/container availability comes from `getRecordingCapabilities()`; defaults are H.264 (`avc1`) and MP4 (`public.mpeg-4`). File paths must be absolute, writable script-authorized locations. Existing files reject `fileExists` unless overwrite is explicitly true.

A recording exposes `state`, `recordedDuration` (seconds), `recordedFileSize` (bytes), `onStateChanged`, `finished` and `stop()`. Stopping the recording detaches and finalizes it while the session can continue. Stopping the session finalizes the attached recording. Await `finished` before previewing or sharing a file; attaching/starting does not prove the file is complete. A recording removed before capture begins rejects `aborted`. Native recording consumes the native stream and is independent of raw JS sample consumers.

Set `configuration.capturesAudio` for system audio and show the microphone choice for narration. The picker result determines whether the mic is enabled, and separate microphone system permission is required. `mixesAudioWithMicrophone` defaults to true; false retains separate audio tracks. A busy incompatible shared audio session rejects `resourceBusy`; applications using SharedAudioSession can configure compatible input beforehand.

`presentRecordingEditor(filePath)` presents Apple's editing/preview interface from this script's visible foreground scene. It resolves when dismissed, and does not return an edited-file URL or imply that the user saved/shared anything. Keep the original completed recording result. Saving to Photos through another API needs its own permission.

The built-in **Screen Recording** script provides this same public workflow. App Review can open it, allow script permissions, choose full-display sharing, switch to another app, return, stop, then preview the file.

## index.tsx

Run it inside the main App; the system picker requires user interaction. The Stop / Cancel button and closing the script release its session.

Open the documentation’s example entry to run the demo, or view the complete [index.tsx](index.tsx).
