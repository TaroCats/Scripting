# Bonjour 服务发现

## 导入方式与完整示例

`Bonjour` 是全局 API，直接使用，不需要从 `scripting` 导入或安装 npm 包。下面只有 TCP 辅助服务从 `node:net` 导入；`crypto`、`TextDecoder`、`setTimeout`、`clearTimeout` 也是全局对象/函数。请在 App 普通脚本中运行，允许本地网络访问并保持 Scripting 前台；小组件和隔离的 `vm` context 不能打开这些资源。

示例自行启动 TCP 服务，使用唯一名称发布 Bonjour 服务，再浏览、解析并输出端点及 TXT 版本 `1`。成功或失败都会停止浏览、广播、已接受连接和监听；不执行配对握手。

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

若首次本地网络授权弹窗耗尽发现时间，请允许访问后重新运行。发布或发现成功不代表远端应用协议已经运行成功。

## API 说明


`supportedServiceTypes` 列出 App 声明的类型，目前包括 `_http._tcp`、`_scripting._tcp`、`_remotepairing._tcp`、`_remotepairing-pairable-host._tcp`。允许尾部的点，仅支持 `local.` 域。未声明类型明确拒绝，增加任意其他类型需要 App 更新。

普通脚本的自定义服务使用 `_scripting._tcp`，服务实例名称由脚本的 `name` 指定。苹果配对兼容性另保留 `_remotepairing-pairable-host._tcp`（发布可配对主机）和 `_remotepairing._tcp`（发现设备）；这些类型由苹果配对协议约定，配对握手由脚本实现。

`publish({name,type,port,txtRecord?,includePeerToPeer?})` 在系统发布成功后返回 publication，提供只读 `name/type/domain/port` 和可重复调用的 `stop()`。名称冲突会拒绝，不自动改名。端口为 1–65535，名称为 1–63 UTF-8 字节；`includePeerToPeer` 默认 false。

`browse({type,includePeerToPeer?,onFound,onRemoved?,onError?})` 返回带 `stop()` 的 browser。事件内容是 `{name,type,domain}`；调用 `resolve(service,{timeout?,includePeerToPeer?})` 得到 `hostname`、`port`、最多16个 `{address,family}`（IPv4/IPv6）和原始字节 `txtRecord`。解析 timeout 单位毫秒，范围100–60000，默认10000；发布有10秒截止时间。系统不可用或权限错误通过 Promise 拒绝或 `onError` 返回。

TXT 值支持 string/Uint8Array，解析统一返回 Uint8Array。最多32个 ASCII key，每个1–63字节且不含 `=`，忽略大小写后不能重复；每条编码最多255字节，总记录最多1300字节。只有协议约定为文本的字段才用 TextDecoder 解码。

每个 context 最多4个 publication、4个 browser、8个并行 resolve；每个 browser 最多跟踪128项，超限返回 `ENOBUFS`。完成后主动停止，脚本退出也清理自己的资源。广播或发现成功只说明服务可发现，配对或业务协议仍需自己的握手验证。

模块导入与支持范围总览：[Node API 兼容性](../node_compat/zh.md)。

## 处理访问错误

网络操作会在开始前检查访问权限，可能抛出或拒绝并返回 `error.code === "ERR_PRO_REQUIRED"`。连接或监听前应安装 socket/server 错误回调，并捕获 Bonjour、VPN API 的 Promise 拒绝。请将清理放在 `finally` 中：访问权限到期后仍可关闭 socket 和 RSD 会话、停止 Bonjour 资源、调用 `VPN.stop()` 或关闭 `VPN.localDevVPN`。
