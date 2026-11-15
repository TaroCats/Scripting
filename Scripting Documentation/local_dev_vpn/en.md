# VPN and LocalDevVPN

`VPN` is a global in the app, widgets and control widget scripts, Share, Keyboard, Notification, and Translation UI extensions. No import is required. App scripts use the native VPN service, including its existing offline behavior.

Extensions use the same `VPN.*` methods through HTTP. Add an `http-api` declaration to the current configuration, or edit it in **Network → Features → HTTP API**, then connect Scripting’s VPN. HTTP is the default; HTTPS is optional. Built-in calls use the effective address and key automatically. HTTPS verifies the server certificate and never falls back to HTTP. See [HTTP API](../vpn_http_api/) for configuration and external clients.

VPN management methods do not request per-script permission in either the app or extensions. Keyboard calls require Full Access. `VPN.localDevVPN` and RSD retain their separate `localDevVPN` permission.

Call these methods inside an existing widget action or App Intent script. The actual execution host determines the available behavior. Calls running in an extension reject when the HTTP API is disabled or unavailable. `start()`, `stop()`, and `localDevVPN` methods reject with `VPN_HTTP_UNSUPPORTED` there, and `VPN.configuration` is unavailable. App-hosted calls retain the native API, including VPN lifecycle, LocalDevVPN/RSD, and supported configuration sheets. `localDevVPN` remains a separate permission.

Widget timelines run when the system schedules them, so traffic speed is a sampled value. Extensions have system execution limits. Catch rejections and read state before retrying a timed-out change: an accepted change may already have been saved. HTTP errors include `VPN_HTTP_API_DISABLED`, `VPN_HTTP_API_UNAVAILABLE`, `VPN_HTTP_TIMEOUT`, and `VPN_HTTP_FULL_ACCESS_REQUIRED`.

The following app-only example starts **Scripting’s VPN**. When an external VPN already provides reflection, skip it and use the RSD section below.

```ts
import { Script } from "scripting"

async function main() {
  const state = await VPN.start()
  console.log(state.status, state.selectedConfigurationId)
  const granted = await Script.requestAccess(["localDevVPN"])
  if (granted.includes("localDevVPN")) {
    const before = await VPN.localDevVPN.getState()
    await VPN.localDevVPN.setEnabled(true, {expectedState: before.expectedState})
  }
}

void main()
```

`start()` resolves after the owned tunnel is connected. A transitional connecting, reasserting or disconnecting state rejects as busy; read again before retrying. `stop()` resolves after the owned tunnel is disconnected and its stop preferences have been processed. Stop also closes owned RSD sessions. Script exit does not stop an already accepted global VPN operation. A completion timeout can reject while the accepted device operation continues; query state before retrying. Connection status alone does not prove traffic succeeded.

| VPNState field | Meaning |
| --- | --- |
| status / active | Scripting VPN status; active is true only for connected. |
| selectedConfigurationId / selectedConfigurationName | Effective selected Scripting configuration, or null. |
| providerBundleId | Owned VPN provider bundle identifier, or null. |
| effectiveConfigurationId | Actual configuration verified by provider diagnostics, or null if unavailable. |
| operation / problem | Current API starting/stopping operation and reported failure, or null. |

In the main app, `getState()` rejects if it cannot read the saved configuration.

`VPN.localDevVPN.getState()` reads saved device intent and actual reflection state. `setEnabled(enabled, {expectedState?})` changes only intent and retains addresses. Setting it while disconnected keeps the VPN off. The setting survives configuration switches and script exit. Device intent and RSD require the `localDevVPN` permission. A recorded denial is respected; errors retain machine-readable `code`, `reason`, `permission` and `permissionScope` where applicable.

| VPNLocalDevState field | Meaning |
| --- | --- |
| enabled / active | Saved intent / verified active reflection plan. |
| vpnStatus / effectiveStatus | Scripting status / inactive, pending, active, error or unavailable. |
| addresses / resolvedAddresses / effectiveAddresses | Saved addresses / expected composition / verified installed addresses. |
| expectedState | Opaque compare-and-set token; return unchanged to guard a write. |
| profileId / problem | Effective configuration ID / reported problem, or null. |

