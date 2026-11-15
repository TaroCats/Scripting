# DeviceServices

`DeviceServices` is a global API on the main thread of App scripts. **Do not import it from `scripting` or a Node package.** It connects to an existing device-service endpoint, exchanges length-prefixed property lists, and transfers files using AFC. It does not perform pairing, establish TLS, sign packages, or install applications. RSD sessions can resolve service names through a supplied native tunnel. Your script supplies the endpoint, session and service-specific commands.

## Connect and exchange property lists

This complete example expects a plist echo service at the host and port you supply:

```ts
async function main() {
  const connection = await DeviceServices.connect({
    host: "192.168.1.10", // Replace with your service endpoint.
    port: 12345,
    timeout: 10000,
  })
  try {
    await connection.writePlist({
      Request: "Echo",
      Payload: new Uint8Array([1, 2, 3]),
      CreatedAt: new Date(),
    }, { format: "binary" })
    console.log(await connection.readPlist({ timeout: 10000 }))
  } finally {
    await connection.close()
  }
}
main().catch(console.error)
```

`connect` uses plain TCP. Each message has a four-byte big-endian length followed by an XML or binary plist. `writePlist` defaults to binary. Plist values support strings, finite numbers, booleans, `Date`, `Uint8Array`, arrays, and string-keyed objects. Safe integers are returned as `number`; integers outside the JavaScript safe range are returned exactly as `bigint` (signed 64-bit and unsigned 64-bit values are supported). `writePlist` accepts `bigint` in the range −2^63 through 2^64−1. Unsafe `number` inputs, null, undefined, cyclic structures and functions are rejected. `readPlist` returns `null` for clean EOF before a new message; truncated or invalid messages reject and close the connection.

`maximumFrameBytes` defaults to 1 MiB and accepts 1024–8388608. Values are limited to 64 nesting levels and 16384 nodes. Deadlines are in milliseconds, default 30000, range 1–300000. An IO timeout or cancellation closes the connection; reconnect before retrying. Run one operation at a time per connection.

Use `String(value)` to display a large integer. Do not mix `bigint` and `number` in arithmetic, or pass a result containing `bigint` directly to `JSON.stringify`; convert intentionally, for example `JSON.stringify(result, (_, value) => typeof value === "bigint" ? value.toString() : value)`. Conversion to `number` can lose precision. Malformed incoming plist messages reject with `ERR_DEVICE_PROTOCOL` and close the connection; invalid outgoing values reject with `ERR_INVALID_ARG_VALUE`.

## AFC files

Connect to an endpoint that actually speaks AFC; the port below is a placeholder, not a standard AFC port. `openAFC` permanently transfers the connection to AFC mode.

```ts
async function transfer(host: string, port: number, localInput: string, localOutput: string) {
  const connection = await DeviceServices.connect({ host, port })
  const afc = await connection.openAFC({ timeout: 30000 })
  const remote = `/scripting-${Date.now()}-example.bin` // Use a path exclusively owned by this script.
  let uploaded = false
  try {
    console.log(await afc.readDirectory("/"))
    const upload = afc.upload({
      localPath: localInput, // Absolute filesystem path to an existing file.
      remotePath: remote,
      onProgress: p => console.log(`${p.bytesTransferred}/${p.totalBytes}`),
    })
    const sent = await upload.result
    uploaded = true
    const received = await afc.download({
      remotePath: remote,
      localPath: localOutput, // Absolute path; parent must exist, destination must not exist.
    }).result
    console.log(sent.sha256 === received.sha256, received.bytesTransferred)
  } finally {
    if (uploaded) await afc.remove(remote).catch(console.error)
    await afc.close()
  }
}
```

Call `transfer` with your established endpoint and absolute paths. `FileManager` and `Path`, when needed to select those paths, are also globals. Local access uses the script's filesystem permission and existing sandbox/security-scoped access; a string path alone does not grant access to an arbitrary file.

- `readDirectory(path)` returns names, including any `.`/`..` entries supplied by the server.
- `stat(path)` returns the server's string metadata (`st_size`, `st_ifmt`, etc.).
- `makeDirectory(path)`, `rename(source, destination)` and `remove(path)` issue AFC commands. These can modify remote files; `remove` is not a recursive directory walk. `rename` follows the server's replacement behavior.
- `upload`/`download` return `{ result, cancel() }`. `result` resolves to `{ bytesTransferred, seconds, sha256 }`. SHA-256 covers the locally read/written bytes; it is not a remote-storage durability guarantee.
- Transfers use native chunks with bounded memory. A supplied progress callback runs at most about every 250 ms, with a final byte-count update. No callback means no progress events or logging. A final byte-count update precedes final close/publication checks; await `result` for success.
- Uploads use a unique temporary remote file and check that the target does not exist before publication. AFC has no atomic no-replace rename: do not share the destination with another writer. Cleanup is best effort if the connection is lost; an owned `.scripting-<UUID>` temporary file may remain.
- Uploads continue valid short file reads. A size change or early EOF rejects the upload. If source timestamps change, the pinned source is re-read with bounded memory and must match the uploaded content hash before publication.
- Downloads publish a local temporary file atomically without overwriting an existing target. The source must be a regular file. Changes detected during transfer reject the result.
- `cancel()` cancels the transfer **and closes its AFC connection**. Closing or exiting the script releases pending IO. Cancellation does not roll back operations already completed: a destination may exist even if the task rejects. Reconnect and inspect your owned paths before retrying.

