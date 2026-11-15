# Tailscale

不开启 VPN，也能在 Scripting 中连接自己的电脑或 NAS。请先在 **更多 → 开发 → 应用内 Tailscale** 中添加连接并登录。应用内连接会注册独立于 VPN 连接的设备；Tailnet ACL 和目标服务自身的认证仍然有效。

仅支持在主 App 中运行的脚本。小组件、Intent 和扩展不能打开这些连接。同时只能运行一个应用内连接；脚本与 Agent 共享节点，但分别授权。关闭脚本会话会关闭自己的请求和 SSH 客户端，保留登录身份及其他使用者；在 App 中断开连接会关闭该应用内连接的所有使用者。

## 首次连接自己的设备

1. 在上述页面点“添加”，填写连接名称，保留默认控制服务器并选择“浏览器登录”。保存后点“连接/登录”，完成自己的 Tailscale 登录，再回到 App 确认显示“已连接”。App 会在你的 Tailnet 中注册独立设备；首次使用可能需要你的 Tailnet 管理员批准该设备。
2. 电脑或 NAS 也需要登录同一 Tailnet，并已开启要访问的 HTTP、SSH 或 SFTP 服务。保持 Scripting 在前台；无需开启系统 VPN。
3. 需要认证的服务，请进入 **更多 → 开发 → 应用内 Tailscale → 相应连接 → 服务认证**，直接添加 SSH 密码、Ed25519/RSA 私钥，或 HTTP Authorization/Cookie。添加时可用「选择设备」填入主机，SSH 填写端口、用户名和凭据，保存时核对主机指纹。HTTP 服务需填写准确的协议、主机、端口和完整认证头。
4. 运行下面的示例，选择已保存的服务即可；不需要创建凭据脚本，也不需要在每个脚本中重新输入密码、私钥或服务器公钥。无需认证的 HTTP 请求也可以直接发送。
5. 在 Agent 中输入：“使用 tailscale 工具列出我的应用内连接、在线设备和已保存服务。经我批准后，使用我的 NAS 服务访问〔目标地址或操作〕；不要启动 VPN，也不要索取密码。”

如果登录期间 App 被系统挂起，回来后重新点“连接/登录”。仅看到“已连接”不等于目标服务可访问，以实际响应为准。

已登录的连接可按需打开。在「应用内 Tailscale」页面可选一条已登录的连接作为「启动 App 时自动连接」目标，默认不自动连接。

## 在 App 中保存服务认证

启用 iCloud 钥匙串后，服务资料、已核对的 SSH 服务器公钥和凭据可在使用同一 Apple 账户的设备间同步。每台设备保留自己的应用内 Tailscale 身份。若要在另一台设备上使用相同的服务，请通过同一个控制服务器，使用同一 Tailscale 账户登录同一 Tailnet，然后连接一次。

脚本和 Agent 使用所属连接的已保存服务。列表和 `session.getServices()` 返回名称、类型和目标等信息，密码、私钥和 HTTP 凭据仍会隐藏。编辑时，留空可保留原值，也可输入新值进行替换。

SSH 支持密码、未加密的 OpenSSH Ed25519 私钥或 Base64 编码的 32 字节 Ed25519 密钥，以及未加密的 OpenSSH RSA 私钥。公钥留空时，点「保存」会通过当前连接读取服务器公钥并显示 SHA256 指纹。与可信渠道取得的指纹核对后，点「信任并保存」。探测时不会发送账号密码或私钥。后续连接会核对已保存的公钥。若服务器换了公钥，请确认变更后编辑服务，展开「已核对的服务器公钥」并清空，重新保存和核对指纹。也可在该栏手动填入已核对的公钥，每行一条。HTTP 来源地址必须精确对应 `http(s)://主机:端口`，不含路径、查询参数或片段；Authorization 值可包含 `Bearer ...` 等完整认证内容，Cookie 则填写完整 Cookie 请求头值。保存的 HTTP 凭据只会用于相同协议、主机和端口的请求。