A stale token rejects without overwriting intent. Omit the token to use the state immediately before the atomic save. Concurrent state changes during sampling reject. A successful save followed by a failed read can reject after saving: read again to reconcile.

## Traffic speed and routing mode

Use `VPN.getTrafficRate()` to sample the current Scripting VPN traffic. It returns `uploadBytesPerSecond` and `downloadBytesPerSecond` for the interval between two tunnel samples. The call waits about 1.25 seconds between samples, plus the time needed to read them. It returns `null` when there are no two usable samples. An idle tunnel with valid samples returns zero rates.

`VPN.getRoutingMode()` reads the saved base mode. `VPN.setRoutingMode(mode)` saves it for the current configuration and returns the saved mode. Use `direct` for direct connections, `global` for global proxy, or `rules` for rule-based routing. Global proxy needs a node in the current configuration. Network conditions may temporarily override this choice.

```ts
await VPN.setRoutingMode("rules")
const rate = await VPN.getTrafficRate()
if (rate) console.log(rate.downloadBytesPerSecond)
```

A widget timeline can display the sampled speed with a timestamp. An authorized widget or control action can call these methods directly.

For a saved shortcut that used **Set Proxy**, replace that action with a Scripting script. Use `VPN.setRoutingMode("direct")` for Off, or pass `"global"` or `"rules"` for the mode you want when turning proxy on.

## Global proxy nodes and policy groups

Lists describe the current configuration. Nodes and members provide `{ id, name }`. Groups provide `{ id, name, members, selectable }`. Use `selectable` to find groups that support manual member selection.

Use node, group, and member IDs from the latest list in the same script run. App scripts and HTTP calls use separate IDs for these items. Extensions use HTTP IDs. Configuration edits can invalidate previous IDs. If a method returns `stale`, reload the list and confirm the target before using its new ID.

```ts
const node = (await VPN.listProxyNodes()).find(item => item.name === "Office")
if (node) await VPN.setRoutingMode("global", { nodeId: node.id })

const group = (await VPN.listPolicyGroups()).find(item => item.name === "Work")
const member = group?.members.find(item => item.name === "Office")
if (group?.selectable && member) await VPN.setPolicyGroupMember(group.id, member.id)
```

Passing a node ID saves the mode and node together, including when the mode is already `global`. An invalid ID leaves both saved values intact. `setPolicyGroupMember(groupId, memberId)` works with manual selection groups. `updatePolicyGroup(groupId, patch)` accepts `hidden`, `category`, `iconURL`, and `noAlert` for editable groups. Omit a field to keep it or pass `null` to clear it. Each method returns the updated group or selected member as `{ id, name }`.

## Reading selections, testing policies, and reading traffic totals

`VPN.getGlobalProxyNode()` reads the selected or default node for global proxy mode. It returns `{ id, name }` or `null` when no node is available. You can read this selection in any routing mode. `VPN.getPolicyGroupSelection(groupId)` reads the selected or default direct member of a manual selection group. It returns `null` when no member is available and rejects with `notSelectable` for automatic groups and filter aliases.

`VPN.testProxyNodes(ids)` accepts up to 128 IDs from the current configuration and collapses duplicates. `VPN.testPolicyGroup(groupId)` tests up to 128 direct members of a group. When a member is another group, the test follows the outlet chosen for that member by the manual test resolver. Standard DIRECT uses the existing direct test. Reject policies and interface-specific direct policies return `skipped`. These methods use the current configuration's test settings. The results are for the script's own decisions, such as displaying measurements or choosing a node.

Each result contains `id`, `name`, `status`, `latencyMs`, and `metric`. Status is `reachable`, `failed`, `unavailable`, or `skipped`. Latency and metric can be `null`. Compare latencies measured with the same metric. A configuration change can reject an in-progress test with `stale`. Read the list again to get current IDs.

```ts
const nodes = await VPN.listProxyNodes()
const results = nodes.length ? await VPN.testProxyNodes(nodes.slice(0, 8).map(node => node.id)) : []
const today = await VPN.getTrafficTotals("today")
```

