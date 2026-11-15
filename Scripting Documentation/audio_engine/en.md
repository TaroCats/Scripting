# Audio Engine

Added in Scripting 3.2.2. Audio Engine lets a main App script connect players, effects, mixers, instruments and input/output nodes, read PCM samples, and render audio without a speaker. The `AVAudio*` classes are globals; JSX components are imported from `"scripting"`.

An engine owns its built-in input, output and main mixer. Create custom nodes with their factories, attach them, and connect their buses before starting. Detach a custom node before disposing or reusing it in another engine. Built-in nodes are released with their engine.

## Session, permissions and lifetime

`SharedAudioSession` configures the process-wide audio route and recording/playback category. Configure it explicitly before starting device audio. Settings affect other scripts and media users too. Device input requests system microphone access and the script's audio-engine permission; file operations also check file access. Main App scripts are supported; widgets, extensions, remote renderers and background JS executors cannot host an engine.

Keep the engine, active nodes and buffers in scope until cleanup. Await operations to establish graph order. `stop()` cancels pending playback and queued source data; `pause()` preserves playback position. After a configuration or media-services change, check `onEvent` and `getState()`. A `needsRebuild` engine requires a new graph. The API does not automatically restart audio after an interruption. Dispose resources in `finally`; stopping and disposal remain available after access is revoked.

Playback tickets report the selected native completion point. `dataConsumed` means the player accepted the samples, `dataRendered` means they were rendered, and `dataPlayedBack` waits for output playback. Manual rendering supports the first two; it cannot prove device playback. A cancelled ticket resolves with its cancellation reason.

## Runnable index.tsx

Open this folder as a script and run `index.tsx`. Build a looping melody through EQ, delay and reverb, toggle bypass/volume, and pause/resume the player. Stop releases the graph; build again to restart. Closing also cleans up. The demo activates/deactivates the shared session; run it without another device-audio script.

Open the documentation’s example entry to run the demo, or view the complete [index.tsx](index.tsx).
