# Screen Capture: HDR and Configuration

`configuration` supports `width`, `height`, `capturesAudio`, `sampleRate`, `channelCount`, `excludesCurrentProcessAudio`, `captureDynamicRange` and `preset`. Unspecified fields retain native defaults. System audio sample rate/channel count do not force the microphone device format. Read `session.configuration` for the resolved configuration and each sample's actual `format` for output details.

Use `captureDynamicRange: "sdr" | "hdrCanonicalDisplay"`. The preset `hdrRecordingPreservedSDRHDR10` uses the system's HDR recording preset; explicit configuration fields then override preset fields. Native source/device/codec restrictions still apply; a request is not proof that the captured content is HDR. Inspect bit depth, pixel format and color/HDR attachments. `hdrLocalDisplay`, native target frame rate, custom pixel format, source/destination crop and live reconfiguration are not supported by the iOS framework and are not silently simulated.

`toImage({dynamicRange: "preserve"})` and image helpers preserve extended range in UIImage; `sdr` explicitly tone maps. Encoding or displaying later through an SDR-only path may reduce range. `copyPixelPlanes()` retains original bytes and color attachments for advanced processing. For HDR recordings, choose a supported codec/container from `getRecordingCapabilities()` and retain the native output rather than round-tripping through JPEG. Full-screen or protected content availability remains controlled by the system.

## index.tsx

Run it inside the main App; the system picker requires user interaction. The Stop / Cancel button and closing the script release its session.

Open the documentation’s example entry to run the demo, or view the complete [index.tsx](index.tsx).