`VPN.getTrafficTotals()` reads cumulative `uploadedBytes` and `downloadedBytes` for the current Scripting VPN tunnel session. Pass `"today"` to read recorded totals for the current calendar day in the device's time zone. `incomplete` indicates that the recorded total may have gaps. The session result is `null` when a fresh tunnel sample is unavailable. Today's result is `null` when traffic history is disabled or has no record for today.

## Enabling scripts and modules

`VPN.listScripts()` includes standalone Network scripts and scripts declared by modules. Each entry has `{ id, name, status, editable, ownership }`. The `ownership` value is `"standalone"` or `"module"`. A module script also has `moduleId`, which matches its parent in `VPN.listModules()` for the same configuration revision. Standalone scripts omit `moduleId`.

`VPN.listModules()` returns configured and unattached library modules as `{ id, name, status }`. Status is `enabled`, `disabled`, or `unattached`. A module script's status reflects the parent module’s switch.

For a list of scripts that can be toggled individually, filter for `editable: true`. Pass those IDs to `VPN.setScriptsEnabled(ids, enabled)` to change their state. To control a script inside a module, use `VPN.setModulesEnabled(ids, enabled)` with its parent module ID. Remote child modules are read-only. Attach an unattached module to a configuration before enabling it. Each call accepts 1–128 IDs of the corresponding type and saves the batch together. A stale or read-only ID rejects the whole batch.

For a given VPN device, App scripts, extensions, and HTTP clients get the same script and module IDs. They stay the same across script runs and service restarts while the active configuration, its published version, and the item revision stay the same. Refresh the relevant list after changing state or upgrading from a version with session-scoped IDs. If a write returns `stale`, list the items again and confirm the target before retrying.

```ts
const ids = (await VPN.listModules())
  .filter(item => item.status === "enabled" && item.name.startsWith("Work"))
  .map(item => item.id)
if (ids.length) await VPN.setModulesEnabled(ids, false)
```

These methods are available in each supported script environment.

An extension call that rejects with `VPN_HTTP_TIMEOUT` may already have changed the saved state. For example, after a timeout from `VPN.setRewriteEnabled(false)`, call `VPN.getRewriteEnabled()` to check the result before trying again.

Scripts imported through `VPN.configuration.importScript()` are stored in single-script modules. Once attached, use the module list to find and enable them.

## MITM, rewrites, traffic scripts, and capture

Supported script environments can read and set these switches. The methods return the saved boolean value. Each setter accepts `true` or `false`. App scripts can save these switches while the VPN is disconnected; extension calls require the running HTTP service.

| Read | Set | Scope |
| --- | --- | --- |
| `VPN.getMITMEnabled()` | `VPN.setMITMEnabled(enabled)` | Device-wide MITM. Switching from off to on requires a trusted certificate. Handle `certificateSetupRequired` by completing certificate setup in the app. |
| `VPN.getRewriteEnabled()` | `VPN.setRewriteEnabled(enabled)` | Rewrites for the current configuration. Individual rewrite switches keep their saved settings. |
| `VPN.getScriptingEnabled()` | `VPN.setScriptingEnabled(enabled)` | Device-wide Network traffic scripts. Use `setScriptsEnabled(ids, enabled)` to change individual scripts. |
| `VPN.getCaptureEnabled()` | `VPN.setCaptureEnabled(enabled)` | Device-wide traffic capture. Enabling creates a session or keeps the current one. Disabling ends it. |

```ts
const captureEnabled = await VPN.getCaptureEnabled()
if (!captureEnabled) await VPN.setCaptureEnabled(true)
```

Switches take effect as the VPN processes matching traffic. App scripts can use `VPN.start()` to connect separately.

## Managing VPN configurations

`VPN.configuration` is available in development builds when you run a saved script from the app. Each change opens a native confirmation sheet. The resource starts disabled and the current configuration stays selected.

