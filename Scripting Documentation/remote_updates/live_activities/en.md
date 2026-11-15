# Live Activity remote updates

## Prepare the Live Activity renderer

Define the renderer in `live_activity.tsx` using `LiveActivity.register` and export its factory. Prepare a remote start with `createDeliveryActivity().prepareRemoteStart(...)`.

Preparation compiles and freezes the reachable renderer modules and explicitly declared resources on the receiving device. Pushes carry JSON data, not JavaScript. The device must already have the exact `templateVersion`; a push cannot download and authorize a missing template.

Source scripts can remain in iCloud. Preparation runs in the app and saves the frozen package and verified rendering identity on this device. The Live Activity extension renders from that package without reading iCloud or the source directory. During remote rendering, `Script.directory` points to the frozen package; use `LiveActivity.resourcePath` for declared assets.

Keep the renderer synchronous and deterministic from state and prepared assets. It cannot depend on an app script's variables, network calls, credentials or mutable files. Static local module imports are supported; dynamic module lookup and native-dependent packages are rejected during preparation. `sampleState` checks one example and does not prove all future states can render.

<!-- example: live_activity.tsx -->
```tsx
// live_activity.tsx
import {
  LiveActivity, LiveActivityUI,
  LiveActivityUIExpandedCenter, Text,
} from "scripting"

export type DeliveryState = { message: string }
export const createDeliveryActivity = LiveActivity.register<DeliveryState>(
  "Delivery",
  state => (
    <LiveActivityUI
      content={<Text>{state.message}</Text>}
      compactLeading={<Text>Delivery</Text>}
      compactTrailing={<Text>…</Text>}
      minimal={<Text>📦</Text>}
    >
      <LiveActivityUIExpandedCenter>
        <Text>{state.message}</Text>
      </LiveActivityUIExpandedCenter>
    </LiveActivityUI>
  )
)
```

## Start locally, then update remotely

Opt in with `remoteUpdates: true`. Local start reserves one backend instance before requesting a push-capable ActivityKit activity. `start()` returning `true` means local creation succeeded; it does not mean the remote update token has arrived.

`activity.remoteUpdates.getTarget()` reports readiness. `waitUntilReady` defaults to 15 seconds, accepts 0–60,000 milliseconds, and can throw `TOKEN_PENDING`. This does not cancel or restart the activity. Keep the native `activityId` if you need to reconnect using `LiveActivity.from<DeliveryState>(activityId, "Delivery")` in a later run with the builder registered.

<!-- example: local_activity.tsx -->
```tsx
// local_activity.tsx
import { createDeliveryActivity } from "./live_activity"

// Run in the app. This file starts one business activity, once.
const activity = createDeliveryActivity()
const started = await activity.start({ message: "Preparing" }, {
  remoteUpdates: true,
  businessKey: "delivery:42",
  businessGeneration: "1",
  idempotencyKey: "delivery:42:start:1",
})
if (!started) throw new Error("Activity was not created")
console.log("Native activity ID:", activity.activityId)

// A timeout only means the update token is not ready yet. Do not start again.
const target = await activity.remoteUpdates.waitUntilReady({ timeoutMs: 15000 })
if (target.status !== "ready") throw new Error(`Target is ${target.status}`)
const snapshot = await activity.remoteUpdates.getSnapshot()
await activity.update({ message: "On the way" }, {
  expectedRevision: snapshot.revision,
  idempotencyKey: "delivery:42:update:1",
})
console.log("Remote target ID:", target.targetId)
// Later, await activity.end() to end locally with its last valid state.
```

For a remote-managed activity, `activity.update` submits through the server's revision order and APNs. It does not also perform a competing native local update. Read a snapshot, pass `expectedRevision`, and use a stable `idempotencyKey`. Offline updates fail instead of silently becoming a second writer.

`activity.end()` ends the local instance without waiting for the network, using its last state, and retains cleanup for later synchronization. For a remotely started instance on another device, use `RemotePush.liveActivities.end({ targetId, idempotencyKey })`; that request needs network access. Existing activities started without the opt-in keep their local behavior.

## Start from your server

Create one script containing the `live_activity.tsx` above and this `index.tsx`. Run it in the receiving app, accept the script authorization, and allow Live Activities if iOS asks. Preparation does not start an activity. Save `startTargetId` and `templateVersion` from the output; wait for `status: "ready"` before requesting a remote start. If the token is pending, keep the same script and run preparation again later.

<!-- example: index.tsx -->
```tsx
// index.tsx
import { Script } from "scripting"
import { createDeliveryActivity } from "./live_activity"

async function main() {
  try {
    const prepared = await createDeliveryActivity().prepareRemoteStart({
      sampleState: { message: "Preparing" },
    })
    console.log(JSON.stringify(prepared, null, 2))
  } catch (error) {
    console.error(error)
  } finally {
    Script.exit()
  }
}
main()
```