## Existing native transports

`DeviceServices.adopt(source)` accepts a genuine native connection from the same active script, with no pending raw IO. JavaScript objects with `read`/`write` properties cannot substitute for a native handle. Adoption is exclusive: do not use the original raw handle afterward.

Where `VPNRSDConnection` is available, a script may adopt `await tunnel.connect({port})`, then call `await connection.checkin()` if that particular service requires RSDCheckin. `checkin` validates RSDCheckin and StartService acknowledgments, and rejects TLS-required services. The tunnel can query its RemoteXPC service directory; pairing and service-specific protocols remain separate; not every advertised RSD service uses plist check-in or AFC. The script must select the matching service and protocol.

## Multiple RSD services

`DeviceServices`, `VPN`, and their types are globals; no imports are needed. Supply a genuine `VPNRSDTunnel` from this script. Use explicit ports or names from `tunnel.listServices()`:

```ts
async function useServices(tunnel: VPNRSDTunnel, afcPort: number, plistPort: number) {
  const session = await DeviceServices.openRSDSession(tunnel)
  try {
    const [files, messages] = await Promise.all([
      session.openService({ port: afcPort, serviceName: "AFC" }),
      session.openService({ port: plistPort, serviceName: "My plist service" }),
    ])
    const afc = await files.connection.openAFC()
    console.log((await afc.readDirectory("/")).length)
    // messages.connection is a separate stream. Use commands defined by that service.
    await messages.close()
  } finally {
    await session.close()
  }
}
```

Every `openService` creates a fresh stream, exclusively adopts it, and completes RSDCheckin plus StartService acknowledgment. Use it only for services with that protocol; it does not implement service commands. When `port` is omitted, a nonempty `serviceName` resolves the exact advertised service name. When `port` is supplied, `serviceName` keeps its existing descriptive meaning and never changes the selected port; it is returned as `null` when omitted or empty. `label` defaults to `"Scripting"`; `maximumFrameBytes` has the same limits as `connect`. `timeout` is a total connect/check-in deadline, in milliseconds, default 30000, range 1–300000.

The session borrows the tunnel handle. Closing the session closes its children and pending opens, while leaving the tunnel handle and other sessions usable. Closing an individual service closes only its stream. An open/check-in failure cleans up that attempt. To reconnect, open a new service. After adoption, the raw source must not be read, written or closed; `Connection.close()` releases it. An AFC client and its connection share the same stream, so closing either releases it.

Multiple scripts may use matching native RSD tunnels, but each gets its own handle and independent connections. Even at the same port, responses are isolated. Device services can impose their own concurrency limits, and concurrent changes to the same file or device state can still conflict. The native tunnel retains its existing four-connection limit across all scripts, including pending opens; do not assume each script receives four slots. See [LocalDevVPN](../local_dev_vpn/en.md) for sharing and close semantics.

## Errors

Errors expose `code`, including `ERR_DEVICE_CLOSED`, `ERR_DEVICE_BUSY`, `ERR_DEVICE_PROTOCOL`, `ERR_DEVICE_TIMEOUT`, `ERR_DEVICE_CANCELLED`, `ERR_DEVICE_TLS_REQUIRED`, `ERR_DEVICE_TARGET_EXISTS`, `ERR_DEVICE_FILE_CHANGED`, and server errors `AFC_<status>`. An AFC status is the server's numeric result; inspect the code instead of matching localized messages. `close()` and `cancel()` remain available for cleanup.

## Open a plist service by name

`DeviceServices`, `VPN` and their types are globals; no imports are needed. Names must match the device directory exactly. A classic Lockdown name or a label such as `"AFC"` is not automatically translated to an RSD service name.

```ts
async function readBattery(tunnel: VPNRSDTunnel) {
  const session = await DeviceServices.openRSDSession(tunnel)
  try {
    const service = await session.openService({
      serviceName: "com.apple.mobile.diagnostics_relay.shim.remote",
    })
    await service.connection.writePlist({
      Request: "IORegistry", EntryClass: "IOPMPowerSource",
    })
    return await service.connection.readPlist()
  } finally {
    await session.close()
  }
}
```

The supplied tunnel remains owned by the caller. `timeout` includes directory resolution, connection and check-in. Missing names reject with `ERR_DEVICE_SERVICE_NOT_FOUND`; failures never fall back to guessed ports or replay business requests.

`openService` always performs plist RSDCheckin. For a raw protocol such as DTX on `com.apple.instruments.dtservicehub`, use `tunnel.connect({ serviceName })` and your own protocol implementation. Adding a service name does not turn plist connections into DTX or RemoteXPC clients. `usesRemoteXPC` describes the advertised transport, not a universal check-in rule.