| Method | Input and result |
| --- | --- |
| `importModule(options)` | Pass `text` and optionally `format: "ini" \| "plugin"`. For a module with scripts, pass a `scripts` map from each declared relative path to its JavaScript source. |
| `importScript(options)` | Pass `name` and `source`. The default trigger is manual (`generic`). For `request` and `response`, pass a `urlPattern` and optionally `requiresBody` in `trigger`. You can also pass `argument` and `timeout` in seconds. |
| `attach([resource, …])` | Choose one configuration in the sheet, or create a configuration and attach in the same step. Repeating the association preserves its existing settings. |
| `create({ suggestedName? })` | Create an empty configuration. The name is editable in the sheet. |
| `updateModule(resource, options)` / `updateScript(resource, options)` | Replace an unassociated resource. Pass the full new input in the same form as import. A successful update returns a new reference. |
| `deleteModule(resource)` / `deleteScript(resource)` | Delete an unassociated resource. A disabled association still counts as an association. Remove it in Network before deleting. |

Modules can contain supported offline routing rules and Generic, Request and Response scripts. Package script dependencies with `scripts`. Absolute paths, remote dependencies and unsupported module sections cause the import to fail. Request and Response scripts can read traffic after you enable them in Network. Review the content before enabling an association.

Imports and updates return `{ status: "saved", resource }` or `{ status: "cancelled" }`. Create and attach return the status only. Delete returns `deleted` or `cancelled`. A failed change rejects with an error code. Resource references belong to the script run that received them. Use the new reference after an update. Configuration names, IDs and the existing contents of resources are managed in the app. Repeating the same import within one run reuses the matching resource when it is unchanged. The error codes are `invalidInput`, `resourceUnavailable`, `unavailable` and `busy`.

```ts
const configuration = VPN.configuration
if (configuration) {
  const saved = await configuration.importScript({
    name: "Example response",
    source: "$done({})",
    trigger: { type: "response", urlPattern: "^https://example[.]invalid/" },
  })
  if (saved.status === "saved") {
    await configuration.attach([saved.resource])
  }
}
```

## RSD tunnel

### Reflection and ordinary networking

`VPN.localDevVPN.setEnabled(true)` enables local-device reflection intent. `VPN.start()` starts the **selected full Scripting proxy configuration**, including its routing rules and DNS policy. Reflection does not automatically replace that policy with a reflection-only tunnel or DIRECT networking. Make sure ordinary traffic is allowed by the selected configuration; an isolated test profile that rejects other destinations is unsuitable for geocoding and web requests.

When another app supplies reflection, keep its VPN connected and call `openRSDTunnel` directly. Its own rules and DNS determine ordinary networking; Scripting does not modify them. Scripting's `effectiveStatus: "inactive"` is expected in that case.

`Location.reverseGeocode` uses the system geocoding service. A `kCLErrorDomain` code 2 rejection can mean connectivity problems **or app-level rate limiting**. Cache and coalesce lookups, avoid querying every map-camera update, and avoid rapid retries. Code 8 means no result. Compare a fixed coordinate at a low rate with VPN off, an allowed DIRECT configuration, and the external VPN if applicable. A successful web request alone does not prove the geocoder's backend path is healthy; retain the geocoder result too.

### Open and exchange

`VPN.localDevVPN.openRSDTunnel({host, port, preSharedKey, identity?, mtu?})` requires a reachable reflected numeric IPv4 address, `localDevVPN` permission and a previously obtained 32-byte pairing PSK (`Data`, `Uint8Array` or `ArrayBuffer`). Identity is an optional UTF-8 string of at most 128 bytes. MTU defaults to 16000 and supports 1280–16384. This API opens the CDTunnel transport and bounded private IPv6 TCP connections. It does not discover or pair Apple devices or implement service-specific business commands. An opened tunnel can query its RSD service directory.

The host uses the current system route. An external proxy or wloc may provide the reflection: configure and connect it first, then call this method directly. Do not call `VPN.start()` or require `effectiveStatus === "active"` for this path. `getState()` continues to describe Scripting only; it does not report or control another app's VPN. No preflight connection is made: the actual PSK handshake and service payload prove reachability. A one-use listener must never be probed before opening. Special, loopback, multicast and FakeIP addresses are rejected.