保存服务认证前，请先登录并连接。退出登录、登录失效或删除连接时，会清除本机登录信息和仅保存在本机的服务认证，已同步的服务会保留。在「服务认证」中删除某项服务时，同步该服务的设备也会删除它。

## 全局 API

`Tailscale` 与 `SSHClient` 一样是全局 API，无需从 `scripting` 模块导入。

| 方法 | 行为 |
| --- | --- |
| `Tailscale.selectConnection()` | 显示本次运行的连接选择与授权；取消时返回 `null`。 |
| `Tailscale.open({ connectionId, signal? })` | 打开已登录的连接，返回当前脚本专属 `Tailscale.Session`。 |
| `session.getStatus()` | 返回 `{ state }` 运行状态。 |
| `session.getPeers()` | 返回设备的 `id`、`name`、`dnsName`、`addresses`、`online`。 |
| `session.getServices()` | 返回已保存服务的 `id`、`name`、`kind`、`host`、`port`、`username`、`origin`，不含秘密值。 |
| `session.fetch(url, options?)` | 通过该连接发送 HTTP/HTTPS 请求，返回现有 `Response`。 |
| `session.close()` | 异步、可重复地关闭当前会话及其请求和 SSH 客户端。 |

使用 `SSHClient.connect({ tailscale: session, serviceId })` 使用已保存的 SSH 目标及认证，再使用原有 SSH 和 SFTP API。HTTP 请求可以传入 `serviceId`，按保存的来源地址匹配后注入认证请求头。具体示例见下文。

## 选择并打开

```ts
async function main() {
  const connection = await Tailscale.selectConnection()
  if (!connection) return
  const session = await Tailscale.open({ connectionId: connection.id })
  try {
    console.log(await session.getStatus())
    console.log(await session.getPeers())
    console.log(await session.getServices())
  } finally {
    await session.close()
  }
}
main().catch(console.error)
```

ID 只是已保存连接的引用，打开时可能会请求本次脚本运行的授权。首次登录必须在 App 中完成；脚本不能创建连接或读取节点身份、登录密钥。设备的 `online` 是状态快照，不代表目标服务已经可达。

## NAS HTTP 状态

目标可以使用 peer IP、主机名或完整 MagicDNS 名称，只允许访问在线 Tailnet peer。不支持公网目标、子网路由和 exit node。普通 `fetch` 保持原有行为。

```ts
async function main() {
  const connection = await Tailscale.selectConnection()
  if (!connection) return
  const url = await Dialog.prompt({ title: 'NAS 地址', placeholder: 'http://my-device:port/path' })
  if (!url) return
  const session = await Tailscale.open({ connectionId: connection.id })
  try {
    const origin = new URL(url).origin
    const services = (await session.getServices()).filter(service =>
      (service.kind === 'httpAuthorization' || service.kind === 'httpCookie') &&
      new URL(service.origin).origin === origin)
    let serviceId: string | undefined
    if (services.length) {
      const choice = await Dialog.actionSheet({
        title: 'HTTP 服务认证',
        actions: [{ label: '不使用保存的认证' }, ...services.map(service => ({ label: service.name }))],
      })
      if (choice === null) return
      if (choice > 0) serviceId = services[choice - 1].id
    }
    const response = await session.fetch(url, {
      headers: { Accept: 'application/json' }, serviceId, timeout: 30000,
    })
    if (!response.ok) throw new Error(`NAS 返回 ${response.status}`)
    console.log(response.status, await response.text())
  } finally {
    await session.close()
  }
}
main().catch(console.error)
```

`session.fetch` 返回现有的 `Response` 类型。请求正文支持 `string`、`Data` 和 `Uint8Array`，最多 8 MiB。text/json 等整段正文方法最多聚合 16 MiB；更大响应请分块读取 `response.body`。支持 `AbortSignal` 取消。总超时为 1–30000 毫秒，包含正文读取。关闭或取消响应正文会释放连接。

HTTPS 会校验证书和主机名。重定向只能保留原始协议及完整主机/端口；没有可信证书链或跨源重定向会失败，不会向其他来源转发凭据。HTTP 错误状态码仍作为正常响应返回。

