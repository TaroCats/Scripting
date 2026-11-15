# AV1 MP4 decoding

`MediaSampleReader` can decode local AV1 MP4 video in software when the system has no suitable decoder. Audio continues through the existing system reader. Run in the main App on iOS 17 or later.

## Choose the decoder

Pass `decoder` when creating a decoded **video** reader:

- `"auto"` (default): try the system decoder first. If the AV1 decoder is missing before decoded output is delivered, use software decoding.
- `"system"`: use only the system path. An unavailable decoder rejects; it does not silently select software.
- `"software"`: use the AV1 software decoder. Other video codecs reject with `unsupportedCodec`.

An explicit decoder option with audio or `decoded: false` is invalid. `decoded: false` still returns the original compressed samples and markers. Software input currently requires a local `.mp4` or `.m4v` file; WebM/MKV, network streams and protected media are not added by this feature.

## Prepare and inspect

`await MediaSampleReader.getCapabilities()` returns `av1.hardwareDecodeSupported` and `av1.softwareDecodeAvailable`. These are capability hints, not a promise that a particular file plays or reaches real-time speed.

`await reader.prepare()` selects the backend and retains initial samples for the next read. Repeating it does not consume frames. It is optional: the first `copyNextSampleBuffer()` prepares implicitly. `reader.info` is null before preparation and then reports:

| Field | Meaning |
|---|---|
| `codec` | Source codec four-character identifier, such as `av01` |
| `decoded` | Whether the reader produces decoded samples |
| `decoderBackend` | `system`, `dav1d`, or `passthrough` |
| `hardwareAccelerated` | false for software; null when actual system-decoder use cannot be reported |
| `width`, `height` | Video dimensions when available |
| `bitDepth`, `pixelFormat` | Prepared output characteristics when available; BGRA, NV12 or P010 |

## Output, limits and errors

Software output supports even-sized 4:2:0 8/10-bit video up to 3840 × 2160, preserving source timestamps and full/video range. Supported color information is retained; unsupported profiles, color encodings or auxiliary metadata reject instead of silently changing the image. AV1 bitstream HDR mastering metadata and ITU-T T.35 auxiliary metadata are not supported. HDR appearance and real-time performance depend on the media and device. Software playback, especially 4K 10-bit, may drop frames; support for a format does not guarantee smooth real-time playback.

The decoder limits reference-picture memory and uses four output buffers. Dispose each sample after its enqueue completes. If output buffers remain retained, a read waits for capacity; close cancels it, and a 30-second wait rejects with `resourceLimit`. Limits also apply across decoders (two per script, four per process). These are protective limits, not throughput guarantees.

Errors distinguish `decoderUnavailable`, `unsupportedCodec`, `unsupportedFormat`, `unsupportedContainer`, `invalidData`, `resourceLimit` and closed/invalid state. Automatic fallback does not hide corrupt data, access denial or cancellation, and does not switch backends midstream. Only successful EOF returns null. Always dispose readers and samples in cleanup, including after errors or loss of access.

## Run the example

Open the documentation’s example entry, or use the complete [index.tsx](index.tsx). Choose Auto, System or Software, then select an AV1 MP4. The page reports the actual backend, shows video and plays any system-supported audio track, with Pause, Resume, Stop and Close controls. On a device without an AV1 system decoder, System should report an error while Auto/Software can decode supported files. No top-level await or external download is required.

The example preloads both tracks before starting a shared clock and keeps submission lead bounded. A single pending read overlaps decoding with submission and is cancelled and drained during cleanup. Pause/Resume changes the rate without seeking. After reading ends, the player retains its last frame until Stop, Close or another file is selected; reaching a timestamp is not a hardware presentation acknowledgement.

The example borrows the shared audio session and does not deactivate other scripts’ sessions on close. Large/high-frame-rate videos may consume substantial CPU and memory; the capability query does not guarantee 4K playback on every device.