Create a scoped sender credential with your master key using `POST /v1/remote-updates/sender-keys`. Supply `targets: [startTargetId]`, `created_from: [startTargetId]`, actions `activities:start`, `activities:read-state`, `activities:update`, `activities:end`, and a stable `idempotency_key`. Store the returned `credential` securely. A start-only credential cannot update the resulting activity; `created_from` covers only instances created by that same credential. Master keys only support metadata and no-new-state end cleanup; legacy child keys cannot use this protocol.
Remote start requires an alert. If a start outcome is `unknown`, it may already have reached APNs: reconcile that same launch instead of generating a new request. A business key and generation prevent competing local/remote starts for the same business instance. A genuinely new business lifecycle needs a deliberate new generation.

The same actions are available from an authorized app script through imported `RemotePush.liveActivities.start/update/end/getSnapshot/listTargets`. JS options use camelCase and `Date`; HTTP bodies use snake_case and UTC ISO 8601 strings. For example, JS `expiresAt: new Date(...)` becomes HTTP `expires_at: "2026-10-18T13:00:00.000Z"`. Dates inside business `state` must be explicitly converted to strings.


## Options

- `start`: `startTargetId`, `templateVersion`, `state`, `alert`, `idempotencyKey`; optional `businessKey`, `businessGeneration`, `expiresAt`.
- `update`: `targetId`, `state`, `expectedRevision`, `idempotencyKey`; optional `sourceVersion`, `staleAt`, `relevanceScore`, `priority`, `alert`, `expiresAt`.
- `end`: `targetId`, `idempotencyKey`; optional `state`, `expectedRevision`, `dismissAt`, `expiresAt`. A new final state requires `expectedRevision`.

## Assets and state schema

For bitmap assets, declare source-relative files in `prepareRemoteStart({ resources: ["icon.png"], sampleState })`. Inside the remote Live Activity builder, `LiveActivity.resourcePath("icon.png")` returns the pinned asset path for `Image.filePath`. The resource path is available only inside remote rendering. It rejects absolute paths and traversal. Resources must be explicitly prepared before use; replacing the original file later does not mutate a running activity's pinned package.

Remote renderers use static Widget-compatible UI. App-only WebView, video/camera views, callback-driven Canvas, SVG, remote image URLs, network APIs, FileManager, Keychain and Data are unavailable. Use SF Symbols or explicitly prepared bitmap files, normal text/layout/shapes and JSON state. Unsupported UI/resources fail preparation with sample state, or fall back safely if a later state takes a previously untested branch. A renderer has a bounded view tree, but no promise of an application-controlled JavaScript CPU timeout.

`prepareRemoteStart({ sampleState, resources, schema })` optionally pins a business-state schema into the renderer version. Without a schema, state is checked for JSON validity, depth, and size; a TypeScript generic does not validate runtime data. A sample only tests one rendering example. With no sample, preparation only checks builder registration; test representative states yourself.

Supported schema keywords: `type` (one of null, boolean, number, integer, string, array, object), primitive `enum`, `properties`, `required`, boolean `additionalProperties`, `items`, `minItems`, `maxItems`, `minLength`, `maxLength`, `minimum`, `maximum`. They follow JSON Schema meanings: property/item constraints apply only to objects/arrays; add `type` to require a type. Missing properties are optional, extra properties are allowed, and no type is assumed by default. String lengths count Unicode code points. Schema limits are depth 12, 256 nodes, and 128 properties or enum entries per node; the entire start manifest must fit 8 KiB. Remote references, patterns, combinators, default insertion, coercion, and unknown keywords fail with `INVALID_STATE_SCHEMA`. This is a bounded subset, not complete JSON Schema. Invalid state fails with `STATE_SCHEMA_MISMATCH` before committing a start, update, or final state. The renderer independently checks the pinned schema and uses its safe fallback on failure. Schema changes create a new template version; existing activities keep their original renderer and schema.

Remote-managed local `start` honors `staleDate` (Date or milliseconds since epoch) and `relevanceScore` (0 through 1). Its `update` forwards `alert`, `sourceVersion`, `staleDate`, and `relevanceScore` through the service; it never also calls local update. `RemotePush.liveActivities.update` uses `staleAt: Date` and also accepts `relevanceScore`. HTTP dates are UTC ISO 8601; the service produces APNs dates in whole seconds. Local `end()` ends immediately even offline. `dismissTimeInterval` is in seconds: omitted uses the system default, zero or negative removes immediately, positive requests removal after that interval subject to the system four-hour limit. For a cloud-committed final state, use `RemotePush.liveActivities.end` with `state` and `expectedRevision`; local end remains the cleanup path.