## WebDAV 方法和文件

```ts
async function main() {
  const connection = await Tailscale.selectConnection()
  if (!connection) return
  const session = await Tailscale.open({ connectionId: connection.id })
  try {
    const services = (await session.getServices()).filter(service =>
      service.kind === 'httpAuthorization' || service.kind === 'httpCookie')
    if (!services.length) throw new Error('Add HTTP 服务认证 in the App first')
    const choice = await Dialog.actionSheet({
      title: 'WebDAV', actions: services.map(service => ({ label: `${service.name} (${service.origin})` })),
    })
    if (choice === null) return
    const service = services[choice]
    const directory = new URL('/dav/', service.origin)
    const list = await session.fetch(directory.href, {
      method: 'PROPFIND', headers: { Depth: '1' }, serviceId: service.id,
    })
    console.log(list.status, await list.text())
    const put = await session.fetch(new URL('owned-scripting-example.txt', directory).href, {
      method: 'PUT', headers: { 'If-None-Match': '*' },
      body: '由我的 Scripting 脚本创建', serviceId: service.id,
    })
    if (!put.ok) throw new Error(`上传失败：${put.status}`)
  } finally {
    await session.close()
  }
}
main().catch(console.error)
```

示例会使用你明确选择的 HTTP 服务认证。运行前将 `/dav/` 改为自己的 WebDAV 目录；PUT 携带 `If-None-Match: *`，要求服务器拒绝覆盖已有文件。可以使用 MKCOL、MOVE 等方法，CONNECT 和 TRACE 会被拒绝。请求正文在限额内先缓冲，不是流式上传；较大文件请使用 SFTP。

## SSH 命令

```ts
async function main() {
  const connection = await Tailscale.selectConnection()
  if (!connection) return
  const session = await Tailscale.open({ connectionId: connection.id })
  try {
    const services = (await session.getServices()).filter(service =>
      ['sshPassword', 'sshEd25519', 'sshRSA'].includes(service.kind))
    if (!services.length) throw new Error('请先在 App 中添加 SSH 服务认证')
    const choice = await Dialog.actionSheet({
      title: 'SSH 服务',
      actions: services.map(service => ({ label: `${service.name} (${service.username}@${service.host}:${service.port})` })),
    })
    if (choice === null) return
    const ssh = await SSHClient.connect({ tailscale: session, serviceId: services[choice].id })
    try {
      console.log(await ssh.executeCommand('uname -a', { maxResponseSize: 65536 }))
    } finally {
      await ssh.close()
    }
  } finally {
    await session.close()
  }
}
main().catch(console.error)
```

选择 `serviceId` 时，目标主机、端口、用户名、认证和已核对的服务器公钥都从 App 保存的服务读取，不能再传入这些参数覆盖。Tailnet SSH 不允许自动重连。这连接的是设备原有 SSH 服务，不会开启 Tailscale SSH 服务端。高级脚本仍可省略 `serviceId`，显式提供原有的 `host`、`port`、`authenticationMethod` 和 `trustedHostKeys` 参数。

## SFTP 文件往返

这个独立示例会打开自己的 SSH 客户端：

```ts
async function main() {
  const connection = await Tailscale.selectConnection()
  if (!connection) return
  const session = await Tailscale.open({ connectionId: connection.id })
  try {
    const services = (await session.getServices()).filter(service =>
      ['sshPassword', 'sshEd25519', 'sshRSA'].includes(service.kind))
    if (!services.length) throw new Error('请先在 App 中添加 SSH 服务认证')
    const choice = await Dialog.actionSheet({
      title: 'SSH 服务',
      actions: services.map(service => ({ label: `${service.name} (${service.username}@${service.host}:${service.port})` })),
    })
    if (choice === null) return
    const ssh = await SSHClient.connect({ tailscale: session, serviceId: services[choice].id })
    try {
      const sftp = await ssh.openSFTP()
      try {
        const path = await Dialog.prompt({
          title: '你拥有的新文件路径',
          placeholder: '/home/my-user/owned-scripting-example.txt',
        })
        if (!path) return
        const bytes = Data.fromRawString('Hello from Scripting')
        if (!bytes) throw new Error('数据编码失败')
        const file = await sftp.openFile(path, ['write', 'create', 'forceCreate'])
        try { await file.write(bytes) } finally { await file.close() }
        const input = await sftp.openFile(path, 'read')
        try { console.log(await input.read({ from: 0, length: 65536 })) }
        finally { await input.close() }
        await sftp.remove(path)
      } finally {
        await sftp.close()
      }
    } finally {
      await ssh.close()
    }
  } finally {
    await session.close()
  }
}
main().catch(console.error)
```

