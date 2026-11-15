# Screen Capture: Video, Audio and Timing

Attach `addVideoOutput({maxFPS?, buffering?})` and `addAudioOutput({source, buffering?})` before start when initial samples matter. Audio `source` is `system` or `microphone`. System audio requires `configuration.capturesAudio`; microphone requires the user's picker selection. The actual microphone format is independent of configured system sample rate/channel count.

Each output exposes `samples`, a single-consumer async iterable, `closed`, `getStatistics()`, `onError`, and `dispose()`. Breaking iteration detaches that output, without stopping the session or disposing a sample retained by the script. Always dispose each delivered sample in `finally`. Copy methods return independent `Data`; disposing the original does not invalidate those copies.

Video exposes `hasImage`, nullable `format`, frame `metadata`, `toImage()`, `copyPixelPlanes()` and `dispose()`. Status-only video samples may lack pixels: inspect `hasImage` first. Pixel planes preserve each native plane's width, height and `bytesPerRow`, including padding. Pixel format/FourCC, bit depth and attachments describe the actual buffer; do not assume RGBA, a fixed format or SDR.

Audio exposes actual ASBD fields, optional channel-layout bytes, `sampleCount`, and `copyAudioBuffers()` returning native buffer data/channel counts. Do not assume interleaving, Float32 or a fixed microphone format. `discontinuity: true` marks known bridge delivery loss; `null` means native continuity is unknown. Check timestamps for source discontinuities and resynchronize downstream when needed.

Default buffering: video capacity 1 / `dropOldest`, audio capacity 32 / `error`. Set explicit capacity and `overflow: dropOldest | dropNewest | error` as needed. Queues are bounded before dispatch to JS; native capture never waits for JS. `maxFPS` limits video delivery, not the native capture rate. Slow consumers drop or fail explicitly; native recordings do not use these JS queues. Scripts that retain samples control their own retained memory.

Timing uses native CMTime fields: `value`/`epoch` are bigint, plus timescale, flags and nullable seconds. Preserve rational values when synchronizing. `session.timing.currentTime()` reports the stream clock when available; `hostTimeSeconds` is provided only when convertible. Do not infer A/V synchronization from callback arrival order. Observe `onFrameStatusChanged`, `onActivityChanged`, `selection`, sample metadata and output/session statistics for diagnostics.

## index.tsx

Run it inside the main App; the system picker requires user interaction. The Stop / Cancel button and closing the script release its session.

Open the documentation’s example entry to run the demo, or view the complete [index.tsx](index.tsx).