Native credential refresh preserves local-start idempotency within the same receiving installation. Explicit disconnect retires that installation, so previously accepted but late starts cannot attach to a new connection. Script renames keep the binding and renderer version for unchanged content. Deleting or replacing a script in the app retires the old binding; retained template bytes alone cannot restore it. An unavailable iCloud file is not treated as deletion. Changes made outside the app require the app to reconcile them; an offline extension cannot detect a cloud deletion immediately.

## Test and diagnose

1. Prepare the two files above, then create the scoped sender described below. Run the start, status, update and end commands in the [HTTP API test](scripting://doc?title=Remote%20Updates%20HTTP%20API), one at a time.
2. Put Scripting in the background. Start should display “Preparing”; update should display “Updated from server” on the Lock Screen and Dynamic Island. End requests immediate removal. Each accepted state delivery uses the shared daily push quota. Check the Lock Screen for any pending system prompt to allow or keep allowing Live Activities. Handle that prompt, then recheck token readiness before update or end; a visible start and a registered update token are separate results.
3. A `ready` target has a registered token. An operation accepted by APNs does not prove that the activity rendered or appeared. If it fails, open Remote Push → Remote Updates and find the activity's Device Snapshot. Copy Rendering Diagnostics includes target, template, revisions and stage codes, without state or keys. A report for an earlier revision does not describe the latest update; an absent report means no device result is available.
4. Check Rendering tests the current activity's pinned template. It can restore missing or damaged package bytes only if the installed source reproduces the exact same version. It does not send a push or force iOS to replace an existing snapshot. After a successful check, send a new update with a new business event. If the old version cannot be rebuilt, prepare the changed script and explicitly start a new activity; do not silently switch the running activity's template. This check runs in the app process; success does not prove Widget rendering or replace its diagnostic report.
5. Rendering reads prepared templates and non-secret authorization records from App Groups, without iCloud or Keychain. After upgrading, open Scripting once to migrate existing authorizations. If no trusted old identity is available, keep the source accessible for preparation. You do not need to replace the master key, reconnect Remote Updates, or restart the device. If the Lock Screen still shows an error, include that code with Rendering Diagnostics.

An ended activity may remain on the Lock Screen for up to four hours under the default system policy. Use Remove Ended Activity on that device, or request end with `dismissAt` set to now, for immediate removal. An end request without new state is cleanup and does not consume push quota.

## Ordering and recovery

Each state-bearing operation sends its own committed snapshot. An explicit Activity alert stays paired with that operation's state; a later update cannot silently replace its message or state. State-only queued updates may coalesce. Explicit alerts keep their order and are not automatically retried, because retrying an uncertain delivery could repeat the alert. An end takes precedence over queued updates. Inspect `operation.supersededBy` when an operation is superseded, and `operation.apnsId` when a transport identifier is available. These optional fields do not prove delivery.

Ending an already ended target without new state returns a cancelled operation with `pendingReason: "already_ended"`; it does not fabricate APNs acceptance. Cleanup after an earlier end request can enqueue another cleanup request with a new idempotency key. A final state is a new write: it requires the current revision and cannot be added after the target has entered its terminal lifecycle. `SOURCE_VERSION_CONFLICT`, `STATE_SCHEMA_MISMATCH`, `PAYLOAD_TOO_LARGE`, and quota errors require inspecting and correcting the request, rather than repeatedly retrying it unchanged.

Local `end()` prioritizes ending the visible Activity even offline. Its optional final local state is best effort; the cleanup request may use the last cloud-committed state. Use `RemotePush.liveActivities.end({ targetId, state, expectedRevision, idempotencyKey })` when the final state must be committed to the service. If a creation definitively fails (`creation_failed`), first confirm that no corresponding Activity exists. A deliberate new attempt needs a new factory instance, a new idempotency key, and a new business generation. Reusing the original instance retains its original creation intent. Never do this for an `unknown` start.

`RemotePush.getCapabilities()` returns supported protocol features and limits; it does not grant authorization. Preparation packages are bounded to 16 MiB, 256 modules, 254 explicit assets, and 512 files. Each script binding retains at most 64 versions and 256 MiB; versions referenced by known Activities or authorizations remain pinned, and unreferenced packages are only eligible for removal after seven days. Local Activity creation also checks the encoded attributes and content state together against the system's 4 KiB budget before reserving a business generation. Keep state small and test representative long text, escaping, and assets.

Server requests and credential setup: [HTTP API](scripting://doc?title=Remote%20Updates%20HTTP%20API). Quota and operation status: [overview](scripting://doc?title=Remote%20Updates%20Overview).
