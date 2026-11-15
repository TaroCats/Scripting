This section describes the Script APIs related to script minimization and resume behavior. These APIs allow a script running on iPhone to hide its UI without terminating the script instance, and to listen for resume or re-trigger events while the instance remains alive.

These capabilities are suitable for:

* UI-based scripts that need to preserve runtime state after the user hides the interface
* Non-UI scripts that remain alive in the background (for example, notification-driven scripts)

---

## Runtime Model Overview

### Script Instance Lifecycle

* Calling `Script.minimize()` does not terminate the script instance.
* Only `Script.exit()` fully terminates the script and releases resources.
* `Script.onResume()` is triggered only while the script instance is still alive.
* If `Script.exit()` has been called, subsequent triggers will create a new script instance and re-execute the entry file.

### Interaction with URL Schemes

* When using `scripting://run/...`:

  * If an existing instance is alive, `Script.onResume()` will be triggered.
  * The entry file will not be executed again.

* When using `scripting://run_single/...`:

  * All previous instances of the script are terminated.
  * `onResume` of the previous instance will not be triggered.
  * A new instance is created and the entry file runs again.

---

## API Reference

### `Script.supportsMinimization(): boolean`

Determines whether the current environment supports script minimization.

Not all environments allow minimization (for example, certain extension contexts).

```ts
if (Script.supportsMinimization()) {
  // Enable minimization-related logic
}
```

---

### `Script.isMinimized(): boolean`

Returns whether the current script is in the minimized state.

```ts
if (Script.isMinimized()) {
  console.log("Script is currently minimized")
}
```

---

### `Script.minimize(): Promise<boolean>`

Minimizes the current script.

After minimization:

* The UI is hidden.
* The script instance continues running.
* `Script.exit()` is not called.

Behavior rules:

* If the script is already minimized, nothing happens.
* If multiple windows mode is enabled, the method is ignored.
* Return value:

  * `true` if minimization succeeds
  * `false` if minimization is not performed (for example, unsupported environment or ignored state)

```ts
async function handleMinimize() {
  if (!Script.supportsMinimization()) return

  const success = await Script.minimize()
  if (!success) {
    console.log("Minimization was not performed")
  }
}
```

---

### `Script.enableMinimize(enabled?: boolean): void`

Enables minimize-on-swipe-dismiss for the script's **root presented UI** (the first page presented with `Navigation.present`, whether a sheet or a full-screen page).

Once enabled, when the user interactively **swipes the root page down to dismiss it**, the script is minimized instead of being ended: the UI is hidden, the script instance keeps running, `Script.onMinimize` is triggered, and the script can be resumed from the running scripts list — exactly as if `Script.minimize()` had been called.

Behavior rules:

* Affects only interactive swipe-down dismissal of the root page. Programmatic dismissal via `Navigation.useDismiss()(result)` still closes the page and resolves the `present` promise with `result` as usual.
* `Script.exit()` still fully terminates the script.
* Has no effect when multiple windows mode is enabled.
* Pass `false` to disable the behavior again. Defaults to `true`.
* While the script is minimized, the original `Navigation.present` promise stays pending (the same as after `Script.minimize()`). Use `Script.onResume()` to react when the script is restored.

```ts
// Keep the script alive when the user swipes the sheet away.
Script.enableMinimize()

await Navigation.present({
  element: <MyView />,
  modalPresentationStyle: "pageSheet",
})
```

---

### `Script.onMinimize(callback: () => void): () => void`

Registers a listener for the minimize event.

Triggered when:

* `Script.minimize()` successfully transitions the script into minimized state.
* The script moves from foreground to minimized state.

Returns a function that removes the listener.

```ts
const remove = Script.onMinimize(() => {
  console.log("Script has been minimized")
})

// Remove listener
remove()
```

---

### `Script.onResume(callback: (eventDetails: ResumeEventDetails) => void): () => void`

Registers a listener for resume or re-trigger events.

The resume event is delivered only when:

* The script instance is still alive.
* `Script.exit()` has not been called.

Returns a function that removes the listener.

