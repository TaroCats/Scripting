# Input, Tap, Sink and voice processing

Call `engine.getInputNode()` to request microphone access for device input. Read its actual output format after configuring the shared audio session and voice processing; hardware and routing decide the available rate/channel count. A manual input node uses submitted PCM instead of the microphone.

## Observe audio

`node.installTap({bus, format, maximumFrameCount, slotCount, overflow})` observes an output bus without changing the graph's audio. Each bus supports one tap; close the observation or call `removeTap(bus)` before installing another. A Sink has no output bus and cannot be tapped.

`AVAudioSinkNode.create({format, maximumFrameCount, slotCount, overflow})` creates an input-chain receiver. Attach and connect it using its declared format, matching the device input chain. Sink does not convert formats and is unsupported in manual rendering. `sink.close()` seals delivery; detach/dispose the sink to release the native node's callback storage.

`read()` returns one independent PCM block or null when no block is currently queued or the observation has closed. Null alone is not end-of-input for a running stream. Dispose each returned buffer. Blocks contain copied audio time, an exact decimal-string sequence, discontinuity and renderEpoch; an engine reset or configuration change separates render epochs. Do not interpret a missing timestamp as zero.

Observation queues are bounded. `dropOldest` retains recent blocks when full; `latest` replaces queued observations with the latest block; `error` reports overflow instead of silently recording gaps. Read statistics and discontinuity for monitoring. Use `error` when gaps are unacceptable, and stop/report failure if the reader cannot keep up. A failed queue must be closed and recreated. The system may supply a different tap quantum than requested; maximumFrameCount is a storage bound, so an oversized native block fails explicitly. Choose a sufficient bound for the device and format.

## Voice processing

Stop the engine before changing `enabled`. `configureVoiceProcessing()` also controls bypass, automatic gain control, muted input and other-audio ducking. Re-read input formats and connections after changing mode. `getVoiceProcessing()` reports actual values. Voice processing requires the input node's output format and output node's input format to match in both sample rate and channel count. Explicitly connect the final mixer to `await engine.getOutputNode()` with the input format; the mixer's automatic output connection may use a different format. Configure these connections while stopped.

`setSpeechActivityHandler()` observes Apple's muted-speech activity notifications when voice processing is enabled and input is muted with `inputMuted`. It is not a general speech detector or transcription API. Events are `started` / `ended`, delivered asynchronously through a bounded collector; pass null to remove the listener. Callbacks never run on the audio render thread. Tap/Sink reading also runs outside that thread: JavaScript cannot synchronously generate a render quantum from these observation APIs.

## Runnable index.tsx

The example records the post-EQ microphone stream into a temporary CAF, compares pre/post-EQ RMS and supports voice processing and file preview. Monitoring starts off; use headphones before explicitly enabling it. Dropped blocks are counted as discontinuities, not hidden. Stop finalizes the file. Route changes/interruption stop capture; start again once the route is ready to rebuild with its actual format. Copy recordings elsewhere before closing. The demo activates/deactivates the shared session; run it without another device-audio script.

Open the documentation’s example entry to run the demo, or view the complete [index.tsx](index.tsx).