只操作自己的路径；`forceCreate` 会拒绝已存在的文件。请在 `finally` 中关闭文件、SFTP、SSH 和 Tailscale 会话。较大文件使用明确偏移量分块读写。

## Agent 使用保存的服务

在 App 中保存服务认证后，告诉 Agent：“调用 tailscale 的 `list_connections` 和 `list_services`，找到我的 NAS SSH 服务。经我批准后，使用返回的 `connection_id` 和 `service_id` 执行 `uname -a`；不要启动 VPN，也不要索取密码。”

HTTP、SSH 和 SFTP 使用对应类型的服务引用。`http_request` 仍需给出同一来源下的 URL；`ssh_exec` 只需额外说明要执行的命令，`sftp` 只需额外说明操作及远端路径。服务器目标和秘密保留在 App 中，不需要另建凭据脚本。

## Agent 访问与生命周期

App 内 Agent 的 `tailscale` 工具支持已保存连接、`list_services` 服务查询、状态/设备查询、连接和断开、HTTP、SSH 命令，以及 SFTP 列表/属性/上传/下载/重命名/删除。审批会说明具体连接、保存的服务、目标和操作。使用 `connection_id` 和 `service_id` 引用 App 中的认证，不要将密码或私钥放入工具参数。Agent 预览有长度上限，并将远端内容标记为不可信数据。SSH 返回 stdout、stderr 和服务器报告的退出码；未报告时为 `null`。文件传输最多 64 MiB，不覆盖已有文件。Agent 会话只能取消自己的任务。

已登录的连接可直接用 `peers` 查询设备。`connect` 会让所选连接在调用结束后保持活动，遵循 App 的连接生命周期。`disconnect` 会结束该连接上正在运行的 App、脚本和 Agent 操作，并保留登录和服务认证。

Agent 的 `status` 会报告当前会话 `state`、是否已登录（`signed_in`）和能否按需启动（`can_start_on_demand`）。按需可用时，连接即使处于停止状态，也可以访问设备。操作失败时会显示失败阶段、目标和检查建议。命令或写入超时后，请先确认结果再重复操作。

连接遵循 iOS 的 App 生命周期限制。退到后台或锁屏可能中断工作，返回后可能需要重新打开会话。写入和远端命令不会自动重放。正在运行的系统 VPN 可能影响底层连接，本功能不承诺绕过它。

遇到 `capabilityUnavailable` 请在主 App 中运行，`authenticationRequired` 请在 App 中登录，`connectionClosed` 请在用户重新连接后打开新会话。目标、信任、授权、超时及资源上限错误需要脚本自行处理。

## SSH 与 SFTP 上限

Tailnet SSH 客户端共同支持最多 8 个打开的命令或 SFTP 通道。打开更多通道前请关闭不用的通道。Tailnet SSH 不支持跳板连接。未及时读取的命令流最多保留 8 个待消费输出块；消费过慢会报错并关闭该命令。请及时消费串流，提前退出回调时显式停止命令。

每个 SFTP 客户端支持最多 32 个待完成请求，以及 32 个打开的文件或目录句柄。目录列表支持最多 1,000 条，超出会明确报错。Agent 目录预览最多返回 1,000 条，并报告 `truncated`。停滞的 SFTP 请求会在 30 秒后超时，并可能关闭该 SFTP 客户端；需要时请显式重新打开，失败的写入不会重放。
