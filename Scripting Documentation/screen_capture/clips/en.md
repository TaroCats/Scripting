# Screen Capture: Rolling Clips

After starting capture, call `addClipBufferingOutput()` to maintain Apple's native rolling buffer. One clip output may be attached at a time. Wait for `state === "buffering"` using `onStateChanged`; `maximumDuration` is 15 seconds.

`exportClip({filePath, duration, overwrite?})` writes the most recent requested interval, with `0 < duration <= 15`. An export does not stop buffering. The result reports the actual saved duration and file size, which can differ from the requested interval when less history is available. Use absolute authorized paths and unique filenames unless intentionally overwriting.

`stop()` waits for current exports, removes the buffer and flushes native resources. A session stop performs the same cleanup. Raw JS queue overflow does not affect this native buffer. Buffering failures use `onError`; do not treat a ready session as proof a clip was exported.

If publishing the completed clip to the requested path fails, `fileIO` includes the retained temporary recovery path in its message. Resolve that file before discarding the error; an unexpected destination created by another writer is preserved.

## index.tsx

Run it inside the main App; the system picker requires user interaction. The Stop / Cancel button and closing the script release its session.

Open the documentation’s example entry to run the demo, or view the complete [index.tsx](index.tsx).
