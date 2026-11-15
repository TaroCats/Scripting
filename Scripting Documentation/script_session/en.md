# Script services and main sessions

`ScriptSession` is a global API; no import is needed. Use `serve/call` for requests between scripts in the main App. Use `register/request` for the existing same-script entry and extension workflow below.

## A public script service

Script A can register its only handler in `index.tsx` and finish evaluating its entry normally. It keeps running to handle messages; no unresolved promise, UI or minimization is necessary.

```ts
// Script A: index.tsx. No imports needed.
ScriptSession.serve(async (message, request) => {
  if (!message || typeof message !== "object" || Array.isArray(message)
      || message.command !== "status") {
    throw Error("Unknown command")
  }
  return { running: true, caller: request.caller.name }
})
```

```ts
// Script B: index.tsx. No imports needed.
async function main() {
  const status = await ScriptSession.call<{ running: boolean; caller: string }>({
    name: "A", message: { command: "status" }, timeout: 30000,
  })
  console.log(status.running)
}
void main()
```

Registering with `serve` makes the handler callable by other scripts without a caller list. Validate each command and its input in your handler. `request.id` identifies one invocation; `request.caller.name` and `env` come from the native caller context. For a same-script extension request delivered to this handler through the existing IPC path, `caller.env` is an empty string because that path does not transmit the entry environment. A return value or resolved promise completes only that invocation; it does not exit A or release its resources. `undefined` becomes `null`. Throwing rejects only that invocation.

There is **one handler per script identity**, shared with `register`. Calling `serve` or `register` again throws `SCRIPT_SESSION_BUSY` instead of replacing it. `serve` returns a registration ID; `ScriptSession.unregister(id)` removes that handler without exiting the script. An accepted handler that has not settled must finish before a replacement can register. `Script.exit()` still exits and releases resources.

## Reuse, cold start and deadlines

`call({name,message,timeout?})` targets a JavaScript script in the main App:

- A ready server receives the message without restoring its UI or firing `Script.onResume`. It keeps its own permissions and does not request startup confirmation again.
- An already running script without a server rejects with `SCRIPT_SESSION_SERVER_NOT_REGISTERED`; no duplicate instance is created.
- When no instance is running, Scripting handles startup using the same call decisions as `Script.run()`. An allowed launch lets the new service use its allowed script permissions and request undecided permissions during that instance's lifetime. A launch without script permissions stays restricted for that instance. After starting, the service has up to 10 seconds to call `serve`. Register before lengthy initialization and perform that work in the handler.
- A blocked call rejects with `SCRIPT_INVOCATION_BLOCKED` before it starts a service or reaches a running handler. Blocking a call in **Settings → Script Permissions → Script Calls** also stops that caller's queued requests before they reach the handler.
- `timeout` is the total deadline, including compilation/startup, registration, queueing and the reply. Default: 30000 ms; integer range: 100–300000 ms. A shorter total deadline wins over the registration window. Timing out does not roll back accepted work, exit A, or replay a request.

Concurrent cold calls share the startup and the resulting instance's permissions. Later callers join the same registration window. Blocking the initiating caller still lets another caller proceed under its own call decision. If all waiters leave before confirmation finishes, the startup confirmation is canceled.

Public service handlers execute serially. Each caller receives its own detached JSON reply. Requests/replies support the `ScriptSession.Value` JSON types, up to 64 KiB; functions, BigInt, nonfinite numbers and cycles are rejected. The process shares a 32-pending-request limit, and each caller has at most eight outstanding `call` requests. An executing handler keeps the serial slot even if its caller times out, until it settles or the receiver exits. Avoid circular service calls; direct self-calls reject.

Ordinary opens reuse a serving instance. `Script.run` starts a new instance and waits for its final exit result. `singleMode: true` explicitly restarts the target and closes the old service. Exiting a caller does not stop the receiver. Exiting the receiver rejects pending requests; old requests never move to a replacement instance. Services need system execution time and do not grant background execution or restart after App termination. Cross-script `call` is not available inside extensions or Python scripts; the same-script extension API below remains supported.

Common errors include `SCRIPT_SESSION_SERVER_NOT_REGISTERED`, `SCRIPT_SESSION_START_FAILED`, `SCRIPT_SESSION_CLOSED`, `SCRIPT_SESSION_TIMEOUT`, `SCRIPT_SESSION_HANDLER_FAILED`, `SCRIPT_SESSION_INVALID_DATA`, `SCRIPT_SESSION_BUSY` and `SCRIPT_SESSION_SELF_CALL`.

## Same-script main sessions and extensions

ScriptSession and Storage are global APIs; neither needs an import. A main index.tsx or home_screen_default_ui.tsx registers a receiver. Other entries of the same script can request a reply, including supported App extensions in another process.

For `register/request`, start the main script first. It must still be running and have execution time to handle requests. These two methods do not launch, wake or keep the App alive.

## Main entry: index.tsx

