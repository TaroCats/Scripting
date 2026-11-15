# Remote widget and Live Activity updates

Remote updates carry data to a previously authorized widget configuration or Live Activity. The receiving script defines the UI. Your app script or external server sends JSON state through Scripting's Remote Push service.

Ordinary notification keys and `/push` send alerts; they do not update widgets or Live Activities. This API uses separate target IDs and scoped sender credentials. APNs tokens are managed by native code and are never supplied by scripts.


## How it works

1. Connect Remote Push on the receiving device.
2. Authorize a widget script or prepare a Live Activity renderer.
3. Native code registers system tokens and returns a logical target ID.
4. An app script or external server submits JSON state. The service sends the corresponding APNs signal.

The entry script can exit after setup. WidgetKit and ActivityKit control when the screen changes; APNs acceptance does not confirm display.

## APIs

| API | Purpose |
|---|---|
| `Widget.remoteUpdates` | Authorize widgets, find targets and read state. |
| `LiveActivity` instance `remoteUpdates` | Prepare remote starts and inspect an activity's registration. |
| `RemotePush.widgets` | Update state or request a reload. |
| `RemotePush.liveActivities` | Start, update and end activities. |
| `RemotePush.getCapabilities()` / `getOperation(id)` | Inspect support and transport progress. |

Widget updates require iOS 26 or later. Push-capable local activities require iOS 17; remote starts require iOS 17.2. Check capabilities on the receiving device.

## Daily quota

Remote updates and notifications share the account's daily push quota (UTC). Queued deliveries reserve capacity; APNs acceptance consumes one delivery. Each receiving device counts separately. Coalesced widget signals count once, and internal retries do not double-charge. Definite failures and unsent cancellations release capacity. Uncertain sends remain pending for their delivery day. Ending without new state and revocation are free cleanup operations.

## IDs, states and receipts

| Value | Meaning |
|---|---|
| `targetId` | A widget state target or one Activity instance. Used for update/end. |
| `startTargetId` | A prepared receiver/builder authorized for future starts. Not an Activity instance. |
| `activityId` | The native ActivityKit identifier used by the local `LiveActivity` facade. |
| `launchRequestId` | One creation intent used for reconciliation, including uncertain starts. |
| `templateVersion` | Immutable renderer package version. Existing instances keep their pinned version. |

`RemoteTarget.status` is `ready`, `pending`, `disabled` (with optional reason), or `notConfigured`. Ready means registered for remote operations; it is not a delivery or screen-display confirmation. Ended/ending targets are disabled. Pausing does not end an Activity; resuming does not revive an ended instance. Revocation prevents old grants/callbacks from restoring authority. Explicit reauthorization creates a new scope.

A write returns `{ targetId, revision, stateCommitted, launchRequestId?, operation }`. `stateCommitted` distinguishes durable business state from transport progress. Operation status is `queued`, `dispatching`, `accepted`, `failed`, `unknown`, `superseded`, `cancelled` or `expired`. Use `RemotePush.getOperation(operationId)` to query the invoking script's authorized operation. A later state-only update can supersede an older queued update; an end cancels pending updates.


## Guides

- [Widget remote updates](scripting://doc?title=Widget%20Remote%20Updates)
- [Live Activity remote updates](scripting://doc?title=Live%20Activity%20Remote%20Updates)
- [HTTP API](scripting://doc?title=Remote%20Updates%20HTTP%20API)
