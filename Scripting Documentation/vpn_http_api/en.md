# VPN HTTP API

Use the API from another app, a command-line tool, or a local network device. Scripting extensions use the same service through the global [VPN JS API](../local_dev_vpn/), with the effective address and key supplied automatically. App scripts continue to use the native VPN service.

## Configure and connect

Add these settings to the current configuration, or edit them in **Network → Features → HTTP API**:

```ini
[General]
http-api = examplekey@127.0.0.1:6171
http-api-tls = false
```

Replace `examplekey` with your own key. The key supports 1–256 visible ASCII characters, excluding whitespace, `@`, commas, semicolons, `#`, `=`, brackets, quotes, and backslashes. The port is 1–65535. Duplicate or invalid declarations are rejected. Omitting `http-api` disables the service; `http-api-tls` defaults to false.

Connect Scripting’s VPN. A valid declaration takes effect automatically while the VPN is running. Configuration switches and updates also update the service; removing the declaration stops it. There is no second enable or apply step. Saving the settings page edits the current configuration. Remote configurations remain read-only: edit their source or duplicate them locally. Enabling the service does not start the VPN.

Use `127.0.0.1` for this device, `0.0.0.0` for local network access, or a specific IPv4 address assigned to this device. For `0.0.0.0`, built-in calls connect to `127.0.0.1`; other clients use the device’s Wi-Fi or Ethernet address. Hostnames and IPv6 listen addresses are not supported.

```sh
curl --http1.1 -H 'X-Key: examplekey' \
  http://127.0.0.1:6171/v1/outbound
```

HTTP transmits the key without encryption. To encrypt connections, set `http-api-tls = true`, export **Share Server Certificate** as `server.pem`, and use HTTPS. The independent server certificate contains `localhost` and the loopback addresses. For a LAN connection, retain its hostname when verifying it:

```sh
curl --http1.1 --cacert server.pem \
  --resolve localhost:6171:192.168.1.20 \
  -H 'Authorization: Bearer examplekey' \
  https://localhost:6171/v1/outbound
```

Replace the example IP, port, and key. Certificate export contains no private key or MITM certificate. Built-in calls pin the server certificate and verify its loopback identity even when using the configured device address. Failed HTTPS requests never downgrade to HTTP.

## Authentication and privacy

Every endpoint requires the same API key, in either `X-Key` or `Authorization: Bearer`. Use only one header. Keys in URLs are rejected. The key permits both reading and control. Changing and saving the key invalidates it for subsequent requests when the updated configuration is published.

VPN management methods do not request per-script permission. Extensions require the configured HTTP service and a running VPN; Keyboard also requires Full Access. `VPN.localDevVPN` and RSD keep their separate access rules and are available only in the app.

Keep configuration exports and API keys private. A normal configuration export includes the declared key; a redacted export omits the HTTP API declaration. API responses contain names, IDs, states, and aggregate measurements. They exclude node addresses and credentials, subscription URLs, configuration text, file paths, traffic contents, and private keys. There are no HTTP endpoints to manage keys, start/stop the VPN, show sheets, execute scripts, or install certificates. Browser-origin and CORS requests are rejected.

## Requests and responses

Use GET for reads and POST with `Content-Type: application/json` for changes. Success uses status 200 and JSON. Unsupported parameters and extra fields are rejected. A selector accepts either a name or an ID. Names match exactly in the current configuration. Missing or ambiguous names reject.

Use node, group, and member IDs from the latest relevant list. Configuration edits or a service restart can invalidate these IDs. Extension calls use HTTP IDs. App scripts use node, group, and member IDs from their own script context.

For a given VPN device, HTTP clients, App scripts, and extensions get the same script and module IDs. They stay the same across script runs and service restarts while the active configuration, its published version, and the item revision stay the same. Refresh the relevant list after a write or an upgrade from a version with session-scoped IDs. After `stale`, fetch the list again and confirm the target before retrying.

| Routing mode | HTTP `mode` | JS `VPN.setRoutingMode` |
| --- | --- | --- |
| Rules | `rule` | `rules` |
| Global proxy | `proxy` | `global` |
| Direct | `direct` | `direct` |

