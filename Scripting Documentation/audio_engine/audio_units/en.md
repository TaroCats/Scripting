# Audio Unit instruments, effects and native editors

Audio Units let a script host Apple's effects and installed AUv3 instruments/effects. Component discovery reports registered components; it does not guarantee that a plugin can load or render. A plugin's formats, parameters, presets and editor determine its capabilities.

## Find and load a component

Call `AVAudioUnit.findComponents({type, subtype, manufacturer, flags, flagsMask})`; omitted fields are wildcard filters. Component identifiers are numeric FourCC values. Use the three exact identity fields to instantiate a selected result. `hasCustomView` is null during discovery on iOS; call `requestView()` to learn whether an editor exists.

`AVAudioUnit.instantiate(description, {outOfProcess: true})` explicitly requests system-managed hosting outside the App process. Omit the option, or pass false, to use the system default. iOS does not provide a force-in-process loading option. Plugin instantiation is asynchronous; errors reject the Promise. If the script ends before a plugin arrives, the late result is released.

Typed factories are `AVAudioUnitEffect.createEffect`, `AVAudioUnitGenerator.createGenerator`, `AVAudioUnitTimeEffect.createTimeEffect` and `AVAudioUnitMIDIInstrument.create`. Each checks the native component type. Use generic parameters for a third-party effect; concrete built-in effect classes additionally have their own `configure` helpers. Attach the node to an engine, inspect `getBusState()`, and connect supported formats before starting. MIDIProcessor routes are separate from audio connections; use `engine.connectMIDI(source, destinations, {format})`. The destinations array replaces that source's complete destination set and takes over each destination's previous MIDI input. Feedback loops are rejected.

## Parameters and automation

`getParameterTree()` returns groups and parameter metadata, or null if absent. Parameter addresses are exact unsigned decimal strings, not JavaScript numbers. Inspect native minimum/maximum, units, flags, value strings and dependent addresses. `getParameterValues(addresses?)` reads current values; omitted addresses read all. `setParameterValues()` validates the complete batch before setting values. A plugin can still change its parameter tree or reject work during a system fault.

Use `getParameterString(address, value?)` and `getParameterValue(address, text)` for a plugin's display conversions. `scheduleParameterEvents([{address, value, sampleTime, rampDuration}])` schedules native parameter automation; rampDuration is in sample frames and requires a ramp-capable parameter. `sampleTime` is the Audio Unit render timeline; it is not host ticks or sequencer beats. `AUEventSampleTimeImmediate` is -4294967296.

`observeParameters({queueSize})` collects unthrottled native automation value/touch/release events emitted by the plugin outside JavaScript. Ordinary parameter assignment need not emit an automation event; use `getParameterValues()` to read current values. Await `next()` for the next currently queued batch; null means no queued events or a closed observer, so poll with a delay rather than a tight loop. Addresses and host times remain decimal strings. A bounded queue may drop incoming events when full or contended; discontinuity marks a later event after a drop, and statistics count accepted/delivered/queued/dropped events. It is not an audio-frame counter. Call `close()` to remove the native observer; node disposal also closes it. If the plugin replaces its parameter tree, the old observer closes and `next()` rejects with invalidated; reacquire the tree and create a new observer.

## Presets, documents and files

Read `getFactoryPresets()`, `getUserPresets()` and `getCurrentPreset()`, then select with `setCurrentPreset({number,name})`. Plugin updates can arrive asynchronously. `saveUserPreset()` persists the current native state under a negative-numbered user preset; it may overwrite an existing matching preset. `deleteUserPreset(number)` removes that plugin's user preset permanently. These methods affect native plugin storage, not just a script variable.

`getStateData({forDocument})` and `setStateData(data, {forDocument})` exchange a binary property-list dictionary, preserving native Data and integer values. Use forDocument for a document's complete state; ordinary state is suitable for preset-style snapshots. A plugin without persistable state rejects the request. Copies and result sizes are bounded; failures are explicit. `loadPreset(path)` loads a local native preset file and requires file access. Use files selected through DocumentPicker when outside your script's directory.

## Native editor and lifecycle

`requestView()` returns an `AVAudioUnitViewController`, or null when no custom editor is supplied. Import `AudioUnitView` from `"scripting"` and render `<AudioUnitView controller={controller} frame={{minHeight:280}} />`. The handle belongs to this script/channel and can be mounted in one place at a time. Remove it from the page before disposing it. Its controls keep the plugin's own accessibility semantics; script modifiers apply to the host, and the host does not hide or combine the plugin's child controls. Accessibility of a third-party editor depends on that plugin; offer native parameter controls as an alternative.

Dispose the editor, stop/dispose the engine, and dispose detached custom units in finally. Closing a script or revoking audio-engine access removes its editors. A late editor request cannot revive a disposed unit. Editors and engines are main App capabilities; widgets, extensions, remote rendering and external-display rendering cannot embed them. System media reset may require a new engine and fresh plugin instance; observe engine events and rebuild explicitly.

## Runnable index.tsx

This complete demo discovers effects/instruments, loads a selection, renders its native editor when available, and supplies parameter buttons, factory presets and an in-memory state snapshot. Effects receive a quiet generated tone; instruments receive note 60 and need a usable plugin sound/preset. It does not download plugins or change persistent user presets. Stop/unload closes observers/editors and releases audio. The shared session affects other device-audio scripts, so run the demo on its own.

Open the documentation’s example entry to run the demo, or view the complete [index.tsx](index.tsx).
