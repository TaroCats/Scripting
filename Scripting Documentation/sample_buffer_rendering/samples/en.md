# Reading and Owning Samples

`await MediaSampleReader.create(asset, "video" | "audio", { decoded: true, trackIndex: 0 })` opens one track. `decoded: true` yields system-decoded BGRA video, AV1 software-decoded NV12/P010, or interleaved Float32 PCM. Set `decoded: false` to preserve compressed packets and original codec descriptions; compressed rendering support depends on the system. This does not change existing AVAssetReader image/array outputs.

Decoded video also accepts `decoder: "auto" | "system" | "software"`. The default auto mode can fall back to software for supported local AV1 MP4 files when the system decoder is missing. `getCapabilities()` reports hints; optional `prepare()` and read-only `info` report the selected backend without consuming the first frame. See [AV1 MP4 decoding](../av1/en.md) for limits and a runnable example.

`copyNextSampleBuffer()` returns an owned `MediaSample` or null only at successful EOF. Cancellation and decoding errors reject. Only one read may be pending per reader. Samples expose `mediaType`, `presentationTime`, `decodeTime`, `duration`, `sampleCount` and `disposed`; time fields use MediaTime, preserving native precision. Invalid/indefinite duration is possible and must be checked. Retain handles only as long as necessary and call `dispose()` in finally after enqueue settles. Native queues retain independently.

On iOS 27, `ScreenCapture.Sample.toMediaSample()` creates an independent sample handle without converting through UIImage/JS arrays. Only complete video frames can be converted. Capture source permissions still apply, and capture timestamps must be anchored to the playback clock. Disposing the source sample does not dispose its converted handle.

A script may retain up to 128 samples / 64 MiB of sample payload. Renderer queues have separate limits. These are managed payload limits, not a bound on codec/system memory. Handles belong to one script and cannot be transferred to another executor.

Passthrough readers preserve zero-payload drain/empty-edit markers. `isMarker` identifies these; enqueue them in sequence too, and check timing.isNumeric before using their timestamps.

## index.tsx

Open the documentation’s example entry to run the demo, or view the complete [index.tsx](index.tsx).
