# Node API compatibility and imports

Scripting runs JavaScriptCore with a Node compatibility layer. This page describes the built-in modules registered by Scripting, their useful API subsets, and important limitations. The `node` command in Scripting's shell uses this environment; it does not launch a desktop Node executable. `process.version` / `process.versions.node` report a compatibility baseline, not complete support for that Node release. Availability in widgets, keyboards, Safari and isolated `vm` contexts can differ; the network examples linked here target full App scripts.

## Where to import from

| Source | Examples | Usage |
| --- | --- | --- |
| Built-in Node module | `node:net`, `node:tls`, `node:crypto`, `node:buffer`, `node:timers/promises` | `import { createServer } from "node:net"` or `require("node:net")`; no npm install |
| Runtime global | `crypto`, `Buffer`, `process`, `console`, `TextEncoder`, `TextDecoder`, `AbortController`, `setTimeout`, `setInterval`, `setImmediate`, `clearTimeout`, `clearInterval`, `clearImmediate`, `queueMicrotask`, `Bonjour` | Use directly; no import. `Bonjour` operations require the full App runtime |
| Scripting SDK export | `Script`, `Text`, `VStack` | Import the documented export from `"scripting"`; this is not a source for Node modules or WebCrypto |
| Third-party npm package | An installed package and its dependencies | Install through Scripting's npm tools, then import the package by its actual name |

For registered built-ins, `"net"` and `"node:net"` resolve to the same module. A subpath needs its own registration: support for `"stream"` does not imply `"stream/web"`. Both ES import syntax and CommonJS `require()` are supported through Scripting's module loader. Module evaluation uses CommonJS-style loading after transpilation; it is not a complete native Node ESM loader. Top-level await is supported in the script entry, not arbitrary required modules.

Each code block in the linked new API pages is an independent App script. Import declarations are at the top; awaiting work keeps its example active. Calling `Script.exit()` early closes owned resources and cancels pending timers.

### Complete built-in-only example

This example needs no package installation, server or filesystem setup. It prints `hello` and its SHA-256 hexadecimal digest after a short delay.

```ts
import { Buffer } from "node:buffer"
import { createHash } from "node:crypto"
import { setTimeout as sleep } from "node:timers/promises"

// process and console are globals; no import from "scripting".
const message = Buffer.from("hello", "utf8")
await sleep(10)
console.log(message.toString("utf8"))
console.log(createHash("sha256").update(message.toString("utf8")).digest("hex"))
console.log(process.version, process.platform, process.cwd())
```

## Functional modules and implemented subsets

“Subset” means the listed operations work, with the limitations described here and in the linked reference. It does not promise every API of current Node. Table names can be used with the `node:` prefix.

| Module | Supported entry points / uses | Limits and reference |
| --- | --- | --- |
| `assert` | Assertions, equality/deep equality, strict assertions through `.strict` | Browser-compatible implementation; `assert/strict` is not separately registered |
| `buffer` | `Buffer.from/alloc/concat/isBuffer`, encodings and byte views | Also global `Buffer`; not the `Data` API |
| `string_decoder` | `StringDecoder.write/end` for incremental text decoding | JavaScript Buffer-based implementation |
| `events` | `EventEmitter`, `on/once/off/emit`, listener management | JavaScript event handling, not OS events |
| `path` | POSIX path join/resolve/dirname/basename/extname/relative | Path calculations do not grant file access; `path/posix` and `path/win32` subpaths are not registered |
| `url`, `querystring`, `punycode` | URL/query parsing and formatting, query-string and punycode conversions | Browser-compatible implementations; global `URL/URLSearchParams` are also available |
| `util`, `util/types` | Formatting/inspection, promisify/callbackify, type predicates, `styleText` | `styleText` formatting does not create a real TTY; not every modern Node utility is present |
| `stream` | Readable/Writable/Duplex/Transform/PassThrough, pipe, callback pipeline/finished | JavaScript stream implementation; not OS stream handles or full Web Streams interop |
| `stream/promises` | Promise wrappers for pipeline/finished | Built on the provided JS streams; use the documented subset rather than all recent Node overloads |
| `stream/consumers` | `buffer/text/json/arrayBuffer/blob` consumption | `blob` also requires a global Blob implementation; `stream/web` is not registered |
| `crypto` | Hash/HMAC/PBKDF2, random bytes, supported AES/signing helpers; `.webcrypto` | Browser-compatible Node crypto subset plus Scripting WebCrypto; no blanket support for all Node algorithms or KeyObject features |
| `zlib` | gzip/gunzip/deflate/inflate, raw variants, sync/callback/stream forms | Pure JavaScript compression; no Brotli or Zstd |
| `fs`, `fs/promises` | File reads/writes, directories, stats, logical file handles, streams, opendir/Dir | Sandboxed paths and host permissions apply. Callback/Promise forms may wrap synchronous work; they do not promise background-thread I/O. Watch APIs do not observe changes; chmod/chown/time setters include no-op compatibility methods |
| `os` | homedir/tmpdir, CPU count, memory and uptime/system information | homedir maps to App documents, freemem describes App-available memory; per-CPU speed/times and some Unix fields are placeholders |
| `http` | `request/get`, request/response events; buffered `createServer` adapter | Full-runtime server uses Scripting HttpServer; request/response buffering, simplified Agent/socket fields, no Node raw-socket/upgrade contract |
| `https` | `request/get` with system HTTPS networking | `https.createServer` shares the HTTP adapter and does **not** configure certificate TLS. Use Scripting's separate HttpServer TLS API for HTTPS hosting |
| `net` | TCP `Socket/connect/createConnection`, streams, `Server/createServer`, numeric IPv4/IPv6 listening | Full App main-context server, bounded resources, no Unix sockets/UDP/cluster. [Complete local echo example](../node_tcp/en.md) |
| `tls` | Verified certificate TLS client `connect`, secureConnect, streams, SNI/ALPN/custom CA | No TLS server, STARTTLS/socket wrapping, PSK or insecure certificate bypass. [Complete HTTPS example](../node_tls/en.md) |
| `timers`, `timers/promises` | Timeout/Immediate handles, abortable delay, async interval, scheduler.wait/yield | Global timers return numbers; module timers return handles. No real-time or iOS background execution guarantee. [Examples](../script_timers/en.md) |
| `process` | Global process metadata/env/argv/cwd, nextTick, hrtime, shell I/O adapters where provided | No OS process management; nextTick uses the JSC microtask queue rather than V8's separate priority queue |
| `vm` | `Script`, createContext/isContext, runInContext/runInNewContext/runInThisContext | Same VM with isolated globals; not a security boundary or worker. `compileFunction` is unsupported |
| `module` | `createRequire` with path-relative resolution/cache | Minimal module loader helpers; `builtinModules` is not a complete capability inventory |
| `console`, `constants` | Runtime logging, compatibility constants | No real terminal or guarantee that all Unix constants describe available OS operations |

