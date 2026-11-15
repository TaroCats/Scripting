Play sounds from entities in a foreground RealityKit scene. Audio resources and playback controllers are global RealityKit APIs. Import `RealityView` from `scripting` to mount the scene.

## Load and play audio

Call `RealityKit.AudioResource.load(path, options)` with a local audio file your script can read. The default `loadingStrategy: "preload"` loads the audio before playback. Use `"stream"` for longer files. The runtime keeps a private copy of the authorized source for the lifetime of a streaming resource.

```ts
async function prepareTone(path: string, emitter: RealityKit.Entity) {
  const sound = await RealityKit.AudioResource.load(path, { loadingStrategy: "stream" })
  const playback = emitter.prepareAudio(sound, { gain: -8 })
  const completed = playback.onCompleted(info => console.log(info.state))
  return { sound, playback, completed }
}
```

Once the emitter's scene is mounted, call `playback.play()` or use `emitter.playAudio(sound)` to prepare and start playback together. A resource can supply multiple playback instances. Each playback has its own speed, gain, completion subscription and play, pause and stop controls. Set the speed from 0.25 to 4. Gains use decibels, with 0 as nominal and `"silent"` for silence. Use `fade({ gain, duration })` to change gain over time. `seek(seconds)` requires iOS 18 or later.

`playback.info` reports the requested state, the native `isPlaying` value, gain and speed. Use `onCompleted()` to observe natural completion. Disposing the subscription stops its callbacks. Disposing the playback stops its audio. Removing the emitter or unmounting its surface stops active playback. Call play again after remounting to start a new playback run.

## PCM and file groups

Use `AudioResource.fromPCM(buffer)` with an `AVAudioPCMBuffer` from the same script. It copies the active frames. Once the promise resolves, you can edit or dispose of the original buffer. Audio file and PCM configuration can enable looping. On iOS 18 or later, options also include a randomized start, dynamic normalization, calibration and a named mix group.

On iOS 18 or later, use `AudioResource.fileGroup(resources)` to group file resources. The native engine picks a file from the group when it starts playback. Use `sound.info` to inspect the resource kind, loading strategy and available duration.

## Spatial sources and listening

On iOS 18 or later, set a source to spatial, ambient or channel rendering using `entity.setAudioSource()`. Spatial sources support an overall gain, direct and reverb levels, beam focus from 0 to 1 and distance rolloff. RealityKit spatializes a mono source, mixing multiple input channels first when needed.

```ts
const emitter = RealityKit.Entity.create({ transform: { position: [-1, 0, 0] } })
if (RealityKit.getCapabilities().spatialAudioConfiguration) {
  emitter.setAudioSource({ kind: "spatial", beamFocus: 0.3, rolloff: 1, reverbLevel: -12 })
}
```

By default, the active camera is the listener. Use `renderer.setAudioListener(entity)` with an entity in the same scene to use its position and orientation. Call it with no argument to restore the default. On iOS 18 or later, use `scene.setAudioReverb()` with a preset such as `"concertHall"`, `"smallRoom"` or `"anechoic"`.

## Libraries and mix groups

On iOS 18 or later, `entity.audioLibrary()` reads named resources from an imported or script-configured native library. Use `setAudioLibrary([{ name, resource }])` to install a library with unique names and `removeAudioLibrary()` to clear it.

For a file loaded with `AudioResource.load`, `resource.info.name` is the file name without its extension. A file resource from an imported library uses its library entry name. Adding a library alias to an existing resource preserves its `info.name`.

Configure a named mix group using `setAudioMixGroup({ name, gain, speed, muted })` on an entity in the scene. Reference the group by name in a resource's `mixGroup` option. Read it with `audioMixGroup(name)`, update gain over time with `fadeAudioMixGroup()`, and remove the named group with `removeAudioMixGroup(name)`.

Run the example to play a tone and move its source from one side of the scene to the other. The controls display the current location and playback status.