```ts
const remove = Script.onResume(details => {
  console.log("Resume event:", details)
})
```

---

## ResumeEventDetails Structure

```ts
type ResumeEventDetails = {
  resumeFromMinimized: boolean
  widgetParameter: string | null
  controlWidgetParameter: string | null
  queryParameters: Record<string, any> | null
  notificationInfo: NotificationInfo | null
}
```

### `resumeFromMinimized: boolean`

* `true`: The script was restored from minimized state.
* `false`: The script was not restored from minimized state (for example, it was already in foreground or triggered by another source).

---

### `widgetParameter: string | null`

Parameter passed when the script is resumed by tapping a home screen widget.

---

### `controlWidgetParameter: string | null`

Parameter passed when the script is resumed by interacting with a Control Center widget.

---

### `queryParameters: Record<string, any> | null`

Query parameters passed when the script is resumed. Values keep their JSON types when resumed with a JSON object, but are strings when resumed via a `scripting://run/...` URL scheme.

---

### `notificationInfo: NotificationInfo | null`

Notification information passed when the script is resumed by tapping a notification.

---

## Behavior Scenarios

### UI-Based Script

#### Minimization Flow

* The script is running in the foreground.
* `Script.minimize()` is called.
* On success:

  * `Script.onMinimize` is triggered.
  * The UI is hidden.
  * The script instance remains alive.

#### Restoring from Minimized State

* The user taps the running script entry in the app.
* `Script.onResume` is triggered.
* `eventDetails.resumeFromMinimized === true`.

---

### External Triggers While in Foreground

When the script instance is alive and currently in the foreground:

* Tapping a notification
* Triggering the script via a widget run URL scheme

In these cases, `Script.onResume` is triggered and the corresponding parameter fields in `ResumeEventDetails` are populated.

`Script.run()` starts a new JavaScript instance with its own permissions for that call.

---

### Non-UI (Background) Script

If the script has not called `Script.exit()`:

* Even without presenting UI,
* Tapping a notification or triggering the script again
* Will invoke registered `Script.onResume` callbacks.

If the script has called `Script.exit()`:

* A new trigger (notification, widget, etc.) creates a new script instance.
* The entry file executes again.
* Previous `onResume` listeners are not triggered.

---

## Usage Guidance

* Check `Script.supportsMinimization()` before enabling minimization-related features.
* Avoid calling `Script.exit()` if the script needs to remain alive.
* Use `Script.onResume()` to centralize handling of resume, widget triggers, notification taps, and URL-based triggers.
* Use `run_single` or `singleMode: true` when concurrent instances must be prevented.

This model enables long-lived script instances with hideable UI and unified resume handling across multiple trigger sources.


## Camera Control resume

A later native capture batch sent to a running camera script is available as `event.cameraControlParameter`. It is null for a resume without captured content. Register the listener early and process both `Script.cameraControlParameter` on first launch and the event field on resume. The initial property remains the initial value. See the complete [Camera Control example](../../camera_control/).

`onResume` only delivers an event; it does not restart capture. When returning to a system capture experience, the script must restore its own camera and interaction. A null parameter does not identify the launch source. File-only processing does not itself need a camera. See [System capture entry requirements](../../camera_control/) before relying on a minimized camera script to resume safely.


## Full-screen swipe minimization

For fullScreen / overFullScreen pages, configure `Navigation.present({ element, modalPresentationStyle: "fullScreen", swipeBackBehavior: "minimize" })`. This is independent of `Script.enableMinimize()`, which controls system sheet swipes. It works only for the first presented page in a supported environment. Nested or unsupported uses disable the gesture rather than closing the page. A completed minimize emits `onMinimize` once and keeps the present promise pending; cancellation changes nothing. See [Present a simple view](../../views/present_views/present_a_simple_view/) for the complete contract and examples.


## Resume source

`event.invocation` is this resume's frozen source snapshot. `Script.invocation` remains the initial launch history. Concurrent callers receive separate events; use each event's metadata together with its parameters. Service `call` requests do not trigger `onResume`; read their handler's second argument instead.
