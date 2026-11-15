# TCP clients and servers (`net` / `node:net`)

## Imports and runnable example

Import `createConnection`, `createServer` and optional TypeScript types from the built-in `node:net` module (`net` is an equivalent spelling). No npm installation or import from `scripting` is needed. Use the full App runtime on the main script queue for this client/server example.

Paste this complete example into an App script. It creates its own local echo server on an available port, so no existing server or fixed port is required. It prints `Hello from Scripting` after receiving the echoed bytes, then closes every owned connection and the listener.

```ts
import { createConnection, createServer, type Socket } from "node:net"

async function main() {
  // console is global. No import from "scripting" or npm install is required.
  const peers = new Set<Socket>()
  const server = createServer({ allowHalfOpen: true }, socket => {
    peers.add(socket)
    socket.on("close", () => peers.delete(socket))
    socket.on("error", console.error)
    socket.on("data", data => socket.write(typeof data === "string" ? data : new Uint8Array(data)))
    socket.on("end", () => socket.end())
  })
  server.on("error", console.error)
  let client: Socket | undefined
  let received = ""
  try {
    await new Promise<void>((resolve, reject) => {
      const fail = (error: Error) => reject(error)
      server.once("error", fail)
      server.listen({ port: 0, host: "127.0.0.1" }, () => {
        server.removeListener("error", fail)
        resolve()
      })
    })
    const endpoint = server.address()
    if (!endpoint) throw new Error("Server is not listening")
    await new Promise<void>((resolve, reject) => {
      client = createConnection({ host: "127.0.0.1", port: endpoint.port, noDelay: true }, () => {
        client!.end("Hello from Scripting")
      })
      client.on("data", data => { received += data.toString() })
      client.once("end", resolve)
      client.once("error", reject)
      client.setTimeout(5000, () => client!.destroy(new Error("Timed out")))
    })
    console.log(received) // Hello from Scripting
  } finally {
    client?.destroy()
    for (const socket of peers) socket.destroy()
    if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()))
  }
}

void main()
```

For a different device or service, replace the host and port with an endpoint you control and send the bytes required by that service’s protocol. TCP itself supplies no application message framing.

## Client API


`connect` and `createConnection` accept an options object or `(port, host?, listener?)`. `new Socket(options).connect(...)` and writes queued before connection are supported. Ports are 1-65535. Hostnames, IPv4, IPv6 and scoped IPv6 use system routing; connections do not bypass the VPN.

`write()` and `end(data)` can be called before connection or inside `connect` / `ready` listeners. Strings, Buffer and Uint8Array views are accepted in each case. A write callback signals completion of that queued write; it does not mean the peer has processed the request.

Socket is a Duplex: `write` callbacks, `drain`, `pause`/`resume`, `pipe`, encoding, `end`/`finish`, errors and close are supported. Buffer and Uint8Array subviews preserve byteOffset/length. A false write return means apply backpressure; wait for `drain` or write callbacks before queuing more. Writes are limited to 1 MiB queued per socket and 16 MiB per context, with at most 32 native connections. Overflow rejects with ENOBUFS. Watermarks must be 0-262144 bytes.

`allowHalfOpen` defaults to false; true keeps the writer open after peer EOF until you call end. `setTimeout` emits a notification and does not automatically close. AbortSignal and destroy cancel the socket; script exit cancels its own sockets. Make a fresh Socket after destruction.

`family` is 0, 4 or 6. DNS uses the system resolver and tries returned addresses sequentially. Custom lookup callbacks are supported. `isIP`, `isIPv4`, and `isIPv6` validate syntax (including scoped IPv6); they do not test reachability. `address`, local/remote fields, byte counters, connecting/pending/readyState and ended/finished fields describe the socket.

Configure `noDelay`, `keepAlive` and `keepAliveInitialDelay` before connect. noDelay and keepAlive default to false; setNoDelay() defaults to true. After connect, same-value calls succeed; changing these options rejects explicitly. Use createConnection options for the required settings.

## TCP servers



`createServer(options?,connectionListener?)` / `new Server(...)` supports Socket watermarks, `allowHalfOpen`, `pauseOnConnect`, `noDelay`, `keepAlive` and `keepAliveInitialDelay`. Accepted connections are normal Socket streams; they do not emit the client's `connect` or `ready` events. With `pauseOnConnect`, call `resume()` when prepared to consume input.

`listen({port,host?,backlog?},callback?)` accepts a numeric port 0–65535 (0 chooses an available port). Bind host must be numeric IPv4/IPv6; omitting it binds a dual-stack wildcard. Backlog is 1–128, default 128. Numeric overloads `(port,callback?)`, `(port,host,callback?)` and `(port,host,backlog,callback?)` also work. `listening`, `connection`, `error` and `close` events, `listening`, `address()`, `getConnections(callback)` and `maxConnections` are available. `address()` returns null when not listening. `close(callback?)` leaves existing sockets active and calls back after they close; stop or destroy them explicitly when ending a service. Calling close on an inactive server reports `ERR_SERVER_NOT_RUNNING`.

There are at most four listeners and 32 combined client/accepted native sockets per context. `maxConnections` is 0–32 or Infinity; zero drops new connections. Native quota overflow also drops incoming connections. Script exit force-closes its own listeners and sockets. Listening failure is asynchronous, including `EADDRINUSE`; attach an error handler. A failed server can be retried in that handler.

This is a TCP subset. Unix sockets, listen hostnames, cluster/handle sharing, reusePort, native fd wrapping, UDP, resetAndDestroy and process event-loop ref/unref semantics are unsupported. Unsupported options reject rather than being silently ignored. TLS servers are not included. TCP does not encrypt the stream; use [node:tls](../node_tls/en.md) for verified certificate TLS. See [Bonjour](../bonjour/en.md) to advertise a local service.

[Node modules and import guide](../node_compat/en.md).

## Handling access errors

Network operations check access before starting and may throw or reject with `error.code === "ERR_PRO_REQUIRED"`. Attach socket/server error handlers before connecting or listening, and catch promises from Bonjour and VPN APIs. Keep cleanup in `finally`: closing sockets and RSD sessions, stopping Bonjour resources, `VPN.stop()` and disabling `VPN.localDevVPN` remain available after access expires.
