# Tailscale

Connect to your own computer or NAS from Scripting without enabling VPN. Add and sign in to a connection in **More → Development → App Tailscale** first. The App registers a separate device from its VPN connection. Your Tailnet ACLs and each service's authentication still apply.

Available to scripts running in the main App. Widgets, intents and extensions cannot open these connections. One App connection can run at a time; scripts and Agent operations share it with separate permissions. Closing your session closes your requests and SSH clients; it preserves the saved login and other consumers. Disconnecting in the App closes every consumer of that App connection.

## First connection to your device

1. Open the page above, tap Add, enter a connection name, keep the default control server and choose Browser Sign In. Save, tap Connect / Sign In, finish signing in to your own Tailscale account, then return to confirm Connected. The App registers its own Tailnet device; your Tailnet administrator may need to approve it.
2. Your computer or NAS must also belong to the Tailnet and have its HTTP, SSH or SFTP service enabled. Keep Scripting in the foreground. The system VPN can stay off.
3. For an authenticated service, open **More → Development → App Tailscale → your connection → Service Authentication**. Add an SSH password, Ed25519/RSA private key, or HTTP Authorization/Cookie directly. Use Choose Device to fill the host. For SSH, enter the port, username and credentials, then verify the host fingerprint when saving. For HTTP, save the exact scheme, host and port and the complete header value.
4. Choose a saved service in the examples below. No credential setup script or repeated password, private-key or host-key prompts are needed. HTTP requests without authentication can also be sent directly.
5. Ask Agent: “Use the tailscale tool to list my App connections, online devices and saved services. After my approval, use my saved NAS service for [target URL or operation]. Do not start VPN or ask for passwords.”

If iOS suspends the App during sign-in, tap Connect / Sign In again after returning. Connected alone does not prove that a target service is reachable; check its response.

Signed-in connections can open on demand. In App Tailscale, you can choose one signed-in connection under Connect on App Launch. The default is Do Not Connect Automatically.

Agent `status` reports the current session `state`, `signed_in`, and `can_start_on_demand`. A stopped connection can still be used when on-demand access is available. Failed operations identify the phase and target and suggest what to check. Verify the result of a command or write before repeating it after a timeout.

## Save service authentication in the App

With iCloud Keychain enabled, service profiles, trusted SSH host keys and credentials can sync between devices using the same Apple Account. Each device keeps its own App Tailscale identity. To see the same services on another device, sign in to the same Tailnet with the same Tailscale account on the same control server, then connect once.

Scripts and Agent use the saved services for their connection. The list and `session.getServices()` return details such as name, kind and target. Passwords, private keys and HTTP credentials remain hidden. When editing, leave the secret field blank to keep the saved value, or enter a new value to replace it.

SSH supports passwords, unencrypted OpenSSH Ed25519 private keys or base64-encoded 32-byte Ed25519 keys, and unencrypted OpenSSH RSA private keys. Leave the public keys blank and tap Save to display the server’s SHA256 fingerprint. Compare it with a trusted copy and tap Trust and Save. The probe does not send credentials. Subsequent connections check the saved key. After an expected server key change, edit the service, expand Verified Host Keys, clear the old keys, and save to verify the new fingerprint. You can also enter independently verified public keys, one per line. An HTTP origin must specify the exact `http(s)://host:port`, without a path, query or fragment. Save the complete Authorization value, such as `Bearer ...`, or the complete Cookie header value. Saved HTTP credentials are used only for requests with the same scheme, host and port.

Sign in and connect before saving service authentication. Signing out, an expired sign-in, or deleting the connection clears its local sign-in and any service authentication saved only on that device. Synced services are kept. Deleting a service under Service Authentication removes it from any devices that sync it.

## Global API

Like `SSHClient`, `Tailscale` is a global API. Do not import it from the `scripting` module.

