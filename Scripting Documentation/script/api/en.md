The `Script` module provides context and utility functions for managing script execution in the Scripting app. It enables you to access runtime metadata, terminate scripts with results, run other scripts programmatically, and construct URL schemes to launch or open scripts.


## Invocation source

Use `Script.invocation` for the source that first started this instance. It is a frozen snapshot and does not change when the instance is resumed or receives a service request.

```ts
import { Script } from "scripting"

const initial = Script.invocation
console.log(initial.source, initial.caller?.name, initial.caller?.env)

Script.onResume(event => {
  // The source of this resume, not the initial launch.
  console.log(event.invocation.caller?.name)
})
```

The snapshot contains `id`, `source`, and `caller`. `source` is `"scriptRun"`, `"scriptSessionCall"`, `"scriptSessionRequest"`, or `"other"`. A known caller has `name` and `env`; its environment is separate from the receiving script's `Script.env`. Direct/external launches use `"other"` with `caller: null`. A compatible path may report `"scriptRun"` with a null caller if its identity is unavailable. Python caller/target source APIs are not part of this JavaScript addition.

Each resume has its own snapshot, so keeping an event across `await` does not change its caller. Names describe the immediate caller at invocation time, not a permanent identity, full call chain or permission grant. Caller information is supplied by the host; a `caller` field in `queryParameters` is only your own application data.

For a current `ScriptSession` request, use the handler's second parameter (`request.caller` and `request.source`). Do not use `Script.invocation` to identify the current service client. A cold service start records the caller that triggered startup; clients joining the same startup each retain their own request metadata. `Script.run` continues to wait for the final exit result.

---

## Properties

### `name: string`

The name of the currently running script.

```ts
console.log(Script.name) // e.g., "MyScript"
```

---

### `directory: string`

The directory path where the script is located.

```ts
console.log(Script.directory) // e.g., "/private/var/mobile/Containers/..."
```

---

### `env: string`

Indicates the environment in which the current script is running. This allows the script to adapt its behavior based on the runtime context—whether it’s running in the main app, a widget, a notification, or an extension.

### Possible Values:

| Value              | Description                                                                       |
| ------------------ | --------------------------------------------------------------------------------- |
| `"index"`          | Running in the main app. Entry point is `index.tsx`. Used for normal UI logic.    |
| `"widget"`         | Running in a widget. Entry point is `widget.tsx`. Used for home screen widgets.   |
| `"control_widget"` | Running in a control widget. Entry point is `contrl_widget_button.tsx` or `control_widget_toggle.tsx`. Used for control center widgets.   |
| `"notification"`   | Running in the rich notification extension. Entry point is `notification.tsx`.    |
| `"intent"`         | Running as a share sheet or shortcut intent handler. Entry point is `intent.tsx`. |
| `"app_intents"`    | Running in the App Intents extension. Entry point is `app_intents.tsx`.           |
| `"assistant_tool"` | Running in the Assistant Tool context. Entry point is `assistant_tool.tsx`.       |
| `"keyboard"`       | Running in the custom keyboard extension. Entry point is `keyboard.tsx`.          |
| `"live_activity"`  | Running in the Live Activity extension. Entry point is `live_activity.tsx`.       |
| `"home_screen"`    | Rendered as the app's Home tab. Entry point is `home_screen_default_ui.tsx`. Stays resident; use `Script.onHomeTabEvent` to observe tab events. |
| `"camera_control"` | Runs `index.tsx` in the main app from Camera Control or native capture-file handoff; same API scope as index/home_screen. |

The shared API scope does not remove [system capture entry requirements](../../camera_control/). `camera_control` is an environment label, not proof of a particular system launch. Custom scripts manage their own camera sessions; Scripting does not automatically provide capture or restart it on resume. A pure file handoff does not require a new camera session.

### Example:

```ts
if (Script.env === "widget") {
  Widget.present(<MyWidget />)
} else if (Script.env === "index") {
  Navigation.present({ element: <MainPage /> })
}
```

---

### `widgetParameter: string`

The parameter passed when the script is launched from a widget.

```ts
if (Script.widgetParameter) {
  console.log("Widget input:", Script.widgetParameter)
}
```

---

### `queryParameters: Record<string, any>`

Parameters passed to the script.

When the script is launched with a JSON object — for example `Script.run({ queryParameters })`, the `scripting-ts run ... --queryparameters '<json>'` command, or the keyboard `switchToScript` API — the original JSON value types are preserved (boolean, number, `null`, array, object).

When the script is launched via a `run` URL scheme, every value is a string, because URL query strings cannot carry typed values.

