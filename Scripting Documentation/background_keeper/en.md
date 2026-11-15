# BackgroundKeeper

`BackgroundKeeper` is an injected global in the main Scripting App (`Script.env === "index"`, `"home_screen"`, or `"camera_control"`). No import or Node package is required. Request it while your script is in the foreground, before background work starts; release it when the work ends.

It uses shared background audio resources. iOS can still interrupt audio, suspend, or terminate the app. An active keeper does not prove that a network session is healthy, nor guarantee that timers or TCP requests keep running indefinitely while locked.

## API

- `await BackgroundKeeper.keepAlive(): boolean`: returns `true` only when the audio engine and player are running. Audio setup/recovery failure returns `false`; access failures reject, so handle both. Repeating a successful call from one script does not add another request.
- `await BackgroundKeeper.isActive: boolean`: the actual **app-wide** running state, not this script's ownership. An interruption or a stopped engine returns `false`.
- `await BackgroundKeeper.getState(): BackgroundKeeper.State`: a snapshot with `status`, `isActive`, `requested`, and `lastFailure`.
- `await BackgroundKeeper.stopKeepAlive(): void`: releases this script's request. Other owners can keep the shared engine active. Script exit also releases the request.

`status` is `idle` when no engine or requests remain, `active` while audio runs, `interrupted` during an audio interruption, or `inactive` when resources/requests remain but audio is not running. `requested` means **this script** owns a previously successful request; it may remain true during interruption. `lastFailure` is `null` or a fixed reason such as `audio-session-failed`, `audio-start-failed`, `audio-restart-failed`, `audio-state-failed`, `audio-interrupted`, or `resume-not-permitted`. A successful retry or final release clears it.

The system's audio interruption policy controls automatic resumption. If it does not allow resumption, inspect the state and retry explicitly when appropriate; do not poll in an unbounded tight loop.

## Complete example

This example uses only globals; paste it into an App script's `index.ts`.

```ts
async function run() {
  let acquired = false
  try {
    acquired = await BackgroundKeeper.keepAlive()
    if (!acquired) {
      console.log("Keep-alive unavailable", await BackgroundKeeper.getState())
      return
    }
    console.log("Keep-alive state", await BackgroundKeeper.getState())
    // Replace this bounded delay with your work; handle its own failures.
    await new Promise<void>(resolve => setTimeout(resolve, 10000))
  } catch (error) {
    console.error("Background work could not continue", error)
  } finally {
    if (acquired) await BackgroundKeeper.stopKeepAlive()
  }
}
void run()
```

Use this sparingly because background audio consumes power. For network work, also inspect actual replies and session errors. Establish fresh connections after failure; keep-alive cannot revive an expired connection.
