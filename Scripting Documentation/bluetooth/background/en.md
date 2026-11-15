`BluetoothBackground` registers an installed script to process BLE Central events through `bluetooth.tsx` in the main app. Existing `BluetoothCentralManager` and `BluetoothPeripheral` workflows remain unchanged.

## Registration

Create `bluetooth.tsx` using the editor's Add Bluetooth Background Script action. In `index.tsx`, explicitly register the target and any persistent notification subscriptions:

```tsx
const task = await BluetoothBackground.register({
  id: "sensor",
  target: {
    serviceUUIDs: ["180F"],
    localName: "My Sensor",
  },
  subscriptions: [{serviceUUID: "180F", characteristicUUID: "2A19"}],
})
console.log(task.state)
```

Registration requires the foreground main app, permission to access Bluetooth, and permission to run this task in the background. The script and exact npm dependencies must be available locally. The entry is always `bluetooth.tsx`; no `entry` option is accepted. Merely creating the file does not enable background work.

Registration completion means the task is saved. It does not mean a connection or device authentication succeeded. Changes to script sources or dependencies require foreground registration again. Background execution uses the registered package and does not compile or install dependencies.

## Event entry

```tsx
BluetoothBackground.handleEvents(async (event, context) => {
  if (event.type === "gap" || event.type === "disconnected") {
    // Discard incomplete protocol messages and reestablish application state.
    return
  }
  if (event.type !== "ready") return
  const state = await context.session.getState()
  console.log(state.peripheralId)
})
```

Register exactly one handler synchronously while loading the module. `connected` reports the BLE connection; `ready` also indicates that declared subscriptions are established. Each event has `id`, `taskId`, `revision`, `generation`, `sessionEpoch`, `sequence`, `timestamp` (Unix milliseconds), and `peripheralId`. Notification events include `characteristic` and `value` (`Data`). Errors include a machine-readable `code` and a message.

The session provides `getState()`, `readValue(characteristic, options?)`, `writeValue(characteristic, data, writeType, options?)`, `maxWriteValueLength(writeType)`, and `receiveValue(options)`. Characteristic descriptors contain both `serviceUUID` and `characteristicUUID`. Writes use `withResponse` or `withoutResponse`. `timeoutMs` ranges from 1 to 4000 and is also limited by the event's remaining execution budget. Reads of actively subscribed characteristics are rejected to avoid confusing notifications with read responses.

For request/response protocols, obtain `getState().lastSequence` before writing, then await `receiveValue({characteristic, afterSequence, timeoutMs})`. Notifications that arrive before the write completes are buffered. Use each received sequence as the next cursor. A cursor belongs to the current session epoch. Each characteristic allows one pending receiver; a notification delivered to a receiver is not delivered again as a separate event.

`context.checkpoint.read()` and `write(value)` save JSON state up to 64 KiB. Store secrets in Keychain. Do not store commands for automatic replay: a device may execute a command before the app saves its result.

## Task management

- `getCapabilities()` reports platform and authorization information and limitations.
- `list()` and `get(id)` inspect the calling script's tasks.
- `setEnabled(id, false)` stops a task; enabling again requires the foreground app and a valid registered package.
- `unregister(id)` removes the task registration and stops its requests.

More → Automation → Background Bluetooth provides native controls for inspecting, disabling, and unregistering tasks. Exiting `index.tsx` leaves explicitly registered tasks enabled. Renaming, deleting, or replacing a script invalidates its local registration; imported scripts do not inherit registrations or permission.

## Execution and restoration

The operating system schedules Bluetooth work. State Restoration restores native Bluetooth requests; the event entry rebuilds application state in a new JavaScript context. Global variables and timers do not provide persistent state. Keep event handlers short. The application uses a cooperative execution budget, which cannot preempt a synchronous JavaScript loop.

Background code cannot display UI, request new permissions, use audio keep-alive, or create legacy Bluetooth managers. When another existing script uses the same device, the new background task yields. Radio availability, pending requests, system policy, and user actions affect relaunch. Inspect `(await BluetoothBackground.getCapabilities()).limitations`; State Restoration does not guarantee continuous execution or relaunch in every situation.

Pure JavaScript dependencies may use the local module graph and supported compatibility modules such as `buffer`, `util`, and `stream`. Secure random bytes are available through `crypto.getRandomValues`. File, network, and VM modules (`fs`, `http`, `net`, `tls`, `vm`) are unavailable in the background entry; use the session and checkpoint APIs for its Bluetooth work and state. Timers belong only to the current short event execution.
