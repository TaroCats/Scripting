# MIDI instruments, Sampler and Sequencer

MIDI instruments accept note on/off, controllers, program/bank changes, pitch bend, channel/poly pressure, SysEx, UMP and native sample-time scheduling. Start the engine before sending immediate device MIDI. Decimal-string addresses and host clocks preserve native precision; AUEventSampleTimeImmediate is -4294967296 for scheduled MIDI. Cable numbers and message boundaries are validated. UMP uses Uint32Array words; bytes and word boundaries must not be interchanged. Plugin support decides which MIDI protocols/messages can actually be rendered.

MIDI command Promises report native submission, not a remote plugin's rendered output. Out-of-process processors can handle events asynchronously. Their MIDI clocks may not advance with a rapidly rendered offline audio graph: test the selected plugin's actual output before relying on it for offline export. Do not assume that the very next render block contains a newly submitted event. Use a device-rendered graph for live MIDI routing.

`AVAudioUnitSampler` loads audio files, SoundFont/DLS banks or native instruments. A plain sample file uses the sampler's native root/key mapping. Use a bank/instrument when you need an explicit mapping. File operations require file access; retained sources remain owned until the native instrument releases them. `allNotesOff()` also clears sustain and remains available for cleanup. Stop/rebuild/dispose old graphs after native invalidation.

## Sequences and tracks

Create a standalone `AVAudioSequencer` for editing, or associate one with an engine for instrument playback. An engine supports one live associated sequencer; dispose it before replacing it. Attach the destination Audio Unit to that engine, then configure each track's destination. Stop the sequencer before changing destinations. Start the engine before starting an associated sequencer. Engine stop/pause/reset also stops its sequencer; restarting playback is explicit.

Add notes, controls, pressure/program/pitch events, extended notes, SysEx, meta/user events, tempo, automated parameter or preset events. Parameter events use automation tracks; tempo events use the tempo track. Edit through clear/cut/move/copy/merge/reverse. Configure muting, solo, loops, lengths and offsets. Beats and seconds are distinct; use the sequencer's tempo-map conversions. timeResolution describes file PPQN and is read from the parent tempo track, rather than a regular track.

`getEvents(range)` returns a copied native metadata snapshot. Native Sysex/User events expose sizeInBytes; meta events expose metaType. Their immutable opaque data has no public enumeration getter. `observeUserEvents()` provides complete user-event bytes asynchronously during playback, with exact sequence strings, track handles and discontinuity. read() returns null when no events are queued; close() removes observation. getStatistics() reports accepted/delivered/queued/dropped event counts. These are not audio render callbacks.

load/loadData replaces track handles. Reacquire tracks and destinations after loading; removed/disposed/replaced tracks reject further operations. Copy/merge uses native event contents, preserving opaque data without a JS payload round trip. Query bounded ranges for large event lists. Partial edits can retain conservative native event-memory credit until the track is emptied or replaced.

## MIDI files and precision

exportData/write uses the selected native MIDI file resolution. A file round trip can quantize fractional beats, and custom user events may not survive Standard MIDI File export (verified on iOS26.5). File export is not an exact native event snapshot. Use live user-event observation for custom playback messages; retain your script's source event data when you need an editable project format. write() protects existing targets unless overwrite is true, and performs file work on a worker.

## Runnable index.tsx

The demo creates its own short CAF sample, gives each note accessible On/Off buttons, supports sustain, a four-beat melody, tempo/loop, optional user-selected soundbank/MIDI imports and MIDI export. No download or microphone is needed. Tempo changes restart at beat0. The example activates the shared playback session and removes only its own temporary folder on close; copy exports elsewhere before closing to keep them.

Open the documentation’s example entry to run the demo, or view the complete [index.tsx](index.tsx).