| Request | Input | JSON response |
| --- | --- | --- |
| GET `/v1/status` | — | `status`, `active`, selected configuration ID/name, `providerBundleId`, `effectiveConfigurationId`, `operation`, `problem`. |
| GET `/v1/traffic/rate` | — | `{uploadBytesPerSecond, downloadBytesPerSecond}` or `null` without usable samples. The request waits about 1.25 seconds between samples. Valid idle samples return zero. |
| GET `/v1/traffic/totals` | Optional `period=session` (default) or `today`. | `{uploadedBytes, downloadedBytes, incomplete}` or `null`. Today uses the device calendar/time zone. |
| GET `/v1/outbound` | — | `{mode}`: `direct`, `proxy` (global), or `rule`. |
| POST `/v1/outbound` | `{mode, policy?}` or `{mode, nodeId?}`; a node is allowed only with `proxy`. | `{mode}`; saves mode and optional selection together. |
| GET `/v1/outbound/global` | — | `{policy: name|null, id: ID|null}` in every routing mode. |
| POST `/v1/outbound/global` | `{policy: name}` or `{nodeId}`. | `{policy, id}`; changes the global node while retaining the routing mode. |
| GET `/v1/policies` | — | `{proxies: [{id, name}]}`. |
| POST `/v1/policies/test` | `{policy_names: [name, …]}` or `{ids: [ID, …]}`; 1–128 nodes. | Probe result array; test settings come from the configuration. |
| GET `/v1/policy_groups` | — | `{policy_groups: [{id, name, selectable, members: [{id, name}]}]}`. |
| GET `/v1/policy_groups/select` | Query `group_name` or `groupId`. | `{policy: name|null, id: ID|null}` for manual selection groups. |
| POST `/v1/policy_groups/select` | `{group_name, policy}` or ID selectors `groupId`, `memberId`. | `{policy, id}` for the saved direct member. |
| POST `/v1/policy_groups/update` | `group_name` or `groupId`, plus `patch`. | Updated group `{id, name}`. |
| POST `/v1/policy_groups/test` | `{group_name}` or `{groupId}`. | `{available: [reachable name], results: [probe result]}` for up to 128 direct members. |
| GET `/v1/scripting` | — | `[{id, name, status, editable, ownership, moduleId?}]`. |
| POST `/v1/scripting` | `{ids: [ID, …], enabled: boolean}`; 1–128. | `null`; one atomic batch for standalone Network scripts. |
| GET `/v1/modules` | — | `{enabled: [name], available: [name], modules: [{id, name, status}]}`. `available` lists configured modules; it does not report download or probe success. |
| POST `/v1/modules` | `{name: boolean, …}`, or `{ids: [ID, …], enabled: boolean}`; 1–128. | `null`; validates the whole batch before one atomic save. |
| GET/POST `/v1/features/mitm` | POST: `{enabled: boolean}`. | `{enabled}`; enabling requires an already trusted MITM certificate. |
| GET/POST `/v1/features/rewrite` | POST: `{enabled: boolean}`. | `{enabled}` for current-configuration rewrites. |
| GET/POST `/v1/features/scripting` | POST: `{enabled: boolean}`. | `{enabled}` for the device-wide traffic script switch. |
| GET/POST `/v1/features/capture` | POST: `{enabled: boolean}`. | `{enabled}` for new capture recording. |

A group with `selectable: true` supports manual member selection. Group patches accept `hidden`, `category`, `iconURL`, and `noAlert`. Use `null` to clear a field.

The script list includes standalone Network scripts and scripts declared by modules. The `ownership` value is `"standalone"` or `"module"`. A module script's `moduleId` matches the parent in `GET /v1/modules` for the same configuration revision. Standalone scripts omit `moduleId`. Content status is `enabled`, `disabled`, or `unattached`. Filter for `editable: true` to find scripts you can toggle individually. For a module's script, control the parent module. Remote child modules are read-only. A batch with a read-only or stale script ID is rejected in full. Attach a library module to the configuration before enabling it. Module changes also apply as a single batch.

```sh
curl --http1.1 -H 'X-Key: examplekey' -H 'Content-Type: application/json' \
  -d '{"Module A":true,"Module B":false}' \
  http://127.0.0.1:6171/v1/modules

curl --http1.1 -H 'X-Key: examplekey' -H 'Content-Type: application/json' \
  -d '{"mode":"proxy","policy":"Node A"}' \
  http://127.0.0.1:6171/v1/outbound

curl --http1.1 -H 'X-Key: examplekey' -H 'Content-Type: application/json' \
  -d '{"group_name":"Proxy","policy":"Node A"}' \
  http://127.0.0.1:6171/v1/policy_groups/select
```

Each probe result contains `{id, name, status, latencyMs, metric}`. Status is `reachable`, `failed`, `unavailable`, or `skipped`. Latency is in milliseconds or `null`; metrics are `warm_http_response_head`, `warm_https_response_head`, or `cold_http_response_head_fallback`. A successful probe is independent of the current group selection.

## Errors and limits

An HTTP error uses `{error:{code,message}}`. Handle `code` and treat `message` as descriptive text.

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `invalidRequest` | Invalid HTTP framing, method, or JSON. Includes multiple authentication headers and keys in URLs. |
| 400 | `invalidInput` | Invalid endpoint parameters, fields, or selector values. |
| 403 | `accessDenied` | Missing or incorrect key, or the listener no longer authorizes the request. |
| 403 | `readOnly` | The requested content does not support this edit. |
| 404 | `unsupported` | Unknown endpoint. |
| 409 | `stale`, `busy`, `notSelectable` | Expired reference, probe already running, or group without manual selection. |
| 413 | `requestTooLarge` | HTTP framing size limit exceeded. |
| 500 | `invalidResponse` | Invalid response generated by the server. |
| 503 | `unavailable`, `writeFailed`, `conflict`, and other operation errors | The operation could not complete. Read the code for the cause. |

Earlier versions may omit `editable` and `selectable`, return `400 invalidRequest` for a missing key, or return 503 for `readOnly` and `notSelectable`. Extension JS calls reject their Promise on errors, including timeouts and Full Access restrictions. If the service is stopped, the client receives a connection error.

Requests use HTTP/1.1 and one request per connection. Keep headers below 16 KiB, POST bodies below 64 KiB, and batches at 128 items or fewer. Responses are capped at 1 MiB; at most eight server requests are active. Pipelining, chunked requests, WebSocket upgrades, redirects, and browser-origin access are unsupported.

In local testing, sequential `GET /v1/traffic/rate` requests took about 1.4 seconds each. When setting a client timeout, allow time for the sampling interval, sample reads, and request handling.

A write can take effect before a timeout or cancellation. For example, if `POST /v1/features/rewrite` with `{"enabled":false}` times out, read `GET /v1/features/rewrite` first. If it already returns `{"enabled":false}`, the desired state is set. Otherwise, decide whether to try again and refresh any IDs the write needs. Probe request time includes setup and execution. Compare node measurements using `latencyMs` and the same `metric`.