Uppercase global `Crypto` operates on Scripting `Data`; lowercase global `crypto` is WebCrypto. For HKDF and the explicit ChaCha20-Poly1305 extension, use `crypto.subtle` / `crypto.chacha20Poly1305`, or import `webcrypto` from `node:crypto`. Do not assume `createCipheriv("chacha20-poly1305", ...)` or Node `hkdfSync` is provided. See [HKDF/ChaCha](../crypto_hkdf_chacha/en.md) and [Curve25519](../web_crypto/en.md).

`Bonjour` is a Scripting global, not a Node built-in; see its [complete publish/browse/resolve example](../bonjour/en.md). The `web-globals` helper resource supplies globals internally; use the documented global APIs directly.

## Importable compatibility placeholders

These modules can load so optional dependency paths can be detected, but their existence is **not** proof of functionality. Some operations throw; others return empty/no-op results.

| Module | Actual behavior |
| --- | --- |
| `dns` | lookup reports an error; query/resolver operations are unavailable. Native TCP/HTTP/TLS still resolve hostnames themselves. `dns/promises` is not a separately registered subpath; `require("dns").promises` is also a placeholder |
| `http2` | Session/connect/server methods throw; constants/settings helpers have placeholder values. No Node HTTP/2 session API |
| `child_process` | spawn/exec/execFile/fork and sync variants throw; no child processes |
| `cluster` | Single-process flags and no-op management helpers; fork throws |
| `worker_threads` | Main-thread flags; Worker construction throws, MessageChannel/MessagePort are placeholders |
| `async_hooks` | Hooks are no-op; AsyncLocalStorage callbacks run, but stores are not propagated and getStore returns undefined |
| `diagnostics_channel` | No subscribers or real event publication; tracing wrappers call the supplied function |
| `perf_hooks` | Basic performance timing, placeholder observation/entries; no full PerformanceObserver collection |
| `tty` | isatty returns false; ReadStream/WriteStream placeholders |
| `readline`, `readline/promises` | No interactive terminal input. Callback question does not receive user input; Promise question resolves an empty string. Use global Dialog for App prompts |
| `v8` | Basic empty/default introspection values; serialization, heap snapshots and other V8 operations throw |

`dgram`, `inspector`, `repl` and `wasi` reject when loaded. Other Node names or private internals absent from the registered inventory are unsupported, including `domain`, `sys`, `trace_events`, `inspector/promises`, `assert/strict`, `path/posix`, `path/win32` and `stream/web`. A reserved resolver name or an editor completion is not an implementation.

## Third-party npm packages

Use Tools → npm Packages or `npm install <actual-package-name>` in Scripting's shell. Pure-JavaScript parsers, formatters, validation and data-processing libraries are good candidates when their dependencies use the functional APIs above. Compatibility depends on the installed **version, dependency tree and executed code path**; there is no universal npm whitelist. Loading a package successfully does not verify its networking, subprocess or native paths.

Before adopting a package:

1. Check its direct and transitive Node imports against this table, especially the placeholder section. A package that requires AsyncLocalStorage semantics, DNS queries, Worker or child processes needs a different code path.
2. Prefer pure JavaScript distributions. `.node` native addons, downloaded executables, browser automation engines and OS build tools cannot run through this compatibility layer.
3. Automatic dependency `preinstall/install/postinstall/prepare` scripts are skipped. Optional dependencies are not automatically installed. An installation can therefore succeed while an optional native feature is absent.
4. Run the actual operation and inspect its payload/result, errors and cleanup; do not stop at `require()` success, an engine-version check or `typeof fn === "function"`.
5. Keep network/file permissions and iOS foreground/background limitations in mind. A package cannot acquire capabilities that its host script does not have.

For the complete callable signatures of the shipped subset, use Scripting's built-in TypeScript declarations and the linked API pages. This overview describes Scripting's implementations; it does not claim conformance to every API in desktop Node documentation.
