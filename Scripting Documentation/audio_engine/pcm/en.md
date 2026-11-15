# Formats, PCM and conversion

`AVAudioFormat` describes sample rate, channels/layout, sample type and interleaving. PCM arrays support float32, float64, int16 and int32. Planar arrays contain one array per channel; packed/interleaved arrays contain frame-major samples such as L,R,L,R. Native file/codec settings can also create compressed formats; these do not expose PCM samples directly.

`AVAudioChannelLayout` accepts a layout tag, channel bitmap or channel descriptions. `copyData()` returns an independent native layout snapshot. `AVAudioTime` supports host ticks, sample time or both. Host ticks are decimal strings to preserve every UInt64 bit; sample times are numbers within JavaScript's exact integer range.

`AVAudioPCMBuffer.allocate()` starts with frameLength 0 and zeroed capacity. Set a length before using samples. `fromChannels()` / `fromInterleaved()` copy the supplied arrays; modifying a source array afterwards does not modify native audio. `copyChannels()`, `copyInterleaved()` and `copy()` also return independent copies. Dispose buffers after native users finish. A scheduled buffer cannot be changed or disposed while the player still holds it.

## Bounded processing

Use small PCM blocks. The capability report exposes per-script and per-operation protection limits; a large copy or excessive live buffers rejects instead of allocating without a bound. Source/manual-input enqueue explicitly returns accepted frames. Keep and submit the unaccepted tail; a full queue does not silently queue unlimited samples.

`AVAudioCompressedBuffer` contains copied packet bytes plus optional variable-packet descriptions. It preserves codec packets rather than interpreting them as PCM. Use `AVAudioConverter` for PCM/codec conversion. Configure it before feeding input; pass one or more input buffers to `convert(inputs, outputCapacity)`. The capacity is PCM frames or compressed packets, according to the output format. Unrequested inputs remain pending for later calls. Mark only the last input `endOfStream: true`, then call `convert([], capacity)` until `endOfStream`. A failed stream requires reset before more input. Do not reset at every chunk: that discards converter state and pending input. Inspect the converter's native capability/configuration values before selecting codec-specific options.

## Audio files

Open a local file with `AVAudioFile.openForReading(path, options)` or create a writer with `openForWriting(path, settings, options)`. Read `processingFormat` before writing PCM; the buffer format must match it. `fileFormat` describes stored encoding. `getState()` reports length, cursor, mode and closed; `read(frameCount)` returns an owned PCM buffer (zero frames at EOF), `seek(frame)` moves the cursor, and `write(buffer)` encodes an owned PCM block. Converter output is useful when its format differs from the file's processing format.

A writer uses an owned temporary stage. `close()` finalizes and publishes it; an existing target is protected unless overwrite is explicit. Always close writers in finally. Abandoned/unclosed writers discard only their own unpublished stage. Read handles can be closed without new file access. If file permission changes before a queued operation executes, it rejects. A writer closed after losing file permission finalizes without replacing the target, rejects with permissionDenied, and reports partialFilePath for its retained recovery file. After access is granted again, explicitly close the retained handle again to publish, or copy the reported recovery file with file access. Cleanup of other graph resources should continue even if finalizing a file rejects.

## Runnable index.tsx

This example requires no microphone or device playback. It demonstrates independent PCM copies, Float32-to-Int16 conversion, and an optional temporary CAF write/read/seek/EOF round trip. The file button additionally requests file access; its files are removed when the demo closes.

Open the documentation’s example entry to run the demo, or view the complete [index.tsx](index.tsx).
