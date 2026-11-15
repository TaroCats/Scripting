import { Script } from "scripting"

async function main() {
  const connection = await Tailscale.selectConnection()
  if (!connection) return
  const session = await Tailscale.open({ connectionId: connection.id })
  try {
    const peers = (await session.getPeers()).filter(peer => peer.online)
    console.log('Online devices:', peers)
    const url = await Dialog.prompt({
      title: 'NAS HTTP / HTTPS',
      message: peers.slice(0, 6).map(peer => peer.dnsName || peer.name).join('\n'),
      placeholder: 'http://my-device:port/path',
    })
    if (!url) return
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
    const response = await session.fetch(url, { timeout: 30000, serviceId })
    const text = await response.text()
    console.log('HTTP', response.status, text)
    await Dialog.alert({ title: `HTTP ${response.status}`, message: text.slice(0, 4096) })
  } finally {
    await session.close()
  }
}
main()
  .catch(async error => { await Dialog.alert({ title: 'Tailscale', message: String(error) }) })
  .finally(() => { Script.exit() })
