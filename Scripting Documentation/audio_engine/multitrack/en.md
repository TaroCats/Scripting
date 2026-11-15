# Multitrack playback and scheduling

Attach one `AVAudioPlayerNode` per independently controlled track and connect them to a mixer. Use each player's mixing volume/pan for balance. `scheduleBuffer`, `scheduleFile` and `scheduleSegment` return playback tickets; scheduling does not start a stopped player.

For aligned starts, prepare the tracks first, start the engine, read a valid native render clock, then pass the same future `AVAudioTime` to each player's `play()`. Sample times describe the player's timeline; host ticks describe the system monotonic clock. Keep host ticks as decimal strings. Do not use Date.now() as an audio host clock or coordinate tracks with JS timers.

`scheduleSegment` uses a read file handle, startingFrame and frameCount. File positions are frames, not bytes. Native scheduling owns the file/buffer until the selected completion and any remaining native use end. Do not close a file or modify/dispose a scheduled buffer while it is still in use. `interrupts` replaces existing playback immediately; `interruptsAtLoop` applies at a loop boundary. The outgoing loop can remain natively in use after its public ticket reports cancellation.

`dataConsumed`, `dataRendered` and `dataPlayedBack` refer to different completion points. A looping ticket remains pending until cancelled/replaced/stopped. `pause()` preserves the player position; `stop()` resets it and cancels schedules. Node/player time conversion requires a valid render clock and can return null before a clock is available. Physical route latency still affects what listeners hear; a scheduled timestamp does not prove speaker output.

## Runnable index.tsx

Both tracks use generated PCM, so no downloads or microphone are needed. Start them at a shared host time, optionally schedule the second track 12000 samples later, change its pan, then stop to cancel both loops. The text reports the requested timing and ticket outcomes. Run without another script using the shared audio session.

Open the documentation’s example entry to run the demo, or view the complete [index.tsx](index.tsx).