```ts
// Launched with a JSON object: { "enabled": true, "count": 3, "user": "John" }
console.log(Script.queryParameters.enabled) // true (boolean)
console.log(Script.queryParameters.count)   // 3 (number)
console.log(Script.queryParameters.user)    // "John" (string)

// Launched via URL: scripting://run/MyScript?user=John&id=123
console.log(Script.queryParameters.user) // "John"
console.log(Script.queryParameters.id)   // "123"
```

---

### `metadata: { ... }`

Metadata of the current script.

* `icon`: The icon of the script. Can be a SFSymbol name.
* `color`: The color of the script. Can be a hex color string like `#FF0000` or a CSS color name like `"red"`.
* `localizedName`: The localized name of the script in the current system language.
* `localizedNames`: A record of localized names for different languages. Keys are language codes (e.g., `"en"`, `"zh"`), and values are the localized names.
* `description`: The description of the script in English.
* `localizedDescription`: The localized description in the current system language.
* `localizedDescriptions`: A record of localized descriptions for different languages.
* `version`: The version string of the script.
* `author`: The script author's metadata:

  * `name`: The author's name
  * `email`: The author's email address
  * `homepage`: (optional) The author’s homepage
* `contributors`: An array of contributor objects with the same structure as `author`
* `remoteResource`: Information about a remote resource for this script:

  * `url`: The URL of the remote resource (e.g., a `.zip` or Git repository)
  * `autoUpdateInterval`: (optional) The auto-update interval in seconds. If not provided, auto-update is disabled.

```ts
console.log(Script.metadata.localizedName) // e.g., "天气助手"
console.log(Script.metadata.version)       // e.g., "1.2.0"
```

---

## Methods

### `Script.exit(result?): void`

Call this method when your script finishes normally to release its resources and optionally return a result.

* `result?: any | IntentValue`: Any value or `IntentValue` object to return to the caller (e.g., Shortcuts or another script).

```ts
Script.exit("Done")

// or return structured value
Script.exit(Intent.json({ status: "ok" }))
```

---

### `Script.onError(callback: (error: unknown) => void): () => void`

Observes uncaught JavaScript exceptions reported by the runtime in an ordinary App script. The callback receives the original thrown value, which can be any JavaScript value. Call the returned function to remove the listener.

Scripting calls the listener synchronously before ending the current script instance and releasing its resources, including any TCP listeners and connections it owns. Shutdown continues as soon as the callback returns, even if it returns a Promise. Handle recoverable errors with `try/catch`, and handle Promise rejections with `.catch()` or `try/catch` around `await`.

```ts
import { Script } from "scripting"

const unsubscribe = Script.onError(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : error)
})

// Call unsubscribe() when you no longer want to observe errors.
```

Node-compatible code can listen for the same exception through `process.on("uncaughtExceptionMonitor", callback)`. It receives the original thrown value and the origin `"uncaughtException"`. If you register both APIs, both callbacks observe the same exception before the script exits.

```ts
import process from "node:process"

process.on("uncaughtExceptionMonitor", (error, origin) => {
  console.error(origin, error)
})
```

---

### `Script.run<T>(options): Promise<T | null>`

Runs another script programmatically and waits for its result.

* `options.name`: The name of the script to run.
* `options.queryParameters`: Optional data passed to the target script as `Script.queryParameters`; JSON value types are preserved.
* `options.singleMode`: If `true`, ensures only one instance of the script runs.

Each JavaScript target starts in a new instance. Scripting asks how to handle the call. **Always Allow This Call** skips this confirmation when the same caller calls the same target again. **Allow for This Launch** applies to the new instance. Either option lets the target use its allowed script permissions and request undecided permissions as needed. For a synchronous API that needs permission, the target can first call `await Script.requestAccess(...)`. Permission requests follow the target's saved decisions, including explicit denials.

For JavaScript targets, **Run Without Permissions** starts the script with its script API permissions unavailable for this run. When the app cannot display the confirmation and has no applicable saved decision, it uses the same restricted mode. **Always Block This Call** rejects the Promise with `SCRIPT_INVOCATION_BLOCKED` before starting the target or closing existing instances. When a call cannot be remembered, **Block This Call** applies to the current call. You can review saved decisions in **Settings → Script Permissions → Script Calls**. Python targets follow their own runtime's permissions.

Returns: the value passed from `Script.exit(result)` in the target script.

```ts
const result = await Script.run({
  name: "ProcessData",
  queryParameters: { input: "abc" }
})

console.log(result)
```

For scripts that rely on an existing permission, such as a script that reads Contacts:

```ts
const result = await Script.run({
  name: "FindContact",
  queryParameters: { name: "Alice" }
})
```

