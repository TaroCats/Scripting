# DeviceServices

`DeviceServices` 是 App 脚本主线程的全局 API，**不需要从 `scripting` 或 Node 包导入**。它提供原生设备服务连接、带长度前缀的 plist 消息和 AFC 文件传输。配对、TLS、签名和安装等流程由脚本自行组织；RSD 会话可通过传入的原生隧道解析服务名称，这里没有安装专用接口。

## plist 消息

以下完整示例需要将地址替换为你自己的 plist 回显服务：

```ts
async function main() {
  const connection = await DeviceServices.connect({
    host: "192.168.1.10", // 替换为实际服务地址。
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

`connect` 使用普通 TCP。每条消息由四字节大端长度和 XML/binary plist 组成；发送默认 binary。值支持字符串、有限数字、布尔值、`Date`、`Uint8Array`、数组和字符串键对象。安全整数读取为 `number`，超出 JavaScript 安全范围的整数无损读取为 `bigint`，支持有符号和无符号 64 位整数。`writePlist` 接受 −2^63 至 2^64−1 范围的 `bigint`；仍拒绝非安全 `number`、null、undefined、循环引用和函数。新消息头之前正常 EOF 返回 `null`；消息截断、格式错误会拒绝并关闭连接。

`maximumFrameBytes` 默认 1 MiB，范围 1024–8388608；嵌套最多 64 层、16384 个节点。超时单位毫秒，默认 30000，范围 1–300000。IO 超时或取消后应重新连接；同一连接每次只执行一个操作。

大整数显示请用 `String(value)`。`bigint` 不能与 `number` 直接混合运算，也不能直接传给 `JSON.stringify`；需要显式转换，例如 `JSON.stringify(result, (_, value) => typeof value === "bigint" ? value.toString() : value)`。转成 `number` 可能丢失精度。收到格式错误的 plist 时抛出 `ERR_DEVICE_PROTOCOL` 并关闭连接；发送值非法时抛出 `ERR_INVALID_ARG_VALUE`。

## AFC 文件传输

端口必须来自已经建立的 AFC 服务，不能把任意 TCP 端口当作 AFC。`openAFC` 后连接永久进入 AFC 模式。

```ts
async function transfer(host: string, port: number, localInput: string, localOutput: string) {
  const connection = await DeviceServices.connect({ host, port })
  const afc = await connection.openAFC({ timeout: 30000 })
  const remote = `/scripting-${Date.now()}-example.bin` // 脚本独占的远端路径。
  let uploaded = false
  try {
    console.log(await afc.readDirectory("/"))
    const task = afc.upload({
      localPath: localInput, // 已有本地文件的绝对路径。
      remotePath: remote,
      onProgress: p => console.log(`${p.bytesTransferred}/${p.totalBytes}`),
    })
    const sent = await task.result
    uploaded = true
    const received = await afc.download({
      remotePath: remote,
      localPath: localOutput, // 父目录必须存在，目标文件不能存在。
    }).result
    console.log(sent.sha256 === received.sha256, received.bytesTransferred)
  } finally {
    if (uploaded) await afc.remove(remote).catch(console.error)
    await afc.close()
  }
}
```

传入实际地址、服务端口和本地绝对路径后调用 `transfer`。选择路径时可能用到的 `FileManager`、`Path` 也都是全局 API。本地文件访问仍需脚本文件系统授权及有效沙箱/安全作用域；仅提供字符串不会授予任意文件访问权。

- `readDirectory(path)` 返回服务端目录项名称，可能包含 `.` 和 `..`。
- `stat(path)` 返回服务端字符串元数据，如 `st_size`、`st_ifmt`。
- `makeDirectory(path)`、`rename(source,destination)`、`remove(path)` 发出 AFC 文件操作。`remove` 不递归遍历目录；`rename` 是否替换目标由服务端决定。
- 上传和下载返回 `{ result, cancel() }`。`result` 成功返回 `{bytesTransferred,seconds,sha256}`。哈希覆盖本地读写的字节，不代表远端持久化校验。
- 文件分块和消息处理在原生执行，内存有界。有回调时约每 250 毫秒报告进度，包含最终字节数；不传回调不会产生进度事件或日志。最终字节数更新之后仍有关闭/发布检查，以 `result` 成功为准。
- 上传先写入唯一临时文件，再检查目标不存在并重命名。AFC 没有原子的“不覆盖重命名”，请使用脚本独占路径。连接丢失时只能尽力清理，远端可能残留自有 `.scripting-<UUID>` 临时文件。
- 上传会继续读取合法的短块；提前 EOF 或大小变化会拒绝。当源文件时间戳变化时，会从已打开的文件句柄再次分块读取并比较内容哈希，一致后才发布，不会仅因元数据变化就冒充内容变化。
- 下载以本地临时文件原子发布，不覆盖已有目标。源必须是普通文件，检测到源变化会拒绝。
- `cancel()` 会取消传输并关闭该 AFC 连接；关闭或退出脚本会释放挂起 IO。取消不会回滚已经完成的操作，任务被拒绝时目标文件也可能已经发布；重新连接后请先检查脚本自有路径，再决定是否重试。

## 接管已有原生连接

`DeviceServices.adopt(source)` 只接受当前活动脚本拥有、且没有挂起原始 IO 的真实原生句柄，不能用带 read/write 方法的 JS 对象伪造。接管后不要再操作原始句柄。

提供 `VPNRSDConnection` 的环境中，可以接管 `await tunnel.connect({port})` 的结果；对应服务需要 RSDCheckin 时再执行 `await connection.checkin()`。该方法检查 RSDCheckin 和 StartService 两个响应，并拒绝要求 TLS 的服务。隧道可查询 RemoteXPC 服务目录；配对与服务专用协议仍独立；并非所有 RSD 服务都使用 plist check-in 或 AFC，脚本需选择正确协议。

## 错误

错误含 `code`，例如 `ERR_DEVICE_CLOSED`、`ERR_DEVICE_BUSY`、`ERR_DEVICE_PROTOCOL`、`ERR_DEVICE_TIMEOUT`、`ERR_DEVICE_CANCELLED`、`ERR_DEVICE_TLS_REQUIRED`、`ERR_DEVICE_TARGET_EXISTS`、`ERR_DEVICE_FILE_CHANGED`。服务端 AFC 状态以 `AFC_<数字>` 返回；请按 code 处理，不匹配本地化文本。`close()`、`cancel()` 始终可用于资源清理。

## 多个 RSD 服务

`DeviceServices`、`VPN` 及其类型均为全局定义，无需导入。传入当前脚本取得的真实 `VPNRSDTunnel`，可以显式提供端口，也可使用 `tunnel.listServices()` 返回的名称：

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
    // messages.connection 是独立连接；请使用该服务定义的命令。
    await messages.close()
  } finally {
    await session.close()
  }
}
```

