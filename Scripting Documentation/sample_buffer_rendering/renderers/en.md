# Renderers, Clock and Recovery

Create the video/audio renderers and synchronizer with `new`. Call `clock.addRenderer(renderer)` before any enqueue. Each renderer may belong to only one clock. Mount video with `<SampleBufferView renderer={video} videoGravity="resizeAspect" />`; gravity also accepts resizeAspectFill and resize. A video renderer supports one view at a time, in the main App. Standard accessibility modifiers apply to the host; provide separate labeled playback controls.

`clock.setRate(0, time)` pauses and anchors the clock; finite rates above zero play. Pass MediaTime.invalid() to preserve the current timeline, or supply a third numeric hostTime argument to anchor the media time to the host clock. Read `clock.currentTime` to resume without jumping. Use source presentation timestamps rather than wall-clock seconds. Enqueue initial audio/video samples before starting. Pump the tracks concurrently: filling one paused track before starting the other can deadlock until the enqueue timeout.

`await renderer.enqueue(sample)` resolves on native queue acceptance, not audible/visible presentation or EOF drain. Each renderer accepts up to 8 pending requests / 64 MiB; submissions waiting longer than 30 seconds reject. Use await instead of an unbounded Promise.all of samples. Audio has volume (0...1) and muted. Both renderers expose status/error; video additionally exposes requiresFlushToResumeDecoding. Native failure and permission loss reject pending submissions.

`await renderer.flush()` cancels outstanding submissions and clears queued media; the already displayed video image may remain. Flush does not seek the reader or move the clock. For a restart, dispose the readers and rebuild them, flush the renderers, and reanchor the clock. `await clock.removeRenderer(renderer)` flushes before detaching, after which the renderer may be attached again. Clock dispose stops playback and disposes its still-attached renderers. All disposal is idempotent and remains available when access is revoked.

The runnable example waits for the final media timestamp after input EOF. This is a timeline check, not a guarantee that hardware has finished presenting the final sample.

## index.tsx

Open the documentation’s example entry to run the demo, or view the complete [index.tsx](index.tsx).
