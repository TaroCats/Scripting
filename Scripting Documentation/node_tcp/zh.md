# TCP 客户端与服务端（`net` / `node:net`）

## 导入方式与完整示例

从内置 `node:net` 导入 `createConnection`、`createServer` 和可选的 TypeScript 类型；`net` 是等价写法。不需要安装 npm 包，也不从 `scripting` 导入。这个客户端/服务端示例需要 App 完整运行时的主脚本队列。

将完整示例粘贴到 App 普通脚本即可运行。它自行在可用端口启动本地回显服务，不依赖预先启动的服务器或固定端口；收到回显后输出 `Hello from Scripting`，随后关闭所有自有连接和监听。

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

连接其他设备或服务时，请使用你控制的真实 host/port，并按对方协议发送数据。TCP 本身不定义应用消息边界。

## 客户端 API


`connect` / `createConnection` 支持配置对象和 `(port, host?, listener?)`。也可使用 `new Socket(options).connect(...)`，并在连接完成前排队写入。端口为 1–65535。支持主机名、IPv4、IPv6 和带 scope 的 IPv6，遵循系统路由，不绕过 VPN。

`write()` 和 `end(data)` 可在建连前排队，也可在 `connect` / `ready` 监听器中调用，均支持字符串、Buffer 和 Uint8Array 子视图。写回调表示该次排队写入已完成，不代表对端已经处理请求。

Socket 是 Duplex，支持写回调、`drain`、`pause` / `resume`、`pipe`、编码、`end` / `finish`、错误和关闭事件。Buffer / Uint8Array 子视图保留 byteOffset 和 length。`write` 返回 false 时，请等待 `drain` 或写回调后再继续排队。每个 Socket 排队写入上限为 1 MiB，每个 context 为 16 MiB，最多 32 个原生连接；超限明确报 ENOBUFS。高水位为 0–262144 字节。

`allowHalfOpen` 默认为 false；设为 true 后，对端 EOF 不会自动关闭写方向，需要自行 `end()`。`setTimeout` 只发通知，不自动关闭。AbortSignal 和 `destroy` 取消连接；脚本退出清理自己的 Socket。销毁后请创建新的 Socket。

`family` 可为 0、4、6。DNS 使用系统解析器，按顺序尝试返回的地址，也支持自定义 lookup 回调。`isIP`、`isIPv4`、`isIPv6` 判断格式，包括带 scope 的 IPv6，不判断可达性。`address`、本地／远端信息、字节计数、connecting / pending / readyState 和 ended / finished 属性描述连接状态。

请在连接前配置 `noDelay`、`keepAlive`、`keepAliveInitialDelay`。noDelay 和 keepAlive 默认为 false，`setNoDelay()` 的默认参数为 true。连接后设置同值可成功，改变值会明确拒绝；需要的设置可直接传给 createConnection。

## TCP 服务端



`createServer(options?,connectionListener?)` / `new Server(...)` 支持 Socket 高水位、allowHalfOpen、pauseOnConnect、noDelay、keepAlive、keepAliveInitialDelay。接受的连接复用 Socket 字节流，不触发客户端专属 connect/ready 事件；pauseOnConnect 为 true 时，请在准备好消费后 resume。

`listen({port,host?,backlog?},callback?)` 的 port 为0–65535，0自动分配。host 仅支持数字 IPv4/IPv6，省略时绑定双栈通配地址；backlog 为1–128，默认128。也支持 `(port,callback?)`、`(port,host,callback?)`、`(port,host,backlog,callback?)`。提供 listening/connection/error/close 事件、listening 属性、address/getConnections/maxConnections。未监听时 address 返回 null。close 不销毁既有 Socket，等其结束才回调；结束服务时自行关闭或 destroy 它们。未运行的 server 调用 close 返回 ERR_SERVER_NOT_RUNNING。

每个 context 最多4个 listener，客户端与接受的连接合计最多32个。maxConnections 可为0–32或Infinity，0丢弃新连接；原生配额满时也会丢弃。脚本退出强制清理自己的 listener/Socket。监听失败异步报错，例如 EADDRINUSE，请设置 error 监听器；可在错误回调中重新 listen。

本功能是 TCP 子集，不支持 Unix socket、监听主机名、cluster/句柄共享、reusePort、原生 fd 包装、UDP、resetAndDestroy、进程事件循环 ref/unref 及 TLS 服务端；不支持的选项明确报错。TCP 不提供流加密；验证证书的 TLS 连接请使用 [node:tls](../node_tls/zh.md)。可用 [Bonjour](../bonjour/zh.md) 广播本地服务。

模块导入与支持范围总览：[Node API 兼容性](../node_compat/zh.md)。

## 处理访问错误

网络操作会在开始前检查访问权限，可能抛出或拒绝并返回 `error.code === "ERR_PRO_REQUIRED"`。连接或监听前应安装 socket/server 错误回调，并捕获 Bonjour、VPN API 的 Promise 拒绝。请将清理放在 `finally` 中：访问权限到期后仍可关闭 socket 和 RSD 会话、停止 Bonjour 资源、调用 `VPN.stop()` 或关闭 `VPN.localDevVPN`。
