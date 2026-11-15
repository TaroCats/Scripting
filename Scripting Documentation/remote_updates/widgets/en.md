# Widget remote updates

## Connect and authorize a widget

1. Connect the receiving device in Scripting → Remote Push.
2. Run `await Widget.remoteUpdates.enable()` from that script in the app, or authorize it in Remote Updates management. Accept the script authorization prompt.
3. Add one of Scripting's existing widgets to the Home Screen. Select this script, set its parameter, and turn on **Remote Updates** in that configuration. There is no separate remote-update widget kind.
4. WidgetKit supplies the token/configuration association. Native code registers the target; an enabled configuration can remain `pending` while this completes.
5. Render from the injected snapshot in `widget.tsx`; submit changes from an app script or your server.

Do not call `enable`, account recovery, token registration or sending APIs inside `widget.tsx`. Preview rendering does not register a target. The entry script does not need to stay running after preparation.

```tsx
// widget.tsx
import { Text, VStack, Widget } from "scripting"

type WeatherState = { temperature: number }
const snapshot = Widget.remoteUpdates.getState<WeatherState>()
const temperature = snapshot?.hasState && snapshot.state != null
  && typeof snapshot.state.temperature === "number"
  ? snapshot.state.temperature : null

Widget.present(
  <VStack>
    <Text>{Widget.parameter || "Default location"}</Text>
    <Text>{temperature === null ? "Waiting for data" : `${temperature}°`}</Text>
    {snapshot?.isStale ? <Text>Cached data</Text> : null}
  </VStack>
)
```

### Parameters and target identity

The selector `{ parameter: "" }` selects this script's target on the current installation for a widget with no parameter. An absent system parameter becomes `""`; `" "`, `"null"`, case and JSON text formatting remain distinct. Values are not trimmed or parsed.

Different parameters create different targets. Multiple placements or sizes with the same script and parameter on one installation share one state target. A target identifies a logical configuration, not a physical Home Screen slot. Another device has a different target ID even when the script and parameter match.

Use `Widget.remoteUpdates.getTarget({ parameter })` in the app, `getTarget()` in widget rendering, or `listTargets()` in the app. To send to another authorized device, use its explicit `targetId`. A parameter selector never silently broadcasts to other devices.

```tsx
// widget_update.tsx
import { RemotePush, Widget } from "scripting"

// Run in the app, after authorizing this script and adding its widget.
const parameter = "" // The exact configured parameter; no parameter means "".
const snapshot = await Widget.remoteUpdates.getSnapshot({ parameter })
const request = {
  selector: { parameter },
  state: { temperature: 24 },
  expectedRevision: snapshot.revision,
  idempotencyKey: "weather-observation-1042",
  sourceVersion: 1042,
}
const receipt = await RemotePush.widgets.update(request)
console.log(receipt.targetId, receipt.revision, receipt.operation.status)
// A transport retry reuses this same request, including its idempotencyKey.
```

Save the sender example as an app entry such as `index.tsx` when running it. Replace the business observation ID for a genuinely new event; reusing the same key with different content returns `IDEMPOTENCY_CONFLICT`.

`getState<T>()` is synchronous and returns `null` when no managed snapshot is available. A snapshot is `{ targetId, hasState, state, revision, isStale? }`. `hasState: false` means no state has been committed; `hasState: true, state: null` is an explicitly committed JSON null. `isStale` marks cached data after a refresh failure. A TypeScript generic does not validate incoming business data at runtime.

`RemotePush.widgets.update` commits full JSON state and queues a reload signal. `RemotePush.widgets.reload` only queues a signal; it does not create new state. With reload-only use, keep your existing widget data-loading logic. WidgetKit may reload multiple timelines, and budgets delivery opportunistically; a successful request cannot promise an immediate screen change.


## Sending options

`update` takes `targetId` or `selector: { parameter }`, `state`, `expectedRevision`, `idempotencyKey`, and optional `sourceVersion` / `expiresAt`. `reload` takes the same address, `idempotencyKey` and optional `expiresAt`.

State replaces the entire JSON value, up to 16 KiB and depth 32. Use finite numbers, strings, booleans, null, arrays and plain objects. Convert dates to strings. `updateMany` takes 1–50 explicit requests and returns a separate result for each; it is not a cross-device transaction.

## Setup and recovery

In Remote Updates, choose **Authorize Widget Script**, search for the script and confirm. It appears under **Authorized Widget Scripts** immediately. Then add a Home Screen widget, select that script and parameter, enable Remote Updates and return to refresh. A target appears once configuration is registered; token registration may still be pending. Authorization does not add a widget automatically.

Renaming preserves script identity; copying or recreating a script requires authorization again. Removing a widget disables its configuration. Revocation cannot be undone by an old callback; explicit reauthorization creates a new target ID. Update external sender permissions to match.

On `VERSION_CONFLICT`, read the current snapshot and decide whether to apply the business change. On a timeout, retry the same saved request and idempotency key. A new event needs a new key. Daily quota and operation statuses are described in the [overview](scripting://doc?title=Remote%20Updates%20Overview).
