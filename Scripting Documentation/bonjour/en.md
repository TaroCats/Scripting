# Bonjour service discovery

## Imports and runnable example

`Bonjour` is a global API: use it directly, with no import from `scripting` or npm installation. Only the TCP helper in this example comes from `node:net`. `crypto`, `TextDecoder`, `setTimeout` and `clearTimeout` are also globals. Run this complete example in a full App script, allow local-network access, and keep Scripting in the foreground. Widgets and isolated `vm` contexts cannot open these resources.

The example starts its own TCP service, publishes a unique service name, discovers and resolves it, and prints its endpoint plus TXT version `1`. It closes the browser, publication, accepted sockets and listener on success or failure; it does not perform a pairing handshake.

```ts
import { createServer, type Socket } from "node:net"

async function main() {
  // Bonjour, crypto and console are globals; no import from "scripting".
  const peers = new Set<Socket>()
  const server = createServer(socket => {
    peers.add(socket)
    socket.on("close", () => peers.delete(socket))
    socket.on("error", console.error)
    socket.on("data", data => socket.write(typeof data === "string" ? data : new Uint8Array(data)))
  })
  server.on("error", console.error)
  let publication: BonjourPublication | undefined
  let browser: BonjourBrowser | undefined
  let deadline: ReturnType<typeof setTimeout> | undefined
  try {
    await new Promise<void>((resolve, reject) => {
      const fail = (error: Error) => reject(error)
      server.once("error", fail)
      server.listen(0, () => { server.removeListener("error", fail); resolve() })
    })
    const endpoint = server.address()
    if (!endpoint) throw new Error("Server is not listening")
    const name = "Scripting Demo " + crypto.randomUUID().slice(0, 8)
    publication = await Bonjour.publish({
      name, type: "_scripting._tcp", port: endpoint.port,
      txtRecord: { version: "1", binary: new Uint8Array([0, 255]) },
      includePeerToPeer: true,
    })
    const found = await new Promise<BonjourResolvedService>((resolve, reject) => {
      let resolving = false
      deadline = setTimeout(() => reject(new Error("Discovery timed out")), 10000)
      browser = Bonjour.browse({
        type: "_scripting._tcp", includePeerToPeer: true, onError: reject,
        onFound(service) {
          if (service.name !== name || resolving) return
          resolving = true
          void Bonjour.resolve(service, { timeout: 3000, includePeerToPeer: true }).then(resolve, reject)
        },
      })
    })
    console.log(found.name, found.hostname, found.port)
    console.log(new TextDecoder().decode(found.txtRecord.version)) // "1"
  } finally {
    clearTimeout(deadline)
    browser?.stop()
    publication?.stop()
    for (const socket of peers) socket.destroy()
    if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()))
  }
}

void main()
```

If the first local-network permission prompt consumes the discovery deadline, allow access and rerun the example. Publication or discovery alone does not test a remote application protocol.

## API reference


`supportedServiceTypes` lists the types declared by this App. Currently these include `_http._tcp`, `_scripting._tcp`, `_remotepairing._tcp` and `_remotepairing-pairable-host._tcp`. An optional trailing dot is accepted. Only `local.` services and declared types are supported; arbitrary types require an App update.

Use `_scripting._tcp` for custom script services; choose the service instance name with `name`. Apple pairing compatibility also requires `_remotepairing-pairable-host._tcp` to advertise a pairable host and `_remotepairing._tcp` to discover a device. These types follow Apple’s pairing protocol; scripts implement the pairing handshake.

`publish({name,type,port,txtRecord?,includePeerToPeer?})` resolves after system publication. The returned publication has read-only `name`, `type`, `domain`, `port` and an idempotent `stop()`. A name collision rejects instead of silently renaming. Port is 1–65535; a name is 1–63 UTF-8 bytes. `includePeerToPeer` defaults to false.

`browse({type,includePeerToPeer?,onFound,onRemoved?,onError?})` returns a browser with `stop()`. Found/removed events contain `{name,type,domain}`. To obtain an endpoint, call `resolve(service,{timeout?,includePeerToPeer?})`. It returns `hostname`, `port`, up to 16 `{address,family}` entries (`IPv4` or `IPv6`), and `txtRecord` values as Uint8Array. Timeout is 100–60000 milliseconds, default 10000. Publication has a 10-second deadline. Availability and permission failures reject or invoke `onError`.

TXT values accept strings or Uint8Array; binary bytes are preserved on resolution. Up to 32 ASCII keys, each 1–63 bytes without `=`, are accepted; keys must be unique ignoring case. Each encoded entry is at most 255 bytes and the complete TXT record at most 1300 bytes. Use `TextDecoder` only for values your protocol defines as text.

Each context supports four publications, four browsers, eight simultaneous resolutions and 128 tracked services per browser. Exceeding a limit reports `ENOBUFS`. Stop resources when finished; script exit also stops its own resources. Discovery/publication alone does not prove that an application protocol or pairing succeeded.

[Node modules and import guide](../node_compat/en.md).

## Handling access errors

Network operations check access before starting and may throw or reject with `error.code === "ERR_PRO_REQUIRED"`. Attach socket/server error handlers before connecting or listening, and catch promises from Bonjour and VPN APIs. Keep cleanup in `finally`: closing sockets and RSD sessions, stopping Bonjour resources, `VPN.stop()` and disabling `VPN.localDevVPN` remain available after access expires.
