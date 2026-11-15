# Manual rendering and offline export

Use `enableManualRendering({mode, format, maximumFrameCount})` on a stopped engine, then schedule sources and start. `offline` renders through `renderOffline(frameCount)`; `realtime` uses `getManualRenderer().render(frameCount)`. Both return native status, actual PCM frameLength, sampleTime and renderEpoch. Dispose returned PCM. A realtime manual renderer is an explicitly driven native renderer; it does not automatically send audio to a speaker or call JS on the audio thread. Reset/mode changes invalidate old renderers; acquire another one.

`setManualInput()` supplies a bounded PCM queue to the input node in manual mode. Fill it before rendering. `silence` underflow inserts counted silence; `insufficientData` preserves the native insufficient-input result. On supported systems an empty-input result can remain cached for that render time; enqueue alone may not recover it. Explicitly reset/rebuild the engine when needed, knowing reset cancels other players. The bridge does not silently reset your graph.

## Export task

With a running offline graph, call `exportAudio({filePath, settings, frameCount, tailFrames?, chunkFrames?, overwrite?, partialFile?})`. One export drives an engine at a time; do not call renderOffline concurrently. chunkFrames must fit its manual-rendering maximum. Output file processingFormat must match the manual graph; configure the matching sample rate/channels/type or use AVAudioConverter explicitly for another processing format.

`frameCount` renders the main duration and `tailFrames` renders additional graph frames. Finite sources should end before the tail to let effects decay; tailFrames does not automatically stop looping sources. `getProgress()` returns renderedFrames, writtenFrames and totalFrames; `finished` resolves with the final path, actual written frame count and file format. A native insufficient/error/partial-render result fails explicitly, rather than silently padding or spinning forever.

The task writes its own same-directory staging file and publishes the target only after successful close. Existing targets are protected unless overwrite is true. `cancel()` waits for task cleanup. Stop/reset, access revocation and script exit also cancel old work. `partialFile: "remove"` is the default; `"keep"` reports a recoverable partialFilePath on failure/cancellation when one exists. Cancellation after final publication has begun cannot undo the published file; inspect the actual finished result. Export errors remain errors, even when a recoverable partial file is kept. The graph remains configured after a completed export; stop/dispose it when done.

## Runnable index.tsx

This example renders 30 seconds of locally generated tone through reverb plus a two-second tail. It shows progress, cancellation, both partial policies and playback of the result. Rendering needs no microphone or active device audio session; preview activates playback. Rendering can finish too quickly to cancel on a fast device. Closing the example removes only its own temporary folder, including kept partials: copy a result elsewhere before closing if you want to retain it.

Open the documentation’s example entry to run the demo, or view the complete [index.tsx](index.tsx).
