import { Script } from "scripting"

async function main() {
  const connection = await Tailscale.selectConnection()
  if (!connection) return
  const session = await Tailscale.open({ connectionId: connection.id })
  try {
    const services = (await session.getServices()).filter(service =>
      ['sshPassword', 'sshEd25519', 'sshRSA'].includes(service.kind))
    if (!services.length) throw new Error('Add SSH service authentication in the App connection page first')
    const choice = await Dialog.actionSheet({
      title: 'SSH service',
      actions: services.map(service => ({ label: `${service.name} (${service.username}@${service.host}:${service.port})` })),
    })
    if (choice === null) return
    const ssh = await SSHClient.connect({ tailscale: session, serviceId: services[choice].id })
    try {
      const command = await Dialog.prompt({ title: 'SSH command', defaultValue: 'uname -a' })
      if (!command) return
      const output = await ssh.executeCommand(command, { maxResponseSize: 65536 })
      console.log(output)
      await Dialog.alert({ title: 'SSH result', message: output.slice(0, 4096) })
    } finally { await ssh.close() }
  } finally { await session.close() }
}
main()
  .catch(async error => { await Dialog.alert({ title: 'Tailscale', message: String(error) }) })
  .finally(() => { Script.exit() })