| Method | Behavior |
| --- | --- |
| `Tailscale.selectConnection()` | Presents connection selection and permission for this run; cancellation returns `null`. |
| `Tailscale.open({ connectionId, signal? })` | Opens a signed-in connection and returns a script-owned `Tailscale.Session`. |
| `session.getStatus()` | Returns the `{ state }` runtime status. |
| `session.getPeers()` | Returns device `id`, `name`, `dnsName`, `addresses` and `online` fields. |
| `session.getServices()` | Returns saved service `id`, `name`, `kind`, `host`, `port`, `username` and `origin`, without secrets. |
| `session.fetch(url, options?)` | Sends HTTP/HTTPS through the connection and returns the existing `Response`. |
| `session.close()` | Asynchronously and idempotently closes this session, its requests and SSH clients. |

Use `SSHClient.connect({ tailscale: session, serviceId })` to read the saved SSH target and authentication locally, then use the existing SSH and SFTP APIs. HTTP requests can include `serviceId` to inject a saved header after matching its origin. Examples follow.

## Choose and open

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

An ID is a saved connection reference. Opening it can ask for access for the current script run. First sign-in stays in the App; scripts cannot create connections or read node identities and login keys. Peer `online` is a status snapshot, not a service reachability test.

## NAS HTTP status

Use a peer IP, hostname or full MagicDNS name. Requests only reach online Tailnet peers. Public destinations, subnet routes and exit nodes are unsupported. Ordinary `fetch` keeps its existing behavior.

```ts
async function main() {
  const connection = await Tailscale.selectConnection()
  if (!connection) return
  const url = await Dialog.prompt({ title: 'NAS URL', placeholder: 'http://my-device:port/path' })
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
        title: 'HTTP service authentication',
        actions: [{ label: 'No saved authentication' }, ...services.map(service => ({ label: service.name }))],
      })
      if (choice === null) return
      if (choice > 0) serviceId = services[choice - 1].id
    }
    const response = await session.fetch(url, {
      headers: { Accept: 'application/json' }, serviceId, timeout: 30000,
    })
    if (!response.ok) throw new Error(`NAS returned ${response.status}`)
    console.log(response.status, await response.text())
  } finally {
    await session.close()
  }
}
main().catch(console.error)
```

`session.fetch` returns the existing `Response` type. Bodies accept `string`, `Data` and `Uint8Array`, up to 8 MiB. Text/JSON and other whole-body helpers allow at most 16 MiB; read `response.body` in chunks for larger responses. Use `AbortSignal` to cancel. Total request timeout is 1–30000 ms, including reading the body. Closing or cancelling a response body releases its connection.

HTTPS verifies certificates and hostnames. Redirects stay within the exact original scheme and authority. Certificates without a trusted chain and cross-origin redirects fail; credentials are not forwarded to another origin. HTTP error statuses remain normal responses.

## WebDAV methods and files

```ts
async function main() {
  const connection = await Tailscale.selectConnection()
  if (!connection) return
  const session = await Tailscale.open({ connectionId: connection.id })
  try {
    const services = (await session.getServices()).filter(service =>
      service.kind === 'httpAuthorization' || service.kind === 'httpCookie')
    if (!services.length) throw new Error('Add HTTP service authentication in the App first')
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
      body: 'Created by my Scripting script', serviceId: service.id,
    })
    if (!put.ok) throw new Error(`Upload failed: ${put.status}`)
  } finally {
    await session.close()
  }
}
main().catch(console.error)
```

This example uses the HTTP service authentication you explicitly select. Replace `/dav/` with your own WebDAV directory before running. PUT includes `If-None-Match: *` to ask the server to refuse overwriting an existing file. Methods such as MKCOL and MOVE are available; CONNECT and TRACE are rejected. Request bodies are buffered within the limit; this is not a streaming upload API. Use SFTP for larger files.

## SSH command