```ts
// VPN is injected globally; no import is required.
// Your pairing workflow supplies a fresh listener port and this session's PSK.
// servicePort and request must follow the protocol of the discovered service.
async function exchangeRSDService({host, port, preSharedKey, servicePort, request}: {
  host: string; port: number; preSharedKey: Uint8Array;
  servicePort: number; request: Uint8Array;
}): Promise<Uint8Array | null> {
  const tunnel = await VPN.localDevVPN.openRSDTunnel({host, port, preSharedKey})
  try {
    const connection = await tunnel.connect({port: servicePort})
    try {
      await connection.write(request)
      return await connection.read(16384) // A chunk, or null for peer EOF
    } finally { await connection.close() }
  } finally { await tunnel.close() }
}
```

One native tunnel can be shared by up to 16 live or releasing handles, with at most four connections in total (including pending opens). Each read/write is bounded to 16384 bytes, with one pending read and one pending write per connection. Read maximum must be 1–16384; an idle read times out after 120 seconds. Stream methods require the original active script context. Script exit and explicit close release only the owning handle and its connections. Sessions bound to a verified Scripting reflection also close on Scripting VPN stop and relevant local-device/configuration changes. External-route sessions remain independent of those settings; actual transport failures are reported by the session. Closing a handle waits for its own cleanup; the native tunnel is reclaimed after the last handle releases and child cleanup completes. Closing an old handle cannot close a replacement. A failed transport can still supply already verified buffered bytes before reporting failure. `getState()` reports negotiated addresses, MTU, RSD port, lifecycle state and bounded buffer counts. Keep session handles and close them when finished.

Each VPN state/start/stop method allows one pending request of its own kind. State reads and stop remain available while start is pending. A tunnel allows up to four pending connect requests; tunnel state/close and connection end/close each allow one pending request of their own kind. Await completion before issuing another request of the same kind.

## Migration

The standalone `LocalDevVPN` global has been removed. Replace `LocalDevVPN.getState()` and `LocalDevVPN.setEnabled(...)` with `VPN.localDevVPN.getState()` and `VPN.localDevVPN.setEnabled(...)`. Remove imports of these APIs from `scripting`; use the global declarations in the latest documentation and SDK. Device intent and RSD retain the `localDevVPN` permission. VPN lifecycle methods do not request script permission.


## RSD lifecycle diagnostics

`await tunnel.getState()` includes `closedReason` for explicit lifecycle cleanup and `terminalError` for the **first underlying terminal failure**, or `null` if none. Explicit cleanup does not erase an earlier terminal failure. `terminalError` contains `code`, `stage`, `nativeDomain`, `nativeCode`, and optional `networkErrorCategory` (string) / `networkErrorCode` (number) details. RSD promise errors carry the same diagnostic fields; a closed-session rejection also carries `closedReason`. Permission errors retain their existing permission fields.

Common codes are `RSD_SESSION_CLOSED`, `RSD_STREAM_CLOSED`, `RSD_TRANSPORT_EOF`, `RSD_TRANSPORT_TIMEOUT`, `RSD_TCP_TIMEOUT`, `RSD_PEER_RESET`, `RSD_NETWORK_FAILURE`, `RSD_PROTOCOL_ERROR`, and `RSD_CANCELLED`. The numeric NSError code alone (including 0) does not identify an iOS termination or suspension. A single TCP reset can leave the tunnel usable; inspect both the operation error and tunnel state. Keep-alive state does not replace this check.

```ts
// VPN is global; tunnel is the VPNRSDTunnel returned by openRSDTunnel above.
async function inspectTunnel(tunnel: VPNRSDTunnel) {
  const state = await tunnel.getState()
  console.log(state.state, state.closedReason, state.terminalError)
}
```

## Handling access errors

Network operations check access before starting and may throw or reject with `error.code === "ERR_PRO_REQUIRED"`. Attach socket/server error handlers before connecting or listening, and catch promises from Bonjour and VPN APIs. Keep cleanup in `finally`: closing sockets and RSD sessions, stopping Bonjour resources, `VPN.stop()` and disabling `VPN.localDevVPN` remain available after access expires.

## Opening deadline and cancellation