Handle denied access in the target so it can still return a useful result. Each nested launch has its own calling script and target. Account, shared data store and system access follow their separate authorization rules.

JavaScript targets started this way cannot use Shell or Python to run code or open `scripting://` URLs through `Safari.openURL()`. `ScriptSession.call()` uses the same saved call decisions. A running service keeps the permissions of its existing instance.

---

### `Script.createRunURLScheme(scriptName, queryParameters?): string`

Creates a `scripting://run` URL to launch and execute a script.

```ts
const url = Script.createRunURLScheme("MyScript", { user: "Alice" })
// "scripting://run/MyScript?user=Alice"
```

---

### `Script.createRunSingleURLScheme(scriptName, queryParameters?): string`

Creates a `scripting://run_single` URL that ensures only one instance of the script runs.

```ts
const url = Script.createRunSingleURLScheme("MyScript", { id: "1" })
// "scripting://run_single/MyScript?id=1"
```

---

### `Script.createOpenURLScheme(scriptName): string`

Creates a `scripting://open` URL to open a script in the editor.

```ts
const url = Script.createOpenURLScheme("MyScript")
// "scripting://open/MyScript"
```

---

### `Script.createDocumentationURLScheme(title?): string`

Generates a URL to open the documentation page in the Scripting app.

* `title`: Optional. If provided, opens a specific documentation topic.

```ts
const url = Script.createDocumentationURLScheme("Widgets")
// "scripting://doc?title=Widgets"
```

---

### `createImportScriptsURLScheme(urls): string`

Generates a URL scheme for importing scripts from the specified URLs.

* `urls: string[]`: An array of URLs to import scripts from.

```ts
const urlScheme = Script.createImportScriptsURLScheme([
  "https://github.com/schl3ck/scripting-app-lib",
  "https://example.com/my-script.zip",
])
// "scripting://import_scripts?urls=..."
```

---

### `hasFullAccess(): boolean`

Determine whether user has full feature access.

Returns: `true` if the user has full feature access, otherwise `false`.

```ts
if (Script.hasFullAccess()) {
  // use features with full access
  Assistant.requestStructedData(...)
}
```

---

## Notes

* Use `Script.exit()` for normal completion. Scripting also releases the instance's resources when an uncaught exception ends an ordinary App script.
* Use `Script.run()` to chain or modularize scripts and retrieve structured results.
* URL schemes can be used in external apps (like Shortcuts) to trigger scripts with parameters.
* `singleMode` is recommended for scripts that must not run in parallel.

## Remote script sources and updates

Configure a remote source in the App's script settings. `Script.metadata.remoteResource` is a read-only view of that configuration; `Script` is a global and needs no import. `hash` is maintained by the App. Do not copy an incomplete `remoteResource` object into `script.json` or manufacture its hash.

Supported source forms include:

| Source | Example URL |
| --- | --- |
| Direct downloadable ZIP archive | `https://example.com/MyScript.zip` |
| GitHub repository, default branch | `https://github.com/owner/repository` |
| GitHub branch/tag/revision | `https://github.com/owner/repository/tree/main` |
| Script subdirectory on that revision | `https://github.com/owner/repository/tree/main/scripts/MyScript` |

Use an archive download URL for a ZIP, rather than the web page displaying a release or file. GitHub links are interpreted by the App; this is not a general-purpose Git/SSH client. Prefer a simple branch name without `/` in this URL format, since the first segment after `tree` is the revision.

The selected script directory must contain `script.json` and its configured entry files. A typical archive is:

```text
script.json
index.tsx
core/
  session.ts
```

One enclosing directory is also accepted when it is the only extracted entry (apart from `__MACOSX` and `.DS_Store`); the App unwraps that **one layer**. For GitHub subdirectory sources, the selected subdirectory is then resolved inside the repository. Avoid extra nesting or multiple unrelated top-level folders.

`autoUpdateInterval` is in **seconds**, with an effective minimum of **1800 seconds (30 minutes)**. For example, `3600` requests hourly checks; `60` is clamped to 1800 rather than checking every minute. An omitted or `null` interval disables scheduled checks for that script. This is a scheduling interval, not a guarantee of execution at an exact time while the App is suspended.

The App's global automatic-update switch controls whether detected changes are applied automatically. When off, eligible scheduled checks can still detect a pending update without replacing script files. Manual checks remain available independently of the script's interval. Keep the remote URL stable and increment the script's version for clear release tracking.


## Camera capture parameters

`Script.cameraControlParameter` contains the initial native capture batch, or null. Later batches arrive in `Script.onResume` under the same field. See [Camera Control](../../camera_control/) for the complete types, file lifetime and runnable index.tsx example.
