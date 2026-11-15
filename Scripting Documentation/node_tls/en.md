# Certificate TLS clients (`tls` / `node:tls`)

## Imports and runnable example

Import `connect` from the built-in `node:tls` module (`tls` is equivalent); no npm installation or import from `scripting` is needed. Run the complete example in a full App script with Internet access. It connects to the real HTTPS service `example.com:443`, sends an HTTP/1.1 request after certificate verification, prints the verified TLS metadata and HTTP response chunks, and destroys the socket on completion or error. A network restriction or certificate failure rejects the awaited operation.

```ts
import { connect } from "node:tls"

async function main() {
  // console is global. This example needs Internet access, not an npm package.
  const socket = connect({
    host: "example.com", port: 443,
    servername: "example.com", ALPNProtocols: ["http/1.1"],
  })
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("secureConnect", () => {
        console.log(socket.authorized, socket.getProtocol(), socket.getCipher())
        socket.write("GET / HTTP/1.1\r\nHost: example.com\r\nConnection: close\r\n\r\n")
      })
      socket.on("data", data => console.log(data.toString()))
      socket.once("end", resolve)
      socket.once("error", reject)
      socket.setTimeout(10000, () => socket.destroy(new Error("Timed out")))
    })
  } finally {
    socket.destroy()
  }
}

void main()
```

Use your service’s DNS name for both `host` and `servername`, its actual port, and its application protocol. For private certificates supply your CA as described below; certificate verification remains enabled.

## API reference


`connect` accepts an options object, `(port, listener?)`, `(port, host, listener?)`, `(port, options, listener?)`, or `(port, host, options, listener?)`. `secureConnect` fires after native certificate verification. Set `servername` explicitly for DNS SNI; without it no SNI is sent and certificates are checked against `host`. An empty string also disables SNI.

`write()` and `end(data)` also work inside `secureConnect` / `ready` listeners, including Uint8Array subviews and writes chained from completion callbacks. For HTTP, sending the request with `write()` and `Connection: close` lets the server close after its response.

TLS 1.2–1.3 is the default range; `minVersion` and `maxVersion` accept `TLSv1.2` or `TLSv1.3`. Peer certificate chains are limited to 64 KiB and 16 certificates; oversized chains reject during the handshake. System trust applies by default. `ca` replaces system anchors with ASCII PEM certificates: a string, Uint8Array view, or array of either, at most 16 certificates and 256 KiB total. Expiry, trust and identity checks remain mandatory. `ALPNProtocols` accepts up to 16 ASCII names, each 1–255 bytes.

Calling `end()` closes the TLS write direction and sends `close_notify`; reads continue until the peer closes its TLS write direction. Any intervening proxy must preserve TCP half-close to support this sequence.

Sockets inherit [TCP client](../node_tcp/en.md) streams, queues, timeout notifications, cancellation, half-close and script-exit cleanup. Connections use system routing, including an active VPN. Native handshake timeout is 15 seconds. Writes queued before handshake never become plaintext. Each context supports at most 32 TLS handles; queued data remains subject to TCP stream limits.

`encrypted`, `authorized`, `authorizationError`, `alpnProtocol`, `servername`, `getProtocol()` and `getCipher()` describe the handshake. `getPeerCertificate()` returns the leaf certificate's raw DER and SHA-256 fingerprint; it does not expose a detailed chain. Certificate rejection reports `ERR_TLS_CERT_VERIFY_FAILED` and sets `authorizationError`. An authenticated stream may deliver valid data before a later transport error.

This is a certificate TLS client subset. Servers, direct TLSSocket construction, socket wrapping/STARTTLS, PSK, client certificates, custom verification, insecure verification bypass, cipher overrides, session resumption, renegotiation, exporters, rootCertificates and detailed certificate chains are unsupported and explicitly reject.

[Node modules and import guide](../node_compat/en.md).

## Handling access errors

Network operations check access before starting and may throw or reject with `error.code === "ERR_PRO_REQUIRED"`. Attach socket/server error handlers before connecting or listening, and catch promises from Bonjour and VPN APIs. Keep cleanup in `finally`: closing sockets and RSD sessions, stopping Bonjour resources, `VPN.stop()` and disabling `VPN.localDevVPN` remain available after access expires.