`openRSDTunnel({...options, timeout:5000})` adds a deadline in milliseconds (integer 100...120000), from authorization completion through old-cleanup waiting, route sampling, TLS and session publication. Permission-dialog time is excluded. Omit it to retain existing policy, including the transport's 10-second startup timer. A deadline rejects with `RSD_OPEN_TIMEOUT` / `TimeoutError`.

`await VPN.localDevVPN.cancelRSDTunnelOpening()` cancels only this context's pending open or attach and waits for native cleanup. It does not close an established tunnel; use `tunnel.close()`. The open rejects with `RSD_CANCELLED` / `AbortError`. If a script permission dialog is awaiting the user, cancellation prevents transport admission but completion waits for that dialog to finish. Cleanup remains available after access expires. Always create a fresh pairing listener before retrying.

A deadline initiates cancellation; rejection follows the required native cleanup, which can add time.

## Shared handles and closing by port

If another script A provides an `ensureTunnel` service using global `ScriptSession.serve`, callers can request preparation and then acquire their own handle. A must return from its service callback while keeping its own handle alive; `Script.exit(result)` would release A's resources. The service command is implemented by A, not a built-in VPN command.

```ts
// ScriptSession and VPN are globals; no import is required.
async function usePreparedTunnel<T>(use: (tunnel: VPNRSDTunnel) => Promise<T>): Promise<T> {
  await ScriptSession.call({ name: "A", message: { command: "ensureTunnel" }, timeout: 180000 })
  const tunnel = await VPN.localDevVPN.attachRSDTunnel()
  if (!tunnel) throw Error("The prepared tunnel is no longer available")
  try { return await use(tunnel) }
  finally { await tunnel.close() }
}
```

Service replies are JSON status, not transferable tunnel handles or pairing secrets. The recipient still obtains its own device-access authorization. If A should exit after handing over, attach successfully before acknowledging the handover to A.

A recipient script can call `VPN.localDevVPN.attachRSDTunnel()` to acquire its own handle to Scripting’s ready native tunnel, without receiving pairing credentials or opening parameters. Each recipient independently requests `localDevVPN` permission. It returns `null` when no native tunnel is ready (including an opening or closing tunnel); denied access or an invalid transport rejects. It never opens a new tunnel. Keep the creator’s handle alive until the recipient has attached. Once attached, either script can close or exit without closing the other’s handle; the final release reclaims the native tunnel.

Sharing is limited to the main App process, not extensions or another app’s in-memory tunnel. An external VPN may supply reflection, but a Scripting script must first open the native RSD tunnel. No handles or pairing secrets are transferred between scripts. `attachRSDTunnel()` has a 30-second deadline after authorization; `cancelRSDTunnelOpening()` also cancels this context’s pending attach. Open and attach share one pending-acquisition slot per context.

```ts
// All APIs and types below are global; no import is needed.
async function querySharedDevice(): Promise<DeviceServices.PlistValue | null> {
  const tunnel = await VPN.localDevVPN.attachRSDTunnel()
  if (!tunnel) return null // Ask the creator workflow to open a tunnel first.
  let session: DeviceServices.RSDSession | undefined
  try {
    session = await DeviceServices.openRSDSession(tunnel)
    const service = await session.openService({
      serviceName: "com.apple.mobile.diagnostics_relay.shim.remote",
    })
    await service.connection.writePlist({ Request: "IORegistry", EntryClass: "IOPMPowerSource" })
    return await service.connection.readPlist()
  } finally {
    await session?.close()
    await tunnel.close()
  }
}
```

The existing matching-parameters `openRSDTunnel` path remains supported. Matching requires the same outer host/port, negotiated `preSharedKey` bytes, identity and requested MTU, not merely the same saved pairing record or inner service port. Mismatched options or route/security bindings reject instead of replacing an existing user’s tunnel.

```ts
async function closeOwnedPort(tunnel: VPNRSDTunnel, port: number) {
  await tunnel.closeConnections({ port })
  // The handle stays open. A subsequent connect creates a new independent stream.
}
```