每次 `openService` 都创建新连接、独占接管，并完成 RSDCheckin 和 StartService 确认。仅用于使用该协议的服务，不执行服务业务命令。省略 `port` 时，`serviceName` 解析设备实际公布的完整名称；提供 `port` 时，`serviceName` 仍仅为描述，省略或为空时返回 `null`。`label` 默认为 `"Scripting"`；`maximumFrameBytes` 的限制与 `connect` 一致。`timeout` 覆盖目录解析、连接及 check-in 的总期限，单位毫秒，默认 30000，范围 1–300000。

会话借用隧道句柄。关闭会话会关闭自己的子服务和挂起打开，不释放隧道句柄，也不影响其他会话。关闭单个服务只释放对应连接；打开或 check-in 失败只清理该次尝试，重连请重新打开服务。adopt 后不得继续读写或关闭原始 source，由 `Connection.close()` 释放底层资源。AFC 客户端与对应 Connection 共用同一条流，关闭任意一个即可释放。

不同脚本可使用匹配的原生 RSD 隧道，但分别持有自己的句柄和独立连接。同 port 的响应也相互隔离；具体设备服务仍可能限制并发连接，同时修改同一文件或设备状态仍可能冲突。整条原生隧道仍最多容纳 4 条连接（含挂起建连），不是每脚本各 4 条。共享及关闭规则见 [LocalDevVPN](../local_dev_vpn/zh.md)。

## 按名称打开 plist 服务

`DeviceServices`、`VPN` 及其类型均为全局 API，无需导入。省略 `port` 时，必须提供非空的 `serviceName`，并精确匹配 `tunnel.listServices()` 返回的名称。提供 `port` 时，`serviceName` 仍仅作描述，不查找或改变端口；省略或空名称返回 `null`。旧有按端口调用继续有效，不会将 `"AFC"` 等标签自动转换为 RSD 服务名称。

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

隧道仍归调用方所有。`timeout` 包含服务目录解析、连接和 check-in 的总时间。名称不存在时抛出 `ERR_DEVICE_SERVICE_NOT_FOUND`，不会猜测端口、建立备用连接或重放业务请求。

`openService` 始终执行 plist RSDCheckin。`com.apple.instruments.dtservicehub` 的 DTX 等原始协议应使用 `tunnel.connect({ serviceName })`，由脚本实现对应协议；名称解析不会将 plist 连接变成 DTX 或 RemoteXPC 客户端。`usesRemoteXPC` 描述公布的传输方式，不是所有服务通用的 check-in 判断条件。