```ts
async function main() {
  const connection = await Tailscale.selectConnection()
  if (!connection) return
  const session = await Tailscale.open({ connectionId: connection.id })
  try {
    const services = (await session.getServices()).filter(service =>
      ['sshPassword', 'sshEd25519', 'sshRSA'].includes(service.kind))
    if (!services.length) throw new Error('Add SSH service authentication in the App first')
    const choice = await Dialog.actionSheet({
      title: 'SSH service',
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

With `serviceId`, the App supplies the saved host, port, username, authentication and verified server public keys; those parameters cannot be overridden. Tailnet SSH disallows automatic reconnect. This connects to your usual SSH service; it does not turn on a Tailscale SSH server. Advanced scripts can still omit `serviceId` and explicitly provide the existing `host`, `port`, `authenticationMethod` and `trustedHostKeys` options.

## SFTP round trip

This standalone example opens its own SSH client:

```ts
async function main() {
  const connection = await Tailscale.selectConnection()
  if (!connection) return
  const session = await Tailscale.open({ connectionId: connection.id })
  try {
    const services = (await session.getServices()).filter(service =>
      ['sshPassword', 'sshEd25519', 'sshRSA'].includes(service.kind))
    if (!services.length) throw new Error('Add SSH service authentication in the App first')
    const choice = await Dialog.actionSheet({
      title: 'SSH service',
      actions: services.map(service => ({ label: `${service.name} (${service.username}@${service.host}:${service.port})` })),
    })
    if (choice === null) return
    const ssh = await SSHClient.connect({ tailscale: session, serviceId: services[choice].id })
    try {
      const sftp = await ssh.openSFTP()
      try {
        const path = await Dialog.prompt({
          title: 'New file path you own',
          placeholder: '/home/my-user/owned-scripting-example.txt',
        })
        if (!path) return
        const bytes = Data.fromRawString('Hello from Scripting')
        if (!bytes) throw new Error('Cannot encode data')
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

Use paths you own; `forceCreate` refuses an existing file. Close file, SFTP, SSH and Tailscale sessions in `finally`. For larger files, read/write bounded chunks with explicit offsets.

## Agent with saved services

After saving service authentication in the App, ask Agent: “Call tailscale `list_connections` and `list_services` to find my NAS SSH service. After my approval, use the returned `connection_id` and `service_id` to run `uname -a`. Do not start VPN or ask for passwords.”

HTTP, SSH and SFTP use the appropriate kind of saved-service reference. `http_request` still needs a URL within the saved origin. For `ssh_exec`, specify the command; for `sftp`, specify the operation and remote path. Targets and secrets stay in the App; no credential setup script is needed.

## Agent access and lifecycle

The App Agent has a `tailscale` tool for saved connections, `list_services`, status/peers, connect/disconnect, HTTP, SSH commands and SFTP list/stat/upload/download/rename/remove. Its approval describes the specific connection, saved service, target and operation. Use `connection_id` and `service_id` to reference authentication in the App; do not put passwords or private keys in tool arguments. Agent previews are bounded and marked as untrusted remote content. SSH returns stdout, stderr and the reported exit status; a missing status is `null`. File transfers allow up to 64 MiB and do not overwrite existing files. An Agent session can only cancel its own tasks.

Use `peers` to discover devices on a signed-in connection on demand. The `connect` command keeps the selected connection active after the call, subject to the App lifecycle. The `disconnect` command ends active App, script and Agent operations on that connection and preserves its sign-in and saved service authentication.

These connections follow iOS App lifecycle limits. Backgrounding or locking can end work; reopening a session may be necessary on return. Writes and remote commands are never automatically replayed. A running system VPN can affect the underlying connection; this feature does not promise to bypass it.

Handle `capabilityUnavailable` by running in the main App, `authenticationRequired` by signing in there, and `connectionClosed` by opening a new session after the user reconnects. Target, trust, permission, timeout and resource-limit failures must be handled explicitly.

## SSH and SFTP limits

Tailnet SSH clients share a maximum of eight open command or SFTP channels. Close unused channels before opening more. Tailnet SSH does not support jump connections. An unread command stream retains at most eight pending output chunks; falling behind raises an error and closes that command. Consume streams promptly and stop them explicitly when leaving a callback early.

Each SFTP client supports up to 32 pending requests and 32 open file or directory handles. A directory listing supports up to 1,000 entries; larger listings fail explicitly. Agent directory previews return up to 1,000 entries and report `truncated`. A stalled SFTP request times out after 30 seconds and can close that SFTP client. Reopen it explicitly if needed; failed writes are not replayed.
