# 证书 TLS 客户端（`tls` / `node:tls`）

## 导入方式与完整示例

从内置 `node:tls` 导入 `connect`（也可写 `tls`），不需要安装 npm 包，也不从 `scripting` 导入。请在可联网的 App 普通脚本中运行完整示例：连接真实 HTTPS 服务 `example.com:443`，证书验证通过后发送 HTTP/1.1 请求，输出已验证的 TLS 信息与 HTTP 响应片段；正常完成或出错都会销毁 Socket。网络限制或证书失败会使 await 的操作报错。

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

连接自有服务时，使用它的 DNS 名称作为 `host` 和 `servername`，并填写实际端口、遵循对应应用协议。私有证书可按下文提供 CA，证书验证仍会执行。

## API 说明


`connect` 支持配置对象，以及 `(port, listener?)`、`(port, host, listener?)`、`(port, options, listener?)`、`(port, host, options, listener?)`。原生验证证书后才触发 `secureConnect`。需要 DNS SNI 时显式设置 `servername`；省略或空字符串不发送 SNI，证书仍按照 `host` 验证。

可在 `secureConnect` / `ready` 监听器中调用 `write()` 或 `end(data)`，支持 Uint8Array 子视图和在写回调中继续写入。HTTP 请求可使用 `write()` 配合 `Connection: close`，让服务器在响应后关闭连接。

默认 TLS 1.2–1.3，`minVersion`、`maxVersion` 只接受 `TLSv1.2` 或 `TLSv1.3`。对端证书链最多 64 KiB、16 张证书，超限在握手阶段拒绝。默认使用系统信任；`ca` 可用 ASCII PEM 字符串、Uint8Array 子视图或它们的数组替换系统信任锚，最多 16 张证书、合计 256 KiB。有效期、信任链和身份验证不可关闭。`ALPNProtocols` 最多 16 个 ASCII 名称，每项 1–255 字节。

继承 [TCP 客户端](../node_tcp/zh.md) 的流、队列、超时通知、取消、半关闭和脚本退出回收行为。连接遵循系统路由和当前 VPN。原生握手期限为 15 秒；握手前排队的数据不会以明文发送。每个上下文最多 32 个 TLS 句柄，数据队列遵循 TCP 流限制。

提供 `encrypted`、`authorized`、`authorizationError`、`alpnProtocol`、`servername`、`getProtocol()`、`getCipher()`。`getPeerCertificate()` 返回叶证书原始 DER 和 SHA-256 指纹，不提供详细链。证书拒绝报 `ERR_TLS_CERT_VERIFY_FAILED` 并设置 `authorizationError`；已认证数据可能先交付，再报告后续传输错误。

本 API 是证书 TLS 客户端子集。服务器、直接构造 TLSSocket、包装已有 socket/STARTTLS、PSK、客户端证书、自定义验证、关闭验证、密码套件覆盖、会话恢复、重新协商、exporter、rootCertificates 和详细证书链会明确拒绝。

`end()` 关闭 TLS 写方向并发送 `close_notify`，读取可持续至对端关闭 TLS 写方向。经过代理时，上游需保留 TCP 半关闭语义才能支持这种顺序。

模块导入与支持范围总览：[Node API 兼容性](../node_compat/zh.md)。

## 处理访问错误

网络操作会在开始前检查访问权限，可能抛出或拒绝并返回 `error.code === "ERR_PRO_REQUIRED"`。连接或监听前应安装 socket/server 错误回调，并捕获 Bonjour、VPN API 的 Promise 拒绝。请将清理放在 `finally` 中：访问权限到期后仍可关闭 socket 和 RSD 会话、停止 Bonjour 资源、调用 `VPN.stop()` 或关闭 `VPN.localDevVPN`。