```tsx
import { Navigation, Script, Text } from "scripting"

async function main() {
  // Replace this handler with your own validated application commands.
  const id = ScriptSession.register(async message => {
    return { accepted: true, message }
  })
  Storage.set("mainSessionID", id)
  try {
    await Navigation.present(<Text>Main session is running. Close to unregister.</Text>)
  } finally {
    ScriptSession.unregister(id)
    Storage.remove("mainSessionID")
    Script.exit()
  }
}

void main()
```

## Share extension entry: intent.tsx

Enable text input for this script in its settings and choose to run inside the share extension. Run the main entry, then share text from an App and choose this same script in Scripting's share extension.

```ts
import { Script } from "scripting"

async function main() {
  const id = Storage.get<string>("mainSessionID")
  if (!id) throw new Error("Start the main script first")
  try {
    const reply = await ScriptSession.request(id, { command: "status" }, { timeout: 5000 })
    Script.exit({ type: "text", value: JSON.stringify(reply) })
  } catch (error: any) {
    Script.exit({ type: "text", value: String(error.code ?? error.message) })
  }
}

void main()
```

## App Intent entry: app_intents.tsx

```ts
import { AppIntentManager, AppIntentProtocol } from "scripting"

export const StopMainIntent = AppIntentManager.register({
  name: "StopMainIntent",
  protocol: AppIntentProtocol.LiveActivityIntent,
  perform: async () => {
    const id = Storage.get<string>("mainSessionID")
    if (!id) throw new Error("Start the main script first")
    console.log(await ScriptSession.request(id, { command: "stop" }, { timeout: 5000 }))
  },
})
```

A command name has no built-in effect. Your main handler must implement the operation and return an acknowledgement. Return the reply before unregistering or exiting; otherwise pending requests are rejected.

## Limits and lifecycle

- Only the main App's index/home_screen/camera_control session can register. Extensions can request a reply, but cannot register the main receiver. The extension must have access to Scripting's shared App Group; additional system restrictions of its extension type still apply.
- Each registration returns a fresh ID. IDs target that exact session of the same native script identity. Old IDs never select a replacement session.
- Same-process messages use the existing memory path; cross-process messages use shared storage. Notifications only prompt a check; they do not guarantee delivery time or wake a suspended App. A fallback scan handles missed notification hints while the process can run.
- At most 32 registered sessions and 32 pending requests per process. Input/reply are JSON-compatible, up to 64 KiB each. Handler undefined means a null reply. Functions, symbols, BigInt, nonfinite numbers, undefined fields and cyclic data are rejected.
- Reply timeout defaults to 10000 ms and accepts integer values from 100 to 30000. Expiry includes time spent suspended/asleep. Expired queued commands are discarded on resume. Timeout cannot preempt synchronous JS and does not undo work already accepted by the receiver.
- Unregister/exit removes the receiver and releases its callbacks. Sender exit cleans up pending requests; work already submitted to another process may have been accepted. Late replies are ignored. Missing/stale/unresponsive receivers fail with an explicit error or timeout; receiver restarts do not replay old requests.
- An acknowledgement confirms only what your handler reports. For example, a stop acknowledgement alone does not prove physical location restoration.

Error codes: SCRIPT_SESSION_UNAVAILABLE, SCRIPT_SESSION_NOT_FOUND, SCRIPT_SESSION_BUSY, SCRIPT_SESSION_CLOSED, SCRIPT_SESSION_TIMEOUT, SCRIPT_SESSION_INVALID_DATA, SCRIPT_SESSION_INVALID_HANDLER, SCRIPT_SESSION_HANDLER_FAILED, ERR_PRO_REQUIRED.

A missing target rejects with `SCRIPT_SESSION_SCRIPT_NOT_FOUND`. An existing target with invalid metadata, an unsupported entry, or compilation/startup failure rejects with `SCRIPT_SESSION_START_FAILED`. An already running target without a server rejects with `SCRIPT_SESSION_SERVER_NOT_REGISTERED`.


## Per-request caller information

Both `serve` and `register` handlers receive `(message, request)`. `request` contains a frozen `id`, `caller: { name, env }`, and `source` (`"scriptSessionCall"` or `"scriptSessionRequest"`). Each request keeps its own snapshot across `await` and while queued. Existing one-argument handlers continue to work; code inspecting `arguments.length` or collecting all arguments will now see a second argument in `register`.

```ts
// Global API: no import required.
ScriptSession.register(async (message, request) => {
  console.log(request.caller.name, request.caller.env, request.source)
  return { accepted: true, message }
})
```

Extension requests carry their sender environment. An older extension message without source details keeps an empty `caller.env`; it is not reported as the main entry's environment. These fields do not broaden same-script extension access or enable cross-script `call` from extensions/Python. Caller names are not authorization tokens or an allowlist. Payload fields cannot change host-supplied metadata. Use `request.caller` for the current client; `Script.invocation` only describes the service's initial launch.