This closes only this handle's connections to that port, including matching opens already pending when the close is applied. It never closes another handle's connections, even at the same port. Use `connection.close()` for one specific stream. Closing a parent handle also closes its streams adopted by DeviceServices/AFC. Merely having zero connections does not release a still-owned handle. RSD cleanup does not stop an external VPN or a Scripting VPN used by other features.

**Behavior change:** `tunnel.close()` now releases this handle instead of forcibly disconnecting every user of a shared native tunnel. Existing single-handle scripts keep the same cleanup effect. Scripts that depended on global disconnection must instead close each handle they own; the RSD handle API has no cross-owner force-close operation. App-wide VPN stops and security-binding changes can still invalidate all affected shared handles. See this documentation and the latest SDK for the updated lifecycle. `getState()` connection and buffer counts are scoped to the receiving handle.

## RSD service directory

`VPN` and `VPNRSDTunnel` are globals, with no import required. On an opened tunnel, `listServices()` queries and caches the advertised service directory. Each result has `name`, `port`, `usesRemoteXPC` and `entitlement` (a string or `null`, describing the device-advertised entitlement). This metadata does not grant device privileges.

```ts
async function findServices(tunnel: VPNRSDTunnel) {
  const services = await tunnel.listServices()
  const instruments = await tunnel.resolveService({
    serviceName: "com.apple.instruments.dtservicehub",
  })
  return { services, instruments }
}

async function withRawInstruments<T>(
  tunnel: VPNRSDTunnel,
  use: (connection: VPNRSDConnection) => Promise<T>,
): Promise<T> {
  const connection = await tunnel.connect({
    serviceName: "com.apple.instruments.dtservicehub",
    timeout: 30000,
  })
  try {
    return await use(connection) // Your DTX implementation; no automatic plist check-in.
  } finally {
    await connection.close()
  }
}
```

Names match exactly; aliases and guessed ports are not used. `connect` accepts either `port` or `serviceName`, never both, and returns the same raw byte connection. `timeout` is the total lookup/connection deadline, 1–300000 milliseconds, default 30000. `resolveService` resolves a name without connecting to its service; missing names reject with `RSD_SERVICE_NOT_FOUND`.

The shared native tunnel owns the directory snapshot. `listServices({ refresh: true })` replaces it; a new tunnel starts with an empty cache. Existing service connections keep their own streams. Returned metadata is detached from the native cache. Lookup failures do not cache a permanent failure or replay service requests. Directory lookups temporarily consume one of the existing four connection slots; full capacity rejects with `RSD_QUOTA`. `listServices` and `resolveService` share a limit of 16 pending calls per handle. All lookup callers, including service opens, share a 64-waiter limit on the native tunnel. Timing out a request or closing its handle does not cancel other waiters. Service-specific protocols, including DTX and RemoteXPC business messages, remain script responsibilities.

## Native Data input and stream methods

`Data` is the injected Scripting binary object; no import is required. `preSharedKey` accepts `Data | Uint8Array | ArrayBuffer` and must contain exactly 32 bytes. Both `write` and `writeData` snapshot the bytes at admission, so later mutation of the input cannot change the submitted operation. `writeData` accepts only native `Data`; `write` accepts all three representations. Writes remain limited to 16384 bytes per call, including the new method. Empty writes do not signal EOF; use `end()` for FIN.

`readData(maximum?)` returns a native `Data` chunk or `null` for peer EOF; it does not read a complete protocol message. `read` keeps returning `Uint8Array | null`. Both default to 16384 bytes, accept integer maximums from 1 to 16384, and share one pending-read slot. `write` and `writeData` share one pending-write slot. Mixing the method names cannot bypass concurrency limits. Errors reject, rather than returning `null`. Adoption and close invalidate both method families.

```ts
// VPN, Data and VPNRSDTunnel are globals. This uses a caller-owned opened tunnel.
async function exchangeNativeData(tunnel: VPNRSDTunnel, port: number, body: Data): Promise<Data | null> {
  const connection = await tunnel.connect({ port })
  try {
    await connection.writeData(body) // body.size must be <= 16384
    return await connection.readData(16384) // A chunk, not a whole framed response
  } finally {
    await connection.close()
  }
}
```
